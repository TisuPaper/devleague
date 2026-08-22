"""Read-only API exposing backend-processed clients to the dashboard."""
import logging

from fastapi import APIRouter

from app.services.client_view_service import build_client_views
from app.services.store_service import list_client_records

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["clients"])


@router.get("/clients")
async def get_clients():
    """
    Return every client the backend has actually processed email for.

    Read-only and derived entirely from stored processing results -- no
    sample or placeholder data. Returns an empty list (not an error) before
    any email has been processed, so the dashboard can render an honest
    "nothing processed yet" state.

    Note: the redacted document text itself is deliberately NOT included in
    this response. The dashboard only needs the derived analysis, and not
    shipping full document bodies to the browser keeps the exposure of
    (already redaction-processed, but still client-confidential) financial
    content to a minimum.
    """
    try:
        clients = build_client_views(list_client_records())
    except Exception as e:
        logger.error(f"Failed to build client views: {e}", exc_info=True)
        return {"clients": [], "error": "Could not load processed clients"}

    return {"clients": clients, "count": len(clients)}
