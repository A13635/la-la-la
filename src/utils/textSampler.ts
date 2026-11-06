import { ParticleData } from '../types/space';

export interface SampledPointsResult {
  particles: ParticleData[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  satelliteAnchorPoints: [number, number, number][];
}

export async function generateMessagePoints(
  totalCount = 4200
): Promise<SampledPointsResult> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue with system fallbacks
    }
  }

  const canvas = document.createElement('canvas');
  const width = 2000;
  const height = 1000;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return generateFallbackPoints(totalCount);
  }

  ctx.clearRect(0, 0, width, height);

  const line1 = 'مش عايزين خامس';
  const line2 = 'معاكم في تيم';
  const line3 = 'NASA SPACE APPS؟';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  // Draw Line 1 (Arabic bold)
  ctx.direction = 'rtl';
  ctx.font = '900 132px "Cairo", "Alexandria", "Segoe UI", "Tahoma", sans-serif';
  ctx.fillText(line1, width / 2, height * 0.25);

  // Draw Line 2 (Arabic bold)
  ctx.direction = 'rtl';
  ctx.font = '900 128px "Cairo", "Alexandria", "Segoe UI", "Tahoma", sans-serif';
  ctx.fillText(line2, width / 2, height * 0.52);

  // Draw Line 3 (English + Arabic question mark)
  ctx.direction = 'rtl';
  ctx.font = '900 118px "Space Grotesk", "Cairo", "Segoe UI", sans-serif';
  ctx.fillText(line3, width / 2, height * 0.79);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const candidatePixels: { x: number; y: number; line: number }[] = [];
  let minX = width, maxX = 0, minY = height, maxY = 0;

  const step = 5;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha > 120) {
        let line = 1;
        if (y > height * 0.65) line = 3;
        else if (y > height * 0.38) line = 2;

        candidatePixels.push({ x, y, line });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (candidatePixels.length < 500) {
    return generateFallbackPoints(totalCount);
  }

  const targetPoints: { x: number; y: number; line: number }[] = [];
  if (candidatePixels.length <= totalCount) {
    targetPoints.push(...candidatePixels);
    while (targetPoints.length < totalCount) {
      const pick = candidatePixels[Math.floor(Math.random() * candidatePixels.length)];
      targetPoints.push({
        x: pick.x + (Math.random() - 0.5) * (step * 0.75),
        y: pick.y + (Math.random() - 0.5) * (step * 0.75),
        line: pick.line,
      });
    }
  } else {
    const ratio = candidatePixels.length / totalCount;
    for (let i = 0; i < totalCount; i++) {
      const idx = Math.min(candidatePixels.length - 1, Math.floor(i * ratio));
      targetPoints.push(candidatePixels[idx]);
    }
  }

  const textW = maxX - minX;
  const textH = maxY - minY;
  const scale3DX = 96 / textW;
  const scale3DY = 50 / textH;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const particles: ParticleData[] = [];
  const satelliteAnchorPoints: [number, number, number][] = [];

  let qMarkPoint: [number, number, number] | null = null;
  let line1DotPoint: [number, number, number] | null = null;
  let line2DotPoint: [number, number, number] | null = null;

  for (let i = 0; i < targetPoints.length; i++) {
    const pt = targetPoints[i];

    const tx = (pt.x - midX) * scale3DX;
    const ty = -(pt.y - midY) * scale3DY;

    const depthCurve = Math.sin(tx * 0.08) * 1.5 + Math.cos(ty * 0.1) * 1.0;
    const microJitter = (pseudoRandom(i * 3 + 1) - 0.5) * 1.2;
    const tz = depthCurve + microJitter;

    if (!qMarkPoint && pt.line === 3 && pt.x < minX + textW * 0.22) {
      qMarkPoint = [tx, ty + 1.2, tz + 2.5];
    }
    if (!line1DotPoint && pt.line === 1 && pt.x > midX + textW * 0.22) {
      line1DotPoint = [tx, ty + 1.8, tz + 2.0];
    }
    if (!line2DotPoint && pt.line === 2 && Math.abs(pt.x - midX) < 12) {
      line2DotPoint = [tx, ty + 1.5, tz + 2.5];
    }

    // REALISTIC VAST DISTRIBUTION ACROSS SOLAR SYSTEM
    const distributionZone = pseudoRandom(i * 7 + 3);
    let r = 0;
    let theta = 0;
    let sy = 0;

    if (distributionZone < 0.52) {
      // Main Asteroid Belt (realistic ring between Mars and Jupiter)
      r = 56 + pseudoRandom(i * 13 + 7) * 28;
      theta = pseudoRandom(i * 11 + 5) * Math.PI * 2;
      sy = (pseudoRandom(i * 17 + 2) - 0.5) * 6.0;
    } else if (distributionZone < 0.74) {
      // Jupiter Trojan Swarms
      const isL4 = pseudoRandom(i * 19 + 1) > 0.5;
      const baseAngle = isL4 ? Math.PI / 3 : -Math.PI / 3;
      const angleDispersion = (pseudoRandom(i * 23 + 4) - 0.5) * 0.5;
      theta = baseAngle + angleDispersion;
      r = 88 + pseudoRandom(i * 29 + 6) * 8;
      sy = (pseudoRandom(i * 31 + 9) - 0.5) * 7.5;
    } else if (distributionZone < 0.90) {
      // Outer Kuiper Belt Debris
      r = 115 + pseudoRandom(i * 37 + 8) * 100;
      theta = pseudoRandom(i * 41 + 12) * Math.PI * 2;
      sy = (pseudoRandom(i * 43 + 3) - 0.5) * 14.0;
    } else {
      // Inner planetary dust
      r = 26 + pseudoRandom(i * 47 + 5) * 24;
      theta = pseudoRandom(i * 53 + 7) * Math.PI * 2;
      sy = (pseudoRandom(i * 59 + 2) - 0.5) * 4.0;
    }

    const sx = Math.cos(theta) * r;
    const sz = Math.sin(theta) * r;

    // AUTHENTIC ASTEROID ROCK SPECTRUM (NO NEON GLOW / LIGHTNING!)
    // Real carbonaceous chondrites, stony silicate asteroids, and nickel-iron meteorites
    const rockClass = pseudoRandom(i * 61 + 11);
    let rgb: [number, number, number] = [0.38, 0.36, 0.34]; // Charcoal stone
    const size = 0.32 + pseudoRandom(i * 67 + 13) * 0.32;

    if (rockClass < 0.50) {
      // C-type Carbonaceous Chondrite (Dark, carbon-rich, authentic asteroid belt rock)
      const c = 0.26 + pseudoRandom(i * 71 + 3) * 0.16;
      rgb = [c, c * 0.96, c * 0.92];
    } else if (rockClass < 0.82) {
      // S-type Stony Silicate (Dusty brownish-gray regolith, iron-magnesium silicate)
      const s = 0.38 + pseudoRandom(i * 73 + 5) * 0.20;
      rgb = [s * 1.05, s * 0.98, s * 0.88];
    } else {
      // M-type Metallic Nickel-Iron (Specular metallic meteorite sheen)
      const m = 0.48 + pseudoRandom(i * 79 + 9) * 0.22;
      rgb = [m * 0.98, m * 0.96, m * 0.94];
    }

    // Subtle bronze-gold meteorite mineral tone for Line 3 (NASA Space Apps)
    if (pt.line === 3 && rockClass > 0.6) {
      rgb = [0.58, 0.48, 0.34];
    }

    particles.push({
      solarPos: [sx, sy, sz],
      targetPos: [tx, ty, tz],
      currentPos: [sx, sy, sz],
      color: rgb,
      size,
      type: 'asteroid', // Real space asteroid
      phaseOffset: pseudoRandom(i * 83 + 19) * 0.28,
      rotationSpeed: [
        (pseudoRandom(i * 89 + 1) - 0.5) * 1.2,
        (pseudoRandom(i * 91 + 2) - 0.5) * 1.2,
        (pseudoRandom(i * 97 + 3) - 0.5) * 1.2,
      ],
      driftSeed: pseudoRandom(i * 101 + 5) * 100,
    });
  }

  satelliteAnchorPoints.push(
    qMarkPoint || [-36, -12, 5],
    line1DotPoint || [30, 14, 4],
    line2DotPoint || [0, 2, 5]
  );

  return {
    particles,
    bounds: { minX, maxX, minY, maxY },
    satelliteAnchorPoints,
  };
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 997.123 + 43.17) * 43758.5453;
  return x - Math.floor(x);
}

