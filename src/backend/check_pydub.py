
import os
import sys
from pydub import AudioSegment

print(f"Python: {sys.version}")
try:
    from pydub.utils import which
    ffmpeg_path = which("ffmpeg")
    print(f"Pydub found ffmpeg at: {ffmpeg_path}")
    
    if ffmpeg_path:
        print("Success: ffmpeg found.")
    else:
        print("FAILURE: ffmpeg NOT found by pydub.")
        
    # Test creation
    s = AudioSegment.silent(duration=1000)
    print("Silent audio segment created.")
    
except Exception as e:
    print(f"Error checking pydub: {e}")
