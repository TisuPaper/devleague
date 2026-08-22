"""Main FastAPI application"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings, ensure_directories
from app.api import gmail

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
    if not get_settings().PUBSUB_VERIFICATION_TOKEN:
        logger.warning(
            "PUBSUB_VERIFICATION_TOKEN is not set - the /api/webhooks/gmail endpoint "
            "will accept unauthenticated requests from anyone who has the URL. "
            "Fine for local hackathon testing; set it before exposing the endpoint "
            "beyond your own machine."
        )

    yield
    
    # Shutdown
    logger.info("Shutting down Financial Email Receiver API")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.APP_NAME,
        description="Email receiving foundation with Gmail OAuth and Pub/Sub integration",
        version="0.1.0",
        lifespan=lifespan,
        debug=settings.DEBUG,
    )
    
    # Add CORS middleware for local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:8000"],
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
    
    return app


# Create app instance
app = create_app()
