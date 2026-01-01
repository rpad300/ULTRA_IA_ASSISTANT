
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from services.redis_service import get_redis_service
from services.redis_service import RedisService

async def main():
    print("Checking Redis Configuration...")
    try:
        # Force re-init
        service = RedisService()
        await service.connect()
        
        if service._client:
            print("STATUS: CONFIG_FOUND")
            try:
                await service._client.ping()
                print("STATUS: CONNECTED")
                print("Redis is FULLY FUNCTIONAL.")
            except Exception as e:
                print(f"STATUS: CONNECTION_FAILED - {e}")
        else:
            print("STATUS: NOT_CONFIGURED")
            print("Redis is NOT configured in .env (or disabled). System running in No-Cache mode.")
            
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
