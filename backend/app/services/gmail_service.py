"""Gmail service for OAuth, watching, and retrieving emails"""
import base64
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class GmailService:
    """Service for Gmail OAuth, watch, and email operations"""
    
    def __init__(self):
        self.settings = get_settings()
        self.service = None
        self._initialize_service()
    
    def _initialize_service(self):
        """Initialize Gmail API service with OAuth"""
        try:
            creds = self._get_credentials()
            if creds:
                self.service = build('gmail', 'v1', credentials=creds)
                logger.info("Gmail service initialized successfully")
            else:
                logger.warning("Failed to initialize Gmail service - no credentials")
        except Exception as e:
            logger.error(f"Error initializing Gmail service: {e}")
            self.service = None
    
    def _get_credentials(self) -> Optional[Credentials]:
        """
        Get Gmail OAuth credentials.
        
        First tries to load existing token.json. If not available or expired,
        performs OAuth flow and saves new token.
        """
        creds = None
        
        # Try to load existing token
        if Path(self.settings.TOKEN_FILE).exists():
            try:
                creds = Credentials.from_authorized_user_file(
                    self.settings.TOKEN_FILE,
                    scopes=self.settings.GMAIL_SCOPES
                )
                logger.info("Loaded existing token from token.json")
            except Exception as e:
                logger.warning(f"Failed to load token.json: {e}")
                creds = None
        
        # If no valid token, perform OAuth flow
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    logger.info("Refreshed expired credentials")
                except RefreshError as e:
                    logger.error(f"Failed to refresh credentials: {e}")
                    creds = None
            else:
                # Perform full OAuth flow
                try:
                    if not Path(self.settings.CREDENTIALS_FILE).exists():
                        logger.error(
                            f"credentials.json not found at {self.settings.CREDENTIALS_FILE}. "
                            "Please download from Google Cloud Console and place in root directory."
                        )
                        return None
                    
                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.settings.CREDENTIALS_FILE,
                        scopes=self.settings.GMAIL_SCOPES
                    )
                    creds = flow.run_local_server(port=0)
                    logger.info("Completed OAuth flow")
                except Exception as e:
                    logger.error(f"OAuth flow failed: {e}")
                    return None
            
            # Save token for future use
            if creds:
                try:
                    with open(self.settings.TOKEN_FILE, 'w') as token_file:
                        token_file.write(creds.to_json())
                    logger.info(f"Saved new token to {self.settings.TOKEN_FILE}")
                except Exception as e:
                    logger.error(f"Failed to save token: {e}")
        
        return creds
    
    def start_watch(self) -> Optional[Dict[str, Any]]:
        """
        Start watching Gmail inbox for changes.
        
        Calls Gmail users.watch() API and logs historyId and expiration.
        Returns watch response or None on failure.
        """
        if not self.service:
            logger.error("Gmail service not initialized")
            return None
        
        if not self.settings.GOOGLE_CLOUD_PROJECT_ID:
            logger.error("GOOGLE_CLOUD_PROJECT_ID not set in environment")
            return None
        
        try:
            pubsub_topic = f"projects/{self.settings.GOOGLE_CLOUD_PROJECT_ID}/topics/{self.settings.GMAIL_PUBSUB_TOPIC}"
            
            request_body = {
                'topicName': pubsub_topic,
                'labelIds': ['INBOX'],  # Only watch INBOX
            }
            
            response = self.service.users().watch(
                userId=self.settings.GMAIL_USER_ID,
                body=request_body
            ).execute()
            
            history_id = response.get('historyId')
            expiration = response.get('expiration')
            
            logger.info(
                f"Gmail watch started successfully\n"
                f"  historyId: {history_id}\n"
                f"  expiration: {expiration}\n"
                f"  topic: {pubsub_topic}"
            )
            
            return response
        except HttpError as e:
            logger.error(f"Gmail API error while starting watch: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error starting watch: {e}")
            return None
    
    def get_last_history_id(self) -> Optional[str]:
        """Get the last processed Gmail history ID from state file"""
        try:
            if Path(self.settings.STATE_FILE).exists():
                with open(self.settings.STATE_FILE, 'r') as f:
                    state = json.load(f)
                    last_id = state.get('last_history_id')
                    if last_id:
                        logger.debug(f"Loaded last_history_id: {last_id}")
                    return last_id
        except Exception as e:
            logger.error(f"Error reading state file: {e}")
        
        return None
    
    def save_history_id(self, history_id: str) -> bool:
        """Save the last processed Gmail history ID to state file"""
        try:
            state = {'last_history_id': history_id}
            with open(self.settings.STATE_FILE, 'w') as f:
                json.dump(state, f)
            logger.debug(f"Saved last_history_id: {history_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving state file: {e}")
            return False
    
    def get_new_message_ids(self, start_history_id: str) -> List[str]:
        """
        Get new message IDs since start_history_id.
        
        Uses Gmail users.history.list() with historyTypes=messageAdded.
        """
        if not self.service:
            logger.error("Gmail service not initialized")
            return []
        
        if not start_history_id:
            logger.warning("No start_history_id provided")
            return []
        
        message_ids = set()  # Use set to avoid duplicates
        
        try:
            page_token = None
            while True:
                results = self.service.users().history().list(
                    userId=self.settings.GMAIL_USER_ID,
                    startHistoryId=start_history_id,
                    historyTypes=['messageAdded'],
                    pageToken=page_token
                ).execute()
                
                histories = results.get('history', [])
                for history in histories:
                    messages = history.get('messages', [])
                    for message in messages:
                        message_ids.add(message['id'])
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            if message_ids:
                logger.info(f"Found {len(message_ids)} new messages since historyId {start_history_id}")
            
            return list(message_ids)
        except HttpError as e:
            logger.error(f"Gmail API error while listing history: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting new message IDs: {e}")
            return []
    
    def get_message_details(self, message_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve message details including metadata and attachments.
        
        Returns dict with: id, sender, subject, date, attachments (list of dicts)
        """
        if not self.service:
            logger.error("Gmail service not initialized")
            return None
        
        try:
            message = self.service.users().messages().get(
                userId=self.settings.GMAIL_USER_ID,
                id=message_id,
                format='full'
            ).execute()
            
            headers = message['payload'].get('headers', [])
            
            # Extract header fields
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '(No Subject)')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), 'Unknown')
            
            # Find attachments
            attachments = self._find_attachments(message['payload'])
            
            message_details = {
                'id': message_id,
                'sender': sender,
                'subject': subject,
                'date': date,
                'attachments': attachments,
            }
            
            if attachments:
                attachment_names = ', '.join([att['filename'] for att in attachments])
                logger.info(
                    f"New financial email received\n"
                    f"  From: {sender}\n"
                    f"  Subject: {subject}\n"
                    f"  Attachment: {attachment_names}"
                )
            
            return message_details
        except HttpError as e:
            logger.error(f"Gmail API error while getting message {message_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting message details: {e}")
            return None
    
    def _find_attachments(self, payload: Dict[str, Any], parent_id: str = '') -> List[Dict[str, str]]:
        """
        Recursively find all attachments in message payload (handles nested MIME parts).
        
        Returns list of dicts with: filename, mimeType, attachmentId, messageId
        """
        attachments = []
        
        # Check current part
        if 'filename' in payload and payload['filename']:
            filename = payload['filename']
            mime_type = payload.get('mimeType', '')
            
            # Filter by allowed file types
            allowed_extensions = ['.pdf', '.xlsx', '.xls', '.csv']
            if any(filename.lower().endswith(ext) for ext in allowed_extensions):
                attachments.append({
                    'filename': filename,
                    'mimeType': mime_type,
                    'attachmentId': payload.get('body', {}).get('attachmentId', ''),
                })
        
        # Recursively check parts
        if 'parts' in payload:
            for part in payload['parts']:
                attachments.extend(self._find_attachments(part, parent_id))
        
        return attachments
    
    def download_attachment(self, message_id: str, attachment: Dict[str, str]) -> Optional[str]:
        """
        Download attachment and save to downloads directory.
        
        Handles duplicate filenames by including message ID.
        Returns path to saved file or None on failure.
        """
        if not self.service:
            logger.error("Gmail service not initialized")
            return None
        
        attachment_id = attachment.get('attachmentId')
        filename = attachment.get('filename', 'unknown')
        
        if not attachment_id:
            logger.warning(f"No attachmentId for {filename}")
            return None
        
        try:
            # Get attachment data
            att_data = self.service.users().messages().attachments().get(
                userId=self.settings.GMAIL_USER_ID,
                messageId=message_id,
                id=attachment_id
            ).execute()
            
            # Decode base64url data
            file_data = base64.urlsafe_b64decode(att_data.get('data', ''))
            
            # Create safe filename (handle duplicates)
            download_path = Path(self.settings.DOWNLOAD_DIR)
            download_path.mkdir(exist_ok=True)
            
            file_path = download_path / filename
            
            # If file exists, add message ID to avoid overwriting
            if file_path.exists():
                name, ext = filename.rsplit('.', 1)
                filename = f"{name}_{message_id[-8:]}.{ext}"
                file_path = download_path / filename
            
            # Write file
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            logger.info(f"Attachment downloaded successfully:\n  {file_path}")
            return str(file_path)
        except HttpError as e:
            logger.error(f"Gmail API error downloading attachment: {e}")
            return None
        except Exception as e:
            logger.error(f"Error downloading attachment {filename}: {e}")
            return None


# Global service instance
_gmail_service: Optional[GmailService] = None


def get_gmail_service() -> GmailService:
    """Get or create Gmail service singleton"""
    global _gmail_service
    if _gmail_service is None:
        _gmail_service = GmailService()
    return _gmail_service
