import os
import sys
import tempfile

# Auto-detect local virtualenv site-packages if run with system python
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_venv_site = os.path.join(_backend_dir, "venv", "lib", f"python{sys.version_info.major}.{sys.version_info.minor}", "site-packages")
if os.path.exists(_venv_site) and _venv_site not in sys.path:
    sys.path.insert(0, _venv_site)

# Configure writable cache directory for Triton and CUDA memory allocation
_triton_cache = os.path.join(tempfile.gettempdir(), ".triton")
os.environ.setdefault("TRITON_HOME", _triton_cache)
os.environ.setdefault("TRITON_CACHE_DIR", os.path.join(_triton_cache, "cache"))
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import shutil
import whisper

# Prevent torchaudio C++ extension load failure on cloud platforms (Render, Hugging Face Spaces)
# This bypasses loading _torchaudio.abi3.so which fails when libcudart is missing on CPU hosts
import types
if "torchaudio._extension" not in sys.modules:
    _ext_mod = types.ModuleType("torchaudio._extension")
    _ext_mod._IS_TORCHAUDIO_EXT_AVAILABLE = False
    _ext_mod._check_cuda_version = lambda: None
    _ext_mod.fail_if_no_align = lambda x: x
    sys.modules["torchaudio._extension"] = _ext_mod

import stable_whisper
import yt_dlp
import subprocess
import socket
import json
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Request
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

def generate_lyrics_gemini(file_path, romanize=False, lyrics: Optional[str] = None):
    compressed_path = compress_audio_for_upload(file_path)
    print("Uploading to Gemini...")
    audio_file = genai.upload_file(path=compressed_path)
    
    romanize_instruction = ""
    if romanize:
        romanize_instruction = "IMPORTANT: You MUST output the lyrics phonetically using the English alphabet (Romanization/Hinglish) instead of the native script."
    else:
        romanize_instruction = "IMPORTANT: Detect the primary language of the song. Transcribe the lyrics accurately in that language's native script (e.g., Devanagari for Hindi)."

    if lyrics and lyrics.strip():
        clean_lines = [line.strip() for line in lyrics.splitlines() if line.strip()]
        lyrics_clean_str = "\n".join(clean_lines)
        print("Gemini: Running forced alignment with provided lyrics...")
        prompt = f"""
        You are given an audio file and its reference unsynced lyrics.
        Your task is FORCED ALIGNMENT: perform strict temporal alignment on the provided lyrics only.
        You MUST align each word in the provided lyrics to its exact start and end timestamps in the audio.
        CRITICAL RULES:
        1. Do NOT transcribe new words.
        2. Do NOT modify, rephrase, add, or omit any words from the reference lyrics.
        3. Do NOT hallucinate any words.
        4. PRESERVE THE EXACT LINE BREAKS: Each line in the provided reference lyrics MUST correspond to exactly ONE line object in the output JSON array with the exact same text. Do NOT merge lines together or split lines.
        {romanize_instruction}
        
        Reference Lyrics:
        {lyrics_clean_str}
        
        Output the aligned lyrics STRICTLY as a JSON array of objects.
        Each object must have:
        "text": The full line of lyrics (matching the reference line exactly).
        "start": The start time of the line in seconds (float).
        "end": The end time of the line in seconds (float).
        "words": An array of objects for each word in the line, with:
            "word": The word text.
            "start": The start time in seconds (float).
            "end": The end time in seconds (float).

        Do not include any other text, markdown formatting, or explanation. ONLY output valid JSON.
        """
        temp = 0.0
    else:
        print("Gemini: Running pure ASR transcription...")
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
        temp = 0.2
    
    try:
        print("Calling Gemini model...")
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            [prompt, audio_file], 
            request_options={"timeout": 600},
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=temp,
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

# Whisper model size (defaults to "small", can be overridden by WHISPER_MODEL env var)
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
model = None

# ZeroGPU support for Hugging Face Spaces
try:
    import spaces
    has_spaces = True
except (ImportError, Exception):
    has_spaces = False

def _whisper_pipeline(whisper_model, audio_path, lyrics=None):
    if lyrics and lyrics.strip():
        print("Offline mode: Running forced alignment via stable-ts model.align()...")
        clean_lines = [line.strip() for line in lyrics.splitlines() if line.strip()]
        clean_text = "\n".join(clean_lines)
        align_kwargs = {
            "original_split": True,
            "max_word_dur": 4.0,
            "nonspeech_skip": 3.0,
        }
        try:
            return whisper_model.align(audio_path, clean_text, language=None, **align_kwargs)
        except TypeError:
            import whisper
            audio = whisper.load_audio(audio_path)
            audio = whisper.pad_or_trim(audio)
            mel = whisper.log_mel_spectrogram(audio).to(whisper_model.device)
            _, probs = whisper_model.detect_language(mel)
            detected_lang = max(probs, key=probs.get)
            return whisper_model.align(audio_path, clean_text, language=detected_lang, **align_kwargs)
    else:
        print("Offline mode: Running standard ASR transcription...")
        return whisper_model.transcribe(audio_path, word_timestamps=True)

if has_spaces:
    try:
        run_whisper_pipeline = spaces.GPU(_whisper_pipeline)
    except Exception:
        run_whisper_pipeline = _whisper_pipeline
else:
    run_whisper_pipeline = _whisper_pipeline

def get_model():
    global model
    if model is None:
        import torch
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        print(f"Loading Whisper model: {MODEL_SIZE} on device: {device.upper()}...")
        model = stable_whisper.load_model(MODEL_SIZE, device=device)
        print("Model loaded.")
    return model

