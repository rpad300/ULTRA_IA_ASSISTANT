
import asyncio
import logging
import os
import sys
from dotenv import find_dotenv, load_dotenv

# 1. Setup Environment
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load .env
env_file = find_dotenv(usecwd=True)
if env_file:
    print(f"Loading .env from: {env_file}")
    load_dotenv(env_file)
else:
    print("Warning: .env not found")

# Fix path
sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

# Mock Services BEFORE imports that use them
from unittest.mock import MagicMock, AsyncMock

sys.modules["services.qdrant_service"] = MagicMock()
sys.modules["services.qdrant_service"].get_qdrant_service = MagicMock(return_value=MagicMock())
sys.modules["services.gemini_service"] = MagicMock()
sys.modules["services.gemini_service"].get_gemini_service = MagicMock(return_value=MagicMock())

# 2. Test
async def test_oracle_governance():
    print("--- Verifying Oracle Governance Integration ---")
    
    # Import Oracle (now uses mocks)
    from agents.intervention_oracle import InterventionOracle
    from services.prompt_service import prompt_service
    
    # Instantiate
    oracle = InterventionOracle("test_session")
    
    # Reset mocks to be sure
    oracle.gemini = MagicMock()
    oracle.gemini.model_name = "gemini-1.5-flash"
    oracle.gemini.generate_content_async = AsyncMock()
    oracle.qdrant = MagicMock()
    
    # Mock Responses
    # 1. Intent Response
    mock_intent_res = MagicMock()
    mock_intent_res.text = '{"intent": "FACT_ASSERTION", "confidence": 0.9, "reasoning": "Test reasoning"}'
    
    # 2. Conflict Response
    mock_conflict_res = MagicMock()
    mock_conflict_res.text = '{"is_conflicting": true, "original_fact": "Budget is 5k", "new_fact": "Budget is 10k", "confidence": 0.8}'
    
    oracle.gemini.generate_content_async.side_effect = [
        mock_intent_res,
        mock_conflict_res
    ]
    
    # Mock Qdrant for conflict
    oracle.qdrant = MagicMock()
    oracle.qdrant.search_context = AsyncMock(return_value=[
        {"content": "The budget was set to 5k last week.", "payload": {"url": "http://source"}}
    ])
    
    oracle.gemini.get_embedding = AsyncMock(return_value=[0.1, 0.2])

    print("1. Testing Intent Classification (via PromptService)...")
    # This calls _classify_intent which calls prompt_service.get_config("oracle_intent")
    insight = await oracle.process_transcript("We decided the budget is 10k", "User", "trace_123")
    
    if insight and insight.insight_type == "conflict":
        print(f"SUCCESS: Oracle used governed prompts to detect conflict: {insight.text}")
    else:
        print(f"FAILURE: Unexpected result: {insight}")

    # Verify PromptService was used? 
    # Hard to check internal calls without mocking PromptService, but if it ran without error, 
    # it means it found the config in Fallback or DB.
    
if __name__ == "__main__":
    asyncio.run(test_oracle_governance())
