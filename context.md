# Lyrify — Project Context & System Architecture

## 1. Project Overview

**Lyrify** is a full-stack, AI-powered lyrics synchronization and playback platform inspired by the Apple Music lyrics experience. It allows users to either upload local audio files or provide online streaming links (e.g., YouTube), extracting high-precision word-level timestamps and rendering dynamic, real-time karaoke-style lyrics with fluid animations.

### Core Value Proposition
- **Dual Transcription Engine**: Hybrid architecture providing high-speed, cost-efficient cloud transcription via **Google Gemini 2.5 Flash** and private, fully offline transcription via local **OpenAI Whisper (`small`)**.
- **Word-Level Timestamp Synchronization**: Sub-second temporal alignment per individual word, driving an Apple Music-style gradient sweep and glowing text animation as each word is sung.
- **Multilingual & Phonetic Romanization**: Automatic transcription in native scripts (e.g., Devanagari, Japanese, Korean) with an optional Romanization toggle (converting to Hinglish / Latin script using `anyascii` or Gemini prompt directives).
- **Universal Link Downloader**: Seamless extraction of audio from web sources via `yt-dlp` and `ffmpeg`, automatically hosted for immediate in-browser streaming and playback.

---

## 2. Technology Stack

### Backend
| Technology | Version / Spec | Purpose |
| :--- | :--- | :--- |
| **Python** | 3.8+ (tested on 3.12) | Core backend runtime |
| **FastAPI** | Latest | Asynchronous REST API framework |
| **Uvicorn** | Latest | ASGI server |
| **Google Generative AI SDK** | `google-generativeai` | Cloud multimodal transcription using Gemini 2.5 Flash |
| **OpenAI Whisper** | `openai-whisper` (`small` model) | Local, on-device offline ASR with word-level timestamps |
| **PyTorch** | CUDA 11.8 compatible (`cu118`) | GPU acceleration for Whisper inference (optimized for NVIDIA GTX 1650 / 4GB VRAM) |
| **yt-dlp** | Latest | High-fidelity audio extraction from YouTube and other video links |
| **FFmpeg** | System binary | Audio conversion to MP3, bitrate compression (32kbps for Gemini upload), and post-processing |
| **anyascii** | Latest | Transliteration of Unicode characters into ASCII for offline Romanization |
| **python-dotenv** | Latest | Environment variable configuration (`.env`) |

### Frontend
| Technology | Version / Spec | Purpose |
| :--- | :--- | :--- |
| **Next.js** | 16.1.1 (App Router) | React framework for web client |
| **React** | 19.2.3 | Modern React with hooks and concurrent features |
| **TypeScript** | 5.x | Strict type safety |
| **Tailwind CSS** | v4 (`@tailwindcss/postcss`) | Modern utility-first CSS styling and layout |
| **Framer Motion** | 12.23.26 | Spring physics, fluid scale, blur, and opacity transitions for lyrics |
| **Lucide React** | 0.562.0 | Clean, modern iconography |
| **Axios** | 1.13.2 | HTTP client for API interactions |

---

## 3. Repository Structure & File Map

```
Lyrify/
├── backend/
│   ├── .env                           # Backend environment variables (GEMINI_API_KEY)
│   ├── main.py                        # FastAPI application, transcription logic, and routes
│   ├── requirements.txt               # Python package dependencies
│   ├── downloads/                     # Directory for yt-dlp extracted media served via /static
│   ├── list_models.py                 # Utility script to inspect available Gemini models
│   ├── test_gemini.py                 # Standalone Gemini audio transcription test script
│   ├── test_25_flash.py               # Benchmark test for gemini-2.5-flash response format
│   ├── test_long_audio.py             # Benchmark test for full song length audio files
│   ├── test_timeout.py                # Timeout testing for long API requests
│   └── venv/                          # Python virtual environment
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with fonts and metadata
│   │   ├── page.tsx                   # Main dashboard: upload, link input, mode toggles, player
│   │   └── globals.css                # Tailwind stylesheet, custom scrollbars, animations
│   ├── components/
│   │   ├── LyricsView.tsx             # Apple Music-style lyrics visualizer with word animations
│   │   └── Player.tsx                 # Custom HTML5 audio player with 60fps requestAnimationFrame
│   ├── package.json                   # Frontend dependencies and scripts
│   ├── tsconfig.json                  # TypeScript compiler settings
│   └── next.config.ts                 # Next.js runtime configuration
├── check_cuda.py                      # Diagnostic script to verify PyTorch CUDA availability
├── prove_gpu.py                       # Diagnostic script to test Whisper tensor allocation on GPU
├── context.md                         # (This file) Complete architectural and context specification
├── handoff.md                         # Operational handoff and next-step engineering roadmap
└── README.md                          # Quickstart guide
```

