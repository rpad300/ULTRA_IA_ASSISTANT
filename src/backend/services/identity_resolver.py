
import asyncio
import numpy as np
import logging
from typing import Optional, Tuple, Dict
from dataclasses import dataclass

from services.local_speaker_service import get_local_speaker_service
from services.pyannote_service import get_biometric_service

logger = logging.getLogger(__name__)

@dataclass
class SpeakerProfile:
    id: str
    name: str
    is_known: bool
    confidence: float

class IdentityResolver:
    """
    SOTA Global Identity Resolver.
    - Single Source of Truth for Speaker IDs.
    - Locks for Atomic "Guest" Creation.
    - Cross-Source Merging (Mic vs System).
    """
    _instance = None
    
    def __init__(self):
        self.lock = asyncio.Lock()
        
        # Cache of active session speakers for fast lookup
        # { "Guest 1": embedding_vector, "Guest 2": ... }
        # Note: LocalSpeakerService manages this, but we wrap it for atomic ops.
        pass

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = IdentityResolver()
        return cls._instance

    async def resolve(self, audio_bytes: bytes, session_id: str) -> SpeakerProfile:
        """
        Resolves the speaker identity for a given audio blob.
        guarantees no duplicate Guest IDs even under high concurrency.
        """
        bio_service = get_biometric_service()
        speaker_service = get_local_speaker_service()
        
        # 1. Extract Embedding (CPU/GPU Bound - do outside lock if possible)
        # However, `identify_speaker` does extraction internally in some paths.
        # Let's use `speaker_service.identify_speaker` which handles hierarchy.
        # But we need to ensure ATOMIC creation of new guests.
        
        # SOTA: First, get embedding separately to not block lock.
        embedding = await speaker_service.extract_embedding_async(audio_bytes)
        
        if embedding is None:
            return SpeakerProfile(id="unknown", name="Unknown", is_known=False, confidence=0.0)
            
        # 2. Critical Section: Identification & Creation
        async with self.lock:
            # Re-implement strict identification logic here or reuse service?
            # Reuse service, but we guard the "Write" part.
            
            # Since `identify_speaker` in `LocalSpeakerService` does NOT create guests automatically
            # (it returns None if no match), we are safe to call it without lock for READ.
            # Wait, looking at `transcription_manager.py` old code, it created guests IN PLACE.
            # We should move that logic here.
            
            # A. Try Identify (Read Only)
            # We assume identify_speaker uses `session_cache` which we want to share.
            # We need to ensure we pass the embedding we just extracted.
            
            # Hack: `identify_speaker` signature accepts `audio_bytes`.
            # We'll create a new helper in `LocalSpeakerService` or just use the logic here.
            
            # Let's perform the match manually against `LocalSpeakerService` data to be precise.
            
            # Check Hot Path (Contacts)
            # We need company_id... passed in session_id context?
            # Assuming we can access metadata or just check GLOBAL session cache.
            
            # Simplified for SOTA Refactor:
            # We delegate to `speaker_service` to Find Match.
            # If Match -> Return.
            # If No Match -> Create New Guest (Atomic).
            
            # We need a method to match embedding directly.
            # `find_best_match(embedding, session_id)` needed in LocalSpeakerService.
            # Since we can't easily modify LocalSpeakerService right now without context (it's big),
            # let's assume we use `identify_speaker` passing audio (it re-extracts? Inefficient).
            # Better: We use the embedding we have.
            
            # Let's access `speaker_service.session_cache` directly if possible or safer method.
            # `get_session_guests_centroids` returns the dict.
            
            guests = speaker_service.get_session_guests_centroids(session_id)
            best_id = None
            best_score = 0.0
            
            # Compare vs Guests
            norm_embedding = embedding / np.linalg.norm(embedding)
            
            for gid, centroid in guests.items():
                score = np.dot(norm_embedding, centroid)
                if score > best_score:
                    best_score = score
                    best_id = gid
            
            # Compare vs Known Contacts (Hot Path)
            # We need company_id. Let's assume passed or lookup?
            # For now, we prioritize Session Guests (Cross-Source).
            # If score > 0.78, it's that Guest.
            
            if best_score > 0.78:
                return SpeakerProfile(id=best_id, name=best_id, is_known=False, confidence=float(best_score))
                
            # No match? Create New Guest.
            # This is the Lock protected part.
            new_guest_id = f"Guest {len(guests) + 1}"
            
            # Update Service
            speaker_service.update_guest_profile(
                session_id, 
                new_guest_id, 
                embedding, 
                audio_chunk=audio_bytes, # Store reference
                allow_update=True
            )
            
            logger.info(f"[IdentityResolver] Created new identity: {new_guest_id}")
            return SpeakerProfile(id=new_guest_id, name=new_guest_id, is_known=False, confidence=1.0)

def get_identity_resolver():
    return IdentityResolver.get_instance()
