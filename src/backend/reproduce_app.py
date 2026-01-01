import os
import sys
import logging
from fastapi.testclient import TestClient

# Add src/backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# SOTA: Mock environment variables if needed
if "SUPABASE_URL" not in os.environ:
    from config import SUPABASE_URL, SUPABASE_KEY
    os.environ["SUPABASE_URL"] = SUPABASE_URL
    os.environ["SUPABASE_KEY"] = SUPABASE_KEY

# Import app after setting env
try:
    from main import app
except Exception as e:
    print(f"Failed to import app: {e}")
    sys.exit(1)

# Setup logging to console
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = TestClient(app)

def test_companies_endpoint():
    logger.info("Testing GET /api/companies (Expect 200 or 500)")
    try:
        # We need a dummy headers for X-Company-ID if required, but it's optional
        # Also, auth middleware might block us with 401 if we don't send token.
        # But user reported 500. If we get 401, that's progress (means 500 is post-auth).
        response = client.get("/api/companies")
        logger.info(f"Status: {response.status_code}")
        logger.info(f"Response: {response.text}")
    except Exception as e:
        logger.error(f"Client crashed: {e}", exc_info=True)

if __name__ == "__main__":
    test_companies_endpoint()
