"use client";

import React, { useRef, useEffect } from "react";

interface AnimatedShaderFlowProps {
    isPlaying: boolean;
    className?: string;
}

export default function AnimatedShaderFlow({
    isPlaying,
    className = "",
}: AnimatedShaderFlowProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            powerPreference: "high-performance",
        });
        if (!gl) return;

        const vs = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fs = `
            precision highp float;
            varying vec2 v_uv;
            uniform sampler2D u_image;
            uniform float u_time;
            uniform float u_isPlaying;
            uniform vec2 u_resolution;

            void main() {
                vec2 uv = v_uv;

                float speedMult = mix(0.25, 1.0, u_isPlaying);
                float t = u_time * speedMult;

                // Harmonic fluid wave displacement undulating across the ShaderFlow photo instance
                float waveY = sin(uv.x * 4.2 + t * 1.8) * 0.028 * speedMult;
                float waveX = cos(uv.y * 3.5 + t * 1.2) * 0.018 * speedMult;
                
                // Secondary micro-ripple
                float ripple = sin((uv.x + uv.y) * 12.0 - t * 2.5) * 0.008 * speedMult;
                
                vec2 sampleUv = uv + vec2(waveX, waveY + ripple);
                sampleUv = clamp(sampleUv, 0.0, 1.0);

                // Chromatic dispersion offsets across RGB channels
                float disp = 0.006 * speedMult;
                vec4 rCol = texture2D(u_image, sampleUv + vec2(disp, 0.0));
                vec4 gCol = texture2D(u_image, sampleUv);
                vec4 bCol = texture2D(u_image, sampleUv - vec2(disp, 0.0));

                vec3 color = vec3(rCol.r, gCol.g, bCol.b);

                // Procedural flowing laser accent derived from Framer ShaderFlow
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
                float laserWave = sin((p.x * 1.1 + t * 0.45)) * 0.45;
                float distToBeam = abs(p.y + laserWave);
                float laserGlow = 0.015 / max(0.005, distToBeam);
                vec3 laserChromatic = vec3(
                    0.015 / max(0.005, abs(p.y + sin((p.x * 1.15 + t * 0.45)) * 0.45)),
                    0.015 / max(0.005, abs(p.y + sin((p.x * 1.10 + t * 0.45)) * 0.45)),
                    0.015 / max(0.005, abs(p.y + sin((p.x * 1.05 + t * 0.45)) * 0.45))
                );

                color += laserChromatic * 0.4 * speedMult;

                // Subtle breathing luminous pulse
                float pulse = 1.0 + sin(t * 2.2) * 0.12 * speedMult;
                color *= pulse;

                // Keep pure black void background deep and clean
                float maxVal = max(color.r, max(color.g, color.b));
                float alpha = smoothstep(0.01, 0.15, maxVal);

                gl_FragColor = vec4(color, alpha);
            }
        `;

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type);
            if (!s) return null;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                gl.deleteShader(s);
                return null;
            }
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
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

        gl.useProgram(program);

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );

        const posLoc = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(program, "u_time");
        const uIsPlaying = gl.getUniformLocation(program, "u_isPlaying");
        const uRes = gl.getUniformLocation(program, "u_resolution");
        const uImage = gl.getUniformLocation(program, "u_image");

        // Load shaderflow photo instance texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Black placeholder
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([0, 0, 0, 255])
        );

        const img = new Image();
        img.src = "/shaderflow-instance.png";
        img.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        };

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const w = Math.floor(rect.width * dpr);
            const h = Math.floor(rect.height * dpr);

            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                gl.viewport(0, 0, w, h);
            }
        };

        window.addEventListener("resize", resize);
        resize();

        let animId: number;
        const startTime = performance.now();

        const render = (now: number) => {
            const elapsed = (now - startTime) / 1000;

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, elapsed);
            gl.uniform1f(uIsPlaying, isPlayingRef.current ? 1.0 : 0.0);
            gl.uniform1i(uImage, 0);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
            gl.deleteShader(vShader);
            gl.deleteShader(fShader);
            gl.deleteBuffer(posBuf);
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`w-full h-full object-cover select-none pointer-events-none ${className}`}
            style={{ filter: "brightness(1.1) contrast(1.15)" }}
        />
    );
}

