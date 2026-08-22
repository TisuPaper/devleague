"""Gmail webhook routes"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from email.utils import parseaddr
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request

from app.core.config import get_settings
from app.services.gmail_service import get_gmail_service, decode_base64url
from app.services.extraction_service import extract_text
from app.services.pii_service import redact_pii
from app.services.company_service import derive_client_company
from app.services.analysis_service import analyze_financial_document
from app.services.store_service import record_processed_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Pub/Sub is at-least-once delivery -- it can and will redeliver the same
# notification. process_new_emails() reads last_history_id, processes, then
# saves the new value at the end; without serializing that, two overlapping
# deliveries of the same notification both read the same stale
# last_history_id and reprocess the same message(s) concurrently (extra
# downloads, extra PII redaction, and -- worse -- extra billed Gemini calls
# for the identical document). A single process-wide lock is enough here:
# this app runs as one process, and correctness/cost matters far more than
# throughput for this pipeline.
_processing_lock = asyncio.Lock()


@router.post("/gmail")
async def gmail_webhook(request: Request, body: Dict[str, Any], background_tasks: BackgroundTasks):
    """
    Handle Gmail Pub/Sub push webhook.

    Pub/Sub sends JSON with structure:
    {
        "message": {
            "data": "BASE64_DATA"  # Contains { "emailAddress": "...", "historyId": "..." }
        }
    }

    Returns immediately with 200 OK, processes email in background.
    """
    # Optional shared-secret check: if PUBSUB_VERIFICATION_TOKEN is configured,
    # the Pub/Sub push subscription's endpoint URL must include a matching
    # ?token= query param. This is a lightweight guard against anyone who
    # discovers the (ngrok) URL triggering processing without authorization.
    # See README "Security Notes" for the production-grade OIDC alternative.
    settings = get_settings()
    if settings.PUBSUB_VERIFICATION_TOKEN:
        if request.query_params.get('token') != settings.PUBSUB_VERIFICATION_TOKEN:
            logger.warning("Rejected webhook call with missing/invalid verification token")
            raise HTTPException(status_code=403, detail="Invalid verification token")

    try:
        # Extract message data
        message_data = body.get('message', {}).get('data')
        
        if not message_data:
            logger.warning("Received webhook with no message data")
            return {"status": "received", "message": "No data to process"}
        
        # Decode base64url data
        try:
            decoded_data = decode_base64url(message_data)
            notification = json.loads(decoded_data)
        except (ValueError, json.JSONDecodeError) as e:
            logger.error(f"Failed to decode Pub/Sub message: {e}")
            return {"status": "received", "message": "Invalid data format"}
        
        email_address = notification.get('emailAddress', '')
        history_id = notification.get('historyId', '')
        
        logger.info(
            f"Gmail webhook received\n"
            f"  emailAddress: {email_address}\n"
            f"  historyId: {history_id}"
        )
        
        # Process email in background
        background_tasks.add_task(
            process_new_emails,
            email_address=email_address,
            history_id=history_id
        )
        
        return {"status": "received"}
    
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        # Return 200 OK to acknowledge Pub/Sub message (prevent redelivery)
        return {"status": "received", "error": str(e)}


async def process_new_emails(email_address: str, history_id: str):
    """
    Background task to process new emails.
    
    Flow:
    1. Read last processed historyId
    2. Get new message IDs since last processed
    3. For each message, get details and download attachments
    4. Update state file
    """
    gmail_service = get_gmail_service()

    # Serialize the whole read-process-save cycle: Pub/Sub can redeliver the
    # same notification while a prior delivery's (slow, Gemini-calling)
    # processing is still in flight. Without this lock, a second delivery
    # would read the same not-yet-updated last_history_id and reprocess the
    # same message(s) concurrently.
    async with _processing_lock:
        try:
            # Get last processed history ID
            last_history_id = gmail_service.get_last_history_id()

            if not last_history_id:
                logger.info(f"No previous history ID, starting from current: {history_id}")
                gmail_service.save_history_id(history_id)
                return

            # Get new message IDs since last processed
            message_ids = gmail_service.get_new_message_ids(last_history_id)

            if not message_ids:
                logger.info("No new messages to process")
                gmail_service.save_history_id(history_id)
                return

            # Process each message
            for message_id in message_ids:
                try:
                    # Get message details
                    message_details = gmail_service.get_message_details(message_id)

                    if not message_details:
                        logger.warning(f"Failed to get details for message {message_id}")
                        continue

                    # Download attachments
                    attachments = message_details.get('attachments', [])
                    sender = message_details.get('sender', '')

                    if not _sender_domain_allowed(sender):
                        logger.info(
                            f"Skipping message {message_id}: sender domain not in "
                            f"ALLOWED_SENDER_DOMAINS allowlist"
                        )
                        continue

                    for attachment in attachments:
                        try:
                            downloaded_path = gmail_service.download_attachment(message_id, attachment)
                            if downloaded_path:
                                await _process_attachment_pipeline(
                                    downloaded_path,
                                    message_id,
                                    sender,
                                    attachment.get('filename', ''),
                                )
                        except Exception as e:
                            logger.error(f"Error downloading attachment: {e}")
                            # Continue with next attachment
                            continue

                except Exception as e:
                    logger.error(f"Error processing message {message_id}: {e}")
                    # Continue with next message
                    continue

            # Update state with current history ID
            gmail_service.save_history_id(history_id)
            logger.info(f"Finished processing {len(message_ids)} new emails")

        except Exception as e:
            logger.error(f"Error in email processing task: {e}", exc_info=True)


def _sender_domain_allowed(sender: str) -> bool:
    """
    Check sender's email domain against ALLOWED_SENDER_DOMAINS.

    A blank/unset allowlist means "allow everything" (the default, backward
    compatible with no filtering configured). Comparison is case-insensitive
    domain equality, not substring matching, so "notn2nconnect.com" doesn't
    incorrectly match an allowlist entry of "n2nconnect.com".
    """
    settings = get_settings()
    allowlist_raw = settings.ALLOWED_SENDER_DOMAINS.strip()
    if not allowlist_raw:
        return True

    allowed = {d.strip().lower() for d in allowlist_raw.split(',') if d.strip()}
    domain = derive_client_company(sender).get('client_company')
    return domain in allowed


async def _process_attachment_pipeline(
    downloaded_path: str,
    message_id: str,
    sender: str,
    original_filename: str = '',
) -> None:
    """
    Run extract -> redact -> AI analysis -> persist on a just-downloaded
    attachment, all within this same background task.

    Any failure here is logged and swallowed -- a bad file, an unparseable
    sender, or a failed AI call must not stop processing of the remaining
    attachments/messages in this batch, and must never crash the background
    task or (for the AI call specifically) block the server's event loop.
    """
    settings = get_settings()
    file_path = Path(downloaded_path)
    company_info = derive_client_company(sender)
    display_name = original_filename or file_path.name

    text = extract_text(file_path)
    if text is None:
        logger.warning(f"No text extracted from {file_path.name}, skipping PII/analysis stages")
        # Still record it: the dashboard needs to surface unreadable
        # attachments as a follow-up issue rather than silently dropping them.
        _record_for_dashboard(
            company_info=company_info,
            sender=sender,
            message_id=message_id,
            original_filename=display_name,
            stored_path=str(file_path),
            redaction_counts={},
            analysis=None,
            extraction_ok=False,
        )
        return

    redacted_text, redaction_counts = redact_pii(text)

    if redaction_counts:
        summary = ', '.join(f"{label}={count}" for label, count in redaction_counts.items())
        logger.info(f"Redacted PII from {file_path.name}: {summary}")
    else:
        logger.info(f"No PII patterns matched in {file_path.name}")

    ai_result = await analyze_financial_document(
        redacted_text, message_id, company_info.get('client_company')
    )

    _record_for_dashboard(
        company_info=company_info,
        sender=sender,
        message_id=message_id,
        original_filename=display_name,
        stored_path=str(file_path),
        redaction_counts=redaction_counts,
        analysis=ai_result,
        extraction_ok=True,
    )

    try:
        processed_dir = Path(settings.PROCESSED_DIR)
        processed_dir.mkdir(exist_ok=True)
        output_path = processed_dir / f"{file_path.name}.json"
        with open(output_path, 'w') as f:
            json.dump({
                'message_id': message_id,
                'source_file': str(file_path),
                'extracted_at': datetime.now(timezone.utc).isoformat(),
                'client_company': company_info.get('client_company'),
                'is_generic_domain': company_info.get('is_generic_domain'),
                'redaction_counts': redaction_counts,
                'redacted_text': redacted_text,
                'ai_analysis': ai_result,
            }, f, indent=2)
        logger.info(f"Saved processed output: {output_path}")
    except Exception as e:
        logger.error(f"Failed to save processed output for {file_path.name}: {e}")


def _record_for_dashboard(
    company_info: Dict[str, Any],
    sender: str,
    message_id: str,
    original_filename: str,
    stored_path: str,
    redaction_counts: Dict[str, int],
    analysis: Optional[Dict[str, Any]],
    extraction_ok: bool,
) -> None:
    """Persist this attachment's result for the dashboard API to serve.

    Failures are logged, never raised: the file has already been downloaded,
    redacted, and written to processed/, so a storage hiccup here must not
    lose that work or break the rest of the batch.
    """
    domain = company_info.get('client_company')
    if not domain:
        logger.warning(
            f"No client domain parsed from sender for message {message_id}; "
            "skipping dashboard record"
        )
        return

    _, contact_email = parseaddr(sender or '')
    try:
        record_processed_document(
            domain=domain,
            is_generic_domain=bool(company_info.get('is_generic_domain')),
            contact_email=contact_email,
            message_id=message_id,
            original_filename=original_filename,
            stored_path=stored_path,
            redaction_counts=redaction_counts,
            analysis=analysis,
            extraction_ok=extraction_ok,
        )
    except Exception as e:
        logger.error(f"Failed to record dashboard entry for message {message_id}: {e}")
