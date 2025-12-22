
import requests
import os

# Configuration (Reusing from apply_schema_direct.py)
PROJECT_REF = "pijyawytynnynwrtbule"
# CAUTION: Using the same token found in apply_schema_direct.py
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2"

API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

def apply_migration():
    print("Applying Migration 013: Enable Biometric Vectors...")
    
    file_path = "migrations/013_enable_biometric_vectors.sql"
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
            print("Success! Migration 013 applied.")
            print("Response:", response.json())
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception during request: {e}")

if __name__ == "__main__":
    apply_migration()
