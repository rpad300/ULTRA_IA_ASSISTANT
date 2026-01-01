
import asyncio
from services.qdrant_service import QdrantService
from services.redis_service import RedisService

async def check_infrastructure():
    print("Checking Infrastructure...")
    
    # Check Qdrant
    print("- Checking Qdrant...")
    try:
        q = QdrantService()
        await q.ensure_collection()
        print("✅ Qdrant Connection: OK (Collection Verified)")
        await q.close()
    except Exception as e:
        print(f"❌ Qdrant Error: {e}")

    # Check Redis
    print("- Checking Redis...")
    try:
        r = RedisService()
        await r.connect()
        if r._client:
            await r._client.ping()
            print("✅ Redis Connection: OK (Ping Successful)")
        else:
            print("❌ Redis Error: Client failed to initialize (Config missing?)")
    except Exception as e:
        print(f"❌ Redis Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_infrastructure())
