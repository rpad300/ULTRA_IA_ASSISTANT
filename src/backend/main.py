import torchaudio
import os
import sys

# Windows: Add NVIDIA library paths...
# PATCH: Fix for torchaudio 2.10+ missing AudioMetaData (required by pyannote)
try:
    import patches.torchaudio_fix
except ImportError:
    pass

# Windows: Add NVIDIA library paths to DLL search path for ctranslate2/faster-whisper
if os.name == 'nt':
    try:
        import site
        # Iterate through all site-packages paths to find where nvidia is installed
        # site.getsitepackages()[0] might be the python executable path, not Lib/site-packages
        found_nvidia = False
        for site_pkg in site.getsitepackages():
            nvidia_path = os.path.join(site_pkg, "nvidia")
            if os.path.exists(nvidia_path):
                found_nvidia = True
                # Add all subdirectories with a 'bin' folder (cudnn, cublas, etc.)
                for directory in os.listdir(nvidia_path):
                    bin_path = os.path.join(nvidia_path, directory, "bin")
                    if os.path.exists(bin_path):
                        os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
                        if hasattr(os, 'add_dll_directory'):
                            try:
                                os.add_dll_directory(bin_path)
                            except Exception:
                                pass # Ignore if already added or fails
        if not found_nvidia:
            print("WARNING: 'nvidia' package not found in site-packages. CUDA operations may fail.")
            
    except Exception as e:
        print(f"Failed to add NVIDIA DLL paths: {e}")

# Monkeypatch for speechbrain compatibility with newer torchaudio versions
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["soundfile"]

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import signal
import sys
from contextlib import asynccontextmanager
from config import PORT, ENVIRONMENT
from middleware.logging_context import LoggingContextFilter

# Add request_id to log records - MUST be before basicConfig

# Create a custom formatter that handles missing request_id
class SafeFormatter(logging.Formatter):
    def format(self, record):
        # Ensure request_id exists
        if not hasattr(record, 'request_id'):
            record.request_id = 'no-request-id'
        return super().format(record)

# Configure structured logging with request ID support
# Use a format that handles missing request_id gracefully

# SOTA: Rich Logging for Developer Experience
try:
    from rich.logging import RichHandler
    from rich.console import Console
    
    # Custom Handler that respects Request ID
    # We don't use SafeFormatter here because Rich handles formatting differently
    # Instead, we rely on the LoggingContextFilter to inject fields if we want specialized display
    # For now, we utilize Rich's standard pretty printing which is sufficient.
    
    handler = RichHandler(
        rich_tracebacks=True,
        markup=True,
        show_time=True,
        show_path=False # Cleaner
    )
except ImportError:
    # Fallback to standard
    print("WARNING: 'rich' library not found. Falling back to standard logging. Run 'pip install rich'")
    handler = logging.StreamHandler()
    handler.setFormatter(SafeFormatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO if ENVIRONMENT == "production" else logging.DEBUG)
root_logger.addHandler(handler)
root_logger.addFilter(LoggingContextFilter())

