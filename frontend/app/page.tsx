"use client";

import { useState } from "react";
import axios from "axios";
import { Upload, Link as LinkIcon, Music, Loader2 } from "lucide-react";
import LyricsView from "@/components/LyricsView";
import Player from "@/components/Player";

export default function Home() {
  const [lyrics, setLyrics] = useState([]);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [romanize, setRomanize] = useState(false);
  const [language, setLanguage] = useState<string>("");
  const [seekTo, setSeekTo] = useState<number | null>(null);

  const handleSeek = (time: number) => {
    setSeekTo(time);
    setTimeout(() => setSeekTo(null), 100);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create object URL for local playback
    const objectUrl = URL.createObjectURL(file);
    setAudioSrc(objectUrl);
    setLyrics([]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("romanize", romanize.toString());

    try {
      const response = await axios.post("http://localhost:8000/transcribe/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLyrics(response.data.lyrics);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to transcribe audio.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get("url") as string;
    if (!url) return;

    setIsLoading(true);
    setLyrics([]);
    setAudioSrc(null); // Clear previous

    try {
      const response = await axios.post("http://localhost:8000/transcribe/link", {
        url,
        romanize
      });
      setLyrics(response.data.lyrics);

      // Use the unique URL returned by the backend
      if (response.data.audio_url) {
        setAudioSrc(response.data.audio_url);
      } else {
        // Fallback (shouldn't happen with new backend)
        setAudioSrc(`http://localhost:8000/static/temp_download.mp3?t=${Date.now()}`);
      }

    } catch (error) {
      console.error("Link error:", error);
      alert("Failed to process link. Ensure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const hundredths = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
  };

  const generateLRC = () => {
    return lyrics.map((line: any) => {
      return `[${formatTime(line.start)}] ${line.text}`;
    }).join("\n");
  };

  const generateEnhancedLRC = () => {
    return lyrics.map((line: any) => {
      const lineTime = `[${formatTime(line.start)}]`;
      const words = line.words.map((w: any) => `<${formatTime(w.start)}> ${w.word}`).join(" ");
      return `${lineTime} ${words}`;
    }).join("\n");
  };

  const handleCopyLRC = () => {
    navigator.clipboard.writeText(generateLRC());
    alert("Standard LRC copied to clipboard!");
  };

  const handleCopyEnhancedLRC = () => {
    navigator.clipboard.writeText(generateEnhancedLRC());
    alert("Enhanced LRC (Word-level) copied!");
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(lyrics, null, 2));
    alert("Full JSON Data copied!");
  };

  const handleDownloadLRC = () => {
    const lrc = generateLRC();
    const blob = new Blob([lrc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lyrics.lrc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Background Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pink-900/30 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="z-10 w-full max-w-5xl flex flex-col items-center justify-center min-h-screen p-4">

        {!audioSrc && !isLoading && (
          <div className="text-center space-y-10 animate-fade-in w-full">
            <h1 className="text-6xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
              LyricsAI
            </h1>
            <p className="text-xl text-gray-400 max-w-lg mx-auto">
              Experience your music with word-by-word time-synced lyrics.
            </p>

            <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
              {/* File Upload */}
              <label className="flex items-center justify-center gap-3 w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all group">
                <Upload className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Upload Audio File</span>
                <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              </label>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-black px-2 text-gray-500">Or paste link</span>
                </div>
              </div>

              {/* Link Input */}
              <form onSubmit={handleLinkSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    name="url"
                    type="url"
                    placeholder="Paste YouTube Link"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-pink-500 focus:outline-none transition-colors"
                  />
                </div>
                <button type="submit" className="px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold transition-colors">
                  Go
                </button>
              </form>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
            <p className="text-lg font-medium text-gray-300">Generating Lyrics...</p>
            <p className="text-sm text-gray-500">This might take a moment.</p>
          </div>
        )}

        {audioSrc && !isLoading && (
          <>
            {/* Header Controls */}
            <div className="w-full flex justify-between items-center mb-4">
              <button
                onClick={() => { setAudioSrc(null); setLyrics([]); setIsPlaying(false); }}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                ← Back
              </button>

              {lyrics.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyLRC}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5"
                  >
                    Copy Standard
                  </button>
                  <button
                    onClick={handleCopyEnhancedLRC}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5"
                  >
                    Copy Word-LRC
                  </button>
                  <button
                    onClick={handleCopyJSON}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5"
                  >
                    Copy JSON
                  </button>
                  <div className="w-px bg-white/10 mx-1"></div>
                  <button
                    onClick={handleDownloadLRC}
                    className="px-3 py-1.5 text-xs bg-pink-600 hover:bg-pink-500 rounded-lg transition-colors font-bold"
                  >
                    Download .lrc
                  </button>
                </div>
              )}
            </div>


            <div className="w-full flex-1 flex items-center justify-center py-10">
              {lyrics.length > 0 ? (
                <LyricsView
                  lyrics={lyrics}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              ) : (
                <div className="text-gray-500">No lyrics found.</div>
              )}
            </div>

            <Player
              audioSrc={audioSrc}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              duration={duration}
              setDuration={setDuration}
              seekTo={seekTo}
            />
          </>
        )}
      </div>
    </main>
  );
}
