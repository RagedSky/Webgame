/**
 * Reines Terrain-Modell eines Planeten (kein Three.js): Höhenfeld, Biomverteilung, Wasserstand,
 * Oberflächenproben und Spawnpunkt. Deterministisch aus `planet.terrainSeed`.
 *
 * Koordinaten: x/z in Metern, Welt quadratisch um den Ursprung (`size`). y = Höhe in Metern.
 *
 * Aufbau des Höhenfelds (ARCHITECTURE 4.16):
 * 1. Großrelief: ein weiches Regionsfeld (lange Wellen, flächentreu entzerrt) ordnet die Biome nach Höhenlage –
 *    Meer, Küste, Ebene, Hügelland, Gebirge liegen nebeneinander, ohne Stufen an den Biomgrenzen.
 * 2. Landschaftsformen je Biom (`Landforms.ts`): Krater, Dünen, Vulkane, Canyons, Trogtäler usw. in Metern.
 * 3. Feinrauheit mit kleiner Amplitude.
 * Die normierte `altitude` einer Probe ist die relative Höhenlage innerhalb des Bioms, abgebildet auf dessen
 * Höhenband aus dem Katalog (für Spawn-Bedingungen, Temperatur, Schneegrenze). Wasser liegt bei `seaLevel`
 * = 0,1 · maxHeight und tritt nur in Biomen mit `hasWater` auf.
 */
import { SimplexNoise } from '@/math/Noise';
import { clamp, clamp01, lerp, smoothstep } from '@/math/utils';
import { Random } from '@/math/Random';
import type { Biome, Planet } from '../universe/types';
import { planetStyle, type PlanetStyle } from './PlanetStyle';
import { L, LANDFORMS, LandformField, recipeAmplitude, type LandformRecipe } from './Landforms';

export interface TerrainSample {
  height: number;
  /** Index des dominanten Bioms in `planet.biomes`. */
  biome: number;
  /** Index des Nachbarbioms (für Übergänge) und dessen Gewicht 0..0,5. */
  biome2: number;
  blend: number;
  /** Detail-Rauschen -1..1 (für Farbvariation). */
  detail: number;
  /** Normalisierte Höhenlage 0..1 innerhalb des Biom-Höhenbands (für Spawn-Bedingungen). */
  altitude: number;
}

export interface TerrainModelOptions {
  /** Kantenlänge der Welt in Metern. */
  size?: number;
  /** Maximale Höhe in Metern. */
  maxHeight?: number;
}

const SEA_LEVEL_FRACTION = 0.1;
const TRANSITION = 0.07;
/** Stützstellen der Großrelief-Kurve und der Entzerrung des Regionsfelds. */
const TABLE = 512;
const QUANTILES = 128;
/** Raster für Entzerrung und Höhenstatistik je Biom. */
const SURVEY = 80;

/** Kantenlänge der Planetenkarte in Metern (auch ohne Modell berechenbar, z. B. für die Karte im Orbit). */
export function terrainSizeFor(planet: Planet): number {
  return clamp(6000 + (planet.radiusKm / 1000) * 400, 6000, 10000);
}

