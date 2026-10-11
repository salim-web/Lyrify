import { useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";

interface PlayerProps {
    audioSrc: string | null;
    isPlaying: boolean;
    setIsPlaying: (val: boolean) => void;
    currentTime: number;
    setCurrentTime: (val: number) => void;
    duration: number;
    setDuration: (val: number) => void;
    seekTo: number | null; // New prop for external seeking
}

export default function Player({
    audioSrc,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    seekTo,
}: PlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);

    // Watch for external seek commands
    useEffect(() => {
        if (audioRef.current && seekTo !== null) {
            audioRef.current.currentTime = seekTo;
            setCurrentTime(seekTo);
        }
    }, [seekTo]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        if (audioRef.current && audioSrc) {
            audioRef.current.src = audioSrc;
            const playPromise = audioRef.current.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch(e => {
                        console.log("Autoplay prevented or interrupted:", e);
                        setIsPlaying(false);
                    });
            }
        }
    }, [audioSrc]);

    const togglePlay = () => setIsPlaying(!isPlaying);

    const skipForward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10);
        }
    };

    const skipBackward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
        }
    };

    // Use requestAnimationFrame for smooth UI updates (60fps)
    useEffect(() => {
        let animationFrameId: number;

        const update = () => {
            if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
                if (isPlaying) {
                    animationFrameId = requestAnimationFrame(update);
                }
            }
        };

        if (isPlaying) {
            update();
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isPlaying, setCurrentTime]);

    const handleTimeUpdate = () => {
        // Fallback or when paused (scrubbing)
        if (audioRef.current && !isPlaying) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    if (!audioSrc) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-t border-white/10 p-4 z-50">
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => {
                    const error = e.currentTarget.error;
                    console.error("Audio Playback Error:", error);
                    // Use a more user-friendly message or simple alert for debugging
                    console.log("Error Code:", error?.code, "Message:", error?.message);
                }}
            />

            <div className="max-w-4xl mx-auto flex items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={skipBackward}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <SkipBack size={24} />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
                    >
                        {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" />}
                    </button>

                    <button
                        onClick={skipForward}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <SkipForward size={24} />
                    </button>
                </div>

                <span className="text-xs text-gray-400 w-10 text-right">
                    {formatTime(currentTime)}
                </span>

                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-emerald-400 transition-all"
                />

                <span className="text-xs text-gray-400 w-10">
                    {formatTime(duration)}
                </span>
            </div>
        </div>
    );
}

function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
