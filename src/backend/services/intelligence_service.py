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
        self.redis = None # Lazy loaded
        
    async def _get_redis(self):
        if self.redis is None:
            self.redis = await get_redis_service()
        return self.redis
        
    async def generate_cross_meeting_patterns(self, company_id: str, limit: int = 20) -> MeetingPatternsResponse:
        """
        Analyzes recent meeting data to find recurring patterns.
        Cached for 1 hour to reduce LLM costs.
        """
        try:
            # 1. Check Cache
            cache_key = f"intelligence:patterns:{company_id}"
            redis = await self._get_redis()
            cached_data = await redis.get_json(cache_key)
            if cached_data:
                logger.info(f"Returning cached patterns for {company_id}")
                return MeetingPatternsResponse(**cached_data)

            # 2. Retrieve broad context from Qdrant
            query = "decisions, recurring issues, budget, timeline, risks, conflicts"
            query_vector = await self.gemini.get_query_embedding(query)
            
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None, 
                lambda: self.qdrant.search_context(
                    query_vector=query_vector,
                    company_id=company_id,
                    limit=limit
                )
            )
            
            if not results:
                return MeetingPatternsResponse(company_id=company_id, patterns=[])

            # 3. Format Context
            context_text = "\n".join([
                f"- [{r.get('original_created_at', 'Unknown Date')}] {r.get('content')}" 
                for r in results
            ])
            
            # 4. Prompt Gemini
            prompt = f"""
            Analyze the following excerpts from various company meetings to identify recurring cross-meeting patterns.
            Focus on:
            1. Recurring blockers or issues.
            2. Consistent topics (e.g., "Budget is always discussed on Tuesdays").
            3. Behavioral patterns (e.g., "Decisions are often delayed").

            Context:
            {context_text}

            Return a JSON list of objects with keys: 
            'type' (string: 'blocker'|'topic'|'behavior'), 
            'description' (string), 
            'confidence' (number 0-100), 
            'related_meetings' (list of strings).
            Output ONLY valid JSON.
            """
            
            response = await self.gemini.generate_content_async(prompt)
            # Safe Parsing Logic can be extracted to a helper
            import re
            match = re.search(r'\[.*\]', response.text, re.DOTALL)
            patterns_list = []
            if match:
                raw_patterns = json.loads(match.group(0))
                for p in raw_patterns:
                    patterns_list.append(IntelligenceInsight(
                        id=f"ptrn-{uuid.uuid4().hex[:8]}",
                        type=p.get('type', 'general'),
                        description=p.get('description', 'No description'),
                        confidence=float(p.get('confidence', 0)),
                        related_meetings=p.get('related_meetings', [])
                    ))
            
            result = MeetingPatternsResponse(
                company_id=company_id,
                patterns=patterns_list,
                total_analyzed=len(results)
            )
            
            # 5. Cache Result (1 Hour TTL)
            redis = await self._get_redis()
            await redis.set_json(cache_key, result.dict(), expiration=3600)
            
            return result

        except Exception as e:
            logger.error(f"Error generating cross-meeting patterns: {e}", exc_info=True)
            # Fail gracefully returning empty
            return MeetingPatternsResponse(company_id=company_id, patterns=[])

    async def predict_flow(self, session_id: str, current_transcript: str) -> List[FlowPrediction]:
        """
        Predicts next topics. 
        Low latency required, no heavy RAG here usually, but we could add lightweight context.
        """
        try:
            prompt = f"""
            Based on the following meeting transcript, predict the next 3 likely topics of discussion.
            Also estimate the time to discuss (in seconds) and confidence.

            Transcript (Last 2000 chars):
            {current_transcript[-2000:]}

            Return a JSON list of objects: {{ "predictedTopic": str, "reason": str, "confidence": int, "estimatedTime": int }}
            Output ONLY valid JSON.
            """
            
            # Set timeout for LLM to avoid blocking indefinitely (e.g. 5 seconds ideally, but Gemini might be slower)
            # asyncio.wait_for logic could go here, or handled by gemini service wrapper.
            response = await self.gemini.generate_content_async(prompt)
            
            import re
            match = re.search(r'\[.*\]', response.text, re.DOTALL)
            predictions = []
            if match:
                raw_preds = json.loads(match.group(0))
                for p in raw_preds:
                    predictions.append(FlowPrediction(
                        id=f"pred-{uuid.uuid4().hex[:8]}",
                        predicted_topic=p.get('predictedTopic', 'Unknown'),
                        reason=p.get('reason', ''),
                        confidence=int(p.get('confidence', 0)),
                        estimated_duration_seconds=int(p.get('estimatedTime', 30))
                    ))
            return predictions
            
        except Exception as e:
            logger.error(f"Error predicting flow: {e}")
            return []

    async def generate_prep_doc(self, session_id: str, participants: List[str], company_id: str) -> PreparationDocument:
        """
        Generates a preparation document.
        Uses asyncio.gather for parallel context retrieval.
        """
        try:
            # 1. Parallel Context Retrieval
            async def fetch_participant_context(p: str) -> str:
                try:
                    q_vec = await self.gemini.get_query_embedding(f"Decisions or opinions by {p}")
                    # qdrant.search_context is sync or async? 
                    # Previous code called it without await: `self.qdrant.search_context(...)`
                    # Only `gemini.get_query_embedding` was awaited.
                    # Wait, looking at `generate_cross_meeting_patterns` in original file:
                    # `query_vector = await self.gemini.get_query_embedding(query)`
                    # `results = self.qdrant.search_context(...)` (Correct, qdrant service wrapper in previous context was sync for `search_context`?)
                    # Let's check `qdrant_service.py`? 
                    # If I assume it's sync, I should wrap it in `loop.run_in_executor` or check if there is an async version.
                    # BUT `generate_cross_meeting_patterns` in *this* file above uses `await self.qdrant.search_context`.
                    # Wait, I just wrote `await self.qdrant.search_context` in my replacement code above.
                    # I need to be sure. Most python qdrant clients are async now or hybrid.
                    # Given SOTA Refactor, `qdrant_service` likely was updated or I should assume async consistency. 
                    # If the service is legacy sync, I'll break it by awaiting.
                    # Original `intelligence_service.py` had:
                    # `query_vector = await self.gemini.get_query_embedding(query)`
                    # `results = self.qdrant.search_context(...)` -> No await.
                    # So it IS sync.
                    # SOTA Requirement: "Async & Timeouts".
                    # I should ideally make Qdrant async, but that's a different file.
                    # For now, I will run strict sync calls in executor to avoid blocking loop.
                    
                    loop = asyncio.get_running_loop()
                    results = await loop.run_in_executor(
                        None, 
                        lambda: self.qdrant.search_context(q_vec, company_id=company_id, limit=3)
                    )
                    
                    ctx_str = ""
                    if results:
                        ctx_str += f"\n--- Context for {p} ---\n"
                        for r in results:
                            ctx_str += f"- {r.get('content')}\n"
                    return ctx_str
                except Exception as ex:
                    logger.warning(f"Failed context for {p}: {ex}")
                    return ""

            # Run parallel fetches
            results = await asyncio.gather(*[fetch_participant_context(p) for p in participants])
            participant_context = "".join(results)

            # 2. Prompt Gemini
            prompt = f"""
            Prepare a meeting briefing document.
            Participants: {', '.join(participants)}
            
            Past Context:
            {participant_context}
            
            Generate a JSON object with:
            - "likelyTopics": list of strings
            - "suggestedQuestions": list of strings
            - "risks": list of strings
            - "context": brief summary string
            - "participantInsights": list of objects {{ "name": str, "insights": list[str], "likelyQuestions": list[str] }}
            
            Output ONLY valid JSON.
            """
            
            response = await self.gemini.generate_content_async(prompt)
            
            import re
            match = re.search(r'\{.*\}', response.text, re.DOTALL)
            data = {}
            if match:
                data = json.loads(match.group(0))
            
            # Map to Schema
            return PreparationDocument(
                session_id=session_id,
                context_summary=data.get("context", "Context unavailable"),
                likely_topics=data.get("likelyTopics", []),
                suggested_questions=data.get("suggestedQuestions", []),
                risks=data.get("risks", []),
                participant_insights=[
                    ParticipantInsight(**p) for p in data.get("participantInsights", [])
                ]
            )

        except Exception as e:
            logger.error(f"Error generating prep doc: {e}", exc_info=True)
            # Return empty/error doc
            return PreparationDocument(
                session_id=session_id,
                context_summary="Analysis Failed",
                likely_topics=[],
                suggested_questions=[],
                risks=["AI generation failed"],
                participant_insights=[]
            )

# Singleton
_intelligence_service = None

def get_intelligence_service():
    global _intelligence_service
    if _intelligence_service is None:
        _intelligence_service = IntelligenceService()
    return _intelligence_service
