"use client";

import React, { useRef, useEffect } from "react";

interface ShaderFlowBackdropProps {
    isPlaying: boolean;
    xScale?: number;
    yScale?: number;
    distortion?: number;
    speed?: number;
    className?: string;
}

export default function ShaderFlowBackdrop({
    isPlaying,
    xScale = 1.1,
    yScale = 0.45,
    distortion = 0.055,
    speed = 0.014,
    className = "",
}: ShaderFlowBackdropProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;

    const propsRef = useRef({ xScale, yScale, distortion, speed });
    propsRef.current = { xScale, yScale, distortion, speed };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof window === "undefined") return;

        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            preserveDrawingBuffer: false,
            powerPreference: "low-power",
        });
        if (!gl) return;

        const vertexShaderSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision highp float;
            uniform vec2 resolution;
            uniform float time;
            uniform float xScale;
            uniform float yScale;
            uniform float distortion;

            void main() {
                vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
                
                float d = length(p) * distortion;
                
                float rx = p.x * (1.0 + d);
                float gx = p.x;
                float bx = p.x * (1.0 - d);

                // Chromatic aberration laser spectrum band
                float r = 0.045 / abs(p.y + sin((rx + time) * xScale) * yScale);
                float g = 0.045 / abs(p.y + sin((gx + time) * xScale) * yScale);
                float b = 0.045 / abs(p.y + sin((bx + time) * xScale) * yScale);
                
                // Keep the color vibrant and punchy over pure black
                vec3 col = vec3(r, g, b);
                gl_FragColor = vec4(col, 1.0);
            }
        `;

        const createShader = (type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!vShader || !fShader) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            return;
        }

        gl.useProgram(program);

        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1,
            1, -1, -1, 1, 1, 1,
        ]);
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const uRes = gl.getUniformLocation(program, "resolution");
        const uTime = gl.getUniformLocation(program, "time");
        const uXScale = gl.getUniformLocation(program, "xScale");
        const uYScale = gl.getUniformLocation(program, "yScale");
        const uDistortion = gl.getUniformLocation(program, "distortion");

        let animationId: number;
        let timeValue = 0;
        let lastFrame = 0;

        const handleResize = () => {
            if (!canvas) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const w = Math.round(canvas.clientWidth * dpr);
            const h = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                gl.viewport(0, 0, w, h);
                gl.uniform2f(uRes, w, h);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);

        const animate = (now: number) => {
            if (document.hidden) {
                animationId = requestAnimationFrame(animate);
                return;
            }

            const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
            lastFrame = now;

            // Advance time dynamically; if paused, idle very slowly to conserve GPU
            const effectiveSpeed = isPlayingRef.current
                ? propsRef.current.speed * 60
                : propsRef.current.speed * 8;
            timeValue += effectiveSpeed * dt;

            gl.uniform1f(uTime, timeValue);
            gl.uniform1f(uXScale, propsRef.current.xScale);
            gl.uniform1f(uYScale, propsRef.current.yScale);
            gl.uniform1f(uDistortion, propsRef.current.distortion);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener("resize", handleResize);
            gl.deleteShader(vShader);
            gl.deleteShader(fShader);
            gl.deleteBuffer(positionBuffer);
            gl.deleteProgram(program);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`pointer-events-none select-none ${className}`}
            style={{
                width: "100%",
                height: "100%",
                display: "block",
                backgroundColor: "#000000",
                filter: "blur(0.5px) contrast(1.1)",
            }}
        />
    );
}

