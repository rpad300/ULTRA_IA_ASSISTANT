import sys
import os
import time

print("Starting debug imports...")

def time_import(module_name):
    start = time.time()
    print(f"Importing {module_name}...", end="", flush=True)
    try:
        __import__(module_name)
        print(f" Done ({time.time() - start:.2f}s)")
    except Exception as e:
        print(f" Failed: {e}")

# Base dependencies
time_import("torch")
time_import("torchaudio")

# Middleware
time_import("middleware.rate_limit_user")
time_import("middleware.request_id")

# Routers (in order of main.py)
sys.path.append(os.getcwd())

print("\n--- Routers ---")
time_import("routers.workspace")
time_import("routers.sessions")
time_import("routers.chat")
time_import("routers.chat_ws")
time_import("routers.transcription")
time_import("routers.audio_stream")
time_import("routers.native_transcription")
time_import("routers.metrics")
time_import("routers.analytics")
time_import("routers.tasks")
time_import("routers.intelligence")
time_import("routers.voice_profile")
time_import("routers.voice_optimization")
time_import("routers.knowledge")
time_import("routers.admin_ai_router")
time_import("routers.graph_router")

print("\nDebug imports complete.")
