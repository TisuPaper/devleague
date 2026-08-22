"""Map stored client records into the shape the dashboard frontend consumes.

Everything here is derived strictly from what the backend actually processed --
document classifications and analysis text come from Gemini's output, never
from placeholder/sample content. When a document hasn't been received, the
corresponding report section is reported as locked rather than filled with
plausible-looking text.
"""
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Canonical required documents, in the order the dashboard lists them. The
# labels must match the frontend's REQUIRED_DOCUMENTS strings exactly.
REQUIRED_DOCUMENTS = (
    ('income_statement', 'Income Statement (P&L)'),
    ('balance_sheet', 'Balance Sheet'),
    ('cash_flow', 'Cash Flow Statement'),
    ('general_ledger', 'General Ledger'),
    ('payroll_summary', 'Payroll Summary'),
    ('ar_aging', 'Accounts Receivable Aging'),
)

DOCUMENT_TYPE_LABELS = dict(REQUIRED_DOCUMENTS)

# Which report section each document type unlocks. general_ledger has no
# dedicated section -- it feeds the executive summary only.
DOC_TYPE_TO_SECTION = {
    'income_statement': 'revenue_analysis',
    'balance_sheet': 'balance_sheet_review',
    'cash_flow': 'cash_flow_analysis',
    'payroll_summary': 'payroll_analysis',
    'ar_aging': 'receivables_analysis',
}

ALL_SECTIONS = (
    'executive_summary',
    'revenue_analysis',
    'balance_sheet_review',
    'cash_flow_analysis',
    'payroll_analysis',
    'receivables_analysis',
    'recommendations',
)

EXTENSION_TO_TYPE_LABEL = {
    '.pdf': 'PDF',
    '.xlsx': 'Excel',
    '.xls': 'Excel',
    '.csv': 'CSV',
}


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _relative_label(moment: Optional[datetime], now: datetime) -> str:
    if not moment:
        return 'unknown'
    seconds = max(0, int((now - moment).total_seconds()))
    if seconds < 60:
        return 'just now'
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hr ago"
    days = hours // 24
    return '1 day ago' if days == 1 else f"{days} days ago"


def _submitted_label(moment: Optional[datetime]) -> Optional[str]:
    return moment.strftime('%b %d, %Y') if moment else None


def _doc_type_label(filename: str) -> str:
    return EXTENSION_TO_TYPE_LABEL.get(Path(filename).suffix.lower(), 'File')


def _parse_domain_map(raw: str) -> Dict[str, str]:
    """Parse a "domain=Value,domain2=Value 2" setting into a lookup dict."""
    mapping: Dict[str, str] = {}
    for pair in (raw or '').split(','):
        if '=' not in pair:
            continue
        domain, _, value = pair.partition('=')
        domain = domain.strip().lower()
        value = value.strip()
        if domain and value:
            mapping[domain] = value
    return mapping


def _company_name(records: List[Dict[str, Any]], domain: str) -> str:
    """Resolve a display name: configured override, then AI-read name, then domain."""
    override = _parse_domain_map(get_settings().CLIENT_DISPLAY_NAMES).get(domain.lower())
    if override:
        return override
    for doc in records:
        analysis = doc.get('analysis') or {}
        name = (analysis.get('company_name') or '').strip()
        if name:
            return name
    return domain


def _industry(records: List[Dict[str, Any]], domain: str) -> str:
    override = _parse_domain_map(get_settings().CLIENT_INDUSTRIES).get(domain.lower())
    if override:
        return override
    for doc in records:
        analysis = doc.get('analysis') or {}
        industry = (analysis.get('industry') or '').strip()
        if industry:
            return industry
    return 'Unclassified'


