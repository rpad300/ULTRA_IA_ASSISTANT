
import logging
import asyncio
import json
import uuid
from typing import Optional, List, Dict
from datetime import datetime

from services.gemini_service import get_gemini_service
from services.qdrant_service import get_qdrant_service
# from services.embedding_service import get_embedding_service
from models.oracle import IntentClassification, IntentType, FactCheckResult, SolutionResult
from models.transcription import InsightMessage as WSInsightMessage
from services.action_item_service import get_action_item_service

logger = logging.getLogger(__name__)

class InterventionOracle:
    """
    Agent 4: The Live Intelligence Oracle.
    Analyzes the "NOW" against the "PAST" (Knowledge Base) to provide proactive interventions.
    """
    def __init__(self, session_id: str, company_id: str = "default"):
        self.session_id = session_id
        self.company_id = company_id
        self.gemini = get_gemini_service()
        self.qdrant = get_qdrant_service()
        # self.embedding = get_embedding_service()
        
        # SOTA: Warm-up Context Cache
        self.system_context_prompt = "" 
        self.is_warmed_up = False
        self.warmup_lock = asyncio.Lock()

    async def warm_up_context(self, project_id: Optional[str] = None):
        """
        Loads summaries of the last 3 meetings to prime the Oracle.
        """
        if self.is_warmed_up: return
        
        async with self.warmup_lock:
            if self.is_warmed_up: return
            
            try:
                # 1. Fetch Summaries (via Qdrant or Analytics Service)
                # We search Qdrant for "meeting summary" or similar metadata if we don't have a direct DB query handy yet.
                # Ideally this comes from a Repository. For now, we simulate or use Qdrant search.
                # Actually, relying on Qdrant "type=summary" if we indexed it.
                # Fallback: Query Qdrant for "summary" with project filter.
                
                query_vec = await self.gemini.get_embedding(text="meeting summary key decisions")
                
                # Search constraint
                results = await self.qdrant.search_context(
                     query_vector=query_vec,
                     company_id=self.company_id,
                     project_id=project_id,
                     limit=3,
                     score_threshold=0.6
                )
                
                summaries = [r.get('content', '') for r in results]
                
                if summaries:
                    self.system_context_prompt = "PREVIOUS CONTEXT:\n" + "\n---\n".join(summaries)
                    logger.info(f"Oracle Warmed Up with {len(summaries)} summaries for Session {self.session_id}")
                else:
                    logger.info(f"Oracle Warm-up: No previous summaries found.")
                    
                self.is_warmed_up = True
                
            except Exception as e:
                logger.error(f"Oracle Warm-up Failed: {e}")

    async def process_transcript(self, text: str, speaker: str, trace_id: str) -> Optional[WSInsightMessage]:
        """
        Main Pipeline:
        1. Intent Classification (Async)
        2. Routing (Conflict vs Solution)
        3. Intervention Generation
        """
        if len(text) < 15: return None # Noise filter
        
        try:
            # 1. Classify Intent
            intent_res = await self._classify_intent(text)
            
            if not intent_res: return None
            
            # 2. Route based on Intent
            insight = None
            
            if intent_res.intent == IntentType.FACT_ASSERTION:
                # Trigger Conflict Engine
                insight = await self._run_conflict_engine(text, speaker, trace_id)
                
            elif intent_res.intent == IntentType.DOUBT_QUESTION:
                # Trigger Solution Resolver
                insight = await self._run_solution_resolver(text, speaker, trace_id)

            elif intent_res.intent == IntentType.ACTION_ITEM:
                # Trigger Action Item Persistence
                await self._handle_action_item(text, speaker, trace_id)
            
            return insight

        except Exception as e:
            logger.error(f"Oracle Process Error: {e}")
            return None

    async def _classify_intent(self, text: str) -> Optional[IntentClassification]:
        """
        Uses Gemini 1.5 Flash with Structured Output to classify.
        """
        try:
            # SOTA: Governed Prompt
            from services.prompt_service import prompt_service
            
            config = await prompt_service.get_config("oracle_intent")
            prompt = await prompt_service.render_prompt("oracle_intent", text=text)

            # Use Dynamic Model (Agent 6) via wrapper
            # We ignore config.model_name to enforce CURRENT_PRO_MODEL as per Agent 4 requirement
            res = await self.gemini.generate_content_async(
                prompt,
                response_mime_type="application/json",
                generation_config={"temperature": config.temperature}
            )
            
            data = json.loads(res.text)
            return IntentClassification(
                intent=data.get("intent", "OTHER"),
                confidence=data.get("confidence", 0.0),
                reasoning=data.get("reasoning", "")
            )
        except Exception as e:
            logger.warning(f"Intent Classify Failed: {e}")
            return None

    async def _run_conflict_engine(self, text: str, speaker: str, trace_id: str) -> Optional[WSInsightMessage]:
        """
        The Oracle: Checks facts against Qdrant.
        """
        # 1. Parallel Search (Qdrant + LightRAG)
        query_vec = await self.gemini.get_embedding(text=text)
        
        # Qdrant (Semantic Search)
        qdrant_results = await self.qdrant.search_context(query_vec, company_id=self.company_id, limit=3)
        
        # LightRAG (Relational Search)
        from services.lightrag_service import get_lightrag_service
        try:
             rag_service = get_lightrag_service(self.company_id)
             # "Local" mode is faster and better for specific fact checking (direct edges)
             rag_result = await rag_service.query(text, mode="local")
        except Exception as e:
             logger.warning(f"LightRAG Query Failed: {e}")
             rag_result = ""

        if not qdrant_results and not rag_result: return None
        
        retrieved_context = "\n".join([f"- {r['content']}" for r in qdrant_results])
        if rag_result:
            retrieved_context += f"\n\n[Relational Memory]:\n{rag_result}"
        
        # 2. Compare (Gemini)
        try:
            from services.prompt_service import prompt_service
            
            config = await prompt_service.get_config("oracle_conflict")
            prompt = await prompt_service.render_prompt("oracle_conflict", text=text, context=retrieved_context)

            res = await self.gemini.generate_content_async(
                prompt,
                response_mime_type="application/json",
                generation_config={"temperature": config.temperature}
            )
            
            data = json.loads(res.text)
            
            if data.get("is_conflicting") and data.get("confidence", 0) > 0.7:
                 # Extract Metadata for Source Link
                 source_link = "N/A"
                 source_link = "N/A"
                 if qdrant_results:
                     top_res = qdrant_results[0]
                     payload = top_res.get("payload", {})
                     if payload.get("drive_file_id"):
                         source_link = f"https://docs.google.com/open?id={payload['drive_file_id']}"
                     elif payload.get("url"):
                         source_link = payload["url"]
                     else:
                         source_link = f"Reference: {top_res.get('author_name', 'Unknown')}"
                 elif rag_result:
                      source_link = "Oracle Brain (Graph Memory)"

                 return WSInsightMessage(
                     insight_type="conflict",
                     text=f"Divergência: {data['original_fact']} vs {data['new_fact']}",
                     confidence=data['confidence'],
                     trace_id=trace_id,
                     source_link=source_link,
                     related_fact=data['original_fact']
                 )
                 
        except Exception as e:
            logger.warning(f"Conflict Engine Error: {e}")
            
        return None

    async def _run_solution_resolver(self, text: str, speaker: str, trace_id: str) -> Optional[WSInsightMessage]:
        """
        Solution Resolver: Quick Q&A.
        """
        try:
            from services.prompt_service import prompt_service
            
            config = await prompt_service.get_config("oracle_solution")
            prompt = await prompt_service.render_prompt(
                "oracle_solution", 
                text=text, 
                context=self.system_context_prompt or "No context available."
            )

            res = await self.gemini.generate_content_async(
                prompt,
                response_mime_type="application/json",
                generation_config={"temperature": config.temperature}
            )
            
            data = json.loads(res.text)
            
            if data.get("answer"):
                return WSInsightMessage(
                    insight_type="solution",
                    text=data["answer"],
                    confidence=data.get("confidence", 0.8),
                    trace_id=trace_id,
                    source_link=str(data.get("sources", []))
                )
        except Exception as e:
            logger.warning(f"Solution Resolver Error: {e}")
            
        return None

    async def _handle_action_item(self, text: str, speaker: str, trace_id: str):
        """
        Persists an action item.
        """
        try:
            svc = get_action_item_service()
            # Ideally extract "Assignee" via Gemini, but for now use Speaker as Creator and text as desc.
            # We could do a quick extraction: "Assign to <Name>"
            
            # Simple persistence
            await svc.create_action_item(
                description=text,
                session_id=self.session_id,
                author_name=speaker,
                company_id=self.company_id
            )
            # We don't necessarily need to send an InsightMessage for every task creation, 
            # unless we want a toaster "Task Created".
            # For now, silent success.
            logger.info(f"Oracle: Persisted Action Item from {speaker}")
            
        except Exception as e:
            logger.error(f"Action Item Handle Error: {e}")
