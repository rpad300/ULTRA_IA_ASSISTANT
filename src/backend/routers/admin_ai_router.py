
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from services.prompt_service import prompt_service
from db.models import AIConfig, AIConfigUpdate

router = APIRouter(
    prefix="/api/admin/ai",
    tags=["Start AI Governance (Agent 6)"],
    responses={404: {"description": "Not found"}},
)

@router.get("/configs", response_model=List[AIConfig])
async def list_configs():
    """List all AI configurations."""
    try:
        return await prompt_service.list_configs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/configs/{slug}", response_model=AIConfig)
async def get_config(slug: str):
    """Get a specific AI configuration."""
    try:
        return await prompt_service.get_config(slug)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Config {slug} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/configs/{slug}", response_model=AIConfig)
async def update_config(slug: str, config: AIConfigUpdate):
    """Update an AI configuration."""
    try:
        return await prompt_service.update_config(slug, config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/model-version")
async def update_global_model_version(model_name: str):
    """
    Experimental: Bulk update model version for all active configs.
    Use with caution.
    """
    # This would require a bulk update method in service
    # Implementing simpler version: list all, update loop (inefficient but safe for <100 configs)
    configs = await prompt_service.list_configs()
    count = 0
    for cfg in configs:
        if cfg.is_active:
            await prompt_service.update_config(cfg.slug, AIConfigUpdate(model_name=model_name))
            count += 1
    return {"message": f"Updated {count} configurations to {model_name}"}
