
import os
import logging
import asyncio
import numpy as np
import uuid
import json
import math
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Tuple, Optional, List

from db.supabase_client import get_supabase_client, get_async_supabase_client
from services.pyannote_service import get_biometric_service

logger = logging.getLogger(__name__)

class LocalSpeakerService:
    _instance = None
    
    def __init__(self):
        # Hybrid Search: "Hot Path" Memory Index
        # Structure: { company_id: { contact_id: np.array(512d) } }
        self.vector_index: Dict[str, Dict[str, np.ndarray]] = {} 
        
        # Concurrency: Async Locks for Centroid Updates (prevent race conditions)
        self._locks: Dict[str, asyncio.Lock] = {}
        
        # Offloading: ThreadPool for CPU-bound tasks (Embedding Extraction, SNR)
        self._executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="BiometricWorker")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = LocalSpeakerService()
        return cls._instance

    # --- SOTA: Phase 1 - Vector Intelligence & Session Memory ---

    def create_session_speaker_cache(self):
        """
        Initialize the SessionSpeakerCache pattern.
        Structure: { session_id: { guest_id: { 'centroid': np.array, 'count': int, 'last_seen': timestamp } } }
        """
        # Using a simple dict for now, but architecturally ready for Redis/HNSW
        self.session_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def get_session_guest_profile(self, session_id: str, guest_id: str) -> Optional[Dict]:
        """Retrieve a specific guest profile from session cache."""
        if not hasattr(self, 'session_cache'):
            self.create_session_speaker_cache()
            
        return self.session_cache.get(session_id, {}).get(guest_id)

    def update_guest_profile(self, session_id: str, guest_id: str, embedding: np.ndarray, audio_chunk: bytes = None, allow_update: bool = True):
        """
        SOTA: Incremental Centroid Update.
        C_n = C_{n-1} + (E_n - C_{n-1}) / n
        
        allow_update: If False (e.g., Overlap > 0.5), we skip the centroid learning 
                      but still add to buffer if needed (or skip entirely).
                      Prompt says "impede a atualização do centroide".
        """
        if not hasattr(self, 'session_cache'):
            self.create_session_speaker_cache()

        if session_id not in self.session_cache:
            self.session_cache[session_id] = {}

        # Initialize if new
        if guest_id not in self.session_cache[session_id]:
            self.session_cache[session_id][guest_id] = {
                'centroid': embedding,
                'count': 1,
                'last_seen': datetime.now().timestamp(),
                'buffer': [embedding], # Keep recent for pivot
                'last_audio': audio_chunk # SOTA: Keep raw audio for verification/upload
            }
            return

        profile = self.session_cache[session_id][guest_id]
        
        # 1. Incremental Update (ONLY IF CLEAN)
        if allow_update:
            n = profile['count'] + 1
            current_centroid = profile['centroid']
            
            # Formula: NewAvg = OldAvg + (NewVal - OldAvg) / NewCount
            new_centroid = current_centroid + (embedding - current_centroid) / n
            
            # Normalize immediately to keep it on the hypersphere
            norm = np.linalg.norm(new_centroid)
            if norm > 1e-9:
                new_centroid = new_centroid / norm
                
            # 2. Update Profile
            profile['centroid'] = new_centroid
            profile['count'] = n
        else:
             logger.debug(f"Skipping centroid update for Guest {guest_id} (Overlap/Dirty).")

        profile['last_seen'] = datetime.now().timestamp()
        if audio_chunk:
            profile['last_audio'] = audio_chunk
        
        # Maintain Sliding Window Buffer (Top 50 recent?)
        # Should we buffer dirty samples? Usually no.
        if allow_update:
            if 'buffer' not in profile: profile['buffer'] = []
            profile['buffer'].append(embedding)
            if len(profile['buffer']) > 50:
                profile['buffer'].pop(0)

    def get_session_guests_centroids(self, session_id: str) -> Dict[str, np.ndarray]:
        """Returns map of GuestID -> Centroid for matching."""
        if not hasattr(self, 'session_cache'): return {}
        
        guests = self.session_cache.get(session_id, {})
        return {gid: data['centroid'] for gid, data in guests.items()}

    async def close_session(self, session_id: str):
        """SOTA: Explicit cleanup to prevent memory leaks."""
        if hasattr(self, 'session_cache') and session_id in self.session_cache:
            del self.session_cache[session_id]
            logger.info(f"Session {session_id} cleaned from biometric cache.")

    # --- SOTA: Signal Processing (CPU Bound) ---

    def _calculate_quality_metrics(self, audio_bytes: bytes) -> dict:
        """
        Calculates SOTA Quality Metrics:
        - SNR (Signal-to-Noise Ratio)
        - Clipping Score
        - RMS (Volume)
        """
        try:
            # Convert to numpy (assuming 16-bit PCM)
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            current_float = audio_int16.astype(np.float32) / 32768.0
            
            # 1. Clipping Detection
            # Ratio of samples near max amplitude (>0.99)
            clipped_samples = np.sum(np.abs(current_float) > 0.99)
            clipping_score = clipped_samples / len(current_float)
            
            # 2. RMS (Root Mean Square) -> Signal Power
            signal_power = np.mean(current_float**2)
            if signal_power < 1e-9:
                return {"snr": 0.0, "clipping": 0.0, "rms": 0.0, "valid": False}
                
            # 3. SNR Estimate (Simple Heuristic for Real-time)
            # Assume lowest 10% energy frames are "noise floor"
            # Split into frames (e.g., 30ms)
            frame_size = 480 # 30ms at 16k
            if len(current_float) > frame_size:
                # Truncate to multiple of frame_size
                n_frames = len(current_float) // frame_size
                frames = current_float[:n_frames*frame_size].reshape(-1, frame_size)
                frame_energies = np.mean(frames**2, axis=1)
                
                # Sort energies
                sorted_energies = np.sort(frame_energies)
                noise_floor = np.mean(sorted_energies[:max(1, int(len(sorted_energies)*0.1))])
                
                if noise_floor < 1e-9: noise_floor = 1e-9
                
                snr_linear = signal_power / noise_floor
                snr_db = 10 * np.log10(snr_linear)
            else:
                snr_db = 0.0
                
            # 4. Overlap Detection (SOTA Anti-Spoofing)
            # Check for multiple simultaneous speakers
            bio_service = get_biometric_service()
            has_overlap = bio_service.detect_overlap(audio_bytes)
            
            # Strict Gate: fast fail on overlap
            is_valid = (snr_db > 15.0) and (clipping_score < 0.05) and (len(audio_bytes) > 8000) and (not has_overlap)
            
            return {
                "snr": float(snr_db),
                "clipping": float(clipping_score),
                "rms": float(math.sqrt(signal_power)),
                "overlap": has_overlap,
                "valid": is_valid
            }
            
        except Exception as e:
            logger.error(f"Metric calculation failed: {e}")
            return {"snr": 0.0, "clipping": 0.0, "rms": 0.0, "valid": False}

    async def extract_embedding_async(self, audio_bytes: bytes):
        """Wrapper to run blocking extraction in ThreadPool."""
        loop = asyncio.get_running_loop()
        bio_service = get_biometric_service()
        return await loop.run_in_executor(self._executor, bio_service.extract_embedding, audio_bytes)

    def extract_embedding(self, audio_bytes: bytes):
        """Blocking extraction for synchronous contexts."""
        bio_service = get_biometric_service()
        return bio_service.extract_embedding(audio_bytes)
        
    async def calculate_metrics_async(self, audio_bytes: bytes):
        """Wrapper to run blocking metrics in ThreadPool."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, self._calculate_quality_metrics, audio_bytes)

    # --- SOTA: Persistence & Active Learning ---

    async def cache_embedding(self, trace_id: str, embedding: np.ndarray, audio_bytes: bytes = None):
        """
        Industrial Strength Caching:
        - Calculates Telemetry (SNR, Clipping)
        - Persists to 'voice_traces' with metrics
        """
        try:
            # Calculate metrics
            metrics = {"snr": 0.0, "clipping": 0.0, "valid": True}
            duration_ms = 0
            
            if audio_bytes:
                metrics = await self.calculate_metrics_async(audio_bytes)
                duration_ms = int((len(audio_bytes) / 2 / 16000) * 1000)
                
                # Log rejection but STILL SAVE for debugging/audit (marked valid=False effectively by low quality_score)
                if not metrics["valid"]:
                    logger.debug(f"Low quality trace {trace_id}: SNR={metrics['snr']:.1f}dB")

            supabase = await get_async_supabase_client()
            
            # SOTA: Save with Telemetry
            data = {
                "trace_id": trace_id,
                "embedding": embedding.tolist(),
                "quality_score": metrics["snr"], # Map SNR to quality score for sorting
                "snr": metrics["snr"],
                "clipping_score": metrics["clipping"],
                "duration_ms": duration_ms,
                "is_processed": False
            }
            
            await supabase.table("voice_traces").insert(data).execute()
            
        except Exception as e:
            logger.error(f"Failed to cache trace {trace_id}: {e}")

    async def get_cached_trace(self, trace_id: str):
        """Retrieves embedding from 'voice_traces'."""
        try:
             supabase = await get_async_supabase_client()
             res = await supabase.table("voice_traces")\
                 .select("embedding")\
                 .eq("trace_id", trace_id)\
                 .single()\
                 .execute()
                 
             if res.data:
                 emb = np.array(json.loads(str(res.data['embedding'])))
                 return emb
             return None
        except Exception as e:
             logger.warning(f"Trace lookup failed {trace_id}: {e}")
             return None

    # --- SOTA: Reference Data Management (Cache Updates) ---

    async def refresh_contact_in_cache(self, contact_data: dict):
        """
        Cold/Warm Path Sync: 
        Called when a contact is updated (e.g. name change) to update the Hot Memory Index.
        """
        try:
            contact_id = contact_data.get("id")
            company_id = contact_data.get("company_id")
            voice_vector = contact_data.get("voice_vector")
            
            # If we don't track this company yet, ignore or load?
            # If voice_vector is present, we update it.
            # Usually update_contact modifies name, email etc. 
            # If voice_vector is NOT in update, we just want to ensure name is consistent if we cached names.
            # Currently our index is {company_id: {contact_id: vector}}
            # So name changes don't affect vector matching directly, 
            # BUT if we start caching names for speed, we need this.
            # Also, if voice_vector WAS updated (re-enrollment), we update it here.
            
            if company_id and company_id in self.vector_index:
                if voice_vector:
                     # Parse and update
                    if isinstance(voice_vector, str):
                        vec = np.array(json.loads(voice_vector))
                    else:
                        vec = np.array(voice_vector)
                    
                    norm = np.linalg.norm(vec)
                    if norm > 1e-5:
                        vec = vec / norm
                        self.vector_index[company_id][contact_id] = vec
                        logger.info(f"Refreshed vector for {contact_id} in memory.")
                
            # Future: If we maintain self.name_cache or similar, update it here.
            
        except Exception as e:
            logger.error(f"Failed to refresh contact cache: {e}")

    # --- SOTA: Hybrid Search & Index Management ---

    async def load_company_context(self, company_id: str):
        """
        Smart Warm-up: Loads company's contacts into Memory Index.
        Called on Session Start.
        """
        if not company_id: return
        
        try:
            logger.info(f"Warming up voice index for company {company_id}...")
            supabase = await get_async_supabase_client()
            
            # Fetch all contacts with voice vectors
            res = await supabase.table("contacts")\
                .select("id, name, voice_vector")\
                .eq("company_id", company_id)\
                .not_.is_("voice_vector", "null")\
                .execute()
                
            if company_id not in self.vector_index:
                self.vector_index[company_id] = {}
                
            count = 0
            for row in res.data:
                vec_data = row.get("voice_vector")
                if vec_data:
                    if isinstance(vec_data, str):
                        vec = np.array(json.loads(vec_data))
                    else:
                        vec = np.array(vec_data)
                    
                    # Normalize for Dot Product
                    norm = np.linalg.norm(vec)
                    if norm > 1e-5:
                        vec = vec / norm
                        
                    self.vector_index[company_id][row["id"]] = vec
                    count += 1
            
            logger.info(f"Loaded {count} voice profiles into Hot Path for {company_id}.")
            
        except Exception as e:
            logger.error(f"Failed to warm up index: {e}")

    async def identify_speaker(self, audio_bytes: bytes, company_id: str = None) -> Tuple[Optional[str], str, float, Optional[np.ndarray]]:
        """
        Hybrid Search:
        1. Extract Embedding (Async/Offloaded)
        2. Hot Path: Check Local In-Memory Index (if company_id provided)
        3. Cold Path: Fallback to pgvector RPC (if enabled/needed)
        """
        # 1. Extract
        embedding = await self.extract_embedding_async(audio_bytes)
        if embedding is None:
            return None, "Unknown", 0.0, None
            
        # Normalize Query
        norm = np.linalg.norm(embedding)
        if norm > 1e-5:
            embedding_norm = embedding / norm
        else:
            return None, "Unknown", 0.0, embedding

        best_id = None
        best_name = "Unknown"
        best_score = 0.0

        # 2. Hot Path (Local Index)
        if company_id and company_id in self.vector_index:
            company_index = self.vector_index[company_id]
            for contact_id, contact_vec in company_index.items():
                score = np.dot(embedding_norm, contact_vec)
                if score > best_score:
                    best_score = score
                    best_id = contact_id
                    best_name = "Contact" # Would fetch real name if available

        # 3. Session Path (Guests)
        # Check against ephemeral guests in the current session
        # We need session_id for this. If not provided, we skip?
        # The prompt implies "Session Cache: Comparação contra 'Guests' criados nesta sessão."
        # identify_speaker signature might need session_id, or we infer it?
        # For now, if we don't have session_id, we can't check session cache easily unless we check ALL sessions (expensive).
        # Assuming caller might update signature or we skip.
        # But wait, we can try to find valid guests if we had a "context". 
        # Since signature is (audio_bytes, company_id), we lack session_id.
        # However, checking ALL active sessions' guests might be acceptable if N is small.
        # Let's check self.session_cache if it exists.
        
        if hasattr(self, 'session_cache') and self.session_cache:
            for s_id, guests in self.session_cache.items():
                for guest_id, profile in guests.items():
                    guest_vec = profile['centroid']
                    score = np.dot(embedding_norm, guest_vec)
                    # Bias towards known contacts? Or strict winner takes all?
                    # Usually contacts > guests if score is similar.
                    if score > best_score:
                         best_score = score
                         best_id = guest_id
                         best_name = "Guest"

        # Threshold Check
        if best_score > 0.6:
            return best_id, best_name, float(best_score), embedding

        # 4. Fallback Path (DB RPC)
        # If Hot Path failed, check the vault
        if company_id:
             try:
                 rpc_best_id, rpc_score = await self._search_db_vector(embedding_norm, company_id)
                 if rpc_score > best_score and rpc_score > 0.6:
                     return rpc_best_id, "Contact (Cold)", float(rpc_score), embedding
             except Exception as e:
                 logger.warning(f"DB Vector Search failed: {e}")

        logger.debug(f"[SpeakerID] No match found. Best score: {best_score:.2f}. Return Unknown.")
        return None, "Unknown", 0.0, embedding

    async def _search_db_vector(self, embedding: np.ndarray, company_id: str) -> Tuple[Optional[str], float]:
        """
        Executes a pgvector match via Supabase RPC.
        Requires function `match_voice_profiles` in DB.
        """
        supabase = await get_async_supabase_client()
        try:
             # Assume we have an RPC function 'match_voice_profiles'
             # args: query_embedding, match_threshold, match_count, filter_company
             params = {
                 "query_embedding": embedding.tolist(),
                 "match_threshold": 0.6,
                 "match_count": 1,
                 "filter_company": company_id
             }
             res = await supabase.rpc("match_voice_profiles", params).execute()
             if res.data and len(res.data) > 0:
                 match = res.data[0]
                 return match['id'], match['similarity']
        except Exception as e:
            # RPC might not exist, fail silently or log
            logger.warning(f"RPC match_voice_profiles error: {e}")
        return None, 0.0


    # --- SOTA: Centroid Evolution & Concurrency ---

    async def assign_speaker_trace(self, trace_id: str, contact_id: str):
        """
        SOTA Assignment:
        - Uses Async Lock per contact.
        - Updates trace with contact_id.
        - Calculates True Centroid from Top 10 High Quality traces.
        """
        # Ensure lock exists
        if contact_id not in self._locks:
            self._locks[contact_id] = asyncio.Lock()
            
        async with self._locks[contact_id]:
            logger.info(f"Acquired lock for contact {contact_id}. Starting optimization...")
            supabase = await get_async_supabase_client()
            
            try:
                # 1. Update trace linkage & Mark processed
                # This officially assigns the trace to the contact history
                await supabase.table("voice_traces").update({
                    "contact_id": contact_id,
                    "is_processed": True
                }).eq("trace_id", trace_id).execute()

                # Call the reusable recalculation logic
                return await self.recalculate_profile(contact_id, supabase_client=supabase)
                
            except Exception as e:
                logger.error(f"Assignment failed: {e}")
                raise

    async def recalculate_profile(self, contact_id: str, supabase_client=None) -> bool:
        """
        SOTA: Recalculates the speaker's biometric profile (Centroid)
        based on the Top 10 highest quality traces in history.
        Designed to be called after Batch Import or Single Assignment.
        """
        # Lock should be held by caller if calling externally, or we enforce it here?
        # Ideally caller handles lock if doing sequence. 
        # But for safety, we can check locked state or re-acquire?
        # Re-entrant locks in asyncio are tricky. 
        # Let's assume if this is internal it's fine. 
        # If public, we should wrap in lock.
        
        # We'll make it "Lock-safe" by checking if we hold it, or acquiring it.
        # Simple approach: This method does the Logic. The caller (assign_speaker) holds the lock.
        # If called from VoiceEnrollmentService, it should acquire lock.
        
        supabase = supabase_client or await get_async_supabase_client()
        
        try:
            # 2. Fetch Top N Best Traces (True Centroid Source)
            # Fetch created_at for time-decay and SNR for weighting
            res = await supabase.table("voice_traces")\
                .select("embedding, created_at, snr")\
                .eq("contact_id", contact_id)\
                .order("quality_score", desc=True)\
                .order("duration_ms", desc=True)\
                .limit(10)\
                .execute()
            
            embeddings_data = res.data
            if not embeddings_data:
                logger.warning(f"No traces found for {contact_id} during recalculation.")
                return False

            # 3. Calculate Weighted Centroid (Time-Decay + SNR Legacy)
            vectors = []
            weights = []
            now = datetime.now(datetime.timezone.utc) if datetime.now().tzinfo else datetime.utcnow()

            for row in embeddings_data:
                vec_raw = row['embedding']
                if isinstance(vec_raw, str):
                    emb = np.array(json.loads(vec_raw))
                else:
                    emb = np.array(vec_raw)
                
                vectors.append(emb)
                
                # Weight Calculation: 1 / (1 + days_old)
                # Recent = Higher Weight
                created_at_str = row.get("created_at")
                weight = 1.0
                
                if created_at_str:
                    try:
                        # Parse ISO format (Supabase returns ISO 8601)
                        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        if created_at.tzinfo is None:
                             created_at = created_at.replace(tzinfo=None)
                             diff = datetime.utcnow() - created_at
                        else:
                             diff = datetime.now(created_at.tzinfo) - created_at
                             
                        days_old = max(0, diff.days)
                        weight = 1.0 / (1.0 + days_old * 0.1) # Soft decay factor
                    except Exception as e:
                        logger.warning(f"Date parse failed: {e}. Defaulting weight 1.0")
                        weight = 1.0
                
                # SOTA: High Priority for Clean Audio (SNR > 20dB)
                snr = row.get("snr", 0.0)
                if snr > 20.0:
                    weight *= 2.0
                
                weights.append(weight)
            
            if len(vectors) == 0: return False

            # Weighted Mean
            matrix = np.array(vectors) # (N, 512)
            w_arr = np.array(weights).reshape(-1, 1) # (N, 1)
            
            # Normalize weights to sum to 1? Or just sum(w*v) / sum(w)
            # Weighted Centroid = Sum(w_i * v_i) / Sum(w_i)
            weighted_sum = np.sum(matrix * w_arr, axis=0) # (512,)
            total_weight = np.sum(w_arr)
            
            centroid = weighted_sum / total_weight
            
            # 4. Strict Normalization
            norm = np.linalg.norm(centroid)
            if norm > 1e-9:
                final_vector = centroid / norm
            else:
                final_vector = centroid

            # 5. Update Contact Profile (Atomic + Versioning)
            # Graceful Degradation: If voice_profile_version column missing, update only vector.
            try:
                # Ideally we'd use RPC `update_voice_profile` but we are doing client-side logic.
                # Let's select current version first.
                ver_res = await supabase.table("contacts").select("voice_profile_version, company_id").eq("id", contact_id).single().execute()
                current_ver = ver_res.data.get("voice_profile_version", 0) if ver_res.data else 0
                contact_company_id = ver_res.data.get("company_id") if ver_res.data else None
                
                if current_ver is None: current_ver = 0
                new_ver = current_ver + 1

                await supabase.table("contacts").update({
                    "voice_vector": final_vector.tolist(),
                    "voice_profile_version": new_ver,
                    # "voice_profile_updated_at": "now()" # managed by db usually
                }).eq("id", contact_id).execute()
                
                logger.info(f"Voice profile updated for {contact_id}: Version {new_ver} (Centroid of {len(vectors)} best traces).")

            except Exception as e_ver:
                logger.warning(f"Versioning update failed (Old Schema?): {e_ver}. Falling back to basic update.")
                # Fallback: Update only vector
                await supabase.table("contacts").update({
                    "voice_vector": final_vector.tolist()
                }).eq("id", contact_id).execute()
                
                # Try to fetch company_id again if failed above
                try:
                    c_res = await supabase.table("contacts").select("company_id").eq("id", contact_id).single().execute()
                    contact_company_id = c_res.data.get("company_id")
                except:
                    contact_company_id = None

                logger.info(f"Voice profile updated for {contact_id} (Centroid of {len(vectors)} best traces) - NO VERSIONING.")
            
            # 6. Update Local Index (Hot Path)
            # SOTA Fix: Upsert logic. If company_id is known, add it even if new.
            if contact_company_id:
                if contact_company_id not in self.vector_index:
                    self.vector_index[contact_company_id] = {}
                self.vector_index[contact_company_id][contact_id] = final_vector
                logger.info(f"Hot-loaded voice profile for {contact_id} into index for company {contact_company_id}")
            else:
                 # Iterate to find if it exists (legacy update)
                for comp_id, idx in self.vector_index.items():
                    if contact_id in idx:
                        idx[contact_id] = final_vector
                    
            return True
        except Exception as e:
            logger.error(f"Recalculation failed: {e}")
            raise

    # --- SOTA: Eagle Biometrics Integration ---
    
    def initialize_eagle(self, access_key: str):
        """Initializes Eagle Profiler/Recognizer with ALL existing profiles."""
        if not access_key: return None, []
        
        try:
            import pveagle
            
            # Fetch all raw profiles
            # Note: Ideally this should use a DB query to get all voice_vector blobs or specific eagle_profile blobs
            # If we are using Pyannote vectors (512d) solely, we CANNOT use Eagle.
            # Eagle needs its own .pv file or bytes.
            # Assuming 'voice_profiles' table or column exists used by Eagle.
            # IF NOT: We must accept that we can't switch from Pyannote to Eagle easily without re-enrollment.
            # FOR THIS REFACTOR: migrating the logic being used in audio_stream.py. 
            # In audio_stream.py it loaded `voice_profile_service.get_all_profiles()`.
            
            from services.voice_profile_service import get_voice_profile_service
            vps = get_voice_profile_service()
            profiles_dict = vps.get_all_profiles() # {id: bytes}
            
            eagle_profiles = []
            profile_ids = []
            
            for contact_id, profile_bytes in profiles_dict.items():
                try:
                    eagle_profile = pveagle.EagleProfile.from_bytes(profile_bytes)
                    eagle_profiles.append(eagle_profile)
                    profile_ids.append(contact_id)
                except Exception as e:
                    logger.warning(f"Skipping invalid Eagle profile for {contact_id}: {e}")
            
            if not eagle_profiles:
                return None, []
                
            eagle = pveagle.create_recognizer(access_key=access_key, speaker_profiles=eagle_profiles)
            logger.info(f"Eagle initialized with {len(eagle_profiles)} profiles.")
            return eagle, profile_ids
            
        except ImportError:
            logger.error("pveagle not installed.")
            return None, []
        except Exception as e:
            logger.error(f"Eagle initialization failed: {e}")
            return None, []

    def process_eagle_frame(self, eagle, frame: bytes) -> Tuple[float, int]:
        """
        Process a single frame (PCM16) and return (score, index).
        Note: eagle.process expects sequence of shorts (int16).
        """
        try:
            # Convert bytes to int16 tuple if needed, or pass bytes if library accepts
            # pveagle python usually expects List[int] or tuple
            import struct
            pcm = struct.unpack(f"{len(frame)//2}h", frame)
            scores = eagle.process(pcm)
            
            if not scores: return 0.0, -1
            
            best_score = max(scores)
            best_idx = scores.index(best_score)
            return best_score, best_idx
            
        except Exception as e:
            # logger.debug(f"Eagle processing error: {e}")
            return 0.0, -1

def get_local_speaker_service():
    return LocalSpeakerService.get_instance()
