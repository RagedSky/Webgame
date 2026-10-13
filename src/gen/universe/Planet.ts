/**
 * Planeten-Generator: Typ, Größe, Gravitation, Atmosphäre, Temperatur, Biome, Rohstoffe, Wetter, Gefahren.
 * Der Startplanet (forceStart) erhält harte Garantien: lebensfreundlich, atembar, alle Start-/Treibstoff-Rohstoffe.
 */
import type { Random } from '@/math/Random';
import { clamp, clamp01, round } from '@/math/utils';
import { CATEGORIES, type Category } from '../archive/types';
import {
  BIOMES,
  LAUNCH_RESOURCES,
  LIFE_FRIENDLY_TYPES,
  PLANET_TYPES,
  PLANET_TYPE_IDS,
  RESOURCES,
  RESOURCE_IDS,
  STAR_TYPES,
  TOXIC_GASES,
  type PlanetTypeDef,
} from './catalog';
import { moonName, planetName } from './names';
import type {
  Atmosphere,
  Biome,
  Gas,
  Hazard,
  Moon,
  Planet,
  PlanetRequirements,
  PlanetType,
  ResourceDeposit,
  ResourceId,
  Star,
  WeatherType,
} from './types';

export interface PlanetGenOptions {
  index: number;
  orbitAu: number;
  star: Star;
  forceStart: boolean;
  difficulty: number;
}

const EARTH_RADIUS_KM = 6371;

/** Gleichgewichtstemperatur ohne Treibhauseffekt (Erde bei 1 AU, L=1 ≈ 278 K). */
export function equilibriumTemperature(luminosity: number, orbitAu: number): number {
  return (278 * Math.pow(luminosity, 0.25)) / Math.sqrt(orbitAu);
}

function pickType(rng: Random, tEq: number, gasGiant: boolean, forceStart: boolean, star: Star): PlanetTypeDef {
  if (gasGiant) return PLANET_TYPES.gas_giant;
  const starDef = STAR_TYPES[star.type];
  const candidates = forceStart ? LIFE_FRIENDLY_TYPES : PLANET_TYPE_IDS.filter((t) => !PLANET_TYPES[t].gasGiant);
  const weighted = candidates.map((t) => {
    const def = PLANET_TYPES[t];
    const tEff = tEq + def.greenhouse * 0.6;
    const d = (tEff - def.idealTemp) / def.tempSpread;
    let w = def.baseWeight * Math.exp(-d * d) + 0.01;
    if (def.lifeFriendly) w *= starDef.lifeBias;
    return { item: t, weight: w };
  });
  return PLANET_TYPES[rng.weighted(weighted)];
}

function generateAtmosphere(rng: Random, def: PlanetTypeDef, forceStart: boolean): Atmosphere {
  let pressure = rng.float(def.pressure[0], def.pressure[1]);
  if (forceStart) pressure = rng.float(0.85, 1.3);
  const composition: Partial<Record<Gas, number>> = {};
  if (pressure > 0) {
    let total = 0;
    const parts = def.gases.map((g) => ({ gas: g.gas, w: g.weight * rng.float(0.6, 1.4) }));
    for (const p of parts) total += p.w;
    for (const p of parts) composition[p.gas] = p.w / total;
    if (forceStart) {
      // Atembar garantieren: O2 19–25 %, Giftgase klein, Rest Stickstoff
      const o2 = rng.float(0.19, 0.25);
      const ar = rng.float(0.005, 0.02);
      const co2 = rng.float(0.001, 0.01);
      const h2o = rng.float(0.005, 0.03);
      for (const k of Object.keys(composition) as Gas[]) delete composition[k];
      composition.N2 = 1 - o2 - ar - co2 - h2o;
      composition.O2 = o2;
      composition.Ar = ar;
      composition.CO2 = co2;
      composition.H2O = h2o;
    }
  }
  const o2 = composition.O2 ?? 0;
  let toxicFraction = 0;
  for (const g of TOXIC_GASES) toxicFraction += composition[g] ?? 0;
  const breathable = pressure >= 0.5 && pressure <= 2.5 && o2 >= 0.17 && o2 <= 0.35 && toxicFraction < 0.03;
  const toxic = pressure > 0.05 && toxicFraction > 0.1;
  const density = def.gasGiant ? 2 : clamp(pressure, 0, 2);
  const rounded: Partial<Record<Gas, number>> = {};
  for (const [k, v] of Object.entries(composition)) rounded[k as Gas] = round(v, 4);
  return { composition: rounded, pressure: round(pressure, 3), density: round(density, 3), breathable, toxic };
}

