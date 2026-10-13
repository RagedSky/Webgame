import type { Random } from '@/math/Random';
import type { Biome, Planet, StarSystem } from '../../universe/types';
import type { NameRegistry } from '../names';
import { CATEGORY_CODES, type Category, type Rarity } from '../types';

export interface GenContext {
  rng: Random;
  system: StarSystem;
  planet: Planet;
  names: NameRegistry;
  difficulty: number;
}

export function entryId(planet: Planet, category: Category, n: number): string {
  return `${planet.id}-${CATEGORY_CODES[category]}-${String(n).padStart(3, '0')}`;
}

export function familyId(planet: Planet, category: Category, n: number): string {
  return `${planet.id}-${CATEGORY_CODES[category]}-F${n}`;
}

/** Seltenheit: 50/30/15/5, mit Schwierigkeit leicht in Richtung selten verschoben. */
export function rollRarity(rng: Random, difficulty = 1): Rarity {
  const shift = Math.min(10, (difficulty - 1) * 2);
  return rng.weighted<Rarity>([
    { item: 'common', weight: 50 - shift },
    { item: 'uncommon', weight: 30 },
    { item: 'rare', weight: 15 + shift * 0.6 },
    { item: 'legendary', weight: 5 + shift * 0.4 },
  ]);
}

/** Teilt n in Familiengrößen zwischen min und max (Summe exakt n). */
export function splitIntoFamilies(rng: Random, n: number, min = 2, max = 6): number[] {
  const sizes: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    let size = Math.min(remaining, rng.int(min, max));
    if (remaining - size > 0 && remaining - size < min) size = remaining;
    sizes.push(size);
    remaining -= size;
  }
  return sizes;
}

/** Biome ohne Tiefwasser/Gasschichten – begehbar. */
const DEEP_WATER = new Set(['shallow_sea', 'deep_sea', 'reef', 'kelp_forest']);

export function landBiomes(planet: Planet): Biome[] {
  return planet.biomes.filter((b) => !DEEP_WATER.has(b.kind));
}

export function waterBiomes(planet: Planet): Biome[] {
  return planet.biomes.filter((b) => b.hasWater);
}

export function nonCaveBiomes(planet: Planet): Biome[] {
  return planet.biomes.filter((b) => !b.isCave);
}

export function caveBiomes(planet: Planet): Biome[] {
  return planet.biomes.filter((b) => b.isCave);
}

export function hasAtmosphere(planet: Planet): boolean {
  return planet.atmosphere.pressure > 0.05;
}

/** Hilfsfunktion: wählt 1..max Biome aus einer Liste (mind. eins, sofern vorhanden). */
export function pickBiomes(rng: Random, pool: Biome[], max = 2): Biome[] {
  if (pool.length === 0) return [];
  return rng.sample(pool, rng.int(1, Math.min(max, pool.length)));
}

export function biomeNames(biomes: Biome[]): string {
  const names = biomes.map((b) => b.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}
