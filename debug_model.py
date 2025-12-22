
from pydantic import TypeAdapter
from backend.models.transcription import NativeMessage, SessionTurnMessage
import json

# Sample JSON based on typical AssemblyAI/C# output
# We need to verify if 'end_of_turn' is accepted and mapped correctly.

sample_json = """
{
    "type": "Turn",
    "transcript": "Hello world",
    "isFinal": false,
    "end_of_turn": true, 
    "confidence": 0.95
}
"""

try:
    print("Testing Validation...")
    validated = TypeAdapter(NativeMessage).validate_json(sample_json)
    print(f"Validated Type: {type(validated)}")
    if isinstance(validated, SessionTurnMessage):
        print(f"Transcript: {validated.transcript}")
        print(f"Is Final (Original): {validated.is_final}")
        print(f"End of Turn: {validated.end_of_turn}")
        
        # Test Logic
        if validated.end_of_turn:
            validated.is_final = True
            
        print(f"Is Final (Computed): {validated.is_final}")
        
except Exception as e:
    print(f"Validation Error: {e}")