function generateBiomes(rng: Random, planetId: string, def: PlanetTypeDef): Biome[] {
  const count = clamp(rng.int(def.biomeCount[0], def.biomeCount[1]), 1, def.biomes.length);
  const kinds = rng.sample(def.biomes, count);
  const weights = kinds.map(() => rng.float(0.5, 1.5));
  const total = weights.reduce((a, b) => a + b, 0);
  return kinds.map((kind, i) => {
    const b = BIOMES[kind];
    return {
      id: `${planetId}-b${i + 1}`,
      kind,
      name: b.name,
      coverage: round((weights[i] as number) / total, 3),
      humidity: b.humidity,
      altitude: [b.altitude[0], b.altitude[1]],
      temperatureOffset: b.temperatureOffset,
      hasWater: b.hasWater,
      isCave: b.isCave,
      palette: { ...b.palette },
    };
  });
}

function weightedSampleWithoutReplacement<T>(rng: Random, items: Array<{ item: T; weight: number }>, count: number): T[] {
  const pool = items.filter((i) => i.weight > 0).slice();
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const picked = rng.weighted(pool);
    out.push(picked);
    const idx = pool.findIndex((p) => p.item === picked);
    pool.splice(idx, 1);
  }
  return out;
}

function generateResources(rng: Random, type: PlanetType, biomes: Biome[], forceStart: boolean): ResourceDeposit[] {
  const def = PLANET_TYPES[type];
  const candidates = RESOURCE_IDS.map((id) => ({ item: id, weight: RESOURCES[id].planetWeights[type] ?? 0 }));
  const count = def.gasGiant ? rng.int(3, 5) : rng.int(5, 9);
  const chosen = new Set<ResourceId>(weightedSampleWithoutReplacement(rng, candidates, count));

  if (forceStart) {
    for (const id of LAUNCH_RESOURCES) chosen.add(id);
    const ensureRole = (role: 'energy' | 'oxidizer' | 'stabilizer', min: number): void => {
      const have = Array.from(chosen).filter((id) => RESOURCES[id].fuelRole === role).length;
      if (have >= min) return;
      const options = RESOURCE_IDS.filter((id) => RESOURCES[id].fuelRole === role && !chosen.has(id));
      const weighted = options.map((id) => ({ item: id, weight: (RESOURCES[id].planetWeights[type] ?? 0) + 0.05 }));
      for (const id of weightedSampleWithoutReplacement(rng, weighted, min - have)) chosen.add(id);
    };
    ensureRole('energy', 2);
    ensureRole('oxidizer', 2);
    ensureRole('stabilizer', 2);
  }

  const nonCave = biomes.filter((b) => !b.isCave);
  const waterBiomes = biomes.filter((b) => b.hasWater);
  return Array.from(chosen).map((resourceId) => {
    const res = RESOURCES[resourceId];
    let pool = nonCave.length ? nonCave : biomes;
    if ((resourceId === 'water' || resourceId === 'brine') && waterBiomes.length) pool = waterBiomes;
    if (res.kind === 'metal' && rng.bool(0.3) && biomes.some((b) => b.isCave)) pool = biomes;
    const biomeIds = rng.sample(pool, rng.int(1, Math.min(2, pool.length))).map((b) => b.id);
    return { resourceId, abundance: round(rng.float(0.2, 1), 2), biomeIds };
  });
}