def _followup_email(company: str, missing_labels: List[str]) -> Dict[str, str]:
    """Build a follow-up email draft for missing documents.

    Deliberately a deterministic template rather than another AI call: the
    wording is compliance-sensitive, staff review it before sending, and it
    costs nothing to generate.
    """
    bullet_lines = '\n'.join(f"  • {label}" for label in missing_labels)
    plural = 's' if len(missing_labels) > 1 else ''
    return {
        'subject': f"Action Required: Missing Document{plural} for Financial Analysis — {company}",
        'body': (
            f"Dear {company} Finance Team,\n\n"
            "Thank you for your continued cooperation with your financial analysis.\n\n"
            f"We are writing to inform you that we have not yet received the following "
            f"required document{plural}:\n\n"
            f"{bullet_lines}\n\n"
            f"This document{plural} {'are' if plural else 'is'} essential for completing "
            "your financial analysis report. Without "
            f"{'them' if plural else 'it'}, we are unable to finalise the affected sections "
            "of your report.\n\n"
            "Please submit in PDF or Excel format at your earliest convenience. If you "
            "require any assistance, please do not hesitate to contact us.\n\n"
            "Kind regards,\nExia Team"
        ),
    }


def _unreadable_email(company: str, filename: str) -> Dict[str, str]:
    return {
        'subject': f"Action Required: Document Format Issue — {company}",
        'body': (
            f"Dear {company} Finance Team,\n\n"
            "Thank you for submitting your financial documents.\n\n"
            "We have encountered an issue with the following document:\n\n"
            f"  • {filename} — our system was unable to extract readable content from "
            "this file.\n\n"
            "To resolve this, please take one of the following steps:\n"
            "  1. Resubmit the file without password protection, or\n"
            "  2. Export the data as a PDF or Excel file and resubmit.\n\n"
            "We apologise for any inconvenience. Once we receive the corrected document, "
            "we will resume processing your report immediately.\n\n"
            "Kind regards,\nExia Team"
        ),
    }


def _figure_lines(analysis: Dict[str, Any]) -> List[str]:
    lines = []
    for fig in analysis.get('key_figures') or []:
        label = (fig.get('label') or '').strip()
        value = (fig.get('value') or '').strip()
        period = (fig.get('period') or '').strip()
        if label and value:
            lines.append(f"  {label}: {value}" + (f"  ({period})" if period else ''))
    return lines


