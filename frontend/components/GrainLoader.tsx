"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Terminal, Activity, Cpu } from "lucide-react";

interface GrainLoaderProps {
    mode: "online" | "offline";
    hasLyrics: boolean;
    songTitle?: string;
}

export default function GrainLoader({
    mode,
    hasLyrics,
    songTitle,
}: GrainLoaderProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [progress, setProgress] = useState(12);
    const [phaseIndex, setPhaseIndex] = useState(0);

    const phases = hasLyrics
        ? [
              "INITIALIZING FORCED ALIGNMENT MATRIX",
              "SPECTROGRAM TEMPORAL LATTICE COMPUTING",
              "STRICT PHONETIC SYLLABLE MATCHING",
              "INTERPOLATING WORD-LEVEL BOUNDARIES",
              "FINALIZING TIME-ALIGNED LRC STRUCTURE",
          ]
        : [
              "DECODING 16KHZ AUDIO WAVEFORM",
              "EXTRACTING LOG-MEL ACOUSTIC EMBEDDINGS",
              "GENERATING HIGH-CONFIDENCE TRANSCRIPT",
              "CROSS-ATTENTION SYLLABLE TIMESTAMPING",
              "BUILDING SYNCHRONIZED PLAYBACK MAP",
          ];

    // Simulated progress increment loop
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 94) return 94; // Wait for real network response to finish
                const jump = Math.floor(Math.random() * 6) + 3;
                return Math.min(94, prev + jump);
            });
        }, 500);

        const phaseInterval = setInterval(() => {
            setPhaseIndex((prev) => (prev + 1) % phases.length);
        }, 1600);

        return () => {
            clearInterval(interval);
            clearInterval(phaseInterval);
        };
    }, [phases.length]);

    // CRT Noise Grain Canvas loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animId: number;
        const width = 320;
        const height = 180;
        canvas.width = width;
        canvas.height = height;

        const imgData = ctx.createImageData(width, height);
        const data32 = new Uint32Array(imgData.data.buffer);

        const render = () => {
            if (document.hidden) {
                animId = requestAnimationFrame(render);
                return;
            }

            // High frequency CRT static noise
            for (let i = 0; i < data32.length; i++) {
                const lum = (Math.random() * 255) | 0;
                // Add faint cyan/amber CRT tint variations
                data32[i] = (lum << 24) | (lum << 16) | (lum << 8) | lum;
            }

            ctx.putImageData(imgData, 0, 0);
            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animId);
        };
    }, []);

    // Build block ASCII progress bar (total 20 blocks)
    const totalBlocks = 20;
    const filledBlocks = Math.round((progress / 100) * totalBlocks);
    const progressBar =
        "█".repeat(filledBlocks) + "░".repeat(Math.max(0, totalBlocks - filledBlocks));

    return (
        <div className="relative w-full max-w-xl mx-auto flex flex-col items-center justify-center p-6 select-none animate-fade-in">
            {/* CRT Monitor Outer Chassis */}
            <div className="relative w-full rounded-2xl border border-white/20 bg-black/90 p-5 shadow-2xl shadow-pink-950/20 backdrop-blur-xl overflow-hidden">
                {/* Background CRT Grain Texture */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-[0.09] mix-blend-screen"
                />

                {/* CRT Horizontal Scanlines Overlay */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.75) 50%)",
                        backgroundSize: "100% 4px",
                    }}
                />

                {/* CRT Monitor Glass Vignette & Scanline Flicker */}
                <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-transparent via-black/30 to-black/80" />

                {/* Corner Tech Brackets */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-pink-500/60" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-pink-500/60" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-pink-500/60" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-pink-500/60" />

                {/* Terminal Header */}
                <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-pink-400 animate-pulse" />
                        <span className="font-mono text-xs uppercase tracking-widest text-pink-400 font-bold">
                            Lyrify Spectral Engine // v2.5
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">
                            CUDA CORE ACTIVE
                        </span>
                    </div>
                </div>

                {/* Song / File info tag if present */}
                {songTitle && (
                    <div className="relative z-10 font-mono text-xs text-gray-400 truncate mb-3 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                        <span className="text-pink-400">AUDIO_SRC:</span> {songTitle}
                    </div>
                )}

                {/* Monospace Metadata Display */}
                <div className="relative z-10 space-y-2 font-mono text-xs">
                    <div className="flex justify-between items-center text-gray-400">
                        <span>PIPELINE ENGINE:</span>
                        <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded">
                            {mode === "online" ? "GEMINI 2.5 FLASH" : "LOCAL WHISPER (GTX 1650)"}
                        </span>
                    </div>

                    <div className="flex justify-between items-center text-gray-400">
                        <span>TASK METHOD:</span>
                        <span className="text-pink-300 font-semibold">
                            {hasLyrics ? "FORCED ALIGNMENT (NO HALLUCINATION)" : "PURE TEMPORAL ASR"}
                        </span>
                    </div>

                    <div className="flex justify-between items-center text-gray-400">
                        <span>SUB-SECOND PRECISION:</span>
                        <span className="text-emerald-400 font-mono">±0.02s [WORD-LEVEL]</span>
                    </div>
                </div>

                {/* CRT Terminal Screen Progress Section */}
                <div className="relative z-10 mt-6 pt-4 border-t border-white/10 space-y-3 font-mono">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-300 tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                            {phases[phaseIndex]}
                        </span>
                        <span className="text-pink-400 font-bold text-sm">
                            {progress}%
                        </span>
                    </div>

                    {/* Monospace Block Progress Bar */}
                    <div className="w-full text-pink-400 font-mono text-sm tracking-widest bg-black/60 p-2.5 rounded-lg border border-pink-500/20 shadow-inner flex justify-center overflow-x-auto whitespace-pre">
                        [ {progressBar} ]
                    </div>
                </div>

                {/* Live Status Ticker */}
                <div className="relative z-10 mt-4 flex items-center justify-between text-[10px] font-mono text-gray-500 pt-2 border-t border-white/5">
                    <span>STATUS: ANALYZING SPECTROGRAM</span>
                    <span className="flex items-center gap-1 text-pink-400/80">
                        <Cpu className="w-3 h-3" />
                        PROCESSING STREAM
                    </span>
                </div>
            </div>
        </div>
    );
}