export class TerrainModel {
  readonly planet: Planet;
  readonly size: number;
  readonly maxHeight: number;
  readonly seaLevel: number;
  readonly hasWater: boolean;
  readonly biomes: Biome[];
  /** Farbstil des Planeten (Zonen, Zweitfarben, Signaturpflanzen). */
  readonly style: PlanetStyle;
  private readonly noise: SimplexNoise;
  private readonly field: LandformField;
  /** Reliefstärke aus der Schwerkraft: leichte Welten tragen höhere Formen (Mars), schwere flachere. */
  private readonly relief: number;
  /** Biome nach Höhenlage sortiert: Position → Index in `planet.biomes`. */
  private readonly order: number[];
  /** Kumulierte Abdeckung in sortierter Reihenfolge. */
  private readonly thresholds: number[];
  /** Großrelief (normiert) über dem entzerrten Regionswert. */
  private readonly macro = new Float64Array(TABLE + 1);
  private readonly quantiles = new Float64Array(QUANTILES + 1);
  private readonly layerIds: Int8Array[];
  private readonly layerAmps: Float64Array[];
  private readonly roughness: number[];
  private readonly craterDensity: number[];
  /** 1 = Biom ohne Wasser auf einer Wasserwelt (bleibt über dem Meeresspiegel). */
  private readonly dry: number[];
  /** Tiefster und höchster Punkt je Biom (Meter) für die relative Höhenlage. */
  private readonly lowest: number[];
  private readonly highest: number[];
  private readonly cache = new Float64Array(L.COUNT);
  private fineCache = NaN;
  private craterCacheDensity = -1;
  private craterCacheValue = 0;
  private readonly tmp: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };

  constructor(planet: Planet, options: TerrainModelOptions = {}) {
    this.planet = planet;
    this.size = options.size ?? terrainSizeFor(planet);
    this.relief = clamp(Math.pow(1 / Math.max(0.2, planet.gravity), 0.3), 0.8, 1.3);
    this.maxHeight = options.maxHeight ?? clamp((230 + planet.radiusKm / 45) * this.relief, 230, 460);
    this.biomes = planet.biomes;
    this.style = planetStyle(planet);
    this.hasWater = planet.type !== 'gas_giant' && planet.biomes.some((b) => b.hasWater);
    this.seaLevel = this.hasWater ? this.maxHeight * SEA_LEVEL_FRACTION : Number.NEGATIVE_INFINITY;
    this.noise = new SimplexNoise(`terrain:${planet.terrainSeed}`);
    this.field = new LandformField(this.noise, planet.terrainSeed);

    const recipes: LandformRecipe[] = planet.biomes.map((b) => LANDFORMS[b.kind]);
    this.layerIds = recipes.map((r) => Int8Array.from(r.layers.map(([id]) => id)));
    this.layerAmps = recipes.map((r) => Float64Array.from(r.layers.map(([, amp]) => amp)));
    this.roughness = recipes.map((r) => r.rough);
    // Dünne Atmosphären bremsen keine Einschläge und tragen nichts ab: Krater auf allen trockenen Flächen
    const thinAir = planet.type === 'gas_giant' ? 0 : clamp01(1 - planet.atmosphere.density / 0.35);
    this.craterDensity = recipes.map((r, i) => clamp01(r.craters + (planet.biomes[i]!.hasWater ? 0 : thinAir * 0.45)));
    this.dry = planet.biomes.map((b) => (this.hasWater && !b.hasWater ? 1 : 0));

    // Höhenbänder des Großreliefs: Ausschnitt des Katalogbands; trockene Biome liegen über dem Wasserspiegel
    const bands = planet.biomes.map((b, i): [number, number] => {
      const [f0, f1] = recipes[i]!.span;
      let lo = lerp(b.altitude[0], b.altitude[1], f0);
      let hi = lerp(b.altitude[0], b.altitude[1], f1);
      if (this.hasWater && !b.hasWater) lo = Math.max(lo, SEA_LEVEL_FRACTION + 0.03);
      if (hi < lo + 0.03) hi = lo + 0.03;
      return [lo, hi];
    });
    // Biome nach Höhenlage ordnen: das Regionsfeld wird damit zum Großrelief (tief → hoch)
    this.order = planet.biomes.map((_, i) => i).sort((a, b) => bands[a]![0] + bands[a]![1] - (bands[b]![0] + bands[b]![1]) || a - b);
    let acc = 0;
    this.thresholds = this.order.map((i) => (acc += planet.biomes[i]!.coverage));
    this.thresholds[this.thresholds.length - 1] = 1.000001;
    // Höhen an den Biomgrenzen: Mitte der Überlappung benachbarter Bänder (oder der Lücke), monoton steigend
    const count = this.order.length;
    const edges: number[] = [bands[this.order[0]!]![0]];
    for (let k = 0; k < count - 1; k++) {
      const [lo0, hi0] = bands[this.order[k]!]!;
      const [lo1, hi1] = bands[this.order[k + 1]!]!;
      const e = hi0 < lo1 ? (hi0 + lo1) / 2 : (Math.max(lo0, lo1) + Math.min(hi0, hi1)) / 2;
      edges.push(Math.max(e, edges[k]!));
    }
    edges.push(Math.max(bands[this.order[count - 1]!]![1], edges[count - 1]!));
    // Kurve Regionswert → Höhe: je Biom ein Anstieg zwischen seinen Grenzhöhen, Ebenen mit Stufen an den Rändern
    const raw = new Float64Array(TABLE + 1);
    for (let k = 0; k <= TABLE; k++) {
      const u = k / TABLE;
      const pos = this.positionFor(u);
      const lo = pos === 0 ? 0 : this.thresholds[pos - 1]!;
      const hi = Math.min(1, this.thresholds[pos]!);
      const t = clamp01((u - lo) / Math.max(1e-6, hi - lo));
      const s = 2 * t - 1;
      const terrace = 0.5 + 0.5 * Math.sign(s) * Math.abs(s) ** 3;
      raw[k] = lerp(edges[pos]!, edges[pos + 1]!, lerp(t, terrace, recipes[this.order[pos]!]!.flat));
    }
    // Glätten: keine Knicke an den Biomgrenzen
    for (let pass = 0; pass < 3; pass++) {
      for (let k = 0; k <= TABLE; k++) {
        let sum = 0;
        for (let d = -2; d <= 2; d++) sum += raw[clamp(k + d, 0, TABLE)]!;
        this.macro[k] = sum / 5;
      }
      raw.set(this.macro);
    }

    // Entzerrung: Regionswerte auf der Karte vermessen, damit jedes Biom genau seinen Flächenanteil bekommt
    const half = this.size / 2;
    const values = new Float64Array(SURVEY * SURVEY);
    for (let j = 0; j < SURVEY; j++) {
      for (let i = 0; i < SURVEY; i++) values[j * SURVEY + i] = this.regionRaw(-half + ((i + 0.5) / SURVEY) * this.size, -half + ((j + 0.5) / SURVEY) * this.size);
    }
    const sorted = Float64Array.from(values).sort();
    for (let q = 0; q <= QUANTILES; q++) this.quantiles[q] = sorted[Math.min(sorted.length - 1, Math.round((q / QUANTILES) * (sorted.length - 1)))]!;

    // Höhenstatistik je Biom: Grundlage der relativen Höhenlage (deckt das ganze Höhenband des Bioms ab)
    // Robuste Grenzen (3. und 97. Perzentil): einzelne Kegel oder Kraterböden sollen das Band nicht verzerren
    this.lowest = planet.biomes.map(() => 0);
    this.highest = planet.biomes.map(() => 0);
    const heights: number[][] = planet.biomes.map(() => []);
    for (let j = 0; j < SURVEY; j++) {
      for (let i = 0; i < SURVEY; i++) {
        const s = this.physical(-half + ((i + 0.5) / SURVEY) * this.size, -half + ((j + 0.5) / SURVEY) * this.size, this.tmp);
        heights[s.biome]!.push(s.height);
      }
    }
    for (let pos = 0; pos < count; pos++) {
      const i = this.order[pos]!;
      const list = heights[i]!.sort((a, b) => a - b);
      const lo = list.length ? list[Math.floor(list.length * 0.03)]! : 0;
      const hi = list.length ? list[Math.min(list.length - 1, Math.floor(list.length * 0.97))]! : 0;
      if (list.length < 20 || hi - lo < 1) {
        // zu wenige Messpunkte: Abschätzung aus Großrelief und Formamplitude
        const amp = recipeAmplitude(recipes[i]!) * this.relief + 1;
        this.lowest[i] = edges[pos]! * this.maxHeight - amp;
        this.highest[i] = edges[pos + 1]! * this.maxHeight + amp;
      } else {
        this.lowest[i] = lo;
        this.highest[i] = hi;
      }
    }
  }

  /** Rohes Regionsfeld: lange Wellen mit leichter Verzerrung (bestimmt Großrelief und Biom). */
  private regionRaw(x: number, z: number): number {
    const n = this.noise;
    const wf = 1 / 3200;
    const wx = n.fbm2D(x * wf + 37.1, z * wf + 11.7, 2) * 520;
    const wz = n.fbm2D(x * wf - 52.3, z * wf + 71.9, 2) * 520;
    const rf = 1 / 5000;
    return n.fbm2D((x + wx) * rf + 5.5, (z + wz) * rf - 3.3, 2, 2.1, 0.35);
  }

  /** Regionsfeld 0..1, flächentreu entzerrt (jeder Wert kommt auf der Karte gleich häufig vor). */
  private region(x: number, z: number): number {
    const r = this.regionRaw(x, z);
    const q = this.quantiles;
    if (r <= q[0]!) return 0;
    if (r >= q[QUANTILES]!) return 1;
    let lo = 0;
    let hi = QUANTILES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (q[mid]! <= r) lo = mid;
      else hi = mid;
    }
    const span = q[hi]! - q[lo]!;
    return (lo + (span > 1e-12 ? (r - q[lo]!) / span : 0)) / QUANTILES;
  }

  /** Position in der nach Höhenlage sortierten Biomfolge. */
  private positionFor(u: number): number {
    const t = this.thresholds;
    for (let i = 0; i < t.length; i++) if (u < (t[i] as number)) return i;
    return t.length - 1;
  }

  /** Landschaftsformen eines Bioms in Metern (Formen werden je Probe nur einmal ausgewertet). */
  private landform(i: number, x: number, z: number): number {
    const ids = this.layerIds[i] as Int8Array;
    const amps = this.layerAmps[i] as Float64Array;
    let sum = 0;
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k] as number;
      let v = this.cache[id] as number;
      if (v !== v) {
        v = this.field.shape(id, x, z);
        this.cache[id] = v;
      }
      sum += v * (amps[k] as number);
    }
    sum *= this.relief;
    const density = this.craterDensity[i] as number;
    if (density > 0.01) {
      if (density !== this.craterCacheDensity) {
        this.craterCacheDensity = density;
        this.craterCacheValue = this.field.craters(x, z, density);
      }
      sum += this.craterCacheValue;
    }
    const rough = this.roughness[i] as number;
    if (rough > 0) {
      if (this.fineCache !== this.fineCache) this.fineCache = this.field.fine(x, z);
      sum += this.fineCache * rough;
    }
    return sum;
  }

  /** Höhe und Biom ohne relative Höhenlage (auch für die Vermessung im Konstruktor). */
  private physical(x: number, z: number, out: TerrainSample): TerrainSample {
    const u = this.region(x, z);
    const pos = this.positionFor(u);
    const lo = pos === 0 ? 0 : (this.thresholds[pos - 1] as number);
    const hi = this.thresholds[pos] as number;
    let pos2 = pos;
    let w = 0;
    if (u - lo < TRANSITION && pos > 0) {
      pos2 = pos - 1;
      w = 0.5 * (1 - smoothstep(0, TRANSITION, u - lo));
    } else if (hi - u < TRANSITION && pos < this.order.length - 1) {
      pos2 = pos + 1;
      w = 0.5 * (1 - smoothstep(0, TRANSITION, hi - u));
    }
    const i = this.order[pos] as number;
    const j = this.order[pos2] as number;
    // Großrelief aus der Kurve
    const f = u * TABLE;
    const k = Math.min(TABLE - 1, Math.floor(f));
    let h = lerp(this.macro[k] as number, this.macro[k + 1] as number, f - k) * this.maxHeight;
    // Landschaftsformen, an Biomgrenzen überblendet
    this.cache.fill(NaN);
    this.fineCache = NaN;
    this.craterCacheDensity = -1;
    let land = this.landform(i, x, z);
    if (w > 0) land = lerp(land, this.landform(j, x, z), w);
    h += land;
    // Trockene Biome auf Wasserwelten bleiben über dem Meeresspiegel (weich begrenzt)
    const dry = w > 0 ? lerp(this.dry[i] as number, this.dry[j] as number, w) : (this.dry[i] as number);
    if (dry > 0) {
      const floor = this.seaLevel + 1.2;
      h = lerp(h, 0.5 * (h + floor + Math.sqrt((h - floor) * (h - floor) + 4)), dry);
    }
    out.height = clamp(h, 0, this.maxHeight);
    out.biome = i;
    out.biome2 = j;
    out.blend = w;
    return out;
  }

  /** Relative Höhenlage im Biom, abgebildet auf dessen Höhenband aus dem Katalog. */
  private bandAltitude(i: number, height: number): number {
    const band = (this.biomes[i] as Biome).altitude;
    const lo = this.lowest[i] as number;
    const hi = this.highest[i] as number;
    return lerp(band[0], band[1], clamp01((height - lo) / Math.max(1, hi - lo)));
  }

  /** Vollständige Probe (wiederverwendbares Ausgabeobjekt, kein GC im Loop). */
  sample(x: number, z: number, out: TerrainSample = this.tmp): TerrainSample {
    this.physical(x, z, out);
    out.detail = this.noise.fbm2D(x / 420 + 13.7, z / 420 + 91.2, 4, 2.05, 0.5);
    let a = this.bandAltitude(out.biome, out.height);
    if (out.blend > 0) a = lerp(a, this.bandAltitude(out.biome2, out.height), out.blend);
    out.altitude = clamp01(a);
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
