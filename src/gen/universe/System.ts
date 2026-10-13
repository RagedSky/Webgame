/**
 * Sternsystem-Generator: Sonnentyp, Orbits (mit garantiertem Planeten in der Lebenszone),
 * Planeten, Startplanet, Treibstoff-Formel und Eintragsbudget. Das Archiv füllt `generateArchive`.
 */
import { Random } from '@/math/Random';
import { round } from '@/math/utils';
import { STAR_TYPES, type StarTypeDef } from './catalog';
import { generateFuelFormula } from './Fuel';
import { systemName } from './names';
import { generatePlanet } from './Planet';
import type { Star, StarSystem, StarType } from './types';

export const GENERATOR_VERSION = 1;

export interface SystemGenOptions {
  difficulty?: number;
  /** Erzwingt einen Sonnentyp (Tests/Debug). */
  starType?: StarType;
}

function generateStar(rng: Random, name: string, forced?: StarType): Star {
  const type =
    forced ??
    rng.weighted(
      (Object.values(STAR_TYPES) as StarTypeDef[]).map((d) => ({ item: d.type, weight: d.weight })),
    );
  const def = STAR_TYPES[type];
  const luminosity = rng.float(def.luminosity[0], def.luminosity[1]);
  const midL = (def.luminosity[0] + def.luminosity[1]) / 2;
  const hzScale = Math.sqrt(luminosity / midL);
  return {
    type,
    label: def.label,
    name,
    color: def.color,
    lightColor: def.lightColor,
    temperatureK: Math.round(rng.float(def.temperatureK[0], def.temperatureK[1])),
    luminosity: round(luminosity, 3),
    mass: round(rng.float(def.mass[0], def.mass[1]), 3),
    radius: round(rng.float(def.radius[0], def.radius[1]), 3),
    habitableZoneAu: [round(def.habitableZone[0] * hzScale, 3), round(def.habitableZone[1] * hzScale, 3)],
    radiation: round(rng.float(def.radiation[0], def.radiation[1]), 3),
  };
}

/** Orbits in AU, aufsteigend, mit genau einem garantierten Orbit in der Lebenszone an `hzIndex`. */
export function layoutOrbits(rng: Random, star: Star, count: number): { orbits: number[]; hzIndex: number } {
  const def = STAR_TYPES[star.type];
  const hzIndex = rng.int(0, Math.min(count - 1, 3));
  const orbits = new Array<number>(count).fill(0);
  orbits[hzIndex] = rng.float(star.habitableZoneAu[0], star.habitableZoneAu[1]);
  for (let i = hzIndex - 1; i >= 0; i--) orbits[i] = (orbits[i + 1] as number) / rng.float(1.35, 1.8);
  for (let i = hzIndex + 1; i < count; i++) orbits[i] = (orbits[i - 1] as number) * rng.float(1.35, 1.8);
  for (let i = 0; i < hzIndex; i++) {
    const lower = def.minOrbit * Math.pow(1.25, i);
    if ((orbits[i] as number) < lower) orbits[i] = lower;
  }
  return { orbits: orbits.map((o) => round(o, 3)), hzIndex };
}

/** Erzeugt Stern, Planeten, Startplanet, Treibstoff-Formel und Budget (Archiv-Einträge noch leer). */
export function generateStarSystem(seed: string, options: SystemGenOptions = {}): StarSystem {
  const difficulty = Math.max(1, Math.floor(options.difficulty ?? 1));
  const rng = new Random(seed);
  const name = systemName(rng.fork('name'));
  const star = generateStar(rng.fork('star'), name, options.starType);
  const count = rng.fork('count').int(3, 10);
  const { orbits, hzIndex } = layoutOrbits(rng.fork('orbits'), star, count);

  const planets = orbits.map((orbitAu, index) =>
    generatePlanet(rng, { index, orbitAu, star, forceStart: index === hzIndex, difficulty }),
  );
  const startPlanet = planets[hzIndex]!;
  const fuelFormula = generateFuelFormula(rng.fork('fuel'), startPlanet);
  const entryBudget = rng.fork('budget').int(400, 600);

  return {
    seed,
    name,
    difficulty,
    star,
    planets,
    startPlanetId: startPlanet.id,
    fuelFormula,
    entryBudget,
    entries: [],
    families: [],
    generatorVersion: GENERATOR_VERSION,
  };
}
