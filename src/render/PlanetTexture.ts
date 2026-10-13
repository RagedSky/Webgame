import { CanvasTexture, Color, SRGBColorSpace } from 'three';
import { SimplexNoise } from '@/math/Noise';
import { clamp01 } from '@/math/utils';
import type { Planet } from '@/gen/universe/types';

/**
 * Kleine prozedurale Oberflächentextur (Equirectangular) aus Biom-Paletten und Noise.
 * Nur für die Systemansicht/Karte – das echte Terrain kommt in Phase 2.
 */
export function createPlanetTexture(planet: Planet, width = 256, height = 128): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D-Canvas nicht verfügbar');
  const img = ctx.createImageData(width, height);
  const noise = new SimplexNoise(planet.terrainSeed);
  const biomes = planet.biomes;
  const colors = biomes.map((b) => new Color(b.palette.ground));
  const accents = biomes.map((b) => new Color(b.palette.accent));
  const isGas = planet.type === 'gas_giant';
  const hasWater = biomes.some((b) => b.hasWater) && !isGas;
  const water = new Color(planet.type === 'ocean' ? '#2a6a95' : planet.type === 'toxic' ? '#4a5a8a' : '#2f6f9a');
  const ice = new Color('#e8f3fb');
  const tmp = new Color();

  // Kumulierte Abdeckung für die Biomzuordnung
  const thresholds: number[] = [];
  let acc = 0;
  for (const b of biomes) {
    acc += b.coverage;
    thresholds.push(acc);
  }

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const lon = u * Math.PI * 2;
      // Punkte auf der Kugel, damit die Textur am Rand nahtlos ist
      const px = Math.cos(lat) * Math.cos(lon);
      const py = Math.sin(lat);
      const pz = Math.cos(lat) * Math.sin(lon);
      let r: number;
      let g: number;
      let bl: number;
      if (isGas) {
        const band = noise.fbm3D(px * 0.6, py * 6 + noise.noise3D(px * 2, py * 2, pz * 2) * 0.6, pz * 0.6, 3);
        const t = clamp01(0.5 + band * 0.5);
        const i = Math.min(biomes.length - 1, Math.floor(t * biomes.length));
        tmp.copy(colors[i] ?? colors[0]!).lerp(accents[i] ?? accents[0]!, clamp01(0.5 + band));
        r = tmp.r;
        g = tmp.g;
        bl = tmp.b;
      } else {
        const h = noise.fbm3D(px * 2.2, py * 2.2, pz * 2.2, 5) * 0.5 + 0.5;
        const m = noise.fbm3D(px * 1.3 + 7, py * 1.3 + 7, pz * 1.3 + 7, 3) * 0.5 + 0.5;
        const polar = Math.abs(py);
        if (hasWater && h < 0.46) {
          tmp.copy(water).multiplyScalar(0.7 + h * 0.6);
        } else {
          let idx = 0;
          while (idx < thresholds.length - 1 && m > (thresholds[idx] as number)) idx++;
          tmp.copy(colors[idx] ?? colors[0]!).lerp(accents[idx] ?? accents[0]!, clamp01((h - 0.5) * 2));
          tmp.multiplyScalar(0.75 + h * 0.5);
        }
        if (planet.temperature.min < 268 && polar > 0.72 + (planet.temperature.mean - 240) / 400) tmp.lerp(ice, 0.8);
        r = tmp.r;
        g = tmp.g;
        bl = tmp.b;
      }
      const o = (y * width + x) * 4;
      img.data[o] = Math.round(clamp01(r) * 255);
      img.data[o + 1] = Math.round(clamp01(g) * 255);
      img.data[o + 2] = Math.round(clamp01(bl) * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
