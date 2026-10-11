# Lyrify — Engineering Handoff & Operational Guide

## 1. Executive Summary & Current State

- **Repository**: `/home/salim/projects/Lyrify`
- **Current Git Branch**: `master` (synchronized with `origin/master` at commit `3975ca2` + local modifications)
- **Status**: **LIVE & FULLY OPERATIONAL**. Both backend and frontend services have been successfully started and verified:
  - **Backend**: Running on `http://localhost:8000` (`uvicorn main:app --host 0.0.0.0 --port 8000`) with Whisper `small` model preloaded onto GPU (`cuda:0`, NVIDIA GeForce GTX 1650). Health endpoint `/` verified: `{"message": "Lyrics Service Backend is running"}`.
  - **Frontend**: Running on `http://localhost:3000` via Next.js Turbopack development server. Verified responding with `HTTP 200 OK`.
  - **Model Weights**: Official Whisper `small.pt` weights (462MB) downloaded and stored in `~/.cache/whisper/small.pt`.
- **Core Architecture**:
  1. **Online Engine**: Gemini 2.5 Flash for rapid cloud transcription and phonetic Romanization.
  2. **Offline Engine**: Local Whisper `small` model with GPU acceleration and `anyascii` fallback.
  3. **UI Modernization**: Mode toggles (Online vs. Offline) and an interactive Romanize toggle (Hinglish/Latin phonetic script).

---

## 2. Working Tree Changes (Uncommitted)

The following changes are currently in the working tree and should be reviewed/committed:

1. **`backend/main.py`**:
   - Added Triton cache redirect (`TRITON_HOME` and `TRITON_CACHE_DIR` pointed to `/tmp/.triton`) and `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` to fix `[Errno 30] Read-only file system: '/home/salim/.triton'` during Whisper word-timestamp median filtering.
   - Added `google-generativeai` integration using model `gemini-2.5-flash`.
   - Added audio compression helper (`compress_audio_for_upload`) using FFmpeg to reduce file size to 32kbps MP3 before uploading to Gemini.
   - Added internet connectivity check (`check_connection`) against `8.8.8.8:443`.
   - Updated `/transcribe/upload` and `/transcribe/link` to accept `mode` ("online" | "offline") and `romanize` parameters.
   - Enforced cloud file deletion (`genai.delete_file`) and local temp cleanup in `finally` blocks.
2. **`backend/requirements.txt`**:
   - Added `google-generativeai` and `python-dotenv`.
3. **`frontend/app/page.tsx`**:
   - Added UI controls for switching between `Online (Gemini)` and `Offline (Whisper)`.
   - Added a `Romanize (e.g. Hinglish)` toggle button with dynamic styling.
   - Enhanced user feedback during transcription (showing which engine is processing).
   - Improved error message alerts parsing `error.response?.data?.detail`.
4. **Untracked Diagnostic Scripts**:
   - `backend/.env`: Holds `GEMINI_API_KEY`.
   - `backend/list_models.py`: Lists Gemini API models available to the key.
   - `backend/test_gemini.py` & `backend/test_25_flash.py`: Gemini API verification scripts.
   - `backend/test_long_audio.py` & `backend/test_timeout.py`: Audio length and timeout stress tests.

---

## 3. Environment & Prerequisites Setup

### System Prerequisites
- **OS**: Linux (tested on Ubuntu 24.04 LTS / Debian-based systems)
- **FFmpeg**: Must be installed and accessible in the system `$PATH` (`sudo apt install ffmpeg`).
- **Python**: 3.8+ (recommended 3.10 - 3.12).
- **Node.js**: v18+ or v20+ with npm.
- **NVIDIA GPU (Optional but Recommended)**: NVIDIA GTX 1650 or higher with CUDA 11.8+ drivers.

### Backend Setup
```bash
cd /home/salim/projects/Lyrify/backend

# 1. Activate virtual environment
source venv/bin/activate

# 2. Install dependencies (if adding newly listed packages)
pip install -r requirements.txt

# 3. Verify .env file has valid GEMINI_API_KEY
cat .env
# Expected content: GEMINI_API_KEY="your-gemini-api-key"
```

### Frontend Setup
```bash
cd /home/salim/projects/Lyrify/frontend

# 1. Install npm dependencies (if not already installed)
npm install
```

---

## 4. Running the Application

### Starting the Backend
```bash
cd /home/salim/projects/Lyrify/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- API Base: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`
- Static audio downloads: `http://localhost:8000/static/`

