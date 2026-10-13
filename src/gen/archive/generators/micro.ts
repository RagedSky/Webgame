/** Mikroorganismen und Zellen: nur per Mikroskop nach Probenentnahme (Wasser, Boden, Pflanze, Gestein, Eis, Luft, Quelle). */
import { round } from '@/math/utils';
import type { Biome, Planet } from '../../universe/types';
import { describeMicro } from '../descriptions';
import { colorPrefix, compoundName, uniqueLatin } from '../names';
import { makeSpawn } from '../spawn';
import type { ArchiveEntry, Family, MicroFamilyTraits, MicroGenome, MicroShape, Pattern, SampleSource } from '../types';
import { entryId, familyId, hasAtmosphere, landBiomes, nonCaveBiomes, pickBiomes, rollRarity, splitIntoFamilies, waterBiomes, type GenContext } from './common';

const NOUNS = ['Kugelzelle', 'Stäbchen', 'Spiraling', 'Sternling', 'Wechseltier', 'Kieselzelle', 'Wimperling', 'Kettenbildner', 'Kolonist', 'Schwärmer', 'Sporling', 'Keim', 'Fädling', 'Bläschen'];
const SOURCE_PREFIX: Record<SampleSource, string[]> = {
  water: ['Wasser', 'Tropfen', 'Flut'],
  soil: ['Boden', 'Erd', 'Staub'],
  plant: ['Blatt', 'Wurzel', 'Rinden'],
  rock: ['Fels', 'Stein', 'Kluft'],
  ice: ['Eis', 'Frost', 'Firn'],
  air: ['Luft', 'Wind', 'Schweb'],
  vent: ['Dampf', 'Quell', 'Glut'],
};
const SIZE_BY_SHAPE: Record<MicroShape, [number, number]> = {
  coccus: [0.5, 3],
  bacillus: [1, 8],
  spiral: [2, 20],
  star: [5, 60],
  amoeboid: [20, 400],
  diatom: [10, 150],
  ciliate: [30, 300],
  colony: [50, 900],
};

function availableSources(planet: Planet, floraCount: number): SampleSource[] {
  const out: SampleSource[] = [];
  if (planet.type === 'gas_giant') return ['air'];
  if (waterBiomes(planet).length) out.push('water');
  out.push('soil', 'rock');
  if (floraCount > 0) out.push('plant');
  if (planet.type === 'ice' || planet.type === 'tundra' || planet.temperature.min < 250) out.push('ice');
  if (hasAtmosphere(planet)) out.push('air');
  if (planet.biomes.some((b) => b.kind === 'sulfur_springs' || b.kind === 'lava_fields' || b.kind === 'deep_sea' || b.kind === 'lava_tubes')) out.push('vent');
  return out;
}

function biomePoolFor(planet: Planet, source: SampleSource): Biome[] {
  switch (source) {
    case 'water':
      return waterBiomes(planet);
    case 'vent':
      return planet.biomes.filter((b) => ['sulfur_springs', 'lava_fields', 'deep_sea', 'lava_tubes'].includes(b.kind));
    case 'air':
      return nonCaveBiomes(planet).length ? nonCaveBiomes(planet) : planet.biomes;
    case 'ice':
      return planet.biomes.filter((b) => ['glacier', 'ice_plain', 'frost_forest', 'ice_caves', 'snow_mountains', 'permafrost_bog', 'tundra'].includes(b.kind));
    default:
      return landBiomes(planet);
  }
}

