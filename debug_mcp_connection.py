
import subprocess
import sys
import os
import json
import time

def main():
    script_path = os.path.join("src", "backend", "run_qdrant_mcp.py")
    
    print(f"[TEST] Launching {script_path}...")
    
    # Start the process
    process = subprocess.Popen(
        [sys.executable, script_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=0  # Unbuffered
    )
    
    # Give it a moment to start up
    time.sleep(1)
    
    # Check if dead
    if process.poll() is not None:
        print(f"[FAIL] Process died immediately. Exit code: {process.returncode}")
        print("--- STDERR ---")
        print(process.stderr.read())
        return

    # Send initialize request
    # JSON-RPC 2.0
    init_req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "debugger", "version": "0.1"}
        }
    }
    
    print("[TEST] Sending 'initialize'...")
    try:
        # Write line-delimited JSON
        process.stdin.write(json.dumps(init_req) + "\n")
        process.stdin.flush()
    except Exception as e:
        print(f"[FAIL] Could not write to stdin: {e}")
        return

    print("[TEST] Waiting for response...")
    
    # Read stdout line by line
    try:
        # Give it up to 5 seconds
        start = time.time()
        while time.time() - start < 5:
            if process.poll() is not None:
                print(f"[FAIL] Process died while waiting for response. Exit code: {process.returncode}")
                print("--- STDERR ---")
                print(process.stderr.read())
                start_read = process.stdout.read()
                if start_read:
                    print("--- STDOUT (partial) ---")
                    print(start_read)
                return

            # Try to read line (non-blocking in a real loop is hard in pure python without threads/select, 
            # but readline might block. Let's assume it replies or dies)
            # Actually, let's just use communicate with timeout if simple read fails?
            # readline() blocks.
            
            # Simple check: Is there data?
            # Windows select on pipes is tricky. 
            # We'll just try readline() and rely on the fact that if it crashes, readline returns empty string.
            line = process.stdout.readline()
            if line:
                print(f"[SUCCESS] RX: {line.strip()}")
                return
            else:
                # Empty line from readline means EOF?
                pass
            
            time.sleep(0.1)
            
        print("[FAIL] Timeout waiting for response")
        process.terminate()
        
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
