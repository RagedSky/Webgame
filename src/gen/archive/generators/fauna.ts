/** Fauna: Familien mit gemeinsamem Körperbau, Arten mit Variation, Verhalten und Spawn-Bedingungen. */
import type { Random } from '@/math/Random';
import { round } from '@/math/utils';
import { BIOMES } from '../../universe/catalog';
import type { Biome, Planet } from '../../universe/types';
import { describeFauna } from '../descriptions';
import { ACTIVITY_PREFIX, SIZE_PREFIX, colorPrefix, compoundName, uniqueLatin } from '../names';
import { makeSpawn } from '../spawn';
import type {
  Activity,
  ArchiveEntry,
  BodyShape,
  Covering,
  Diet,
  Family,
  FaunaFamilyTraits,
  FaunaGenome,
  FaunaLocomotion,
  HeadType,
  HintKind,
  Pattern,
  SizeClass,
  TailType,
  Temperament,
} from '../types';
import {
  caveBiomes,
  entryId,
  familyId,
  hasAtmosphere,
  landBiomes,
  nonCaveBiomes,
  pickBiomes,
  rollRarity,
  splitIntoFamilies,
  waterBiomes,
  type GenContext,
} from './common';

const NOUNS: Record<FaunaLocomotion, string[]> = {
  land: ['Läufer', 'Schleicher', 'Grasser', 'Stampfer', 'Hüpfer', 'Kriecher', 'Brüller', 'Horner', 'Panzerer', 'Schnüffler', 'Gräber', 'Springer', 'Trotter', 'Wühler', 'Streuner', 'Lauerer'],
  water: ['Schwimmer', 'Gleiter', 'Flosser', 'Taucher', 'Treiber', 'Pulser', 'Schwärmer', 'Lauerer', 'Segler', 'Wedler', 'Strudler'],
  air: ['Segler', 'Flatterer', 'Schwirrer', 'Schweber', 'Kreischer', 'Gleiter', 'Flügler', 'Pfeiler', 'Sturmreiter', 'Tänzer', 'Sänger'],
};

const SIZE_RANGES: Record<SizeClass, [number, number]> = {
  tiny: [0.05, 0.3],
  small: [0.3, 0.8],
  medium: [0.8, 2.0],
  large: [2.0, 5.0],
  huge: [5.0, 14.0],
};

const BEHAVIORS: Record<FaunaLocomotion, Record<'herb' | 'carn' | 'other', string[]>> = {
  land: {
    herb: ['grazing', 'drinking', 'sleeping', 'courting', 'migrating', 'playing', 'dust_bathing', 'basking'],
    carn: ['hunting', 'stalking', 'feeding', 'sleeping', 'courting', 'patrolling', 'display'],
    other: ['feeding', 'drinking', 'sleeping', 'burrowing', 'courting', 'playing', 'basking', 'molting'],
  },
  water: {
    herb: ['feeding', 'schooling', 'surfacing', 'spawning', 'sleeping'],
    carn: ['hunting', 'stalking', 'surfacing', 'spawning', 'display'],
    other: ['feeding', 'schooling', 'surfacing', 'spawning', 'pulsing'],
  },
  air: {
    herb: ['feeding', 'soaring', 'nesting', 'courting', 'roosting', 'singing'],
    carn: ['hunting', 'diving', 'soaring', 'nesting', 'roosting', 'display'],
    other: ['feeding', 'soaring', 'nesting', 'courting', 'roosting', 'singing'],
  },
};

const HINTS: Record<FaunaLocomotion, HintKind[]> = {
  land: ['tracks', 'droppings', 'sounds', 'nest', 'scent'],
  water: ['sounds', 'sample_trace', 'nest'],
  air: ['nest', 'sounds', 'droppings'],
};

const EXTRAS = ['leuchtende Augen', 'Rückenkamm', 'Fühlerpaar', 'Stachelsaum', 'Hornplatten', 'Schwanzfächer', 'Halskrause', 'Leuchtorgane', 'Panzerplatten', 'Fangarme', 'Drüsenkamm', 'Federbusch'];

function availableLocomotions(planet: Planet): FaunaLocomotion[] {
  if (planet.type === 'gas_giant') return ['air'];
  const out: FaunaLocomotion[] = [];
  if (landBiomes(planet).length) out.push('land');
  if (waterBiomes(planet).length && planet.type !== 'barren') out.push('water');
  if (hasAtmosphere(planet)) out.push('air');
  if (out.length === 0) out.push('land');
  return out;
}