@app.on_event("startup")
async def startup_event():
    # Only preload if PRELOAD_MODEL is explicitly 'true'; lazy load on-demand to protect cloud RAM (e.g. Render 512MB limit)
    if os.getenv("PRELOAD_MODEL", "false").lower() == "true":
        try:
            get_model()
        except Exception as e:
            print(f"Model startup preload warning: {e}")

@app.get("/")
def read_root():
    return {"message": "Lyrics Service Backend is running"}

from anyascii import anyascii

class LinkRequest(BaseModel):
    url: str
    mode: Optional[str] = "online"
    romanize: Optional[bool] = False
    lyrics: Optional[str] = None

def format_transcript(result, romanize=False):
    """
    Format standard Whisper / stable-ts output into a clean list of segments
    with word-level timestamps, enforcing positive durations and avoiding
    over-stretched instrumental pauses.
    """
    if hasattr(result, "to_dict"):
        result = result.to_dict()
    from anyascii import anyascii
    lyrics = []
    segments = result.get("segments", [])
    
    for segment in segments:
        words = segment.get("words", [])
        line_text = segment.get("text", "").strip()
        if not line_text:
            continue
        if romanize:
            line_text = anyascii(line_text)
        
        seg_start = float(segment.get("start", 0.0))
        seg_end = float(segment.get("end", seg_start))
        
        formatted_words = []
        if words:
            for w in words:
                w_text = w.get("word", "").strip()
                if not w_text:
                    continue
                if romanize:
                    w_text = anyascii(w_text)
                w_start = float(w.get("start", seg_start))
                w_end = float(w.get("end", w_start))
                if w_end < w_start:
                    w_end = w_start
                formatted_words.append({
                    "word": w_text,
                    "start": w_start,
                    "end": w_end
                })

            # Word timestamp refinement:
            # If any words collapsed to 0 duration (start == end), interpolate them smoothly
            for idx in range(len(formatted_words)):
                curr_w = formatted_words[idx]
                if curr_w["end"] <= curr_w["start"]:
                    if idx + 1 < len(formatted_words) and formatted_words[idx + 1]["start"] > curr_w["start"]:
                        curr_w["end"] = formatted_words[idx + 1]["start"]
                    else:
                        curr_w["end"] = curr_w["start"] + 0.35

            # Prevent huge instrumental gaps from keeping the line active on screen
            if formatted_words:
                first_word_start = formatted_words[0]["start"]
                last_word_end = formatted_words[-1]["end"]
                if first_word_start < seg_start:
                    seg_start = first_word_start
                if seg_end > last_word_end + 2.0:
                    seg_end = last_word_end + 1.0

        if seg_end <= seg_start:
            seg_end = seg_start + 1.5

        lyrics.append({
            "text": line_text,
            "start": round(seg_start, 2),
            "end": round(seg_end, 2),
            "words": [
                {
                    "word": w["word"],
                    "start": round(w["start"], 2),
                    "end": round(w["end"], 2)
                } for w in formatted_words
            ]
        })
    return lyrics

from fastapi import FastAPI, UploadFile, File, HTTPException, Form

@app.post("/transcribe/upload")
async def transcribe_upload(
    file: UploadFile = File(...), 
    mode: str = Form("online"), 
    romanize: str = Form("false"),
    lyrics: Optional[str] = Form(None)
):
    is_romanize = romanize.lower() == "true"
    cleaned_lyrics = lyrics.strip() if lyrics and lyrics.strip() else None
    # Save temp file
    temp_filename = f"temp_{file.filename}"
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"Transcribing Upload: {temp_filename} in {mode} mode (forced_alignment={cleaned_lyrics is not None})")
        
        if mode == "online" and check_connection():
            try:
                print("Online mode: Using Gemini...")
                lyrics_data = generate_lyrics_gemini(temp_filename, romanize=is_romanize, lyrics=cleaned_lyrics)
                return {"lyrics": lyrics_data}
            except Exception as e:
                print(f"Gemini transcription failed: {e}")
                raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
        else:
            print(f"{'Manual ' if mode == 'offline' else ''}Offline mode: Using Whisper...")
            
        model = get_model()
        result = run_whisper_pipeline(model, temp_filename, lyrics=cleaned_lyrics)
        
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
async def transcribe_link(request: LinkRequest, http_request: Request):
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
        cleaned_lyrics = request.lyrics.strip() if request.lyrics and request.lyrics.strip() else None
        print(f"Processing link in {mode} mode (romanize={is_romanize}, forced_alignment={cleaned_lyrics is not None})")

        base_url = os.getenv("BASE_URL", str(http_request.base_url).rstrip("/"))
        audio_url = f"{base_url}/static/{output_filename}"

        if mode == "online" and check_connection():
            try:
                print("Online mode: Using Gemini...")
                lyrics_data = generate_lyrics_gemini(output_path, romanize=is_romanize, lyrics=cleaned_lyrics)
                return {
                    "lyrics": lyrics_data,
                    "audio_url": audio_url
                }
            except Exception as e:
                print(f"Gemini transcription failed: {e}")
                raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
        else:
            print(f"{'Manual ' if mode == 'offline' else ''}Offline mode: Using Whisper...")

        print("Transcribing Downloaded File...")
        model = get_model()
        result = run_whisper_pipeline(model, output_path, lyrics=cleaned_lyrics)
        
        return {
            "lyrics": format_transcript(result, romanize=is_romanize), 
            "audio_url": audio_url
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error processing link: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    # Do not delete the file in finally block, so the frontend can play it!