function generateWeather(rng: Random, def: PlanetTypeDef, forceStart: boolean): WeatherType[] {
  const count = clamp(rng.int(def.weatherCount[0], def.weatherCount[1]), 1, def.weather.length);
  const chosen = new Set<WeatherType>(
    weightedSampleWithoutReplacement(
      rng,
      def.weather.map((w) => ({ item: w.type, weight: w.weight })),
      count,
    ),
  );
  if (def.weather.some((w) => w.type === 'clear')) chosen.add('clear');
  if (forceStart) {
    chosen.add('clear');
    if (!chosen.has('rain') && !chosen.has('fog')) chosen.add(rng.pick(['rain', 'fog']));
  }
  return Array.from(chosen);
}

function generateMoons(rng: Random, planetId: string, radiusKm: number, gasGiant: boolean): Moon[] {
  const count = gasGiant
    ? rng.int(2, 6)
    : rng.weighted([
        { item: 0, weight: 45 },
        { item: 1, weight: 35 },
        { item: 2, weight: 15 },
        { item: 3, weight: 5 },
      ]);
  const moons: Moon[] = [];
  let orbit = radiusKm * rng.float(4, 8);
  for (let i = 0; i < count; i++) {
    const moonRadius = gasGiant ? rng.float(300, 3500) : rng.float(150, Math.max(200, radiusKm * 0.3));
    const periodDays = round(Math.sqrt(Math.pow(orbit / radiusKm, 3)) * (gasGiant ? 0.4 : 0.9), 2);
    moons.push({
      id: `${planetId}-m${i + 1}`,
      name: moonName(rng),
      radiusKm: Math.round(moonRadius),
      orbitRadiusKm: Math.round(orbit),
      orbitPeriodDays: periodDays,
      color: rng.pick(['#b8b8b8', '#9a8f7a', '#c9b89a', '#8f9aa8', '#d9d2c5', '#7a7a80']),
    });
    orbit *= rng.float(1.5, 2.4);
  }
  return moons;
}

function generateHazards(
  rng: Random,
  def: PlanetTypeDef,
  star: Star,
  temperatureMean: number,
  atmosphere: Atmosphere,
  gravity: number,
  forceStart: boolean,
): Hazard[] {
  const hazards = new Set<Hazard>();
  for (const h of def.hazards) if (rng.bool(h.chance)) hazards.add(h.hazard);
  if (temperatureMean > 330) hazards.add('heat');
  if (temperatureMean < 240) hazards.add('cold');
  if (star.radiation > 0.5 && atmosphere.pressure < 0.3) hazards.add('radiation');
  if (gravity > 1.6) hazards.add('high_gravity');
  if (atmosphere.toxic) hazards.add('toxic_atmosphere');
  else if (!atmosphere.breathable) hazards.add('low_oxygen');
  if (forceStart) {
    for (const h of ['heat', 'cold', 'radiation', 'toxic_atmosphere', 'low_oxygen', 'high_gravity', 'acid', 'lava', 'crushing_pressure'] as Hazard[]) {
      hazards.delete(h);
    }
  }
  return Array.from(hazards);
}

function computeRequirements(def: PlanetTypeDef, gravity: number, hazards: Hazard[], temperatureMean: number, star: Star, forceStart: boolean): PlanetRequirements {
  if (forceStart) return { engineTier: 1, shieldTier: 0 };
  let engineTier: 1 | 2 | 3 = 1;
  if (gravity > 1.5) engineTier = 2;
  if (gravity > 2.2) engineTier = 3;
  if (def.gasGiant && engineTier < 2) engineTier = 2;
  let shieldTier: 0 | 1 | 2 = 0;
  if (hazards.includes('radiation')) shieldTier = star.type === 'blue_dwarf' ? 2 : 1;
  if (def.gasGiant || hazards.includes('crushing_pressure')) shieldTier = Math.max(shieldTier, 1) as 0 | 1 | 2;
  if (hazards.includes('heat') && temperatureMean > 450) shieldTier = 2;
  return { engineTier, shieldTier };
}

