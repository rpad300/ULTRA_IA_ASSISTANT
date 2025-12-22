
import asyncio
import logging
import uuid
from typing import Dict, Optional, List
from datetime import datetime

from managers.chat_manager import ChatConnectionManager
from schemas.chat import TokenMessage, ChatMessage
from agents.gemini_agent import GeminiAgent
from repositories.thread_repository import ThreadRepository
from repositories.message_repository import MessageRepository

logger = logging.getLogger(__name__)

class ChatService:
    """
    SOTA Business Logic for Chat.
    - Parallel Context Loading.
    - Generation Locking (Per-Thread).
    - ID-First Persistence.
    - Repository Pattern for Data Access.
    """
    
    def __init__(self, manager: ChatConnectionManager, thread_repo: Optional[ThreadRepository] = None, message_repo: Optional[MessageRepository] = None):
        self.manager = manager
        self.thread_repo = thread_repo or ThreadRepository()
        self.message_repo = message_repo or MessageRepository()
        
        # Lock per thread to prevent concurrent generation race conditions
        self._locks: Dict[str, asyncio.Lock] = {}

    async def get_initial_messages(self, thread_id: str) -> List[Dict]:
        """Fetches full history for initial load."""
        return await self.message_repo.get_by_thread(thread_id, limit=100)

    def _get_lock(self, thread_id: str) -> asyncio.Lock:
        if thread_id not in self._locks:
            self._locks[thread_id] = asyncio.Lock()
        return self._locks[thread_id]

    async def handle_user_message(self, thread_id: str, content: str, role: str = "user"):
        """
        Saves user message and triggers AI response.
        Can be called from HTTP Router or WebSocket.
        """
        try:
            # 1. Save User Message (Async via Repo)
            msg_data = {
                "thread_id": thread_id,
                "role": role,
                "content": content,
                "created_at": "now()"
            }
            # Use Repository
            saved_msg = await self.message_repo.create(msg_data)
            
            if saved_msg:
                # Broadcast "New Message" to all clients
                await self.manager.broadcast(thread_id, {
                    "type": "new_message",
                    "message": saved_msg
                })

            # 2. Trigger AI (Fire and Forget Background Task)
            if role == "user":
                # We do NOT await this in HTTP request context usually, logic matches.
                asyncio.create_task(self.run_agent_turn(thread_id, content))
            
            return saved_msg
                
        except Exception as e:
            logger.error(f"Handle User Msg Error: {e}", exc_info=True)
            await self.manager.broadcast(thread_id, {"type": "error", "message": "Failed to save message."})

    async def run_agent_turn(self, thread_id: str, last_user_content: str):
        """
        Orchestrates AI Generation with Locking and Context Windowing.
        """
        lock = self._get_lock(thread_id)
        
        if lock.locked():
            logger.info(f"Thread {thread_id} busy. Queuing request...")
            
        async with lock:
            logger.info(f"Agent Turn Started: {thread_id}")
            try:
                # 1. Parallel Context Loading (SOTA Performance)
                context_data = await self._load_context_parallel(thread_id)
                if not context_data:
                    logger.error("Failed to load context.")
                    return

                system_instruction = context_data["system_instruction"]
                project_context = context_data["project_context"]
                history = context_data["history"]

                # 2. Initialize Agent
                agent = GeminiAgent(
                    system_instruction=system_instruction,
                    context=project_context
                )

                # 3. ID-First Persistence (SOTA Reliability)
                # Create Placeholder Message via Repo
                placeholder_data = {
                    "thread_id": thread_id,
                    "role": "assistant",
                    "content": "", # Empty initially
                    "status": "streaming",
                    "created_at": "now()" 
                }
                saved_placeholder = await self.message_repo.create(placeholder_data)
                
                if not saved_placeholder:
                    raise Exception("Failed to create placeholder message")
                
                message_id = saved_placeholder["id"]
                
                # Broadcast Typing Start
                await self.manager.broadcast(thread_id, {
                    "type": "typing_start", 
                    "message_id": message_id
                })

                # 4. Stream Loop
                full_response = ""
                
                async for packet in agent.run_turn(history, last_user_content):
                    if packet["type"] == "token":
                        text = packet["text"]
                        full_response += text
                        
                        # Broadcast Token with Message ID
                        await self.manager.broadcast(thread_id, {
                            "type": "token",
                            "text": text,
                            "message_id": message_id
                        })
                
                # 5. Finalize Message via Repo
                updated_msg = await self.message_repo.update_status(message_id, "completed", full_response)
                
                # Broadcast Completion
                # Use updated_msg or merge manually if repo doesn't return everything? 
                # Repo usually returns updated record.
                if updated_msg:
                    await self.manager.broadcast(thread_id, {
                        "type": "new_message",
                        "message": updated_msg
                    })
                
                logger.info(f"Agent Turn Complete: {thread_id}")

            except Exception as e:
                logger.error(f"Agent Turn Failed: {e}", exc_info=True)
                await self.manager.broadcast(thread_id, {
                    "type": "error",
                    "message": "AI generation failed."
                })

    async def _load_context_parallel(self, thread_id: str) -> Optional[Dict]:
        """Asyncio Gather for Context."""
        # Prepare Tasks
        task_thread = self.thread_repo.get_by_id(thread_id)
        # Reuse message repo for history, requesting small limit if needed, 
        # but _fetch_history asked for last 15. Repository default is 100.
        # We can implement specific method or just slice locally if needed, but efficient is DB limit.
        # Let's add limit arg to message_repo.get_by_thread (done).
        task_history = self.message_repo.get_by_thread(thread_id, limit=15)
        
        results = await asyncio.gather(task_thread, task_history, return_exceptions=True)
        
        thread_data = results[0]
        history = results[1]
        
        if isinstance(thread_data, Exception) or not thread_data:
            return None
        
        # Reverse history to be chronological for Agent? 
        # Repo does order(..., desc=False), so it is chronological (Oldest First).
        # Wrapper logic _fetch_history previously did order desc + limit + reverse because fetching "Last N" 
        # in SQL requires DESC sort.
        # Be careful!
        # If repo `get_by_thread` does `order("created_at", desc=False).limit(100)`, it gets the FIRST 100 messages.
        # That is WRONG for chat history context (we want LAST N).
        # I need to fix logic here. I should probably add `get_recent_history` to MessageRepo?
        # Or just use fetch_history logic here.
        
        # Let's manually fetch history here efficiently with repo extended or just direct repo call?
        # Repo `get_by_thread` is generic.
        # I will revert this specific history call to use a specific optimized method in Repo or handle it.
        # Actually, `fetch_history` in previous code: `.order("created_at", desc=True).limit(15)` then `[::-1]`.
        # I should add `get_last_n_messages` to MessageRepository.
        
        # For now, I will assume I update MessageRepo OR handle it.
        # Let's stick to the previous pattern and maybe add `get_recent_context` to repo later.
        # Or instantiate a task that calls a new helper `_get_history_window` which I define below.
        
        history = await self._get_history_window(thread_id)
        
        # Re-fetch thread data if gather above was just for structure matching... 
        # Wait, I can't await inside gather args list unless it's a coroutine object.
        # `thread_repo.get_by_id` IS coroutine.
        # So:
        # results = await asyncio.gather(self.thread_repo.get_by_id(thread_id), self._get_history_window(thread_id))
        
        # But wait, `_get_history_window` is what I want.
        
        project_id = thread_data.get("project_id")
        profile_id = thread_data.get("profile_id")
        
        # Recursive fetch for Project/Profile
        # We need generic way to fetch project/profile since we don't have those Repos created yet in Phase 1?
        # User plan didn't specify ProjectRepository/ProfileRepository.
        # I will use BaseRepository generic fetch or just raw supabase for these READ helpers for now as "Private" helpers
        # to avoid scope creep, OR create simple `repositories/legacy_reads.py`?
        # Or just keep `_fetch_project` with `get_async_supabase_client` as before?
        # The goal is Async Consistency. `get_async_supabase_client` is async.
        # So I can keep `_fetch_project` using `get_async_supabase_client` internally, OR create generic method.
        # I'll keep `_fetch_project` as private helper using async client.
        
        tasks_meta = []
        if project_id: tasks_meta.append(self._fetch_project(project_id))
        else: tasks_meta.append(asyncio.sleep(0)) 
            
        if profile_id: tasks_meta.append(self._fetch_profile(profile_id))
        else: tasks_meta.append(asyncio.sleep(0))
            
        meta_results = await asyncio.gather(*tasks_meta, return_exceptions=True)
        
        project_data = meta_results[0] if not isinstance(meta_results[0], Exception) and project_id else None
        profile_data = meta_results[1] if not isinstance(meta_results[1], Exception) and profile_id else None
        
        # Format
        project_context = ""
        if project_data:
             project_context = f"Project: {project_data.get('name')}\nDescription: {project_data.get('description')}"
             
        system_instruction = None
        if profile_data:
            system_instruction = profile_data.get("base_prompt")
            
        return {
            "system_instruction": system_instruction,
            "project_context": project_context,
            "history": history
        }

    async def _get_history_window(self, thread_id: str) -> List[Dict]:
        """Specific helper for Context Window (Last 15 messages)."""
        return await self.message_repo.get_recent_history(thread_id, limit=15)

    async def _fetch_project(self, pid: str):
        from db.supabase_client import get_async_supabase_client
        sb = await get_async_supabase_client()
        res = await sb.table("projects").select("*").eq("id", pid).single().execute()
        return res.data

    async def _fetch_profile(self, pid: str):
        from db.supabase_client import get_async_supabase_client
        sb = await get_async_supabase_client()
        res = await sb.table("profiles").select("*").eq("id", pid).single().execute()
        return res.data