---

## 4. System Architecture & Workflows

### 4.1 Hybrid Transcription Pipeline

```
[ User Input (File Upload or URL) ]
                │
         [ Mode Selection ]
        /                  \
       ▼                    ▼
[ Online (Gemini) ]    [ Offline (Whisper) ]
       │                    │
[ Pre-compress Audio ]  [ Check CUDA / VRAM ]
 (ffmpeg 32k MP3)           │
       │                [ Whisper 'small' ]
[ Upload to Gemini API ] (word_timestamps=True)
       │                    │
[ Gemini 2.5 Flash ]        │
(Structured JSON Prompt)    │
       │                    │
[ Parse JSON ]         [ Format & anyascii ]
        \                  /
         ▼                ▼
   [ Unified Word-Level Timestamp JSON ]
                │
                ▼
  [ Frontend LyricsView (Apple-style UI) ]
```

### 4.2 Transcription Engines Detail

#### Engine A: Online (Google Gemini 2.5 Flash)
1. **Audio Compression**: To minimize network overhead and avoid upload timeouts, the input audio is compressed on the fly to `32kbps mono/stereo MP3` via `ffmpeg -y -i <input> -b:a 32k <compressed>.mp3`.
2. **File Upload**: Uploaded via `genai.upload_file()`.
3. **Structured Prompting**: Gemini 2.5 Flash is invoked with `temperature=0.2` and `response_mime_type="application/json"`. It enforces the exact JSON schema required by the visualizer.
4. **Phonetic Romanization**: Managed natively via system prompt instructions (`"You MUST output the lyrics phonetically using the English alphabet"`), producing culturally natural Hinglish/Romanized text without character-replacement artifacts.
5. **Cleanup**: Cloud-uploaded files and temporary compressed files are reliably purged in `finally` blocks.

#### Engine B: Offline (OpenAI Whisper Local)
1. **Model**: Whisper `small` (244M parameters, ~2GB VRAM), loaded on startup and cached globally in `model`.
2. **Inference**: Configured with `word_timestamps=True` using PyTorch on CUDA (`cuda:0`), falling back to CPU if GPU is absent.
3. **Triton Kernel Cache Configuration**: Word-level timestamps use Whisper's CUDA median filter kernel via Triton (`triton_ops.py`). To avoid `[Errno 30] Read-only file system: '/home/salim/.triton'`, `backend/main.py` explicitly routes Triton cache to `/tmp/.triton` (`TRITON_HOME` and `TRITON_CACHE_DIR`) and enables `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`.
4. **Post-Processing & Romanization**: Segments and word dictionaries are traversed; if Romanization is enabled, `anyascii` transliterates foreign characters to English equivalents.

### 4.3 Universal Link Extraction Pipeline
1. Client sends URL to `/transcribe/link`.
2. Backend generates a UUID `file_id`.
3. `yt-dlp` extracts the best audio stream, converted to 192kbps MP3 via `FFmpegExtractAudio` post-processor, saved into `backend/downloads/download_<uuid>.mp3`.
4. The downloaded track is transcribed via the selected engine.
5. The endpoint returns both the `lyrics` array and the `audio_url` pointing to `http://localhost:8000/static/download_<uuid>.mp3`.

---

## 5. Data Contracts & Schemas

