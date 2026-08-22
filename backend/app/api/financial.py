"""Financial analysis API routes"""
import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.services.financial_analysis_service import analyze_financial_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/financial", tags=["financial"])


@router.get("/analyze")
async def analyze_file(filename: str = Query(..., description="Filename in downloads directory to analyze")):
    """
    Analyze a financial document in the downloads directory.

    Pass the filename (not full path) of a previously downloaded attachment.
    Supported formats: PDF, XLSX, XLS, CSV.
    """
    settings = get_settings()
    file_path = Path(settings.DOWNLOAD_DIR) / filename

    # Security: ensure the resolved path stays inside DOWNLOAD_DIR
    download_root = Path(settings.DOWNLOAD_DIR).resolve()
    resolved = file_path.resolve()
    if resolved.parent != download_root:
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    result = await asyncio.to_thread(analyze_financial_report, str(file_path))

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    return {
        "filename": result["filename"],
        "analysis": result["analysis"],
    }


@router.get("/files")
async def list_analyzable_files():
    """
    List all files in the downloads directory that can be analyzed.
    """
    settings = get_settings()
    download_dir = Path(settings.DOWNLOAD_DIR)

    if not download_dir.exists():
        return {"files": []}

    allowed_extensions = {".pdf", ".xlsx", ".xls", ".csv"}
    files = []

    for file_path in sorted(download_dir.iterdir()):
        if file_path.is_file() and file_path.suffix.lower() in allowed_extensions:
            stat = file_path.stat()
            files.append({
                "filename": file_path.name,
                "size_bytes": stat.st_size,
                "type": file_path.suffix.lower(),
            })

    return {"files": files}
