import asyncio
import logging
import sys
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_lifespan")

# Add backend to path
sys.path.append(os.getcwd())

async def test_lifespan_components():
    print("🚀 Starting Lifespan Debug...")

    try:
        print("1. Testing Chat System Init...")
        from dependencies.chat_deps import init_chat_system
        await asyncio.wait_for(init_chat_system(), timeout=10)
        print("✅ Chat System Init Done")
    except Exception as e:
        print(f"❌ Chat System Failed: {e}")

    try:
        print("2. Testing Audio Service Client...")
        from services.audio_service_client import AudioServiceClient
        from config import AUDIO_SERVICE_URL
        client = AudioServiceClient(base_url=AUDIO_SERVICE_URL)
        # Mocking start since it might depend on external service
        await client.start(enable_monitor=False) 
        print("✅ Audio Service Client Instantiated")
    except Exception as e:
         print(f"❌ Audio Service Client Failed: {e}")

    try:
        print("3. Testing Connection Manager (Redis)...")
        from managers.connection_manager import manager
        await asyncio.wait_for(manager.initialize_distributed(), timeout=5)
        print("✅ Connection Manager Init Done")
    except Exception as e:
        print(f"❌ Connection Manager Failed: {e}")

    try:
        print("4. Testing Qdrant Init...")
        from services.qdrant_service import init_qdrant_service
        # This one is critical and often fails if Qdrant is down
        await asyncio.wait_for(init_qdrant_service(), timeout=10)
        print("✅ Qdrant Init Done")
    except Exception as e:
        print(f"❌ Qdrant Failed: {e}")
    
    try:
        print("5. Testing Model Discovery...")
        from services.model_discovery_service import get_model_discovery_service
        mds = get_model_discovery_service()
        # Just getting the service, not running the loop
        print("✅ Model Discovery Service Gotten")
    except Exception as e:
        print(f"❌ Model Discovery Failed: {e}")

    print("🏁 Lifespan Debug Complete")

if __name__ == "__main__":
    try:
        asyncio.run(test_lifespan_components())
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted")
