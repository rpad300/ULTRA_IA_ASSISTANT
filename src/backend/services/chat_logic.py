
import asyncio
import logging
import uuid
from typing import Dict, Optional, List, Tuple
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
    - Reusable Logic for Preview/Testing.
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
                asyncio.create_task(self.run_agent_turn(thread_id, content))
            
            return saved_msg
                
        except Exception as e:
            logger.error(f"Handle User Msg Error: {e}", exc_info=True)
            await self.manager.broadcast(thread_id, {"type": "error", "message": "Failed to save message."})

    async def run_agent_turn(self, thread_id: str, last_user_content: str):
        """
        Orchestrates AI Generation within a persistent Thread.
        """
        lock = self._get_lock(thread_id)
        
        if lock.locked():
            logger.info(f"Thread {thread_id} busy. Queuing request...")
            
        async with lock:
            logger.info(f"Agent Turn Started: {thread_id}")
            try:
                # 1. Parallel Context Loading
                context_data = await self._load_context_parallel(thread_id)
                if not context_data:
                    logger.error("Failed to load context.")
                    return

                system_instruction = context_data["system_instruction"]
                project_context = context_data["project_context"]
                history = context_data["history"]

                # 2. SOTA RAG Retrieval (Just-In-Time)
                rag_context = ""
                knowledge_sources = context_data.get("knowledge_sources", [])
                company_id = context_data.get("company_id")
                
                if knowledge_sources and company_id:
                    try:
                        # STATE: Analyzing Query & Fetching
                        await self.manager.broadcast(thread_id, {
                            "type": "side_widgets_update",
                            "data": {
                                "rag_status": "fetching_context",
                                "knowledge_sources": knowledge_sources 
                            }
                        })
                        
                        rag_results = await self._perform_rag_search(last_user_content, company_id, knowledge_sources)
                        
                        if rag_results:
                            rag_context = "\nRETRIEVED KNOWLEDGE:\n" + "\n---\n".join([r['content'] for r in rag_results])
                            
                            # Matches for UI
                            matched_files = []
                            for r in rag_results:
                                payload = r.get("payload", {})
                                source_name = payload.get("source") or payload.get("title") or f"Doc_{r['point_id'][:8]}"
                                matched_files.append({"name": source_name, "status": "matched"})
                                
                            await self.manager.broadcast(thread_id, {
                                "type": "side_widgets_update",
                                "data": {
                                    "rag_status": "reading_files",
                                    "knowledge_sources": matched_files
                                }
                            })
                        else:
                             await self.manager.broadcast(thread_id, {
                                "type": "side_widgets_update",
                                "data": { "rag_status": "idle", "knowledge_sources": [] }
                            })

                    except Exception as rag_err:
                        logger.warning(f"RAG Retrieval Logic Failed: {rag_err}")
                
                # STATE: Synthesizing
                await self.manager.broadcast(thread_id, {"type": "side_widgets_update", "data": {"rag_status": "synthesizing"}})

                # 3. Resolve Tools
                from tools.registry import get_tools_for_capabilities
                capabilities = context_data.get("capabilities", [])
                tools = get_tools_for_capabilities(capabilities)
                
                await self.manager.broadcast(thread_id, {
                    "type": "side_widgets_update",
                    "data": { "active_tools": [{"tool": cap, "progress": "idle"} for cap in capabilities] }
                })
                
                # 4. Initialize Agent
                full_context = f"{project_context}\n{rag_context}"
                agent = GeminiAgent(
                    persona=system_instruction,
                    context=full_context,
                    tools=tools
                )

                # 5. Persist Placeholder
                placeholder_data = {
                    "thread_id": thread_id,
                    "role": "assistant",
                    "content": "",
                    "created_at": "now()" 
                }
                saved_placeholder = await self.message_repo.create(placeholder_data)
                if not saved_placeholder: raise Exception("Failed to create placeholder")
                message_id = saved_placeholder["id"]
                
                await self.manager.broadcast(thread_id, { "type": "typing_start", "message_id": message_id })

                # 6. Stream Loop
                full_response = ""
                token_buffer = ""
                last_broadcast_time = 0
                import time

                async for packet in agent.run_turn(history, last_user_content):
                    if packet["type"] == "token":
                        text = packet["text"]
                        full_response += text
                        token_buffer += text
                        
                        current_time = time.time()
                        if len(token_buffer) > 5 or (current_time - last_broadcast_time) > 0.050: 
                            await self.manager.broadcast(thread_id, {
                                "type": "token",
                                "text": token_buffer,
                                "message_id": message_id
                            })
                            token_buffer = ""
                            last_broadcast_time = current_time
                    
                    elif packet["type"] == "tool_start":
                        await self.manager.broadcast(thread_id, {
                            "type": "side_widgets_update",
                            "data": {
                                "active_tools": [{
                                    "tool": packet.get("tool"),
                                    "progress": "invoking",
                                    "ui_hint": packet.get("ui_hint", "Processing...")
                                }]
                            }
                        })
                
                if token_buffer:
                    await self.manager.broadcast(thread_id, { "type": "token", "text": token_buffer, "message_id": message_id })

                updated_msg = await self.message_repo.update_status(message_id, "completed", full_response)
                if updated_msg:
                    await self.manager.broadcast(thread_id, { "type": "new_message", "message": updated_msg })
                
            except Exception as e:
                logger.error(f"Agent Turn Failed: {e}", exc_info=True)
                if 'message_id' in locals():
                     await self.message_repo.update_status(message_id, "failed")
                await self.manager.broadcast(thread_id, { "type": "error", "message": "AI generation failed." })

    async def run_agent_preview(self, profile_id: str, input_text: str, project_id: Optional[str] = None) -> Dict:
        """
        SOTA: Real-time Agent Preview (Testing Lab).
        Does not persist messages. Pure generation for testing context/prompt.
        """
        # 1. Fetch Profile
        profile_data = await self._fetch_profile(profile_id)
        if not profile_data:
             raise Exception("Profile not found")
        
        # 2. Determine Project Scope
        pid = project_id or profile_data.get("project_id")
        project_data = None
        if pid:
             project_data = await self._fetch_project(pid)
             
        # 3. Build Prompt (Reuse Logic)
        system_instruction, project_context, _ = self._build_system_instruction(profile_data, project_data)
        
        # 4. RAG for Preview (Optional but requested "Real")
        # We try strict RAG if knowledge sources exist
        rag_context = ""
        knowledge_sources = profile_data.get("knowledge_sources", []) or []
        company_id = profile_data.get("company_id")
        
        if knowledge_sources and company_id:
            try:
                rag_results = await self._perform_rag_search(input_text, company_id, knowledge_sources)
                if rag_results:
                     rag_context = "\nRETRIEVED KNOWLEDGE (PREVIEW):\n" + "\n---\n".join([r['content'] for r in rag_results])
            except Exception as e:
                logger.warning(f"Preview RAG failed: {e}")

        full_context = f"{project_context}\n{rag_context}"

        # 5. Init Agent
        agent = GeminiAgent(
            persona=system_instruction,
            context=full_context,
            tools=[] # No tools in preview for safety? Can enable if needed.
        )
        
        # 6. Run Turn (Non-streaming buffer)
        response_text = ""
        async for packet in agent.run_turn([], input_text):
             if packet["type"] == "token":
                 response_text += packet["text"]
                 
        return {
            "response": response_text,
            "system_instruction": system_instruction 
        }

    async def _perform_rag_search(self, query: str, company_id: str, knowledge_sources: List[Dict]) -> List[Dict]:
        """Reusable RAG search."""
        from services.qdrant_service import init_qdrant_service
        from services.gemini_service import get_gemini_service
        
        gemini_service = get_gemini_service()
        query_vector = await gemini_service.get_embedding(query)
        
        q_service = await init_qdrant_service()
        return await q_service.search_context(
            query_vector=query_vector,
            company_id=company_id,
            folder_ids=knowledge_sources,
            limit=5
        )

    async def _load_context_parallel(self, thread_id: str) -> Optional[Dict]:
        """Asyncio Gather for Context with SOTA Fallbacks."""
        task_thread = self.thread_repo.get_by_id(thread_id)
        task_history = self._get_history_window(thread_id)
        
        results = await asyncio.gather(task_thread, task_history, return_exceptions=True)
        thread_data = results[0]
        history = results[1]
        
        if isinstance(thread_data, Exception) or not thread_data: return None
        if isinstance(history, Exception): history = [] 
        
        project_id = thread_data.get("project_id")
        profile_id = thread_data.get("profile_id")
        
        tasks_meta = []
        tasks_meta.append(self._fetch_project(project_id) if project_id else asyncio.sleep(0)) 
        tasks_meta.append(self._fetch_profile(profile_id) if profile_id else asyncio.sleep(0))
            
        meta_results = await asyncio.gather(*tasks_meta, return_exceptions=True)
        
        project_data = meta_results[0] if not isinstance(meta_results[0], Exception) and project_id else None
        profile_data = meta_results[1] if not isinstance(meta_results[1], Exception) and profile_id else None
        
        # Fallback Scoping
        if not project_data and profile_data and profile_data.get("project_id"):
             try: project_data = await self._fetch_project(profile_data.get("project_id"))
             except Exception: pass

        # REUSE: Build Prompt
        system_instruction, project_context, knowledge_sources = self._build_system_instruction(profile_data, project_data)
            
        return {
            "system_instruction": system_instruction,
            "project_context": project_context,
            "history": history,
            "knowledge_sources": knowledge_sources,
            "capabilities": profile_data.get("capabilities", []) if profile_data else [],
            "company_id": profile_data.get("company_id") if profile_data else None 
        }

    def _build_system_instruction(self, profile_data: Optional[Dict], project_data: Optional[Dict]) -> Tuple[Optional[str], str, List[Dict]]:
        """
        Pure logic to construct prompt and context strings.
        Returns: (system_instruction, project_context_str, knowledge_sources_list)
        """
        project_context = ""
        if project_data:
             project_context = f"CURRENT PROJECT CONTEXT:\nProject Name: {project_data.get('name')}\nDescription: {project_data.get('description')}\n---\n"
             
        system_instruction = None
        knowledge_sources = []
        
        if profile_data:
            instructions = profile_data.get("instructions", {}) or {}
            capabilities = profile_data.get("capabilities", []) or []
            knowledge_sources = profile_data.get("knowledge_sources", []) or []
            few_shot = profile_data.get("few_shot_examples", []) or []
            
            parts = []
            
            # 1. Identity
            role = instructions.get("role") or profile_data.get("name") or "Assistant"
            parts.append(f"IDENTITY: You are {role}.")
            
            # 2. Mission
            if instructions.get("mission"): parts.append(f"MISSION: {instructions.get('mission')}")
            # 3. Tone
            if instructions.get("tone"): parts.append(f"TONE: {instructions.get('tone')}")

            # 4. Context Boundary
            if project_data:
                parts.append(f"CONTEXT BOUNDARY: You are working specifically within the scope of the project '{project_data.get('name')}'. Focus your answers on this context.")
            
            # 5. Knowledge Base Awareness
            if knowledge_sources:
                source_names = []
                for ks in knowledge_sources:
                    if isinstance(ks, dict):
                        name = ks.get("name") or ks.get("id") or "Unknown Folder"
                        k_type = ks.get("type", "folder")
                        source_names.append(f"- {name} ({k_type})")
                    elif isinstance(ks, str):
                        source_names.append(f"- Drive Folder ID: {ks}")
                
                if source_names:
                    parts.append("ACCESSIBLE KNOWLEDGE BASE:\nYou have direct read access to the following project resources via RAG retrieval:\n" + "\n".join(source_names))

            # 6. Focus Areas
            if instructions.get("focus_areas"):
                areas = ", ".join(instructions.get("focus_areas"))
                parts.append(f"FOCUS AREAS: {areas}")
            
            # 7. Constraints
            if instructions.get("forbidden_topics"):
                forbidden = ", ".join(instructions.get("forbidden_topics"))
                parts.append(f"CONSTRAINTS: Do not discuss: {forbidden}")
                
            # 8. Available Tools
            if capabilities:
                tools_list = ", ".join(capabilities)
                parts.append(f"AVAILABLE TOOLS: {tools_list}")
                
            # 9. Output Format
            if profile_data.get("response_format"):
                parts.append(f"OUTPUT FORMAT: {profile_data.get('response_format')}")

            # 10. Few-Shot
            if few_shot:
                parts.append("\nEXAMPLES:")
                for ex in few_shot:
                    parts.append(f"User: {ex.get('input')}\nAssistant: {ex.get('output')}")

            # Legacy
            if profile_data.get("base_prompt"):
                parts.append(f"\nBASE INSTRUCTIONS: {profile_data.get('base_prompt')}")
                
            system_instruction = "\n\n".join(parts)
            
        return system_instruction, project_context, knowledge_sources

    async def _get_history_window(self, thread_id: str) -> List[Dict]:
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
