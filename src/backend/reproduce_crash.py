import asyncio
import os
import sys

# Add src/backend to path
sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

async def test_redis():
    print("Testing Redis Service...")
    try:
        from services.redis_service import get_redis_service
        s = await get_redis_service()
        print(f"Redis Service: {s}")
    except Exception as e:
        print(f"Redis Service Failed: {e}")

async def test_qdrant_direct():
    print("\nTesting Qdrant Service (Direct)...")
    try:
        from services.qdrant_service import get_qdrant_service
        s = get_qdrant_service()
        print(f"Qdrant Service: {s}")
    except Exception as e:
        print(f"Qdrant Service Failed (Expected if not init): {e}")

async def test_company_service():
    print("\nTesting Company Service...")
    try:
        from services.company_service import get_company_service
        s = get_company_service()
        print(f"Company Service: {s}")
    except Exception as e:
        print(f"Company Service Failed: {e}")

async def main():
    await test_redis()
    await test_qdrant_direct()
    await test_company_service()

if __name__ == "__main__":
    asyncio.run(main())
