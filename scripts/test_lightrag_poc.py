import sys
import os
import asyncio
import logging

# Add src/backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from services.lightrag_service import get_lightrag_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting LightRAG POC Test...")
    
    rag_service = get_lightrag_service()
    
    # Sample Text: strict instructions or complex relationships
    text = """
    A Ultra IA é assistente pessoal local que revoluciona a gestão.
    O CTO é o Ricardo Dias.
    O Ricardo tomou a decisão de migrar o banco de vetor de Chroma para Qdrant na semana passada devido à performance.
    Isso causou um bug na indexação que foi resolvido pelo Agente de Correção.
    O sistema usa Gemini como LLM principal, mas suporta fallback para OpenAI.
    A Arquitetura é construída em Python (FastAPI) e React.
    O objetivo é ter Memória Infinita e Raciocínio Agêntico.
    """
    
    try:
        # Indexing
        print("\n--- Indexing Text ---")
        await rag_service.index_text(text)
        
        # Query Local (Details)
        print("\n--- Query Local (Specific) ---")
        q1 = "Quem é o CTO e o que ele decidiu sobre o banco de dados?"
        ans1 = await rag_service.query(q1, mode="local")
        print(f"Q: {q1}")
        print(f"A: {ans1}")
        
        # Query Global (Themes)
        print("\n--- Query Global (High Level) ---")
        q2 = "Quais as principais tecnologias e arquitetura do sistema?"
        ans2 = await rag_service.query(q2, mode="global")
        print(f"Q: {q2}")
        print(f"A: {ans2}")
        
        # Query Hybrid
        print("\n--- Query Hybrid ---")
        q3 = "Resuma as decisões técnicas recentes e o impacto delas."
        ans3 = await rag_service.query(q3, mode="hybrid")
        print(f"Q: {q3}")
        print(f"A: {ans3}")

    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(main())
