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

  // Exact 3 lines
  const line1 = 'مش عايزين رابع';
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

    // Organic 3D letter depth with subtle undulation
    const depthCurve = Math.sin(tx * 0.08) * 1.5 + Math.cos(ty * 0.1) * 1.0;
    const microJitter = (pseudoRandom(i * 3 + 1) - 0.5) * 1.2;
    const tz = depthCurve + microJitter;

    // Capture hero satellite anchors
    if (!qMarkPoint && pt.line === 3 && pt.x < minX + textW * 0.22) {
      qMarkPoint = [tx, ty + 1.2, tz + 2.5];
    }
    if (!line1DotPoint && pt.line === 1 && pt.x > midX + textW * 0.22) {
      line1DotPoint = [tx, ty + 1.8, tz + 2.0];
    }
    if (!line2DotPoint && pt.line === 2 && Math.abs(pt.x - midX) < 12) {
      line2DotPoint = [tx, ty + 1.5, tz + 2.5];
    }

    // WIDE, REALISTIC SOLAR SYSTEM DISTRIBUTION
    // Rather than being cramped into a dense clump, asteroids are spread across a vast space:
    // 1. Main Asteroid Belt (between Mars 48 and Jupiter 92): r ~ 56 to 82, wide disc
    // 2. Jupiter Trojan Swarms (L4 & L5 at 60 deg ahead/behind Jupiter): r ~ 88 to 96
    // 3. Kuiper Belt & Outer Disc: r ~ 110 to 220, expansive outer space field
    // 4. Inner Planetary Dust: r ~ 25 to 50
    const distributionZone = pseudoRandom(i * 7 + 3);
    let r = 0;
    let theta = 0;
    let sy = 0;

    if (distributionZone < 0.50) {
      // Main Asteroid Belt (wide, realistic disc between Mars & Jupiter)
      r = 56 + pseudoRandom(i * 13 + 7) * 26; // 56 to 82
      theta = pseudoRandom(i * 11 + 5) * Math.PI * 2;
      sy = (pseudoRandom(i * 17 + 2) - 0.5) * 6.5; // Natural disc thickness
    } else if (distributionZone < 0.72) {
      // Jupiter Trojans (Lagrange L4 & L5 orbital swarms)
      const isL4 = pseudoRandom(i * 19 + 1) > 0.5;
      const baseAngle = isL4 ? Math.PI / 3 : -Math.PI / 3;
      const angleDispersion = (pseudoRandom(i * 23 + 4) - 0.5) * 0.6; // ~35 degrees spread
      theta = baseAngle + angleDispersion;
      r = 88 + pseudoRandom(i * 29 + 6) * 8; // 88 to 96
      sy = (pseudoRandom(i * 31 + 9) - 0.5) * 8.0;
    } else if (distributionZone < 0.90) {
      // Expansive Kuiper Belt & Scattered Cosmic Field
      r = 110 + pseudoRandom(i * 37 + 8) * 110; // 110 to 220 (spans the entire outer solar system!)
      theta = pseudoRandom(i * 41 + 12) * Math.PI * 2;
      sy = (pseudoRandom(i * 43 + 3) - 0.5) * 16.0;
    } else {
      // Inner planetary debris field
      r = 25 + pseudoRandom(i * 47 + 5) * 25; // 25 to 50
      theta = pseudoRandom(i * 53 + 7) * Math.PI * 2;
      sy = (pseudoRandom(i * 59 + 2) - 0.5) * 4.0;
    }

    const sx = Math.cos(theta) * r;
    const sz = Math.sin(theta) * r;

    // Rock / Particle types & aesthetic
    const typeRoll = pseudoRandom(i * 61 + 11);
    let type: 'asteroid' | 'crystal' | 'stardust' | 'ion' = 'asteroid';
    let rgb: [number, number, number] = [0.75, 0.72, 0.68];
    // Delicate, well-proportioned size so the field feels expansive and refined
    let size = 0.28 + pseudoRandom(i * 67 + 13) * 0.36;

    if (typeRoll < 0.55) {
      type = 'asteroid';
      const tone = 0.62 + pseudoRandom(i * 71 + 3) * 0.28;
      rgb = [tone * 0.95, tone * 0.9, tone * 0.82];
    } else if (typeRoll < 0.78) {
      type = 'crystal';
      rgb = [0.25 + pseudoRandom(i) * 0.15, 0.8 + pseudoRandom(i * 2) * 0.2, 1.0];
      size *= 0.85;
    } else if (typeRoll < 0.92) {
      type = 'stardust';
      rgb = [1.0, 0.85 + pseudoRandom(i) * 0.15, 0.4 + pseudoRandom(i * 4) * 0.25];
      size *= 0.75;
    } else {
      type = 'ion';
      rgb = [0.6, 0.5, 1.0];
      size *= 1.05;
    }

    if (pt.line === 3 && type !== 'asteroid') {
      rgb = [0.98, 0.78, 0.32]; // NASA warm gold brilliance
    }

    particles.push({
      solarPos: [sx, sy, sz],
      targetPos: [tx, ty, tz],
      currentPos: [sx, sy, sz],
      color: rgb,
      size,
      type,
      phaseOffset: pseudoRandom(i * 73 + 19) * 0.28,
      rotationSpeed: [
        (pseudoRandom(i * 79 + 1) - 0.5) * 1.5,
        (pseudoRandom(i * 83 + 2) - 0.5) * 1.5,
        (pseudoRandom(i * 89 + 3) - 0.5) * 1.5,
      ],
      driftSeed: pseudoRandom(i * 97 + 5) * 100,
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

    particles.push({
      solarPos: [sx, sy, sz],
      targetPos: [tx, ty, tz],
      currentPos: [sx, sy, sz],
      color: [0.85, 0.8, 0.7],
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
