"""Regex-based PII redaction for extracted document text.

Deliberately regex-only, not NER-based: fast, no extra ML dependency, and
every match is easy to audit by reading the pattern. The trade-off is real --
this will not catch names, addresses, or anything without a recognizable
shape. If that gap matters later, swap/extend PATTERNS (e.g. with a
Presidio-based detector) without changing redact_pii()'s signature.

All patterns use only bounded quantifiers ({m,n} or ?) on top-level groups,
never nested unbounded quantifiers -- this text comes from untrusted email
attachments, and an "evil regex" here would be a ReDoS vector over
attacker-controlled input.

Callers must only log the returned counts, never the matched values or the
raw input text -- that's the whole point of this module.
"""
import re
from typing import Dict, Tuple

PATTERNS: Dict[str, re.Pattern] = {
    'SSN': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    'CREDIT_CARD': re.compile(r'\b(?:\d[ -]?){13,19}\b'),
    # Requires a literal '+' before the country code -- a bare leading "1"
    # would otherwise let this pattern swallow any 11-digit number (e.g. a
    # bank account number) and misclassify it as a phone number.
    'PHONE': re.compile(r'\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'),
    'EMAIL': re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.-]+\b'),
    # Broad catch-all for any other 8-17 digit run (bank/routing/account
    # numbers have no universal format). High false-positive rate on its
    # own -- invoice numbers, zip+4, etc. will also match -- but for PII
    # redaction, over-redacting is the safer failure mode. Ordered last so
    # the more specific patterns above claim their matches first.
    'BANK_ACCOUNT': re.compile(r'\b\d{8,17}\b'),
}

# Order matters: most specific first, so BANK_ACCOUNT's broad catch-all only
# ever sees digit runs the earlier patterns didn't already claim.
_ORDER = ('SSN', 'CREDIT_CARD', 'PHONE', 'EMAIL', 'BANK_ACCOUNT')


def redact_pii(text: str) -> Tuple[str, Dict[str, int]]:
    """Redact common PII patterns from extracted document text.

    Returns (redacted_text, counts) where counts maps each PII type to how
    many matches were redacted. counts is safe to log; the matched values
    and the original text are not.
    """
    counts: Dict[str, int] = {}
    redacted = text

    for label in _ORDER:
        def _replace(match: re.Match, label: str = label) -> str:
            counts[label] = counts.get(label, 0) + 1
            return f'[REDACTED_{label}]'

        redacted = PATTERNS[label].sub(_replace, redacted)

    return redacted, counts
