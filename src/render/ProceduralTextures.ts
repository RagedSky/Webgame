/**
 * Prozedurale, kachelbare Oberflächentexturen (Normal-, Rauheits- und Albedo-Variation) aus deterministischem
 * Value-/Cellular-Noise – keine Bilddateien, kein DOM (DataTexture, damit Builder-Tests in Node laufen).
 * Eine `TextureBank` cacht je Art eine Textur, Builder holen sie per `get()`.
 * Die Albedo-Textur ist ein helles Graustufenbild und wird mit Material-/Vertexfarbe multipliziert (Hue bleibt erhalten).
 */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, type Texture } from 'three';
import { clamp } from '@/math/utils';

export type TextureKind = 'fabric' | 'suit' | 'skin' | 'hair' | 'scales' | 'chitin' | 'fur' | 'feathers' | 'rock' | 'ground' | 'bark' | 'crystal' | 'leaf' | 'metal';

export interface SurfaceMaps {
  normalMap: Texture;
  roughnessMap: Texture;
  /** Helle Graustufen-Albedo (0,75–1,0) zum Multiplizieren. */
  map: Texture;
}

interface KindDef {
  /** Höhenfunktion in UV (0..1, kachelbar), Ergebnis 0..1. */
  height: (u: number, v: number, n: NoiseFns) => number;
  /** Stärke der Normalen (Steigung × Faktor). */
  strength: number;
  /** Basis-Rauheit und Modulation durch die Höhe. */
  rough: [number, number];
  /** Albedo-Kontrast (0 = flach). */
  albedo: number;
}

interface NoiseFns {
  /** Kachelbares Value-Noise, Periode `p` Zellen über die Textur. */
  value: (u: number, v: number, p: number, seed: number) => number;
  fbm: (u: number, v: number, p: number, octaves: number, seed: number) => number;
  /** Cellular: Abstand zum nächsten Punkt (0..~1) und Zellen-Hash (0..1). */
  cell: (u: number, v: number, p: number, seed: number) => [number, number];
}

function hash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function makeNoise(): NoiseFns {
  const value = (u: number, v: number, p: number, seed: number): number => {
    const x = u * p;
    const y = v * p;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const w = (a: number, b: number): number => hash(((a % p) + p) % p, ((b % p) + p) % p, seed);
    const a = w(ix, iy);
    const b = w(ix + 1, iy);
    const c = w(ix, iy + 1);
    const d = w(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (u: number, v: number, p: number, octaves: number, seed: number): number => {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    let period = p;
    for (let o = 0; o < octaves; o++) {
      sum += value(u, v, period, seed + o * 17) * amp;
      total += amp;
      amp *= 0.5;
      period *= 2;
    }
    return sum / total;
  };
  const cell = (u: number, v: number, p: number, seed: number): [number, number] => {
    const x = u * p;
    const y = v * p;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let best = 9;
    let id = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = ix + i;
        const cy = iy + j;
        const wx = ((cx % p) + p) % p;
        const wy = ((cy % p) + p) % p;
        const px = cx + hash(wx, wy, seed);
        const py = cy + hash(wx, wy, seed + 101);
        const d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < best) {
          best = d;
          id = hash(wx, wy, seed + 202);
        }
      }
    }
    return [Math.sqrt(best), id];
  };
  return { value, fbm, cell };
}

const TAU = Math.PI * 2;

/** Überlappende Schuppenreihen (versetztes Gitter, Höhe fällt zur Spitze ab). */
function scalesHeight(u: number, v: number, rows: number, elongate: number, n: NoiseFns): number {
  const cols = rows / elongate;
  let h = 0;
  for (let j = -1; j <= 1; j++) {
    const row = Math.floor(v * rows) + j;
    const offset = row % 2 ? 0.5 : 0;
    for (let i = -1; i <= 1; i++) {
      const col = Math.floor(u * cols - offset) + i;
      const cx = (col + offset + 0.5) / cols;
      const cy = (row + 0.35) / rows;
      let du = u - cx;
      du -= Math.round(du);
      let dv = v - cy;
      dv -= Math.round(dv);
      const d = Math.sqrt(du * du * cols * cols + dv * dv * rows * rows * 0.7);
      if (d < 0.85) h = Math.max(h, (1 - d / 0.85) * (0.6 + 0.4 * (dv * rows + 0.5)));
    }
  }
  return clamp(h * 0.8 + n.fbm(u, v, 24, 3, 5) * 0.2, 0, 1);
}