def _section_content(
    section: str,
    docs_by_type: Dict[str, Dict[str, Any]],
    other_docs: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    """Build real report-section text from the AI analysis actually available.

    `other_docs` are readable documents the model classified as "other" -- not
    one of the six required statements. Their analysis still gets surfaced
    here rather than discarded: it was produced from a document the client
    actually sent, and dropping it would mean paying for analysis the user
    never sees.
    """
    other_docs = other_docs or []

    if section == 'executive_summary':
        parts = []
        for doc_type, label in REQUIRED_DOCUMENTS:
            doc = docs_by_type.get(doc_type)
            analysis = (doc or {}).get('analysis') or {}
            summary = (analysis.get('summary') or '').strip()
            if summary:
                parts.append(f"{label}: {summary}")

        for doc in other_docs:
            analysis = doc.get('analysis') or {}
            summary = (analysis.get('summary') or '').strip()
            if not summary:
                continue
            filename = doc.get('filename') or 'attachment'
            period = (analysis.get('period') or '').strip()
            header = f"{filename} (not one of the six required statements"
            header += f"; reporting period {period})" if period else ")"
            block = [header, summary]
            figures = _figure_lines(analysis)
            if figures:
                block.append('\nKey figures:')
                block.extend(figures)
            parts.append('\n'.join(block))

        return '\n\n'.join(parts) if parts else None

    if section == 'recommendations':
        flags = []
        for doc_type, label in REQUIRED_DOCUMENTS:
            doc = docs_by_type.get(doc_type)
            analysis = (doc or {}).get('analysis') or {}
            for flag in analysis.get('risk_flags') or []:
                flags.append(f"  • [{label}] {flag}")
        for doc in other_docs:
            analysis = doc.get('analysis') or {}
            filename = doc.get('filename') or 'attachment'
            for flag in analysis.get('risk_flags') or []:
                flags.append(f"  • [{filename}] {flag}")
        if flags:
            return (
                "Points requiring attention, drawn from the risk flags identified in "
                "the submitted documents:\n\n" + '\n'.join(flags)
            )
        return "No risk flags were identified in the documents received."

    # Per-document sections
    for doc_type, section_key in DOC_TYPE_TO_SECTION.items():
        if section_key != section:
            continue
        doc = docs_by_type.get(doc_type)
        analysis = (doc or {}).get('analysis') or {}
        if not analysis:
            return None
        lines = []
        summary = (analysis.get('summary') or '').strip()
        if summary:
            lines.append(summary)
        figures = analysis.get('key_figures') or []
        if figures:
            lines.append('\nKey figures:')
            for fig in figures:
                label = (fig.get('label') or '').strip()
                value = (fig.get('value') or '').strip()
                period = (fig.get('period') or '').strip()
                if label and value:
                    lines.append(f"  {label}: {value}" + (f"  ({period})" if period else ''))
        risks = analysis.get('risk_flags') or []
        if risks:
            lines.append('\nRisk flags:')
            lines.extend(f"  ⚠️ {risk}" for risk in risks)
        period = (analysis.get('period') or '').strip()
        if period:
            lines.append(f"\nReporting period: {period}")
        confidence = (analysis.get('confidence') or '').strip()
        if confidence:
            lines.append(f"AI confidence: {confidence}")
        return '\n'.join(lines) if lines else None
    return None


def build_client_view(record: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """Convert one stored client record into the dashboard's client shape."""
    now = now or datetime.now(timezone.utc)
    domain = record.get('domain', '')
    raw_docs: List[Dict[str, Any]] = record.get('documents') or []

    # Newest first, so "latest wins" when the same document type arrives twice.
    sorted_docs = sorted(
        raw_docs,
        key=lambda d: _parse_iso(d.get('received_at')) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    docs_by_type: Dict[str, Dict[str, Any]] = {}
    unreadable: List[Dict[str, Any]] = []
    other_readable: List[Dict[str, Any]] = []
    for doc in sorted_docs:
        analysis = doc.get('analysis') or {}
        doc_type = analysis.get('document_type') or 'other'
        readable = bool(analysis.get('readable')) and doc.get('extraction_ok', False)
        if not doc.get('extraction_ok', False) or (analysis and not analysis.get('readable')):
            unreadable.append(doc)
        elif doc_type in DOCUMENT_TYPE_LABELS:
            if readable and doc_type not in docs_by_type:
                docs_by_type[doc_type] = doc
        elif readable and analysis:
            # Readable, analysed, but not one of the six required statements.
            other_readable.append(doc)

    company = _company_name(sorted_docs, domain)

    # Six-row required-document checklist
    documents = []
    missing_labels = []
    for index, (doc_type, label) in enumerate(REQUIRED_DOCUMENTS, start=1):
        doc = docs_by_type.get(doc_type)
        if doc:
            received = _parse_iso(doc.get('received_at'))
            documents.append({
                'id': f"d{index}",
                'name': label,
                'type': _doc_type_label(doc.get('filename', '')),
                'submitted': _submitted_label(received),
                'status': 'complete',
                'filename': doc.get('filename'),
                'messageId': doc.get('message_id'),
                'redactionCounts': doc.get('redaction_counts') or {},
                'analysis': doc.get('analysis'),
            })
        else:
            documents.append({
                'id': f"d{index}",
                'name': label,
                'type': None,
                'submitted': None,
                'status': 'missing',
                'filename': None,
                'messageId': None,
                'redactionCounts': {},
                'analysis': None,
            })
            missing_labels.append(label)

    # Issues: one grouped "missing documents" issue, plus one per unreadable file
    issues = []
    if missing_labels:
        email = _followup_email(company, missing_labels)
        issues.append({
            'id': 'missing-docs',
            'type': 'missing',
            'problem': (
                f"{len(missing_labels)} required document"
                f"{'s' if len(missing_labels) > 1 else ''} not yet received"
            ),
            'detail': 'Outstanding: ' + ', '.join(missing_labels) + '.',
            'emailSubject': email['subject'],
            'emailBody': email['body'],
            'emailSent': False,
            'sentAt': None,
        })
    for i, doc in enumerate(unreadable, start=1):
        filename = doc.get('filename') or 'unknown file'
        email = _unreadable_email(company, filename)
        issues.append({
            'id': f"unreadable-{i}",
            'type': 'mismatch',
            'problem': f"{filename} — content could not be extracted",
            'detail': (
                'The file was received but produced no readable financial content. '
                'It may be password-protected, a scanned image, or corrupted.'
            ),
            'emailSubject': email['subject'],
            'emailBody': email['body'],
            'emailSent': False,
            'sentAt': None,
        })

    # Report sections: ready only when the backing document actually exists
    sections: Dict[str, str] = {}
    ready_sections: List[str] = []
    locked_sections: List[str] = []
    all_present = len(docs_by_type) == len(REQUIRED_DOCUMENTS)
    for section in ALL_SECTIONS:
        if section == 'recommendations' and not all_present:
            locked_sections.append(section)
            continue
        content = _section_content(section, docs_by_type, other_readable)
        if content:
            sections[section] = content
            ready_sections.append(section)
        else:
            locked_sections.append(section)

    if not docs_by_type and not other_readable:
        report_status = 'awaiting'
    elif not locked_sections:
        report_status = 'complete'
    else:
        report_status = 'partial'

    # Activity timeline, newest first
    activity = []
    for i, doc in enumerate(sorted_docs, start=1):
        received = _parse_iso(doc.get('received_at'))
        analysis = doc.get('analysis') or {}
        filename = doc.get('filename') or 'attachment'
        if not doc.get('extraction_ok', False):
            note = f"{filename} received but text extraction failed"
            kind = 'issue'
        elif not analysis:
            note = f"{filename} extracted and PII-redacted (AI analysis unavailable)"
            kind = 'info'
        elif analysis.get('document_type') in DOCUMENT_TYPE_LABELS:
            type_label = DOCUMENT_TYPE_LABELS[analysis['document_type']]
            note = f"{filename} processed and classified as {type_label}"
            kind = 'success'
        else:
            # Analysed successfully, but not one of the six required statements.
            # Say so explicitly rather than implying the document was rejected.
            note = (
                f"{filename} analysed — not one of the six required statements, "
                "included in the executive summary"
            )
            kind = 'info'
        activity.append({
            'id': f"a{i}",
            'timestamp': _relative_label(received, now),
            'note': note,
            'type': kind,
        })

    last_activity = _parse_iso(record.get('last_activity'))
    if issues:
        status = 'review'
    elif report_status == 'complete':
        status = 'ready'
    elif docs_by_type:
        status = 'active'
    else:
        status = 'pending'

    return {
        'id': domain.replace('.', '-'),
        'domain': domain,
        'companyName': company,
        'industry': _industry(sorted_docs, domain),
        'contactEmail': record.get('contact_email', ''),
        'isGenericDomain': bool(record.get('is_generic_domain')),
        'status': status,
        'lastActivityTimestamp': int(last_activity.timestamp() * 1000) if last_activity else 0,
        'lastActivityLabel': _relative_label(last_activity, now),
        'lastActivityNote': activity[0]['note'] if activity else 'No documents processed yet',
        'documents': documents,
        'issues': issues,
        'report': {
            'status': report_status,
            'title': 'Financial Analysis Report',
            'readySections': ready_sections,
            'lockedSections': locked_sections,
            'sections': sections,
        },
        'activity': activity,
        'documentsReceived': len(sorted_docs),
        # Readable documents analysed but outside the six required statements.
        'otherDocuments': [
            {
                'filename': doc.get('filename'),
                'period': ((doc.get('analysis') or {}).get('period') or '').strip(),
                'summary': ((doc.get('analysis') or {}).get('summary') or '').strip(),
            }
            for doc in other_readable
        ],
    }


def build_client_views(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Map all records, newest activity first. A bad record is skipped, not fatal."""
    views = []
    now = datetime.now(timezone.utc)
    for record in records:
        try:
            views.append(build_client_view(record, now=now))
        except Exception as e:
            logger.error(f"Skipping client record that failed to map: {e}")
    views.sort(key=lambda v: v.get('lastActivityTimestamp', 0), reverse=True)
    return views
