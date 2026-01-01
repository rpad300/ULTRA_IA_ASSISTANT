import os
import logging
import asyncio
import numpy as np
from typing import Optional, Dict, List, Any
from pathlib import Path

# SOTA: Hardware Acceleration Detection
import torch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# LightRAG
try:
    from lightrag import LightRAG, QueryParam
    from lightrag.utils import EmbeddingFunc
except ImportError:
    # Fallback for dev/initial setup if lib not installed yet
    LightRAG = None
    QueryParam = None
    EmbeddingFunc = None

from services.gemini_service import get_gemini_service
from config import GEMINI_MODEL

logger = logging.getLogger(__name__)

# Oracle Entity Types
# SOTA: Custom Domain-Specific Entities for "Project Intelligence"
ORACLE_ENTITY_TYPES = [
    "PERSON", "PROJECT", "DECISION", "DATE", "BUDGET", "TECHNOLOGY", "RISK", "ASSERTION"
]

class LightRAGService:
    """
    Oracle Brain Manager via LightRAG.
    Supports Multi-tenancy via Company ID isolation.
    """
    _instances: Dict[str, 'LightRAGService'] = {}

    def __init__(self, company_id: str):
        self.company_id = company_id
        # SOTA: File System Isolation per Tenant
        self.working_dir = f"./data/lightrag/{company_id}"
        self.rag: Optional[LightRAG] = None
        self.lock = asyncio.Lock()
        
        # Ensure directory exists
        if not os.path.exists(self.working_dir):
            os.makedirs(self.working_dir, exist_ok=True)

    @classmethod
    def get_instance(cls, company_id: str) -> 'LightRAGService':
        """Singleton-per-Company pattern."""
        if not company_id:
            raise ValueError("company_id is required for LightRAG access")
            
        if company_id not in cls._instances:
            cls._instances[company_id] = cls(company_id)
        return cls._instances[company_id]

    async def initialize(self):
        """Lazy initialization of the LightRAG engine for this company."""
        if self.rag:
            return

        async with self.lock:
            if self.rag: return
            
            if LightRAG is None:
                logger.error("LightRAG library not installed. Please pip install lightrag-hku.")
                return

            gemini = get_gemini_service()

            # 1. Embedding Wrapper
            # SOTA: Vectorize on GPU if possible (handled by remote API, but local array ops on device)
            async def gemini_embedding_func(texts: list[str]) -> np.ndarray:
                embeddings = []
                for text in texts:
                    try:
                        # Use our robust Gemini service
                        emb = await gemini.get_embedding(text=text)
                        embeddings.append(emb)
                    except Exception as e:
                        logger.error(f"Embedding error: {e}")
                        # Fallback zero vector
                        embeddings.append([0.0] * 768)
                return np.array(embeddings)

            # 2. LLM Wrapper
            async def gemini_llm_func(prompt: str, system_prompt: str = None, history: list = None, **kwargs) -> str:
                # SOTA: Prepend system prompt to enforce "Oracle" persona if needed
                full_prompt = prompt
                if system_prompt:
                    full_prompt = f"{system_prompt}\n\n{prompt}"
                
                try:
                    # Leverage Gemini 3 Pro (via Service dynamic model selection)
                    # We pass the full prompt.
                    resp = await gemini.generate_content_async(full_prompt)
                    return resp.text if resp else ""
                except Exception as e:
                    logger.error(f"LLM error: {e}")
                    return ""

            # 3. Initialize LightRAG Engine
            logger.info(f"Initializing LightRAG for {self.company_id} on {DEVICE}...")
            
            # Note: LightRAG currently runs graph ops on CPU/Network, 
            # but we can try to pass `device` if supported in future versions.
            self.rag = LightRAG(
                working_dir=self.working_dir,
                embedding_func=EmbeddingFunc(
                    embedding_dim=768, 
                    max_token_size=8192, 
                    func=gemini_embedding_func
                ),
                llm_model_func=gemini_llm_func,
                # Custom Entity Extraction via addon_params
                addon_params={
                    "entity_types": ORACLE_ENTITY_TYPES
                }
            )
            
            # Check if we need to hydrate or it auto-loads
            if hasattr(self.rag, 'initialize_storages'):
                 # await self.rag.initialize_storages() 
                 # Current version might do this in __init__ or lazy
                 pass
            
            logger.info(f"LightRAG {self.company_id} Ready.")

    async def insert_incremental(self, text: str):
        """Live updates from Transcription Pipeline."""
        if not self.rag: await self.initialize()
        
        # SOTA: Async Insert (non-blocking logic to be handled by caller/wrapper usually, 
        # but LightRAG.ainsert is async)
        try:
            logger.info(f"[Oracle] Learning new context for {self.company_id} ({len(text)} chars)...")
            await self.rag.ainsert(text)
        except Exception as e:
            logger.error(f"Failed to insert text into Graph: {e}")

    async def query(self, query_text: str, mode: str = "hybrid") -> str:
        """
        Retrieval Modes:
        - "local": Specific details (Direct edge traversal)
        - "global": High-level outlines (Community detection summaries)
        - "hybrid": Best of both
        """
        if not self.rag: await self.initialize()
        
        try:
            param = QueryParam(mode=mode)
            result = await self.rag.aquery(query_text, param=param)
            return result if result else "No information found."
        except Exception as e:
            logger.error(f"Query failed: {e}")
            return "Oracle Brain Error: Could not retrieve info."

    async def get_graph_visualization(self) -> Dict[str, Any]:
        """
        Export graph subset for Frontend HUD.
        Returns generic JSON compatible with D3/Cytoscape.
        """
        if not self.rag: await self.initialize()
        
        # Read the graph from NetworkX or storage
        # LightRAG exposes .chunk_entity_relation_graph (NetworkX) usually
        # or we might need to read the JSON files directly if memory instance is partial.
        
        # SOTA: Access generic graph
        # Note: This might be heavy for large graphs. We should limit nodes.
        try:
            # Check if internal graph allows access
            # Currently LightRAG encapsulates it.
            # We can try reading `graph_chunk_entity_relation.graphml` from working_dir
            graph_path = Path(self.working_dir) / "graph_chunk_entity_relation.graphml"
            if graph_path.exists():
                import networkx as nx
                G = nx.read_graphml(graph_path)
                # Convert to Cytoscape JSON
                elements = nx.cytoscape_data(G)
                return elements
            else:
                return {"error": "Graph not yet persisted or empty"}
        except Exception as e:
            logger.error(f"Viz Error: {e}")
            return {"error": str(e)}

def get_lightrag_service(company_id: str) -> LightRAGService:
    return LightRAGService.get_instance(company_id)
