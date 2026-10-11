import os
from main import generate_lyrics_gemini, compress_audio_for_upload
import yt_dlp

def test_long_audio():
    # Download a 3-4 minute song (Rick Astley - Never Gonna Give You Up)
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    output_filename = "test_long_audio.mp3"
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'test_long_audio.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '32',
        }],
    }
    
    if not os.path.exists(output_filename):
        print("Downloading audio...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    else:
        print("Audio already downloaded.")
        
    print("Testing generate_lyrics_gemini...")
    try:
        lyrics = generate_lyrics_gemini(output_filename, romanize=False)
        print("Gemini Output Success!")
        print("Number of lines:", len(lyrics))
        if len(lyrics) > 0:
            print("First line:", lyrics[0])
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Gemini failed: {e}")

if __name__ == "__main__":
    test_long_audio()
