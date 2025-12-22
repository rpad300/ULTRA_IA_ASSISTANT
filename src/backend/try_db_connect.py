import psycopg2
import os

# "Hail Mary" configuration
# Trying the user's "sb_secret" as the DB password
DB_HOST = "db.pijyawytynnynwrtbule.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASS = "sb_secret_9g2zeaSQeb5AnAl3FbXWkw_HZA8usy2"
DB_PORT = "5432"

def try_apply_schema():
    print(f"Connecting to {DB_HOST}...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        conn.autocommit = True
        print("SUCCESS! Connected to Database direct.")
        
        # Read Schema
        with open("schema.sql", "r") as f:
            sql = f.read()
            
        print("Applying Schema...")
        cursor = conn.cursor()
        cursor.execute(sql)
        print("Schema Applied Successfully!")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"Connection Failed: {e}")
        return False

if __name__ == "__main__":
    if try_apply_schema():
        exit(0)
    else:
        exit(1)
