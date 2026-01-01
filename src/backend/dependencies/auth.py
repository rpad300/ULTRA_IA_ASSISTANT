from fastapi import Depends, HTTPException, Header, status
from typing import Optional
from middleware.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

async def get_active_company_id(
    # SOTA: Tenta ler o Workspace ativo do Header (padrão de apps como Slack/Asana)
    x_company_id: Optional[str] = Header(None, alias="X-Company-ID"),
    current_user: dict = Depends(get_current_user)
) -> str:
    """
    SOTA Multi-tenant Context Resolver.
    Resolve o contexto da empresa com hierarquia de prioridade:
    1. Header X-Company-ID (Troca manual de workspace)
    2. Contexto padrão do utilizador (company_id no perfil)
    3. Primeiro item da lista de empresas permitidas.
    """
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Identidade não verificada."
        )

    allowed_ids = current_user.get("company_ids", [])
    
    if not allowed_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O utilizador não tem acesso a nenhuma organização."
        )

    # 1. Determinar o ID alvo (Header > Profile Default > List Default)
    # Nota: current_user.get("company_id") vem do middleware de auth e já representa um "default" válido
    target_id = x_company_id or current_user.get("company_id") or allowed_ids[0]

    # 2. VALIDAÇÃO DE SEGURANÇA CRÍTICA (Sandbox Enforcement)
    # Garante que o utilizador não está a tentar "saltar" para uma empresa que não lhe pertence
    if target_id not in allowed_ids:
        logger.warning(
            f"🚨 SEGURANÇA: Utilizador {current_user.get('user_id')} tentou aceder à "
            f"empresa {target_id} sem autorização!"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado a este Workspace."
        )

    return target_id

# Compatibility Alias
get_current_active_company = get_active_company_id
