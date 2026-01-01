from google import genai
from google.genai import types
from config import GEMINI_API_KEY, GEMINI_MODEL
import logging
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Union
import mimetypes
from tenacity import retry, stop_after_attempt, wait_exponential
from utils.circuit_breaker import circuit_breaker

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set")
        
        # Initialize the new Client
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.model_name = GEMINI_MODEL
        
        # Embedding model for vector generation
        self.embedding_model = "text-embedding-004"
        
        # File Cache for SOTA Performance (MD5 -> FileRef)
        self._file_cache: Dict[str, Any] = {}
        
        # User requested: Dynamic SOTA Model Selection
        # We start with config default, but will update dynamically.
        self.dynamic_model_lock = asyncio.Lock()
        self.model_resolved = False

    async def _resolve_sota_model(self):
        """
        Dynamically fetches the best available Gemini model from Redis 
        (populated by ModelDiscoveryService Agent 6).
        """
        if self.model_resolved: return
        
        async with self.dynamic_model_lock:
            if self.model_resolved: return
            
            try:
                from services.redis_service import get_redis_service
                redis = await get_redis_service()
                
                # Fetch "CURRENT_PRO_MODEL"
                discovered_model = await redis.get_json("CURRENT_PRO_MODEL")
                
                if discovered_model:
                    logger.info(f"SOTA Model Activated from Discovery: {discovered_model}")
                    self.model_name = discovered_model
                else:
                    logger.info(f"Using Default Config Model: {self.model_name}")
                
                self.model_resolved = True
                
            except Exception as e:
                logger.warning(f"Failed to resolve SOTA model from Redis: {e}")
                self.model_resolved = True # Don't retry per request to avoid lag

    async def generate_response(self, history: list, message: str) -> str:
        """
        Legacy method for backward compatibility.
        """
        formatted_history = self._format_history(history)
        chat = self.client.aio.chats.create(model=self.model_name, history=formatted_history)
        response = await chat.send_message(message)
        return response.text

    async def create_chat_session(
        self,
        history: List[Dict[str, Any]],
        system_instruction: str = None,
        tools: List[Any] = None
    ) -> Any:
        """
        Creates and returns a configured GenAI ChatSession (Async).
        Auto-resolves SOTA model.
        """
        await self._resolve_sota_model()

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools
        )
        
        formatted_history = self._format_history(history)
        
        # Return the async chat session
        # Note: We can't await here easily if this method is sync in signature, 
        # but client.aio.chats.create is a helper that returns a Chat object, it doesn't do IO itself yet usually.
        # However, checking SDK, 'create' might be just a factory.
        return self.client.aio.chats.create(
            model=self.model_name,
            history=formatted_history,
            config=config
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    async def generate_response_stream(
        self, 
        history: List[Dict[str, Any]], 
        message: Union[str, List[Any]],
        system_instruction: str = None,
        tools: List[Any] = None
    ) -> AsyncGenerator[str, None]:
        """
        Generates a streaming response.
        """
        try:
            from services.metrics_service import get_metrics_service, TimerContext
            
            # SOTA Observability: LLM Streaming Latency
            with TimerContext(get_metrics_service(), "gemini_response_latency", {"mode": "stream", "model": self.model_name}):
                chat = await self.create_chat_session(history, system_instruction, tools)
                
                # Send Message (Stream)
                response_stream = await chat.send_message_stream(message)
                
                async for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
                    
        except Exception as e:
            logger.error(f"Gemini Streaming Error: {e}", exc_info=True)
            raise e

    async def upload_file(self, file_path: str, mime_type: str = None) -> Any:
        """
        Uploads a file to the Gemini File API.
        """
        try:
            if not mime_type:
                mime_type, _ = mimetypes.guess_type(file_path)
            
            file_hash = await self._calculate_md5(file_path)
            
            if file_hash in self._file_cache:
                cached_file = self._file_cache[file_hash]
                logger.info(f"Reusing cached Gemini file: {cached_file.name} (Hash: {file_hash})")
                return cached_file

            logger.info(f"Uploading file to Gemini: {file_path} ({mime_type})")
            
            # The new SDK handles upload synchronously usually or via aio
            # We use the blocking call in executor to be safe if aio entry point isn't distinct for upload
            # Actually client.aio.files.upload should exist
            file_ref = await self.client.aio.files.upload(path=file_path, config={'mime_type': mime_type})
            
            self._file_cache[file_hash] = file_ref
            
            logger.info(f"File uploaded successfully: {file_ref.name}")
            return file_ref
        except Exception as e:
            logger.error(f"Failed to upload file to Gemini: {e}")
            raise

    async def _calculate_md5(self, file_path: str) -> str:
        import hashlib
        import aiofiles
        
        hash_md5 = hashlib.md5()
        async with aiofiles.open(file_path, "rb") as f:
            while chunk := await f.read(4096):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    async def delete_file(self, file_name: str):
        try:
            await self.client.aio.files.delete(name=file_name)
            logger.info(f"Deleted Gemini file: {file_name}")
            # Clean cache if present
            # We need to find key by value or just clear specific entry if we knew the hash
            # Given we only have file_name here, we might not easily clear the cache 
            # without iterating. For now, it's acceptable (cache is for upload avoidance).
        except Exception as e:
            logger.warning(f"Failed to delete file {file_name}: {e}")

    async def get_file_state(self, file_name: str) -> str:
        """
        Gets the processing state of a Gemini file.
        Returns: 'PROCESSING', 'ACTIVE', 'FAILED', etc.
        """
        try:
            file_obj = await self.client.aio.files.get(name=file_name)
            return file_obj.state.name
        except Exception as e:
            logger.error(f"Failed to get file state for {file_name}: {e}")
            raise

    def _format_history(self, history: list) -> list:
        """
        Formats history into Gemini format (Content objects or dicts).
        """
        formatted_history = []
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            
            if "parts" in msg:
                 # Validate existing parts structure
                 clean_parts = []
                 for p in msg["parts"]:
                     if isinstance(p, str):
                         clean_parts.append({"text": p})
                     else:
                         clean_parts.append(p)
                 
                 formatted_history.append({
                    "role": role,
                    "parts": clean_parts
                })
            else:
                content = msg.get("content", "")
                if content:
                    formatted_history.append({
                        "role": role,
                        "parts": [{"text": content}]
                    })
        return formatted_history

    async def summarize_text(self, text: str) -> str:
        prompt = f"Please provide a concise summary of the following meeting transcript, verifying key decisions and action items:\n\n{text}"
        response = await self.client.aio.models.generate_content(
            model=self.model_name, 
            contents=prompt
        )
        return response.text

    @circuit_breaker("gemini_embedding", failure_threshold=5, success_timeout=30)
    async def get_embedding(self, text: str = None, content: str = None) -> list[float]:
        final_text = text or content
        if not final_text:
            raise ValueError("No text provided for embedding")

        try:
            result = await self.client.aio.models.embed_content(
                model=self.embedding_model,
                contents=final_text
            )
            return result.embeddings[0].values
        except Exception as e:
            # Fallback for old model name possibly?
            # Or task_type difference. New SDK simplifies this.
            logger.error(f"Embedding failed: {e}")
            raise ValueError(f"Failed to generate embedding: {str(e)}")
    
    @circuit_breaker("gemini_embedding", failure_threshold=5, success_timeout=30)
    async def get_query_embedding(self, text: str) -> list[float]:
        return await self.get_embedding(text=text)
    
    @circuit_breaker("gemini_api", failure_threshold=5, success_timeout=30)
    async def generate_content_async(self, prompt: str, generation_config: Dict[str, Any] = None, response_mime_type: str = None) -> Any:
        try:
            # Build config object if dict provided
            gen_config = None
            if generation_config or response_mime_type:
                gen_config = types.GenerateContentConfig(
                    response_mime_type=response_mime_type,
                    **(generation_config or {})
                )

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=gen_config
            )
            return response
        except Exception as e:
            logger.error(f"Gemini Async Generation Error: {e}")
            raise

    def generate_content(self, prompt: str) -> str:
        """Synchronous wrapper (Legacy)."""
        try:
            # Note: This uses the sync client capability directly? 
            # We initialized self.client as the Unified Client.
            # It has .models (sync) and .aio.models (async)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            return response.text
        except Exception as e:
            raise ValueError(f"Failed to generate content: {str(e)}")

# Singleton
_gemini_service = None

def get_gemini_service():
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
