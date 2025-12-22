
import os


log_file = r"C:\Users\rdias\Documents\GitHub\ULTRA_IA_ASSISTANT\src\backend\backend_auth.log"

try:
    with open(log_file, 'rb') as f:
        # seek to end
        f.seek(0, 2)
        end_pos = f.tell()
        # look back 100000 bytes
        f.seek(max(0, end_pos - 100000))
        lines = f.readlines()
    
    print(f"Reading tail of {len(lines)} lines from {log_file}...")
    
    # Print last 20 lines unconditionally to see what is happening
    print("--- LAST 20 LINES ---")
    for line in lines[-20:]:
        print(line.decode('utf-8', errors='ignore').strip())
    
    for i, line in enumerate(lines):
        try:
            decoded = line.decode('utf-8', errors='ignore').strip()
            if "Drive auth error" in decoded or "Failed to authenticate" in decoded or "POST /api/auth/drive/connect" in decoded:
                print(f"MATCH Line {i}: {decoded}")
        except Exception:
            continue

except Exception as e:
    print(f"Error reading log: {e}")
