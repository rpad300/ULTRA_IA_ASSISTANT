from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from services.lightrag_service import get_lightrag_service
from typing import Optional, Dict, Any

router = APIRouter(tags=["Knowledge Graph"])

@router.get("/api/graph/{company_id}/visualize")
async def get_graph_visualization(company_id: str):
    """
    Returns the Knowledge Graph structure for visualization (Nodes/Edges).
    Format compatible with Cytoscape.js.
    """
    try:
        service = get_lightrag_service(company_id)
        data = await service.get_graph_visualization()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/graph/{company_id}/query")
async def query_oracle_brain(
    company_id: str, 
    q: str, 
    mode: str = Query("hybrid", enum=["local", "global", "hybrid"])
):
    """
    Directly query the Oracle Brain (LightRAG).
    Stats:
    - Local: Specific entity lookup.
    - Global: Pattern/Theme summarization.
    - Hybrid: Combined intelligence.
    """
    try:
        service = get_lightrag_service(company_id)
        response = await service.query(q, mode=mode)
        return {"response": response, "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
