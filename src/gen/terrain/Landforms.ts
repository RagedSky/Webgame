/**
 * Landschaftsformen nach Vorbildern aus der Planetenforschung (rein, deterministisch). Jede Form ist eine kleine
 * Höhenfunktion mit physikalisch plausiblen Proportionen; Biome kombinieren sie über Rezepte:
 *
 * - Einschlagkrater (Mond, Merkur, Mars): Schüssel mit Tiefe ≈ 0,15 × Durchmesser, aufgeworfener Rand, Auswurfdecke
 *   ∝ r⁻³, große Krater mit flachem Boden und Zentralberg, Größenverteilung mit vielen kleinen und wenigen großen.
 * - Dünen (Erde, Mars, Titan): flacher Luvhang, steiler Leehang, Megadünen mit aufgesetzten kleinen Dünen.
 * - Schildvulkane mit Caldera und Schlackenkegel im Schüttwinkel (Mars/Tharsis, Io, Hawaii), Lavaströme mit Stirnkanten.
 * - Tafelberge und Canyons mit gestuften Wänden (Colorado-Plateau, Valles Marineris), Grabenbrüche (Cerberus Fossae).
 * - Runzelrücken der Lavaebenen (Mondmaria, Venus), Doppelrücken und Polygone auf Eis (Europa, Pluto/Sputnik Planitia).
 * - Trogtäler und Fjorde, Drumlins und Yardangs (stromlinienförmige Rücken), Flussrinnen und Deltaarme.
 * - Zertalte Hügel (rundliche Kuppen, V-Täler) und Gebirgskämme, bei denen Feinstruktur nur an den Graten sitzt.
 */
import type { SimplexNoise } from '@/math/Noise';
import { Random, hashString } from '@/math/Random';
import { smoothstep } from '@/math/utils';
import type { BiomeKind } from '../universe/types';

/** Kennungen der Formen (Index in den Zwischenspeicher einer Probe). */
export const L = {
  ROLL: 0,
  HILLS: 1,
  RIDGE: 2,
  DUNES: 3,
  CONES: 4,
  CINDER: 5,
  FLOWS: 6,
  MESA: 7,
  CANYON: 8,
  GRABEN: 9,
  LINEAE: 10,
  POLY_BIG: 11,
  POLY_SMALL: 12,
  DRUMLIN: 13,
  CHANNEL: 14,
  UVALLEY: 15,
  REEF: 16,
  WRINKLE: 17,
  COUNT: 18,
} as const;

export interface LandformRecipe {
  /** Anteil des Katalog-Höhenbands, den das Großrelief dieses Bioms nutzt [von, bis]. */
  span: [number, number];
  /** 0 = gleichmäßiger Anstieg, 1 = Ebene mit Stufen an den Rändern (Plateau, Becken). */
  flat: number;
  /** Formen als [Kennung, Amplitude in Metern]. */
  layers: Array<[number, number]>;
  /** Kraterdichte 0..1 (zusätzlich zur planetenweiten Dichte bei dünner Atmosphäre). */
  craters: number;
  /** Feinrauheit des Bodens in Metern. */
  rough: number;
}

const R = (layers: Array<[number, number]>, opts: Partial<Omit<LandformRecipe, 'layers'>> = {}): LandformRecipe => ({
  span: opts.span ?? [0.15, 0.85],
  flat: opts.flat ?? 0.25,
  layers,
  craters: opts.craters ?? 0,
  rough: opts.rough ?? 0.35,
});

