export type ScenePhase = 'solar' | 'transforming' | 'message';

export interface PlanetConfig {
  name: string;
  arabicName: string;
  radius: number;
  distance: number;
  speed: number;
  rotationSpeed: number;
  color: string;
  emissive?: string;
  roughness: number;
  metalness: number;
  textureType: 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
  hasRings?: boolean;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  ringColor?: string;
  ringTilt?: number;
  hasMoons?: boolean;
  description: string;
  framingPosition: [number, number, number]; // Position in Scene 3 to frame the message
}

export interface SatelliteConfig {
  id: string;
  name: string;
  type: 'iss' | 'hubble' | 'voyager' | 'sputnik';
  orbitRadius: number;
  orbitSpeed: number;
  orbitInclination: number;
  scale: number;
  initialPlanetTarget?: string;
  messageTargetIndex: number;
}

export interface ParticleData {
  solarPos: [number, number, number];
  targetPos: [number, number, number];
  currentPos: [number, number, number];
  color: [number, number, number];
  size: number;
  type: 'asteroid' | 'crystal' | 'stardust' | 'ion';
  phaseOffset: number;
  rotationSpeed: [number, number, number];
  driftSeed: number;
}
