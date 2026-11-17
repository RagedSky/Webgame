/**
 * Prozedurale Mondoberfläche (Equirectangular): Grundfarbe des Mondes, dunkle Tiefebenen, helle Hochländer und
 * Krater mit hellem Rand und Strahlen. Reine Daten (DataTexture, kein DOM), deterministisch aus der Mond-ID.
 */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, ClampToEdgeWrapping } from 'three';
import { SimplexNoise } from '@/math/Noise';
import { Random } from '@/math/Random';
import { clamp01 } from '@/math/utils';
import type { Moon } from '@/gen/universe/types';

interface Crater {
  x: number;
  y: number;
  z: number;
  /** Winkelradius als Kosinus-Abstand (1 − cos). */
  size: number;
  depth: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** RGBA-Pixel der Mondoberfläche (Zeile 0 = Südpol, wie bei DataTexture üblich). */
export function moonTextureData(moon: Moon, width = 256, height = 128): Uint8ClampedArray<ArrayBuffer> {
  const rng = new Random(`moon-tex:${moon.id}`);
  const noise = new SimplexNoise(`moon-tex:${moon.id}`);
  const [br, bg, bb] = hexToRgb(moon.color);
  const craters: Crater[] = [];
  const count = rng.int(26, 44);
  for (let i = 0; i < count; i++) {
    const theta = rng.next() * Math.PI * 2;
    const y = rng.float(-1, 1);
    const s = Math.sqrt(1 - y * y);
    // wenige große, viele kleine Krater
    const big = rng.next() < 0.18;
    craters.push({ x: s * Math.cos(theta), y, z: s * Math.sin(theta), size: big ? rng.float(0.012, 0.04) : rng.float(0.0015, 0.008), depth: rng.float(0.5, 1) });
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let j = 0; j < height; j++) {
    const lat = ((j + 0.5) / height - 0.5) * Math.PI;
    const cl = Math.cos(lat);
    const py = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const px = cl * Math.cos(lon);
      const pz = cl * Math.sin(lon);
      // Tiefebenen (dunkel) und Hochländer (hell)
      const maria = noise.fbm3D(px * 1.4, py * 1.4, pz * 1.4, 4);
      const fine = noise.fbm3D(px * 6 + 3, py * 6 + 3, pz * 6 + 3, 3);
      let shade = 0.82 + fine * 0.14 - clamp01(maria * 1.8 + 0.1) * 0.34;
      for (const c of craters) {
        const d = 1 - (px * c.x + py * c.y + pz * c.z);
        if (d > c.size * 3.2) continue;
        const t = d / c.size;
        if (t < 0.72) shade -= 0.2 * c.depth * (1 - t * 0.5);
        else if (t < 1.15) shade += 0.24 * c.depth * (1 - Math.abs(t - 0.93) / 0.22);
        else shade += 0.07 * c.depth * (1 - (t - 1.15) / 2.05) * (0.5 + 0.5 * fine);
      }
      shade = Math.min(1.25, Math.max(0.28, shade));
      const o = (j * width + i) * 4;
      data[o] = clamp01(br * shade) * 255;
      data[o + 1] = clamp01(bg * shade) * 255;
      data[o + 2] = clamp01(bb * shade) * 255;
      data[o + 3] = 255;
    }
  }
  return data;
}

export function createMoonTexture(moon: Moon, width = 256, height = 128): DataTexture {
  const tex = new DataTexture(moonTextureData(moon, width, height), width, height, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
