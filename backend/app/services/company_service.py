"""Derive a client-company label from an email sender's domain."""
import logging
from email.utils import parseaddr
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Well-known personal/free email providers -- a sender on one of these
# domains isn't identifying a company, just flagging it rather than treating
# it as an unknown/unparsed case.
GENERIC_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'proton.me', 'live.com', 'msn.com',
    'mail.com', 'zoho.com', 'yandex.com', 'gmx.com', 'me.com',
}


def derive_client_company(sender_header: str) -> Dict[str, Any]:
    """
    Extract a client-company identifier from a raw email 'From' header.

    Handles both bare addresses ("a@b.com") and display-name form
    ("Jane Doe <a@b.com>") via email.utils.parseaddr rather than a hand-rolled
    regex. Returns {"client_company": <lowercased domain or None>,
    "is_generic_domain": bool} -- the latter is True for well-known personal
    providers, where the domain doesn't actually identify a company.
    """
    _, email_address = parseaddr(sender_header or '')

    if '@' not in email_address:
        logger.warning("Could not parse an email domain from the sender header")
        return {"client_company": None, "is_generic_domain": False}

    domain = email_address.rsplit('@', 1)[-1].strip().lower()
    if not domain:
        return {"client_company": None, "is_generic_domain": False}

    return {
        "client_company": domain,
        "is_generic_domain": domain in GENERIC_EMAIL_DOMAINS,
    }
