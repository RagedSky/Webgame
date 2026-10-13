/**
 * Spawn-Bedingungen nach Seltenheit. Garantiert, dass jede Bedingung auf dem Planeten erfüllbar ist:
 * Wetter ⊆ Planetenwetter, Temperaturfenster im Planetenbereich, Spezialbedingungen nur wenn vorhanden.
 */
import type { Random } from '@/math/Random';
import { clamp, round } from '@/math/utils';
import { WEATHER } from '../universe/catalog';
import type { Biome, Planet, WeatherType } from '../universe/types';
import type { Activity, FaunaLocomotion, Rarity, SpawnConditions, SpecialCondition, TimeOfDay } from './types';

export interface SpawnOptions {
  activity?: Activity;
  locomotion?: FaunaLocomotion;
  /** Kategorie-spezifische Spezialbedingungen, die infrage kommen. */
  allowSpecial?: SpecialCondition[];
}

const STORM_TYPES: WeatherType[] = ['storm', 'thunderstorm', 'blizzard', 'sandstorm', 'lightning_storm'];

export function timeFromActivity(rng: Random, activity: Activity | undefined, rarity: Rarity): TimeOfDay {
  if (!activity) {
    if (rarity === 'common') return 'any';
    if (rarity === 'uncommon') return rng.bool(0.3) ? rng.pick(['day', 'night']) : 'any';
    return rng.bool(0.55) ? rng.pick(['night', 'dawn', 'dusk']) : 'any';
  }
  switch (activity) {
    case 'diurnal':
      return rarity === 'common' && rng.bool(0.5) ? 'any' : 'day';
    case 'nocturnal':
      return 'night';
    case 'crepuscular':
      return rng.pick(['dawn', 'dusk']);
    case 'cathemeral':
      return 'any';
  }
}

function weatherFor(rng: Random, planet: Planet, rarity: Rarity): 'any' | WeatherType[] {
  const available = planet.weather;
  if (available.length === 0) return 'any';
  const chance = rarity === 'common' ? 0 : rarity === 'uncommon' ? 0.3 : rarity === 'rare' ? 0.6 : 0.7;
  if (!rng.bool(chance)) return 'any';
  const preferSpecial = rarity !== 'uncommon';
  const weighted = available.map((w) => ({
    item: w,
    weight: w === 'clear' ? (preferSpecial ? 0.3 : 1.5) : WEATHER[w].hazardous ? (preferSpecial ? 1.6 : 0.6) : 1,
  }));
  const first = rng.weighted(weighted);
  if (rarity === 'rare' && available.length > 1 && rng.bool(0.35)) {
    const second = rng.weighted(weighted.filter((w) => w.item !== first));
    return [first, second];
  }
  return [first];
}

/** Erlaubte Spezialbedingungen für den Planeten und die gewählten Biome. */
export function possibleSpecials(planet: Planet, biomes: Biome[], opts: SpawnOptions): SpecialCondition[] {
  const out: SpecialCondition[] = [];
  const allow = new Set(opts.allowSpecial ?? ['cave', 'solstice', 'after_storm', 'eclipse', 'underwater', 'deep_sea']);
  if (allow.has('cave') && biomes.some((b) => b.isCave)) out.push('cave');
  if (allow.has('solstice') && planet.axialTiltDeg > 3) out.push('solstice');
  if (allow.has('after_storm') && planet.weather.some((w) => STORM_TYPES.includes(w))) out.push('after_storm');
  if (allow.has('eclipse') && planet.moons.length > 0) out.push('eclipse');
  if (allow.has('underwater') && opts.locomotion === 'water' && biomes.some((b) => b.hasWater)) out.push('underwater');
  if (allow.has('deep_sea') && opts.locomotion === 'water' && biomes.some((b) => b.kind === 'deep_sea')) out.push('deep_sea');
  if (allow.has('atmosphere_probe') && planet.type === 'gas_giant') out.push('atmosphere_probe');
  return out;
}

export function makeSpawn(rng: Random, planet: Planet, biomes: Biome[], rarity: Rarity, opts: SpawnOptions = {}): SpawnConditions {
  // Höhe: Vereinigung der Biom-Höhenbänder, bei seltenen Arten verengt
  let altMin = 1;
  let altMax = 0;
  for (const b of biomes) {
    altMin = Math.min(altMin, b.altitude[0]);
    altMax = Math.max(altMax, b.altitude[1]);
  }
  if (biomes.length === 0) {
    altMin = 0;
    altMax = 1;
  }
  if (rarity === 'rare' || rarity === 'legendary') {
    const span = altMax - altMin;
    const width = span * (rarity === 'rare' ? 0.6 : 0.45);
    const start = altMin + rng.float(0, span - width);
    altMin = start;
    altMax = start + width;
  }

  // Temperaturfenster innerhalb des Planetenbereichs
  const { min: tMin, max: tMax } = planet.temperature;
  const fraction = rarity === 'common' ? 1 : rarity === 'uncommon' ? 0.8 : rarity === 'rare' ? 0.6 : 0.45;
  const span = tMax - tMin;
  const width = span * fraction;
  const start = tMin + rng.float(0, span - width);
  const temperature: [number, number] = [round(start, 1), round(start + width, 1)];

  const timeOfDay = timeFromActivity(rng, opts.activity, rarity);
  const weather = weatherFor(rng, planet, rarity);

  const spawn: SpawnConditions = {
    timeOfDay,
    weather,
    altitude: [round(clamp(altMin, 0, 1), 3), round(clamp(altMax, 0, 1), 3)],
    temperature,
  };

  const specials = possibleSpecials(planet, biomes, opts);
  const specialChance = rarity === 'legendary' ? 0.75 : rarity === 'rare' ? 0.25 : 0;
  if (specials.length && rng.bool(specialChance)) spawn.special = rng.pick(specials);
  if (planet.type === 'gas_giant' && !spawn.special) spawn.special = 'atmosphere_probe';
  return spawn;
}

/** Prüft, ob die Bedingungen auf dem Planeten erfüllbar sind (für Tests und Generator-Selbstprüfung). */
export function isSpawnSatisfiable(planet: Planet, biomes: Biome[], spawn: SpawnConditions): boolean {
  if (spawn.weather !== 'any') {
    if (spawn.weather.length === 0) return false;
    for (const w of spawn.weather) if (!planet.weather.includes(w)) return false;
  }
  if (spawn.temperature[0] < planet.temperature.min - 0.01 || spawn.temperature[1] > planet.temperature.max + 0.01) return false;
  if (spawn.temperature[0] > spawn.temperature[1]) return false;
  if (spawn.altitude[0] < 0 || spawn.altitude[1] > 1 || spawn.altitude[0] > spawn.altitude[1]) return false;
  switch (spawn.special) {
    case 'cave':
      return biomes.some((b) => b.isCave);
    case 'solstice':
      return planet.axialTiltDeg > 3;
    case 'after_storm':
      return planet.weather.some((w) => STORM_TYPES.includes(w));
    case 'eclipse':
      return planet.moons.length > 0;
    case 'underwater':
      return biomes.some((b) => b.hasWater);
    case 'deep_sea':
      return biomes.some((b) => b.kind === 'deep_sea');
    case 'atmosphere_probe':
      return planet.type === 'gas_giant';
    case 'orbit':
      return true;
    case undefined:
      return true;
  }
}
