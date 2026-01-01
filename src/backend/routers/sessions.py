from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from starlette.background import BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncio
import os
import tempfile
import logging
from db.supabase_client import get_supabase_client
from db.models import Session
from services.drive_service import get_drive_service
from services.gemini_service import get_gemini_service
from services.embedding_service import get_embedding_service
from services.assemblyai_service import get_assemblyai_service
from services.vectorization_flow import sync_session_summary_to_vector
from fastapi.responses import StreamingResponse
import io

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["sessions"])

class FinalizeSessionRequest(BaseModel):
    transcript: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    session_id: Optional[str] = None

@router.get("/sessions", response_model=List[Session])
def get_sessions(thread_id: Optional[str] = Query(None)):
    """Get sessions, optionally filtered by thread_id."""
    try:
        supabase = get_supabase_client()
        try:
            query = supabase.table("sessions").select("*")
            if thread_id:
                query = query.eq("thread_id", thread_id)
            response = query.order("created_at", desc=True).execute()
            return response.data if response.data else []
        except Exception as query_error:
            # If query fails (e.g., no sessions table or empty), return empty list
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error querying sessions (thread_id={thread_id}): {query_error}")
            return []
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching sessions (thread_id={thread_id}): {e}", exc_info=True)
        return []

@router.get("/sessions/{session_id}", response_model=Session)
def get_session(session_id: str):
    """Get a specific session by ID."""
    supabase = get_supabase_client()
    response = supabase.table("sessions").select("*").eq("id", session_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return response.data[0]

@router.get("/threads/{thread_id}/sessions", response_model=List[Session])
def get_thread_sessions(thread_id: str):
    """Get all sessions for a specific thread."""
    logger.debug(f"[SESSIONS ROUTER] GET /api/threads/{thread_id}/sessions")
    supabase = get_supabase_client()
    response = supabase.table("sessions").select("*").eq("thread_id", thread_id).order("created_at", desc=True).execute()
    return response.data if response.data else []

@router.post("/threads/{thread_id}/sessions", response_model=Session)
async def create_session(
    thread_id: str,
    background_tasks: BackgroundTasks
):
    """
    Create a new session for a thread.
    SOTA: Pre-provisions the Drive Folder immediately to allow real-time streaming/uploads.
    """
    supabase = get_supabase_client()
    drive = get_drive_service()
    
    # 1. Get Context (Thread -> Project -> Company) for Drive Path
    thread_res = supabase.table("threads").select("title, project_id, company_id, drive_folder_id").eq("id", thread_id).execute()
    
    parent_folder_id = None
    thread_title = "Session"
    
    if thread_res.data:
        t_data = thread_res.data[0]
        thread_title = t_data.get("title", "Session")
        
        # Resolve Parent (Project Priority)
        project_folder_id = t_data.get("drive_folder_id")
        
        if not project_folder_id:
            # Fallback Project
            if t_data.get("project_id"):
                 p_res = supabase.table("projects").select("drive_folder_id").eq("id", t_data.get("project_id")).execute()
                 if p_res.data:
                     project_folder_id = p_res.data[0].get("drive_folder_id")
            
            # Fallback Company
            if not project_folder_id and t_data.get("company_id"):
                 c_res = supabase.table("companies").select("drive_root_folder_id").eq("id", t_data.get("company_id")).execute()
                 if c_res.data:
                     project_folder_id = c_res.data[0].get("drive_root_folder_id")
        
        parent_folder_id = project_folder_id

    # 2. Pre-provision Drive Folder (Async)
    # We do this *before* returning if fast, or better: 
    # We generate the UUID first, then spawn background task?
    # No, we want the ID in the DB.
    
    # Let's try to do it inline if we can, or valid SOTA pattern:
    # "Fire and Forget" for folder creation, but we need the ID?
    # Actually, we can just create it. ensure_folder is relatively fast. 
    # But to be truly SOTA Async, maybe we use a Background Task to "Ensure" it 
    # and update the DB record asynchronously?
    # User requested "Immediate", implying he wants it ready.
    # Let's do it inline for now (2-300ms) to ensure consistency, 
    # or use the "ensure_folder_sota" which is robust.
    
    session_drive_id = None
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    
    if parent_folder_id and drive.service:
        try:
            # Ensure "Sessions" container
            # We use to_thread to avoid blocking event loop
            sessions_container_id = await asyncio.to_thread(drive.ensure_folder, "Sessions", parent_id=parent_folder_id)
            
            if sessions_container_id:
                # SOTA 2025: "YYYY-MM-DD_HHmm_[Title]"
                timestamp_sota = datetime.now().strftime("%Y-%m-%d_%H%M")
                safe_title = "".join([c for c in thread_title if c.isalnum() or c in (' ', '-', '_')]).strip()
                session_folder_name = f"{timestamp_sota}_{safe_title}"
                
                # Create Folder (No Metadata yet as ID comes later)
                session_drive_id = await asyncio.to_thread(
                    drive.create_folder, # Create explicitly as timestamp makes it unique
                    session_folder_name, 
                    parent_id=sessions_container_id
                )
                
                # SOTA 2025 Subfolders
                if session_drive_id:
                     await asyncio.to_thread(drive.ensure_folder, "🎙️ Audio_Original", parent_id=session_drive_id)
                     await asyncio.to_thread(drive.ensure_folder, "📝 Transcripts", parent_id=session_drive_id)
                     await asyncio.to_thread(drive.ensure_folder, "📊 Reports", parent_id=session_drive_id)

        except Exception as e:
            logger.error(f"Failed to pre-provision session folder: {e}")

    session_data = {
        "thread_id": thread_id,
        "type": "main_meeting", # Default type
        "started_at": datetime.now().isoformat(),
        "stt_provider": "assemblyai",
        "drive_folder_id": session_drive_id
    }
    
    response = supabase.table("sessions").insert(session_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    
    session = response.data[0]
    
    # Post-update metadata if we missed it (optional SOTA polish)
    if session_drive_id:
        # Update folder metadata with real session ID now that we have it
        background_tasks.add_task(
            drive.update_file_metadata, 
            session_drive_id, 
            {"appProperties": {"db_id": session["id"], "type": "session"}}
        )
        
    return session

@router.get("/sessions/{session_id}/transcripts")
def get_session_transcripts(session_id: str):
    """Get all transcripts for a specific session (from AssemblyAI session ID)."""
    supabase = get_supabase_client()
    try:
        # Use a limit to prevent memory overload if session is huge
        response = supabase.table("session_transcripts").select("*")\
            .eq("session_id", session_id)\
            .order("timestamp", desc=False)\
            .limit(1000)\
            .execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching transcripts for session {session_id}: {e}")
        # Table might not exist yet if migration failed
        return []

@router.post("/threads/{thread_id}/finalize")
async def finalize_session(thread_id: str, request: FinalizeSessionRequest):
    supabase = get_supabase_client()
    drive = get_drive_service()
    gemini = get_gemini_service()
    
    # 1. Get Context (Thread -> Project -> Company)
    thread_res = supabase.table("threads").select("*").eq("id", thread_id).execute()
    if not thread_res.data:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread = thread_res.data[0]
    
    project_id = thread.get("project_id")
    company_id = thread.get("company_id")
    
    # Resolve Drive Folder (SOTA Structure: Project -> Sessions -> SessionFolder)
    # Priority: Thread Folder > Project Folder > Company Folder > Root
    project_folder_id = thread.get("drive_folder_id")
    
    if not project_folder_id:
        # Fallback to Project
        proj_res = supabase.table("projects").select("drive_folder_id").eq("id", project_id).execute()
        if proj_res.data and proj_res.data[0].get("drive_folder_id"):
            project_folder_id = proj_res.data[0].get("drive_folder_id")
        else:
            # Fallback to Company
            comp_res = supabase.table("companies").select("drive_root_folder_id").eq("id", company_id).execute()
            if comp_res.data and comp_res.data[0].get("drive_root_folder_id"):
                project_folder_id = comp_res.data[0].get("drive_root_folder_id")

    # 3. Create Session Folder Layout
    final_upload_folder_id = project_folder_id # Default to parent if structure fails
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    
    if project_folder_id:
        try:
            # Ensure "Sessions" container
            sessions_container_id = await asyncio.to_thread(drive.ensure_folder, "Sessions", parent_id=project_folder_id)
            
            if sessions_container_id:
                # Ensure specific Session folder: YYYY-MM-DD_HHmm_Title
                safe_title = "".join([c for c in thread.get("title", "Session") if c.isalnum() or c in (' ', '-', '_')]).strip()
                session_folder_name = f"{timestamp}_{safe_title}"
                
                # Create session folder (Idempotent by name) with metadata
                final_upload_folder_id = await asyncio.to_thread(
                    drive.ensure_folder_sota, 
                    session_folder_name, 
                    parent_id=sessions_container_id,
                    entity_id=request.session_id, # Might be None if new
                    entity_type="session"
                )
        except Exception as e:
            logger.error(f"Failed to create session folder structure: {e}")

    # 4. Upload to Drive (to the specific session folder)
    transcript_file_id = None
    summary_file_id = None
    
    try:
        if request.transcript:
            transcript_file_id = await asyncio.to_thread(
                drive.upload_content,
                request.transcript, 
                f"Transcript_{timestamp}.txt", 
                "text/plain", 
                final_upload_folder_id
            )
            
        summary_file_id = await asyncio.to_thread(
            drive.upload_content,
            summary_text, 
            f"Summary_{timestamp}.md", 
            "text/markdown", 
            final_upload_folder_id
        )
    except Exception as e:
        print(f"Drive Upload Error: {e}")

    # 4. Save Session Record
    # 4. Save Session Record
    session_data = {
        "thread_id": thread_id,
        "type": "main_meeting",
        "started_at": request.started_at.isoformat() if request.started_at else None,
        "ended_at": request.ended_at.isoformat() if request.ended_at else datetime.now().isoformat(),
        "stt_provider": "assemblyai",
        "transcript_file_id": transcript_file_id,
        "summary_file_id": summary_file_id
    }
    
    session_id = request.session_id
    
    try:
        if session_id:
            # Update existing session
            # Don't overwrite started_at if it was already set, unless provided? 
            # Actually, we might want to keep the original started_at if not provided.
            # For simplicity, we update fields that are finalized.
            update_data = {
                 "ended_at": session_data["ended_at"],
                 "transcript_file_id": transcript_file_id,
                 "summary_file_id": summary_file_id
            }
            if session_data["started_at"]:
                 update_data["started_at"] = session_data["started_at"]
                 
            supabase.table("sessions").update(update_data).eq("id", session_id).execute()
            logger.info(f"Updated existing session {session_id}")
        else:
            # Insert new session (Legacy fallback)
            res = supabase.table("sessions").insert(session_data).execute()
            if res.data:
                session_id = res.data[0]["id"]
            logger.info(f"Created new session {session_id}")
            
    except Exception as e:
        print(f"Supabase Session Save Error: {e}")

    # 5. Append Summary to Chat
    ai_msg = {
        "thread_id": thread_id,
        "role": "assistant",
        "content": f"**Meeting Ended**\n\n**Summary:**\n{summary_text}"
    }
    supabase.table("messages").insert(ai_msg).execute()

    # 6. Sync Session Summary to Vector Store (Background)
    session_response = supabase.table("sessions").select("id").eq("thread_id", thread_id).order("created_at", desc=True).limit(1).execute()
    if session_id and summary_text and summary_text != "No transcript provided.":
        # session_id is now reliable from step 4
        asyncio.create_task(sync_session_summary_to_vector(
            session_id=session_id,
            summary_text=summary_text,
            thread_id=thread_id
        ))

    return {
        "status": "success", 
        "summary": summary_text,
        "drive_ids": {
            "transcript": transcript_file_id,
            "summary": summary_file_id
        }
    }

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all its associated resources."""
    logger.info(f"Deleting session {session_id}")
    supabase = get_supabase_client()
    drive = get_drive_service()
    embedding = get_embedding_service()
    
    # 1. Get Session Data to find resources
    res = supabase.table("sessions").select("*").eq("id", session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = res.data[0]
    
    # 2. Cleanup Drive Files
    if session.get("transcript_file_id"):
        drive.delete_file(session["transcript_file_id"])
        
    if session.get("summary_file_id"):
        drive.delete_file(session["summary_file_id"])
        
    # 3. Cleanup Embeddings
    try:
        await embedding.delete_session_vectors(session_id)
    except Exception as e:
        logger.warning(f"Failed to delete session vectors: {e}")
    
    # 4. Delete Session Record
    # Assuming CASCADE delete is set up in DB for related tables
    supabase.table("sessions").delete().eq("id", session_id).execute()
    
    return {"status": "success", "message": f"Session {session_id} deleted"}

@router.post("/sessions/{session_id}/transcribe")
async def transcribe_session_audio(
    session_id: str,
    audio_file: UploadFile = File(...),
    language: Optional[str] = Query(None, description="Language code (pt, en, etc.). Auto-detect if not provided."),
):
    """
    Async transcription endpoint with full Audio Intelligence features.
    
    Features:
    - Speaker diarization (who said what)
    - Language detection
    - Sentiment analysis
    - Entity detection
    - Topic detection (IAB categories)
    - Intelligence layer (Gemini analysis for summary, action items)
    
    This endpoint processes the full audio file and returns comprehensive results.
    """
    supabase = get_supabase_client()
    assemblyai = get_assemblyai_service()
    gemini = get_gemini_service()
    
    # 1. Verify session exists and get context
    session_res = supabase.table("sessions").select("*").eq("id", session_id).execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = session_res.data[0]
    thread_id = session.get("thread_id")
    
    # Get context for word boost
    company_name = None
    project_name = None
    
    if thread_id:
        # Get thread with project_id
        thread_res = supabase.table("threads").select("*").eq("id", thread_id).execute()
        if thread_res.data:
            thread = thread_res.data[0]
            project_id = thread.get("project_id")
            
            if project_id:
                # Get project with company_id
                project_res = supabase.table("projects").select("*").eq("id", project_id).execute()
                if project_res.data:
                    project = project_res.data[0]
                    project_name = project.get("name")
                    company_id = project.get("company_id")
                    
                    if company_id:
                        # Get company name
                        company_res = supabase.table("companies").select("name").eq("id", company_id).execute()
                        if company_res.data:
                            company_name = company_res.data[0].get("name")
    
    # 2. Save uploaded file temporarily
    temp_file = None
    try:
        # Create temp file
        suffix = os.path.splitext(audio_file.filename)[1] if audio_file.filename else ".tmp"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio_file.read()
            tmp.write(content)
            temp_file = tmp.name
        
        # 3. Build word boost from context
        word_boost = assemblyai.get_smart_word_boost(
            company_name=company_name,
            project_name=project_name,
            contact_names=None  # Could be fetched from contacts table
        )
        
        # 4. Transcribe with full Audio Intelligence
        logger.info(f"Starting async transcription for session {session_id}")
        transcript_data = await assemblyai.transcribe_file(
            file_path=temp_file,
            speaker_labels=True,
            language_detection=True if not language else False,
            sentiment_analysis=True,
            entity_detection=True,
            iab_categories=True,
            word_boost=word_boost
        )
        
        # 5. Format transcript with speaker labels
        formatted_transcript = assemblyai.format_transcript_with_speakers(transcript_data)
        
        # 6. Intelligence Layer: Analyze with Gemini
        logger.info(f"Running intelligence analysis with Gemini for session {session_id}")
        intelligence_result = await analyze_meeting_with_gemini(
            gemini=gemini,
            transcript_data=transcript_data,
            formatted_transcript=formatted_transcript
        )
        
        # 7. Update session with results
        update_data = {
            "transcript_file_id": None,  # Will be uploaded to Drive if needed
            "summary_file_id": None,
            "audio_file_path": temp_file,  # Store path for reference
        }
        
        # Store intelligence results in session (if schema supports it)
        # For now, we'll store summary and action items in the summary field
        if intelligence_result.get("summary"):
            update_data["summary_file_id"] = intelligence_result.get("summary")  # Could be Drive file ID
        
        supabase.table("sessions").update(update_data).eq("id", session_id).execute()
        
        # 8. Upload to Drive (if parent folder exists)
        drive = get_drive_service()
        transcript_file_id = None
        summary_file_id = None
        
        if thread_id:
            # Get thread context for Drive
            thread_res = supabase.table("threads").select("drive_folder_id, project_id, title").eq("id", thread_id).execute()
            
            project_folder_id = None
            thread_title = "Session"
            
            if thread_res.data:
                thread_data = thread_res.data[0]
                thread_title = thread_data.get("title", "Session")
                project_folder_id = thread_data.get("drive_folder_id")
                project_id = thread_data.get("project_id")
                
                if not project_folder_id and project_id:
                    # Fallback to project folder
                    project_res = supabase.table("projects").select("drive_folder_id, company_id").eq("id", project_id).execute()
                    if project_res.data:
                        project_data = project_res.data[0]
                        project_folder_id = project_data.get("drive_folder_id")
                        company_id = project_data.get("company_id")
                        
                        if not project_folder_id and company_id:
                            # Fallback to Company Root
                            company_res = supabase.table("companies").select("drive_root_folder_id").eq("id", company_id).execute()
                            if company_res.data:
                                project_folder_id = company_res.data[0].get("drive_root_folder_id")
            
            # Create Session Folder Layout
            final_upload_folder_id = project_folder_id
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")

            if project_folder_id:
                try:
                    # Ensure "Sessions" container
                    sessions_container_id = await asyncio.to_thread(drive.ensure_folder, "Sessions", parent_id=project_folder_id)
                    
                    if sessions_container_id:
                        # Ensure specific Session folder: YYYY-MM-DD_HHmm_Title
                        safe_title = "".join([c for c in thread_title if c.isalnum() or c in (' ', '-', '_')]).strip()
                        session_folder_name = f"{timestamp}_{safe_title}"
                        
                        # Create session folder (Idempotent by name) with metadata
                        final_upload_folder_id = await asyncio.to_thread(
                            drive.ensure_folder_sota, 
                            session_folder_name, 
                            parent_id=sessions_container_id,
                            entity_id=session_id,
                            entity_type="session"
                        )
                except Exception as e:
                    logger.error(f"Failed to create session folder structure: {e}")

            if final_upload_folder_id:
                timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
                try:
                    transcript_file_id = await asyncio.to_thread(drive.upload_content,
                        formatted_transcript,
                        f"Transcript_{timestamp}.txt",
                        "text/plain",
                        final_upload_folder_id
                    )
                    
                    summary_content = f"""# Meeting Summary

{intelligence_result.get('summary', 'No summary available')}

## Action Items
{intelligence_result.get('action_items', 'No action items identified')}

## Sentiment Overview
{intelligence_result.get('sentiment_summary', 'No sentiment analysis available')}
"""
                    summary_file_id = await asyncio.to_thread(drive.upload_content,
                        summary_content,
                        f"Summary_{timestamp}.md",
                        "text/markdown",
                        final_upload_folder_id
                    )
                    
                    # Update session with Drive file IDs
                    supabase.table("sessions").update({
                        "transcript_file_id": transcript_file_id,
                        "summary_file_id": summary_file_id
                    }).eq("id", session_id).execute()
                except Exception as e:
                    logger.error(f"Drive upload error: {e}")
        
        return {
            "status": "success",
            "session_id": session_id,
            "transcript": {
                "text": transcript_data.get("text"),
                "formatted": formatted_transcript,
                "language": transcript_data.get("language_code"),
                "confidence": transcript_data.get("confidence"),
                "speakers": transcript_data.get("speakers", []),
                "sentiment": transcript_data.get("sentiment", []),
                "entities": transcript_data.get("entities", []),
                "topics": transcript_data.get("topics", [])
            },
            "intelligence": intelligence_result,
            "drive_ids": {
                "transcript": transcript_file_id,
                "summary": summary_file_id
            }
        }
        
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Cleanup temp file
        if temp_file and os.path.exists(temp_file):
            try:
                os.unlink(temp_file)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")


async def analyze_meeting_with_gemini(
    gemini,
    transcript_data: dict,
    formatted_transcript: str
) -> dict:
    """
    Intelligence Layer: Analyze meeting transcript with Gemini.
    
    Instead of using LeMUR (paid add-on), we use our existing Gemini instance
    to extract insights: summary, action items, sentiment overview.
    
    Args:
        gemini: GeminiService instance
        transcript_data: Full transcript data from AssemblyAI
        formatted_transcript: Formatted transcript with speaker labels
    
    Returns:
        Dictionary with:
        - summary: Meeting summary
        - action_items: List of action items
        - sentiment_summary: Overall sentiment analysis
    """
    # Build comprehensive prompt
    prompt = f"""Analyze this meeting transcript and provide:

1. **Summary**: A concise summary of the meeting (2-3 paragraphs)
2. **Action Items**: List all action items mentioned, with:
   - What needs to be done
   - Who is responsible (if mentioned)
   - Any deadlines (if mentioned)
3. **Sentiment Overview**: Overall sentiment of the meeting (positive, neutral, or negative) and key emotional moments

Format your response as:
SUMMARY:
[summary text]

ACTION ITEMS:
- [action item 1]
- [action item 2]

SENTIMENT:
[sentiment overview]

---

TRANSCRIPT:
{formatted_transcript}

---

ADDITIONAL DATA:
- Language: {transcript_data.get('language_code', 'unknown')}
- Confidence: {transcript_data.get('confidence', 0.0)}
- Number of speakers: {len(transcript_data.get('speakers', []))}
"""
    
    try:
        analysis = await gemini.generate_response([], prompt)
        
        # Parse response (simple parsing - could be enhanced)
        summary = ""
        action_items = ""
        sentiment_summary = ""
        
        sections = analysis.split("\n\n")
        for section in sections:
            if "SUMMARY:" in section.upper():
                summary = section.replace("SUMMARY:", "").strip()
            elif "ACTION ITEMS:" in section.upper():
                action_items = section.replace("ACTION ITEMS:", "").strip()
            elif "SENTIMENT:" in section.upper():
                sentiment_summary = section.replace("SENTIMENT:", "").strip()
        
        # Fallback: if parsing fails, use full response as summary
        if not summary:
            summary = analysis
        
        return {
            "summary": summary,
            "action_items": action_items,
            "sentiment_summary": sentiment_summary,
            "raw_analysis": analysis
        }
    except Exception as e:
        logger.error(f"Gemini analysis error: {e}")
        return {
            "summary": "Error generating analysis",
            "action_items": "",
            "sentiment_summary": "",
            "error": str(e)
        }


async def sync_session_summary_to_vector(
    session_id: str,
    summary_text: str,
    company_id: str,
    project_id: str = None,
    thread_id: str = None,
    original_created_at: str = None
):
    """Background task to sync session summary to vector store."""
    try:
        embedding_service = get_embedding_service()
        await embedding_service.sync_session_summary_to_vector(
            session_id=session_id,
            summary_text=summary_text,
            company_id=company_id,
            project_id=project_id,
            thread_id=thread_id,
            original_created_at=original_created_at
        )
    except Exception as e:
        logger.error(f"Vector sync error for session summary {session_id}: {e}")
        import traceback
        traceback.print_exc()

