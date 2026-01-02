import os
import shutil
import whisper
import yt_dlp
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files to serve the downloads
# We will serve the current directory (or a specific downloads dir) but for simplicity current dir is fine 
# as long as we are careful. Better to serve a 'downloads' dir.
if not os.path.exists("downloads"):
    os.makedirs("downloads")

# FORCE FFMPEG PATH (Windows specific fix)
ffmpeg_path = r"C:\Users\SAFIRU\AppData\Local\Microsoft\WinGet\Links"
os.environ["PATH"] += os.pathsep + ffmpeg_path
# Also attempt to find it via find_by_name result just in case
ffmpeg_bin_path = r"C:\Users\SAFIRU\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
os.environ["PATH"] += os.pathsep + ffmpeg_bin_path

app.mount("/static", StaticFiles(directory="downloads"), name="static")

# Load model locally (global variable to cache it)
# "small" model fits in 2GB VRAM, good balance for GTX 1650
MODEL_SIZE = "small"
model = None

def get_model():
    global model
    if model is None:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Whisper model: {MODEL_SIZE} on device: {device.upper()}...")
        model = whisper.load_model(MODEL_SIZE, device=device)
        print("Model loaded.")
    return model

@app.on_event("startup")
async def startup_event():
    # Preload model on startup
    get_model()

@app.get("/")
def read_root():
    return {"message": "Lyrics Service Backend is running"}

from anyascii import anyascii

# ... imports ...

from anyascii import anyascii # We'll just remove usages, imports are fine to stay or go. Actually let's remove the import line if possible or just ignore it.
# Let's write the clean version of the affected functions.

class LinkRequest(BaseModel):
    url: str

def format_transcript(result):
    """
    Format standard Whisper output into a clean list of segments
    with word-level timestamps.
    """
    lyrics = []
    segments = result.get("segments", [])
    
    for segment in segments:
        words = segment.get("words", [])
        line_text = segment.get("text", "").strip()
        
        if not words:
            lyrics.append({
                "text": line_text,
                "start": segment["start"],
                "end": segment["end"],
                "words": [] 
            })
            continue
            
        lyrics.append({
            "text": line_text,
            "start": segment["start"],
            "end": segment["end"],
            "words": [
                {
                    "word": w["word"].strip(),
                    "start": w["start"],
                    "end": w["end"]
                } for w in words
            ]
        })
    return lyrics

from fastapi import FastAPI, UploadFile, File, HTTPException, Form

@app.post("/transcribe/upload")
async def transcribe_upload(file: UploadFile = File(...)):
    # Save temp file
    temp_filename = f"temp_{file.filename}"
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"Transcribing Upload: {temp_filename}")
        model = get_model()
        # Enable word timestamps!
        result = model.transcribe(temp_filename, word_timestamps=True)
        
        return {"lyrics": format_transcript(result)}

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error processing upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

import uuid

@app.post("/transcribe/link")
async def transcribe_link(request: LinkRequest):
    url = request.url
    
    # Generate unique filename to avoid conflicts/locking
    file_id = str(uuid.uuid4())
    output_filename = f"download_{file_id}.mp3"
    output_path = os.path.join("downloads", output_filename)
    
    # Download with yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'downloads/download_{file_id}.%(ext)s', # Use template initially
        'ffmpeg_location': ffmpeg_path,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }
    
    try:
        print(f"Downloading from URL: {url} to {output_path}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Download failed or conversion failed")

        print("Transcribing Downloaded File...")
        model = get_model()
        result = model.transcribe(output_path, word_timestamps=True)
        
        return {
            "lyrics": format_transcript(result), 
            "audio_url": f"http://localhost:8000/static/{output_filename}"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error processing link: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    # Do not delete the file in finally block, so the frontend can play it!

