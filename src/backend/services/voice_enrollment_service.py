import asyncio
import logging
import uuid
import io
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from pydub import AudioSegment

from db.supabase_client import get_async_supabase_client
from services.storage_provider import get_storage_provider, StorageProvider
from services.local_speaker_service import get_local_speaker_service

logger = logging.getLogger(__name__)

class VoiceEnrollmentService:
    def __init__(self):
        self.speaker_service = get_local_speaker_service()
        # Use existing executor from speaker service or create new one?
        # Speaker service has one for heavy lifting, we can use it or ours.
        # Let's use internal helpers which might use the speaker service's executor.
    
    async def enroll_contact(self, contact_id: str, file_paths: List[str], tenant_id: str = None) -> Dict[str, Any]:
        """
        SOTA Enrollment Pipeline:
        1. Parallel Fetch & Process (Bytes -> Audio -> Metrics -> Embedding)
        2. Quality Gate Filter (SNR, Clipping)
        3. Transactional Bulk Insert to `voice_traces`
        4. Recalculate Centroid (Profile Evolution)
        """
        logger.info(f"Starting enrollment for {contact_id} with {len(file_paths)} files.")
        
        # 1. Parallel Processing
        # We limit concurrency to avoid OOM if 100 files
        semaphore = asyncio.Semaphore(5) 
        
        async def process_single(path: str):
            async with semaphore:
                return await self._process_sample(path)

        results = await asyncio.gather(*[process_single(path) for path in file_paths], return_exceptions=True)
        
        valid_samples = []
        errors = []
        
        for res in results:
            if isinstance(res, Exception):
                logger.error(f"Sample failed: {res}")
                errors.append(str(res))
            elif res and res.get("valid"):
                valid_samples.append(res)
            else:
                # Quality Gate Rejected
                if res:
                    logger.warning(f"Quality Gate Rejected: {res.get('reason')}")
        
        if not valid_samples:
            result_payload = {
                "status": "failed",
                "message": "No valid samples found passing quality gate.",
                "errors": errors,
                "processed": 0,
                "timestamp": datetime.now().isoformat()
            }
            # Attempt to update status even on failure
            try:
                supabase = await get_async_supabase_client()
                await supabase.table("contacts").update({
                    "last_enrollment_status": result_payload
                }).eq("id", contact_id).execute()
            except: pass
            return result_payload

        # SOTA: Diversity Check (Variance)
        # Warn if all samples are too similar (e.g. repeated same file)
        diversity_warning = None
        if len(valid_samples) > 1:
            embeddings = np.array([s["embedding"] for s in valid_samples])
            # Variance across the batch (mean of variances per dimension)
            # A low variance means they are identical or very close.
            batch_variance = np.mean(np.var(embeddings, axis=0))
            if batch_variance < 1e-4: # Stricter threshold?
                 diversity_warning = f"Low Diversity Detected (Var={batch_variance:.6f}). Use varied phrases."
                 logger.warning(f"Diversity Check: {diversity_warning}")

        # 2. Bulk Persistence (Transaction-like)
        # We insert all valid traces linked to contact_id
        try:
            supabase = await get_async_supabase_client()
            
            rows_to_insert = []
            for sample in valid_samples:
                rows_to_insert.append({
                    "trace_id": str(uuid.uuid4()),
                    "contact_id": contact_id,
                    "embedding": sample["embedding"], # Vector
                    "quality_score": sample["snr"],   # Use SNR as generic quality score
                    "snr": sample["snr"],
                    "clipping_score": sample["clipping"],
                    "duration_ms": sample["duration_ms"],
                    "is_processed": True # We are processing it right now via centroid
                })
            
            # Sub-batch insertion if needed? Supabase handles JSON body limits.
            # Assuming < 100 files, one batch is fine.
            await supabase.table("voice_traces").insert(rows_to_insert).execute()
            logger.info(f"Persisted {len(rows_to_insert)} high-quality traces for {contact_id}.")
            
            # 3. Trigger Centroid Evolution
            # This will use the traces we just inserted + historical top quality ones
            success = await self.speaker_service.recalculate_profile(contact_id, supabase_client=supabase)
            
            if not success:
               logger.warning("Centroid recalculation returned false (not enough data?)")

            result_payload = {
                "status": "success",
                "message": f"Enrolled {len(valid_samples)} samples.",
                "total_files": len(file_paths),
                "valid_samples": len(valid_samples),
                "rejected": len(file_paths) - len(valid_samples),
                "warnings": [diversity_warning] if diversity_warning else [],
                "errors": errors,
                "timestamp": datetime.now().isoformat()
            }
            
            # SOTA Notification: Update DB for Frontend Realtime
            # We wrap in try/except to prevent failure if column 'last_enrollment_status' is missing
            try:
                await supabase.table("contacts").update({
                    "last_enrollment_status": result_payload
                }).eq("id", contact_id).execute()
            except Exception as e:
                logger.warning(f"Failed to send enrollment notification (DB Schema mismatch?): {e}")

            return result_payload

        except Exception as e:
            logger.error(f"Enrollment Transaction Failed: {e}")
            raise e

    async def _process_sample(self, path: str) -> Optional[Dict]:
        """
        Process a single audio file:
        Fetch -> Decode -> Metrics -> Embedding
        Returns dict with data or None if failed/rejected.
        """
        try:
            # A. Fetch Bytes (Abstract Storage)
            provider = get_storage_provider(path)
            audio_bytes = await provider.get_bytes(path)
            
            if not audio_bytes:
                return {"valid": False, "reason": "File not found or empty"}

            # B. Memory Safety (Streaming-like)
            # We don't hold the original bytes if we have PCM
            # But metrics calc needs original bytes for header-based checks?
            # Actually _calculate_quality_metrics parses headers if wav. 
            
            # B. Decode & Metrics (CPU Bound)
            metrics = await self.speaker_service.calculate_metrics_async(audio_bytes)
            
            # SOTA Diarization Gate
            # "Is there one and only one speaker?"
            # We already have 'overlap' in metrics from LocalSpeakerService if enabled
            if metrics.get("overlap", False):
                 return {"valid": False, "reason": "Multiple speakers detected (Diarization Gate)"}

            if not metrics["valid"]:
                return {
                    "valid": False, 
                    "reason": f"Low Quality (SNR={metrics['snr']:.1f}dB, Clip={metrics['clipping']:.2f})"
                }

            # C. Audio Conversion (Critical for consistency)
            # Prepare PCM for embedding extraction
            pcm_data, duration_ms = await self._convert_to_pcm(audio_bytes)
            
            # FREE MEMORY: Drop original container bytes immediately
            del audio_bytes
            
            # Re-verify Metrics on Raw PCM (Canonical Source)
            metrics_pcm = await self.speaker_service.calculate_metrics_async(pcm_data)
            if not metrics_pcm["valid"]:
                  return {"valid": False, "reason": f"Low Quality PCM (SNR={metrics_pcm['snr']:.1f})"}

            # D. Extract Embedding
            embedding = await self.speaker_service.extract_embedding_async(pcm_data)
            del pcm_data # FREE PCM MEMORY
            
            if embedding is None:
                return {"valid": False, "reason": "Embedding extraction failed"}

            return {
                "valid": True,
                "embedding": embedding.tolist(),
                "snr": metrics["snr"],
                "clipping": metrics["clipping"],
                "duration_ms": duration_ms
            }

        except Exception as e:
            logger.error(f"Error processing {path}: {e}")
            return {"valid": False, "reason": f"Exception: {str(e)}"}

    async def _convert_to_pcm(self, file_bytes: bytes) -> tuple[bytes, int]:
        """
        Converts generic audio bytes (wav, mp3, etc) to Raw PCM 16kHz Mono.
        Returns (pcm_bytes, duration_ms)
        """
        def _convert():
            # Load from bytes
            seg = AudioSegment.from_file(io.BytesIO(file_bytes))
            # Resample
            seg = seg.set_frame_rate(16000).set_channels(1).set_sample_width(2)
            return seg.raw_data, len(seg)
        
        return await asyncio.to_thread(_convert)

# Singleton
_service = None
def get_voice_enrollment_service():
    global _service
    if _service is None:
        _service = VoiceEnrollmentService()
    return _service
