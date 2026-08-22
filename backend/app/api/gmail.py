"""Gmail webhook routes"""
import json
import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request

from app.core.config import get_settings
from app.services.gmail_service import get_gmail_service, decode_base64url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


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
                
                for attachment in attachments:
                    try:
                        gmail_service.download_attachment(message_id, attachment)
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
