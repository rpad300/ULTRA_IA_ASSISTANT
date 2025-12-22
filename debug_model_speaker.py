
from pydantic import TypeAdapter
from src.backend.models.transcription import NativeMessage, SessionTurnMessage
import json

# Simulate JSON from C# (AssemblyAI payload)
# AssemblyAI sends "speaker" (snake_case)
sample_json = """
{
    "type": "Turn",
    "transcript": "Hello world",
    "speaker": "Speaker A",
    "end_of_turn": true
}
"""

print("--- Testing JSON Parsing ---")
try:
    validated = TypeAdapter(NativeMessage).validate_json(sample_json)
    if isinstance(validated, SessionTurnMessage):
        print(f"Parsed Speaker: '{validated.speaker}'")
        if validated.speaker == "Speaker A":
            print("SUCCESS: Speaker parsed correctly.")
        else:
            print("FAILURE: Speaker is None or mismatch.")
    else:
        print(f"Parsed wrong type: {type(validated)}")

except Exception as e:
    print(f"Validation Error: {e}")
