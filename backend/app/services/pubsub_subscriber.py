"""Pull-mode Pub/Sub subscriber.

An alternative to the push webhook: instead of Google POSTing to a public
HTTPS endpoint, the app opens an outbound streaming-pull connection and fetches
notifications itself. That removes the need for a public hostname, a TLS
certificate, and an internet-reachable webhook -- useful when the host only has
a bare IP, and strictly better for exposure since there is no inbound endpoint
to discover.

Threading note: the Pub/Sub client is synchronous and invokes callbacks on its
own thread pool, while the processing pipeline is async. Each message is
therefore handed back to the main event loop with
asyncio.run_coroutine_threadsafe, and the callback thread blocks on the result
so the ack only happens once processing has actually finished. The client's
lease management extends the ack deadline in the background while that runs.
"""
import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Upper bound on how long one notification may take before we give up and let
# Pub/Sub redeliver. Generous: extraction plus a Gemini call, with headroom.
PROCESS_TIMEOUT_SECONDS = 600

_streaming_future: Optional[Any] = None
_client: Optional[Any] = None


def is_pull_mode() -> bool:
    settings = get_settings()
    return bool(settings.PUBSUB_SUBSCRIPTION_ID and settings.GOOGLE_CLOUD_PROJECT_ID)


def start_pull_subscriber(
    loop: asyncio.AbstractEventLoop,
    handler: Callable[[str, str], Awaitable[None]],
) -> bool:
    """
    Begin streaming-pull in a background thread. Returns True if started.

    Failure to start is logged and returns False rather than raising -- the app
    should still come up (serving the dashboard API) even if Pub/Sub
    credentials are missing or wrong.
    """
    global _streaming_future, _client

    settings = get_settings()
    if not is_pull_mode():
        return False

    try:
        from google.cloud import pubsub_v1
    except ImportError:
        logger.error(
            "PUBSUB_SUBSCRIPTION_ID is set but google-cloud-pubsub is not installed. "
            "Add it to requirements.txt and reinstall."
        )
        return False

    try:
        _client = pubsub_v1.SubscriberClient()
        subscription_path = _client.subscription_path(
            settings.GOOGLE_CLOUD_PROJECT_ID, settings.PUBSUB_SUBSCRIPTION_ID
        )
    except Exception as e:
        logger.error(f"Could not create Pub/Sub subscriber client: {e}")
        return False

    def callback(message: Any) -> None:
        # message.data is the raw notification payload -- the client library has
        # already base64-decoded it, unlike the HTTP push representation.
        try:
            notification = json.loads(message.data)
            email_address = notification.get('emailAddress', '')
            history_id = str(notification.get('historyId', ''))
        except (ValueError, TypeError) as e:
            # Malformed payload: redelivering it will fail identically, so ack
            # to drop it rather than looping forever on a poison message.
            logger.error(f"Discarding malformed Pub/Sub message: {e}")
            message.ack()
            return

        logger.info(
            f"Pub/Sub pull received\n"
            f"  emailAddress: {email_address}\n"
            f"  historyId: {history_id}"
        )

        try:
            future = asyncio.run_coroutine_threadsafe(
                handler(email_address, history_id), loop
            )
            future.result(timeout=PROCESS_TIMEOUT_SECONDS)
        except Exception as e:
            # Leave it unacked so Pub/Sub redelivers. The pipeline is
            # idempotent per (message_id, filename), so a retry re-runs safely.
            logger.error(f"Processing failed, nacking for redelivery: {e}")
            try:
                message.nack()
            except Exception:
                pass
            return

        message.ack()

    # One message at a time: process_new_emails() serializes on a process-wide
    # lock anyway, so pulling more just parks them in memory holding leases.
    flow_control = pubsub_v1.types.FlowControl(max_messages=1)

    try:
        _streaming_future = _client.subscribe(
            subscription_path, callback=callback, flow_control=flow_control
        )
    except Exception as e:
        logger.error(f"Could not start Pub/Sub streaming pull: {e}")
        return False

    logger.info(f"Pub/Sub pull subscriber started on {subscription_path}")
    return True


def stop_pull_subscriber() -> None:
    """Cancel the streaming pull and close the client. Safe to call twice."""
    global _streaming_future, _client

    if _streaming_future is not None:
        try:
            _streaming_future.cancel()
            _streaming_future.result(timeout=10)
        except Exception:
            # Cancellation raising is expected/harmless during shutdown.
            pass
        _streaming_future = None

    if _client is not None:
        try:
            _client.close()
        except Exception as e:
            logger.warning(f"Error closing Pub/Sub client: {e}")
        _client = None

    logger.info("Pub/Sub pull subscriber stopped")
