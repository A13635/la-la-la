import React, { useState, useEffect, useCallback } from 'react';
import { ThreeCanvas } from './components/ThreeCanvas';
import { ControlDock } from './components/ControlDock';
import { spaceAudio } from './utils/spaceAudio';

export default function App() {
  const [progress, setProgress] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState<'cinematic' | 'orbit'>('cinematic');
  const [showOrbits, setShowOrbits] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Resume Web Audio context immediately and on ANY user touch/click/drag
  const activateAudio = useCallback(() => {
    spaceAudio.start();
  }, []);

  useEffect(() => {
    // 1. Attempt immediate audio start (works in browsers that allow autoplay)
    activateAudio();

    // 2. Capture-phase listeners on window & document:
    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'];
    const options = { capture: true, passive: true };

    const handleFirstInteraction = () => {
      activateAudio();
      events.forEach((ev) => window.removeEventListener(ev, handleFirstInteraction, options));
    };

    events.forEach((ev) => window.addEventListener(ev, handleFirstInteraction, options));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleFirstInteraction, options));
    };
  }, [activateAudio]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReplay();
      } else if (e.key === 'c' || e.key === 'C') {
        setCameraMode((prev) => (prev === 'cinematic' ? 'orbit' : 'cinematic'));
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleReplay = useCallback(() => {
    setProgress(0.0);
    setIsPlaying(true);
  }, []);

  const handleToggleCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === 'cinematic' ? 'orbit' : 'cinematic'));
  }, []);

  const handleToggleOrbits = useCallback(() => {
    setShowOrbits((prev) => !prev);
  }, []);

  const handleToggleAudio = useCallback(() => {
    const newMuted = spaceAudio.toggleMute();
    setIsMuted(newMuted);
  }, []);

  return (
    <main
      onClick={activateAudio}
      onTouchStart={activateAudio}
      className="relative w-screen h-screen overflow-hidden bg-black text-white select-none"
    >
      {/* 3D WebGL Canvas Viewport */}
      <ThreeCanvas
        progress={progress}
        onProgressChange={setProgress}
        isPlaying={isPlaying}
        cameraMode={cameraMode}
        showOrbits={showOrbits}
        isMuted={isMuted}
      />



      {/* Ergonomic Collapsible Bottom Control Dock (Hidden by default) */}
      <ControlDock
        progress={progress}
        onProgressChange={setProgress}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onReplay={handleReplay}
        cameraMode={cameraMode}
        onToggleCameraMode={handleToggleCameraMode}
        showOrbits={showOrbits}
        onToggleOrbits={handleToggleOrbits}
        isMuted={isMuted}
        onToggleAudio={handleToggleAudio}
      />
    </main>
  );
}
