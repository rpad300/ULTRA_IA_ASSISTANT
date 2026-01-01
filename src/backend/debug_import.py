import sys
import os

# Add current dir to path just like run_backend.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import app_main as main
    print(f"DEBUG: main imported from: {main.__file__}")
    
    import services.qdrant_service as qs
    print(f"DEBUG: qdrant_service imported from: {qs.__file__}")
    
    import inspect
    source = inspect.getsource(qs.get_qdrant_service_sync_wrapper)
    print(f"DEBUG: get_qdrant_service_sync_wrapper source:\n{source}")

except ImportError as e:
    print(f"DEBUG: Failed to import main: {e}")
except Exception as e:
    print(f"DEBUG: Error: {e}")