### Starting the Frontend
```bash
cd /home/salim/projects/Lyrify/frontend
npm run dev
```
- Web Application: `http://localhost:3000`

---

## 5. Verification & Testing Checklist

- [ ] **CUDA Diagnostic**: Run `python prove_gpu.py` from the root directory to confirm PyTorch detects CUDA and loads a test tensor to the GPU.
- [ ] **Offline File Upload**:
  - Open `http://localhost:3000`.
  - Toggle mode to **Offline (Whisper)**.
  - Upload a local audio file (`.mp3` or `.flac`).
  - Verify lyrics render and playback matches word highlighting.
- [ ] **Online File Upload (Gemini)**:
  - Toggle mode to **Online (Gemini)**.
  - Upload audio file.
  - Confirm fast response and word-by-word timestamp generation.
- [ ] **Romanization**:
  - Upload or paste a link for a Hindi/Bollywood song (e.g. A.R. Rahman track).
  - Enable **Romanize (e.g. Hinglish)**.
  - Verify lyrics appear in phonetic Latin script (English alphabet) rather than native Devanagari script.
- [ ] **YouTube / Media Link Extraction**:
  - Paste a valid YouTube music link.
  - Submit and verify `yt-dlp` extracts audio to `backend/downloads/`, serves it via `/static`, and plays within `Player.tsx`.
- [ ] **Interactive Word Seek**:
  - Click on any word in the middle of a lyric line.
  - Confirm the audio player immediately jumps to the exact word start time.

---

## 6. Known Technical Debt, Limitations & Edge Cases

1. **Large Audio File Limits with Gemini**:
   - Extremely long tracks (>6-8 minutes) can occasionally exceed Gemini 2.5 Flash's output token budget for dense word-level JSON arrays, causing a `JSONDecodeError`.
   - *Current Mitigation*: The backend catches invalid JSON and prompts the user to fall back to Offline mode.
   - *Recommended Fix*: Implement audio chunking or request sentence-level timestamps with an optional secondary pass.
2. **`downloads/` Directory Growth**:
   - Audio files downloaded via `yt-dlp` accumulate in `backend/downloads/` and are not automatically deleted because the browser needs them for playback.
   - *Recommended Fix*: Add a background cron/task or TTL-based cleanup script to remove files older than 24 hours.
3. **yt-dlp Bot Detection & Rate Limiting**:
   - YouTube frequently introduces bot challenges (e.g., `Sign in to confirm you're not a bot`).
   - *Recommended Fix*: Configure `yt-dlp` cookie extraction (`--cookies-from-browser` or a `cookies.txt` file).
4. **Anyascii Transliteration Limitations**:
   - In offline mode, `anyascii` provides character-by-character transliteration which is not always phonetically accurate for complex syllables in languages like Hindi, Urdu, or Japanese. Gemini's online phonetic romanization is significantly more natural.

---

## 7. Immediate Action Items & Roadmap

### Priority 1: Code Quality & Git Hygiene
- [ ] Stage and commit the uncommitted changes in `backend/main.py`, `backend/requirements.txt`, and `frontend/app/page.tsx` with a descriptive message (e.g., `feat: integrate Gemini 2.5 Flash online transcription & Romanize toggle`).
- [ ] Ensure `.env` is listed in `backend/.gitignore` so secret API keys are never pushed to remote remotes.

### Priority 2: Audio Player Enhancements
- [ ] Add an auto-scroll lock toggle in `LyricsView.tsx`: if the user manually scrolls the lyrics container, pause automatic centering for 5 seconds so they can read ahead or back.
- [ ] Implement audio waveform visualizer alongside or behind the player bar.

### Priority 3: Robustness & Scaling
- [ ] Implement an automated cache for processed songs (e.g., store lyrics JSON keyed by audio hash or YouTube URL) so re-playing the same song doesn't re-trigger transcription costs or compute.
- [ ] Implement scheduled cleanup for `backend/downloads/`.

### Priority 4: Production Cloud Deployment (Vercel + Hugging Face Spaces)
- [ ] Deploy backend to free Hugging Face Space using `backend/Dockerfile` and configure `GEMINI_API_KEY` secret.
- [ ] Deploy frontend to Vercel with Root Directory `frontend` and set `NEXT_PUBLIC_API_URL` to the Hugging Face Space URL.
- [ ] Refer to [DEPLOYMENT.md](file:///home/salim/projects/Lyrify/DEPLOYMENT.md) for step-by-step instructions.

