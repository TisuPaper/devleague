# Financial Email Receiver Backend

FastAPI backend for receiving emails from Gmail via Google Cloud Pub/Sub, extracting attachments (PDF/XLSX), and preparing for financial analysis.

## Features

- **Gmail OAuth 2.0**: Secure authentication using Google OAuth
- **Gmail Watch API**: Monitor inbox for new emails in real-time
- **Pub/Sub Webhook**: Receive notifications via Google Cloud Pub/Sub
- **Email Retrieval**: Fetch new email metadata (sender, subject, date)
- **Attachment Filtering**: Extract only PDF, XLSX, XLS, and CSV files
- **Attachment Downloading**: Download attachments locally with duplicate handling
- **Error Handling**: Robust error handling to prevent crashes from bad emails
- **State Management**: Track processed emails using local JSON state file

## Architecture

```
Gmail (via API)
  ↓
Gmail Push Notification
  ↓
Google Cloud Pub/Sub
  ↓
FastAPI Webhook
  ↓
Detect new email
  ↓
Retrieve email metadata
  ↓
Find PDF/XLSX attachments
  ↓
Download to local directory
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app factory
│   ├── api/
│   │   ├── __init__.py
│   │   └── gmail.py            # Gmail webhook routes
│   ├── services/
│   │   ├── __init__.py
│   │   └── gmail_service.py    # Gmail API operations
│   └── core/
│       ├── __init__.py
│       └── config.py           # Settings and environment
├── downloads/                  # Downloaded attachments
├── credentials.json            # (git ignored) Google OAuth credentials
├── token.json                  # (git ignored) Generated OAuth token
├── gmail_state.json            # (git ignored) Last processed historyId
├── .env                        # (git ignored) Environment variables
├── .env.example               # Example environment file
├── .gitignore
├── requirements.txt
└── README.md
```

## Setup

### 1. Prerequisites

- Python 3.11+
- Google Cloud Account
- Gmail Account

### 2. Create Virtual Environment

```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Google Cloud Setup

#### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable these APIs:
   - Gmail API
   - Cloud Pub/Sub API
4. Create a Service Account or OAuth 2.0 Desktop Client

#### Download OAuth Credentials

1. Go to **Credentials** in Google Cloud Console
2. Create **OAuth 2.0 Client ID** (Desktop application)
3. Download the JSON file
4. Save as `backend/credentials.json`

#### Create Pub/Sub Topic (optional for testing)

```bash
gcloud pubsub topics create finance-mail
```

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
APP_NAME=Financial Email Receiver
ENVIRONMENT=development
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GMAIL_PUBSUB_TOPIC=finance-mail
DOWNLOAD_DIR=downloads
```

## Running the Application

### Start FastAPI Server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### API Endpoints

#### Health Check

```bash
curl http://localhost:8000/api/health
```

Response:
```json
{
  "status": "healthy"
}
```

#### Root

```bash
curl http://localhost:8000/
```

Response:
```json
{
  "message": "Financial Email Receiver",
  "status": "running",
  "environment": "development"
}
```

#### Gmail Webhook (Pub/Sub)

```bash
POST http://localhost:8000/api/webhooks/gmail
Content-Type: application/json

{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAibWVAZ21haWwuY29tIiwgImhpc3RvcnlJZCI6ICI1Njc4OTAifQ=="
  }
}
```

## Testing Full Workflow

### Step 1: Authenticate Gmail

Run a quick test to ensure credentials are set up:

```python
from app.services.gmail_service import get_gmail_service

service = get_gmail_service()
print("Gmail service initialized successfully!")
```

### Step 2: Start Gmail Watch

Run the `start_gmail_watch()` function to set up the Gmail watch:

```python
from app.services.gmail_service import get_gmail_service

service = get_gmail_service()
watch_response = service.start_watch()

if watch_response:
    print(f"Gmail watch started: {watch_response}")
else:
    print("Failed to start watch")
```

This logs the `historyId` and `expiration` time.

### Step 3: Expose FastAPI with ngrok

Install ngrok:

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

Expose your local server:

```bash
ngrok http 8000
```

This will output a public URL like:
```
https://your-ngrok-url.ngrok.io
```

