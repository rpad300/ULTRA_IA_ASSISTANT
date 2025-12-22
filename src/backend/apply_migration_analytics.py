
import requests
import os
from dotenv import load_dotenv

# Load env from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

PROJECT_REF = "pijyawytynnynwrtbule"
API_TOKEN = os.getenv("SUPABASE_KEY") # This is the service role key

API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

def apply_migration():
    print("Applying Migration 016: Create Analytics RPCs...")
    
    # Ensure path is relative to this script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, "migrations", "016_create_analytics_rpc.sql")
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return

    with open(file_path, "r") as f:
        sql_content = f.read()

    # Prepare Headers
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    # Payload
    payload = {
        "query": sql_content
    }

    # Execute
    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        
        if response.status_code == 200 or response.status_code == 201:
            print("Success! Migration 016 applied.")
            print("Response:", response.json())
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception during request: {e}")

if __name__ == "__main__":
    apply_migration()
