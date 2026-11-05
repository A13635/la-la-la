import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLANETS_DATA } from '../data/planets';
import { TextureGenerator } from '../utils/proceduralTextures';
import { generateMessagePoints, SampledPointsResult } from '../utils/textSampler';
import { createISSModel, createHubbleModel, createVoyagerModel } from '../models/satellites';
import { spaceAudio } from '../utils/spaceAudio';
import { ParticleData } from '../types/space';

// Reusable math objects at module scope (Zero GC in render loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

// Sun framing destination in Scene 3 (high in upper-right background so it NEVER blocks "في" or any text)
const SUN_FRAMING_POS = new THREE.Vector3(68, 34, -42);

interface ThreeCanvasProps {
  progress: number;
  onProgressChange: (progress: number) => void;
  isPlaying: boolean;
  cameraMode: 'cinematic' | 'orbit';
  showOrbits: boolean;
  isMuted: boolean;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  progress,
  onProgressChange,
  isPlaying,
  cameraMode,
  showOrbits,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // State refs for animation loop
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const showOrbitsRef = useRef(showOrbits);
  showOrbitsRef.current = showOrbits;

  // Scene references
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const particlesDataRef = useRef<ParticleData[]>([]);
  const planetsGroupRef = useRef<THREE.Group[]>([]);
  const orbitLinesGroupRef = useRef<THREE.Group | null>(null);
  const satellitesRef = useRef<{ group: THREE.Group; initialPlanet?: string; targetPos: [number, number, number] }[]>([]);
  const sunGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.PointLight | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunGlowMeshRef = useRef<THREE.Mesh | null>(null);

  // Smooth interpolation progress
  const smoothProgressRef = useRef(progress);

  // Trigger sound effect on transition threshold
  const lastPhaseRef = useRef<'solar' | 'transforming' | 'message'>('solar');