/** Rezept je Biom: welche Formen das Gelände prägen. */
export const LANDFORMS: Record<BiomeKind, LandformRecipe> = {
  // Felsig / gemäßigt
  highlands: R([[L.ROLL, 22], [L.HILLS, 34]]),
  steppe: R([[L.ROLL, 14], [L.HILLS, 8]], { flat: 0.5, rough: 0.25 }),
  scree: R([[L.HILLS, 24], [L.RIDGE, 30]], { rough: 0.7 }),
  canyons: R([[L.CANYON, 90], [L.ROLL, 10]], { flat: 0.6, span: [0.45, 0.9] }),
  coastal_plain: R([[L.ROLL, 5], [L.CHANNEL, 3], [L.HILLS, 4]], { span: [0.45, 0.9], rough: 0.25 }),
  mountains: R([[L.RIDGE, 115], [L.HILLS, 16]], { rough: 0.6, flat: 0 }),
  crystal_caverns: R([[L.HILLS, 30], [L.ROLL, 10]]),
  // Ozean
  shallow_sea: R([[L.ROLL, 6], [L.HILLS, 3]], { span: [0.3, 0.88], rough: 0.3 }),
  deep_sea: R([[L.ROLL, 6]], { span: [0.1, 0.8], rough: 0.3 }),
  reef: R([[L.REEF, 6], [L.ROLL, 2]], { span: [0.55, 0.95], rough: 0.4 }),
  island_coast: R([[L.HILLS, 20], [L.ROLL, 10]], { span: [0.12, 0.75], rough: 0.35 }),
  archipelago: R([[L.HILLS, 36], [L.ROLL, 12]], { span: [0.05, 0.5] }),
  kelp_forest: R([[L.ROLL, 5], [L.HILLS, 3]], { span: [0.3, 0.9], rough: 0.3 }),
  // Wüste
  dune_sea: R([[L.DUNES, 28], [L.ROLL, 8]], { flat: 0.2, rough: 0.15 }),
  salt_flat: R([[L.POLY_SMALL, -0.35], [L.ROLL, 1.2]], { flat: 0.9, rough: 0.08 }),
  rock_desert: R([[L.HILLS, 14], [L.DRUMLIN, 12], [L.ROLL, 12]], { rough: 0.5 }),
  oasis: R([[L.ROLL, 5], [L.HILLS, 4]], { span: [0.2, 0.6], rough: 0.25 }),
  mesas: R([[L.MESA, 80], [L.ROLL, 8]], { flat: 0.5 }),
  // Eis
  glacier: R([[L.ROLL, 18], [L.DRUMLIN, 12]], { flat: 0.5, rough: 0.2 }),
  ice_plain: R([[L.LINEAE, 10], [L.POLY_BIG, 3], [L.ROLL, 4]], { flat: 0.7, rough: 0.2 }),
  frost_forest: R([[L.ROLL, 16], [L.HILLS, 14]]),
  ice_caves: R([[L.HILLS, 26], [L.ROLL, 10]]),
  snow_mountains: R([[L.RIDGE, 120], [L.HILLS, 12]], { rough: 0.5, flat: 0 }),
  // Dschungel
  cloud_forest: R([[L.HILLS, 34], [L.ROLL, 20]]),
  swamp: R([[L.CHANNEL, 3.5], [L.ROLL, 2.5], [L.HILLS, 2]], { span: [0.6, 0.78], rough: 0.2 }),
  fern_forest: R([[L.HILLS, 24], [L.ROLL, 16]]),
  river_delta: R([[L.CHANNEL, 4], [L.ROLL, 2]], { span: [0.72, 0.95], rough: 0.2 }),
  fungal_grove: R([[L.HILLS, 20], [L.ROLL, 14]]),
  // Vulkanisch
  lava_fields: R([[L.FLOWS, 9], [L.CINDER, 34], [L.ROLL, 6]], { flat: 0.5, rough: 0.5 }),
  ash_desert: R([[L.DUNES, 14], [L.ROLL, 14], [L.CINDER, 26]], { rough: 0.2 }),
  sulfur_springs: R([[L.FLOWS, 4], [L.ROLL, 4]], { span: [0.3, 0.6], rough: 0.3 }),
  obsidian_ridge: R([[L.CONES, 110], [L.RIDGE, 45], [L.HILLS, 10]], { rough: 0.6 }),
  basalt_plateau: R([[L.FLOWS, 10], [L.WRINKLE, 10], [L.ROLL, 6]], { flat: 0.7, rough: 0.45 }),
  lava_tubes: R([[L.FLOWS, 8], [L.CHANNEL, 9], [L.ROLL, 8]], { rough: 0.5 }),
  // Tundra
  tundra: R([[L.ROLL, 12], [L.DRUMLIN, 12], [L.POLY_SMALL, 0.35]], { flat: 0.4, rough: 0.25 }),
  lichen_heath: R([[L.ROLL, 14], [L.HILLS, 12], [L.DRUMLIN, 8]]),
  permafrost_bog: R([[L.POLY_SMALL, 0.4], [L.ROLL, 2], [L.CHANNEL, 2]], { span: [0.6, 0.8], rough: 0.2 }),
  krummholz: R([[L.HILLS, 24], [L.ROLL, 14]]),
  fjord_coast: R([[L.UVALLEY, 125], [L.HILLS, 12]], { span: [0.5, 0.9], rough: 0.5 }),
  // Toxisch
  acid_marsh: R([[L.CHANNEL, 3], [L.ROLL, 2.5], [L.POLY_SMALL, 0.3]], { span: [0.6, 0.78], rough: 0.2 }),
  methane_lakes: R([[L.HILLS, 6], [L.ROLL, 4]], { span: [0.8, 1.25], rough: 0.25 }),
  crystal_fields: R([[L.HILLS, 16], [L.ROLL, 12], [L.DRUMLIN, 6]]),
  slag_plain: R([[L.WRINKLE, 9], [L.FLOWS, 5], [L.ROLL, 5]], { flat: 0.6, rough: 0.45 }),
  // Öde
  crater_plain: R([[L.ROLL, 8]], { flat: 0.5, craters: 1, rough: 0.4 }),
  regolith_desert: R([[L.ROLL, 14], [L.HILLS, 6]], { craters: 0.55, rough: 0.4 }),
  rift_fields: R([[L.GRABEN, 34], [L.ROLL, 10]], { craters: 0.3, rough: 0.45 }),
  basalt_desert: R([[L.WRINKLE, 12], [L.ROLL, 5]], { flat: 0.7, craters: 0.25, rough: 0.4 }),
  // Gasriesen (nicht begehbar, nur für die Karte)
  upper_clouds: R([[L.ROLL, 20]]),
  storm_band: R([[L.ROLL, 20]]),
  ammonia_layer: R([[L.ROLL, 20]]),
  cloud_crowns: R([[L.ROLL, 20]]),
};

