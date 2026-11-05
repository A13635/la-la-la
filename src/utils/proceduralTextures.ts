import * as THREE from 'three';

// Procedural noise helpers
function pseudoNoise(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number = 0): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  // Cubic Hermite curve
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

function fbm(x: number, y: number, octaves = 5, seed = 0): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 13) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return val / max;
}

export class TextureGenerator {
  private static canvasCache: Map<string, THREE.CanvasTexture> = new Map();

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
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const v = y / height;
        const n1 = fbm(u * 12, v * 6, 5, 1);
        const n2 = fbm(u * 24 + n1 * 2, v * 12 + n1 * 2, 4, 7);
        const intensity = n1 * 0.6 + n2 * 0.4;

        const idx = (y * width + x) * 4;
        // Glowing solar palette: core bright white-yellow to intense orange/red
        data[idx] = Math.min(255, 255 * (0.8 + intensity * 0.3)); // R
        data[idx + 1] = Math.min(255, 160 * intensity + 70);       // G
        data[idx + 2] = Math.min(255, 30 * intensity + 10);        // B
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
          // Polar ice caps
          data[idx] = 230;
          data[idx + 1] = 240;
          data[idx + 2] = 250;
          data[idx + 3] = 255;
          continue;
        }

        // Continents vs Oceans
        const continentNoise = fbm(u * 6, v * 3, 5, 42);
        const detailNoise = fbm(u * 20, v * 10, 3, 99);
        const isLand = continentNoise > 0.47;

        if (isLand) {
          // Land: green forests, golden savannahs, brown mountains
          const elevation = continentNoise + detailNoise * 0.2;
          if (elevation > 0.68) {
            // Mountain peak
            data[idx] = 160;
            data[idx + 1] = 145;
            data[idx + 2] = 130;
          } else if (elevation > 0.54) {
            // Forests / plains
            data[idx] = 34 + detailNoise * 20;
            data[idx + 1] = 120 + detailNoise * 40;
            data[idx + 2] = 40;
          } else {
            // Coast / arid
            data[idx] = 194;
            data[idx + 1] = 178;
            data[idx + 2] = 128;
          }
        } else {
          // Deep oceans to coastal shelves
          const depth = (0.47 - continentNoise) / 0.47;
          data[idx] = 10;
          data[idx + 1] = 45 + Math.floor((1 - depth) * 40);
          data[idx + 2] = 110 + Math.floor((1 - depth) * 60);
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
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const v = y / height;
        const cloudNoise = fbm(u * 10 + Math.sin(v * 4) * 0.5, v * 5, 5, 301);
        const idx = (y * width + x) * 4;

        if (cloudNoise > 0.52) {
          const alpha = Math.min(240, Math.floor((cloudNoise - 0.52) * 450));
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
      // Zonal atmospheric banding
      const bandFreq = Math.sin(v * Math.PI * 18);
      const bandFreq2 = Math.cos(v * Math.PI * 9);

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const swirl = fbm(u * 14 + bandFreq * 0.4, v * 8, 4, 88);
        const bandVal = (bandFreq * 0.5 + bandFreq2 * 0.3 + swirl * 0.8 + 1) * 0.5;

        // Great Red Spot around (u ~ 0.65, v ~ 0.65)
        const dx = (u - 0.65) * 1.8;
        const dy = (v - 0.66) * 3.5;
        const distSq = dx * dx + dy * dy;
        const isRedSpot = distSq < 0.0035;

        const idx = (y * width + x) * 4;

        if (isRedSpot) {
          data[idx] = 210;
          data[idx + 1] = 80;
          data[idx + 2] = 45;
        } else {
          // Warm ochre, cream, mahogany bands
          data[idx] = Math.min(255, 175 + bandVal * 65);
          data[idx + 1] = Math.min(255, 120 + bandVal * 55);
          data[idx + 2] = Math.min(255, 75 + bandVal * 40);
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

  static getSaturnTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('saturn')) return this.canvasCache.get('saturn')!;
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const band = Math.sin(v * 30) * 0.3 + Math.sin(v * 12) * 0.4;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const noise = fbm(u * 8, v * 4, 3, 12);
        const val = band * 0.3 + noise * 0.2;
        const idx = (y * width + x) * 4;

        // Butter gold / pale amber
        data[idx] = Math.min(255, 225 + val * 30);
        data[idx + 1] = Math.min(255, 195 + val * 25);
        data[idx + 2] = Math.min(255, 140 + val * 20);
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
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(size, 1);
    const data = imgData.data;

    for (let x = 0; x < size; x++) {
      const r = x / size; // inner to outer radius
      let alpha = 0;

      // Ring A, Cassini Division, Ring B, Ring C
      if (r < 0.1) {
        alpha = 0; // Inner gap
      } else if (r < 0.35) {
        // Ring C (crepe ring)
        alpha = 0.3 + Math.sin(r * 200) * 0.1;
      } else if (r < 0.7) {
        // Ring B (dense and bright)
        alpha = 0.85 + Math.sin(r * 320) * 0.1;
      } else if (r < 0.77) {
        // Cassini Division (gap)
        alpha = 0.05;
      } else if (r < 0.95) {
        // Ring A
        alpha = 0.65 + Math.sin(r * 250) * 0.15;
      } else {
        // Outer fade
        alpha = 0;
      }

      const idx = x * 4;
      data[idx] = 210;
      data[idx + 1] = 185;
      data[idx + 2] = 140;
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

  static getMarsTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('mars')) return this.canvasCache.get('mars')!;
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const isPolar = v < 0.08 || v > 0.92;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const idx = (y * width + x) * 4;

        if (isPolar) {
          // White ice caps
          data[idx] = 245;
          data[idx + 1] = 245;
          data[idx + 2] = 250;
        } else {
          const crater = fbm(u * 12, v * 6, 4, 17);
          const darkBasalt = fbm(u * 4, v * 2, 3, 55);
          if (darkBasalt > 0.58) {
            // Syrtis Major dark basalt
            data[idx] = 120 + crater * 30;
            data[idx + 1] = 60 + crater * 20;
            data[idx + 2] = 40 + crater * 15;
          } else {
            // Iron oxide red/orange soil
            data[idx] = 195 + crater * 35;
            data[idx + 1] = 90 + crater * 25;
            data[idx + 2] = 50 + crater * 20;
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

        // Dense creamy sulfur swirls
        data[idx] = Math.min(255, 230 + swirl * 25);
        data[idx + 1] = Math.min(255, 195 + swirl * 20);
        data[idx + 2] = Math.min(255, 130 + swirl * 25);
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
        const n = fbm(u * 16, v * 8, 4, 33);
        const idx = (y * width + x) * 4;

        // Gray-brown cratered rocky surface
        const val = 120 + n * 65;
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
    grad.addColorStop(0.5, '#99e0e3');
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
        const storm = fbm(u * 10, v * 5, 4, 91);
        const idx = (y * width + x) * 4;

        // Deep royal cobalt blue with light cyan storm wisps
        data[idx] = 30 + Math.floor(storm * 40);
        data[idx + 1] = 70 + Math.floor(storm * 80);
        data[idx + 2] = 200 + Math.floor(storm * 55);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.canvasCache.set('neptune', texture);
    return texture;
  }

  static getParticleGlowTexture(): THREE.CanvasTexture {
    if (this.canvasCache.has('glow')) return this.canvasCache.get('glow')!;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 220, 160, 0.9)');
    grad.addColorStop(0.5, 'rgba(100, 180, 255, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    this.canvasCache.set('glow', texture);
    return texture;
  }
}
