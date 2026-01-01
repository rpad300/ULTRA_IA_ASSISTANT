import asyncio
import logging
from db.supabase_client import get_async_supabase_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_companies_query():
    try:
        logger.info("Connecting to Supabase...")
        supabase = await get_async_supabase_client()
        logger.info("Connected. Executing query...")
        
        # Mimic get_companies in CompanyService
        response = await supabase.table("companies").select("*").eq("status", "active").limit(2).execute()
        
        logger.info(f"Query successful. Got {len(response.data) if response.data else 0} rows.")
        print(response.data)
        
    except Exception as e:
        logger.error(f"Test Failed: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(test_companies_query())
