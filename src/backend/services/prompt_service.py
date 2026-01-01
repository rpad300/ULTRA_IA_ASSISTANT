
import logging
import json
import time
from typing import Dict, Any, Optional
from jinja2 import Environment, BaseLoader, select_autoescape
from db.supabase_client import get_async_supabase_client
from services.redis_service import RedisService
from db.models import AIConfig, AIConfigUpdate
from services.metrics_service import get_metrics_service

# Setup logger
logger = logging.getLogger(__name__)

# Fallback Configuration
FALLBACK_CONFIGS = {
    "oracle_agent": {
        "slug": "oracle_agent",
        "model_name": "gemini-1.5-pro",
        "system_prompt": "You are the Intervention Oracle. Analyze the conversation transcript in real-time. Detect contradictions, forgotten commitments, and technical inaccuracies. Be concise. Output structured JSON.",
        "temperature": 0.0,
        "max_tokens": 1024,
        "is_active": True
    },
    "chat_agent": {
        "slug": "chat_agent",
        "model_name": "gemini-1.5-pro",
        "system_prompt": "You are an advanced AI assistant. Help the user with their tasks.",
        "temperature": 0.7,
        "max_tokens": 2048,
        "is_active": True
    },
    "oracle_intent": {
        "slug": "oracle_intent",
        "model_name": "gemini-1.5-flash",
        "system_prompt": """Analyze this transcription segment: "{{text}}"
        
        Classify into one of: 
        - [FACT_ASSERTION]: Stating a fact, number, date, or decision. (e.g. "We decided the budget is 50k", "The deadline is Monday")
        - [DOUBT/QUESTION]: Asking for help, clarification, or expressing uncertainty. (e.g. "What was the decision on X?", "I'm not sure about the API")
        - [ACTION_ITEM]: Assigning a task.
        - [OTHER]: Chit-chat, agreements, filler.
        
        Return JSON: { "intent": "FACT_ASSERTION" | "DOUBT_QUESTION" | "ACTION_ITEM" | "OTHER", "confidence": float, "reasoning": str }
        """,
        "temperature": 0.0,
        "max_tokens": 256,
        "is_active": True
    },
    "oracle_conflict": {
        "slug": "oracle_conflict",
        "model_name": "gemini-1.5-pro",
        "system_prompt": """Task: Fact Check.
        New Statement: "{{text}}"
        Knowledge Base:
        {{context}}
        
        Compare the Statement vs Knowledge Base.
        If there is a direct contradiction or significant divergence (e.g. different numbers, dates, decisions), output JSON.
        If they match or are unrelated, return { "is_conflicting": false }.
        
        Output JSON: { "is_conflicting": boolean, "original_fact": str, "new_fact": str, "confidence": float }
        """,
        "temperature": 0.0,
        "max_tokens": 512,
        "is_active": True
    },
    "oracle_solution": {
        "slug": "oracle_solution",
        "model_name": "gemini-1.5-pro",
        "system_prompt": """User Question: "{{text}}"
        Context: {{context}}
        
        Answer the question briefly based on context or general knowledge.
        Return JSON: { "answer": str, "confidence": float, "sources": [str] }
        """,
        "temperature": 0.2,
        "max_tokens": 512,
        "is_active": True
    },
    "meeting_analysis_strategy": {
        "slug": "meeting_analysis_strategy",
        "model_name": "gemini-1.5-pro",
        "system_prompt": """You are an Executive Strategy AI. Analyze the meeting logs below to find recurring patterns in blockers, topics, and behaviors.
        
        Context: {{context}}
        
        Return ONLY a JSON array of objects:
        { "type": "blocker"|"topic"|"behavior", "description": string, "confidence": 0-100, "related_meetings": [date string] }
        """,
        "temperature": 0.2,
        "max_tokens": 2048,
        "is_active": True
    },
    "flow_prediction": {
        "slug": "flow_prediction",
        "model_name": "gemini-1.5-flash",
        "system_prompt": """Analyze the last 2 minutes of conversation and predict the next 3 likely turns.
        Transcript: {{transcript}}
        Return JSON list: [{ "predictedTopic": str, "reason": str, "confidence": int, "estimatedTime": int }]
        """,
        "temperature": 0.1,
        "max_tokens": 512,
        "is_active": True
    },
    "prep_doc_briefing": {
        "slug": "prep_doc_briefing",
        "model_name": "gemini-1.5-pro",
        "system_prompt": """Generate a Briefing Document for a new meeting.
        Participants: {{participants}}
        Historical Evidence: {{context}}
        
        Provide a detailed JSON:
        {
            "context": string,
            "likelyTopics": [string],
            "suggestedQuestions": [string],
            "risks": [string],
            "participantInsights": [{ "name": str, "insights": [str], "likelyQuestions": [str] }]
        }
        """,
        "temperature": 0.3,
        "max_tokens": 4096,
        "is_active": True
    }
}

