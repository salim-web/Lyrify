"use client";

import React, { useRef, useEffect, useState, useId } from "react";
import { Sparkles, Radio, Check } from "lucide-react";

interface LiquidLoaderProps {
    mode: "online" | "offline";
    hasLyrics: boolean;
    songTitle?: string;
}

export default function LiquidLoader({ mode, hasLyrics }: LiquidLoaderProps) {
    const rawId = useId();
    const id = rawId.replace(/[^a-zA-Z0-9]/g, "");
    const gradientId = `liquid-grad-${id}`;
    const filterId = `liquid-goo-${id}`;
    const auraCanvasRef = useRef<HTMLCanvasElement>(null);

    const [progress, setProgress] = useState(14);
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
              "DECODING AUDIO WAVEFORM",
              "EXTRACTING LOG-MEL ACOUSTIC EMBEDDINGS",
              "GENERATING HIGH-CONFIDENCE TRANSCRIPT",
              "CROSS-ATTENTION SYLLABLE TIMESTAMPING",
              "BUILDING SYNCHRONIZED PLAYBACK MAP",
          ];

    // Progress Simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 94) return 94;
                return Math.min(94, prev + Math.floor(Math.random() * 5) + 3);
            });
        }, 550);

        const phaseInterval = setInterval(() => {
            setPhaseIndex((prev) => (prev + 1) % phases.length);
        }, 1800);

        return () => {
            clearInterval(interval);
            clearInterval(phaseInterval);
        };
    }, [phases.length]);

    // WebGL Shader Aura from Framer Liquid_Loader
    useEffect(() => {
        const canvas = auraCanvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
        if (!gl) return;

        const vs = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fs = `
            precision mediump float;
            uniform vec2 u_resolution;
            uniform float u_time;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 3; i++) {
                    v += a * noise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = uv - 0.5;
                p.x *= u_resolution.x / u_resolution.y;

                float t = u_time * 0.12;
                float r = length(p);
                float n = fbm(p * 2.8 + vec2(t, -t));

                float hollow = smoothstep(0.07, 0.22, r);
                float ring = smoothstep(0.35, 0.08, abs(r - 0.24 - n * 0.04));
                float outer = smoothstep(0.60, 0.16, r);

                // Palette: Peach/Orange -> Rose/Pink -> Purple/Violet
                vec3 colA = vec3(0.98, 0.57, 0.23); // #FB923C
                vec3 colB = vec3(0.95, 0.24, 0.36); // #F43F5E
                vec3 colC = vec3(0.65, 0.33, 0.96); // #A855F7

                vec3 color = mix(colA, colB, n);
                color = mix(color, colC, smoothstep(0.2, 0.85, r + n * 0.2));

                float alpha = (ring * 0.28 + outer * 0.09) * hollow;
                alpha *= smoothstep(0.68, 0.0, r);

                gl_FragColor = vec4(color, alpha * 0.65);
            }
        `;

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type);
            if (!s) return null;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        };

        const vShader = compile(gl.VERTEX_SHADER, vs);
        const fShader = compile(gl.FRAGMENT_SHADER, fs);
        if (!vShader || !fShader) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);
        gl.useProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );

        const posLoc = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const uRes = gl.getUniformLocation(program, "u_resolution");
        const uTime = gl.getUniformLocation(program, "u_time");

        let animId: number;
        const render = (time: number) => {
            if (canvas.width !== 320 || canvas.height !== 320) {
                canvas.width = 320;
                canvas.height = 320;
                gl.viewport(0, 0, 320, 320);
            }

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, time * 0.001);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animId);
            gl.deleteProgram(program);
            gl.deleteShader(vShader);
            gl.deleteShader(fShader);
            gl.deleteBuffer(buf);
        };
    }, []);

    // Morphing path curves from Framer Liquid_Loader
    const pathA = "m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64";
    const pathB = "m 162,96 c 2,-33 -24,-62 -60,-66 -39,-4 -67,25 -68,62 -1,38 27,69 65,68 34,-1 66,-22 66,-61 0,-35 -23,-65 -62,-66 -36,-1 -69,24 -68,65 1,39 29,64 65,65 39,1 62,-67 62,-67";
    const pathC = "m 166,104 c -2,-38 -31,-66 -68,-64 -33,2 -62,29 -61,64 1,38 30,63 66,62 39,-1 61,-30 60,-66 -1,-40 -30,-62 -66,-61 -38,1 -63,28 -62,64 1,35 26,64 66,63 36,-1 65,-62 65,-62";

    return (
        <div className="relative w-full min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white selection:bg-neutral-700 selection:text-white overflow-hidden">
            <style>{`
                @keyframes dash-liquid-${id} {
                    from { stroke-dashoffset: 0; }
                    to { stroke-dashoffset: -403px; }
                }
                @keyframes pulse-liquid-${id} {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.02); opacity: 0.94; }
                }
                @keyframes float-particle-${id} {
                    0%, 100% { opacity: 0.2; transform: scale(0.85); }
                    50% { opacity: 0.85; transform: scale(1.15); }
                }
            `}</style>

            {/* Central Liquid Loader Stage */}
            <div className="relative w-72 h-72 flex items-center justify-center">
                {/* 1. Underlying WebGL Shader Aura */}
                <canvas
                    ref={auraCanvasRef}
                    className="absolute w-80 h-80 pointer-events-none"
                    style={{ filter: "blur(14px) saturate(1.2)", opacity: 0.7 }}
                />

                {/* 2. SVG Filters & Gradients Definition */}
                <svg width="0" height="0" className="absolute">
                    <defs>
                        {/* Gooey filter */}
                        <filter id={filterId}>
                            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                            <feColorMatrix
                                in="blur"
                                mode="matrix"
                                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                                result="goo"
                            />
                            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                        </filter>

                        {/* Animated Gradient with Peach -> Pink -> Purple */}
                        <linearGradient id={gradientId} x1="24" y1="24" x2="176" y2="176" gradientUnits="userSpaceOnUse">
                            <animate attributeName="x1" values="24;170;48;24" dur="2.4s" repeatCount="indefinite" />
                            <animate attributeName="y1" values="24;70;170;24" dur="2.4s" repeatCount="indefinite" />
                            <animate attributeName="x2" values="176;30;150;176" dur="2.4s" repeatCount="indefinite" />
                            <animate attributeName="y2" values="176;150;30;176" dur="2.4s" repeatCount="indefinite" />
                            <stop offset="0%" stopColor="#FB923C" />
                            <stop offset="50%" stopColor="#F43F5E" />
                            <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* 3. Orbiting Liquid Droplet Particles */}
                <svg
                    width="220"
                    height="220"
                    viewBox="0 0 200 200"
                    className="absolute pointer-events-none"
                    style={{
                        animation: `dash-liquid-${id} 22s infinite linear`,
                        filter: `url(#${filterId}) drop-shadow(0 0 14px rgba(244, 63, 94, 0.45))`,
                    }}
                >
                    <g style={{ transformOrigin: "100px 100px" }}>
                        {[0, 1, 2, 3, 4, 5].map((i) => {
                            const angle = (i / 6) * Math.PI * 2;
                            const radius = 64 + (i % 2 === 0 ? 3 : -3);
                            const px = 100 + Math.cos(angle) * radius;
                            const py = 100 + Math.sin(angle) * radius;
                            return (
                                <circle
                                    key={i}
                                    cx={px}
                                    cy={py}
                                    r={6 + (i % 3) * 1.5}
                                    fill={`url(#${gradientId})`}
                                    style={{
                                        transformOrigin: `${px}px ${py}px`,
                                        animation: `float-particle-${id} ${2.5 + (i % 3) * 0.4}s ${i * 0.2}s infinite ease-in-out`,
                                    }}
                                />
                            );
                        })}
                    </g>
                </svg>

                {/* 4. Main Morphing Liquid Ring (SVG with Goo Filter) */}
                <svg
                    width="220"
                    height="220"
                    viewBox="0 0 200 200"
                    className="absolute pointer-events-none"
                    style={{
                        filter: `url(#${filterId}) drop-shadow(0 0 22px rgba(244, 63, 94, 0.55))`,
                    }}
                >
                    <g
                        style={{
                            transformOrigin: "100px 100px",
                            animation: `pulse-liquid-${id} 2.6s infinite ease-in-out`,
                        }}
                    >
                        {/* Main morphing path */}
                        <path
                            d={pathA}
                            fill="none"
                            stroke={`url(#${gradientId})`}
                            strokeWidth="22"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="180 820"
                            style={{ animation: `dash-liquid-${id} 2.2s infinite linear` }}
                        >
                            <animate
                                attributeName="d"
                                values={`${pathA};${pathB};${pathC};${pathA}`}
                                dur="3.6s"
                                repeatCount="indefinite"
                            />
                        </path>

                        {/* Secondary trailing dash circle */}
                        <circle
                            cx="100"
                            cy="100"
                            r="64"
                            fill="none"
                            stroke={`url(#${gradientId})`}
                            strokeWidth="18"
                            strokeLinecap="round"
                            strokeDasharray="30 70"
                            opacity="0.8"
                            style={{ animation: `dash-liquid-${id} 3.2s infinite linear` }}
                        />
                    </g>
                </svg>
            </div>

            {/* Status Telemetry & Progress Readout */}
            <div className="mt-8 flex flex-col items-center text-center space-y-3 z-10 max-w-sm">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/80 border border-white/10 text-xs font-mono tracking-wider text-neutral-300 backdrop-blur-md">
                    {mode === "online" ? (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                        <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{mode === "online" ? "GEMINI 2.5 FLASH" : "LOCAL WHISPER"}</span>
                    <span className="text-neutral-500">•</span>
                    <span className="text-neutral-400">{hasLyrics ? "FORCED ALIGNMENT" : "TRANSCRIBING"}</span>
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-mono tracking-wide text-neutral-300 uppercase transition-all duration-300">
                        {phases[phaseIndex]}
                    </p>
                    <p className="text-xs text-neutral-500 font-mono">
                        {hasLyrics
                            ? "Strict phonetic alignment against staged lyrics"
                            : "Word-level acoustic timestamp estimation"}
                    </p>
                </div>

                {/* Clean Progress Meter */}
                <div className="w-48 space-y-1.5 pt-2">
                    <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-400 via-rose-500 to-purple-500 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                        <span>LATTICE_SYNC</span>
                        <span>{progress}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