export function generatePlanet(parentRng: Random, opts: PlanetGenOptions): Planet {
  const { index, orbitAu, star, forceStart } = opts;
  const rng = parentRng.fork(`planet:${index}`);
  const id = `p${index}`;
  const tEq = equilibriumTemperature(star.luminosity, orbitAu);
  const hzOuter = star.habitableZoneAu[1];
  const pGas = forceStart ? 0 : clamp01((orbitAu / hzOuter - 0.9) * 0.35);
  const gasGiant = !forceStart && rng.bool(Math.min(0.6, pGas));
  const def = pickType(rng.fork('type'), tEq, gasGiant, forceStart, star);

  const radiusKm = Math.round(rng.float(def.radiusKm[0], def.radiusKm[1]));
  const density = rng.float(def.density[0], def.density[1]);
  let gravity = def.gasGiant ? 0.9 + ((radiusKm - 22000) / 48000) * 2.1 : (density * radiusKm) / EARTH_RADIUS_KM;
  if (forceStart) gravity = clamp(gravity, 0.75, 1.25);
  gravity = round(gravity, 2);

  const atmosphere = generateAtmosphere(rng.fork('atmo'), def, forceStart);

  let mean = tEq + def.greenhouse * Math.min(1, atmosphere.pressure) + rng.float(-8, 8);
  if (forceStart) mean = clamp(mean, 274, 302);
  if (def.gasGiant) mean = Math.max(mean, 90);
  mean = Math.max(mean, 40); // Restwärme aus dem Inneren: nie kälter als 40 K
  const dayLengthHours = round(def.gasGiant ? rng.float(8, 20) : forceStart ? rng.float(18, 36) : rng.float(10, 60), 1);
  const axialTiltDeg = round(rng.bool(0.06) ? rng.float(50, 90) : rng.centered(0, 40), 1);
  const thin = atmosphere.pressure < 0.2;
  const swing = (def.gasGiant ? 15 : thin ? 70 : 26) * Math.pow(dayLengthHours / 24, 0.3);
  const seasonal = axialTiltDeg * 0.25;
  const temperature = {
    mean: round(mean, 1),
    min: round(mean - swing * 0.6 - seasonal, 1),
    max: round(mean + swing * 0.6 + seasonal, 1),
  };

  const orbitPeriodDays = round(365.25 * Math.sqrt(Math.pow(orbitAu, 3) / star.mass), 1);
  const biomes = generateBiomes(rng.fork('biomes'), id, def);
  const resources = generateResources(rng.fork('resources'), def.type, biomes, forceStart);
  const weather = generateWeather(rng.fork('weather'), def, forceStart);
  const moons = generateMoons(rng.fork('moons'), id, radiusKm, def.gasGiant);
  const hazards = generateHazards(rng.fork('hazards'), def, star, temperature.mean, atmosphere, gravity, forceStart);
  const requirements = computeRequirements(def, gravity, hazards, temperature.mean, star, forceStart);

  const tempFactor = clamp01(1 - Math.abs(temperature.mean - 292) / 160);
  let biodiversity = rng.float(def.biodiversity[0], def.biodiversity[1]) * (0.6 + 0.4 * tempFactor);
  if (forceStart) biodiversity = Math.max(0.6, biodiversity);
  biodiversity = round(clamp01(biodiversity), 3);

  const entryBudget = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;

  return {
    id,
    name: planetName(rng.fork('name'), index),
    index,
    type: def.type,
    typeLabel: def.label,
    orbitRadiusAu: round(orbitAu, 3),
    orbitPeriodDays,
    radiusKm,
    gravity,
    atmosphere,
    temperature,
    dayLengthHours,
    axialTiltDeg,
    moons,
    biomes,
    resources,
    weather,
    hazards,
    biodiversity,
    terrainSeed: rng.fork('terrain').seedWord(10),
    color: def.color,
    isStart: forceStart,
    requirements,
    entryBudget,
  };
}