class PromptService:
    def __init__(self):
        self.redis = RedisService()
        self.jinja_env = Environment(loader=BaseLoader(), autoescape=select_autoescape())
        self.CACHE_TTL = 300 # 5 minutes local cache TTL

    async def get_config(self, slug: str) -> AIConfig:
        """
        Retrieves AI Configuration by slug.
        Priority: Redis -> Supabase -> Local Memory -> Hardcoded Fallback.
        """
        start_time = time.time()
        
        try:
            # 1. Try Redis
            cache_key = f"ai_config:{slug}"
            # Use get_json which handles decoding and namespacing
            try:
                # Ensure connection
                await self.redis.connect()
                config_dict = await self.redis.get_json(cache_key)
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")
                config_dict = None
            
            if config_dict:
                # logger.debug(f"PromptService: Cache hit for {slug}")
                get_metrics_service().timer("prompt_service_get_config", time.time() - start_time, {"source": "redis"})
                return AIConfig(**config_dict)

            # 2. Try Supabase
            logger.info(f"PromptService: Cache miss for {slug}, fetching from DB")
            supabase = await get_async_supabase_client()
            response = await supabase.table("ai_configurations").select("*").eq("slug", slug).limit(1).execute()
            
            if response.data and len(response.data) > 0:
                config_data = response.data[0]
                # Cache in Redis (TTL 1 hour)
                try:
                    await self.redis.set_json(cache_key, config_data, ttl_seconds=3600)
                except Exception as e:
                    logger.warning(f"Redis set failed: {e}")
                
                get_metrics_service().timer("prompt_service_get_config", time.time() - start_time, {"source": "database"})
                return AIConfig(**config_data)
            
            # 3. Slug not found in DB
            logger.warning(f"PromptService: Config {slug} not found in DB.")
            raise ValueError(f"Configuration for {slug} not found.")

        except Exception as e:
            logger.error(f"PromptService Error fetching {slug}: {e}. Using Fallback.")
            
            # 4. Fallback
            if slug in FALLBACK_CONFIGS:
                get_metrics_service().timer("prompt_service_get_config", time.time() - start_time, {"source": "fallback"})
                return AIConfig(**FALLBACK_CONFIGS[slug])
            
            raise e

    async def render_prompt(self, slug: str, **kwargs) -> str:
        """
        Fetches config and renders the system prompt using Jinja2.
        """
        config = await self.get_config(slug)
        template = self.jinja_env.from_string(config.system_prompt)
        return template.render(**kwargs)

    async def update_config(self, slug: str, update_data: AIConfigUpdate) -> AIConfig:
        """
        Updates configuration in Supabase and invalidates Redis cache.
        """
        try:
            # Clean None values
            data_to_update = {k: v for k, v in update_data.model_dump().items() if v is not None}
            data_to_update["updated_at"] = time.strftime('%Y-%m-%dT%H:%M:%S%z') 

            supabase = await get_async_supabase_client()
            response = await supabase.table("ai_configurations").update(data_to_update).eq("slug", slug).execute()
            
            if response.data:
                # Invalidate Cache
                try:
                    await self.redis.connect()
                    await self.redis.delete(f"ai_config:{slug}")
                except Exception as e:
                    logger.warning(f"Redis delete failed: {e}")
                
                updated_config = AIConfig(**response.data[0])
                logger.info(f"PromptService: Updated config for {slug}")
                return updated_config
            
            raise ValueError(f"Failed to update {slug}")

        except Exception as e:
            logger.error(f"PromptService Update Error: {e}")
            raise e

    async def list_configs(self) -> list[AIConfig]:
        """List all configurations"""
        supabase = await get_async_supabase_client()
        response = await supabase.table("ai_configurations").select("*").order('slug').execute()
        return [AIConfig(**item) for item in response.data]
        

prompt_service = PromptService()