function generateFallbackPoints(totalCount: number): SampledPointsResult {
  const particles: ParticleData[] = [];
  for (let i = 0; i < totalCount; i++) {
    const angle = (i / totalCount) * Math.PI * 6;
    const r = 50 + (i / totalCount) * 100;
    const sx = Math.cos(angle) * r;
    const sz = Math.sin(angle) * r;
    const sy = (pseudoRandom(i) - 0.5) * 6;

    const col = i % 80;
    const row = Math.floor(i / 80);
    const tx = (col - 40) * 1.1;
    const ty = -(row - 25) * 0.9;
    const tz = (pseudoRandom(i * 2) - 0.5) * 2;

    const c = 0.35 + (i % 5) * 0.05;
    particles.push({
      solarPos: [sx, sy, sz],
      targetPos: [tx, ty, tz],
      currentPos: [sx, sy, sz],
      color: [c, c * 0.95, c * 0.9],
      size: 0.35,
      type: 'asteroid',
      phaseOffset: pseudoRandom(i * 3) * 0.3,
      rotationSpeed: [1, 1, 1],
      driftSeed: i,
    });
  }

  return {
    particles,
    bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 500 },
    satelliteAnchorPoints: [[-36, -12, 5], [30, 14, 4], [0, 2, 5]],
  };
}