/** Typische Gesamtamplitude eines Rezepts in Metern (für die Einordnung der relativen Höhe im Biom). */
export function recipeAmplitude(recipe: LandformRecipe): number {
  let a = recipe.craters * 8;
  for (const [, amp] of recipe.layers) a += Math.abs(amp);
  return a * 0.55;
}

/** Ganzzahl-Hash ohne Allokation (Zellkoordinaten → 32 Bit). */
function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Weiches Minimum: wie `Math.min`, aber ohne Knick, wo sich zwei Formen treffen. */
const smin = (a: number, b: number, k: number): number => 0.5 * (a + b - Math.sqrt((a - b) * (a - b) + k * k));

/** Geglätteter Betrag: Null bleibt Null, aber ohne Knick (Talsohlen und Grate werden leicht gerundet). */
const sabs = (v: number): number => Math.sqrt(v * v + 0.0025) - 0.05;

/**
 * Dünenquerschnitt über eine Periode: gewölbter Luvhang bis zum Kamm (62 %), Rutschhang im Schüttwinkel (18 %),
 * danach ebene Dünengasse. Der Kamm bleibt eine scharfe Linie wie bei echten Sicheldünen.
 */
function duneProfile(t: number): number {
  if (t < 0.62) {
    const s = Math.sin((Math.PI / 2) * (t / 0.62));
    return s * Math.sqrt(s);
  }
  if (t < 0.8) {
    const k = (0.8 - t) / 0.18;
    return k * k * (3 - 2 * k) * 0.25 + k * 0.75;
  }
  return 0;
}

/** Kraterquerschnitt in Metern; `rho` = Abstand / Radius. */
function craterProfile(rho: number, radius: number, age: number): number {
  // einfache Krater: Tiefe ≈ 0,15 D; komplexe Krater werden relativ flacher
  const depth = (radius <= 220 ? 0.3 * radius : 66 * Math.pow(radius / 220, 0.35)) * age;
  const rim = 0.07 * Math.min(radius, 300) * age;
  if (rho < 1) {
    let h = (rim + depth) * rho * rho - depth;
    if (radius > 220) {
      // flacher Boden und Zentralberg
      const floor = -depth * 0.62;
      const k = depth * 0.08;
      h = 0.5 * (h + floor + Math.sqrt((h - floor) * (h - floor) + k * k));
      h += depth * 0.34 * Math.exp(-(rho * rho) / 0.026);
    }
    return h;
  }
  return (rim / (rho * rho * rho)) * (1 - smoothstep(1.6, 2.4, rho));
}

