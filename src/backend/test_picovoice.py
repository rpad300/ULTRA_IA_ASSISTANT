
import os
from dotenv import load_dotenv
import pveagle
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_picovoice_key():
    # Load .env from the same directory (or parent)
    load_dotenv()
    
    api_key = os.getenv("PICOVOICE_API_KEY")
    
    if not api_key:
        print("❌ Error: PICOVOICE_API_KEY not found in environment variables.")
        return

    print(f"🔑 Found API Key: {api_key[:10]}...{api_key[-5:]}")
    print("🔄 Attempting to initialize PicoVoice Eagle Profiler...")

    try:
        # User profiler to test the key without needing existing profiles
        eagle_profiler = pveagle.create_profiler(access_key=api_key)
        print("✅ Success: PicoVoice Eagle Profiler initialized successfully!")
        print(f"   Version: {eagle_profiler.version}")
        eagle_profiler.delete()
    except pveagle.EagleError as e:
        print(f"❌ PicoVoice EagleError: {e}")
        print("   -> Check if your AccessKey is correct and has available quota.")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    test_picovoice_key()
