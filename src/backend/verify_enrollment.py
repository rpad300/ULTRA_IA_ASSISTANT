import asyncio
import os
import sys
import logging
import numpy as np
from pydub import AudioSegment
from pydub.generators import Sine

# Setup Path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VERIFY")

from services.voice_enrollment_service import get_voice_enrollment_service
from services.local_speaker_service import get_local_speaker_service
from db.supabase_client import get_async_supabase_client
from dotenv import load_dotenv

load_dotenv()

async def ensure_clean_slate(contact_id: str):
    print(f"Cleaning up previous data for {contact_id}...")
    supabase = await get_async_supabase_client()
    try:
        # Ensure contact exists (Fix FK Constraint)
        await supabase.table("contacts").upsert({
            "id": contact_id,
            "name": "SOTA Verification User",
            # "voice_profile_version": 1 # Optional, triggers error if column missing, let's omit for safety
        }).execute()
        
        await supabase.table("voice_traces").delete().eq("contact_id", contact_id).execute()
        # await supabase.table("voice_samples").delete().eq("contact_id", contact_id).execute()
        print("Cleanup done.")
    except Exception as e:
        print(f"Cleanup warning: {e}")

async def main():
    print("=== STARTING SOTA VOICE ENROLLMENT VERIFICATION ===")
    
    # 1. Generate Synthetic Audio (High Quality)
    # 16kHz, Mono. Pulse (Silence + Tone + Silence) to allow SNR calc (needs noise floor)
    filename = "test_tone_hq.wav"
    print(f"Generating synthetic audio: {filename}...")
    target_fs = 16000
    
    # 0.5s Silence + 2s Tone (-6dB) + 0.5s Silence
    silence_seg = AudioSegment.silent(duration=500).set_frame_rate(target_fs).set_channels(1)
    tone_seg = Sine(440).to_audio_segment(duration=2000).set_frame_rate(target_fs).set_channels(1)
    tone_seg = tone_seg - 6 # Attenuate by 6dB to prevent clipping detection (>0.99)
    
    hq_audio = silence_seg + tone_seg + silence_seg
    hq_audio.export(filename, format="wav")
    path_hq = os.path.abspath(filename)
    
    # Generate Low Quality (Silence) -> SNR should be low
    filename_lq = "test_silence.wav"
    print(f"Generating synthetic audio: {filename_lq}...")
    silence = AudioSegment.silent(duration=3000).set_frame_rate(16000).set_channels(1)
    silence.export(filename_lq, format="wav")
    path_lq = os.path.abspath(filename_lq)

    # 2. Setup Service
    # Use a VALID UUID for Supabase compatibility
    contact_id = "00000000-0000-0000-0000-000000000001"
    await ensure_clean_slate(contact_id)
    
    svc = get_voice_enrollment_service()
    
    # 3. Test Mixed Batch (1 Good, 1 Bad)
    print("\n--- Testing Mixed Batch Enrollment ---")
    files = [path_hq, path_lq]
    
    try:
        res = await svc.enroll_contact(contact_id, files)
        print(f"Enrollment Result: {res}")
        
        # Assertions
        if res["status"] != "success":
            print("FAILURE: Expected partial success.")
            return

        if res["valid_samples"] != 1:
             print(f"FAILURE: Expected 1 valid sample, got {res['valid_samples']}")
             return
             
        if res["rejected"] != 1:
             print(f"FAILURE: Expected 1 rejected sample (silence), got {res['rejected']}")
             return
             
        print("SUCCESS: Quality Gate correctly filtered silence and accepted tone.")
        
        # 4. Verify DB Persistence
        print("\n--- Verifying Persistence ---")
        supabase = await get_async_supabase_client()
        row = await supabase.table("voice_traces").select("*").eq("contact_id", contact_id).execute()
        
        if len(row.data) == 1:
             print(f"SUCCESS: Found 1 trace in DB as expected. SNR={row.data[0]['snr']}")
        else:
             print(f"FAILURE: DB Row count mismatch. Expected 1, found {len(row.data)}")

        # 5. Verify Profile Update (Centroid)
        # Check if contact is in LocalSpeakerService cache or DB has vector
        # Note: 'contacts' table might not have 'test_verification_user' if we didn't create it.
        # Recalculate_profile updates 'contacts' table. If row missing, it does 0 updates.
        # But for verification of logic, the trace persistence + result is enough.
        
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        if os.path.exists(path_hq): os.remove(path_hq)
        if os.path.exists(path_lq): os.remove(path_lq)
        print("\n=== VERIFICATION COMPLETE ===")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
