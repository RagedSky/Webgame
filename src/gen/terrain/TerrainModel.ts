/**
 * Reines Terrain-Modell eines Planeten (kein Three.js): Höhenfeld, Biomverteilung, Wasserstand,
 * Oberflächenproben und Spawnpunkt. Deterministisch aus `planet.terrainSeed`.
 *
 * Koordinaten: x/z in Metern, Welt quadratisch um den Ursprung (`size`). y = Höhe in Metern.
 * Biome erhalten Höhenbänder aus ihrer `altitude`-Definition (normiert auf `maxHeight`);
 * Wasser liegt bei `seaLevel` = 0,1 · maxHeight und tritt nur in Biomen mit `hasWater` auf.
 */
import { SimplexNoise } from '@/math/Noise';
import { clamp, clamp01, lerp, smoothstep } from '@/math/utils';
import { Random } from '@/math/Random';
import type { Biome, BiomeKind, Planet } from '../universe/types';

export interface TerrainSample {
  height: number;
  /** Index des dominanten Bioms in `planet.biomes`. */
  biome: number;
  /** Index des Nachbarbioms (für Übergänge) und dessen Gewicht 0..0,5. */
  biome2: number;
  blend: number;
  /** Detail-Rauschen -1..1 (für Farbvariation). */
  detail: number;
  /** Normalisierte Höhe 0..1 (für Spawn-Bedingungen). */
  altitude: number;
}

export interface TerrainModelOptions {
  /** Kantenlänge der Welt in Metern. */
  size?: number;
  /** Maximale Höhe in Metern. */
  maxHeight?: number;
}

const RIDGED_KINDS = new Set<BiomeKind>(['mountains', 'snow_mountains', 'obsidian_ridge', 'highlands', 'rift_fields', 'fjord_coast', 'canyons']);
const FLAT_KINDS = new Set<BiomeKind>(['salt_flat', 'ice_plain', 'basalt_plateau', 'mesas', 'crater_plain', 'slag_plain', 'tundra', 'permafrost_bog']);
const SEA_LEVEL_FRACTION = 0.1;
const TRANSITION = 0.07;

