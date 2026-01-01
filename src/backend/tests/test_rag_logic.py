
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import sys

# Define Mocks before importing services (if they are not already imported)
# Or use patch.dict for sys.modules
# But simplest is to use patch inside the test function context.

from services.chat_logic import ChatService

@pytest.mark.asyncio
async def test_rag_and_tool_wiring():
    """
    Verifies that ChatService.run_agent_turn:
    1. Fetches embedding for query.
    2. Searches Qdrant using 'knowledge_sources' (folder_ids).
    3. Resolves 'capabilities' to tools.
    4. Initializes GeminiAgent with RAG context and Tools.
    """
    
    # Setup Mocks
    mock_manager = MagicMock()
    mock_manager.broadcast = AsyncMock()
    
    mock_thread_repo = MagicMock()
    mock_message_repo = MagicMock()
    mock_message_repo.create = AsyncMock(return_value={"id": "msg_123"})
    mock_message_repo.update_status = AsyncMock(return_value={"id": "msg_123", "status": "completed"})
    
    # Instance
    service = ChatService(mock_manager, mock_thread_repo, mock_message_repo)
    
    # Mock Context Data (returned by _load_context_parallel)
    mock_context_data = {
        "system_instruction": "You are a bot.",
        "project_context": "Project: Alpha",
        "history": [],
        "knowledge_sources": ["folder_A", "folder_B"],
        "capabilities": ["test_tool_a"],
        "company_id": "comp_123"
    }
    
    service._get_lock = MagicMock(return_value=AsyncMock())
    service._get_lock.return_value.locked.return_value = False
    
    # Patch _load_context_parallel to return our mock data
    with patch.object(service, '_load_context_parallel', new_callable=AsyncMock) as mock_load:
        mock_load.return_value = mock_context_data
        
        # Patch External Services (Qdrant, Embedding, GeminiAgent)
        with patch("services.chat_logic.GeminiAgent") as MockAgentClass, \
             patch("services.qdrant_service.init_qdrant_service", new_callable=AsyncMock) as mock_init_qdrant, \
             patch("services.gemini_service.get_gemini_service") as mock_get_gemini:
             
            # Configure Gemini Service Mock (Embedding)
            mock_gemini_svc = MagicMock()
            mock_gemini_svc.get_embedding = AsyncMock(return_value=[0.1, 0.2, 0.3])
            mock_get_gemini.return_value = mock_gemini_svc
            
            # Configure Qdrant Mock
            mock_q_service = AsyncMock()
            async def search_side_effect(*args, **kwargs):
                return [
                    {"content": "Secret Info A", "payload": {"title": "Doc A"}},
                    {"content": "Secret Info B", "payload": {"title": "Doc B"}}
                ]
            mock_q_service.search_context.side_effect = search_side_effect
            mock_init_qdrant.return_value = mock_q_service
            
            # Configure Gemini Agent Mock
            mock_agent_instance = MagicMock()
            mock_agent_instance.run_turn.return_value = iter([]) # async generator empty
            # Because run_turn is async gen, we need to mock __aiter__
            async def async_gen():
                yield {"type": "token", "text": "Hello"}
            mock_agent_instance.run_turn.side_effect = lambda *args: async_gen()
            
            MockAgentClass.return_value = mock_agent_instance
            
            # Execute
            await service.run_agent_turn("thread_1", "What is the secret?")
            
            # --- ASSERTIONS ---
            
            # 1. Check Embedding Call
            mock_gemini_svc.get_embedding.assert_awaited_with("What is the secret?")
            
            # 2. Check Qdrant Search (The Core RAG Logic)
            mock_q_service.search_context.assert_awaited_once()
            call_kwargs = mock_q_service.search_context.call_args.kwargs
            assert call_kwargs["company_id"] == "comp_123"
            assert call_kwargs["folder_ids"] == ["folder_A", "folder_B"] # Filter Verified!
            assert call_kwargs["query_vector"] == [0.1, 0.2, 0.3]
            
            # 3. Check Gemini Agent Init
            MockAgentClass.assert_called_once()
            init_kwargs = MockAgentClass.call_args.kwargs
            
            # Context should contain Project + RAG
            assert "Project: Alpha" in init_kwargs["context"]
            assert "RETRIEVED KNOWLEDGE" in init_kwargs["context"]
            assert "Secret Info A" in init_kwargs["context"]
            
            # Tools should be resolved
            assert "tools" in init_kwargs
            assert len(init_kwargs["tools"]) > 0
            # We assume test_tool_a maps to something in registry
            
            # 4. Verify SOTA Broadcasts (Detailed States)
            broadcast_calls = mock_manager.broadcast.call_args_list
            broadcast_types = [c.args[1]["type"] for c in broadcast_calls]
            
            # Check we have side_widgets_update
            assert "side_widgets_update" in broadcast_types
            
            # Check detail states
            states_broadcasted = []
            for c in broadcast_calls:
                payload = c.args[1]
                if payload["type"] == "side_widgets_update":
                    if "rag_status" in payload["data"]:
                        states_broadcasted.append(payload["data"]["rag_status"])
                    if "active_tools" in payload["data"]:
                        # Initial tool state
                        states_broadcasted.append("tools_initialized")
            
            assert "analyzing_query" in states_broadcasted
            assert "fetching_context" in states_broadcasted
            assert "reading_files" in states_broadcasted
            assert "synthesizing" in states_broadcasted
            
            print("\n✅ RAG Wiring Verified: Qdrant called with folder_ids.")
            print("✅ Tool Wiring Verified: Gemini initialized with tools.")
            print(f"✅ SOTA Broadcasts Verified: {states_broadcasted}")

if __name__ == "__main__":
    asyncio.run(test_rag_and_tool_wiring())
