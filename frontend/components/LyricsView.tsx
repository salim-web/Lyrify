"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import AnimatedShaderFlow from "./AnimatedShaderFlow";

interface Word {
  word: string;
  start: number;
  end: number;
}

interface LyricLine {
  text: string;
  start: number;
  end: number;
  words: Word[];
}

interface LyricsViewProps {
  lyrics: LyricLine[];
  currentTime: number;
  isPlaying?: boolean;
  onSeek: (time: number) => void;
}

export default function LyricsView({
  lyrics,
  currentTime,
  isPlaying = false,
  onSeek,
}: LyricsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active line index
  const activeLineIndex = lyrics.findIndex(
    (line) => currentTime >= line.start && currentTime <= line.end
  );

  // Scroll to active line
  useEffect(() => {
    if (activeLineIndex !== -1 && containerRef.current) {
      const activeElement = containerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeLineIndex]);

  return (
    <div className="relative w-full h-[68vh] flex items-center justify-center overflow-hidden rounded-3xl border border-white/10 shadow-2xl bg-black">
      {/* 1. Behind Frosted Glass: Animated ShaderFlow Photo Instance Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
        <AnimatedShaderFlow isPlaying={isPlaying} />
      </div>

      {/* 2. Frosted Glass Diffusion Layer */}
      <div className="absolute inset-0 pointer-events-none backdrop-blur-2xl bg-black/45 border border-white/10" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.04] via-transparent to-black/70" />

      {/* 3. Original Lyrics Content Layer */}
      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-3xl h-full overflow-y-auto no-scrollbar px-6 py-20 space-y-8 text-left"
      >
        {lyrics.map((line, index) => {
          const isActive = index === activeLineIndex;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{
                opacity: isActive ? 1 : 0.6,
                scale: isActive ? 1.05 : 1,
                filter: isActive ? "blur(0px)" : "blur(1.5px)",
              }}
              transition={{ duration: 0.4 }}
              className={clsx(
                "text-3xl md:text-5xl font-bold transition-colors duration-500",
                isActive ? "text-white" : "text-gray-400 hover:text-gray-200"
              )}
            >
              {line.words && line.words.length > 0 ? (
                // Word-by-word highlighting
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {line.words.map((word, wIndex) => {
                    // Determine word state
                    const isPastWord = currentTime > word.end;
                    const isCurrentWord =
                      currentTime >= word.start && currentTime <= word.end;

                    // Calculate fill percentage for current word
                    let fillPercent = 0;
                    if (isPastWord) fillPercent = 100;
                    if (isCurrentWord) {
                      const duration = word.end - word.start;
                      if (duration > 0) {
                        fillPercent = Math.min(
                          100,
                          Math.max(
                            0,
                            ((currentTime - word.start) / duration) * 100
                          )
                        );
                      } else {
                        fillPercent = 100; // instant word
                      }
                    }

                    // Define animations variants
                    const activeVariant =
                      isActive && isCurrentWord ? "singing" : "idle";

                    return (
                      <motion.span
                        key={wIndex}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(word.start);
                        }}
                        initial="idle"
                        animate={activeVariant}
                        variants={{
                          singing: {
                            y: [0, -2, 0],
                            scale: 1.1,
                            zIndex: 10,
                            transition: {
                              y: {
                                repeat: Infinity,
                                duration: 2,
                                ease: "linear",
                              },
                              scale: {
                                type: "spring",
                                stiffness: 200,
                                damping: 15,
                              },
                            },
                          },
                          idle: {
                            y: 0,
                            scale: 1,
                            zIndex: 0,
                            transition: {
                              y: { duration: 0.1 },
                              zIndex: { delay: 0.2 }, // Delay z-index drop slightly
                              scale: {
                                type: "spring",
                                stiffness: 500,
                                damping: 30,
                              },
                            },
                          },
                        }}
                        className={clsx(
                          "cursor-pointer inline-block bg-clip-text text-transparent origin-center relative",
                          // Base styles
                          isActive ? "blur-none" : "blur-[1.5px] opacity-60"
                        )}
                        style={{
                          // Apple-style fill animation - White Fill
                          backgroundImage: isActive
                            ? `linear-gradient(90deg, #ffffff ${fillPercent}%, #ffffff80 ${fillPercent}%)`
                            : "none",
                          color: isActive ? "transparent" : "inherit",
                          backgroundColor: isActive ? "transparent" : "#9ca3af",
                          // Bulb glowing effect
                          filter:
                            isActive && isCurrentWord
                              ? "drop-shadow(0 0 15px rgba(255, 255, 255, 1))"
                              : "none",
                          willChange: "transform, opacity, filter",
                        }}
                      >
                        {word.word}
                      </motion.span>
                    );
                  })}
                </span>
              ) : (
                // Fallback for lines without word timestamps
                <span
                  onClick={() => onSeek(line.start)}
                  className="cursor-pointer hover:text-white transition-colors"
                >
                  {line.text}
                </span>
              )}
            </motion.div>
          );
        })}

        {/* Spacer for bottom scrolling */}
        <div className="h-[40vh]" />
      </div>
    </div>
  );
}
