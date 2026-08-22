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


def _safe_log(value: str) -> str:
    """Strip newlines/control chars so untrusted email fields can't forge log lines."""
    if not value:
        return value
    return ''.join(ch for ch in value if ch.isprintable())


def decode_base64url(data: str) -> bytes:
    """Decode base64url data, restoring the '=' padding Gmail/Pub/Sub omit."""
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


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
        Get Gmail OAuth credentials for the running server.

        Only loads and (if needed) refreshes an existing token.json. Deliberately
        does NOT launch the interactive browser OAuth flow — that flow opens a
        local server and blocks waiting for a redirect, which would freeze this
        single-threaded async server on every request until someone completes
        it in a browser. Run `authenticate_gmail()` once, out-of-band, to create
        token.json before starting the server (see README "Authenticate Gmail").
        """
        if not Path(self.settings.TOKEN_FILE).exists():
            logger.error(
                f"{self.settings.TOKEN_FILE} not found. Run authenticate_gmail() once "
                "to complete the OAuth flow and create it before starting the server."
            )
            return None

        try:
            creds = Credentials.from_authorized_user_file(
                self.settings.TOKEN_FILE,
                scopes=self.settings.GMAIL_SCOPES
            )
        except Exception as e:
            logger.error(f"Failed to load {self.settings.TOKEN_FILE}: {e}")
            return None

        if creds.valid:
            return creds

        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                logger.info("Refreshed expired credentials")
            except RefreshError as e:
                logger.error(
                    f"Failed to refresh credentials: {e}. Re-run authenticate_gmail()."
                )
                return None
            try:
                with open(self.settings.TOKEN_FILE, 'w') as token_file:
                    token_file.write(creds.to_json())
            except Exception as e:
                logger.error(f"Failed to save refreshed token: {e}")
            return creds

        logger.error(f"Token in {self.settings.TOKEN_FILE} is invalid. Re-run authenticate_gmail().")
        return None
    
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
                attachment_names = ', '.join(_safe_log(att['filename']) for att in attachments)
                logger.info(
                    f"New financial email received\n"
                    f"  From: {_safe_log(sender)}\n"
                    f"  Subject: {_safe_log(subject)}\n"
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
    
    @staticmethod
    def _sanitize_filename(filename: str, message_id: str) -> str:
        """
        Reduce an untrusted email attachment filename to a bare, safe basename.

        Attachment filenames come from the sender and are not trustworthy input:
        without this, a crafted filename (e.g. containing '../' or an absolute
        path) could write outside the downloads directory (path traversal).
        """
        name = Path(filename or '').name  # drop any directory components
        name = name.replace('\\', '_')    # backslashes survive .name on POSIX
        name = name.strip().lstrip('.')   # avoid empty/hidden/relative-looking names
        if not name:
            name = f"attachment_{message_id[-8:]}"
        return name

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
        raw_filename = attachment.get('filename', 'unknown')
        filename = self._sanitize_filename(raw_filename, message_id)

        if not attachment_id:
            logger.warning(f"No attachmentId for {_safe_log(raw_filename)}")
            return None

        try:
            # Get attachment data
            att_data = self.service.users().messages().attachments().get(
                userId=self.settings.GMAIL_USER_ID,
                messageId=message_id,
                id=attachment_id
            ).execute()

            # Decode base64url data
            file_data = decode_base64url(att_data.get('data', ''))

            # Create safe filename (handle duplicates)
            download_path = Path(self.settings.DOWNLOAD_DIR)
            download_path.mkdir(exist_ok=True)
            download_root = download_path.resolve()

            file_path = download_path / filename

            # If file exists, add message ID to avoid overwriting
            if file_path.exists():
                stem = Path(filename).stem
                suffix = Path(filename).suffix
                filename = f"{stem}_{message_id[-8:]}{suffix}"
                file_path = download_path / filename

            # Defense in depth: confirm the resolved path is still inside downloads/
            resolved_path = (download_path / filename).resolve()
            if download_root != resolved_path.parent:
                logger.error(
                    f"Refusing to write attachment outside downloads dir: {_safe_log(raw_filename)}"
                )
                return None

            # Write file
            with open(resolved_path, 'wb') as f:
                f.write(file_data)

            logger.info(f"Attachment downloaded successfully:\n  {resolved_path}")
            return str(resolved_path)
        except HttpError as e:
            logger.error(f"Gmail API error downloading attachment: {e}")
            return None
        except Exception as e:
            logger.error(f"Error downloading attachment {_safe_log(raw_filename)}: {e}")
            return None


# Global service instance
_gmail_service: Optional[GmailService] = None


def get_gmail_service() -> GmailService:
    """Get or create Gmail service singleton"""
    global _gmail_service
    if _gmail_service is None:
        _gmail_service = GmailService()
    return _gmail_service


def authenticate_gmail() -> bool:
    """
    Run the interactive OAuth flow once, out-of-band, and save token.json.

    Opens a browser for consent and blocks until you complete it there — run
    this manually from a terminal before starting the server, never from
    within the running FastAPI app. Returns True on success.
    """
    settings = get_settings()

    if not Path(settings.CREDENTIALS_FILE).exists():
        logger.error(
            f"{settings.CREDENTIALS_FILE} not found. Download an OAuth client "
            "(Desktop app type) from Google Cloud Console and place it here."
        )
        return False

    try:
        flow = InstalledAppFlow.from_client_secrets_file(
            settings.CREDENTIALS_FILE,
            scopes=settings.GMAIL_SCOPES
        )
        creds = flow.run_local_server(port=0)
    except Exception as e:
        logger.error(f"OAuth flow failed: {e}")
        return False

    try:
        with open(settings.TOKEN_FILE, 'w') as token_file:
            token_file.write(creds.to_json())
    except Exception as e:
        logger.error(f"Failed to save token: {e}")
        return False

    logger.info(f"Completed OAuth flow, saved token to {settings.TOKEN_FILE}")
    return True
