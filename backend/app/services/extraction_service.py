"""Extract raw text from downloaded attachments (PDF, XLSX, XLS, CSV).

Input files come from email attachments and are not trustworthy: a crafted
file could be oversized (decompression bomb) or malformed in ways that trip
up a parser. Every extractor here is expected to be called through
extract_text(), which enforces a size cap and catches parser exceptions so a
single bad file can't take down the background task processing it.
"""
import csv
import logging
from pathlib import Path
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def extract_text(file_path: Path) -> Optional[str]:
    """Extract text from a downloaded attachment based on its extension.

    Returns None (and logs why) on any failure -- oversized file, unsupported
    type, or a parser error -- rather than raising, so callers can treat this
    as a normal "skip this one" case.
    """
    settings = get_settings()
    max_bytes = settings.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024

    try:
        size = file_path.stat().st_size
    except OSError as e:
        logger.error(f"Could not stat {file_path.name}: {e}")
        return None

    if size > max_bytes:
        logger.warning(
            f"Skipping extraction for {file_path.name}: {size} bytes exceeds "
            f"MAX_ATTACHMENT_SIZE_MB ({settings.MAX_ATTACHMENT_SIZE_MB} MB) limit"
        )
        return None

    suffix = file_path.suffix.lower()
    extractors = {
        '.pdf': _extract_pdf,
        '.xlsx': _extract_xlsx,
        '.xls': _extract_xls,
        '.csv': _extract_csv,
    }
    extractor = extractors.get(suffix)
    if not extractor:
        logger.warning(f"No extractor for file type: {suffix}")
        return None

    try:
        return extractor(file_path)
    except Exception as e:
        logger.error(f"Failed to extract text from {file_path.name}: {e}")
        return None


def _extract_pdf(file_path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    pages = [page.extract_text() or '' for page in reader.pages]
    return '\n\n'.join(pages)


def _extract_xlsx(file_path: Path) -> str:
    from openpyxl import load_workbook

    workbook = load_workbook(str(file_path), read_only=True, data_only=True)
    lines = []
    for sheet in workbook.worksheets:
        lines.append(f"# Sheet: {sheet.title}")
        for row in sheet.iter_rows(values_only=True):
            lines.append(','.join('' if v is None else str(v) for v in row))
    return '\n'.join(lines)


def _extract_xls(file_path: Path) -> str:
    import xlrd

    book = xlrd.open_workbook(str(file_path))
    lines = []
    for sheet in book.sheets():
        lines.append(f"# Sheet: {sheet.name}")
        for row_idx in range(sheet.nrows):
            row = sheet.row_values(row_idx)
            lines.append(','.join('' if v is None else str(v) for v in row))
    return '\n'.join(lines)


def _extract_csv(file_path: Path) -> str:
    with open(file_path, newline='', encoding='utf-8', errors='replace') as f:
        return '\n'.join(','.join(row) for row in csv.reader(f))
