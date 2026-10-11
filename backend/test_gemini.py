import os
from main import generate_lyrics_gemini, compress_audio_for_upload
import yt_dlp

def test_gemini():
    # Download a tiny audio file using yt_dlp (like "Me at the zoo" again)
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'test_audio.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    
    print("Downloaded audio.")
    try:
        lyrics = generate_lyrics_gemini("test_audio.mp3", romanize=False)
        print("Gemini Output Success!")
        print("Number of lines:", len(lyrics))
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Gemini failed: {e}")

if __name__ == "__main__":
    test_gemini()
