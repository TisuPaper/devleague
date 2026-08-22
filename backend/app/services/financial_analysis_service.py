"""Financial analysis service - parses PDF/XLSX and calls Gemini API for AI insights"""
import logging
from pathlib import Path
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from a PDF file using pdfplumber."""
    import pdfplumber

    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

            # Also extract tables
            tables = page.extract_tables()
            for table in tables:
                if table:
                    # Convert table rows to tab-separated text
                    table_text = "\n".join(
                        "\t".join(str(cell) if cell else "" for cell in row)
                        for row in table
                    )
                    text_parts.append(table_text)

    return "\n\n".join(text_parts)


def _extract_text_from_excel(file_path: str) -> str:
    """Extract text content from an XLSX/XLS file using openpyxl."""
    import openpyxl

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    text_parts = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        text_parts.append(f"=== Sheet: {sheet_name} ===")

        for row in ws.iter_rows(values_only=True):
            # Filter out fully empty rows
            if any(cell is not None for cell in row):
                row_text = "\t".join(str(cell) if cell is not None else "" for cell in row)
                text_parts.append(row_text)

    wb.close()
    return "\n\n".join(text_parts)


def _extract_text_from_csv(file_path: str) -> str:
    """Extract text content from a CSV file."""
    import csv

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        rows = list(reader)

    return "\n".join("\t".join(row) for row in rows)


def extract_text_from_file(file_path: str) -> str:
    """
    Extract text from a financial document based on file extension.

    Supported formats: PDF, XLSX, XLS, CSV
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return _extract_text_from_pdf(file_path)
    elif suffix in (".xlsx", ".xls"):
        return _extract_text_from_excel(file_path)
    elif suffix == ".csv":
        return _extract_text_from_csv(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


ANALYSIS_PROMPT_PREFIX = """You are a senior financial analyst. Analyze the following financial report data and provide a comprehensive analysis.

## Financial Data
"""

ANALYSIS_PROMPT_SUFFIX = """

## Please provide:

### 1. Executive Summary
Brief overview of the financial document and key findings.

### 2. Key Financial Metrics
Extract and highlight important financial figures (revenue, expenses, profit, margins, etc.)

### 3. Financial Health Assessment
- Profitability analysis
- Liquidity assessment
- Growth trends

### 4. Risk Analysis
Identify potential risks, concerns, or areas of weakness.

### 5. Recommendations
Actionable recommendations based on the analysis.

Provide your analysis in a clear, structured format. Be specific with numbers when available."""


def analyze_financial_report(file_path: str) -> dict:
    """
    Analyze a financial report document using Gemini AI.

    Steps:
    1. Extract text from the document (PDF/XLSX/CSV)
    2. Send extracted text to Gemini API
    3. Return structured analysis

    Returns dict with: success, filename, analysis, error (if failed)
    """
    settings = get_settings()
    path = Path(file_path)

    result = {
        "filename": path.name,
        "analysis": None,
        "error": None,
    }

    # Validate file exists
    if not path.exists():
        result["error"] = f"File not found: {file_path}"
        return result

    # Validate Gemini API key
    if not settings.GEMINI_API_KEY:
        result["error"] = "GEMINI_API_KEY not configured in environment"
        return result

    # Step 1: Extract text from document
    try:
        document_text = extract_text_from_file(file_path)
        if not document_text.strip():
            result["error"] = "Could not extract any text from the document"
            return result
        logger.info(f"Extracted {len(document_text)} characters from {path.name}")
    except ValueError as e:
        result["error"] = str(e)
        return result
    except Exception as e:
        logger.error(f"Error extracting text from {path.name}: {e}")
        result["error"] = f"Failed to extract text: {str(e)}"
        return result

    # Step 2: Call Gemini API
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)

        prompt = ANALYSIS_PROMPT_PREFIX + document_text + ANALYSIS_PROMPT_SUFFIX
        response = model.generate_content(prompt)

        result["analysis"] = response.text
        logger.info(f"Financial analysis completed for {path.name}")

    except ImportError:
        result["error"] = "google-generativeai package not installed. Run: pip install google-generativeai"
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        result["error"] = f"AI analysis failed: {str(e)}"

    return result
