/**
 * Farbstil eines Planeten (rein, deterministisch aus dem Terrain-Seed): je Biom eine zweite Bewuchs- und Bodenfarbe,
 * farbige Gesteinsschichten, Tönung der Grasspitzen, großflächige Zonen (wo welche Farbe gilt) und die Genome der
 * riesigen Signaturpflanzen, die das Landschaftsbild prägen.
 */
import { SimplexNoise } from '@/math/Noise';
import { Random } from '@/math/Random';
import { clamp, clamp01, smoothstep } from '@/math/utils';
import type { Planet, PlanetType } from '@/gen/universe/types';
import type { FloraGenome, LeafShape } from '@/gen/archive/types';

export interface BiomeStyle {
  /** Zweite Bewuchsfarbe (hex): Wiesen wechseln in Zonen zwischen beiden Tönen. */
  vegetation2: string;
  /** Zweite Bodenfarbe (hex). */
  ground2: string;
  /** Farbe der Gesteinsbänder an Steilhängen (hex). */
  strata: string;
}

export interface Landmark {
  genome: FloraGenome;
  /** Kandidaten je 256-m-Zelle (vor Zonen- und Hangfilter). */
  perCell: number;
}

export interface PlanetStyle {
  biomes: BiomeStyle[];
  /** Farbe der Grasspitzen (hex): Halme laufen vom Bewuchston am Fuß in diese Farbe aus. */
  grassTip: string;
  landmarks: Landmark[];
  /** Anteil der zweiten Bewuchsfarbe 0..1 an einer Weltposition. */
  vegZone(x: number, z: number): number;
  /** Anteil der zweiten Bodenfarbe 0..1. */
  groundZone(x: number, z: number): number;
  /** Hain-Dichte 0..1 der Signaturpflanzen (sie stehen in Gruppen, nicht gleichmäßig). */
  groveZone(x: number, z: number): number;
}

type Hsl = [number, number, number];

