import asyncio
import logging
from unittest.mock import MagicMock, AsyncMock, patch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VERIFY_CHAT")

async def verify_chat_logic():
    print("\n--- Verifying Chat SOTA Logic ---")
    
    try:
        from services.chat_logic import ChatService
        from managers.chat_manager import ChatConnectionManager
        
        # Mocks
        mock_manager = MagicMock(spec=ChatConnectionManager)
        mock_manager.broadcast = AsyncMock()
        
        # Patch the Client used by Repositories
        # Must patch where it is IMPORTED, not where it is defined, because imports happen before patch.
        with patch("repositories.base_repository.get_async_supabase_client") as mock_get_client:
            mock_sb = MagicMock()
            mock_get_client.return_value = mock_sb
            
            # --- Mock Message Saving (handle_user_message) ---
            mock_msg_insert = MagicMock()
            # return_value is the builder returned by insert()
            # then .single() returns another builder
            # then .execute() returns the coroutine
            mock_msg_insert.return_value.single.return_value.execute = AsyncMock(
                return_value=MagicMock(data={"id": "msg_user_1", "content": "Hello AI", "status": "sent"})
            )
            mock_sb.table.return_value.insert = mock_msg_insert

            # --- Mock Placeholder Saving (run_agent_turn) ---
            # We need to distinguish calls or just return something valid for any insert
            # But the order matters. First call is User Msg, Second is Placeholder.
            # Using side_effect to return different values
            
            msg_user_response = MagicMock(data={"id": "msg_user_1", "role": "user"})
            msg_placeholder_response = MagicMock(data={"id": "msg_bot_1", "role": "assistant"})
            
            async def side_effect_insert(*args, **kwargs):
                # We return a Builder Mock that eventually executes
                builder = MagicMock()
                # If we are inserting User Msg vs Placeholder...
                # It's tricky to differentiate args on the builder immediately without deep inspection.
                # Simplifying: return a generic "Executor" that returns a sequence of results?
                # But .single() is called.
                
                # Let's mock .single().execute() to return based on call count or similar?
                # Impossible to be perfect with simple mocks.
                # Let's just return a generic valid message.
                builder.single.return_value.execute = AsyncMock(return_value=msg_placeholder_response)
                return builder
            
            # Apply side effect to the EXECUTE method of the builder
            # insert().single().execute()
            
            # Note: insert() returns a builder.
            # We must assign the side effect to the execute method of THAT builder's single() result.
            
            execute_mock = AsyncMock(side_effect=[
                MagicMock(data={"id": "msg_user_1", "role": "user"}), # 1. User Msg
                MagicMock(data={"id": "msg_bot_1", "role": "assistant"}) # 2. Placeholder
            ])
            mock_msg_insert.return_value.single.return_value.execute = execute_mock
            
            # --- Mock Update Status (run_agent_turn finalization) ---
            mock_update = MagicMock()
            mock_update.eq.return_value.single.return_value.execute = AsyncMock(
                return_value=MagicMock(data={"id": "msg_bot_1", "status": "completed"})
            )
            mock_sb.table.return_value.update.return_value = mock_update

            # Initialize Service
            service = ChatService(mock_manager)
            
            # Mock Context Loading (bypass DB)
            service._load_context_parallel = AsyncMock(return_value={
                "system_instruction": "You are a bot.",
                "project_context": "Project X",
                "history": []
            })
            
            # Mock Gemini Agent
            with patch("services.chat_logic.GeminiAgent") as MockAgent:
                mock_agent_instance = MockAgent.return_value
                
                # Mock async generator
                async def mock_gen(*args, **kwargs):
                    yield {"type": "token", "text": "Hello"}
                    yield {"type": "token", "text": " World"}
                
                mock_agent_instance.run_turn = mock_gen
                
                # TEST ACTION: Handle User Message
                print("[CHECK] Handling User Message...")
                saved_msg = await service.handle_user_message("thread_1", "User Input")
                
                # Yield to event loop to allow background task (run_agent_turn) to proceed
                await asyncio.sleep(0.1)
                
                # VERIFY RETURN VALUE
                assert saved_msg is not None, "handle_user_message should return the saved message"
                assert saved_msg["id"] == "msg_user_1", "Should return the user message ID"
                print(" -> PASSED (Return Value Correct)")
                
                # VERIFY BROADCASTS
                # Expect:
                # 1. new_message (User Msg)
                # 2. typing_start (Bot)
                # 3. token (Hello)
                # 4. token (World)
                # 5. new_message (Bot Complete)
                
                assert mock_manager.broadcast.call_count >= 5, f"Expected 5+ broadcasts, got {mock_manager.broadcast.call_count}"
                print(" -> PASSED (Broadcast Count)")
                
                # Verify Logic Flow
                assert execute_mock.call_count >= 2, "Should have inserted User Msg and Placeholder"
                
                print("[CHECK] Logic Flow Verified")

        print("\n--- Verification Complete: SOTA Chat Logic Valid ---")

    except Exception as e:
         print(f"\n[FAIL] Verification Failed: {e}")
         import traceback
         traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_chat_logic())
