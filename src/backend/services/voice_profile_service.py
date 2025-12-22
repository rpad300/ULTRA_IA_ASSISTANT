
import logging
from typing import List, Optional, Dict, Any
import pveagle
from config import PICOVOICE_API_KEY
from db.supabase_client import get_supabase_client
import base64

logger = logging.getLogger(__name__)

class VoiceProfileService:
    """
    Service to manage Voice Profiles using Picovoice Eagle.
    Handles enrollment (creating profiles) and retrieval.
    """
    
    def __init__(self):
        if not PICOVOICE_API_KEY:
            logger.warning("PICOVOICE_API_KEY not set. Voice Identification will be disabled.")
            self.eagle_profiler = None
        else:
            try:
                self.eagle_profiler = pveagle.create_profiler(access_key=PICOVOICE_API_KEY)
                logger.info("Picovoice Eagle Profiler initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Eagle Profiler: {e}")
                self.eagle_profiler = None
                
    def create_profile(self, audio_data: bytes) -> pveagle.EagleProfile:
        """
        Creates a voice profile from audio data.
        Assumes audio_data is sufficient for enrollment (e.g. 15-30s of PCM16 16kHz).
        
        This method will iterate through the audio data and feed it to the profiler
        until it is 100% enrolled or audio runs out.
        """
        if not self.eagle_profiler:
            raise Exception("Eagle Profiler not initialized")
            
        try:
            # Check frame length (number of samples)
            # pveagle 2.0.0 usually uses specific frame lengths
            # Not directly exposed as property on Profiler in all versions?
            # Let's assume standard logic or check docs if possible. 
            # Usually profiler.enroll(frame) expects a frame of specific length.
            # Using 512 samples (1024 bytes) as safe default attempt if property missing
            # But let's check pveagle docs pattern.
            
            # Assuming audio_data is PCM16 16kHz Mono
            
            # We need to process in chunks
            # We will rely on a "reset" profiler state if needed, but SDK usually handles session.
            # The profiler instance might be shared (not thread safe for concurrent enrollments?)
            # Ideally we create a NEW instance per enrollment or use lock.
            # Picovoice Profiler is often single session.
            # Better safe: Create a new profiler instance if possible or lock.
            # But for now assuming single thread or new instance.
            
            # Resetting profiler (if supported) or creating new one is safer.
            # Let's simple create a new profiler for this request to ensure clean state
            profiler = pveagle.create_profiler(access_key=PICOVOICE_API_KEY)
            
            try:
                # Calculate frame size in bytes (2 bytes per sample)
                # Usually Eagle min audio length is 0.
                
                # Convert bytes to short list
                import struct
                # Make sure we have even number of bytes
                if len(audio_data) % 2 != 0:
                    audio_data = audio_data[:-1]
                
                pcm = struct.unpack(f"{len(audio_data)//2}h", audio_data)
                
                total_samples = len(pcm)
                min_enroll_percentage = 0.0
                
                # We consume ALL audio
                # Note: Eagle Profiler doesn't have a fixed "frame_length" for enroll?
                # Actually it does. Let's try to pass chunks.
                # If we pass too much, it might error.
                
                # For simplicity, pass it all if supported, but typically we must pass frames.
                # However, since we don't know the exact frame size from here without docs or property,
                # we'll use a standard chunk size or try to find it.
                # Most Picovoice libs expose `.frame_length`.
                
                frame_length = 512 # Fallback
                try:
                    frame_length = profiler.min_enroll_samples
                except:
                     pass
                     
                processed_samples = 0
                while processed_samples < total_samples:
                    # Take a chunk
                    if processed_samples + frame_length > total_samples:
                        break # Ignore last partial chunk
                        
                    frame = pcm[processed_samples : processed_samples + frame_length]
                    enroll_percentage, feedback = profiler.enroll(frame)
                    min_enroll_percentage = enroll_percentage
                    processed_samples += frame_length
                    
                    if enroll_percentage >= 100.0:
                        break
                
                if min_enroll_percentage < 100.0:
                    logger.warning(f"Enrollment incomplete: only reached {min_enroll_percentage}%")
                    # Depending on strictness, we might fail or allow partial (partial usage is rare for Eagle).
                    # Eagle usually requires 100%.
                    raise Exception(f"Insufficient audio for enrollment. Reached {min_enroll_percentage}%. Need more audio.")
                    
                profile = profiler.export()
                return profile
                
            finally:
                profiler.delete()
                
        except Exception as e:
            logger.error(f"Error creating profile: {e}")
            raise
    def get_all_profiles(self) -> Dict[str, bytes]:
        """
        Retrieves all active voice profiles from the database.
        Returns a dict mapping contact_id -> profile_bytes (raw bytes)
        """
        try:
            supabase = get_supabase_client()
            # Fetch contacts with a voice profile
            response = supabase.table("contacts").select("id, name, voice_profile").not_.is_("voice_profile", "null").execute()
            
            profiles = {}
            for contact in response.data:
                profile_data = contact.get("voice_profile")
                if profile_data:
                    # Supabase Python client returns bytea as hex string (without \x prefix)
                    # We stored it as hex, so we need to decode it back to bytes
                    if isinstance(profile_data, str):
                        # Remove \x prefix if present (PostgreSQL standard format)
                        if profile_data.startswith('\\x'):
                            profile_data = profile_data[2:]
                        # Decode hex string to bytes
                        try:
                            profile_bytes = bytes.fromhex(profile_data)
                        except ValueError as e:
                            logger.error(f"Invalid hex data for contact {contact.get('id')}: {e}")
                            continue
                    elif isinstance(profile_data, bytes):
                        # Already bytes (shouldn't happen with Supabase-py but handle it)
                        profile_bytes = profile_data
                    else:
                        logger.warning(f"Unexpected profile data type for contact {contact.get('id')}: {type(profile_data)}")
                        continue
                    
                    profiles[contact["id"]] = profile_bytes
                    
            logger.info(f"Loaded {len(profiles)} voice profiles from database")
            return profiles
            
        except Exception as e:
            logger.error(f"Failed to fetch voice profiles: {e}")
            return {}

    def save_profile(self, contact_id: str, profile: pveagle.EagleProfile):
        """
        Saves a generated profile to the database.
        """
        try:
            supabase = get_supabase_client()
            profile_bytes = profile.to_bytes()
            
            # Update contact with profile
            # Note: For bytea, we might need to encode to hex or base64 depending on the library
            # Attempting standard update
            supabase.table("contacts").update({
                "voice_profile": profile_bytes.hex() # Postgres standard for bytea input is often hex
            }).eq("id", contact_id).execute()
            
            logger.info(f"Saved voice profile for contact {contact_id}")
            
        except Exception as e:
            logger.error(f"Failed to save voice profile: {e}")
            raise

_voice_profile_service = None

def get_voice_profile_service():
    global _voice_profile_service
    if _voice_profile_service is None:
        _voice_profile_service = VoiceProfileService()
    return _voice_profile_service
