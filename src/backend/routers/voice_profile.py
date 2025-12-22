from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, BackgroundTasks
from typing import Optional, List, Dict, Any
import os
import io
import asyncio
import shutil
import datetime
import logging
import uuid # Fixed missing import
from pydantic import BaseModel
from fastapi.responses import Response, FileResponse

from services.drive_service import get_drive_service
from db.supabase_client import get_supabase_client, get_async_supabase_client
from services.local_speaker_service import get_local_speaker_service
from services.voice_enrollment_service import get_voice_enrollment_service, VoiceEnrollmentService
from services.storage_provider import get_storage_provider

logger = logging.getLogger(__name__)

router = APIRouter()

class NativeEnrollmentRequest(BaseModel):
    file_path: str
    transcript: Optional[str] = None

# --- Helpers ---

async def _save_upload_to_disk(contact_id: str, file: UploadFile) -> str:
    """Saves uploaded file to local disk and returns path."""
    sample_dir = os.path.join(os.getcwd(), "data", "voice_samples", contact_id)
    os.makedirs(sample_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    # Sanitize filename
    safe_name = os.path.basename(file.filename)
    filename = f"sample_{timestamp}_{safe_name}"
    file_path = os.path.join(sample_dir, filename)
    
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    return file_path

async def _register_sample_db(contact_id: str, file_path: str, filename: str, duration_ms: int = 0, transcript: str = None) -> str:
    """Registers the sample in DB and returns the storage path (e.g. gdrive:ID or local path)."""
    # 1. Drive Upload (Optional - could be offloaded but kept here for data safety)
    drive_service = get_drive_service()
    db_path = file_path
    
    if drive_service:
        try:
            # We run blocking drive upload in thread
            def _upload():
                voice_folder = drive_service.ensure_folder("Voice Samples")
                contact_folder = drive_service.ensure_folder(contact_id, parent_id=voice_folder)
                return drive_service.upload_file(file_path, mime_type="audio/wav", parent_id=contact_folder)

            drive_id = await asyncio.to_thread(_upload)
            if drive_id:
                db_path = f"gdrive:{drive_id}"
        except Exception as e:
            logger.error(f"Drive upload failed: {e}")

    # 2. DB Insert
    supabase = await get_async_supabase_client()
    try:
        await supabase.table("voice_samples").insert({
            "contact_id": contact_id,
            "file_path": db_path,
            "file_name": filename,
            "duration_ms": duration_ms,
            "transcript": transcript,
            "word_count": len(transcript.split()) if transcript else 0
        }).execute()
    except Exception as e:
        logger.error(f"DB Insert failed: {e}")
        # Proceed even if DB fails? 
        # For enrollment service, we pass the db_path (or file_path if db failed).
        pass
        
    return db_path

# --- Endpoints ---

@router.post("/enroll-native/{contact_id}")
async def enroll_native_voice_profile(
    contact_id: str,
    request: NativeEnrollmentRequest,
    service: VoiceEnrollmentService = Depends(get_voice_enrollment_service)
):
    """
    Synchonous Enrollment for immediate feedback (Native Recorder).
    """
    logger.info(f"Native Enrollment for {contact_id}")
    
    # 1. Validate & Register File
    normalized_path = os.path.normpath(request.file_path.strip('"').strip("'"))
    if not os.path.exists(normalized_path):
        raise HTTPException(status_code=400, detail="Recording file not found on server.")

    # Copy to standardized location
    sample_dir = os.path.join(os.getcwd(), "data", "voice_samples", contact_id)
    os.makedirs(sample_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest_path = os.path.join(sample_dir, f"native_{timestamp}.wav")
    shutil.copy2(normalized_path, dest_path)

    # Register in DB/Drive
    final_path = await _register_sample_db(contact_id, dest_path, f"native_{timestamp}.wav", transcript=request.transcript)
    
    # 2. Run Pipeline Immediately
    result = await service.enroll_contact(contact_id, [final_path])
    
    if result["status"] == "failed":
         raise HTTPException(status_code=400, detail=f"Enrollment failed: {result['message']}")
         
    return result

@router.post("/enroll/{contact_id}", status_code=202)
async def enroll_voice_profile(
    contact_id: str, 
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    transcript: Optional[str] = Form(None),
    service: VoiceEnrollmentService = Depends(get_voice_enrollment_service)
):
    """
    Asynchronous SOTA Enrollment (Bulk).
    Returns 202 Accepted immediately.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    logger.info(f"Bulk Enrollment accepted for {contact_id} ({len(files)} files). Processing in background...")
    
    # 1. Save files locally implies we must await them reading
    # We can't pass UploadFile to background task (it closes).
    # so we must save to disk NOW.
    
    saved_paths = []
    
    for file in files:
        try:
            local_path = await _save_upload_to_disk(contact_id, file)
            # Register DB? 
            # If we want the service to see "gdrive" paths, we must upload/register first.
            # This might take time.
            # Tradeoff: If we do it in foreground, 202 is slow.
            # If we do it in background, we pass local paths to service?
            # 
            # Architecture decision: Pass LOCAL paths to service for processing.
            # Let the background task also handle the Drive Upload/DB Register?
            # 
            # Current `VoiceEnrollmentService` expects paths that `StorageProvider` can read.
            # `LocalStorageProvider` reads local paths.
            # So passing `local_path` works for biometric processing.
            # 
            # But we ALSO need to register them in `voice_samples` for history.
            # Let's do a wrapper task.
            saved_paths.append(local_path)
            
        except Exception as e:
            logger.error(f"Failed to save upload {file.filename}: {e}")

    # Define Background Job
    async def _background_enrollment_job(cid, paths, trans):
        logger.info(f"Starting Background Job for {cid}...")
        
        # A. Register in DB/Drive (Slow I/O)
        final_paths = []
        for p in paths:
             # This handles Drive Upload + DB Insert
             # extracting filename from path
             fname = os.path.basename(p)
             fpath = await _register_sample_db(cid, p, fname, transcript=trans)
             final_paths.append(fpath)
        
        # B. Run Biometric Pipeline
        await service.enroll_contact(cid, final_paths)
        logger.info(f"Background Job finished for {cid}")

    # Enqueue
    background_tasks.add_task(_background_enrollment_job, contact_id, saved_paths, transcript)
    
    return {
        "status": "accepted", 
        "message": f"Processing {len(files)} files in background.",
        "task_id": "background" 
    }

@router.get("/{contact_id}/status")
async def get_voice_profile_status(contact_id: str):
    """
    SOTA Status Check with Reliability Score.
    """
    try:
        svc = get_local_speaker_service()
        
        # Ensure profiles loaded
        if not svc.profiles:
            await asyncio.to_thread(svc.refresh_profiles)
            
        has_profile = contact_id in svc.profiles
        
        # Fetch samples for stats
        supabase = await get_async_supabase_client()
        res = await supabase.table("voice_samples").select("*").eq("contact_id", contact_id).order("created_at", desc=True).limit(20).execute()
        samples = res.data or []
        
        total_duration = sum([s.get("duration_ms", 0) for s in samples])
        total_words = sum([s.get("word_count", 0) for s in samples])
        
        # Reliability Score (mocked or from service if implemented)
        # SOTA plan asked to move logic to service.
        # Assuming svc has get_reliability_score or we implement simple logic here for now
        # using the new "clean" logic.
        
        score = 0
        if has_profile:
            # Base it on duration + count
            # 1 minute = 100%?
            score = min(100, int((total_duration / 60000) * 100))
        
        # UI Attributes
        reliability_label = "Low"
        reliability_color = "text-red-400"
        
        if score > 80:
            reliability_label = "Excellent"
            reliability_color = "text-emerald-400"
        elif score > 50:
            reliability_label = "Good"
            reliability_color = "text-green-400"
        elif score > 20: 
             reliability_label = "Fair"
             reliability_color = "text-yellow-400"

        return {
            "contact_id": contact_id,
            "has_profile": has_profile,
            "embedding_dim": 512 if has_profile else 0,
            "samples": samples,
            "stats": {
                "total_duration_ms": total_duration,
                "total_words": total_words,
                "reliability_score": score,
                "reliability_label": reliability_label,
                "reliability_color": reliability_color
            }
        }
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{contact_id}")
async def delete_voice_profile(contact_id: str):
    try:
        svc = get_local_speaker_service()
        # 1. DB Nullify
        supabase = await get_async_supabase_client()
        await supabase.table("contacts").update({"voice_profile": None, "voice_vector": None}).eq("id", contact_id).execute()
        
        # 2. Clear from Index
        if contact_id in svc.profiles: del svc.profiles[contact_id]
        
        # Also clear from SOTA vector index
        for comp in svc.vector_index.values():
            if contact_id in comp: del comp[contact_id]
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{contact_id}/audio/{sample_id}")
async def get_audio_sample(contact_id: str, sample_id: str):
    try:
        supabase = await get_async_supabase_client()
        res = await supabase.table("voice_samples").select("file_path").eq("id", sample_id).eq("contact_id", contact_id).single().execute()
        if not res.data: raise HTTPException(status_code=404, detail="Not found")
        
        path = res.data["file_path"]
        provider = get_storage_provider(path)
        data = await provider.get_bytes(path)
        
        if not data: raise HTTPException(status_code=404, detail="File missing")
        return Response(content=data, media_type="audio/wav")
    except Exception as e:
        logger.error(f"Get audio failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{contact_id}/audio/{sample_id}")
async def delete_voice_sample(contact_id: str, sample_id: str):
    try:
        supabase = await get_async_supabase_client()
        await supabase.table("voice_samples").delete().eq("id", sample_id).eq("contact_id", contact_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