export class TerrainModel {
  readonly planet: Planet;
  readonly size: number;
  readonly maxHeight: number;
  readonly seaLevel: number;
  readonly hasWater: boolean;
  readonly biomes: Biome[];
  private readonly noise: SimplexNoise;
  private readonly thresholds: number[];
  private readonly bands: Array<[number, number]>;
  private readonly tmp: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };

  constructor(planet: Planet, options: TerrainModelOptions = {}) {
    this.planet = planet;
    this.size = options.size ?? clamp(6000 + (planet.radiusKm / 1000) * 400, 6000, 10000);
    this.maxHeight = options.maxHeight ?? clamp(380 + planet.radiusKm / 25, 400, 760);
    this.biomes = planet.biomes;
    this.hasWater = planet.type !== 'gas_giant' && planet.biomes.some((b) => b.hasWater);
    this.seaLevel = this.hasWater ? this.maxHeight * SEA_LEVEL_FRACTION : Number.NEGATIVE_INFINITY;
    this.noise = new SimplexNoise(`terrain:${planet.terrainSeed}`);
    // Kumulierte Abdeckung → Schwellen im Regionsfeld
    let acc = 0;
    this.thresholds = planet.biomes.map((b) => (acc += b.coverage));
    this.thresholds[this.thresholds.length - 1] = 1.000001;
    // Höhenbänder: Biome ohne Wasser liegen über dem Wasserspiegel
    this.bands = planet.biomes.map((b) => {
      let [a0, a1] = b.altitude;
      if (this.hasWater && !b.hasWater) a0 = Math.max(a0, SEA_LEVEL_FRACTION + 0.025);
      if (a1 <= a0) a1 = a0 + 0.05;
      return [a0, a1];
    });
  }

  /** Regionsfeld 0..1 mit Domain-Warping (bestimmt das Biom). */
  private region(x: number, z: number): number {
    const n = this.noise;
    const wf = 1 / 2600;
    const wx = n.fbm2D(x * wf + 37.1, z * wf + 11.7, 3) * 900;
    const wz = n.fbm2D(x * wf - 52.3, z * wf + 71.9, 3) * 900;
    const rf = 1 / 1900;
    const r = n.fbm2D((x + wx) * rf + 5.5, (z + wz) * rf - 3.3, 4);
    return clamp01(0.5 + r * 1.15);
  }

  private biomeIndexFor(u: number): number {
    const t = this.thresholds;
    for (let i = 0; i < t.length; i++) if (u < (t[i] as number)) return i;
    return t.length - 1;
  }

  /** Biom-spezifische Höhe (Meter) an x/z. */
  private biomeHeight(i: number, detail: number, ridged: number, fine: number): number {
    const biome = this.biomes[i] as Biome;
    const [a0, a1] = this.bands[i] as [number, number];
    let shape: number;
    if (RIDGED_KINDS.has(biome.kind)) shape = 0.15 + 0.85 * ridged;
    else if (FLAT_KINDS.has(biome.kind)) shape = 0.5 + detail * 0.18 + fine * 0.03;
    else shape = 0.5 + detail * 0.42 + fine * 0.08;
    const a = lerp(a0, a1, clamp01(shape));
    return a * this.maxHeight;
  }

  /** Vollständige Probe (wiederverwendbares Ausgabeobjekt, kein GC im Loop). */
  sample(x: number, z: number, out: TerrainSample = this.tmp): TerrainSample {
    const n = this.noise;
    const u = this.region(x, z);
    const i = this.biomeIndexFor(u);
    const lo = i === 0 ? 0 : (this.thresholds[i - 1] as number);
    const hi = this.thresholds[i] as number;
    let j = i;
    let w = 0;
    if (u - lo < TRANSITION && i > 0) {
      j = i - 1;
      w = 0.5 * (1 - smoothstep(0, TRANSITION, u - lo));
    } else if (hi - u < TRANSITION && i < this.biomes.length - 1) {
      j = i + 1;
      w = 0.5 * (1 - smoothstep(0, TRANSITION, hi - u));
    }
    const df = 1 / 420;
    const detail = n.fbm2D(x * df + 13.7, z * df + 91.2, 5, 2.05, 0.5);
    const ridgedRaw = 1 - Math.abs(n.fbm2D(x * df * 0.7 - 41.2, z * df * 0.7 + 8.8, 4, 2.1, 0.55));
    const ridged = clamp01(ridgedRaw * ridgedRaw * 1.15 + detail * 0.12);
    const fine = n.noise2D(x / 38 + 3.1, z / 38 - 7.7);
    let h = this.biomeHeight(i, detail, ridged, fine);
    if (w > 0) h = lerp(h, this.biomeHeight(j, detail, ridged, fine), w);
    out.height = h;
    out.biome = i;
    out.biome2 = j;
    out.blend = w;
    out.detail = detail;
    out.altitude = clamp01(h / this.maxHeight);
    return out;
  }

  heightAt(x: number, z: number): number {
    return this.sample(x, z, this.tmp).height;
  }

  biomeAt(x: number, z: number): Biome {
    return this.biomes[this.sample(x, z, this.tmp).biome] as Biome;
  }

  isWaterAt(x: number, z: number): boolean {
    return this.hasWater && this.heightAt(x, z) < this.seaLevel;
  }

  /** Steigung (0 = flach, 1 = 45°+) über finite Differenzen. */
  slopeAt(x: number, z: number, eps = 1.5): number {
    const hx = this.heightAt(x + eps, z) - this.heightAt(x - eps, z);
    const hz = this.heightAt(x, z + eps) - this.heightAt(x, z - eps);
    return clamp01(Math.hypot(hx, hz) / (2 * eps));
  }

  /** Normalisierte Höhe → Meter. */
  altitudeToHeight(a: number): number {
    return a * this.maxHeight;
  }

  /** Deterministischer Spawnpunkt: nahe dem Ursprung, an Land, flach, nicht in Höhlen-Biomen. */
  findSpawn(): { x: number; z: number; y: number } {
    const rng = new Random(`spawn:${this.planet.terrainSeed}`);
    let best: { x: number; z: number; y: number; score: number } | null = null;
    const maxR = Math.min(2500, this.size * 0.4);
    for (let r = 0; r <= maxR && !(best && best.score > 0.9); r += 60) {
      const steps = r === 0 ? 1 : Math.max(8, Math.floor((2 * Math.PI * r) / 60));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2 + rng.float(0, 0.3);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const s = this.sample(x, z);
        const biome = this.biomes[s.biome] as Biome;
        if (biome.isCave) continue;
        if (this.hasWater && s.height < this.seaLevel + 2) continue;
        const slope = this.slopeAt(x, z, 2);
        if (slope > 0.45) continue;
        const score = 1 - slope - r / maxR / 4;
        if (!best || score > best.score) best = { x, z, y: s.height, score };
      }
    }
    if (!best) return { x: 0, z: 0, y: Math.max(this.heightAt(0, 0), this.hasWater ? this.seaLevel : -Infinity) };
    return { x: best.x, z: best.z, y: best.y };
  }
}
