import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL
import logging
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Union
import mimetypes
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set")
        genai.configure(api_key=GEMINI_API_KEY)
        self.model_name = GEMINI_MODEL
        # Use a model that supports newer features (Flash/Pro) if the config one is old
        # But respect config for now.
        
        # Embedding model for vector generation
        self.embedding_model = "models/text-embedding-004"
        
        # File Cache for SOTA Performance (MD5 -> FileRef)
        self._file_cache: Dict[str, Any] = {}

    async def generate_response(self, history: list, message: str) -> str:
        """
        Legacy method for backward compatibility.
        """
        formatted_history = self._format_history(history)
        model = genai.GenerativeModel(self.model_name)
        chat = model.start_chat(history=formatted_history)
        response = await chat.send_message_async(message)
        return response.text

    def create_chat_session(
        self,
        history: List[Dict[str, Any]],
        system_instruction: str = None,
        tools: List[Any] = None
    ) -> Any:
        """
        Creates and returns a configured GenAI ChatSession.
        Allows agents to manage the execution loop manually (SOTA).
        """
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction,
            tools=tools
        )
        formatted_history = self._format_history(history)
        return model.start_chat(history=formatted_history)

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
        Generates a streaming response with support for:
        - System Instructions (Persona)
        - Multimodal Inputs (Images/Audio via File API or parts)
        - Tool Use (Function Calling)
        """
        try:
            chat = self.create_chat_session(history, system_instruction, tools)
            
            # Send Message (Stream)
            # Automatic function calling is enabled by default in genai lib if tools are present
            response_stream = await chat.send_message_async(message, stream=True)
            
            async for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Gemini Streaming Error: {e}", exc_info=True)
            # Re-raise for retry logic to catch transient errors
            raise e

    async def upload_file(self, file_path: str, mime_type: str = None) -> Any:
        """
        Uploads a file to the Gemini File API for multimodal processing.
        Implements Smart Caching via MD5 hashing to reuse existing uploads.
        Returns the file object (uri).
        """
        try:
            if not mime_type:
                mime_type, _ = mimetypes.guess_type(file_path)
            
            # 1. Calculate MD5 Hash
            file_hash = await self._calculate_md5(file_path)
            
            # 2. Check Cache
            if file_hash in self._file_cache:
                cached_file = self._file_cache[file_hash]
                logger.info(f"Reusing cached Gemini file: {cached_file.name} (Hash: {file_hash})")
                return cached_file

            logger.info(f"Uploading file to Gemini: {file_path} ({mime_type})")
            
            # Use run_in_executor for blocking upload call
            loop = asyncio.get_running_loop()
            file_ref = await loop.run_in_executor(
                None, 
                lambda: genai.upload_file(file_path, mime_type=mime_type)
            )
            
            # 3. Update Cache
            self._file_cache[file_hash] = file_ref
            
            logger.info(f"File uploaded successfully: {file_ref.name}")
            return file_ref
        except Exception as e:
            logger.error(f"Failed to upload file to Gemini: {e}")
            raise

    async def _calculate_md5(self, file_path: str) -> str:
        """Async MD5 calculation for large files."""
        import hashlib
        import aiofiles
        
        hash_md5 = hashlib.md5()
        async with aiofiles.open(file_path, "rb") as f:
            while chunk := await f.read(4096):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    async def delete_file(self, file_name: str):
        """Clean up file from Gemini storage"""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: genai.delete_file(file_name))
            
            # Remove from cache if knowing the name (Reverse lookup would be needed or just clear)
            # For simple cache, we might leave it or clear periodically.
            # Ideally we map name -> hash to remove from cache.
        except Exception as e:
            logger.warning(f"Failed to delete file {file_name}: {e}")

    def _format_history(self, history: list) -> list:
        """
        Formats generic history into Gemini format.
        Supports multimodal 'parts' if present in history items.
        """
        formatted_history = []
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            
            # If history item already has native 'parts', use them (SOTA Multimodal History)
            if "parts" in msg:
                 formatted_history.append({
                    "role": role,
                    "parts": msg["parts"]
                })
            else:
                # Fallback to simple content text
                content = msg.get("content", "")
                if content:
                    formatted_history.append({
                        "role": role,
                        "parts": [content]
                    })
        return formatted_history

    async def summarize_text(self, text: str) -> str:
        """Summarizes text (Legacy wrapper)."""
        prompt = f"Please provide a concise summary of the following meeting transcript, verifying key decisions and action items:\n\n{text}"
        model = genai.GenerativeModel(self.model_name)
        response = await model.generate_content_async(prompt)
        return response.text

    async def get_embedding(self, text: str = None, content: str = None) -> list[float]:
        """Generates embedding vector."""
        final_text = text or content
        if not final_text:
            raise ValueError("No text provided for embedding")

        try:
            result = genai.embed_content(
                model=self.embedding_model,
                content=final_text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            raise ValueError(f"Failed to generate embedding: {str(e)}")
    
    async def get_query_embedding(self, text: str) -> list[float]:
        """Generates query embedding."""
        try:
            result = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type="retrieval_query"
            )
            return result['embedding']
        except Exception as e:
            raise ValueError(f"Failed to generate query embedding: {str(e)}")
    
    async def generate_content_async(self, prompt: str) -> Any:
        """Asynchronous wrapper for generating content."""
        try:
            model = genai.GenerativeModel(self.model_name)
            response = await model.generate_content_async(prompt)
            return response
        except Exception as e:
            logger.error(f"Gemini Async Generation Error: {e}")
            raise

    def generate_content(self, prompt: str) -> str:
        """Synchronous wrapper (Legacy)."""
        try:
            model = genai.GenerativeModel(self.model_name)
            response = model.generate_content(prompt)
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
