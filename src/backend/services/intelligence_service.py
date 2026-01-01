import logging
import asyncio
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from services.gemini_service import get_gemini_service
from services.qdrant_service import get_qdrant_service
from services.embedding_service import get_embedding_service
from services.redis_service import get_redis_service
from services.prompt_service import prompt_service

from schemas.intelligence import (
    MeetingPatternsResponse, 
    IntelligenceInsight, 
    FlowPrediction, 
    PreparationDocument, 
    ParticipantInsight
)

logger = logging.getLogger(__name__)

class IntelligenceService:
    def __init__(self):
        self.gemini = get_gemini_service()
        self.qdrant = get_qdrant_service()
        self.embedding_service = get_embedding_service()
        self.redis = None # Lazy load

    async def _get_redis(self):
        if self.redis is None:
            self.redis = await get_redis_service()
        return self.redis

    async def generate_cross_meeting_patterns(self, company_id: str, limit: int = 15) -> MeetingPatternsResponse:
        """
        SOTA Analysis: Finds recurring patterns across meetings.
        Strategy: Cache First -> Semantic RAG -> Structured LLM
        """
        cache_key = f"intel:patterns:{company_id}"
        redis = await self._get_redis()
        
        # 1. Cache First (Cost & Speed Optimization)
        cached = await redis.get_json(cache_key)
        if cached:
            # logger.info(f"Returning cached patterns for {company_id}")
            return MeetingPatternsResponse(**cached)

        try:
            # 2. RAG Contextual (Semantic Search for critical topics)
            # We search for "pain points" to feed the LLM
            query = "decisions, budget blockers, recurring risks, project delays"
            q_vector = await self.embedding_service.generate_embedding(query)
            
            loop = asyncio.get_running_loop()
            # Searching in thread to avoid blocking loop if sync
            results = await loop.run_in_executor(
                None, 
                lambda: self.qdrant.search_context(q_vector, company_id=company_id, limit=limit)
            )

            if not results:
                return MeetingPatternsResponse(company_id=company_id, patterns=[])

            # Prepare context for LLM
            context_text = "\n".join([f"Date: {r.get('original_created_at')} | Content: {r.get('content')}" for r in results])

            # 3. Structured Prompt (Gemini 1.5 JSON Mode)
            # Fetch config from Agent 6 Governance
            ai_config = await prompt_service.get_config("meeting_analysis_strategy")
            prompt = await prompt_service.render_prompt("meeting_analysis_strategy", context=context_text)

            # SOTA: Structured Response
            response = await self.gemini.generate_content_async(
                prompt, 
                response_mime_type="application/json",
                generation_config={"temperature": ai_config.temperature, "max_output_tokens": ai_config.max_tokens}
            )
            raw_data = json.loads(response.text)

            patterns = [
                IntelligenceInsight(
                    id=f"insight_{uuid.uuid4().hex[:6]}",
                    **item
                ) for item in raw_data
            ]

            res_obj = MeetingPatternsResponse(
                company_id=company_id,
                patterns=patterns,
                total_analyzed=len(results)
            )

            # TTL 1 Hour (Analysis doesn't change seconds-by-seconds)
            await redis.set_json(cache_key, res_obj.dict(), ttl_seconds=3600)
            return res_obj

        except Exception as e:
            logger.error(f"SOTA Cross-Pattern Analysis Failed: {e}")
            return MeetingPatternsResponse(company_id=company_id, patterns=[])

    async def predict_flow(self, session_id: str, current_transcript: str) -> List[FlowPrediction]:
        """
        Real-time flow prediction.
        Strategy: Strict Timeout + JSON Mode.
        """
        if len(current_transcript) < 200: return []

        try:
            # SOTA: Strict Timeout (Real-time usage constraint)
            # If AI takes > 8s, we abort to not hang UI
            ai_config = await prompt_service.get_config("flow_prediction")
            prompt = await prompt_service.render_prompt("flow_prediction", transcript=current_transcript[-2500:])

            response = await asyncio.wait_for(
                self.gemini.generate_content_async(
                    prompt, 
                    response_mime_type="application/json",
                    generation_config={"temperature": ai_config.temperature, "max_output_tokens": ai_config.max_tokens}
                ),
                timeout=8.0
            )
            
            data = json.loads(response.text)
            return [
                FlowPrediction(
                    id=f"flw_{uuid.uuid4().hex[:6]}",
                    predicted_topic=p["predictedTopic"],
                    reason=p["reason"],
                    confidence=p.get("confidence", 50),
                    estimated_duration_seconds=p.get("estimatedTime", 60)
                ) for p in data
            ]
        except asyncio.TimeoutError:
            logger.warning("Flow prediction timed out (SOTA Circuit Breaker)")
            return []
        except Exception as e:
            logger.warning(f"Flow prediction failure: {e}")
            return []

    async def generate_prep_doc(self, session_id: str, participants: List[str], company_id: str) -> PreparationDocument:
        """
        Generates 'Deep Briefing' document.
        Strategy: Parallel RAGIng (Fan-out/Fan-in).
        """
        try:
            # 1. Parallel RAG (Multi-Querying)
            # Gather context for ALL participants simultaneously vs sequential
            async def get_participant_bio(name: str):
                try:
                    query = f"Opinions, decisions and preferences of {name}"
                    # Assuming embed is async
                    vec = await self.embedding_service.generate_embedding(query)
                    
                    loop = asyncio.get_running_loop()
                    # Qdrant search might be blocking if not natively async client
                    res = await loop.run_in_executor(
                        None, lambda: self.qdrant.search_context(vec, company_id=company_id, limit=3)
                    )
                    snippets = "\n".join([f"- {r.get('content', '')}" for r in res])
                    return f"\nParticipant {name} Context:\n{snippets}"
                except Exception as ex:
                    logger.warning(f"Failed RAG for {name}: {ex}")
                    return f"\nParticipant {name}: No context available."

            # SOTA Parallel Execution
            contexts = await asyncio.gather(*[get_participant_bio(p) for p in participants])
            full_context = "".join(contexts)

            # 2. Executive Briefing Prompt
            ai_config = await prompt_service.get_config("prep_doc_briefing")
            prompt = await prompt_service.render_prompt("prep_doc_briefing", participants=participants, context=full_context)

            response = await self.gemini.generate_content_async(
                prompt, 
                response_mime_type="application/json",
                generation_config={"temperature": ai_config.temperature, "max_output_tokens": ai_config.max_tokens}
            )
            d = json.loads(response.text)

            return PreparationDocument(
                session_id=session_id,
                context_summary=d.get("context", ""),
                likely_topics=d.get("likelyTopics", []),
                suggested_questions=d.get("suggestedQuestions", []),
                risks=d.get("risks", []),
                participant_insights=[ParticipantInsight(**p) for p in d.get("participantInsights", [])]
            )

        except Exception as e:
            logger.error(f"Failed to generate Prep Doc: {e}")
            # Consider raising or returning empty
            raise

# Singleton
_instance = None
def get_intelligence_service():
    global _instance
    if _instance is None:
        _instance = IntelligenceService()
    return _instance
