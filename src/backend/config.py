import os
from dotenv import load_dotenv, find_dotenv

# Robustly find .env
env_file = find_dotenv(usecwd=True)
if env_file:
    load_dotenv(env_file, override=True) # Override to respect file changes
else:
    load_dotenv() # Fallback

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Qdrant
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_COLLECTION = "ultra_knowledge_base"

# AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

# Google
GOOGLE_CLIENT_SECRET_PATH = os.getenv("GOOGLE_CLIENT_SECRET_PATH")
DRIVE_APP_ROOT_ID = os.getenv("DRIVE_APP_ROOT_ID", "1QSz94JcX7wmKvVFviywY03hiWtoRArmZ")

# App
PORT = int(os.getenv("PORT", 8000))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
PICOVOICE_API_KEY = os.getenv("PICOVOICE_API_KEY")

# Supabase Auth
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# C# Audio Service
# C# Audio Service
AUDIO_SERVICE_URL = os.getenv("AUDIO_SERVICE_URL", "http://127.0.0.1:8001/api/audio-service")

# Security (SOTA Zero Trust)
ULTRA_API_KEY = os.getenv("ULTRA_API_KEY")

if not SUPABASE_URL:
    print("WARNING: SUPABASE_URL not set")