### 5.1 Lyrics JSON Structure
Both Gemini and Whisper format their responses to match the following schema:

```typescript
interface Word {
  word: string;      // Word text (or romanized word)
  start: number;     // Start timestamp in seconds (float)
  end: number;       // End timestamp in seconds (float)
}

interface LyricLine {
  text: string;      // Full sentence / line text
  start: number;     // Line start timestamp in seconds
  end: number;       // Line end timestamp in seconds
  words: Word[];     // List of word-level timestamp objects
}

type LyricsResponse = LyricLine[];
```

### 5.2 API Endpoints

#### `POST /transcribe/upload`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: `UploadFile` (audio file: mp3, flac, wav, m4a, etc.)
  - `mode`: `"online"` | `"offline"` (default: `"online"`)
  - `romanize`: `"true"` | `"false"` (default: `"false"`)
- **Response**:
  ```json
  {
    "lyrics": [ ... ]
  }
  ```

#### `POST /transcribe/link`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "url": "https://www.youtube.com/watch?v=...",
    "mode": "online",
    "romanize": false
  }
  ```
- **Response**:
  ```json
  {
    "lyrics": [ ... ],
    "audio_url": "http://localhost:8000/static/download_<uuid>.mp3"
  }
  ```

---

## 6. Frontend Visual Architecture

### 6.1 `LyricsView.tsx` (Apple Music UX)
- **Active Line Detection**: Compares `currentTime` against `line.start` and `line.end`.
- **Auto-Scroll**: Smoothly scrolls the active lyric line to the vertical center of the view.
- **Dynamic Word Fill Gradient**:
  ```css
  background-image: linear-gradient(90deg, #ffffff {fillPercent}%, #ffffff80 {fillPercent}%);
  ```
  `fillPercent` is calculated continuously from `(currentTime - word.start) / (word.end - word.start) * 100`.
- **Bulb Glow Effect**: When a word is active, a glowing drop shadow (`drop-shadow(0 0 15px rgba(255, 255, 255, 1))`) and spring bounce are applied.
- **Interactive Seeking**: Clicking any word immediately triggers `onSeek(word.start)`, synchronizing audio playback to that exact syllable.

### 6.2 `Player.tsx`
- Employs `requestAnimationFrame` loops instead of the standard `onTimeUpdate` event (which only fires 3-4 times per second), ensuring 60fps rendering for sub-second lyric tracking.
- Audio scrubber with forward/backward 10-second skip capabilities and volume state controls.

---

## 7. Live Runtime & Deployment State

| Service | Port / URL | Engine / Framework | Status | Health Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `http://localhost:8000` | FastAPI / Uvicorn (Python 3.12) | **ACTIVE / RUNNING** | `GET /` returned `{"message": "Lyrics Service Backend is running"}` |
| **Frontend Web** | `http://localhost:3000` | Next.js 16.1.1 (Turbopack) | **ACTIVE / RUNNING** | `GET /` returned `HTTP 200 OK` |
| **GPU Acceleration** | `cuda:0` | NVIDIA GeForce GTX 1650 | **ACTIVE** | PyTorch CUDA verified, Whisper `small` loaded in VRAM |
| **Whisper Cache** | `~/.cache/whisper/small.pt` | OpenAI Whisper Weights (462MB) | **CACHED & READY** | Verified SHA256 integrity and local initialization |

---

## 8. Free Production Cloud Deployment (Vercel + Hugging Face)

| Component | Target Platform | Specs / Cost | Configuration |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Free Hobby tier, worldwide Edge CDN | Root Directory: `frontend`, Env: `NEXT_PUBLIC_API_URL` |
| **Backend** | **Hugging Face Spaces** | Free Docker tier, 16 GB RAM, 2 vCPUs | Container: `backend/Dockerfile`, Port: `7860`, Secret: `GEMINI_API_KEY` |
| **Guide** | Project Root | Step-by-step instructions | See [DEPLOYMENT.md](file:///home/salim/projects/Lyrify/DEPLOYMENT.md) |



