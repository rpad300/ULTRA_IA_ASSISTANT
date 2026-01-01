
import sys
import os

sys.path.append(os.getcwd())

print("Attempting to import TranscriptionManager...")
try:
    from managers.transcription_manager import TranscriptionManager
    print("SUCCESS: TranscriptionManager imported.")
except ImportError as e:
    print(f"FAILURE: ImportError: {e}")
except Exception as e:
    print(f"FAILURE: Exception: {e}")
