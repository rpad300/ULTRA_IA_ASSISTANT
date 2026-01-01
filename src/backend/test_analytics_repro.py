
import asyncio
import logging
from services.analytics_service import get_analytics_service
from db.supabase_client import get_async_supabase_client

# Setup logging
from services.qdrant_service import init_qdrant_service

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

async def test_dashboard_stats():
    # SOTA: Initialize Qdrant first!
    try:
        await init_qdrant_service()
    except Exception as e:
        print(f"Qdrant init failed (expected if no creds/connection, but necessary for dependency): {e}")

    print("Testing get_dashboard_stats...")
    service = get_analytics_service()
    
    # Test case 1: No filters
    try:
        print("1. Fetching stats (no filters)...")
        stats = await service.get_dashboard_stats(company_id=None, project_id=None)
        print(f"Success: {stats}")
    except Exception as e:
        print(f"FAILED (No filters): {e}")
        import traceback
        traceback.print_exc()

    # Test case 2: Dev company ID (simulating behavior)
    try:
        print("\n2. Fetching stats (dev-company-id)...")
        stats = await service.get_dashboard_stats(company_id="dev-company-id", project_id=None)
        print(f"Success: {stats}")
    except Exception as e:
        print(f"FAILED (dev-company-id): {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dashboard_stats())
