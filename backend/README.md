# Financial Email Receiver Backend

FastAPI backend for receiving emails from Gmail via Google Cloud Pub/Sub, extracting attachments (PDF/XLSX), and preparing for financial analysis.

## Features

- **Gmail OAuth 2.0**: Secure authentication using Google OAuth
- **Gmail Watch API**: Monitor inbox for new emails in real-time
- **Pub/Sub Webhook**: Receive notifications via Google Cloud Pub/Sub
- **Email Retrieval**: Fetch new email metadata (sender, subject, date)
- **Sender Domain Allowlist**: Optionally restrict processing to specific sender domains (`ALLOWED_SENDER_DOMAINS`)
- **Attachment Filtering**: Extract only PDF, XLSX, XLS, and CSV files
- **Attachment Downloading**: Download attachments locally with duplicate handling
- **Error Handling**: Robust error handling to prevent crashes from bad emails
- **State Management**: Track processed emails using local JSON state file
- **Text Extraction**: Pull raw text out of downloaded PDF/XLSX/XLS/CSV attachments
- **PII Redaction**: Regex-based redaction (SSN, credit card, phone, email, bank account patterns) before anything is handed off downstream
- **Client Company Detection**: Derives a client-company label from the sender's email domain
- **AI Analysis**: Gemini-based structured financial analysis of the redacted text (requires `GEMINI_API_KEY`)

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
  ↓
Extract text (PDF/XLSX/XLS/CSV)
  ↓
Redact PII (regex-based)
  ↓
Derive client_company from sender's email domain
  ↓
AI financial analysis (Gemini, structured JSON)
  ↓
