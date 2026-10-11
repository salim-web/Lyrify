import os
import tempfile

# Configure writable cache directory for Triton and CUDA memory allocation
_triton_cache = os.path.join(tempfile.gettempdir(), ".triton")
os.environ.setdefault("TRITON_HOME", _triton_cache)
os.environ.setdefault("TRITON_CACHE_DIR", os.path.join(_triton_cache, "cache"))
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import shutil
import whisper
import yt_dlp
import subprocess
import socket
import json
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY, transport="rest")

def check_connection(host="8.8.8.8", port=443, timeout=3):
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
        return True
    except socket.error as ex:
        print(f"Connection check failed: {ex}")
        return False

def compress_audio_for_upload(input_path):
    output_path = f"{input_path}_compressed.mp3"
    try:
        print(f"Compressing audio {input_path} for Gemini upload...")
        subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-b:a", "32k", output_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        return output_path
    except Exception as e:
        print(f"Compression failed, using original file: {e}")
        return input_path

def generate_lyrics_gemini(file_path, romanize=False):
    compressed_path = compress_audio_for_upload(file_path)
    print("Uploading to Gemini...")
    audio_file = genai.upload_file(path=compressed_path)
    
    romanize_instruction = ""
    if romanize:
        romanize_instruction = "IMPORTANT: You MUST output the lyrics phonetically using the English alphabet (Romanization/Hinglish) instead of the native script."
    else:
        romanize_instruction = "IMPORTANT: Detect the primary language of the song. Transcribe the lyrics accurately in that language's native script (e.g., Devanagari for Hindi)."

    prompt = f"""
    Listen to this audio and generate the lyrics. 
    {romanize_instruction}
    
    Output the lyrics STRICTLY as a JSON array of objects.
    Each object must have:
    "text": The full line of lyrics.
    "start": The start time of the line in seconds (float).
    "end": The end time of the line in seconds (float).
    "words": An array of objects for each word in the line, with:
        "word": The word text.
        "start": The start time in seconds (float).
        "end": The end time in seconds (float).

    Do not include any other text, markdown formatting, or explanation. ONLY output valid JSON.
    """
    
    try:
        print("Calling Gemini model...")
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            [prompt, audio_file], 
            request_options={"timeout": 600},
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
        )
        text = response.text.strip()
        
        try:
            lyrics_json = json.loads(text)
            return lyrics_json
        except json.JSONDecodeError as e:
            print(f"JSON parsing failed. Partial output: {text[:500]}...")
            raise Exception("Gemini generated incomplete or invalid data. The song might be too long. Try offline mode.")
    finally:
        try:
            genai.delete_file(audio_file.name)
        except:
            pass
        if compressed_path != file_path and os.path.exists(compressed_path):
            os.remove(compressed_path)


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

# (Removed Windows specific FFMPEG PATHs for Linux compatibility)

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
    mode: Optional[str] = "online"
    romanize: Optional[bool] = False

def format_transcript(result, romanize=False):
    """
    Format standard Whisper output into a clean list of segments
    with word-level timestamps.
    """
    from anyascii import anyascii
    lyrics = []
    segments = result.get("segments", [])
    
    for segment in segments:
        words = segment.get("words", [])
        line_text = segment.get("text", "").strip()
        if romanize:
            line_text = anyascii(line_text)
        
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
                    "word": anyascii(w["word"].strip()) if romanize else w["word"].strip(),
                    "start": w["start"],
                    "end": w["end"]
                } for w in words
            ]
        })
    return lyrics

from fastapi import FastAPI, UploadFile, File, HTTPException, Form

@app.post("/transcribe/upload")
async def transcribe_upload(file: UploadFile = File(...), mode: str = Form("online"), romanize: str = Form("false")):
    is_romanize = romanize.lower() == "true"
    # Save temp file
    temp_filename = f"temp_{file.filename}"
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"Transcribing Upload: {temp_filename} in {mode} mode")
        
        if mode == "online" and check_connection():
            try:
                print("Online mode: Using Gemini...")
                lyrics = generate_lyrics_gemini(temp_filename, romanize=is_romanize)
                return {"lyrics": lyrics}
            except Exception as e:
                print(f"Gemini transcription failed: {e}")
                raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
        else:
            print(f"{'Manual ' if mode == 'offline' else ''}Offline mode: Using Whisper...")
            
        model = get_model()
        # Enable word timestamps!
        result = model.transcribe(temp_filename, word_timestamps=True)
        
        return {"lyrics": format_transcript(result, romanize=is_romanize)}

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

        mode = request.mode
        is_romanize = request.romanize
        print(f"Processing link in {mode} mode (romanize={is_romanize})")

        if mode == "online" and check_connection():
            try:
                print("Online mode: Using Gemini...")
                lyrics = generate_lyrics_gemini(output_path, romanize=is_romanize)
                return {
                    "lyrics": lyrics,
                    "audio_url": f"http://localhost:8000/static/{output_filename}"
                }
            except Exception as e:
                print(f"Gemini transcription failed: {e}")
                raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
        else:
            print(f"{'Manual ' if mode == 'offline' else ''}Offline mode: Using Whisper...")

        print("Transcribing Downloaded File...")
        model = get_model()
        result = model.transcribe(output_path, word_timestamps=True)
        
        return {
            "lyrics": format_transcript(result, romanize=is_romanize), 
            "audio_url": f"http://localhost:8000/static/{output_filename}"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error processing link: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    # Do not delete the file in finally block, so the frontend can play it!