export function generateMicro(ctx: GenContext, count: number, floraCount: number): { entries: ArchiveEntry[]; families: Family[] } {
  const { planet, names } = ctx;
  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  if (count <= 0) return { entries, families };
  const sources = availableSources(planet, floraCount);
  const sizes = splitIntoFamilies(ctx.rng.fork('split'), count, 2, 5);
  let entryNo = 1;

  sizes.forEach((size, fi) => {
    const frng = ctx.rng.fork(`family:${fi}`);
    const sampleSource = frng.pick(sources);
    const shape = frng.weighted<MicroShape>([
      { item: 'coccus', weight: 3 },
      { item: 'bacillus', weight: 3 },
      { item: 'spiral', weight: 1.5 },
      { item: 'star', weight: 1 },
      { item: 'amoeboid', weight: 1.5 },
      { item: 'diatom', weight: sampleSource === 'water' ? 2.5 : 0.7 },
      { item: 'ciliate', weight: sampleSource === 'water' ? 2 : 0.8 },
      { item: 'colony', weight: 1 },
    ]);
    const traits: MicroFamilyTraits = {
      kind: 'micro',
      shape,
      motility: frng.weighted([
        { item: 'flagella', weight: 3 },
        { item: 'cilia', weight: shape === 'ciliate' ? 5 : 1 },
        { item: 'none', weight: 3 },
        { item: 'gliding', weight: 1 },
      ]),
      sampleSource,
      nounPool: frng.sample(NOUNS, 3),
    };
    let pool = biomePoolFor(planet, sampleSource);
    if (pool.length === 0) pool = planet.biomes;
    const familyBiomes = pickBiomes(frng, pool, 3);
    const genus = names.uniqueGenus(frng);
    const subcategory = shape === 'amoeboid' || shape === 'ciliate' ? 'protist' : shape === 'diatom' ? 'algae' : shape === 'colony' ? 'colony' : 'bacteria';
    const fam: Family = {
      id: familyId(planet, 'micro', fi + 1),
      category: 'micro',
      subcategory,
      planetId: planet.id,
      name: genus,
      description: `Familie ${genus}: ${subcategory === 'bacteria' ? 'Bakterien' : subcategory === 'protist' ? 'Einzeller' : subcategory === 'algae' ? 'Kieselalgen' : 'Koloniebildner'} aus ${SOURCE_PREFIX[sampleSource][0]}proben.`,
      traits,
      memberIds: [],
    };
    families.push(fam);

    for (let si = 0; si < size; si++) {
      const rng = frng.fork(`species:${si}`);
      const rarity = rollRarity(rng, ctx.difficulty);
      const [lo, hi] = SIZE_BY_SHAPE[shape];
      const genome: MicroGenome = {
        kind: 'micro',
        shape,
        sizeUm: round(rng.float(lo, hi), 1),
        hue: round(rng.float(0, 360), 1),
        motility: traits.motility,
        nucleusCount: rng.weighted([{ item: 1, weight: 6 }, { item: 2, weight: 2 }, { item: 0, weight: 1.5 }, { item: 4, weight: 0.5 }]),
        membranePattern: rng.pick<Pattern>(['none', 'spots', 'rings', 'stripes', 'mottled']),
        sampleSource,
      };
      const biomes = si === 0 ? familyBiomes : pickBiomes(rng, familyBiomes, 2);
      const spawn = makeSpawn(rng, planet, biomes, rarity, { allowSpecial: ['cave', 'after_storm'] });
      spawn.timeOfDay = 'any';
      const cPrefix = colorPrefix(genome.hue, 0.5, 0.7);
      const prefixOptions = [
        ...SOURCE_PREFIX[sampleSource].map((p) => ({ item: p, weight: 1.5 })),
        { item: cPrefix, weight: 1 },
        { item: genome.sizeUm > 200 ? 'Riesen' : genome.sizeUm < 1 ? 'Zwerg' : '', weight: 0.8 },
      ].filter((o) => o.item !== '');
      const name = names.unique(() => compoundName(rng.weighted(prefixOptions), rng.pick(traits.nounPool)));
      const latinName = uniqueLatin(names, rng, genus, { colorPrefix: cPrefix, biomeKind: biomes[0]?.kind });
      const behaviors = rng.sample(['dividing', 'swarming', 'feeding', 'colonizing', 'pulsing'], rng.int(1, 2));
      const id = entryId(planet, 'micro', entryNo++);
      entries.push({
        id,
        category: 'micro',
        subcategory,
        familyId: fam.id,
        name,
        latinName,
        planetId: planet.id,
        biomeIds: biomes.map((b) => b.id),
        rarity,
        description: describeMicro(planet, biomes, genome, rarity, spawn),
        spawn,
        behaviors,
        hints: ['sample_trace'],
        captureMethod: 'microscope',
        genome,
      });
      fam.memberIds.push(id);
    }
  });
  return { entries, families };
}