### Step 4: Configure Pub/Sub Push Subscription

Create a Pub/Sub subscription (if not exists):

```bash
gcloud pubsub subscriptions create finance-mail-sub \
  --topic finance-mail \
  --push-endpoint https://your-ngrok-url.ngrok.io/api/webhooks/gmail \
  --push-auth-service-account your-service-account@your-project.iam.gserviceaccount.com
```

Replace:
- `your-ngrok-url` with your ngrok URL
- `your-service-account` with your Google Cloud service account

### Step 5: Send Test Email

Send an email to your Gmail account with:
- Subject: "Test Report"
- Attachment: A PDF or XLSX file

### Step 6: Verify Attachment Downloaded

Check the `downloads/` directory:

```bash
ls -la downloads/
```

You should see your attachment file there.

### Logs

The application logs key events:

```
2026-08-22 10:15:30 - app.services.gmail_service - INFO - Gmail watch started successfully
2026-08-22 10:16:45 - app.api.gmail - INFO - Gmail webhook received
2026-08-22 10:16:46 - app.services.gmail_service - INFO - Found 1 new messages
2026-08-22 10:16:47 - app.services.gmail_service - INFO - New financial email received
  From: sender@example.com
  Subject: Test Report
  Attachment: test_report.xlsx
2026-08-22 10:16:48 - app.services.gmail_service - INFO - Attachment downloaded successfully
  downloads/test_report.xlsx
```

## Key Functions

### GmailService

#### `get_gmail_service()`
Returns singleton instance of Gmail service with OAuth credentials.

#### `start_watch()`
Starts Gmail watch API to receive Pub/Sub notifications for new emails in INBOX.

#### `get_last_history_id()`
Reads the last processed Gmail historyId from `gmail_state.json`.

#### `save_history_id(history_id)`
Saves the current historyId to `gmail_state.json`.

#### `get_new_message_ids(start_history_id)`
Retrieves all new message IDs added since `start_history_id`.

#### `get_message_details(message_id)`
Gets full message metadata (sender, subject, date) and finds attachments.

#### `download_attachment(message_id, attachment)`
Downloads attachment using Gmail API and saves to `downloads/` directory.

## Error Handling

The application handles:

- ✅ Missing `credentials.json`
- ✅ Invalid or expired OAuth tokens
- ✅ Missing Pub/Sub data in webhook
- ✅ Invalid Base64 encoding
- ✅ Gmail API errors (rate limits, auth failures)
- ✅ No attachments in email
- ✅ Unsupported file types (only PDF, XLSX, XLS, CSV accepted)
- ✅ Duplicate message processing
- ✅ Invalid/expired Gmail history ID

None of these errors will crash the FastAPI application. They're logged and processing continues gracefully.

## Next Steps

After this foundation is working, you can add:

1. **PDF/XLSX Parsing**: Extract text and tables from attachments
2. **PII Redaction**: Remove sensitive data (SSN, account numbers, etc.)
3. **Financial Analysis**: Parse and extract financial metrics
4. **AI Insights**: Use LLM to generate analysis
5. **PostgreSQL**: Store processed data in database
6. **Next.js Dashboard**: Visualize results

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | Financial Email Receiver |
| `ENVIRONMENT` | Environment (development/production) | development |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID | (required) |
| `GMAIL_PUBSUB_TOPIC` | Pub/Sub topic name | finance-mail |
| `DOWNLOAD_DIR` | Directory for downloaded attachments | downloads |

## Troubleshooting

### "credentials.json not found"
- Download OAuth credentials from Google Cloud Console
- Place in the `backend/` directory

### "Gmail service not initialized"
- Ensure credentials.json exists
- Check Google Cloud project has Gmail API enabled

### No webhooks received
- Verify ngrok URL matches Pub/Sub subscription endpoint
- Check Pub/Sub subscription exists and is configured correctly
- Verify `GOOGLE_CLOUD_PROJECT_ID` is set

### Attachments not downloading
- Check file extensions are in allowed list (.pdf, .xlsx, .xls, .csv)
- Verify Gmail API has attachment.get permission
- Check `downloads/` directory has write permissions

## License

MIT
