
import asyncio
import base64
import json
import os
import websockets
import pyaudio

# Simple script to test AssemblyAI Streaming Speaker Diarization
# usage: python scripts/test_assemblyai_diarization.py

API_KEY = "68701e9de2704e44a9a484152962b9d2" 
URL = "wss://streaming.assemblyai.com/v3/ws"

async def send_receive():
    print(f"Connecting to {URL}...")
    
    params = [
        "sample_rate=16000",
        "encoding=pcm_s16le",
        "disable_partial_transcripts=False",
        "speech_model=universal-streaming-multilingual", 
        "speaker_labels=true",
        "language_detection=true",
        f"token={API_KEY}"
    ]
    
    full_url = f"{URL}?{'&'.join(params)}"
    print(f"Full URL: {full_url}")

    async with websockets.connect(full_url) as _ws:
        print("Connected. Recording audio...")
        
        # Audio Setup
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=3200
        )

        async def send():
            while True:
                try:
                    data = stream.read(3200, exception_on_overflow=False)
                    data = base64.b64encode(data).decode("utf-8")
                    json_data = json.dumps({"audio_data": str(data)})
                    await _ws.send(json_data)
                    await asyncio.sleep(0.01)
                except Exception as e:
                    print(f"Send error: {e}")
                    break

        async def receive():
            while True:
                try:
                    result_str = await _ws.recv()
                    result = json.loads(result_str)
                    
                    if result.get("message_type") == "structure_error":
                        print(f"Error: {result}")
                        continue
                        
                    if "transcript" in result and result["transcript"]:
                         speaker = result.get("speaker")
                         print(f"Transcript: {result['transcript']} | Speaker: {speaker} | Keys: {list(result.keys())}")
                         
                         if "words" in result and result["words"]:
                             print(f"  Words[0] Speaker: {result['words'][0].get('speaker')}")
                             
                except websockets.exceptions.ConnectionClosedError as e:
                    print(f"Connection closed: {e}")
                    break
                except Exception as e:
                    print(f"Receive error: {e}")
                    break
        
        await asyncio.gather(send(), receive())

if __name__ == "__main__":
    if not API_KEY:
        print("Please set API_KEY")
    else:
        asyncio.run(send_receive())