const KINDS: Record<TextureKind, KindDef> = {
  fabric: { height: (u, v, n) => 0.5 + 0.22 * Math.sin(u * TAU * 40) * Math.sin(v * TAU * 40) + 0.12 * (n.fbm(u, v, 8, 3, 1) - 0.5), strength: 1.2, rough: [0.72, 0.15], albedo: 0.12 },
  suit: {
    height: (u, v, n) => {
      const weave = 0.5 + 0.1 * Math.sin(u * TAU * 64) * Math.sin(v * TAU * 64);
      const gx = (u * 3) % 1;
      const gy = (v * 4) % 1;
      const seam = Math.min(gx, 1 - gx, gy, 1 - gy) < 0.035 ? -0.35 : 0;
      const rivet = Math.hypot(gx - 0.5, gy - 0.5) < 0.05 ? 0.25 : 0;
      return clamp(weave + seam + rivet + 0.08 * (n.fbm(u, v, 6, 3, 2) - 0.5), 0, 1);
    },
    strength: 1.6,
    rough: [0.6, 0.25],
    albedo: 0.1,
  },
  skin: { height: (u, v, n) => 0.5 + 0.1 * (n.fbm(u, v, 12, 4, 3) - 0.5) - 0.12 * Math.max(0, 0.18 - n.cell(u, v, 48, 4)[0]) * 5, strength: 0.6, rough: [0.5, 0.2], albedo: 0.06 },
  hair: { height: (u, v, n) => 0.5 + 0.3 * (n.value(u, v * 0.08, 96, 6) - 0.5) + 0.15 * (n.fbm(u, v, 5, 3, 7) - 0.5), strength: 1.3, rough: [0.55, 0.25], albedo: 0.18 },
  scales: { height: (u, v, n) => scalesHeight(u, v, 14, 1, n), strength: 2, rough: [0.45, 0.3], albedo: 0.16 },
  feathers: { height: (u, v, n) => scalesHeight(u, v, 10, 2.2, n) * 0.8 + 0.2 * n.value(u, v * 0.1, 80, 8), strength: 1.4, rough: [0.7, 0.2], albedo: 0.14 },
  chitin: {
    height: (u, v, n) => {
      const [d, id] = n.cell(u, v, 4, 9);
      const plate = 1 - Math.min(1, Math.pow(d / 0.75, 3));
      return clamp(0.25 + plate * 0.6 + (id - 0.5) * 0.15 + 0.05 * (n.fbm(u, v, 20, 3, 10) - 0.5), 0, 1);
    },
    strength: 2.2,
    rough: [0.35, 0.3],
    albedo: 0.2,
  },
  fur: { height: (u, v, n) => 0.5 + 0.25 * (n.value(u, v * 0.12, 72, 11) - 0.5) + 0.2 * (n.fbm(u, v, 6, 4, 12) - 0.5), strength: 1.1, rough: [0.85, 0.12], albedo: 0.2 },
  rock: {
    height: (u, v, n) => {
      const base = 1 - Math.abs(n.fbm(u, v, 5, 5, 13) * 2 - 1);
      const [d] = n.cell(u, v, 6, 14);
      const crack = d < 0.06 ? -0.3 : 0;
      return clamp(base * 0.8 + crack + 0.1 * (n.fbm(u, v, 40, 2, 15) - 0.5), 0, 1);
    },
    strength: 2,
    rough: [0.85, 0.15],
    albedo: 0.22,
  },
  ground: {
    height: (u, v, n) => {
      const coarse = 1 - Math.abs(n.fbm(u, v, 3, 4, 23) * 2 - 1);
      const grain = n.fbm(u, v, 24, 3, 24);
      const pebble = Math.max(0, 0.16 - n.cell(u, v, 14, 25)[0]) * 3;
      return clamp(0.25 + coarse * 0.45 + grain * 0.2 + pebble * 0.35, 0, 1);
    },
    strength: 1.1,
    rough: [0.9, 0.1],
    albedo: 0.14,
  },
  bark: { height: (u, v, n) => clamp(0.5 + 0.35 * (1 - Math.abs(n.value(u * 1, v * 0.15, 28, 16) * 2 - 1)) - 0.25 + 0.15 * (n.fbm(u, v, 8, 3, 17) - 0.5), 0, 1), strength: 1.8, rough: [0.9, 0.1], albedo: 0.2 },
  crystal: {
    height: (u, v, n) => {
      const [d, id] = n.cell(u, v, 5, 18);
      return clamp(0.2 + id * 0.6 + d * 0.2, 0, 1);
    },
    strength: 1.4,
    rough: [0.18, 0.12],
    albedo: 0.14,
  },
  leaf: { height: (u, v, n) => 0.5 + 0.12 * (n.fbm(u, v, 10, 3, 19) - 0.5) + 0.1 * Math.max(0, 1 - Math.abs(u - 0.5) * 30) + 0.06 * Math.sin((v * 8 + Math.abs(u - 0.5) * 3) * TAU), strength: 0.9, rough: [0.75, 0.15], albedo: 0.1 },
  metal: { height: (u, v, n) => 0.5 + 0.12 * (n.value(u * 0.03, v, 160, 20) - 0.5) + 0.06 * (n.fbm(u, v, 4, 3, 21) - 0.5), strength: 0.8, rough: [0.4, 0.2], albedo: 0.1 },
};

