/**
 * Einstiegspunkt der Generierung: `generateUniverse(seed)` liefert ein vollständiges Sternsystem
 * inklusive Archiv. Vollständig deterministisch – gleicher Seed, gleiches Ergebnis.
 */
import { Random } from '@/math/Random';
import { generateArchive } from './archive/ArchiveGenerator';
import { generateStarSystem, type SystemGenOptions } from './universe/System';
import type { StarSystem } from './universe/types';

export function generateUniverse(seed: string, options: SystemGenOptions = {}): StarSystem {
  const system = generateStarSystem(seed, options);
  generateArchive(system, new Random(seed).fork('archive'));
  return system;
}

export * from './universe/types';
export * from './archive/types';
export { generateStarSystem } from './universe/System';
export { generateArchive } from './archive/ArchiveGenerator';
export { analyzeMix, correctMix, FUEL_ROLE_LABELS } from './universe/Fuel';
export { STAR_TYPES, PLANET_TYPES, BIOMES, RESOURCES, WEATHER, HAZARD_LABELS, GAS_LABELS, LAUNCH_RESOURCES } from './universe/catalog';
