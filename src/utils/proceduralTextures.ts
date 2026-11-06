import * as THREE from 'three';

// Procedural multi-octave noise helpers
function pseudoNoise(x: number, y: number, seed = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed = 0): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);

  const n00 = pseudoNoise(i, j, seed);
  const n10 = pseudoNoise(i + 1, j, seed);
  const n01 = pseudoNoise(i, j + 1, seed);
  const n11 = pseudoNoise(i + 1, j + 1, seed);

  return (
    n00 * (1 - u) * (1 - v) +
    n10 * u * (1 - v) +
    n01 * (1 - u) * v +
    n11 * u * v
  );
}

function fbm(x: number, y: number, octaves = 6, seed = 0): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 17) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return val / max;
}

export class TextureGenerator {
  private static canvasCache: Map<string, THREE.CanvasTexture> = new Map();

  // 1. Panoramic Realistic Milky Way Galaxy Background (4096x2048)
  // Eliminates the flat black void with authentic interstellar galactic dust lanes & billions of stars
  static getMilkyWayTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('milkyway')) return this.canvasCache.get('milkyway')!;
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Deep cosmic space base: subtle midnight navy/charcoal gradient
    const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
    baseGrad.addColorStop(0, '#03050c');
    baseGrad.addColorStop(0.5, '#060a15');
    baseGrad.addColorStop(1, '#020409');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Draw Milky Way galactic band across the diagonal
    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;

        // Galactic equator sinusoidal path
        const galacticCenterY = 0.5 + Math.sin(u * Math.PI * 2) * 0.22;
        const distFromGalacticPlane = Math.abs(v - galacticCenterY);

        if (distFromGalacticPlane < 0.25) {
          const planeFalloff = Math.cos((distFromGalacticPlane / 0.25) * (Math.PI / 2));
          // Core bulge around u ~ 0.5
          const distFromBulge = Math.sqrt(Math.pow((u - 0.5) * 2.5, 2) + Math.pow((v - 0.5) * 4.0, 2));
          const bulge = Math.max(0, 1 - distFromBulge) * 0.9;

          // Multi-scale galactic dust lanes (dark absorption clouds)
          const dustNoise = fbm(u * 16, v * 8, 5, 808);
          const darkLane = Math.pow(dustNoise, 1.8);

          // Star cloud brightness
          const starCloud = fbm(u * 32, v * 16, 4, 303);
          const galacticIntensity = (planeFalloff * 0.6 + bulge * 0.8) * (0.3 + starCloud * 0.7) * (1.2 - darkLane * 0.85);

          if (galacticIntensity > 0.05) {
            const idx = (y * width + x) * 4;
            // Warm golden-white galactic core with deep indigo/violet outer fringe
            const r = Math.min(255, data[idx] + galacticIntensity * (180 + bulge * 60));
            const g = Math.min(255, data[idx + 1] + galacticIntensity * (150 + bulge * 40));
            const b = Math.min(255, data[idx + 2] + galacticIntensity * 220);

            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Sprinkle thousands of individual twinkling stars of various magnitudes onto the panorama
    const starsCount = 3500;
    for (let i = 0; i < starsCount; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const size = Math.random() < 0.9 ? 1 : Math.random() < 0.98 ? 1.5 : 2.2;
      const alpha = 0.4 + Math.random() * 0.6;

      const starRoll = Math.random();
      let color = `rgba(255, 255, 255, ${alpha})`;
      if (starRoll < 0.25) color = `rgba(180, 210, 255, ${alpha})`; // Blue-white
      else if (starRoll < 0.45) color = `rgba(255, 230, 190, ${alpha})`; // Warm solar

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.canvasCache.set('milkyway', texture);
    return texture;
  }

  // 2. Realistic Asteroid Rocky Bump Map (for authentic craters and geological facets)
  static getAsteroidBumpTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('asteroidBump')) return this.canvasCache.get('asteroidBump')!;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Cratered, rocky, regolith noise
        const n1 = fbm(u * 12, v * 12, 5, 77);
        const n2 = fbm(u * 32, v * 32, 4, 19);
        const val = Math.floor((n1 * 0.7 + n2 * 0.3) * 255);

        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.canvasCache.set('asteroidBump', texture);
    return texture;
  }

  // 3. Sun Surface (Realistic Solar Photosphere with convective granules)
  static getSunTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('sun')) return this.canvasCache.get('sun')!;
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const n1 = fbm(u * 16, v * 8, 5, 1);
        const n2 = fbm(u * 36, v * 18, 4, 19);
        const intensity = n1 * 0.55 + n2 * 0.45;

        const idx = (y * width + x) * 4;
        // Natural solar spectrum: bright golden-white center to deep warm amber
        data[idx] = Math.min(255, 255 * (0.85 + intensity * 0.25));
        data[idx + 1] = Math.min(255, 175 * Math.pow(intensity, 1.2) + 65);
        data[idx + 2] = Math.min(255, 45 * Math.pow(intensity, 2.0) + 10);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.canvasCache.set('sun', texture);
    return texture;
  }

  // 4. Realistic Earth Texture (Accurate Blue Marble palette)
  static getEarthTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('earth')) return this.canvasCache.get('earth')!;
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (v - 0.5) * Math.PI;
      const isPolar = Math.abs(lat) > 1.25;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const idx = (y * width + x) * 4;

        if (isPolar) {
          data[idx] = 235;
          data[idx + 1] = 242;
          data[idx + 2] = 252;
          data[idx + 3] = 255;
          continue;
        }

        const continentNoise = fbm(u * 6.5, v * 3.2, 5, 42);
        const detailNoise = fbm(u * 22, v * 11, 4, 88);
        const isLand = continentNoise > 0.46;

        if (isLand) {
          const elev = continentNoise + detailNoise * 0.2;
          if (elev > 0.68) {
            // Mountain peak
            data[idx] = 180;
            data[idx + 1] = 175;
            data[idx + 2] = 168;
          } else if (elev > 0.55) {
            // Forests / savanna
            data[idx] = 45 + Math.floor(detailNoise * 20);
            data[idx + 1] = 105 + Math.floor(detailNoise * 30);
            data[idx + 2] = 42;
          } else {
            // Arid land / desert
            data[idx] = 185;
            data[idx + 1] = 165;
            data[idx + 2] = 120;
          }
        } else {
          // Deep oceans to coastal shelves (realistic deep navy blue)
          const depth = (0.46 - continentNoise) / 0.46;
          data[idx] = 8;
          data[idx + 1] = 32 + Math.floor((1 - depth) * 45);
          data[idx + 2] = 95 + Math.floor((1 - depth) * 55);
        }
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('earth', texture);
    return texture;
  }

  // 5. Earth Atmospheric Cloud Layer
  static getEarthCloudsTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('earthClouds')) return this.canvasCache.get('earthClouds')!;
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const jetStream = Math.sin(v * Math.PI * 6) * 0.35;
        const cloudNoise = fbm(u * 10 + jetStream, v * 5, 5, 301);
        const idx = (y * width + x) * 4;

        if (cloudNoise > 0.51) {
          const alpha = Math.min(235, Math.floor((cloudNoise - 0.51) * 480));
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = alpha;
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    this.canvasCache.set('earthClouds', texture);
    return texture;
  }

  // 6. Realistic Jupiter (Subtle, authentic NASA Cassini tones)
  static getJupiterTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('jupiter')) return this.canvasCache.get('jupiter')!;
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const bandFreq = Math.sin(v * Math.PI * 20);
      const bandFreq2 = Math.cos(v * Math.PI * 10);

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const swirl = fbm(u * 16 + bandFreq * 0.4, v * 8, 4, 88);
        const bandVal = (bandFreq * 0.5 + bandFreq2 * 0.3 + swirl * 0.8 + 1) * 0.5;

        // Great Red Spot
        const dx = (u - 0.65) * 2.0;
        const dy = (v - 0.67) * 4.0;
        const distSq = dx * dx + dy * dy;
        const isRedSpot = distSq < 0.0035;

        const idx = (y * width + x) * 4;

        if (isRedSpot) {
          data[idx] = 205;
          data[idx + 1] = 85;
          data[idx + 2] = 55;
        } else {
          // Realistic muted ochre, cream, and tan bands
          data[idx] = Math.min(255, 178 + bandVal * 55);
          data[idx + 1] = Math.min(255, 138 + bandVal * 45);
          data[idx + 2] = Math.min(255, 95 + bandVal * 38);
        }
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('jupiter', texture);
    return texture;
  }

  // 7. Realistic Saturn Body & Rings
  static getSaturnTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('saturn')) return this.canvasCache.get('saturn')!;
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const band = Math.sin(v * 36) * 0.3 + Math.sin(v * 14) * 0.4;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const noise = fbm(u * 10, v * 5, 3, 12);
        const val = band * 0.25 + noise * 0.2;
        const idx = (y * width + x) * 4;

        data[idx] = Math.min(255, 218 + val * 25);
        data[idx + 1] = Math.min(255, 192 + val * 22);
        data[idx + 2] = Math.min(255, 148 + val * 18);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('saturn', texture);
    return texture;
  }

  static getSaturnRingsTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('saturnRings')) return this.canvasCache.get('saturnRings')!;
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, 1);
    const data = imgData.data;

    for (let x = 0; x < size; x++) {
      const r = x / size;
      let alpha = 0;

      if (r < 0.12) {
        alpha = 0;
      } else if (r < 0.38) {
        alpha = 0.28 + Math.sin(r * 350) * 0.08;
      } else if (r < 0.72) {
        alpha = 0.90 + Math.sin(r * 550) * 0.08;
      } else if (r < 0.78) {
        alpha = 0.03; // Cassini Division
      } else if (r < 0.94) {
        alpha = 0.70 + Math.sin(r * 450) * 0.12;
      } else {
        alpha = 0;
      }

      const idx = x * 4;
      data[idx] = 205;
      data[idx + 1] = 182;
      data[idx + 2] = 142;
      data[idx + 3] = Math.floor(Math.max(0, Math.min(255, alpha * 255)));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.canvasCache.set('saturnRings', texture);
    return texture;
  }

  // 8. Mars
  static getMarsTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('mars')) return this.canvasCache.get('mars')!;
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const isPolar = v < 0.07 || v > 0.93;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const idx = (y * width + x) * 4;

        if (isPolar) {
          data[idx] = 245;
          data[idx + 1] = 245;
          data[idx + 2] = 250;
        } else {
          const crater = fbm(u * 16, v * 8, 4, 17);
          const darkBasalt = fbm(u * 5, v * 2.5, 3, 55);
          if (darkBasalt > 0.58) {
            data[idx] = 110 + Math.floor(crater * 25);
            data[idx + 1] = 58 + Math.floor(crater * 18);
            data[idx + 2] = 38 + Math.floor(crater * 14);
          } else {
            data[idx] = 188 + Math.floor(crater * 30);
            data[idx + 1] = 85 + Math.floor(crater * 22);
            data[idx + 2] = 48 + Math.floor(crater * 18);
          }
        }
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('mars', texture);
    return texture;
  }

  // 9. Venus, Mercury, Uranus, Neptune
  static getVenusTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('venus')) return this.canvasCache.get('venus')!;
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const v = y / height;
        const swirl = fbm(u * 6 + Math.sin(v * 5) * 0.8, v * 4, 4, 61);
        const idx = (y * width + x) * 4;

        data[idx] = Math.min(255, 225 + swirl * 20);
        data[idx + 1] = Math.min(255, 192 + swirl * 18);
        data[idx + 2] = Math.min(255, 130 + swirl * 20);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('venus', texture);
    return texture;
  }

  static getMercuryTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('mercury')) return this.canvasCache.get('mercury')!;
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const v = y / height;
        const n = fbm(u * 18, v * 9, 4, 33);
        const idx = (y * width + x) * 4;

        const val = 115 + n * 60;
        data[idx] = val;
        data[idx + 1] = val * 0.94;
        data[idx + 2] = val * 0.88;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('mercury', texture);
    return texture;
  }

  static getUranusTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('uranus')) return this.canvasCache.get('uranus')!;
    const width = 256;
    const height = 128;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#75c8cc');
    grad.addColorStop(0.5, '#a2e8eb');
    grad.addColorStop(1, '#6fbcc0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('uranus', texture);
    return texture;
  }

  static getNeptuneTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('neptune')) return this.canvasCache.get('neptune')!;
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const v = y / height;
        const storm = fbm(u * 12, v * 6, 4, 91);
        const idx = (y * width + x) * 4;

        data[idx] = 26 + Math.floor(storm * 40);
        data[idx + 1] = 65 + Math.floor(storm * 75);
        data[idx + 2] = 200 + Math.floor(storm * 45);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('neptune', texture);
    return texture;
  }

  // 10. Soft Particle Glow for Subtle Solar Halos
  static getParticleGlowTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('glow')) return this.canvasCache.get('glow')!;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0, 'rgba(255, 245, 220, 0.9)');
    grad.addColorStop(0.25, 'rgba(255, 180, 80, 0.4)');
    grad.addColorStop(0.6, 'rgba(255, 100, 20, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    this.canvasCache.set('glow', texture);
    return texture;
  }

  // 11. Deep Space Cosmic Nebula Cloud Sprite
  static getNebulaTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('nebula')) return this.canvasCache.get('nebula')!;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - dist);

        if (falloff <= 0) continue;

        const n = fbm(x * 0.015, y * 0.015, 5, 404);
        const intensity = n * Math.pow(falloff, 1.8);

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, Math.floor(intensity * 120));
        data[idx + 1] = Math.min(255, Math.floor(intensity * 90));
        data[idx + 2] = Math.min(255, Math.floor(intensity * 240));
        data[idx + 3] = Math.min(255, Math.floor(intensity * 160));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    this.canvasCache.set('nebula', texture);
    return texture;
  }
}
