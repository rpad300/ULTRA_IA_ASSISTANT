
import requests
import json

# Configuration reused from apply_schema_direct.py as fallback
PROJECT_REF = "pijyawytynnynwrtbule"
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

SQL_MIGRATION = """
-- Create AI Configurations Table
CREATE TABLE IF NOT EXISTS ai_configurations (
    slug TEXT PRIMARY KEY,
    model_name TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
    system_prompt TEXT NOT NULL,
    temperature FLOAT NOT NULL DEFAULT 0.0,
    max_tokens INTEGER NOT NULL DEFAULT 2048,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Data (Upsert)
INSERT INTO ai_configurations (slug, model_name, system_prompt, temperature, max_tokens)
VALUES 
('oracle_agent', 'gemini-1.5-pro', 'You are the Intervention Oracle. Analyze the conversation transcript in real-time. Detect contradictions, forgotten commitments, and technical inaccuracies. Be concise. Output structured JSON.', 0.0, 1024),
('chat_agent', 'gemini-1.5-pro', 'You are an advanced AI assistant. Help the user with their tasks.', 0.7, 2048)
ON CONFLICT (slug) DO NOTHING;
"""

def apply_direct_migration():
    print(f"Applying AI Config Migration to {PROJECT_REF} via Direct API...")
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "query": SQL_MIGRATION
    }

    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        
        if response.status_code in [200, 201]:
            print("Success! Migration applied.")
            print(response.text)
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception during request: {e}")

if __name__ == "__main__":
    apply_direct_migration()