  useEffect(() => {
    let phase: 'solar' | 'transforming' | 'message' = 'solar';
    if (progress >= 0.92) phase = 'message';
    else if (progress > 0.15) phase = 'transforming';

    if (phase !== lastPhaseRef.current) {
      if (phase === 'transforming') {
        spaceAudio.playTransformationSfx();
      } else if (phase === 'message') {
        spaceAudio.playFormationChime();
      }
      lastPhaseRef.current = phase;
    }
  }, [progress]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard (Skill Directive r160+)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. Scene & Camera setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);
    scene.fog = new THREE.FogExp2(0x020308, 0.0022);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1200
    );
    // Initial cinematic perspective: elevated overview of the solar system
    camera.position.set(0, 48, 120);
    cameraRef.current = camera;

    // Mandatory RoomEnvironment for realistic PBR reflections
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Graceful fallback
    }

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 380;
    controls.minDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minPolarAngle = 0.1;
    controlsRef.current = controls;

    // 5. Lighting Rig
    // Sun Central Point Light (Moves with Sun)
    const sunLight = new THREE.PointLight(0xfff6dc, 4.5, 450, 1.1);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Directional Key Light
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.1);
    dirLight.position.set(70, 45, 60);
    scene.add(dirLight);

    // Cool Cosmic Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0x406085, 0x080915, 0.85);
    scene.add(hemiLight);

    // 6. Deep Space Background: Cosmic Starfield
    const starsCount = 5000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    const starColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const r = 350 + Math.random() * 450;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      const roll = Math.random();
      if (roll < 0.4) {
        starColors[i * 3] = 0.85; starColors[i * 3 + 1] = 0.92; starColors[i * 3 + 2] = 1.0;
      } else if (roll < 0.75) {
        starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 0.85;
      } else {
        starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.75; starColors[i * 3 + 2] = 0.6;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 7. Sun Group (Central in Scene 1, moves to background framing in Scene 3)
    const sunGroup = new THREE.Group();
    sunGroup.name = 'SunGroup';
    scene.add(sunGroup);
    sunGroupRef.current = sunGroup;

    const sunGeo = new THREE.SphereGeometry(6.5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      map: TextureGenerator.getSunTexture(),
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // Atmospheric Corona Glow around Sun
    const coronaGeo = new THREE.SphereGeometry(7.8, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunGroup.add(coronaMesh);
    sunGlowMeshRef.current = coronaMesh;

    // 8. Planets & Physically Tilted Orbit Hierarchy
    const planetGroups: THREE.Group[] = [];
    const orbitLinesGroup = new THREE.Group();
    scene.add(orbitLinesGroup);
    orbitLinesGroupRef.current = orbitLinesGroup;

    PLANETS_DATA.forEach((config) => {
      // Planet Root Group (handles orbital positioning & framing transition)
      const planetGroup = new THREE.Group();
      planetGroup.name = config.name;

      // Realistic Orbit Line on Ecliptic with subtle inclination
      const orbitCurve = new THREE.EllipseCurve(
        0, 0,
        config.distance, config.distance,
        0, 2 * Math.PI,
        false,
        0
      );
      const orbitPoints = orbitCurve.getPoints(120);
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(
        orbitPoints.map((p) => {
          const pt = new THREE.Vector3(p.x, 0, p.y);
          // Apply realistic physical orbital inclination
          pt.applyAxisAngle(new THREE.Vector3(1, 0, 0), config.orbitInclination);
          return pt;
        })
      );
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x3d5a80,
        transparent: true,
        opacity: 0.25,
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      orbitLinesGroup.add(orbitLine);

      // Planet Tilt Pivot: preserves physical axial tilt
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = config.axialTilt;
      planetGroup.add(tiltGroup);

      // Planet Sphere
      let texture: THREE.CanvasTexture;
      switch (config.textureType) {
        case 'earth':
          texture = TextureGenerator.getEarthTexture();
          break;
        case 'jupiter':
          texture = TextureGenerator.getJupiterTexture();
          break;
        case 'saturn':
          texture = TextureGenerator.getSaturnTexture();
          break;
        case 'mars':
          texture = TextureGenerator.getMarsTexture();
          break;
        case 'venus':
          texture = TextureGenerator.getVenusTexture();
          break;
        case 'mercury':
          texture = TextureGenerator.getMercuryTexture();
          break;
        case 'uranus':
          texture = TextureGenerator.getUranusTexture();
          break;
        case 'neptune':
          texture = TextureGenerator.getNeptuneTexture();
          break;
        default:
          texture = TextureGenerator.getEarthTexture();
      }

      const pGeo = new THREE.SphereGeometry(config.radius, 32, 32);
      const pMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: config.roughness,
        metalness: config.metalness,
      });
      const planetMesh = new THREE.Mesh(pGeo, pMat);
      planetMesh.name = `${config.name}_Sphere`;
      tiltGroup.add(planetMesh);

      // Earth clouds & Moon
      if (config.textureType === 'earth') {
        const cloudGeo = new THREE.SphereGeometry(config.radius * 1.025, 32, 32);
        const cloudMat = new THREE.MeshStandardMaterial({
          map: TextureGenerator.getEarthCloudsTexture(),
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
        });
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        cloudMesh.name = 'EarthClouds';
        tiltGroup.add(cloudMesh);

        // Moon
        const moonGeo = new THREE.SphereGeometry(config.radius * 0.27, 16, 16);
        const moonMat = new THREE.MeshStandardMaterial({
          color: 0xc4c7cc,
          roughness: 0.9,
          metalness: 0.1,
        });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.name = 'Moon';
        moonMesh.position.set(config.radius * 3.2, 0, 0);
        tiltGroup.add(moonMesh);
      }

      // Saturn Rings (aligned with axial tilt)
      if (config.hasRings && config.ringInnerRadius && config.ringOuterRadius) {
        const ringGeo = new THREE.RingGeometry(
          config.ringInnerRadius,
          config.ringOuterRadius,
          64
        );
        const pos = ringGeo.attributes.position;
        const uvs = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vy = pos.getY(i);
          const dist = Math.sqrt(vx * vx + vy * vy);
          const u = (dist - config.ringInnerRadius) / (config.ringOuterRadius - config.ringInnerRadius);
          uvs.setXY(i, u, 0.5);
        }

        const ringMat = new THREE.MeshStandardMaterial({
          map: TextureGenerator.getSaturnRingsTexture(),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          roughness: 0.6,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        tiltGroup.add(ringMesh);
      }

      scene.add(planetGroup);
      planetGroups.push(planetGroup);
    });
    planetsGroupRef.current = planetGroups;

    // 9. Procedural Composite Satellites
    const iss = createISSModel();
    const hubble = createHubbleModel();
    const voyager = createVoyagerModel();

    iss.scale.setScalar(0.7);
    hubble.scale.setScalar(0.65);
    voyager.scale.setScalar(0.6);

    scene.add(iss);
    scene.add(hubble);
    scene.add(voyager);

    satellitesRef.current = [
      { group: iss, initialPlanet: 'Earth', targetPos: [30, 14, 4] },
      { group: hubble, initialPlanet: 'Earth', targetPos: [-36, -12, 4] },
      { group: voyager, initialPlanet: 'Jupiter', targetPos: [0, 2, 5] },
    ];

    // 10. Load Message Particles with wide space distribution
    let isMounted = true;
    generateMessagePoints(4200).then((result: SampledPointsResult) => {
      if (!isMounted) return;

      particlesDataRef.current = result.particles;

      if (result.satelliteAnchorPoints.length >= 3) {
        satellitesRef.current[0].targetPos = result.satelliteAnchorPoints[0];
        satellitesRef.current[1].targetPos = result.satelliteAnchorPoints[1];
        satellitesRef.current[2].targetPos = result.satelliteAnchorPoints[2];
      }

      // Faceted asteroid rock geometry
      const asteroidGeo = new THREE.DodecahedronGeometry(0.35, 1);
      const posAttr = asteroidGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const jitter = 0.88 + (Math.sin(vx * 15 + vy * 12 + vz * 9) * 0.5 + 0.5) * 0.24;
        posAttr.setXYZ(i, vx * jitter, vy * jitter, vz * jitter);
      }
      asteroidGeo.computeVertexNormals();

      const instancedMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.35,
        flatShading: true,
      });

      const instancedMesh = new THREE.InstancedMesh(
        asteroidGeo,
        instancedMat,
        result.particles.length
      );
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instancedMesh.frustumCulled = false;

      for (let i = 0; i < result.particles.length; i++) {
        const p = result.particles[i];
        _color.setRGB(p.color[0], p.color[1], p.color[2]);
        instancedMesh.setColorAt(i, _color);

        _vecA.set(p.solarPos[0], p.solarPos[1], p.solarPos[2]);
        _scale.setScalar(p.size);
        _mat4.compose(_vecA, _quat, _scale);
        instancedMesh.setMatrixAt(i, _mat4);
      }

      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
      }
      instancedMesh.instanceMatrix.needsUpdate = true;

      scene.add(instancedMesh);
      instancedMeshRef.current = instancedMesh;

      setIsLoading(false);
    });

    // 11. Animation Loop
    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const targetCameraPos = new THREE.Vector3();
    const targetCameraLookAt = new THREE.Vector3();

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Advance progress if playing
      if (isPlayingRef.current) {
        const newProg = Math.min(1.0, progressRef.current + delta * 0.082);
        onProgressChange(newProg);
      }

      // Smooth progress interpolation
      smoothProgressRef.current = THREE.MathUtils.damp(
        smoothProgressRef.current,
        progressRef.current,
        5.5,
        delta
      );
      const currentProg = smoothProgressRef.current;
      const easeProg = easeInOutCubic(currentProg);

      // Orbits lines visibility
      if (orbitLinesGroupRef.current) {
        orbitLinesGroupRef.current.visible = showOrbitsRef.current && currentProg < 0.65;
      }

      // 1. DYNAMIC SUN POSITION:
      // In Scene 1: Sun is at [0, 0, 0] at the center of the solar system.
      // In Scene 2 & 3: Sun smoothly moves to SUN_FRAMING_POS [68, 34, -42]!
      // This completely ensures that the Sun NEVER blocks the word "في" or any part of the text!
      if (sunGroupRef.current) {
        sunGroupRef.current.position.x = THREE.MathUtils.lerp(0, SUN_FRAMING_POS.x, easeProg);
        sunGroupRef.current.position.y = THREE.MathUtils.lerp(0, SUN_FRAMING_POS.y, easeProg);
        sunGroupRef.current.position.z = THREE.MathUtils.lerp(0, SUN_FRAMING_POS.z, easeProg);
      }
      if (sunLightRef.current) {
        sunLightRef.current.position.x = THREE.MathUtils.lerp(0, SUN_FRAMING_POS.x, easeProg);
        sunLightRef.current.position.y = THREE.MathUtils.lerp(0, SUN_FRAMING_POS.y, easeProg);
        sunLightRef.current.position.z = THREE.MathUtils.lerp(0, SUN_FRAMING_POS.z, easeProg);
      }

      if (sunMeshRef.current) {
        sunMeshRef.current.rotation.y += delta * 0.12;
      }
      if (sunGlowMeshRef.current) {
        const pulse = 1.0 + Math.sin(elapsed * 2.2) * 0.04;
        sunGlowMeshRef.current.scale.set(pulse, pulse, pulse);
      }

      // 2. PHYSICAL PLANETARY ORBITS (Keplerian speeds & tilt)
      planetsGroupRef.current.forEach((group, idx) => {
        const config = PLANETS_DATA[idx];

        // Keplerian physics: calibrated realistic speed factor
        const orbitAngle = elapsed * config.speed * 0.22 + idx * 1.5;
        const orbitX = Math.cos(orbitAngle) * config.distance;
        const orbitZ = Math.sin(orbitAngle) * config.distance;
        // Subtle realistic orbital inclination plane
        const orbitY = Math.sin(orbitAngle) * (config.distance * Math.tan(config.orbitInclination));

        // Framing position in Scene 3
        const frameX = config.framingPosition[0];
        const frameY = config.framingPosition[1];
        const frameZ = config.framingPosition[2];

        // Smooth transition from orbit to framing position
        group.position.x = THREE.MathUtils.lerp(orbitX, frameX, easeProg);
        group.position.y = THREE.MathUtils.lerp(orbitY, frameY, easeProg);
        group.position.z = THREE.MathUtils.lerp(orbitZ, frameZ, easeProg);

        // Self rotation on tilted axis
        const sphereMesh = group.getObjectByName(`${config.name}_Sphere`);
        if (sphereMesh) {
          sphereMesh.rotation.y += config.rotationSpeed;
        }

        // Earth clouds and Moon
        if (config.textureType === 'earth') {
          const clouds = group.getObjectByName('EarthClouds');
          if (clouds) clouds.rotation.y += 0.003;
          const moon = group.getObjectByName('Moon');
          if (moon) {
            const moonAngle = elapsed * 1.1;
            moon.position.set(
              Math.cos(moonAngle) * (config.radius * 3.2),
              Math.sin(moonAngle * 0.5) * 0.4,
              Math.sin(moonAngle) * (config.radius * 3.2)
            );
          }
        }
      });

      // 3. Satellites
      satellitesRef.current.forEach((sat, idx) => {
        let parentPos = _vecA.set(0, 0, 0);
        if (sat.initialPlanet) {
          const planetGroup = planetsGroupRef.current.find(
            (p) => p.name === sat.initialPlanet
          );
          if (planetGroup) parentPos = planetGroup.position;
        }

        const satOrbitAngle = elapsed * (1.6 + idx * 0.4);
        const satR = 3.6 + idx * 0.8;
        const satInitX = parentPos.x + Math.cos(satOrbitAngle) * satR;
        const satInitY = parentPos.y + Math.sin(satOrbitAngle * 1.2) * (satR * 0.4);
        const satInitZ = parentPos.z + Math.sin(satOrbitAngle) * satR;

        const targetX = sat.targetPos[0];
        const targetY = sat.targetPos[1];
        const targetZ = sat.targetPos[2];

        const arcY = Math.sin(easeProg * Math.PI) * 14;

        sat.group.position.x = THREE.MathUtils.lerp(satInitX, targetX, easeProg);
        sat.group.position.y = THREE.MathUtils.lerp(satInitY, targetY, easeProg) + arcY;
        sat.group.position.z = THREE.MathUtils.lerp(satInitZ, targetZ, easeProg);

        sat.group.rotation.y += delta * 0.8;
        sat.group.rotation.x = Math.sin(elapsed + idx) * 0.2;
      });

      // 4. Asteroid / Stardust Particles Forming the Message
      const instMesh = instancedMeshRef.current;
      const particles = particlesDataRef.current;

      if (instMesh && particles.length > 0) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          const delay = p.phaseOffset;
          const adjustedProg = THREE.MathUtils.clamp((currentProg - delay) / (1 - delay * 0.7), 0, 1);
          const t = easeInOutCubic(adjustedProg);

          // Realistic orbital motion for asteroids in vast space (Scene 1)
          const orbitR = Math.sqrt(p.solarPos[0] * p.solarPos[0] + p.solarPos[2] * p.solarPos[2]);
          // Keplerian drift speed: v ~ 1/sqrt(r)
          const angSpeed = (0.12 * Math.sqrt(60 / Math.max(20, orbitR)));
          const currentAngle = Math.atan2(p.solarPos[2], p.solarPos[0]) + (elapsed * angSpeed);
          const dynamicSolarX = Math.cos(currentAngle) * orbitR;
          const dynamicSolarZ = Math.sin(currentAngle) * orbitR;
          const dynamicSolarY = p.solarPos[1] + Math.sin(elapsed * 0.5 + p.driftSeed) * 0.25;

          // Message formation breathing & 3D undulation (Scene 3)
          const breathWave = Math.sin(elapsed * 1.8 + p.driftSeed * 0.1) * 0.2;
          const targetX = p.targetPos[0];
          const targetY = p.targetPos[1] + breathWave * 0.4;
          const targetZ = p.targetPos[2] + breathWave;

          // Spiral convergence curl
          const swirlAngle = (1 - t) * Math.PI * 2.2 * (p.driftSeed % 2 === 0 ? 1 : -1);
          const swirlRadius = Math.sin(t * Math.PI) * 14.0 * (p.size * 0.85);

          const curX = THREE.MathUtils.lerp(dynamicSolarX, targetX, t) + Math.cos(swirlAngle) * swirlRadius;
          const curY = THREE.MathUtils.lerp(dynamicSolarY, targetY, t) + Math.sin(t * Math.PI) * 8.0;
          const curZ = THREE.MathUtils.lerp(dynamicSolarZ, targetZ, t) + Math.sin(swirlAngle) * swirlRadius;

          _vecA.set(curX, curY, curZ);

          const scaleMod = 1.0 + Math.sin(t * Math.PI) * 0.35;
          _scale.setScalar(p.size * scaleMod);

          _quat.setFromEuler(
            new THREE.Euler(
              elapsed * p.rotationSpeed[0],
              elapsed * p.rotationSpeed[1],
              elapsed * p.rotationSpeed[2]
            )
          );

          _mat4.compose(_vecA, _quat, _scale);
          instMesh.setMatrixAt(i, _mat4);
        }
        instMesh.instanceMatrix.needsUpdate = true;
      }

      // 5. Camera Control & Cinematic Mode
      if (cameraModeRef.current === 'cinematic') {
        if (currentProg < 0.2) {
          // Scene 1: Entering the Solar System - Slow, majestic camera glide
          const camAngle = elapsed * 0.05 + 0.3;
          targetCameraPos.set(
            Math.cos(camAngle) * 95,
            38 + Math.sin(elapsed * 0.08) * 6,
            Math.sin(camAngle) * 95
          );
          targetCameraLookAt.set(0, 0, 0);
        } else if (currentProg < 0.88) {
          // Scene 2: Cosmic Transformation - Camera pulls back & centers on message
          const t2 = (currentProg - 0.2) / 0.68;
          const camY = THREE.MathUtils.lerp(38, 0, t2);
          const camZ = THREE.MathUtils.lerp(95, 82, t2);
          const camX = Math.sin(elapsed * 0.04) * 8 * (1 - t2);
          targetCameraPos.set(camX, camY, camZ);
          targetCameraLookAt.set(0, 0, 0);
        } else {
          // Scene 3: The Message Formed - Centered, subtle celestial float
          const subtleDriftX = Math.sin(elapsed * 0.2) * 3.5;
          const subtleDriftY = Math.cos(elapsed * 0.16) * 1.8;
          targetCameraPos.set(subtleDriftX, subtleDriftY, 82);
          targetCameraLookAt.set(0, 0, 0);
        }

        camera.position.lerp(targetCameraPos, delta * 3.0);
        controls.target.lerp(targetCameraLookAt, delta * 3.0);
        controls.update();
      } else {
        controls.update();
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Pre-warm fallback
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);

      renderer.dispose();
      starGeo.dispose();
      starMat.dispose();
      sunGeo.dispose();
      sunMat.dispose();
      coronaGeo.dispose();
      coronaMat.dispose();
      if (instancedMeshRef.current) {
        instancedMeshRef.current.geometry.dispose();
        if (Array.isArray(instancedMeshRef.current.material)) {
          instancedMeshRef.current.material.forEach((m) => m.dispose());
        } else {
          instancedMeshRef.current.material.dispose();
        }
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-3 z-50">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
