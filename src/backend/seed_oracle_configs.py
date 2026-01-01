
import asyncio
import os
import sys
from dotenv import find_dotenv, load_dotenv

# Path fix
sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

# Load Env
load_dotenv(find_dotenv(usecwd=True))

from db.supabase_client import get_async_supabase_client

ORA_INTENT = {
    "slug": "oracle_intent",
    "model_name": "gemini-1.5-flash",
    "system_prompt": """Analyze this transcription segment: "{{text}}"

Classify into one of:
- [FACT_ASSERTION]: Stating a fact, number, date, or decision.
- [DOUBT/QUESTION]: Asking for help, clarification, or expressing uncertainty.
- [ACTION_ITEM]: Assigning a task.
- [OTHER]: Chit-chat, agreements, filler.

Return JSON: { "intent": "FACT_ASSERTION" | "DOUBT_QUESTION" | "ACTION_ITEM" | "OTHER", "confidence": float, "reasoning": str }""",
    "temperature": 0.0,
    "max_tokens": 256,
    "is_active": True
}

ORA_CONFLICT = {
    "slug": "oracle_conflict",
    "model_name": "gemini-1.5-pro",
    "system_prompt": """Task: Fact Check.
New Statement: "{{text}}"
Knowledge Base:
{{context}}

Compare the Statement vs Knowledge Base.
If there is a direct contradiction or significant divergence (e.g. different numbers, dates, decisions), output JSON.
If they match or are unrelated, return { "is_conflicting": false }.

Output JSON: { "is_conflicting": boolean, "original_fact": str, "new_fact": str, "confidence": float }""",
    "temperature": 0.0,
    "max_tokens": 512,
    "is_active": True
}

ORA_SOLUTION = {
    "slug": "oracle_solution",
    "model_name": "gemini-1.5-pro",
    "system_prompt": """User Question: "{{text}}"
Context: {{context}}

Answer the question briefly based on context or general knowledge.
Return JSON: { "answer": str, "confidence": float, "sources": [str] }""",
    "temperature": 0.2,
    "max_tokens": 512,
    "is_active": True
}

async def seed():
    print("Seeding Oracle Configs via Supabase Client...")
    supabase = await get_async_supabase_client()
    
    data = [ORA_INTENT, ORA_CONFLICT, ORA_SOLUTION]
    
    try:
        # Upsert
        res = await supabase.table("ai_configurations").upsert(data).execute()
        print(f"Success! Upserted {len(res.data)} rows.")
    except Exception as e:
        print(f"Failed to upsert: {e}")

if __name__ == "__main__":
    asyncio.run(seed())