const CRATER_SCALES: ReadonlyArray<readonly [number, number]> = [
  [1150, 0.5],
  [400, 0.65],
  [135, 0.6],
];
const LINE_SPACING = [540, 760, 1010] as const;

/**
 * Wertet die Formen eines Planeten aus. Richtungen (Wind, Eisfluss, Bruchzonen) sind je Planet fest,
 * damit Dünen, Rücken und Gräben über die ganze Karte zusammenpassen.
 */
export class LandformField {
  private readonly seed: number;
  private readonly windX: number;
  private readonly windZ: number;
  private readonly wind2X: number;
  private readonly wind2Z: number;
  private readonly flowX: number;
  private readonly flowZ: number;
  private readonly riftX: number;
  private readonly riftZ: number;
  private readonly lineX: number[] = [];
  private readonly lineZ: number[] = [];
  private f1 = 0;
  private f2 = 0;

  constructor(
    private readonly noise: SimplexNoise,
    terrainSeed: string,
  ) {
    this.seed = hashString(`landforms:${terrainSeed}`)[0];
    const rng = new Random(`landforms:${terrainSeed}`);
    const wind = rng.float(0, Math.PI * 2);
    this.windX = Math.cos(wind);
    this.windZ = Math.sin(wind);
    this.wind2X = Math.cos(wind + 0.22);
    this.wind2Z = Math.sin(wind + 0.22);
    const flow = rng.float(0, Math.PI * 2);
    this.flowX = Math.cos(flow);
    this.flowZ = Math.sin(flow);
    const rift = rng.float(0, Math.PI);
    this.riftX = Math.cos(rift);
    this.riftZ = Math.sin(rift);
    const base = rng.float(0, Math.PI);
    for (const off of [0, 1.05 + rng.float(-0.2, 0.2), 2.2 + rng.float(-0.2, 0.2)]) {
      this.lineX.push(Math.cos(base + off));
      this.lineZ.push(Math.sin(base + off));
    }
  }