function biomePoolFor(planet: Planet, locomotion: FaunaLocomotion): Biome[] {
  if (planet.type === 'gas_giant') return planet.biomes;
  if (locomotion === 'water') return waterBiomes(planet);
  if (locomotion === 'air') return nonCaveBiomes(planet).length ? nonCaveBiomes(planet) : planet.biomes;
  const land = landBiomes(planet).filter((b) => !b.isCave);
  return land.length ? land : landBiomes(planet);
}

function pickCovering(rng: Random, planet: Planet, locomotion: FaunaLocomotion, exotic: number): Covering {
  const w: Array<{ item: Covering; weight: number }> = [
    { item: 'scales', weight: locomotion === 'water' ? 3 : 2 },
    { item: 'fur', weight: planet.type === 'ice' || planet.type === 'tundra' ? 4 : locomotion === 'water' ? 0.2 : 1.5 },
    { item: 'chitin', weight: planet.type === 'volcanic' || planet.type === 'toxic' || planet.type === 'barren' ? 3 : 1.5 },
    { item: 'skin', weight: locomotion === 'water' ? 3 : 1.5 },
    { item: 'feathers', weight: locomotion === 'air' ? 3 : 0.3 },
    { item: 'membrane', weight: locomotion === 'air' ? 2 : locomotion === 'water' ? 1 : 0.3 },
    { item: 'crystal', weight: 0.2 + exotic * 1.5 + (planet.type === 'toxic' || planet.type === 'ice' ? 0.6 : 0) },
    { item: 'bioluminescent', weight: 0.2 + exotic * 1.5 + (planet.type === 'ocean' ? 0.6 : 0) },
  ];
  return rng.weighted(w);
}

function makeFamilyTraits(rng: Random, planet: Planet, locomotion: FaunaLocomotion, exotic: number): FaunaFamilyTraits {
  const legs =
    locomotion === 'water'
      ? 0
      : locomotion === 'air'
        ? rng.weighted([{ item: 2, weight: 6 }, { item: 4, weight: 2 }, { item: 0, weight: 1 }])
        : rng.weighted([{ item: 0, weight: 7 }, { item: 2, weight: 18 }, { item: 4, weight: 45 }, { item: 6, weight: 22 }, { item: 8, weight: 8 }]);
  const wings = locomotion === 'air' ? rng.weighted([{ item: 2, weight: 7 }, { item: 4, weight: 3 }]) : 0;
  const fins = locomotion === 'water' ? rng.int(2, 6) : 0;
  const bodyShape: BodyShape =
    legs === 0 && locomotion === 'land'
      ? 'serpentine'
      : rng.weighted([
          { item: 'slender', weight: 3 },
          { item: 'bulky', weight: locomotion === 'air' ? 1 : 3 },
          { item: 'round', weight: 2 },
          { item: 'flat', weight: locomotion === 'water' ? 2 : 0.7 },
          { item: 'serpentine', weight: locomotion === 'water' ? 1.5 : 0.3 },
        ]);
  const headType = rng.weighted<HeadType>([
    { item: 'snout', weight: 3 },
    { item: 'beak', weight: locomotion === 'air' ? 3 : 1 },
    { item: 'dome', weight: 1.5 },
    { item: 'crest', weight: 1.5 },
    { item: 'mandible', weight: 1.2 },
    { item: 'none', weight: 0.5 },
  ]);
  const tailType = rng.weighted<TailType>([
    { item: 'none', weight: 1.5 },
    { item: 'short', weight: 2 },
    { item: 'long', weight: 2.5 },
    { item: 'fin', weight: locomotion === 'water' ? 4 : 0.2 },
    { item: 'fan', weight: locomotion === 'air' ? 2 : 0.8 },
    { item: 'club', weight: 0.6 },
  ]);
  const covering = pickCovering(rng, planet, locomotion, exotic);
  const diet =
    planet.type === 'barren'
      ? 'mineralivore'
      : rng.weighted<Diet>(
          locomotion === 'water'
            ? [{ item: 'filter', weight: 3 }, { item: 'carnivore', weight: 3.5 }, { item: 'herbivore', weight: 2.5 }, { item: 'omnivore', weight: 1 }]
            : locomotion === 'air'
              ? [{ item: 'carnivore', weight: 3.5 }, { item: 'herbivore', weight: 3 }, { item: 'omnivore', weight: 2.5 }, { item: 'filter', weight: 1 }]
              : [{ item: 'herbivore', weight: 4.5 }, { item: 'carnivore', weight: 2.5 }, { item: 'omnivore', weight: 2.5 }, { item: 'mineralivore', weight: 0.4 }, { item: 'photovore', weight: 0.3 + exotic }],
        );
  const sizeClass = rng.weighted<SizeClass>(
    locomotion === 'air'
      ? [{ item: 'tiny', weight: 3 }, { item: 'small', weight: 4 }, { item: 'medium', weight: 2.5 }, { item: 'large', weight: 0.7 }]
      : [{ item: 'tiny', weight: 2 }, { item: 'small', weight: 3.5 }, { item: 'medium', weight: 3.5 }, { item: 'large', weight: 2 }, { item: 'huge', weight: locomotion === 'water' ? 1.2 : 0.6 }],
  );
  const activity = rng.weighted<Activity>([
    { item: 'diurnal', weight: 4.5 },
    { item: 'nocturnal', weight: 2.5 },
    { item: 'crepuscular', weight: 2 },
    { item: 'cathemeral', weight: 1 },
  ]);
  const temperament = rng.weighted<Temperament>([
    { item: 'shy', weight: 4 },
    { item: 'neutral', weight: 3 },
    { item: 'curious', weight: 2 },
    { item: 'aggressive', weight: diet === 'carnivore' ? 3 : 0.8 },
  ]);
  const dietKey = diet === 'herbivore' || diet === 'photovore' ? 'herb' : diet === 'carnivore' ? 'carn' : 'other';
  return {
    kind: 'fauna',
    locomotion,
    legs,
    wings,
    fins,
    bodyShape,
    headType,
    tailType,
    covering,
    diet,
    sizeClass,
    activity,
    temperament,
    behaviorPool: BEHAVIORS[locomotion][dietKey],
    hintPool: HINTS[locomotion],
    nounPool: rng.sample(NOUNS[locomotion], 4),
  };
}

