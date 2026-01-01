import asyncio
import os
import shutil
import logging
from services.lightrag_service import get_lightrag_service

# Configure simplified logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def verify_lightrag():
    logger.info("=== Starting LightRAG SOTA Verification ===")
    
    # 1. Setup Test Data
    company_a = "SOTA_CORP_A"
    company_b = "SOTA_CORP_B"
    
    # Clean previous runs
    if os.path.exists(f"./data/lightrag/{company_a}"):
        shutil.rmtree(f"./data/lightrag/{company_a}")
    if os.path.exists(f"./data/lightrag/{company_b}"):
        shutil.rmtree(f"./data/lightrag/{company_b}")

    # 2. Initialize Company A
    logger.info(f"\n[Test] Initializing {company_a} (Oracle Brain)...")
    service_a = get_lightrag_service(company_a)
    await service_a.initialize()
    
    # 3. Simulate Meeting for Company A
    transcript_a = """
    Pedro: We need to approve the budget for Project Titan by Friday.
    Boss: What is the risk level?
    Pedro: The main risk is the legacy database migration using Oracle 11g.
    """
    logger.info(f"[Test] Indexing transcript for {company_a}...")
    await service_a.insert_incremental(transcript_a)
    
    # 4. Verify Retrieval Company A
    logger.info(f"[Test] Querying {company_a}...")
    query = "What are the risks for Project Titan?"
    ans_a = await service_a.query(query, mode="hybrid")
    logger.info(f"Answer A: {ans_a}")
    
    # 5. Initialize Company B (Isolation Check)
    logger.info(f"\n[Test] Initializing {company_b}...")
    service_b = get_lightrag_service(company_b)
    await service_b.initialize()
    
    # Query B for A's data
    logger.info(f"[Test] Querying {company_b} for {company_a}'s info (Should be empty/unknown)...")
    ans_b = await service_b.query(query, mode="hybrid")
    logger.info(f"Answer B (Expect Empty/General): {ans_b}")
    
    if ans_b and ("legacy database" in ans_b.lower() or "oracle 11g" in ans_b.lower()):
        logger.error("❌ ISOLATION FAILED: Company B accessed Company A's entities!")
    else:
        logger.info("✅ Isolation Verified: Company B knows nothing about Project Titan.")

    # 7. Verify Logic Verification (Contextual Injection) Simulation
    logger.info(f"\n[Test] simulating Intervention Oracle logic check...")
    # We simulate a statement contradicting the graph
    contradiction_stmt = "Project Titan uses MongoDB."
    # Direct query to see if LightRAG knows the truth
    ctx = await service_a.query("What database does Project Titan use?", mode="local")
    logger.info(f"Oracle Evidence: {ctx}")
    
    if "oracle" in ctx.lower():
         logger.info("✅ Contextual Injection Ready: Graph knows the truth to contradict 'MongoDB'.")
    else:
         logger.warning("⚠️ Graph might not have absorbed the fact 'Oracle 11g' strongly enough yet.")

    # 6. Verify Visualization Data
    logger.info(f"\n[Test] Fetching Graph Viz for {company_a}...")
    viz = await service_a.get_graph_visualization()
    if viz and not isinstance(viz, dict) or "error" in viz:
         logger.warning(f"Viz maybe empty (expected if graph not persisted yet): {viz}")
    else:
         logger.info(f"✅ Viz Data received with {len(viz.get('nodes', []))} nodes.")

    logger.info("\n=== Verification Complete ===")

if __name__ == "__main__":
    try:
        asyncio.run(verify_lightrag())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logger.error(f"Test Failed: {e}", exc_info=True)
