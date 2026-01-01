
import os
import subprocess
import sys
from dotenv import load_dotenv

def main():
    # Load variables from .env in the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, ".env")
    load_dotenv(dotenv_path=env_path)

    qdrant_url = os.getenv("QDRANT_URL")
    qdrant_key = os.getenv("QDRANT_API_KEY")

    if not qdrant_url:
        print("[ERROR] QDRANT_URL not found in .env", file=sys.stderr)
        print("Please ensure you are running this script from the backend directory with a valid .env file.", file=sys.stderr)
        sys.exit(1)

    print("========================================", file=sys.stderr)
    print("  Qdrant MCP Server Launcher", file=sys.stderr)
    print("========================================", file=sys.stderr)
    print(f"Target URL: {qdrant_url}", file=sys.stderr)
    print(f"API Key:    {'******' if qdrant_key else 'None'}", file=sys.stderr)
    print("========================================", file=sys.stderr)

    # Inject known Collection Name if not present
    if not os.environ.get("COLLECTION_NAME"):
        print("[INFO] Defaulting COLLECTION_NAME to 'ultra_knowledge_base'", file=sys.stderr)
        os.environ["COLLECTION_NAME"] = "ultra_knowledge_base"

    # Force unbuffered output to see logs immediately
    os.environ["PYTHONUNBUFFERED"] = "1"

    try:
        # Run in-process to avoid subprocess pipe issues
        print("[INFO] Starting server in-process...", file=sys.stderr)
        
        # We need to simulate command line arguments or call the internal run method
        # Reading main.py: it parses args and calls mcp.run(transport=args.transport)
        
        from mcp_server_qdrant.server import mcp
        
        # Run stdio transport directly
        # async run is typical for mcp
        import asyncio
        
        print("[INFO] Server ready. Listening on stdio.", file=sys.stderr)
        
        # mcp.run() might be sync or async depending on implementation
        # Looking at previous dumps, it called mcp.run(transport=...) which is likely higher level default
        # But let's check if we can just import and run.
        
        # We need to ensure we don't hold the lock on import if main.py does logic.
        # But mcp_server_qdrant/main.py was simple.
        
        # Let's verify if mcp.run blocks.
        # It usually does.
        mcp.run(transport="stdio")
            
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped by user.", file=sys.stderr)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

if __name__ == "__main__":
    main()
