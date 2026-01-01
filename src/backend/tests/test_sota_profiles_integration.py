
import pytest
import uuid
import asyncio
import sys
from services.chat_logic import ChatService
from managers.chat_manager import ChatConnectionManager
from db.supabase_client import get_supabase_client

@pytest.mark.asyncio
async def test_sota_profile_full_flow():
    """
    Integration Test for SOTA Profile Agents.
    """
    supabase = get_supabase_client()
    
    unique_id = uuid.uuid4().hex[:8]
    company_name = f"TestCorp_{unique_id}"
    
    # 1. Create Dummy Company
    try:
        company_res = supabase.table("companies").insert({"name": company_name}).execute()
        company_id = company_res.data[0]["id"]
        print(f"\n[1] Created Company: {company_id}")
    except Exception as e:
        pytest.fail(f"Failed to create Company: {e}")

    # 1b. Create Dummy Project (Required for Thread)
    try:
        project_payload = {
             "company_id": company_id,
             "name": f"TestProject_{unique_id}",
             "description": "Integration Test Project"
        }
        project_res = supabase.table("projects").insert(project_payload).execute()
        project_id = project_res.data[0]["id"]
        print(f"[1b] Created Project: {project_id}")
    except Exception as e:
        supabase.table("companies").delete().eq("id", company_id).execute()
        pytest.fail(f"Failed to create Project: {e}")

    # 2. Create SOTA Profile
    profile_payload = {
        "company_id": company_id,
        "name": "Integration Test Agent",
        "type": "test_bot", 
        "instructions": {
            "role": "Integration Tester",
            "mission": "Verify database schema integrity",
            "tone": "Robotic",
            "focus_areas": ["Schema", "Latency"],
            "forbidden_topics": ["Jokes"]
        },
        "capabilities": ["test_tool_a", "test_tool_b"],
        "knowledge_sources": ["folder_123", "folder_456"],
        "few_shot_examples": [{"input": "ping", "output": "pong"}],
        "response_format": "json_test",
        "icon": "flask",
        "color": "#00FF00"
    }
    
    try:
        profile_res = supabase.table("profiles").insert(profile_payload).execute()
        profile_id = profile_res.data[0]["id"]
        # Verify DB Read
        profile_read = supabase.table("profiles").select("*").eq("id", profile_id).execute()
        profile_data = profile_read.data[0]
        
        print(f"[2] Created Profile: {profile_id}")
        assert profile_data["instructions"]["role"] == "Integration Tester"
        
    except Exception as e:
        print(f"FAILED to create SOTA Profile: {e}")
        # Cleanup
        supabase.table("companies").delete().eq("id", company_id).execute()
        pytest.fail(f"Failed to create SOTA Profile. Error: {e}")

    # 3. Create Thread
    thread_payload = {
        "company_id": company_id,
        "project_id": project_id, # Added Project ID
        "profile_id": profile_id,
        "title": "Integration Test Thread"
    }
    
    try:
        thread_res = supabase.table("threads").insert(thread_payload).execute()
        thread_id = thread_res.data[0]["id"]
        print(f"[3] Created Thread: {thread_id}")
    except Exception as e:
        print(f"FAILED to create Thread: {e}")
        supabase.table("companies").delete().eq("id", company_id).execute()
        pytest.fail(f"Failed to create Thread. Error: {e}")

    # 4. Check Services Connectivity
    try:
        from services.qdrant_service import QdrantService
        q_service = QdrantService()
        q_healthy = await q_service.check_health() 
        print(f"[4] Qdrant Health: {q_healthy}")
    except Exception as e:
        print(f"[4] Qdrant Error: {e}")

    try:
        from services.redis_service import RedisService
        r_service = RedisService()
        r_ping = await r_service.ping()
        print(f"[5] Redis Ping: {r_ping}")
    except Exception as e:
        print(f"[5] Redis Error: {e}")
        
    # 6. Cleanup
    try:
        # Deleting company should cascade to project, thread, profile
        supabase.table("companies").delete().eq("id", company_id).execute()
        print("[6] Cleanup Complete")
    except Exception as e:
        print(f"Cleanup Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_sota_profile_full_flow())
