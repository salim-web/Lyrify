"use client";

import React, { useRef, useEffect, useState, useId } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 uv;
void main() {
    uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 uv;
uniform float time, pixels, tube, flow, dispersion, glow, warmth, hover, hoverTone, hoverIntensity, press, response, release;
uniform vec2 pointer;
const float PI = 3.14159265;

float pool(float a, float b, float sharp) {
    return exp((cos(a - b) - 1.0) * sharp);
}

float studio(vec3 r, float a, float q, float shift) {
    float f = sin(a * 2.0 - time * 0.53) + 0.28 * sin(3.0 * a + time * 0.31) + q * 0.52 + r.z * 0.12 + shift;
    float main = smoothstep(-0.5, -0.28, f) - smoothstep(0.37, 0.57, f);
    float strip = smoothstep(0.84, 0.95, f);
    float curve = 0.5 + 0.5 * r.z;
    return 0.12 + 0.75 * main + 0.65 * strip + 0.12 * curve;
}

void main() {
    vec2 p = (vec2(uv.x, 1.0 - uv.y) * 2.0 - 1.0) * 1.2;
    float r = max(length(p), 0.0001);
    float a = atan(p.y, p.x);
    float phase = time * 0.65;
    float aim = atan(pointer.y + 0.0001, pointer.x + 0.0001);
    float attraction = pool(a, aim, 2.8) * hover;
    float wave = sin(3.0 * a - release * 11.0) * sin(PI * release) * exp(-release * 2.7);
    float rip = flow * (0.010 * sin(3.0 * a - phase * 1.3) + 0.006 * sin(5.0 * a + phase * 0.8));
    float radius = 0.81 + rip + attraction * 0.018 * response - press * 0.012 * response + wave * 0.035 * response;
    float width = tube * (1.0 + flow * 0.16 * sin(2.0 * a - phase) + attraction * 0.19 * response + press * 0.24 * response);
    float q = (r - radius) / max(width, 0.018);
    float aa = 2.64 / max(pixels, 1.0);
    float coverage = 1.0 - smoothstep(width - aa, width + aa, abs(r - radius));
    float z = sqrt(max(0.0001, 1.0 - clamp(q * q, 0.0, 1.0)));
    vec2 tangent = vec2(-p.y, p.x) / r;
    vec3 normal = normalize(vec3(p / r * clamp(q, -1.0, 1.0) + tangent * (0.10 * flow * sin(3.0 * a - phase) + wave * 0.35), z));
    vec3 reflected = reflect(vec3(0.0, 0.0, -1.0), normal);
    float shift = dispersion * (0.08 + 0.13 * pool(a, phase + 0.7, 2.0));
    vec3 chrome = vec3(studio(reflected, a, q, shift), studio(reflected, a, q, 0.0), studio(reflected, a, q, -shift));
    float hot = pool(a, phase - 1.9, 12.0) + pool(a, -phase * 0.71 + 1.2, 20.0) * 0.7;
    chrome += vec3(0.75, 0.87, 1.0) * hot * pow(z, 2.0) * 0.72;
    float hoverCore = attraction * pow(z, 4.0) * hoverIntensity;
    vec3 hoverTarget = mix(vec3(0.08, 0.12, 0.19), vec3(1.0), step(0.0, hoverTone));
    chrome = mix(chrome, hoverTarget, hoverCore * mix(0.50, 0.46, step(0.0, hoverTone)));
    chrome *= mix(vec3(1.0), vec3(1.14, 0.96, 0.72), max(0.0, warmth));
    chrome *= mix(vec3(1.0), vec3(0.78, 0.93, 1.13), max(0.0, -warmth));
    chrome = mix(chrome, vec3(0.94, 0.98, 1.0), pow(abs(clamp(q, -1.0, 1.0)), 14.0) * 0.38);
    float halo = exp(-pow((r - radius) / (width * 2.8), 2.0)) * hot * glow * 0.21 * (1.0 - smoothstep(1.08, 1.2, r));
    vec3 haloColor = mix(vec3(0.65, 0.79, 1.0), vec3(1.0, 0.88, 0.65), 0.5 + 0.5 * sin(a + phase));
    float alpha = coverage + (1.0 - coverage) * halo;
    vec3 col = clamp(chrome, 0.0, 1.0) * coverage + haloColor * (1.0 - coverage) * halo;
    gl_FragColor = vec4(col, alpha);
}
`;

export interface LiquidMetalButtonProps {
    children?: React.ReactNode;
    label?: string;
    icon?: React.ReactNode;
    trailing?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    active?: boolean;
    size?: "sm" | "md" | "lg";
    variant?: "dark" | "light" | "emerald" | "ghost";
    className?: string;
    type?: "button" | "submit" | "reset";
}

export default function LiquidMetalButton({
    children,
    label,
    icon,
    trailing,
    onClick,
    disabled = false,
    active = false,
    size = "md",
    variant = "dark",
    className = "",
    type = "button",
}: LiquidMetalButtonProps) {
    const rawId = useId();
    const id = rawId.replace(/[^a-zA-Z0-9]/g, "");
    const rootRef = useRef<HTMLButtonElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    // Physical pointer tracking
    const inputRef = useRef({
        x: -0.5,
        y: -0.5,
        sx: 0.5,
        sy: 0.5,
        hovering: false,
        pressed: false,
        release: 1.0,
    });
    const phaseRef = useRef(1.4);

    const isLight = variant === "light";
    const isEmerald = variant === "emerald";

    // Disc size based on button size
    const discSize = size === "sm" ? 24 : size === "lg" ? 42 : 32;
    const glyphSize = size === "sm" ? 13 : size === "lg" ? 18 : 15;

    useEffect(() => {
        const canvas = canvasRef.current;
        const root = rootRef.current;
        if (!canvas || !root || typeof window === "undefined") return;

        let gl: WebGLRenderingContext | null = null;
        try {
            gl = canvas.getContext("webgl", {
                alpha: true,
                premultipliedAlpha: true,
                antialias: false,
                depth: false,
                stencil: false,
                powerPreference: "low-power",
            });
        } catch {
            return;
        }
        if (!gl) return;

        const ctx = gl;
        const compile = (type: number, src: string) => {
            const shader = ctx.createShader(type);
            if (!shader) return null;
            ctx.shaderSource(shader, src);
            ctx.compileShader(shader);
            if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
                ctx.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vShader = compile(ctx.VERTEX_SHADER, VERTEX_SHADER);
        const fShader = compile(ctx.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vShader || !fShader) return;

        const program = ctx.createProgram();
        const buffer = ctx.createBuffer();
        if (!program || !buffer) return;

        ctx.attachShader(program, vShader);
        ctx.attachShader(program, fShader);
        ctx.linkProgram(program);

        if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
            return;
        }

        ctx.useProgram(program);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
        ctx.bufferData(
            ctx.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            ctx.STATIC_DRAW
        );

        const position = ctx.getAttribLocation(program, "position");
        ctx.enableVertexAttribArray(position);
        ctx.vertexAttribPointer(position, 2, ctx.FLOAT, false, 0, 0);

        const uniforms: Record<string, WebGLUniformLocation | null> = {};
        [
            "time", "pixels", "tube", "flow", "dispersion", "glow",
            "warmth", "hover", "hoverTone", "hoverIntensity", "press",
            "response", "release", "pointer",
        ].forEach((name) => {
            uniforms[name] = ctx.getUniformLocation(program, name);
        });

        const scalar = (name: string, val: number) => {
            if (uniforms[name]) ctx.uniform1f(uniforms[name], val);
        };

        scalar("tube", Math.min(0.16, Math.max(0.022, 5.2 / discSize)));
        scalar("flow", 0.65);
        scalar("dispersion", isEmerald ? 0.85 : 0.65);
        scalar("glow", 0.55);
        scalar("warmth", isEmerald ? 0.3 : isLight ? -0.2 : 0.0);
        scalar("response", 0.65);
        scalar("hoverTone", isLight ? -1 : 1);
        scalar("hoverIntensity", 0.72);

        let frameId = 0;
        let lastTime = 0;
        let stopped = false;
        let currentHover = 0;
        let currentPress = 0;
        let px = -0.5;
        let py = -0.5;
        let sx = 0.5;
        let sy = 0.5;

        const draw = () => {
            if (stopped || !canvas) return;
            ctx.viewport(0, 0, canvas.width, canvas.height);
            scalar("pixels", canvas.width);
            scalar("time", phaseRef.current);
            scalar("hover", currentHover * 0.7);
            scalar("press", currentPress);
            scalar("release", inputRef.current.release);
            if (uniforms.pointer) {
                ctx.uniform2f(uniforms.pointer, px, py);
            }
            ctx.drawArrays(ctx.TRIANGLES, 0, 6);

            // CSS animated variables for reflective edge
            const edgePhase = phaseRef.current * 1.0;
            root.style.setProperty("--orb-phase", `${edgePhase * 46 - 85}deg`);
            root.style.setProperty("--orb-counter", `${-edgePhase * 31 + 75}deg`);
            root.style.setProperty("--orb-pool-x", `${50 + Math.sin(edgePhase * 0.73) * 16 * 0.75}%`);
            root.style.setProperty("--orb-pool-y", `${50 + Math.cos(edgePhase * 0.57) * 22 * 0.75}%`);

            const pull = currentHover * 0.7 * 0.72;
            const lightX = 50 + Math.cos(edgePhase * 0.91) * 48;
            const lightY = 50 + Math.sin(edgePhase * 0.91) * 48;
            root.style.setProperty("--orb-light-x", `${lightX + (sx * 100 - lightX) * pull}%`);
            root.style.setProperty("--orb-light-y", `${lightY + (sy * 100 - lightY) * pull}%`);
            root.style.setProperty("--orb-wake-x", `${sx * 100}%`);
            root.style.setProperty("--orb-wake-y", `${sy * 100}%`);
        };

        const tick = (now: number) => {
            if (stopped || document.hidden) return;
            const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
            lastTime = now;

            const inp = inputRef.current;
            const activeInput = inp.hovering || active;
            const k = 1 - Math.exp(-dt * 10);
            currentHover += ((activeInput ? 1 : 0) - currentHover) * k;
            currentPress += ((inp.pressed ? 1 : 0) - currentPress) * (1 - Math.exp(-dt * 18));
            px += (inp.x - px) * k;
            py += (inp.y - py) * k;
            sx += (inp.sx - sx) * k;
            sy += (inp.sy - sy) * k;
            inp.release = Math.min(1.0, inp.release + dt * 1.35);

            phaseRef.current += dt * 0.8;
            draw();

            frameId = requestAnimationFrame(tick);
        };

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round(discSize * dpr * 1.2));
            canvas.height = canvas.width;
            draw();
        };

        resize();
        frameId = requestAnimationFrame(tick);

        return () => {
            stopped = true;
            cancelAnimationFrame(frameId);
            ctx.deleteShader(vShader);
            ctx.deleteShader(fShader);
            ctx.deleteBuffer(buffer);
            ctx.deleteProgram(program);
        };
    }, [discSize, isEmerald, isLight, active]);

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        const b = canvasRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - b.left) / Math.max(1, b.width) * 2 - 1;
        const py = (e.clientY - b.top) / Math.max(1, b.height) * 2 - 1;
        const length = Math.max(1, Math.hypot(px, py));
        inputRef.current.x = px / length;
        inputRef.current.y = py / length;

        const face = e.currentTarget.getBoundingClientRect();
        inputRef.current.sx = Math.min(1, Math.max(0, (e.clientX - face.left) / Math.max(1, face.width)));
        inputRef.current.sy = Math.min(1, Math.max(0, (e.clientY - face.top) / Math.max(1, face.height)));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button === 0 && !disabled) {
            inputRef.current.pressed = true;
            setIsPressed(true);
        }
    };

    const handlePointerUp = () => {
        if (inputRef.current.pressed) {
            inputRef.current.pressed = false;
            inputRef.current.release = 0;
            setIsPressed(false);
        }
    };

    const padClass =
        size === "sm" ? "px-3 py-1.5 text-xs gap-2" :
        size === "lg" ? "px-6 py-3.5 text-base gap-3.5" :
        "px-4 py-2.5 text-sm gap-2.5";

    const baseSurface =
        variant === "emerald"
            ? "bg-gradient-to-r from-emerald-600/90 to-teal-700/90 text-white border-emerald-400/40 shadow-lg shadow-emerald-500/20"
            : variant === "light"
            ? "bg-white/95 text-neutral-900 border-white/60 shadow-lg shadow-white/10"
            : variant === "ghost"
            ? "bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10"
            : active
            ? "bg-[#1f2229] text-white border-emerald-500/50 shadow-lg shadow-emerald-500/10"
            : "bg-[#121316]/90 hover:bg-[#181a20] text-neutral-200 border-white/15 shadow-xl shadow-black/40";

    return (
        <motion.button
            ref={rootRef}
            type={type}
            disabled={disabled}
            onClick={onClick}
            whileHover={disabled ? undefined : { scale: 1.02 }}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            onPointerEnter={(e) => {
                if (!disabled) {
                    inputRef.current.hovering = true;
                    setIsHovered(true);
                    handlePointerMove(e);
                }
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => {
                inputRef.current.hovering = false;
                inputRef.current.pressed = false;
                setIsHovered(false);
                setIsPressed(false);
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className={clsx(
                "relative group inline-flex items-center justify-center select-none font-medium transition-all duration-200 outline-none rounded-full border backdrop-blur-md overflow-hidden",
                padClass,
                baseSurface,
                disabled && "opacity-40 cursor-not-allowed",
                className
            )}
            style={{
                borderRadius: "9999px",
            }}
        >
            {/* Chromatic Edge Light Sweep */}
            <span
                className="absolute inset-0 pointer-events-none rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    padding: "1.5px",
                    background: isEmerald
                        ? "conic-gradient(from var(--orb-phase, 0deg) at var(--orb-pool-x, 50%) var(--orb-pool-y, 50%), #10b981, #059669, #34d399, #10b981)"
                        : "conic-gradient(from var(--orb-phase, 0deg) at var(--orb-pool-x, 50%) var(--orb-pool-y, 50%), #8995a6 0deg, #e6f0ff 40deg, #2a3445 100deg, #ffffff 180deg, #80b8ff 240deg, #f4b777 300deg, #8995a6 360deg)",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                }}
            />

            {/* Liquid Metal Emblem Disc */}
            <span
                className="relative flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: discSize, height: discSize }}
            >
                {/* Embedded WebGL Liquid Metal Canvas */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-[-10%] w-[120%] height-[120%] pointer-events-none rounded-full"
                />

                {/* Disc Center Backing */}
                <span
                    className="absolute inset-[10%] rounded-full shadow-inner pointer-events-none"
                    style={{
                        background: isEmerald
                            ? "radial-gradient(circle, #059669 0%, #064e3b 100%)"
                            : "radial-gradient(circle, #2a2e39 0%, #0c0e12 100%)",
                    }}
                />

                {/* Inner Icon / Glyph */}
                <span className="relative z-10 flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {icon || (
                        <svg
                            width={glyphSize}
                            height={glyphSize}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
                        </svg>
                    )}
                </span>
            </span>

            {/* Label / Children */}
            {(label || children) && (
                <span className="relative z-10 font-semibold tracking-tight whitespace-nowrap">
                    {label || children}
                </span>
            )}

            {/* Trailing Icon */}
            {trailing && (
                <span className="relative z-10 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    {trailing}
                </span>
            )}

            {/* Hover Wake Glow */}
            <span
                className="absolute inset-0 pointer-events-none rounded-full transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                style={{
                    background: `radial-gradient(circle at var(--orb-wake-x, 50%) var(--orb-wake-y, 50%), ${
                        isEmerald ? "rgba(52, 211, 153, 0.25)" : "rgba(255, 255, 255, 0.12)"
                    } 0%, transparent 60%)`,
                }}
            />
        </motion.button>
    );
}