function makeTexture(data: Uint8ClampedArray<ArrayBuffer>, size: number, srgb: boolean): DataTexture {
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Erzeugt Normal-, Rauheits- und Albedo-Textur einer Art. */
export function buildSurfaceMaps(kind: TextureKind, size = 256): SurfaceMaps {
  const def = KINDS[kind];
  const n = makeNoise();
  const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    const v = j / size;
    for (let i = 0; i < size; i++) h[j * size + i] = def.height(i / size, v, n);
  }
  const at = (i: number, j: number): number => h[(((j % size) + size) % size) * size + (((i % size) + size) % size)] as number;
  const normal = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  const rough = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  const albedo = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  const k = def.strength * size * 0.02;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) * k;
      const dy = (at(i, j + 1) - at(i, j - 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      // DataTexture: Zeile 0 ist v = 0, +Y der Normalen zeigt in +V
      const p = (j * size + i) * 4;
      normal[p] = ((-dx / len) * 0.5 + 0.5) * 255;
      normal[p + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      normal[p + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normal[p + 3] = 255;
      const hv = at(i, j);
      const r = clamp(def.rough[0] + (0.5 - hv) * def.rough[1] * 2, 0, 1) * 255;
      rough[p] = rough[p + 1] = rough[p + 2] = r;
      rough[p + 3] = 255;
      const a = clamp(1 - def.albedo * (1 - hv), 0, 1) * 255;
      albedo[p] = albedo[p + 1] = albedo[p + 2] = a;
      albedo[p + 3] = 255;
    }
  }
  return { normalMap: makeTexture(normal, size, false), roughnessMap: makeTexture(rough, size, false), map: makeTexture(albedo, size, true) };
}

/** Cache: eine Texturfamilie je Art, lebt so lange wie die App (klein, wiederverwendet von allen Szenen). */
export class TextureBank {
  private readonly cache = new Map<TextureKind, SurfaceMaps>();

  get(kind: TextureKind): SurfaceMaps {
    let maps = this.cache.get(kind);
    if (!maps) {
      maps = buildSurfaceMaps(kind);
      this.cache.set(kind, maps);
    }
    return maps;
  }

  dispose(): void {
    for (const m of this.cache.values()) {
      m.normalMap.dispose();
      m.roughnessMap.dispose();
      m.map.dispose();
    }
    this.cache.clear();
  }
}

export const textures = new TextureBank();
