from fastapi import Depends, HTTPException
from typing import Optional
from middleware.auth import get_current_user

async def get_current_active_company(
    current_user: dict = Depends(get_current_user)
) -> str:
    """
    Dependency to get the active company_id from the authenticated user.
    Enforces that the user has a valid company context.
    """
    if not current_user:
         raise HTTPException(status_code=401, detail="Authentication required")
         
    company_id = current_user.get("company_id")
    if not company_id:
        # Check if they have a list of companies and pick the first one
        company_ids = current_user.get("company_ids", [])
        if company_ids:
            return company_ids[0]
            
        raise HTTPException(
            status_code=403, 
            detail="User is not associated with any company."
        )
    
    return company_id
