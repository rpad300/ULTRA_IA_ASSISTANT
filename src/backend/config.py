import os
from dotenv import load_dotenv

load_dotenv()

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

# App
PORT = int(os.getenv("PORT", 8000))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
PICOVOICE_API_KEY = os.getenv("PICOVOICE_API_KEY")

# Supabase Auth
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# C# Audio Service
AUDIO_SERVICE_URL = "http://127.0.0.1:8001/api/audio-service"

if not SUPABASE_URL:
    print("WARNING: SUPABASE_URL not set")