# Add File Handler for Auth Debugging (Keep standard formatting for files)
file_handler = logging.FileHandler("backend_auth.log")
file_handler.setFormatter(SafeFormatter(
    fmt='%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))
root_logger.addHandler(file_handler)

# Suppress noisy libraries - SOTA Cleanup
NOISY_LOGGERS = [
    "httpcore", "httpx", "watchfiles", "uvicorn.access", "multipart", 
    "asyncio", "hpack", "googleapiclient", "speechbrain", "urllib3", 
    "faster_whisper", "filelock", 
    # Valid additions for Data Science stack suppression
    "matplotlib", "PIL", "numba", "torch", "pydub", "websockets" 
]

for log_name in NOISY_LOGGERS:
    logging.getLogger(log_name).setLevel(logging.WARNING)

# Silence specific torch Warnings (Triton etc)
import warnings
warnings.filterwarnings("ignore", module="torch.utils.flop_counter")

logger = logging.getLogger("backend")


# Graceful shutdown handler
def shutdown_handler(signum, frame):
    """Handle graceful shutdown."""
    logger.info("Shutdown signal received, shutting down gracefully...")
    sys.exit(0)


signal.signal(signal.SIGINT, shutdown_handler)
signal.signal(signal.SIGTERM, shutdown_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Ultra Assistant Backend...")
    logger.info(f"Environment: {ENVIRONMENT}")
    
    # Initialize Audio Service Client (SOTA Bridge)
    from services.audio_service_client import AudioServiceClient
    from config import AUDIO_SERVICE_URL
    app.state.audio_client = AudioServiceClient(base_url=AUDIO_SERVICE_URL)
    await app.state.audio_client.start()
    
    # Ensure Qdrant collection and indices exist
    try:
        from services.qdrant_service import get_qdrant_service
        qs = get_qdrant_service()
        qs.ensure_collection()
        
        # Eagerly load Whisper model in background to be ready for users
        # import asyncio
        # from services.whisper_service import get_whisper_service
        # logger.info("Triggering eager Whisper model loading...")
        # loop = asyncio.get_running_loop()
        # whisper_svc = get_whisper_service()
        # # Use existing executor in service or run in default executor
        # loop.run_in_executor(None, whisper_svc.load_model)
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        app.state.audio_client = None
    yield
    # Shutdown
    logger.info("Shutting down Ultra Assistant Backend...")
    await app.state.audio_client.stop()


app = FastAPI(
    title="Ultra Assistant Backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None
)

# CORS - Secure configuration
# Note: Cannot use "*" with allow_credentials=True, must specify exact origins
allowed_origins = [
    "http://localhost:5999",
    "http://127.0.0.1:5999",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# In development, we still need to specify exact origins (not "*")
# because allow_credentials=True requires explicit origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-User-Limit", "X-RateLimit-User-Remaining"],
)

# Initialize Sentry for error tracking (must be early)
try:
    from utils.sentry_config import SENTRY_AVAILABLE
except ImportError:
    SENTRY_AVAILABLE = False

# Add middleware (order matters - last added is first executed)
from middleware.request_id import RequestIDMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.error_handler import (
    error_handler,
    http_exception_handler,
    validation_exception_handler
)

# Security headers (first - applied to all responses)
try:
    from middleware.security_headers import SecurityHeadersMiddleware
    app.add_middleware(SecurityHeadersMiddleware)
except ImportError:
    logger.warning("SecurityHeadersMiddleware not available")

# Rate limiting (by user, then by IP)
try:
    from middleware.rate_limit_user import UserRateLimitMiddleware
    app.add_middleware(UserRateLimitMiddleware, authenticated_limit=200, anonymous_limit=100)
except ImportError:
    logger.warning("UserRateLimitMiddleware not available")

app.add_middleware(RateLimitMiddleware, requests_per_minute=100)

# Request ID tracking
app.add_middleware(RequestIDMiddleware)

# Error handlers
app.add_exception_handler(Exception, error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Include routers
# IMPORTANT: Order matters! More specific routes should be registered first
# to avoid conflicts. Routes are matched in the order they are registered.
from routers import workspace, chat, transcription, sessions, metrics, analytics, tasks, intelligence
from routers import chat_ws, audio_stream, audio_service_control, native_transcription

# Register routers in order of specificity (most specific first)
# IMPORTANT: FastAPI matches routes by specificity (more path segments = more specific)
# Routes are matched in order of specificity, NOT registration order.
# So /threads/{thread_id}/sessions will be matched before /threads/{thread_id}
# regardless of registration order. However, we register more specific routes first
# for clarity and to avoid any potential edge cases.
app.include_router(workspace.router)
app.include_router(sessions.router)  # Has /threads/{thread_id}/sessions - more specific, register first
app.include_router(chat.router)  # Has /threads/{thread_id} - less specific, register after
app.include_router(chat_ws.router)
app.include_router(transcription.router)
app.include_router(audio_stream.router)  # Audio streaming service WebSocket endpoint
app.include_router(audio_service_control.router)  # Audio service control REST API
app.include_router(native_transcription.router)  # Native C# service transcription endpoint
app.include_router(metrics.router)
app.include_router(analytics.router)
app.include_router(tasks.router)
app.include_router(tasks.router)
app.include_router(intelligence.router)
from routers import voice_profile, voice_optimization
app.include_router(voice_profile.router, prefix="/api/voice-profiles", tags=["voice-profiles"])
app.include_router(voice_optimization.router)

# Log registered routes for debugging
if ENVIRONMENT == "development":
    logger.info("Registered routes:")
    for route in app.routes:
        if hasattr(route, 'path') and 'thread' in route.path.lower():
            methods = getattr(route, 'methods', set())
            logger.info(f"  {list(methods)} {route.path}")

# Enhanced health check
from utils.health import get_health_status

@app.get("/api/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "message": "Ultra Assistant Backend is running"}

@app.get("/api/health/detailed")
async def detailed_health_check():
    """Detailed health check with service status."""
    return await get_health_status(use_cache=True)

# Prometheus metrics endpoint
try:
    from utils.prometheus_metrics import get_metrics
    
    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint."""
        from fastapi.responses import Response
        return Response(content=get_metrics(), media_type="text/plain")
except ImportError:
    logger.warning("Prometheus metrics not available")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
