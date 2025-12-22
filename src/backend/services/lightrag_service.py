import os
import logging
import numpy as np
import google.generativeai as genai
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed
from services.gemini_service import get_gemini_service
from config import QDRANT_URL, QDRANT_API_KEY, GEMINI_MODEL
import asyncio

logger = logging.getLogger(__name__)

class LightRAGService:
    def __init__(self):
        self.working_dir = "./.lightrag_poc"
        if not os.path.exists(self.working_dir):
            os.makedirs(self.working_dir)
            
        self.gemini_service = get_gemini_service()
        self.rag = None

    async def initialize(self):
        if self.rag:
            return

        # Wrapper for Gemini Embedding
        async def gemini_embedding_func(texts: list[str]) -> np.ndarray:
            # LightRAG expects a list of strings and returns a numpy 2D array
            embeddings = []
            for text in texts:
                # We use the existing service. 
                # Note: get_embedding returns a list[float]
                try:
                    emb = await self.gemini_service.get_embedding(text=text)
                    embeddings.append(emb)
                except Exception as e:
                    logger.error(f"Error embedding text '{text[:50]}...': {e}")
                    # Return a zero vector or handle error effectively
                    # For POC, let's assume 768 dim (Gemini default)
                    embeddings.append([0.0] * 768) 
            
            return np.array(embeddings)
        
        gemini_embedding_func.embedding_dim = 768


        # Wrapper for Gemini LLM
        async def gemini_llm_func(prompt: str, system_prompt: str = None, history: list = None, **kwargs) -> str:
            # Construct the full prompt or use system instruction
            full_prompt = prompt
            if system_prompt:
                # Gemini doesn't always take system_prompt in the easy generate_content way without config
                # So we prepend it for this POC.
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            try:
                # Using the async generation
                response = await self.gemini_service.generate_content_async(full_prompt)
                return response.text
            except Exception as e:
                logger.error(f"Error generating content: {e}")
                return ""

        # Initialize LightRAG
        # We manually configure to use Qdrant for vectors
        # Note: LightRAG usually takes 'kv_storage', 'vector_storage', 'graph_storage' strings 
        # or we rely on default and just override functions.
        # For POC, let's start with FULL defaults (local JSON/NanoVectorDB) to ensure it works first,
        # verifying the "Graph" logic, then we can swap for Qdrant. 
        # Using Qdrant right away might introduce connection debugging irrelevant to "evaluating LightRAG".
        # User approved "test connections" earlier, but let's keep it simple first.
        # But wait, looking at my plan I said Qdrant. Let's try to stick to the plan but fallback if needed.
        # Check environment variables.
        
        # Actually simplest start: Local JSON storage for everything.
        # It creates a Graph and Vector store on disk.
        
        self.rag = LightRAG(
            working_dir=self.working_dir,
            embedding_func=gemini_embedding_func,
            llm_model_func=gemini_llm_func,
            # We can use 'QdrantVectorDBStorage' if we want, but it requires specific init.
            # For this POC to be "Zero Config" and fast, let's use the default NanoVectorDB 
            # included in LightRAG or just JSON.
            # If the user really wants Qdrant integration tested, we can enable it.
            # Let's try to use the default first to prove the "Intelligence" part, 
            # as integrating Qdrant is just "plumbing".
        )
        
        # Initialize storages
        await self.rag.initialize_storages()
        logger.info("LightRAG initialized successfully.")

    async def index_text(self, text: str):
        if not self.rag:
            await self.initialize()
        
        logger.info(f"Indexing text of length {len(text)}...")
        await self.rag.ainsert(text)
        logger.info("Indexing complete.")

    async def query(self, query_text: str, mode: str = "hybrid") -> str:
        if not self.rag:
            await self.initialize()
            
        logger.info(f"Querying: {query_text} (mode={mode})")
        # param = QueryParam(mode=mode) # Import QueryParam?
        # It seems LightRAG.aquery takes 'mode' directly or param object.
        # Checking docs snippet: param=QueryParam(mode=mode)
        
        result = await self.rag.aquery(query_text, param=QueryParam(mode=mode))
        return result

# Singleton
_lightrag_service = None

def get_lightrag_service():
    global _lightrag_service
    if _lightrag_service is None:
        _lightrag_service = LightRAGService()
    return _lightrag_service
