"""Financial analysis over redacted document text, via the Gemini API.

Uses the SDK's async client (client.aio.models.generate_content) rather than
the sync one, and wraps the call in asyncio.wait_for(): a slow/hanging
network call here must not be able to block the whole FastAPI event loop the
way the interactive OAuth flow once did (see gmail_service.py's
_get_credentials for that earlier bug). If GEMINI_API_KEY isn't set, this
degrades to a no-op log line instead of raising -- same "skip, don't crash"
pattern as the rest of this pipeline.
"""
import asyncio
import json
import logging
from typing import Any, Dict, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Cap how much redacted text gets sent in one call -- keeps latency/cost
# bounded and avoids exceeding the model's context window on very large
# documents. Analysis quality on a truncated document is a known trade-off,
# not silently accepted: see the log line below when this triggers.
MAX_CHARS_TO_ANALYZE = 60_000

# Hard ceiling on how long we'll wait for Gemini before giving up.
REQUEST_TIMEOUT_SECONDS = 60

# Canonical document types the dashboard tracks. Kept in sync with
# DOCUMENT_TYPE_LABELS in client_view_service.py -- the model must classify
# each attachment into exactly one of these (or "other").
DOCUMENT_TYPES = (
    "income_statement",
    "balance_sheet",
    "cash_flow",
    "general_ledger",
    "payroll_summary",
    "ar_aging",
    "other",
)

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "document_type": {"type": "string", "enum": list(DOCUMENT_TYPES)},
        "readable": {"type": "boolean"},
        "company_name": {"type": "string"},
        "industry": {"type": "string"},
        "period": {"type": "string"},
        "summary": {"type": "string"},
        "key_figures": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "value": {"type": "string"},
                    "period": {"type": "string"},
                },
                "required": ["label", "value"],
            },
        },
        "risk_flags": {"type": "array", "items": {"type": "string"}},
        "sentiment": {"type": "string", "enum": ["positive", "neutral", "negative"]},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    },
    "required": [
        "document_type", "readable", "company_name", "industry", "period",
        "summary", "key_figures", "risk_flags", "sentiment", "confidence",
    ],
}

REQUIRED_KEYS = frozenset(RESPONSE_SCHEMA["required"])

ANALYSIS_PROMPT = """You are analyzing a financial document that has already had personal \
identifying information (PII) redacted. Placeholders like [REDACTED_EMAIL] or \
[REDACTED_SSN] are expected and are not part of the original document -- do not \
comment on them, just treat that information as unavailable.

The document was received as an email attachment from the domain "{client_domain}".

Respond with a JSON object with these fields:
- document_type: classify this document as exactly one of:
    income_statement  (profit & loss / income statement)
    balance_sheet     (statement of financial position)
    cash_flow         (cash flow statement)
    general_ledger    (transaction-level ledger / trial balance)
    payroll_summary   (payroll, salary, or headcount cost report)
    ar_aging          (accounts receivable aging / outstanding invoices by age)
    other             (anything that is not clearly one of the above)
  Use "other" when genuinely unsure -- do not guess a specific type to be helpful.
- readable: true if the extracted text contains usable financial content; false if it \
is empty, garbled, or clearly failed to extract (e.g. a scanned image with no text).
- company_name: the company the document belongs to, exactly as written in the \
document. Empty string if not stated -- do NOT infer it from the email domain.
- industry: the company's industry if the document makes it clear; empty string otherwise.
- period: the reporting period the document covers (e.g. "Q3 2026", "FY2025"); empty \
string if not stated.
- summary: a 2-4 sentence plain-English summary of the document.
- key_figures: notable numbers found, each with a label, the value exactly as written \
(keep the original currency and units), and a period if one is stated (empty string if not).
- risk_flags: any notable risk, concern, anomaly, or red flag found (empty list if none).
- sentiment: one of positive, neutral, negative.
- confidence: one of high, medium, low -- how confident you are in this analysis given \
the document's clarity and completeness.

Report only what the document actually supports. Do not invent figures, and do not fill \
gaps with plausible-sounding numbers -- an empty list or empty string is the correct \
answer when the document does not say.

Document text:
---
{document_text}
---
"""


async def analyze_financial_document(
    redacted_text: str,
    message_id: str,
    client_company: Optional[str],
) -> Optional[Dict[str, Any]]:
    """
    Run redacted document text through Gemini for structured financial
    analysis. Returns the parsed result dict, or None if analysis was
    skipped (no API key configured) or failed (network error, timeout, or a
    malformed response) -- callers should treat None as "no analysis
    available", not propagate it as an error.
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        logger.info(f"GEMINI_API_KEY not set - skipping AI analysis for message {message_id}")
        return None

    text_to_analyze = redacted_text[:MAX_CHARS_TO_ANALYZE]
    if len(redacted_text) > MAX_CHARS_TO_ANALYZE:
        logger.warning(
            f"Truncating document for message {message_id} to "
            f"{MAX_CHARS_TO_ANALYZE} chars before sending to Gemini"
        )

    prompt = ANALYSIS_PROMPT.format(
        document_text=text_to_analyze,
        client_domain=client_company or "unknown",
    )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=RESPONSE_SCHEMA,
                ),
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(f"Gemini analysis timed out after {REQUEST_TIMEOUT_SECONDS}s for message {message_id}")
        return None
    except Exception as e:
        logger.error(f"Gemini API call failed for message {message_id}: {e}")
        return None

    raw_text = getattr(response, 'text', None)
    if not raw_text:
        logger.error(f"Gemini returned no text for message {message_id}")
        return None

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"Gemini response was not valid JSON for message {message_id}: {e}")
        return None

    if not isinstance(result, dict) or not REQUIRED_KEYS.issubset(result.keys()):
        got = list(result.keys()) if isinstance(result, dict) else type(result).__name__
        logger.error(f"Gemini response missing expected keys for message {message_id}: got {got}")
        return None

    logger.info(
        f"AI analysis complete for message {message_id} "
        f"(client_company={client_company or 'unknown'}, sentiment={result.get('sentiment')})"
    )
    return result
