"use client";

import { useState, useRef } from "react";
import axios from "axios";
import {
  Upload,
  Link as LinkIcon,
  Music,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles,
  Radio,
  Check,
  Download,
  Copy,
} from "lucide-react";
import LiquidHero from "@/components/LiquidHero";
import LiquidMetalButton from "@/components/ui/LiquidMetalButton";
import LiquidLoader from "@/components/LiquidLoader";
import LyricsView from "@/components/LyricsView";
import Player from "@/components/Player";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

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
  const [transcribeMode, setTranscribeMode] = useState<"online" | "offline">("online");
  const [lyricsInput, setLyricsInput] = useState("");
  const [showLyricsInput, setShowLyricsInput] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSeek = (time: number) => {
    setSeekTo(time);
    setTimeout(() => setSeekTo(null), 100);
  };

  const showNotification = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2400);
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
    formData.append("mode", transcribeMode);
    if (lyricsInput.trim()) {
      formData.append("lyrics", lyricsInput.trim());
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/transcribe/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLyrics(response.data.lyrics);
    } catch (error: any) {
      console.error("Upload error:", error);
      const msg = error.response?.data?.detail || "Failed to transcribe audio.";
      alert(`Error: ${msg}`);
      setAudioSrc(null);
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
    setAudioSrc(null);

    try {
      const payload: { url: string; romanize: boolean; mode: "online" | "offline"; lyrics?: string } = {
        url,
        romanize,
        mode: transcribeMode,
      };
      if (lyricsInput.trim()) {
        payload.lyrics = lyricsInput.trim();
      }

      const response = await axios.post(`${API_BASE_URL}/transcribe/link`, payload);
      setLyrics(response.data.lyrics);

      if (response.data.audio_url) {
        const fullAudioUrl = response.data.audio_url.startsWith("http")
          ? response.data.audio_url
          : `${API_BASE_URL}${response.data.audio_url.startsWith("/") ? "" : "/"}${response.data.audio_url}`;
        setAudioSrc(fullAudioUrl);
      } else {
        setAudioSrc(`${API_BASE_URL}/static/temp_download.mp3?t=${Date.now()}`);
      }
    } catch (error: any) {
      console.error("Link error:", error);
      const msg = error.response?.data?.detail || "Failed to process link. Ensure backend is running.";
      alert(`Error: ${msg}`);
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
    return lyrics
      .map((line: any) => {
        return `[${formatTime(line.start)}] ${line.text}`;
      })
      .join("\n");
  };

  const generateEnhancedLRC = () => {
    return lyrics
      .map((line: any) => {
        const lineTime = `[${formatTime(line.start)}]`;
        const words = line.words?.map((w: any) => `<${formatTime(w.start)}> ${w.word}`).join(" ") || line.text;
        return `${lineTime} ${words}`;
      })
      .join("\n");
  };

  const handleCopyLRC = () => {
    navigator.clipboard.writeText(generateLRC());
    showNotification("Standard LRC copied to clipboard!");
  };

  const handleCopyEnhancedLRC = () => {
    navigator.clipboard.writeText(generateEnhancedLRC());
    showNotification("Word-level LRC copied!");
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(lyrics, null, 2));
    showNotification("Full JSON Data copied!");
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
    showNotification("Downloaded lyrics.lrc");
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-neutral-800 selection:text-white flex flex-col items-center justify-center relative overflow-x-hidden">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed top-4 sm:top-6 z-50 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-neutral-900/95 border border-white/20 text-white text-[11px] sm:text-xs font-mono tracking-wide shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          {copyFeedback}
        </div>
      )}

      {/* 1. Ingestion / Landing Page with LiquidHero (Procedural Horizon with New Color Scheme) */}
      {!audioSrc && !isLoading && (
        <LiquidHero>
          <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center space-y-5 sm:space-y-8 py-4 sm:py-10 px-3 sm:px-4">
            {/* Title & Badge */}
            <div className="space-y-2 sm:space-y-3">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs font-mono tracking-wider text-neutral-300 uppercase backdrop-blur-md">
                <Music className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                Audio Alignment & Transcription
              </div>
              <h1 className="text-4xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent drop-shadow-sm select-none">
                Lyrify
              </h1>
              <p className="text-xs sm:text-base text-neutral-400 max-w-md mx-auto leading-relaxed px-1">
                Transform any track into fluid, word-synced karaoke lyrics with forced alignment and Romanization.
              </p>
            </div>

            {/* Controls Bar: Engine Selector & Romanization */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full">
              <div className="flex items-center gap-1 sm:gap-2 p-1 rounded-2xl bg-neutral-900/80 border border-white/10 backdrop-blur-md shadow-inner">
                <LiquidMetalButton
                  size="sm"
                  variant={transcribeMode === "online" ? "light" : "dark"}
                  active={transcribeMode === "online"}
                  onClick={() => setTranscribeMode("online")}
                  icon={<Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />}
                >
                  <span className="hidden sm:inline">Online (Gemini 2.5)</span>
                  <span className="sm:hidden">Online (Gemini)</span>
                </LiquidMetalButton>

                <LiquidMetalButton
                  size="sm"
                  variant={transcribeMode === "offline" ? "emerald" : "dark"}
                  active={transcribeMode === "offline"}
                  onClick={() => setTranscribeMode("offline")}
                  icon={<Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />}
                >
                  <span className="hidden sm:inline">Offline (Whisper)</span>
                  <span className="sm:hidden">Offline (Whisper)</span>
                </LiquidMetalButton>
              </div>

              <LiquidMetalButton
                size="sm"
                variant={romanize ? "emerald" : "dark"}
                active={romanize}
                onClick={() => setRomanize(!romanize)}
                icon={romanize ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> : undefined}
              >
                <span className="hidden sm:inline">Romanize (Hinglish)</span>
                <span className="sm:hidden">Romanize</span>
              </LiquidMetalButton>
            </div>

            {/* Unsynced Lyrics Collapsible Card */}
            <div className="w-full max-w-md">
              <button
                type="button"
                onClick={() => setShowLyricsInput(!showLyricsInput)}
                className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-neutral-900/60 hover:bg-neutral-900/90 border border-white/10 text-[11px] sm:text-xs font-semibold text-neutral-300 transition-all backdrop-blur-md group"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300 group-hover:scale-110 transition-transform" />
                  Paste Unsynced Lyrics (Optional)
                  {lyricsInput.trim() && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </span>
                <span className="text-neutral-400 text-[11px] sm:text-xs font-normal flex items-center gap-1 sm:gap-1.5">
                  {lyricsInput.trim() ? "Lyrics Staged" : showLyricsInput ? "Hide" : "Add Lyrics"}
                  {showLyricsInput ? <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                </span>
              </button>

              {showLyricsInput && (
                <div className="mt-2 space-y-2 text-left bg-neutral-950/80 p-3 rounded-2xl border border-white/10 backdrop-blur-lg animate-fade-in">
                  <textarea
                    value={lyricsInput}
                    onChange={(e) => setLyricsInput(e.target.value)}
                    placeholder="Paste original lyrics here for strict forced alignment..."
                    rows={3}
                    className="w-full p-2.5 sm:p-3 rounded-xl bg-black/70 border border-white/10 focus:border-white/30 focus:outline-none text-xs text-neutral-200 placeholder-neutral-500 transition-colors resize-y font-mono"
                  />
                  {lyricsInput.trim() && (
                    <div className="flex justify-between items-center text-[11px] sm:text-xs text-neutral-400 px-1">
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Forced Alignment active
                      </span>
                      <button
                        type="button"
                        onClick={() => setLyricsInput("")}
                        className="text-neutral-500 hover:text-neutral-300 underline"
                      >
                        Clear lyrics
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ingestion Triggers: Upload & YouTube Link */}
            <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-md">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Upload Trigger Button */}
              <LiquidMetalButton
                size="lg"
                variant="dark"
                icon={<Upload className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                onClick={() => fileInputRef.current?.click()}
                className="w-full justify-center py-2.5 sm:py-3.5 text-white"
              >
                <span className="hidden sm:inline">Upload Audio File (MP3, WAV, M4A)</span>
                <span className="sm:hidden">Upload Audio File</span>
              </LiquidMetalButton>

              {/* Divider */}
              <div className="relative py-0.5 sm:py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[9px] sm:text-[10px] tracking-wider uppercase">
                  <span className="bg-black px-2.5 sm:px-3 text-neutral-500 font-mono">Or paste audio link</span>
                </div>
              </div>

              {/* Link Input Form */}
              <form onSubmit={handleLinkSubmit} className="flex gap-2 w-full">
                <div className="relative flex-1 min-w-0">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="Paste YouTube or Audio URL"
                    className="w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 rounded-2xl bg-neutral-900/70 border border-white/10 focus:border-white/30 focus:outline-none transition-colors text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 backdrop-blur-md"
                  />
                </div>
                <LiquidMetalButton
                  type="submit"
                  size="md"
                  variant="light"
                  className="px-4 sm:px-6 shrink-0"
                >
                  Go
                </LiquidMetalButton>
              </form>
            </div>
          </div>
        </LiquidHero>
      )}

      {/* 2. Loading State Screen with LiquidLoader (Image 3 Component) */}
      {isLoading && (
        <LiquidLoader
          mode={transcribeMode}
          hasLyrics={Boolean(lyricsInput.trim())}
        />
      )}

      {/* 3. Lyrics View & Audio Playback Screen with Animated ShaderFlow behind Frosted Glass */}
      {audioSrc && !isLoading && (
        <div className="w-full max-w-5xl flex flex-col items-center justify-between min-h-screen p-3 sm:p-6 pb-24 sm:pb-24">
          {/* Header Controls: Back & Export Actions */}
          <div className="w-full flex flex-wrap justify-between items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <LiquidMetalButton
              size="sm"
              variant="ghost"
              icon={<ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              onClick={() => {
                setAudioSrc(null);
                setLyrics([]);
                setIsPlaying(false);
              }}
            >
              Back
            </LiquidMetalButton>

            {lyrics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <LiquidMetalButton
                  size="sm"
                  variant="dark"
                  icon={<Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-400" />}
                  onClick={handleCopyLRC}
                >
                  <span className="hidden sm:inline">Copy Standard</span>
                  <span className="sm:hidden">Standard</span>
                </LiquidMetalButton>

                <LiquidMetalButton
                  size="sm"
                  variant="dark"
                  icon={<Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-400" />}
                  onClick={handleCopyEnhancedLRC}
                >
                  <span className="hidden sm:inline">Copy Word-LRC</span>
                  <span className="sm:hidden">Word-LRC</span>
                </LiquidMetalButton>

                <LiquidMetalButton
                  size="sm"
                  variant="dark"
                  icon={<Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-400" />}
                  onClick={handleCopyJSON}
                >
                  <span className="hidden sm:inline">Copy JSON</span>
                  <span className="sm:hidden">JSON</span>
                </LiquidMetalButton>

                <LiquidMetalButton
                  size="sm"
                  variant="light"
                  icon={<Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  onClick={handleDownloadLRC}
                >
                  <span className="hidden sm:inline">Download .lrc</span>
                  <span className="sm:hidden">.LRC</span>
                </LiquidMetalButton>
              </div>
            )}
          </div>

          {/* Lyrics View Canvas with Animated ShaderFlow behind Frosted Glass */}
          <div className="w-full flex-1 flex items-center justify-center py-2 sm:py-4">
            {lyrics.length > 0 ? (
              <LyricsView
                lyrics={lyrics}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={handleSeek}
              />
            ) : (
              <div className="text-neutral-500 font-mono text-xs sm:text-sm">No lyrics found for this audio track.</div>
            )}
          </div>

          {/* Sticky Audio Player */}
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
        </div>
      )}
    </main>
  );
}