Save everything to processed/
```

## Processing Pipeline (extract → redact → analyze)

Before any download happens, `process_new_emails()` in `app/api/gmail.py` checks the sender's domain (via `_sender_domain_allowed()`) against `ALLOWED_SENDER_DOMAINS` — a comma-separated allowlist in `.env`. Blank means no filtering (process every sender in the watched inbox); set it to restrict processing to specific client domains, e.g. `ALLOWED_SENDER_DOMAINS=n2nconnect.com`. Matching is exact (case-insensitive) domain equality, not substring — `notn2nconnect.com` won't match an allowlist entry of `n2nconnect.com`.

Then, after each attachment downloads successfully, `_process_attachment_pipeline()` runs it through these stages, all within the same webhook background task:

1. **`app/services/extraction_service.py`** — `extract_text(path)` dispatches by extension (`pypdf` for PDF, `openpyxl` for XLSX, `xlrd` for XLS, stdlib `csv` for CSV). Rejects files over `MAX_ATTACHMENT_SIZE_MB` (default 25MB) before parsing, as a guard against decompression-bomb-style files — email attachments are untrusted input.
2. **`app/services/pii_service.py`** — `redact_pii(text)` runs bounded, non-backtracking-prone regex patterns (SSN, credit card, phone, email, a broad 8–17 digit catch-all for bank/account numbers) and returns `(redacted_text, counts)`. Only `counts` is safe to log — never log matched values or raw extracted text.
3. **`app/services/company_service.py`** — `derive_client_company(sender_header)` parses the `From` header (via stdlib `email.utils.parseaddr`, not a hand-rolled regex, so display-name and quoted forms work) and returns the sender's domain plus whether it's a known personal-email provider (`gmail.com`, `outlook.com`, etc.) rather than an actual company.
4. **`app/services/analysis_service.py`** — `analyze_financial_document(redacted_text, message_id, client_company)` sends the **redacted** text to Gemini (`GEMINI_API_KEY` / `GEMINI_MODEL` in `.env`) requesting structured JSON output (summary, key figures, risk flags, sentiment, confidence). Runs via the SDK's async client under `asyncio.wait_for()` with a 60s timeout — a slow/hanging call cannot block the server's event loop the way the interactive OAuth flow once did (see `gmail_service.py`). Returns `None` (never raises) if `GEMINI_API_KEY` is unset, the call fails, or the response isn't valid/matching JSON — always logged, never crashes the pipeline.

Output lands in `processed/<original_filename>.json` (gitignored, same as `downloads/`):
```json
{
  "message_id": "...",
  "source_file": "downloads/report.xlsx",
  "extracted_at": "2026-08-22T05:32:11Z",
  "client_company": "acmecorp.com",
  "is_generic_domain": false,
  "redaction_counts": {"EMAIL": 1, "BANK_ACCOUNT": 1},
  "redacted_text": "...",
  "ai_analysis": {
    "summary": "...",
    "key_figures": [{"label": "Revenue", "value": "...", "period": "Q2 2026"}],
    "risk_flags": [],
    "sentiment": "neutral",
    "confidence": "medium"
  }
}
```

**Known limitations, by design (not oversights):**
- Regex-only redaction has no NER — it won't catch names or addresses, only recognizable-shape patterns. It's tuned to over-redact rather than risk a false negative (e.g. the bank-account pattern matches *any* bare 8–17 digit run, so it will also catch invoice numbers, zip+4, etc.).
- **The original downloaded file in `downloads/` is never redacted or deleted** — only the derived `processed/*.json` output is. If you need a retention/deletion policy for the raw attachments themselves, that's a separate decision to make later.
- Documents longer than 60,000 characters are truncated before being sent to Gemini (logged when it happens) to keep latency/cost bounded and stay under context limits.
- `client_company` is just the sender's email domain — it's a hint, not a verified identity. Spoofed `From` headers aren't detected here (no SPF/DKIM/DMARC verification in this pipeline).
- No result is persisted anywhere but the local `processed/*.json` file — there's no database or dashboard yet (by design, per the original scope).

**Concurrency note:** Pub/Sub is at-least-once delivery — it can and does redeliver the same notification. `process_new_emails()` is wrapped in a process-wide `asyncio.Lock` so overlapping deliveries of the same notification serialize instead of racing on `gmail_state.json`'s `last_history_id` and reprocessing (and re-billing Gemini for) the same message. This is a single-process lock — sufficient here since the app runs as one process, but it would need a different mechanism (e.g. a DB row lock) under multiple worker processes.

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
│   │   ├── gmail_service.py       # Gmail API operations
│   │   ├── extraction_service.py  # PDF/XLSX/XLS/CSV text extraction
│   │   ├── pii_service.py         # Regex-based PII redaction
│   │   ├── company_service.py     # Client-company detection from sender domain
│   │   └── analysis_service.py    # Gemini-based financial analysis
│   └── core/
│       ├── __init__.py
│       └── config.py           # Settings and environment
├── downloads/                  # Downloaded attachments (raw, unredacted)
├── processed/                   # Extracted + PII-redacted text (git ignored)
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
2. Create **OAuth 2.0 Client ID** (Desktop application — not "Web application"; a Web client requires a pre-registered redirect URI and will fail `authenticate_gmail()`'s dynamic `localhost` redirect with `redirect_uri_mismatch`)
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

Run Steps 1 and 2 **before** starting the server (Step 3) — `token.json` must already exist. The running server only loads/refreshes that token; it deliberately never launches the interactive browser flow itself, since that would block the whole (single-threaded) async app waiting on a browser redirect.

### Step 1: Authenticate Gmail (one-time, run manually)

```bash
python -c "from app.services.gmail_service import authenticate_gmail; authenticate_gmail()"
```

This opens a browser for consent and saves `token.json`. Re-run it if the token is ever revoked or the refresh token stops working (the server logs will say so).

### Step 2: Start Gmail Watch

```python
from app.services.gmail_service import get_gmail_service

service = get_gmail_service()
watch_response = service.start_watch()

if watch_response:
    print(f"Gmail watch started: {watch_response}")
else:
    print("Failed to start watch")
```

This logs the `historyId` and `expiration` time. `watch()` expires after 7 days — re-run this periodically (e.g. via a daily cron) to keep notifications flowing.

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

Create a Pub/Sub subscription (if not exists). If you set `PUBSUB_VERIFICATION_TOKEN` in `.env`, append it as a query param on the push endpoint so the webhook can check it:

```bash
gcloud pubsub subscriptions create finance-mail-sub \
  --topic finance-mail \
  --push-endpoint "https://your-ngrok-url.ngrok.io/api/webhooks/gmail?token=YOUR_TOKEN" \
  --push-auth-service-account your-service-account@your-project.iam.gserviceaccount.com
```

Replace:
- `your-ngrok-url` with your ngrok URL
- `YOUR_TOKEN` with the value of `PUBSUB_VERIFICATION_TOKEN` (omit `?token=...` entirely if you left it unset)
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

## Security Notes

This MVP intentionally keeps auth minimal, but two things matter even at this stage:

- **Path traversal on downloads.** Attachment filenames come from the email sender and are untrusted input. `download_attachment()` reduces every filename to its bare basename and verifies the resolved path stays inside `downloads/` before writing, so a crafted filename (e.g. `../../etc/foo`) can't write outside that directory.
- **Webhook authentication.** `/api/webhooks/gmail` is unauthenticated by default, which is fine while it's only reachable via a private ngrok tunnel you control. Before exposing it more broadly:
  - Minimum: set `PUBSUB_VERIFICATION_TOKEN` in `.env` and include `?token=...` in the Pub/Sub push subscription's endpoint URL (shown above). The webhook rejects requests with a missing/incorrect token with `403`.
  - Production-grade: configure the Pub/Sub subscription with `--push-auth-service-account` and verify the resulting OIDC `Authorization: Bearer` header (issuer, audience, signature) on each request instead of, or in addition to, the shared token. Not implemented here to keep the MVP simple.
- **credentials.json / token.json / gmail_state.json / .env** are gitignored — never commit them. If any project ID, topic name, or token ever lands in a committed file (including `.env.example`), treat it as exposed and rotate/regenerate it.

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
