"use client";

import React, { useRef, useEffect, useCallback } from "react";

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_strength;
uniform float u_speed;
uniform vec2 u_resolution;

#define MAX_WAKE 16
uniform int u_wakeCount;
uniform vec3 u_wake[MAX_WAKE]; // x, y, t
uniform float u_maskRadius;
uniform float u_colorReveal;

void main() {
    vec2 uv = v_uv;
    
    // Continuous subtle ambient wave across the horizon
    float ambientX = sin(uv.y * 10.0 + u_time * 0.7) * 0.007;
    float ambientY = cos(uv.x * 9.0 + u_time * 0.5) * 0.005;
    uv += vec2(ambientX, ambientY) * u_strength;

    // Wake ripples from pointer motion
    for (int i = 0; i < MAX_WAKE; ++i) {
        if (i >= u_wakeCount) break;
        vec2 w = u_wake[i].xy;
        float t = u_time - u_wake[i].z;
        float dist = distance(uv, w);
        float amp = exp(-dist * 14.0) * exp(-t * 1.3);
        float ripple = sin(32.0 * dist - t * 8.0 * u_speed) * 0.04;
        uv += normalize(uv - w + vec2(0.0001)) * ripple * u_strength * amp * 2.8;
    }

    // Active live pointer ripple
    if (u_mouse.x >= 0.0 && u_mouse.x <= 1.0 && u_mouse.y >= 0.0 && u_mouse.y <= 1.0) {
        float dist = distance(uv, u_mouse);
        float ripple = sin(28.0 * dist - u_time * 8.0 * u_speed) * 0.04;
        float effect = exp(-dist * 10.0);
        uv += normalize(uv - u_mouse + vec2(0.0001)) * ripple * u_strength * effect * 2.8;
    }

    uv = clamp(uv, 0.0, 1.0);
    vec4 color = texture2D(u_image, uv);

    // Grayscale base for subtle contrast
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 grayColor = vec3(gray * 0.65);

    // Color reveal mask around interaction points
    float mask = 0.35; // Base color presence so terrain is clearly visible
    if (u_mouse.x >= 0.0 && u_mouse.x <= 1.0 && u_mouse.y >= 0.0 && u_mouse.y <= 1.0 && u_maskRadius > 0.0) {
        float d = distance(uv, u_mouse);
        mask = max(mask, smoothstep(u_maskRadius, u_maskRadius * 0.5, d));
    }

    for (int i = 0; i < MAX_WAKE; ++i) {
        if (i >= u_wakeCount) break;
        vec2 w = u_wake[i].xy;
        float d = distance(uv, w);
        mask = max(mask, smoothstep(u_maskRadius, u_maskRadius * 0.5, d));
    }

    float revealMask = mix(1.0, mask, u_colorReveal);
    vec3 finalColor = mix(grayColor, color.rgb, revealMask);

    // Vignette towards pitch-black edges
    vec2 centerDist = (v_uv - 0.5) * 2.0;
    float vignette = 1.0 - smoothstep(0.45, 1.4, length(centerDist));
    finalColor *= vignette;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface LiquidHeroProps {
    children?: React.ReactNode;
}

export default function LiquidHero({ children }: LiquidHeroProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const offscreenRef = useRef<HTMLCanvasElement | null>(null);

    const mouseRef = useRef({ x: -10, y: -10, active: false });
    const wakeRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
    const maskRadiusRef = useRef(0.42);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        mouseRef.current = { x, y, active: true };
        const now = Date.now();
        wakeRef.current = [
            ...wakeRef.current.filter((w) => now - w.t < 1600),
            { x, y, t: now },
        ].slice(-16);
    }, []);

    const handlePointerLeave = useCallback(() => {
        mouseRef.current = { x: -10, y: -10, active: false };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || typeof window === "undefined") return;

        const gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            powerPreference: "high-performance",
        });
        if (!gl) return;

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type);
            if (!s) return null;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.warn(gl.getShaderInfoLog(s));
                gl.deleteShader(s);
                return null;
            }
            return s;
        };

        const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vs || !fs) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        gl.useProgram(program);

        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW
        );

        const aPos = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(program, "u_time");
        const uMouse = gl.getUniformLocation(program, "u_mouse");
        const uStrength = gl.getUniformLocation(program, "u_strength");
        const uSpeed = gl.getUniformLocation(program, "u_speed");
        const uResolution = gl.getUniformLocation(program, "u_resolution");
        const uWake = gl.getUniformLocation(program, "u_wake");
        const uWakeCount = gl.getUniformLocation(program, "u_wakeCount");
        const uMaskRadius = gl.getUniformLocation(program, "u_maskRadius");
        const uColorReveal = gl.getUniformLocation(program, "u_colorReveal");

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

        // Procedural Audio Terrain with NEW Emerald / Amber / Earthy Scheme (NO PURPLE)
        const generateTerrainTexture = (w: number, h: number) => {
            if (!offscreenRef.current) {
                offscreenRef.current = document.createElement("canvas");
            }
            const off = offscreenRef.current;
            off.width = w;
            off.height = h;
            const ctx = off.getContext("2d");
            if (!ctx) return off;

            // Pitch black background
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, w, h);

            // Ambient Central Horizon Glow (Emerald, Amber, Deep Forest Teal - No Purple)
            const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.58, 20, w * 0.5, h * 0.58, w * 0.65);
            bgGrad.addColorStop(0, "rgba(16, 185, 129, 0.40)"); // Vivid Emerald Center
            bgGrad.addColorStop(0.3, "rgba(245, 158, 11, 0.22)"); // Warm Amber/Gold Crest
            bgGrad.addColorStop(0.65, "rgba(13, 148, 136, 0.18)"); // Deep Forest Teal
            bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);

            // Low-horizon harmonic audio terrain waves
            const horizonY = h * 0.60;
            const waveCount = 20;

            for (let i = 0; i < waveCount; i++) {
                const progress = i / waveCount;
                const waveY = horizonY + progress * (h * 0.40);
                const alpha = 0.22 + (1 - progress) * 0.75;

                ctx.beginPath();
                ctx.moveTo(0, h);
                ctx.lineTo(0, waveY);

                const segments = 45;
                for (let j = 0; j <= segments; j++) {
                    const x = (j / segments) * w;
                    const f1 = Math.sin((j / segments) * Math.PI * 4 + i * 0.45);
                    const f2 = Math.cos((j / segments) * Math.PI * 7 + i * 0.35);
                    const amplitude = (38 * (1 - progress) + 9) * (f1 * 0.72 + f2 * 0.28);
                    ctx.lineTo(x, waveY + amplitude);
                }

                ctx.lineTo(w, h);
                ctx.closePath();

                // Dynamic chromatic wave gradient: Emerald -> Amber -> Teal
                const waveGrad = ctx.createLinearGradient(0, waveY - 45, w, waveY + 45);
                if (i % 3 === 0) {
                    waveGrad.addColorStop(0, `rgba(16, 185, 129, ${alpha * 0.85})`);
                    waveGrad.addColorStop(0.5, `rgba(52, 211, 153, ${alpha})`);
                    waveGrad.addColorStop(1, `rgba(245, 158, 11, ${alpha * 0.75})`);
                } else if (i % 3 === 1) {
                    waveGrad.addColorStop(0, `rgba(13, 148, 136, ${alpha * 0.8})`);
                    waveGrad.addColorStop(0.5, `rgba(20, 184, 166, ${alpha})`);
                    waveGrad.addColorStop(1, `rgba(16, 185, 129, ${alpha * 0.85})`);
                } else {
                    waveGrad.addColorStop(0, `rgba(245, 158, 11, ${alpha * 0.7})`);
                    waveGrad.addColorStop(0.5, `rgba(16, 185, 129, ${alpha * 0.9})`);
                    waveGrad.addColorStop(1, `rgba(5, 150, 105, ${alpha * 0.8})`);
                }

                ctx.fillStyle = waveGrad;
                ctx.fill();

                // Glowing crest ridge line
                ctx.strokeStyle = `rgba(240, 253, 244, ${0.25 + (1 - progress) * 0.5})`;
                ctx.lineWidth = 1.3;
                ctx.stroke();
            }

            return off;
        };

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));

        const offCanvas = generateTerrainTexture(canvas.width, canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offCanvas);

        let animId: number;
        const startTime = Date.now();

        const render = () => {
            if (document.hidden) {
                animId = requestAnimationFrame(render);
                return;
            }

            gl.viewport(0, 0, canvas.width, canvas.height);
            const now = (Date.now() - startTime) / 1000;

            gl.uniform1f(uTime, now);
            const mx = mouseRef.current.active ? mouseRef.current.x : -10;
            const my = mouseRef.current.active ? 1.0 - mouseRef.current.y : -10;
            gl.uniform2f(uMouse, mx, my);
            gl.uniform1f(uStrength, 0.18);
            gl.uniform1f(uSpeed, 0.22);
            gl.uniform2f(uResolution, canvas.width, canvas.height);

            const nowMs = Date.now();
            const activeWakes = wakeRef.current.filter((w) => nowMs - w.t < 1600).slice(-16);
            const wakeData = new Float32Array(16 * 3);
            for (let i = 0; i < activeWakes.length; i++) {
                wakeData[i * 3 + 0] = activeWakes[i].x;
                wakeData[i * 3 + 1] = 1.0 - activeWakes[i].y;
                wakeData[i * 3 + 2] = (activeWakes[i].t - startTime) / 1000;
            }
            gl.uniform1i(uWakeCount, activeWakes.length);
            gl.uniform3fv(uWake, wakeData);

            gl.uniform1f(uMaskRadius, maskRadiusRef.current);
            gl.uniform1f(uColorReveal, 1.0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            animId = requestAnimationFrame(render);
        };

        const handleResize = () => {
            if (!container || !canvas) return;
            const r = container.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width * dpr));
            const h = Math.max(1, Math.round(r.height * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                const updated = generateTerrainTexture(w, h);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, updated);
            }
        };

        const ro = new ResizeObserver(handleResize);
        ro.observe(container);

        animId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animId);
            ro.disconnect();
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(posBuffer);
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black text-white"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        >
            {/* Background Liquid WebGL Canvas with Procedural Audio Horizon Terrain */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                style={{ filter: "brightness(0.96) contrast(1.18)" }}
            />

            {/* Seamless Soft Fade Overlays */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-black/70" />
            <div className="absolute inset-x-0 bottom-0 h-48 pointer-events-none bg-gradient-to-t from-black to-transparent" />

            {/* Foreground Ingestion Content */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center p-4">
                {children}
            </div>
        </div>
    );
}
