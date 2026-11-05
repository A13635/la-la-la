import { PlanetConfig } from '../types/space';

/**
 * Physically calibrated solar system properties:
 * - Keplerian relative orbital speeds: v ~ 1 / sqrt(distance)
 * - Realistic axial tilts (radians)
 * - Harmonious distances giving inner and outer planets room to breathe
 * - Strategic framing positions in Scene 3 to NEVER obscure the message
 */
export const PLANETS_DATA: (PlanetConfig & { axialTilt: number; orbitInclination: number })[] = [
  {
    name: 'Mercury',
    arabicName: 'عطارد',
    radius: 0.75,
    distance: 18,
    speed: 1.5, // Fastest inner planet
    rotationSpeed: 0.008,
    axialTilt: 0.03,
    orbitInclination: 0.06,
    color: '#9e968f',
    roughness: 0.85,
    metalness: 0.2,
    textureType: 'mercury',
    description: 'Smallest planet, closest to the Sun.',
    framingPosition: [18, 30, -28],
  },
  {
    name: 'Venus',
    arabicName: 'الزهرة',
    radius: 1.2,
    distance: 26,
    speed: 1.25,
    rotationSpeed: -0.004, // Retrograde rotation
    axialTilt: 3.10,
    orbitInclination: 0.04,
    color: '#e3bb7b',
    roughness: 0.6,
    metalness: 0.1,
    textureType: 'venus',
    description: 'Veiled in thick, reflective toxic sulfuric clouds.',
    framingPosition: [42, 28, -26],
  },
  {
    name: 'Earth',
    arabicName: 'الأرض',
    radius: 1.4,
    distance: 36,
    speed: 1.05,
    rotationSpeed: 0.02,
    axialTilt: 0.41, // 23.4 degrees
    orbitInclination: 0.0, // Reference ecliptic plane
    color: '#2b82c9',
    roughness: 0.45,
    metalness: 0.25,
    textureType: 'earth',
    hasMoons: true,
    description: 'Our home oasis with blue oceans and continental life.',
    framingPosition: [-64, -20, -18],
  },
  {
    name: 'Mars',
    arabicName: 'المريخ',
    radius: 0.95,
    distance: 48,
    speed: 0.88,
    rotationSpeed: 0.018,
    axialTilt: 0.44, // 25.2 degrees
    orbitInclination: 0.03,
    color: '#c4512e',
    roughness: 0.8,
    metalness: 0.15,
    textureType: 'mars',
    description: 'The Red Planet with iron oxide soil and polar caps.',
    framingPosition: [-36, 28, -25],
  },
  {
    name: 'Jupiter',
    arabicName: 'المشتري',
    radius: 3.6,
    distance: 92,
    speed: 0.46, // Slower outer gas giant
    rotationSpeed: 0.035,
    axialTilt: 0.05, // 3.1 degrees
    orbitInclination: 0.02,
    color: '#d4a373',
    roughness: 0.5,
    metalness: 0.1,
    textureType: 'jupiter',
    description: 'Colossal gas giant with iconic atmospheric bands and the Great Red Spot.',
    framingPosition: [68, -20, -22],
  },
  {
    name: 'Saturn',
    arabicName: 'زحل',
    radius: 2.9,
    distance: 126,
    speed: 0.34,
    rotationSpeed: 0.03,
    axialTilt: 0.47, // 26.7 degrees
    orbitInclination: 0.04,
    color: '#e6c887',
    roughness: 0.5,
    metalness: 0.15,
    textureType: 'saturn',
    hasRings: true,
    ringInnerRadius: 3.8,
    ringOuterRadius: 7.2,
    ringTilt: 0.47,
    description: 'The jewel of the solar system with magnificent icy rings.',
    framingPosition: [-68, 22, -22],
  },
  {
    name: 'Uranus',
    arabicName: 'أورانوس',
    radius: 2.0,
    distance: 158,
    speed: 0.24,
    rotationSpeed: -0.02,
    axialTilt: 1.71, // 97.8 degrees (rolling on its side)
    orbitInclination: 0.01,
    color: '#7be3e8',
    roughness: 0.4,
    metalness: 0.1,
    textureType: 'uranus',
    description: 'Cyan ice giant tilted on its side.',
    framingPosition: [-46, -30, -26],
  },
  {
    name: 'Neptune',
    arabicName: 'نبتون',
    radius: 1.9,
    distance: 190,
    speed: 0.19, // Outermost planet
    rotationSpeed: 0.022,
    axialTilt: 0.49, // 28.3 degrees
    orbitInclination: 0.03,
    color: '#274fd6',
    roughness: 0.4,
    metalness: 0.1,
    textureType: 'neptune',
    description: 'Dynamic deep blue ice giant with supersonic winds.',
    framingPosition: [48, -28, -26],
  },
];
