

import torchaudio
import os
import sys
import asyncio

# SOTA: Enforce SelectorEventLoop on Windows to avoid Proactor/SSL hangs
# if sys.platform == 'win32':
#     asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

if sys.platform == 'win32':
    # Force UTF-8 for console output to avoid UnicodeEncodeError in logs (cp1252 fix)
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

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
from middleware.logging_context import LoggingContextFilter, setup_sota_logging

# Configure SOTA Structured Logging via Context Middleware
# This replaces the manual SafeFormatter/RichHandler setup with a standardized JSON approach
setup_sota_logging()

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO) # SOTA: Enforce INFO even in dev to reduce noise

# Add File Handler for Auth Debugging (Keep standard formatting for files)
# We can re-use the standard logging.Formatter for files if we want text logs there,
# or user JSONFormatter if we want NDJSON. Let's keep text for human readability.
file_handler = logging.FileHandler("backend_auth.log")
file_handler.setFormatter(logging.Formatter(
    fmt='%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))
file_handler.addFilter(LoggingContextFilter()) # Ensure filter is present for file handler too
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


# signal.signal(signal.SIGINT, shutdown_handler)
# signal.signal(signal.SIGTERM, shutdown_handler)




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Ultra Assistant Backend...")
    logger.info(f"Environment: {ENVIRONMENT}")
    
    # Initialize Chat System (SOTA Lifecycle)
    from dependencies.chat_deps import init_chat_system
    await init_chat_system()
    print("DEBUG: Chat System Initialized")
    
    # ------------------------------------------------------------------
    # SOTA DEBUG: DEADLOCK ISOLATION
    # Commenting out heavy background tasks to identify startup blocker
    # ------------------------------------------------------------------
    
    # Monitor Models Folder (Legacy Block Removed - Handled by Agent 6 block below)
    # Initialize Drive Watcher (Legacy Block Removed - Handled by Knowledge Keeper block below)


    
    # Initialize Audio Service Client (SOTA Bridge)
    from services.audio_service_client import AudioServiceClient
    from config import AUDIO_SERVICE_URL
    app.state.audio_client = AudioServiceClient(base_url=AUDIO_SERVICE_URL)
    # SOTA: Start in PASSIVE mode (no background polling) as requested by user
    await app.state.audio_client.start(enable_monitor=False)

    # Initialize Distributed Connection Manager (Agent 5 - Resilience)
    from managers.connection_manager import manager as connection_manager
    await connection_manager.initialize_distributed()

    # Initialize Knowledge Keeper (Agent 3) - Drive Watcher
    from collections import defaultdict
    from services.drive_watcher import DriveWatcher
    
    # 1. Load from .env (Manual Overrides)
    drive_config_str = os.getenv("DRIVE_WATCH_FOLDERS", "")
    default_company = os.getenv("DEFAULT_COMPANY_ID", "default-company")
    
    company_folders = defaultdict(list)
    
    if drive_config_str:
        folders = [f.strip() for f in drive_config_str.split(",") if f.strip()]
        for item in folders:
            if ":" in item:
                folder_id, company_id = item.split(":", 1)
                company_folders[company_id.strip()].append(folder_id.strip())
            else:
                company_folders[default_company].append(item)

    # 2. Load from DB (Auto-Discovery)
    try:
        from services.company_service import get_company_service
        company_svc = get_company_service()
        # Fetch all active companies (limit 1000 for safety)
        try:
            db_companies = await asyncio.wait_for(company_svc.get_companies(limit=1000), timeout=10.0)
            
            count_auto = 0
            for comp in db_companies:
                if comp.drive_root_folder_id:
                    # Avoid duplicates if already in .env
                    if comp.drive_root_folder_id not in company_folders[comp.id]:
                        company_folders[comp.id].append(comp.drive_root_folder_id)
                        count_auto += 1
            
            logger.info(f"Drive Watcher Auto-Discovery: Found {count_auto} folders from {len(db_companies)} companies.")
        except asyncio.TimeoutError:
             logger.warning("Drive Watcher Auto-Discovery timed out (10s). Skipping DB lookup.")
        
    except Exception as e:
        logger.error(f"Failed to auto-discover Drive folders from DB: {e}")

    # 3. Start Watchers
    if company_folders:
        app.state.drive_watchers = []
        for company_id, folders in company_folders.items():
            logger.info(f"Starting Drive Watcher for Company '{company_id}': {folders}")
            watcher = DriveWatcher(watch_folders=folders, company_id=company_id)
            asyncio.create_task(watcher.start())
            app.state.drive_watchers.append(watcher)
    else:
        logger.info("Knowledge Keeper Drive Watcher skipped (No config in .env or DB).")
    
    # Initialize Model Discovery (Agent 6)
    try:
        from services.model_discovery_service import get_model_discovery_service
        mds = get_model_discovery_service()
        
        async def model_discovery_scheduler():
            while True:
                try:
                    await asyncio.wait_for(mds.discover_and_set_best_model(), timeout=20.0)
                except Exception as e:
                    logger.warning(f"Model Discovery check failed: {e}")
                
                # Wait 24 hours
                await asyncio.sleep(86400)
        
        # Start background loop
        asyncio.create_task(model_discovery_scheduler())
        
    except Exception as e:
        logger.error(f"Failed to start Model Discovery Service: {e}")

    # Ensure Qdrant collection and indices exist
    try:
        from services.qdrant_service import init_qdrant_service
        # SOTA: Explicit initialization
        qs = await asyncio.wait_for(init_qdrant_service(), timeout=10.0)
        # ensure_collection is called inside init, so we are good.
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        app.state.audio_client = None

    # Initialize Pyannote Service (SOTA Warmup)
    # This verifies model loading (and HF_TOKEN) immediately on startup
    try:
        from services.pyannote_service import get_biometric_service
        # Run in thread pool to not block async event loop (model loading is blocking/heavy)
        bio_service = get_biometric_service()
        # We wrap the synchronous warmup in to_thread to keep loop responsive
        try:
             await asyncio.wait_for(asyncio.to_thread(bio_service.warmup), timeout=15.0)
        except asyncio.TimeoutError:
             logger.warning("Biometric Service Warmup timed out (15s). It will lazy load on first request.")
    except Exception as e:
        logger.error(f"Biometric Service Warmup Failed: {e}")

    yield
    
    # Shutdown
    logger.info("Shutting down Ultra Assistant Backend...")
    if hasattr(app.state, "audio_client") and app.state.audio_client:
        await app.state.audio_client.stop()




app = FastAPI(
    title="Ultra Assistant Backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None
)

# CORS - Secure configuration (SOTA Zero Trust)
# Note: Cannot use "*" with allow_credentials=True, must specify exact origins
# Load from ENV for flexibility in Production
env_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5999,http://localhost:5173")
allowed_origins = [origin.strip() for origin in env_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit"],
)

# SOTA: Zero Trust API Key Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from config import ULTRA_API_KEY

class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip for health checks and public assets (if any)
        if request.url.path in ["/api/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
            
        # Optional: Skip for WebSocket (handled in router) or check query param/header
        # WebSockets usually send auth in handshake, handled by verify_connection/auth_middleware
        if "websocket" in request.headers.get("upgrade", "").lower():
             return await call_next(request)

        if ULTRA_API_KEY:
            client_key = request.headers.get("X-API-KEY")
            if not client_key or client_key != ULTRA_API_KEY:
                # SOTA Security: Return generic 403
                return JSONResponse(
                    status_code=403, 
                    content={"detail": "Access Denied: Invalid Security Credential"}
                )
        return await call_next(request)

from fastapi.responses import JSONResponse
app.add_middleware(ApiKeyMiddleware)

# SOTA: VRAM Concurrency Semaphore
# Global semaphore to limit concurrent GPU-heavy operations (Whisper/LLM)
# We attach it to app.state so routers can access it.
# Limit is low (2) to prevent OOM on consumer GPUs.
app.state.gpu_semaphore = asyncio.Semaphore(2)


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
app.include_router(intelligence.router)
from routers import voice_profile, voice_optimization
app.include_router(voice_profile.router, prefix="/api/voice-profiles", tags=["voice-profiles"])
app.include_router(voice_optimization.router)

# Knowledge Keeper Router
from routers import knowledge
app.include_router(knowledge.router)

# AI Governance Router (Agent 6)
from routers import admin_ai_router
app.include_router(admin_ai_router.router)
from routers import graph_router
app.include_router(graph_router.router)

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
    return {
        "status": "ok", 
        "message": "Ultra Assistant Backend is running",
        "sota_version": "mock-qdrant-fix-v1"
    }

@app.get("/api/health/detailed")
async def health_check_detailed():
    """Detailed health check endpoint."""
    try:
        return await get_health_status()
    except Exception as e:
        logger.error(f"Health Check Failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    # SOTA: Enable WebSocket Heartbeat (Server-Side)
    uvicorn.run("app_main:app", host="0.0.0.0", port=PORT, reload=True, ws_ping_interval=20, ws_ping_timeout=20, timeout_keep_alive=60)

