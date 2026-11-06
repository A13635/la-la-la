import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLANETS_DATA } from '../data/planets';
import { TextureGenerator } from '../utils/proceduralTextures';
import { generateMessagePoints, SampledPointsResult } from '../utils/textSampler';
import { spaceAudio } from '../utils/spaceAudio';
import { ParticleData } from '../types/space';

// Reusable math objects at module scope (Zero GC in render loop)
const _vecA = new THREE.Vector3();
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
  const sunGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.PointLight | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunGlowMeshRef = useRef<THREE.Mesh | null>(null);
  const sunRaysMeshRef = useRef<THREE.Mesh | null>(null);

  const smoothProgressRef = useRef(progress);
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

    // 2. High-Fidelity Renderer with balanced, gentle exposure (no harsh glare)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Calibrated subtle exposure: deep space darks without blinding highlights
    renderer.toneMappingExposure = 0.88;
    container.appendChild(renderer.domElement);

    // 3. Scene & Camera setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010204);
    scene.fog = new THREE.FogExp2(0x010204, 0.0016);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1400
    );
    camera.position.set(0, 48, 120);
    cameraRef.current = camera;

    // Ambient studio reflections at low intensity
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.02).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback
    }

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 420;
    controls.minDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minPolarAngle = 0.1;
    controlsRef.current = controls;

    // 5. Balanced, Soft Lighting Rig (Reduced intensities for natural deep space)
    // Soft central point light from the Sun (reduced from 5.0 to 1.8)
    const sunLight = new THREE.PointLight(0xfff0d0, 1.8, 450, 1.2);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Gentle directional fill light (reduced from 1.2 to 0.4)
    const dirLight = new THREE.DirectionalLight(0xe8f0ff, 0.4);
    dirLight.position.set(70, 45, 55);
    scene.add(dirLight);

    // Very subtle cool deep space hemisphere ambient (reduced from 0.9 to 0.3)
    const hemiLight = new THREE.HemisphereLight(0x22354c, 0x030408, 0.3);
    scene.add(hemiLight);

    // 6. Deep Space Background: Starfield + Subtle Nebulae
    const starsCount = 4800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    const starColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const r = 380 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      const roll = Math.random();
      if (roll < 0.45) {
        starColors[i * 3] = 0.82; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 0.95;
      } else if (roll < 0.8) {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.90; starColors[i * 3 + 2] = 0.82;
      } else {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.65; starColors[i * 3 + 2] = 0.48;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Faint, subtle cosmic nebula dust in background (low opacity)
    const nebulaTex = TextureGenerator.getNebulaTexture();
    const nebulaGeo = new THREE.PlaneGeometry(320, 320);
    const nebulaMat = new THREE.MeshBasicMaterial({
      map: nebulaTex,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const nebulaCoords: [number, number, number, number][] = [
      [120, 80, -320, 0.4],
      [-180, -60, -350, -0.6],
      [-80, 140, -300, 1.2],
      [220, -110, -340, 2.1],
    ];

    nebulaCoords.forEach(([nx, ny, nz, rot]) => {
      const nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
      nebulaMesh.position.set(nx, ny, nz);
      nebulaMesh.rotation.z = rot;
      scene.add(nebulaMesh);
    });

    // 7. Radiant Sun with Delicate Corona Glow (Soft, not blinding)
    const sunGroup = new THREE.Group();
    sunGroup.name = 'SunGroup';
    scene.add(sunGroup);
    sunGroupRef.current = sunGroup;

    const sunGeo = new THREE.SphereGeometry(6.6, 36, 36);
    const sunMat = new THREE.MeshBasicMaterial({
      map: TextureGenerator.getSunTexture(),
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // Atmospheric Corona Inner Glow (soft opacity 0.14)
    const coronaGeo = new THREE.SphereGeometry(7.6, 28, 28);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunGroup.add(coronaMesh);
    sunGlowMeshRef.current = coronaMesh;

    // Outer subtle flare halo
    const raysGeo = new THREE.PlaneGeometry(16, 16);
    const raysMat = new THREE.MeshBasicMaterial({
      map: TextureGenerator.getParticleGlowTexture(),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sunRaysMesh = new THREE.Mesh(raysGeo, raysMat);
    sunGroup.add(sunRaysMesh);
    sunRaysMeshRef.current = sunRaysMesh;

    // 8. Planets & Physically Tilted Orbits (Clean, no oversized satellites)
    const planetGroups: THREE.Group[] = [];
    const orbitLinesGroup = new THREE.Group();
    scene.add(orbitLinesGroup);
    orbitLinesGroupRef.current = orbitLinesGroup;

    PLANETS_DATA.forEach((config) => {
      const planetGroup = new THREE.Group();
      planetGroup.name = config.name;

      // Realistic Orbit Line (soft opacity 0.18)
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
          pt.applyAxisAngle(new THREE.Vector3(1, 0, 0), config.orbitInclination);
          return pt;
        })
      );
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x2b4c73,
        transparent: true,
        opacity: 0.18,
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      orbitLinesGroup.add(orbitLine);

      // Axial tilt pivot
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = config.axialTilt;
      planetGroup.add(tiltGroup);

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

      const pGeo = new THREE.SphereGeometry(config.radius, 36, 36);
      const pMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: config.roughness,
        metalness: config.metalness,
      });
      const planetMesh = new THREE.Mesh(pGeo, pMat);
      planetMesh.name = `${config.name}_Sphere`;
      tiltGroup.add(planetMesh);

      // Earth with natural, accurately-proportioned Moon ONLY (NO oversized satellites!)
      if (config.textureType === 'earth') {
        // Rotating cloud layer
        const cloudGeo = new THREE.SphereGeometry(config.radius * 1.02, 36, 36);
        const cloudMat = new THREE.MeshStandardMaterial({
          map: TextureGenerator.getEarthCloudsTexture(),
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        cloudMesh.name = 'EarthClouds';
        tiltGroup.add(cloudMesh);

        // Moon (natural satellite, accurately proportioned)
        const moonGeo = new THREE.SphereGeometry(config.radius * 0.27, 18, 18);
        const moonMat = new THREE.MeshStandardMaterial({
          color: 0xb5b8bd,
          roughness: 0.9,
          metalness: 0.1,
        });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.name = 'Moon';
        moonMesh.position.set(config.radius * 3.2, 0, 0);
        tiltGroup.add(moonMesh);
      }

      // Saturn Concentric Rings
      if (config.hasRings && config.ringInnerRadius && config.ringOuterRadius) {
        const ringGeo = new THREE.RingGeometry(
          config.ringInnerRadius,
          config.ringOuterRadius,
          80
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
          roughness: 0.5,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        tiltGroup.add(ringMesh);
      }

      scene.add(planetGroup);
      planetGroups.push(planetGroup);
    });
    planetsGroupRef.current = planetGroups;

    // 9. Load Message Particles (4,200 space rocks & crystals forming the message)
    let isMounted = true;
    generateMessagePoints(4200).then((result: SampledPointsResult) => {
      if (!isMounted) return;

      particlesDataRef.current = result.particles;

      // Faceted asteroid rock geometry
      const asteroidGeo = new THREE.DodecahedronGeometry(0.34, 1);
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
        metalness: 0.3,
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

    // 10. Animation Loop
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

      // Trigger audio automatically when the animation starts
      if (elapsed < 4.0 && isPlayingRef.current) {
        spaceAudio.start();
      }

      if (isPlayingRef.current) {
        const newProg = Math.min(1.0, progressRef.current + delta * 0.082);
        onProgressChange(newProg);
      }

      smoothProgressRef.current = THREE.MathUtils.damp(
        smoothProgressRef.current,
        progressRef.current,
        5.5,
        delta
      );
      const currentProg = smoothProgressRef.current;
      const easeProg = easeInOutCubic(currentProg);

      if (orbitLinesGroupRef.current) {
        orbitLinesGroupRef.current.visible = showOrbitsRef.current && currentProg < 0.65;
      }

      // Sun Positioning & Subtle Rotation
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
        const pulse = 1.0 + Math.sin(elapsed * 2.0) * 0.03;
        sunGlowMeshRef.current.scale.set(pulse, pulse, pulse);
      }
      if (sunRaysMeshRef.current) {
        sunRaysMeshRef.current.quaternion.copy(camera.quaternion);
        const rayPulse = 1.0 + Math.sin(elapsed * 1.5) * 0.05;
        sunRaysMeshRef.current.scale.set(rayPulse, rayPulse, rayPulse);
      }

      // Planetary Motion
      planetsGroupRef.current.forEach((group, idx) => {
        const config = PLANETS_DATA[idx];

        const orbitAngle = elapsed * config.speed * 0.22 + idx * 1.5;
        const orbitX = Math.cos(orbitAngle) * config.distance;
        const orbitZ = Math.sin(orbitAngle) * config.distance;
        const orbitY = Math.sin(orbitAngle) * (config.distance * Math.tan(config.orbitInclination));

        const frameX = config.framingPosition[0];
        const frameY = config.framingPosition[1];
        const frameZ = config.framingPosition[2];

        group.position.x = THREE.MathUtils.lerp(orbitX, frameX, easeProg);
        group.position.y = THREE.MathUtils.lerp(orbitY, frameY, easeProg);
        group.position.z = THREE.MathUtils.lerp(orbitZ, frameZ, easeProg);

        const sphereMesh = group.getObjectByName(`${config.name}_Sphere`);
        if (sphereMesh) {
          sphereMesh.rotation.y += config.rotationSpeed;
        }

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

      // Asteroid Particles
      const instMesh = instancedMeshRef.current;
      const particles = particlesDataRef.current;

      if (instMesh && particles.length > 0) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          const delay = p.phaseOffset;
          const adjustedProg = THREE.MathUtils.clamp((currentProg - delay) / (1 - delay * 0.7), 0, 1);
          const t = easeInOutCubic(adjustedProg);

          const orbitR = Math.sqrt(p.solarPos[0] * p.solarPos[0] + p.solarPos[2] * p.solarPos[2]);
          const angSpeed = (0.12 * Math.sqrt(60 / Math.max(20, orbitR)));
          const currentAngle = Math.atan2(p.solarPos[2], p.solarPos[0]) + (elapsed * angSpeed);
          const dynamicSolarX = Math.cos(currentAngle) * orbitR;
          const dynamicSolarZ = Math.sin(currentAngle) * orbitR;
          const dynamicSolarY = p.solarPos[1] + Math.sin(elapsed * 0.5 + p.driftSeed) * 0.25;

          const breathWave = Math.sin(elapsed * 1.8 + p.driftSeed * 0.1) * 0.2;
          const targetX = p.targetPos[0];
          const targetY = p.targetPos[1] + breathWave * 0.4;
          const targetZ = p.targetPos[2] + breathWave;

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

      // Camera Control & Cinematic Mode
      if (cameraModeRef.current === 'cinematic') {
        if (currentProg < 0.2) {
          const camAngle = elapsed * 0.05 + 0.3;
          targetCameraPos.set(
            Math.cos(camAngle) * 95,
            38 + Math.sin(elapsed * 0.08) * 6,
            Math.sin(camAngle) * 95
          );
          targetCameraLookAt.set(0, 0, 0);
        } else if (currentProg < 0.88) {
          const t2 = (currentProg - 0.2) / 0.68;
          const camY = THREE.MathUtils.lerp(38, 0, t2);
          const camZ = THREE.MathUtils.lerp(95, 82, t2);
          const camX = Math.sin(elapsed * 0.04) * 8 * (1 - t2);
          targetCameraPos.set(camX, camY, camZ);
          targetCameraLookAt.set(0, 0, 0);
        } else {
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

      // Render directly with calibrated exposure (clean, deep contrast)
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
      raysGeo.dispose();
      raysMat.dispose();
      nebulaGeo.dispose();
      nebulaMat.dispose();
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
