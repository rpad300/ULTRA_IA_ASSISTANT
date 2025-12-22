# Project Plan - Ultra Assistant

## Project Goal
Build a local-first, AI-powered meeting assistant (Ultra Assistant) that captures audio, transcribes in real-time, and provides context-aware insights using Gemini, AssemblyAI, and local data (Supabase/Qdrant/Drive).

## Current Tasks
- [ ] **Phase 6: Quality & Polish**
    - [ ] Add loading states for Session Finalization
    - [ ] Improve Error Handling in Drive Service (OAuth flows)
    - [ ] Secure WebSocket connection (Authentication)

## Completed Tasks
- [x] **Phase 5: Post-Meeting Flow** (2025-01-04)
    - [x] Implement Session Finalization Endpoint (`/api/threads/{id}/finalize`)
    - [x] Generate Summaries with Gemini
    - [x] Save Artifacts to Google Drive (Transcript & Summary) & Supabase
- [x] **Phase 2 (Refinement): AI Services** (2025-01-04)
    - [x] Verify `gemini_service.py` chat logic with history mapping
    - [x] Fix dependencies for Google Drive (`google-api-python-client`)
- [x] **Phase 4: Live Meeting Flow** (2025-01-04)
    - [x] Implement Audio Capture in Frontend (`AudioStreamer`)
    - [x] Implement WebSocket endpoint in FastAPI (`/audio_stream` -> `/api/ws/transcription`)
    - [x] Connect Frontend Audio Stream to Backend WebSocket
    - [x] Integrate AssemblyAI Real-time Transcription in Backend
- [x] **Phase 0: Basic Infra** (2025-01-04)
    - [x] Repo structure (`src/electron`, `src/frontend`, `src/backend`)
    - [x] Electron + React Hello World
    - [x] FastAPI Health Check
- [x] **Phase 1: Supabase & Qdrant** (2025-01-04)
    - [x] Supabase Schema (`001`, `002`)
    - [x] `supabase_client.py` & `qdrant_service.py`
    - [x] CRUD Endpoints for Company/Project/Thread (`routers/workspace.py`)
- [x] **Phase 2: AI Integrations (Initial)** (2025-01-04)
    - [x] `gemini_service.py` structure
    - [x] `assemblyai_service.py` structure
    - [x] `drive_service.py` structure
- [x] **Phase 3: Prep Flow UI** (2025-01-04)
    - [x] Views: Companies, Projects, Threads
    - [x] Navigation & Layout
    - [x] Basic Chat Interface (`/threads/:id/messages`)

## Notes
- **Architecture**: Electron (UI/Capture) -> Python FastAPI (Orchestrator) -> Supabase/Qdrant/Drive.
- **Audio**: Real-time streaming via WebSocket is critical.
- **Security**: Current Electron setup uses `nodeIntegration: true` for MVP; must be tightened for production.
- **Rules**: Project rules are currently in `rules/` but should be in `docs/rules/`.