export function hexToHsl(hex: string): Hsl {
  const v = parseInt(hex.replace('#', ''), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 1) + 1) % 1;
  const ss = clamp01(s);
  const ll = clamp01(l);
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const ch = (t: number): number => {
    const tt = ((t % 1) + 1) % 1;
    const c = tt < 1 / 6 ? p + (q - p) * 6 * tt : tt < 0.5 ? q : tt < 2 / 3 ? p + (q - p) * (2 / 3 - tt) * 6 : p;
    return Math.round(clamp01(c) * 255);
  };
  return `#${[ch(hh + 1 / 3), ch(hh), ch(hh - 1 / 3)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const LUSH: ReadonlySet<PlanetType> = new Set<PlanetType>(['jungle', 'ocean']);
const COLD: ReadonlySet<PlanetType> = new Set<PlanetType>(['tundra', 'ice']);
const DEAD: ReadonlySet<PlanetType> = new Set<PlanetType>(['volcanic', 'toxic', 'barren']);

function landmarkGenomes(planet: Planet, rng: Random, vegHue: number): Landmark[] {
  const deg = (h: number): number => (((h % 1) + 1) % 1) * 360;
  // Kontrastfarbe zum Bewuchs: Signaturpflanzen sollen aus der Landschaft herausleuchten
  const contrast = vegHue + (rng.bool() ? 1 : -1) * rng.float(0.3, 0.5);
  const make = (form: FloraGenome['form'], heightM: number, leafShape: LeafShape, leafHue: number, glow: number, perCell: number, density = 0.7): Landmark => ({
    genome: {
      kind: 'flora',
      form,
      heightM,
      trunkHue: deg(leafHue + rng.float(0.45, 0.6)),
      leafHue: deg(leafHue),
      flowerHue: deg(leafHue + rng.float(0.12, 0.3)),
      leafShape,
      branching: rng.float(0.4, 0.9),
      density,
      glow,
      bloomTime: 'any',
    },
    perCell,
  });
  const bio = clamp(planet.biodiversity, 0, 1);
  if (DEAD.has(planet.type) || bio < 0.12) {
    // tote Welten: leuchtende Kristallnadeln
    return [make('crystal_plant', rng.float(12, 19), 'none', contrast, 1, 5), make('crystal_plant', rng.float(5, 8), 'none', contrast + 0.08, 1, 7)];
  }
  if (COLD.has(planet.type)) {
    return [make('tree', rng.float(24, 34), 'needle', contrast, 0, 7, 0.9), make('crystal_plant', rng.float(7, 12), 'none', vegHue + 0.5, 1, 4)];
  }
  if (planet.type === 'desert') {
    // Wüste: Schirmbäume mit Plattformen und mannshohe Agavenrosetten
    return [make('tree', rng.float(15, 22), 'pad', contrast, 0, 5, 0.8), make('succulent', rng.float(4.5, 7), 'blade', contrast + rng.float(0.08, 0.16), 0, 6, 0.9)];
  }
  if (LUSH.has(planet.type)) {
    const giant = rng.pick<LeafShape>(['cap', 'pad', 'broad']);
    return [make('tree', rng.float(24, 36), giant, contrast, rng.bool(0.3) ? 1 : 0, 7, 0.85), make('fungus', rng.float(8, 13), 'cap', contrast + rng.float(0.1, 0.2), rng.bool(0.5) ? 1 : 0, 6)];
  }
  // felsige und gemäßigte Welten
  const shape = rng.pick<LeafShape>(['cap', 'lobed', 'pad']);
  return [make('tree', rng.float(18, 28), shape, contrast, 0, 6, 0.8), make('fungus', rng.float(6, 10), 'cap', contrast + 0.12, 0, 5)];
}

export function planetStyle(planet: Planet): PlanetStyle {
  const rng = new Random(`style:${planet.terrainSeed}`);
  const vegNoise = new SimplexNoise(rng.fork('veg'));
  const groundNoise = new SimplexNoise(rng.fork('ground'));
  const groveNoise = new SimplexNoise(rng.fork('grove'));
  // Eine gemeinsame Verschiebung für alle Biome hält den Planeten farblich geschlossen
  const bold = rng.bool(0.35);
  const vegShift = bold ? (rng.bool() ? 1 : -1) * rng.float(0.3, 0.46) : rng.bool() ? rng.float(0.09, 0.2) : -rng.float(0.07, 0.15);
  const groundShift = (rng.bool() ? 1 : -1) * rng.float(0.03, 0.075);
  // Gesteinsbänder: benachbarter bis deutlich abgesetzter Farbton, aber kein Komplementärkontrast (wirkt sonst fleckig)
  const strataShift = (rng.bool() ? 1 : -1) * rng.float(0.1, 0.28);
  const biomes: BiomeStyle[] = planet.biomes.map((b) => {
    const [vh, vs, vl] = hexToHsl(b.palette.vegetation);
    const [gh, gs, gl] = hexToHsl(b.palette.ground);
    const [ah, as] = hexToHsl(b.palette.accent);
    return {
      vegetation2: hslToHex(vh + vegShift, clamp(vs * 1.1 + 0.05, 0.25, 0.9), clamp(vl + rng.float(-0.04, 0.08), 0.18, 0.62)),
      // Sand- und Erdtöne (Gelb/Orange) kippen sonst ins Giftgrüne: dort immer Richtung Rot verschieben
      ground2: hslToHex(gh + (gh > 0.04 && gh < 0.22 ? -Math.abs(groundShift) : groundShift), clamp(gs * 1.1 + 0.04, 0.1, 0.75), clamp(gl + (gl > 0.45 ? -0.1 : 0.1), 0.15, 0.75)),
      strata: hslToHex(ah + strataShift, clamp(as * 0.7 + 0.15, 0.25, 0.55), 0.54),
    };
  });
  const vegHue = hexToHsl(planet.biomes[0]?.palette.vegetation ?? '#4a8a3a')[0];
  // Grasspitzen: warm (Richtung Gelb), kühl (Richtung Türkis) oder kräftiger Kontrast (Rosa/Violett auf Grün)
  const tipShift = rng.pick([-0.09, -0.13, 0.1, 0.42, 0.5]);
  const grassTip = hslToHex(vegHue + tipShift, rng.float(0.6, 0.8), rng.float(0.58, 0.68));
  const landmarks = landmarkGenomes(planet, rng.fork('landmarks'), vegHue);
  return {
    biomes,
    grassTip,
    landmarks,
    vegZone: (x, z) => smoothstep(-0.08, 0.2, vegNoise.noise2D(x / 150, z / 150) * 0.78 + vegNoise.noise2D(x / 41 + 9.3, z / 41 - 4.1) * 0.22),
    groundZone: (x, z) => smoothstep(-0.05, 0.3, groundNoise.noise2D(x / 260, z / 260) * 0.8 + groundNoise.noise2D(x / 63 - 2.7, z / 63 + 6.6) * 0.2),
    groveZone: (x, z) => smoothstep(-0.2, 0.35, groveNoise.noise2D(x / 330, z / 330)),
  };
}