const TRAIT_PREFIXES = (t: FaunaFamilyTraits, genome: FaunaGenome): string[] => {
  const out: string[] = [];
  if (t.legs === 6) out.push('Sechsbein');
  if (t.legs === 8) out.push('Achtbein');
  if (t.legs === 2 && t.locomotion === 'land') out.push('Zweibein');
  if (t.covering === 'chitin') out.push('Panzer');
  if (t.covering === 'fur') out.push('Pelz');
  if (t.covering === 'scales') out.push('Schuppen');
  if (t.covering === 'feathers') out.push('Feder');
  if (t.covering === 'crystal') out.push('Kristall');
  if (t.covering === 'bioluminescent') out.push('Leucht');
  if (genome.pattern === 'stripes') out.push('Streifen');
  if (genome.pattern === 'spots') out.push('Flecken');
  if (genome.pattern === 'rings') out.push('Ring');
  if (t.headType === 'crest') out.push('Kamm');
  if (t.headType === 'beak') out.push('Schnabel');
  if (t.headType === 'mandible') out.push('Zangen');
  if (t.tailType === 'fan') out.push('Fächer');
  if (t.tailType === 'club') out.push('Keulen');
  return out;
};

export function generateFauna(ctx: GenContext, count: number): { entries: ArchiveEntry[]; families: Family[] } {
  const { planet, system, names } = ctx;
  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  if (count <= 0) return { entries, families };

  const exotic = system.star.type === 'blue_dwarf' ? 0.8 : system.star.type === 'red_giant' ? 0.3 : 0.1;
  const locomotions = availableLocomotions(planet);
  const sizes = splitIntoFamilies(ctx.rng.fork('split'), count, 2, 6);
  let entryNo = 1;

  sizes.forEach((size, fi) => {
    const frng = ctx.rng.fork(`family:${fi}`);
    const locomotion = frng.weighted(
      locomotions.map((l) => ({ item: l, weight: l === 'land' ? 5.5 : l === 'water' ? 2.5 : 2 })),
    );
    const traits = makeFamilyTraits(frng, planet, locomotion, exotic);
    let pool = biomePoolFor(planet, locomotion);
    const caves = caveBiomes(planet);
    if (locomotion === 'land' && caves.length && frng.bool(0.12)) pool = caves;
    if (pool.length === 0) pool = planet.biomes;
    const familyBiomes = pickBiomes(frng, pool, 3);
    const genus = names.uniqueGenus(frng);
    const baseHue = frng.float(0, 360);
    const fam: Family = {
      id: familyId(planet, 'fauna', fi + 1),
      category: 'fauna',
      subcategory: locomotion,
      planetId: planet.id,
      name: genus,
      description: `Familie ${genus}: ${traits.sizeClass === 'tiny' || traits.sizeClass === 'small' ? 'kleine' : 'große'} ${
        locomotion === 'land' ? 'Landtiere' : locomotion === 'water' ? 'Wassertiere' : 'Flugtiere'
      } mit ${traits.legs} Beinen, ${traits.covering === 'fur' ? 'Fell' : traits.covering === 'chitin' ? 'Chitinpanzer' : 'charakteristischer Hautstruktur'}; ${
        traits.diet === 'carnivore' ? 'Jäger' : traits.diet === 'herbivore' ? 'Pflanzenfresser' : 'Allesfresser'
      }.`,
      traits,
      memberIds: [],
    };
    families.push(fam);

    for (let si = 0; si < size; si++) {
      const rng = frng.fork(`species:${si}`);
      const rarity = rollRarity(rng, ctx.difficulty);
      const [lo, hi] = SIZE_RANGES[traits.sizeClass];
      const lengthM = round(rng.float(lo, hi) * (locomotion === 'water' && traits.sizeClass === 'huge' ? rng.float(1, 1.8) : 1), 2);
      const hue = rng.bool(0.6) ? (baseHue + rng.float(-25, 25) + 360) % 360 : rng.float(0, 360);
      const lightness = rng.float(0.25, 0.75);
      const saturation = rng.float(0.3, 0.9);
      const pattern = rng.weighted<Pattern>([
        { item: 'none', weight: 3 },
        { item: 'stripes', weight: 2 },
        { item: 'spots', weight: 2 },
        { item: 'bands', weight: 1.2 },
        { item: 'mottled', weight: 1.5 },
        { item: 'gradient', weight: 1.2 },
        { item: 'rings', weight: 0.8 },
      ]);
      const genome: FaunaGenome = {
        kind: 'fauna',
        locomotion,
        legs: traits.legs,
        wings: traits.wings,
        fins: traits.fins,
        bodyShape: traits.bodyShape,
        headType: traits.headType,
        tailType: traits.tailType,
        covering: traits.covering,
        lengthM,
        hue: round(hue, 1),
        hue2: round((hue + rng.float(90, 270)) % 360, 1),
        saturation: round(saturation, 2),
        lightness: round(lightness, 2),
        pattern,
        patternScale: round(rng.float(0.3, 2), 2),
        eyeCount: rng.weighted([{ item: 2, weight: 7 }, { item: 4, weight: 1.5 }, { item: 1, weight: 0.5 }, { item: 6, weight: 0.5 + exotic }]),
        extras: rng.bool(0.45) ? rng.sample(EXTRAS, rng.int(1, 2)) : [],
        speed: round(rng.float(0.2, 1), 2),
        shyness: round(traits.temperament === 'shy' ? rng.float(0.6, 1) : traits.temperament === 'aggressive' ? rng.float(0, 0.3) : rng.float(0.2, 0.7), 2),
      };
      const biomes = si === 0 ? familyBiomes : pickBiomes(rng, familyBiomes, 2);
      const spawn = makeSpawn(rng, planet, biomes, rarity, { activity: traits.activity, locomotion });
      const behaviors = rng.sample(traits.behaviorPool, rng.int(2, Math.min(4, traits.behaviorPool.length)));
      const hints = rng.sample(traits.hintPool, rng.int(1, Math.min(3, traits.hintPool.length)));
      if (rarity === 'rare' || rarity === 'legendary') hints.push('logbook_rumor');

      const cPrefix = colorPrefix(genome.hue, genome.lightness, genome.saturation);
      const prefixOptions: Array<{ item: string; weight: number }> = [
        ...biomes.flatMap((b) => BIOMES[b.kind].prefixes.map((p) => ({ item: p, weight: 1.2 }))),
        { item: cPrefix, weight: 1.5 },
        ...SIZE_PREFIX[traits.sizeClass].filter(Boolean).map((p) => ({ item: p, weight: 0.8 })),
        ...ACTIVITY_PREFIX[traits.activity].map((p) => ({ item: p, weight: 0.6 })),
        ...TRAIT_PREFIXES(traits, genome).map((p) => ({ item: p, weight: 1 })),
      ];
      const name = names.unique(() => compoundName(rng.weighted(prefixOptions), rng.pick(traits.nounPool)));
      const latinName = uniqueLatin(names, rng, genus, {
        colorPrefix: cPrefix,
        sizeClass: traits.sizeClass,
        activity: traits.activity,
        biomeKind: biomes[0]?.kind,
      });
      const id = entryId(planet, 'fauna', entryNo++);
      const entry: ArchiveEntry = {
        id,
        category: 'fauna',
        subcategory: locomotion,
        familyId: fam.id,
        name,
        latinName,
        planetId: planet.id,
        biomeIds: biomes.map((b) => b.id),
        rarity,
        description: describeFauna(rng, planet, biomes, traits, genome, rarity, spawn, behaviors),
        spawn,
        behaviors,
        hints,
        captureMethod: 'photo',
        genome,
      };
      fam.memberIds.push(id);
      entries.push(entry);
    }
  });
  return { entries, families };
}
