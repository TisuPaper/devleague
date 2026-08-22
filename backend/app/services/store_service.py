"""Persist per-client processing results so the dashboard API can read them.

One JSON file per client domain under PROCESSED_DIR/clients/. No database yet
(by design, per the project's current scope), so this is deliberately simple:
read-modify-write a small file per domain. Writes are serialized by the
asyncio lock in api/gmail.py and done atomically (temp file + os.replace) so a
crash mid-write can't leave a half-written file behind.

Domain names come from email 'From' headers and are therefore untrusted input
-- _domain_to_filename() validates strictly rather than trusting the value as
a path component.
"""
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# A conservative hostname pattern. Anything not matching is rejected outright
# rather than sanitized, so a crafted sender domain can't become a path.
_VALID_DOMAIN = re.compile(r'^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$')


def _clients_dir() -> Path:
    return Path(get_settings().PROCESSED_DIR) / 'clients'


def _domain_to_filename(domain: str) -> Optional[str]:
    """Return a safe '<domain>.json' filename, or None if the domain is invalid."""
    if not domain:
        return None
    candidate = domain.strip().lower()
    if '..' in candidate or not _VALID_DOMAIN.match(candidate):
        logger.warning("Rejecting unsafe/invalid client domain for storage")
        return None
    return f"{candidate}.json"


def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    tmp_path = path.with_suffix(path.suffix + '.tmp')
    with open(tmp_path, 'w') as f:
        json.dump(payload, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, path)


def record_processed_document(
    domain: str,
    is_generic_domain: bool,
    contact_email: str,
    message_id: str,
    original_filename: str,
    stored_path: str,
    redaction_counts: Dict[str, int],
    analysis: Optional[Dict[str, Any]],
    extraction_ok: bool,
) -> bool:
    """
    Append one processed attachment to its client's record.

    Idempotent per (message_id, original_filename): reprocessing the same
    attachment updates that entry in place rather than adding a duplicate, so
    a Pub/Sub redelivery can't inflate the document list.

    Returns True if the record was written.
    """
    filename = _domain_to_filename(domain)
    if not filename:
        return False

    clients_dir = _clients_dir()
    try:
        clients_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.error(f"Could not create clients dir: {e}")
        return False

    path = clients_dir / filename
    now = datetime.now(timezone.utc).isoformat()

    record: Dict[str, Any] = {
        'domain': domain.strip().lower(),
        'is_generic_domain': is_generic_domain,
        'contact_email': contact_email,
        'first_seen': now,
        'documents': [],
    }
    if path.exists():
        try:
            with open(path) as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                record.update(loaded)
        except (OSError, json.JSONDecodeError) as e:
            logger.error(f"Could not read existing client record, starting fresh: {e}")

    record['domain'] = domain.strip().lower()
    record['is_generic_domain'] = is_generic_domain
    record['contact_email'] = contact_email or record.get('contact_email', '')
    record['last_activity'] = now

    entry = {
        'message_id': message_id,
        'filename': original_filename,
        'stored_path': stored_path,
        'received_at': now,
        'extraction_ok': extraction_ok,
        'redaction_counts': redaction_counts,
        'analysis': analysis,
    }

    documents: List[Dict[str, Any]] = record.get('documents') or []
    for i, existing in enumerate(documents):
        if (existing.get('message_id') == message_id
                and existing.get('filename') == original_filename):
            # Same attachment seen again (e.g. Pub/Sub redelivery) -- keep the
            # original received_at so the timeline stays honest.
            entry['received_at'] = existing.get('received_at', now)
            documents[i] = entry
            break
    else:
        documents.append(entry)
    record['documents'] = documents

    try:
        _atomic_write_json(path, record)
    except OSError as e:
        logger.error(f"Failed to write client record for storage: {e}")
        return False

    logger.info(f"Recorded processed document for client {record['domain']}")
    return True


def list_client_records() -> List[Dict[str, Any]]:
    """Load every stored client record. Unreadable files are skipped, not fatal."""
    clients_dir = _clients_dir()
    if not clients_dir.is_dir():
        return []

    records = []
    for path in sorted(clients_dir.glob('*.json')):
        try:
            with open(path) as f:
                loaded = json.load(f)
            if isinstance(loaded, dict) and loaded.get('domain'):
                records.append(loaded)
        except (OSError, json.JSONDecodeError) as e:
            logger.error(f"Skipping unreadable client record {path.name}: {e}")
    return records