  /** Abstände zu den zwei nächsten Zellpunkten (Worley), Ergebnis in `f1`/`f2`. */
  private worley(x: number, z: number, cell: number, salt: number): void {
    const ci = Math.floor(x / cell);
    const cj = Math.floor(z / cell);
    let a = Infinity;
    let b = Infinity;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const h = hash3(ci + di, cj + dj, this.seed ^ salt);
        const px = (ci + di + 0.15 + 0.7 * ((h & 0xffff) / 65535)) * cell;
        const pz = (cj + dj + 0.15 + 0.7 * ((h >>> 16) / 65535)) * cell;
        const d = Math.hypot(x - px, z - pz);
        if (d < a) {
          b = a;
          a = d;
        } else if (d < b) b = d;
      }
    }
    this.f1 = a;
    this.f2 = b;
  }

  /** Einschlagkrater in Metern; `density` 0..1 steuert, wie viele Zellen einen Krater tragen. */
  craters(x: number, z: number, density: number): number {
    let total = 0;
    for (let s = 0; s < CRATER_SCALES.length; s++) {
      const [cell, prob] = CRATER_SCALES[s] as readonly [number, number];
      const limit = prob * density;
      const ci = Math.floor(x / cell);
      const cj = Math.floor(z / cell);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const h = hash3(ci + di, cj + dj, this.seed ^ (s * 7919 + 13));
          if ((h & 0xffff) / 65535 > limit) continue;
          const h2 = hash3(h, s, 77);
          const u = (h2 & 0xffff) / 65535;
          const radius = cell * (0.07 + 0.33 * u * u * u);
          const cx = (ci + di + ((h >>> 16) & 0xff) / 255) * cell;
          const cz = (cj + dj + (h >>> 24) / 255) * cell;
          const dx = x - cx;
          const dz = z - cz;
          const d2 = dx * dx + dz * dz;
          const reach = radius * 2.4;
          if (d2 > reach * reach) continue;
          const age = 0.35 + 0.65 * (((h2 >>> 16) & 0xff) / 255);
          total += craterProfile(Math.sqrt(d2) / radius, radius, age);
        }
      }
    }
    return total;
  }

  /** Feinrauheit −1..1 (zwei Wellenlängen: Bodenwellen und Geröll). */
  fine(x: number, z: number): number {
    return 0.66 * this.noise.noise2D(x / 48 + 3.1, z / 48 - 7.7) + 0.34 * this.noise.noise2D(x / 17 - 5.3, z / 17 + 2.9);
  }

  /** Form `layer` an x/z als dimensionslose Gestalt (wird mit der Rezept-Amplitude multipliziert). */
  shape(layer: number, x: number, z: number): number {
    const n = this.noise;
    switch (layer) {
      case L.ROLL:
        return n.fbm2D(x / 1000 + 17.3, z / 1000 - 8.1, 2);
      case L.HILLS: {
        // zertalte Hügel: rundliche Kuppen, V-förmige Täler entlang der Nulllinien
        const wx = x + 90 * n.noise2D(x / 450 + 4.2, z / 450 + 9.9);
        const wz = z + 90 * n.noise2D(x / 450 - 7.7, z / 450 + 1.3);
        const a = sabs(n.noise2D(wx / 900 + 31.4, wz / 900 - 12.2));
        const b = sabs(n.noise2D(wx / 360 - 5.6, wz / 360 + 44.1));
        return (a * 0.72 + b * 0.34 * (0.35 + a) - 0.28) * 2.2;
      }
      case L.RIDGE: {
        // Gebirgskämme: Seitengrate nur dort, wo der Hauptkamm hoch ist (glatte Täler)
        const wx = x + 110 * n.noise2D(x / 500 + 14.2, z / 500 - 3.9);
        const wz = z + 110 * n.noise2D(x / 500 - 21.7, z / 500 + 6.3);
        let r1 = 1 - sabs(n.noise2D(wx / 1250 - 41.2, wz / 1250 + 8.8));
        r1 *= r1;
        let r2 = 1 - sabs(n.noise2D(wx / 520 + 7.1, wz / 520 - 19.4));
        r2 = r2 * r2 * r1;
        let r3 = 1 - sabs(n.noise2D(wx / 215 - 2.8, wz / 215 + 33.6));
        r3 = r3 * r3 * r2;
        return (r1 * 0.62 + r2 * 0.28 + r3 * 0.12) * 1.6 - 0.75;
      }
      case L.DUNES: {
        const s = x * this.windX + z * this.windZ;
        const c = -x * this.windZ + z * this.windX;
        const supply = smoothstep(-0.35, 0.45, n.noise2D(x / 800 + 2.2, z / 800 + 6.1));
        const ph = s / 170 + 0.55 * n.noise2D(x / 520 + 9.1, z / 520 - 3.3) + 0.22 * n.noise2D(c / 110 + 1.7, s / 400);
        const small = duneProfile(ph - Math.floor(ph));
        const s2 = x * this.wind2X + z * this.wind2Z;
        const ph2 = s2 / 700 + 0.6 * n.noise2D(x / 1700 - 4.4, z / 1700 + 7.7);
        const big = duneProfile(ph2 - Math.floor(ph2));
        return (big * 0.9 + small * 0.5 * (0.45 + 0.55 * big)) * supply;
      }
      case L.CONES: {
        // Schildvulkane: flache Flanken, Gipfelcaldera mit steilem Rand und ebenem Boden
        const cell = 2100;
        const ci = Math.floor(x / cell);
        const cj = Math.floor(z / cell);
        let best = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const h = hash3(ci + di, cj + dj, this.seed ^ 0x51ed);
            if ((h & 0xff) / 255 > 0.6) continue;
            const radius = cell * (0.26 + 0.14 * (((h >>> 8) & 0xff) / 255));
            const cx = (ci + di + 0.2 + 0.6 * (((h >>> 16) & 0xff) / 255)) * cell;
            const cz = (cj + dj + 0.2 + 0.6 * ((h >>> 24) / 255)) * cell;
            const rho = Math.hypot(x - cx, z - cz) / radius;
            if (rho >= 1) continue;
            let v = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * rho), 0.85) * (radius / (cell * 0.4));
            v -= 0.3 * (1 - smoothstep(0.12, 0.2, rho));
            if (v > best) best = v;
          }
        }
        return best;
      }
      case L.CINDER: {
        // Schlackenkegel im Schüttwinkel mit Gipfelkrater
        const cell = 430;
        const ci = Math.floor(x / cell);
        const cj = Math.floor(z / cell);
        let best = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const h = hash3(ci + di, cj + dj, this.seed ^ 0x7c1d);
            if ((h & 0xff) / 255 > 0.28) continue;
            const radius = 45 + 40 * (((h >>> 8) & 0xff) / 255);
            const cx = (ci + di + 0.25 + 0.5 * (((h >>> 16) & 0xff) / 255)) * cell;
            const cz = (cj + dj + 0.25 + 0.5 * ((h >>> 24) / 255)) * cell;
            const rho = Math.hypot(x - cx, z - cz) / radius;
            if (rho >= 1) continue;
            const cone = Math.pow(1 - rho, 1.15);
            const v = Math.min(cone, 0.76 - (0.22 - rho) * 1.5) * (radius / 85);
            if (v > best) best = v;
          }
        }
        return best;
      }
      case L.FLOWS: {
        // Lavaströme: flache Decken mit lappigen Stirnkanten
        const t = n.fbm2D(x / 620 + 3.3, z / 620 - 9.2, 2) * 2.4 + 2.4;
        const f = Math.floor(t);
        return (f + smoothstep(0.7, 1, t - f)) / 2.4 - 1 + 0.05 * n.noise2D(x / 45 + 1.1, z / 45 + 2.2);
      }
      case L.MESA: {
        // Tafelberge: ebene Hochflächen, Steilwand, Schuttfuß, vereinzelt eine zweite Stufe
        const wx = x + 90 * n.noise2D(x / 400 + 2.4, z / 400 - 6.6);
        const wz = z + 90 * n.noise2D(x / 400 - 9.3, z / 400 + 4.8);
        const f = n.fbm2D(wx / 820 + 12.9, wz / 820 - 30.3, 3);
        return 0.72 * smoothstep(0.025, 0.08, f) + 0.28 * smoothstep(-0.2, 0.025, f) + 0.36 * smoothstep(0.34, 0.39, f) - 0.4;
      }
      case L.CANYON: {
        // eingeschnittenes Talnetz: innere Schlucht, Felsbank, äußere Wand; Seitentäler münden ein
        const wx = x + 160 * n.noise2D(x / 600 + 8.4, z / 600 - 1.6);
        const wz = z + 160 * n.noise2D(x / 600 - 3.3, z / 600 + 5.2);
        const c = sabs(n.noise2D(wx / 1500 + 6.2, wz / 1500 - 14.8));
        const main = 1 - (0.5 * smoothstep(0.035, 0.1, c) + 0.5 * smoothstep(0.14, 0.21, c));
        const c2 = sabs(n.noise2D(wx / 560 - 17.1, wz / 560 + 9.4));
        const side = (1 - smoothstep(0.03, 0.11, c2)) * (1 - smoothstep(0.15, 0.5, c)) * 0.55;
        return smin(-main, -side, 0.06);
      }
      case L.GRABEN: {
        // Grabenbrüche: parallele, flachbodige Senken zwischen steilen Bruchstufen
        const cc = -x * this.riftZ + z * this.riftX + 60 * n.noise2D(x / 700 + 5.5, z / 700 - 2.5);
        const along = x * this.riftX + z * this.riftZ;
        const k = cc / 460;
        const idx = Math.floor(k);
        const present = smoothstep(-0.1, 0.25, n.noise2D(idx * 3.7 + 1.1, along / 1300));
        const dist = Math.abs(k - idx - 0.5);
        const half = 0.11 + 0.04 * n.noise2D(idx * 1.3 - 4.2, along / 500);
        return -(1 - smoothstep(half, half + 0.045, dist)) * present;
      }
      case L.LINEAE: {
        // Doppelrücken auf Eis: drei Scharen gerader Linien, je zwei Wälle mit Mittelrinne
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          const spacing = LINE_SPACING[k] as number;
          const cc = -x * (this.lineZ[k] as number) + z * (this.lineX[k] as number) + 35 * n.noise2D(x / 500 + k * 9.1, z / 500 - k * 4.3);
          const q = cc / spacing;
          const idx = Math.floor(q);
          if ((hash3(idx, k, this.seed ^ 0x11ea) & 0xff) / 255 > 0.7) continue;
          const d = (q - idx - 0.5) * spacing;
          const ad = Math.abs(d);
          sum += (Math.exp(-((ad - 20) * (ad - 20)) / 121) - 0.4 * Math.exp(-(d * d) / 81)) * (1 - k * 0.2);
        }
        return sum;
      }
      case L.POLY_BIG:
      case L.POLY_SMALL: {
        // Polygonmuster: Rinnen an den Zellgrenzen, leicht gewölbte Mitte (Konvektionszellen, Frostmusterboden, Salzpolygone)
        const cell = layer === L.POLY_BIG ? 240 : 22;
        this.worley(x, z, cell, layer === L.POLY_BIG ? 0x2b1 : 0x9d3);
        const e = this.f2 - this.f1;
        return 0.4 * smoothstep(0.1 * cell, 0.6 * cell, e) - (1 - smoothstep(0, 0.13 * cell, e));
      }
      case L.DRUMLIN: {
        // stromlinienförmige Rücken (Drumlins, Yardangs): lang in Fließrichtung, schmal quer dazu
        const s = x * this.flowX + z * this.flowZ;
        const c = -x * this.flowZ + z * this.flowX;
        return smoothstep(-0.15, 0.8, n.noise2D(s / 900 + 5.5, c / 260 - 2.2)) - 0.3;
      }
      case L.CHANNEL: {
        // Rinnen: mäandrierende Hauptarme und schmalere Nebenarme
        const wx = x + 120 * n.noise2D(x / 520 + 1.9, z / 520 + 7.4);
        const wz = z + 120 * n.noise2D(x / 520 - 6.1, z / 520 - 2.7);
        const main = 1 - smoothstep(0.03, 0.085, sabs(n.noise2D(wx / 760 + 8.8, wz / 760 + 2.1)));
        const side = (1 - smoothstep(0.03, 0.09, sabs(n.noise2D(wx / 300 - 1.2, wz / 300 + 6.7)))) * 0.6;
        return smin(-main, -side, 0.06);
      }
      case L.UVALLEY: {
        // Trogtäler: breite ebene Sohle, steile Wände, Schultern; Seitentäler hängen über dem Haupttal
        const wx = x + 200 * n.noise2D(x / 900 + 3.7, z / 900 - 8.2);
        const wz = z + 200 * n.noise2D(x / 900 - 1.4, z / 900 + 5.9);
        const v = sabs(n.noise2D(wx / 1900 + 3.1, wz / 1900 - 6.4));
        const main = smoothstep(0.045, 0.3, v);
        const side = 0.45 + 0.55 * smoothstep(0.04, 0.26, sabs(n.noise2D(wx / 800 - 11.6, wz / 800 + 2.3)));
        return smin(main, side, 0.08) + 0.25 * smoothstep(0.3, 0.9, v) - 1;
      }
      case L.REEF: {
        // Fleckenriffe: rundliche Kuppen knapp unter der Wasserlinie
        this.worley(x, z, 85, 0x4e7);
        return 1 - smoothstep(0.12 * 85, 0.42 * 85, this.f1);
      }
      case L.WRINKLE: {
        // Runzelrücken: niedrige, gewundene Rücken auf erstarrten Lavaebenen
        const wx = x + 90 * n.noise2D(x / 400 + 6.2, z / 400 - 0.8);
        const wz = z + 90 * n.noise2D(x / 400 - 2.9, z / 400 + 3.5);
        return smoothstep(0.7, 0.99, 1 - sabs(n.noise2D(wx / 980 + 6.6, wz / 980 + 0.4)));
      }
      default:
        return 0;
    }
  }
}
