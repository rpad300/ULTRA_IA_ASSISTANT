
import sys
import asyncio
import os

# SOTA: Enforce SelectorEventLoop on Windows to avoid Proactor/SSL hangs
# This needs to be set before any asyncio loop is created, including Uvicorn's.
if sys.platform == 'win32':
    # asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    pass

import uvicorn
from config import PORT

if __name__ == "__main__":
    # Ensure current directory is in path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    # Run Uvicorn
    # Note: reload=True works best when running via 'python -m uvicorn' but programmatic might need 'factory=True' or be careful.
    # However, uvicorn.run("main:app", ...) supports reload=True on Windows.
    # SOTA: Enable WebSocket Heartbeat (Server-Side) to prevent 40s idle timeouts
    # C# Client (WebSocket4Net) will auto-respond to these Protocol Pings
    uvicorn.run("app_main:app", host="0.0.0.0", port=PORT, reload=False, ws_ping_interval=20, ws_ping_timeout=20, timeout_keep_alive=60)
