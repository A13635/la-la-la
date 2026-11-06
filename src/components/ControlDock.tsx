import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Camera,
  Compass,
  ChevronDown,
  ChevronUp,
  CircleDot,
} from 'lucide-react';

interface ControlDockProps {
  progress: number;
  onProgressChange: (prog: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  cameraMode: 'cinematic' | 'orbit';
  onToggleCameraMode: () => void;
  showOrbits: boolean;
  onToggleOrbits: () => void;
  isMuted: boolean;
  onToggleAudio: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  progress,
  onProgressChange,
  isPlaying,
  onTogglePlay,
  onReplay,
  cameraMode,
  onToggleCameraMode,
  showOrbits,
  onToggleOrbits,
  isMuted,
  onToggleAudio,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-[820px] transition-all duration-300 ease-out select-none ${
        isCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Tab */}
      <div className="flex justify-center -mb-px">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-zinc-950 border-t border-x border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Press 'H' to toggle controls"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Container - Solid surface without backdrop-filter for software GL performance */}
      <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3 shadow-2xl">
        {/* Timeline scrubber & Scene jump pills */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pb-2.5 mb-2.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => onProgressChange(0)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                progress < 0.2
                  ? 'bg-cyan-950 border border-cyan-500/60 text-cyan-300'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              1. Solar System
            </button>
            <button
              onClick={() => onProgressChange(0.5)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                progress >= 0.2 && progress < 0.88
                  ? 'bg-purple-950 border border-purple-500/60 text-purple-300'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              2. Transformation
            </button>
            <button
              onClick={() => onProgressChange(1.0)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                progress >= 0.88
                  ? 'bg-amber-950 border border-amber-500/60 text-amber-300'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              3. The Message
            </button>
          </div>

          <div className="flex-1 flex items-center gap-3 w-full">
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={progress}
              onChange={(e) => onProgressChange(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="font-mono text-[11px] text-zinc-400 w-12 text-right">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>

        {/* Playback & View Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Play/Pause/Replay */}
          <div className="flex items-center gap-2">
            {progress >= 1.0 ? (
              <button
                onClick={onReplay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md shadow-cyan-950/40"
                title="Restart Cinematic Sequence"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay</span>
              </button>
            ) : (
              <button
                onClick={onTogglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md shadow-cyan-950/40"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
            )}

            <button
              onClick={onReplay}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Restart from Beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Camera Mode, Orbits, Sound */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCameraMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                cameraMode === 'cinematic'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Toggle between Cinematic Tour and Free Orbit"
            >
              {cameraMode === 'cinematic' ? (
                <>
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Cinematic Tour</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Free Orbit</span>
                </>
              )}
            </button>

            <button
              onClick={onToggleOrbits}
              className={`p-1.5 rounded-xl transition-all ${
                showOrbits
                  ? 'bg-zinc-800 text-cyan-300'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
              title={showOrbits ? 'Hide Orbit Tracks' : 'Show Orbit Tracks'}
            >
              <CircleDot className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleAudio}
              className={`p-1.5 rounded-xl transition-all ${
                !isMuted
                  ? 'bg-zinc-800 text-cyan-300'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
              title={isMuted ? 'Unmute Ambient Cosmic Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
