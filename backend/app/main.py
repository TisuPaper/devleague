"""Main FastAPI application"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings, ensure_directories
from app.api import gmail, clients
from app.services.pubsub_subscriber import (
    is_pull_mode,
    start_pull_subscriber,
    stop_pull_subscriber,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app startup and shutdown events"""
    # Startup
    logger.info("Starting Financial Email Receiver API")
    ensure_directories()
    settings = get_settings()

    pull_started = False
    if is_pull_mode():
        # Outbound streaming pull: no inbound webhook is used, so the
        # verification-token warning below doesn't apply.
        pull_started = start_pull_subscriber(
            asyncio.get_running_loop(), gmail.process_new_emails
        )
        if not pull_started:
            logger.error(
                "PUBSUB_SUBSCRIPTION_ID is set but the pull subscriber failed to "
                "start - no Gmail notifications will be processed. Check Google "
                "credentials and that the subscription exists."
            )
    elif not settings.PUBSUB_VERIFICATION_TOKEN:
        if settings.ENVIRONMENT.strip().lower() == "development":
            logger.warning(
                "PUBSUB_VERIFICATION_TOKEN is not set - the /api/webhooks/gmail endpoint "
                "will accept unauthenticated requests from anyone who has the URL. "
                "Fine for local hackathon testing; set it before exposing the endpoint "
                "beyond your own machine."
            )
        else:
            logger.error(
                "PUBSUB_VERIFICATION_TOKEN is NOT SET while ENVIRONMENT=%s. The public "
                "/api/webhooks/gmail endpoint will accept requests from anyone who "
                "discovers the URL, letting them trigger Gmail reads and billed Gemini "
                "calls. Set it now and add ?token=<value> to the Pub/Sub push endpoint.",
                settings.ENVIRONMENT,
            )

    yield

    # Shutdown
    if pull_started:
        stop_pull_subscriber()
    logger.info("Shutting down Financial Email Receiver API")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()

    # Once this is reachable from the internet, the interactive API docs hand a
    # stranger a full map of the routes (and a button to fire the webhook), and
    # debug mode returns stack traces that leak file paths and internals. Both
    # are disabled outside development regardless of what DEBUG is set to.
    is_production = settings.ENVIRONMENT.strip().lower() != "development"

    app = FastAPI(
        title=settings.APP_NAME,
        description="Email receiving foundation with Gmail OAuth and Pub/Sub integration",
        version="0.1.0",
        lifespan=lifespan,
        debug=settings.DEBUG and not is_production,
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
    )

    # Add CORS middleware for local development. 5173/4173 are Vite's dev and
    # preview ports for the dashboard frontend. Explicit origins only -- never
    # a wildcard, since allow_credentials is on.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:8000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint"""
        return {
            "message": settings.APP_NAME,
            "status": "running",
            "environment": settings.ENVIRONMENT,
        }
    
    # Health check endpoint
    @app.get("/api/health")
    async def health():
        """Health check endpoint"""
        return {"status": "healthy"}
    
    # Include Gmail webhook routes
    app.include_router(gmail.router)

    # Read-only API serving backend-processed clients to the dashboard
    app.include_router(clients.router)
    
    return app


# Create app instance
app = create_app()
