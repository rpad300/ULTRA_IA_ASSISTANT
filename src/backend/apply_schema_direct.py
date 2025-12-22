import requests
import os

# Configuration from User Chat (Hardcoded for this one-off script to ensure it works)
# In a real scenario, we'd use env vars, but we want to be explicit here.
PROJECT_REF = "pijyawytynnynwrtbule"
# The secret provided by the user (assuming it's a PAT or valid API Token)
API_TOKEN = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2"

API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/query"

def apply_schema():
    print(f"Applying schema to {PROJECT_REF}...")
    
    # Read the schema file
    try:
        with open("schema.sql", "r") as f:
            sql_content = f.read()
    except FileNotFoundError:
        print("Error: schema.sql not found!")
        return

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
        
        if response.status_code == 200:
            print("Success! Schema applied.")
            print("Response:", response.json())
        elif response.status_code == 201:
             print("Success! Schema applied (201).")
        else:
            print(f"Failed (Status {response.status_code})")
            print("Body:", response.text)
            
    except Exception as e:
        print(f"Exception during request: {e}")

if __name__ == "__main__":
    apply_schema()
