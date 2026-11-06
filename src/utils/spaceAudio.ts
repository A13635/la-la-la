/**
 * Zero-dependency Procedural Space Audio
 * Starts automatically when the animation starts.
 * Uses both native HTML5 audio stream and Web Audio API synthesis for seamless, instant playback.
 */

function generateSeamlessSpaceDroneWav(): string {
  const sampleRate = 22050;
  const duration = 4.0; // 4 seconds exact harmonic loop
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate deep cosmic hum with integer harmonic cycles for 100% seamless looping
  // 55 Hz * 4s = 220 cycles, 27.5 Hz * 4s = 110 cycles, 110 Hz * 4s = 440 cycles
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const wave =
      Math.sin(2 * Math.PI * 55 * t) * 0.45 +
      Math.sin(2 * Math.PI * 27.5 * t) * 0.35 +
      Math.sin(2 * Math.PI * 110 * t) * 0.15 +
      Math.sin(2 * Math.PI * 165 * t) * 0.05;

    const sample = Math.max(-1, Math.min(1, wave * 0.5));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  // Convert binary buffer to Base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

class SpaceAudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private isMuted: boolean = false;
  private htmlAudio: HTMLAudioElement | null = null;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Eagerly mount native HTML5 loop to bypass autoplay restrictions on animation start
      try {
        const audioUri = generateSeamlessSpaceDroneWav();
        const audio = new Audio(audioUri);
        audio.loop = true;
        audio.autoplay = true;
        audio.volume = 0.28;
        // Attribute flags for mobile/desktop browser autoplay
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('x-webkit-airplay', 'allow');
        this.htmlAudio = audio;

        // Try playing immediately
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay pending user interaction
          });
        }
      } catch {
        // Fallback to Web Audio
      }

      // Initialize Web Audio immediately
      this.init();

      // Hook all interaction events (including simple mouse movement, hover, wheel) to unlock
      const unlockEvents = [
        'mousemove',
        'pointermove',
        'mouseenter',
        'wheel',
        'scroll',
        'pointerdown',
        'touchstart',
        'keydown',
        'click',
        'focus',
      ];
      const unlock = () => {
        this.start();
        if (this.htmlAudio && this.htmlAudio.paused && !this.isMuted) {
          this.htmlAudio.play().catch(() => {});
        }
      };

      unlockEvents.forEach((ev) => {
        window.addEventListener(ev, unlock, { capture: true, passive: true });
      });
    }
  }

  init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0001 : 0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.createAmbientDrone();
      this.isInitialized = true;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Handled on start
    }
  }

  private createAmbientDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(27.5, this.ctx.currentTime);

    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(110.5, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, this.ctx.currentTime);

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(80, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(this.droneGain);

    osc1.start();
    osc2.start();
    osc3.start();
    lfo.start();
  }

  start(): Promise<void> {
    this.init();
    if (this.htmlAudio && !this.isMuted && this.htmlAudio.paused) {
      this.htmlAudio.play().catch(() => {});
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  isContextRunning(): boolean {
    return !!(this.ctx && this.ctx.state === 'running');
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.htmlAudio) {
      this.htmlAudio.muted = this.isMuted;
      if (!this.isMuted && this.htmlAudio.paused) {
        this.htmlAudio.play().catch(() => {});
      }
    }

    this.start();
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0.0001 : 0.35, now + 0.1);
    }
    return this.isMuted;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.htmlAudio) {
      this.htmlAudio.muted = muted;
    }
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.35, now + 0.1);
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  playTransformationSfx() {
    this.start();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 2.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 2.0);
      filter.Q.setValueAtTime(4.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 2.5);
    } catch {
      // Graceful
    }
  }

  playFormationChime() {
    this.start();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [293.66, 369.99, 440.0, 554.37, 659.25];

      freqs.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        const startTime = now + idx * 0.08;
        noteGain.gain.setValueAtTime(0.0001, startTime);
        noteGain.gain.linearRampToValueAtTime(0.07, startTime + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.0);

        osc.connect(noteGain);
        noteGain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 3.2);
      });
    } catch {
      // Graceful
    }
  }
}

export const spaceAudio = new SpaceAudioService();
