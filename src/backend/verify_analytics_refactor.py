import sys
import os
import asyncio
import logging

# Setup path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.analytics_service import AnalyticsService
from schemas.analytics import MeetingInsightsResponse, ContactStatsResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AnalyticsVerifier")

async def verify():
    logger.info("Initializing AnalyticsService...")
    service = AnalyticsService()
    
    logger.info("Checking methods presence...")
    methods = [
        "get_dashboard_stats",
        "get_meetings_insights", 
        "get_tasks_insights",
        "get_coaching_insights",
        "get_today_schedule",
        "get_urgent_tasks", 
        "get_recent_activity",
        "get_contact_stats",
        "get_project_insights",
        "get_contact_interactions",
        "get_contact_commitments",
        "get_contact_topics"
    ]
    
    for method in methods:
        if not hasattr(service, method):
            logger.error(f"Method {method} MISSING in AnalyticsService!")
            sys.exit(1)
        logger.info(f"Method {method} exists.")
        
    logger.info("Service integrity check passed.")

    # Try to instantiate a response model to ensure schemas are correct
    logger.info("Verifying Schemas...")
    try:
        resp = ContactStatsResponse(
            contact_id="test",
            meetings_count=0,
            tasks_count=0,
            projects_in_common=0
        )
        logger.info("ContactStatsResponse schema valid.")
    except Exception as e:
        logger.error(f"Schema validation failed: {e}")
        sys.exit(1)
        
    print("\n✅ Analytics SOTA Refactor Verification PASSED")

if __name__ == "__main__":
    asyncio.run(verify())
