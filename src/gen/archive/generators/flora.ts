/** Flora: Wuchsformen nach Planetentyp, Familien mit Blattform/Höhe, Arten mit Farben und Blühverhalten. */
import type { Random } from '@/math/Random';
import { round } from '@/math/utils';
import { BIOMES } from '../../universe/catalog';
import type { Biome, Planet, PlanetType } from '../../universe/types';
import { describeFlora } from '../descriptions';
import { colorPrefix, compoundName, uniqueLatin } from '../names';
import { makeSpawn } from '../spawn';
import type { ArchiveEntry, Family, FloraFamilyTraits, FloraForm, FloraGenome, LeafShape, TimeOfDay } from '../types';
import { caveBiomes, entryId, familyId, landBiomes, pickBiomes, rollRarity, splitIntoFamilies, waterBiomes, type GenContext } from './common';

const FORM_WEIGHTS: Record<PlanetType, Partial<Record<FloraForm, number>>> = {
  rocky: { tree: 3, shrub: 3, grass: 3, vine: 1, fungus: 1, lichen: 1, succulent: 1 },
  ocean: { aquatic: 5, grass: 1, tree: 1, shrub: 1 },
  desert: { succulent: 4, shrub: 2, grass: 1, tree: 0.5, lichen: 0.5, crystal_plant: 0.3 },
  ice: { lichen: 3, crystal_plant: 2, fungus: 1, shrub: 0.5, grass: 0.5 },
  jungle: { tree: 4, vine: 3, fungus: 2, shrub: 2, grass: 1, aquatic: 1 },
  volcanic: { lichen: 2, crystal_plant: 2, fungus: 1, shrub: 0.5, succulent: 1 },
  tundra: { lichen: 3, grass: 2, shrub: 2, tree: 1, fungus: 1 },
  toxic: { fungus: 3, crystal_plant: 3, lichen: 1, aquatic: 1, shrub: 1 },
  barren: { lichen: 3, crystal_plant: 2 },
  gas_giant: {},
};

const NOUNS: Record<FloraForm, string[]> = {
  tree: ['Baum', 'Riese', 'Säule', 'Schirm', 'Wipfel', 'Stamm'],
  shrub: ['Busch', 'Strauch', 'Gestrüpp', 'Dorn', 'Hecke'],
  grass: ['Gras', 'Halm', 'Ried', 'Schilf', 'Binse'],
  fungus: ['Pilz', 'Schirmling', 'Lamelle', 'Knolle', 'Bovist'],
  aquatic: ['Tang', 'Alge', 'Seelilie', 'Schwimmblatt', 'Wasserfarn'],
  succulent: ['Kaktus', 'Knolle', 'Säule', 'Wasserspeicher', 'Dickblatt'],
  lichen: ['Flechte', 'Moos', 'Kruste', 'Polster'],
  vine: ['Ranke', 'Liane', 'Schlinge', 'Kletterer'],
  crystal_plant: ['Kristallblüte', 'Splitterstaude', 'Glasfarn', 'Prismenhalm'],
};

const LEAVES: Record<FloraForm, LeafShape[]> = {
  tree: ['broad', 'needle', 'frond', 'lobed'],
  shrub: ['broad', 'needle', 'lobed', 'blade'],
  grass: ['blade'],
  fungus: ['cap'],
  aquatic: ['frond', 'blade', 'pad'],
  succulent: ['pad', 'none'],
  lichen: ['none'],
  vine: ['broad', 'lobed'],
  crystal_plant: ['none', 'blade'],
};

const HEIGHTS: Record<FloraForm, [number, number]> = {
  tree: [4, 40],
  shrub: [0.5, 3],
  grass: [0.1, 2],
  fungus: [0.1, 6],
  aquatic: [0.2, 15],
  succulent: [0.2, 5],
  lichen: [0.02, 0.3],
  vine: [2, 30],
  crystal_plant: [0.2, 4],
};

const BEHAVIORS: Record<FloraForm, string[]> = {
  tree: ['blooming', 'fruiting', 'seeding', 'swaying'],
  shrub: ['blooming', 'fruiting', 'closing_at_night'],
  grass: ['seeding', 'swaying', 'blooming'],
  fungus: ['sporing', 'glowing'],
  aquatic: ['blooming', 'swaying', 'glowing'],
  succulent: ['blooming', 'closing_at_night'],
  lichen: ['sporing', 'glowing'],
  vine: ['blooming', 'fruiting', 'closing_at_night'],
  crystal_plant: ['glowing', 'blooming'],
};

function biomePoolFor(planet: Planet, form: FloraForm, rng: Random): Biome[] {
  if (form === 'aquatic') return waterBiomes(planet);
  const caves = caveBiomes(planet);
  if ((form === 'fungus' || form === 'lichen' || form === 'crystal_plant') && caves.length && rng.bool(0.3)) return caves;
  const land = landBiomes(planet).filter((b) => !b.isCave);
  return land.length ? land : landBiomes(planet);
}

export function generateFlora(ctx: GenContext, count: number): { entries: ArchiveEntry[]; families: Family[] } {
  const { planet, names } = ctx;
  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  if (count <= 0) return { entries, families };

  const formWeights = Object.entries(FORM_WEIGHTS[planet.type]) as [FloraForm, number][];
  const usable = formWeights.filter(([form]) => form !== 'aquatic' || waterBiomes(planet).length > 0);
  const weighted = (usable.length ? usable : [['lichen', 1] as [FloraForm, number]]).map(([form, w]) => ({ item: form, weight: w }));
  const sizes = splitIntoFamilies(ctx.rng.fork('split'), count, 2, 6);
  let entryNo = 1;

  sizes.forEach((size, fi) => {
    const frng = ctx.rng.fork(`family:${fi}`);
    const form = frng.weighted(weighted);
    const [hLo, hHi] = HEIGHTS[form];
    const traits: FloraFamilyTraits = {
      kind: 'flora',
      form,
      leafShape: frng.pick(LEAVES[form]),
      heightRange: [round(hLo * frng.float(1, 1.5), 2), round(hHi * frng.float(0.5, 1), 2)],
      nounPool: frng.sample(NOUNS[form], 3),
    };
    let pool = biomePoolFor(planet, form, frng);
    if (pool.length === 0) pool = planet.biomes;
    const familyBiomes = pickBiomes(frng, pool, 3);
    const genus = names.uniqueGenus(frng);
    const baseLeafHue = form === 'crystal_plant' ? frng.float(180, 320) : frng.weighted([{ item: frng.float(70, 150), weight: 5 }, { item: frng.float(0, 360), weight: 2 }]);
    const fam: Family = {
      id: familyId(planet, 'flora', fi + 1),
      category: 'flora',
      subcategory: form,
      planetId: planet.id,
      name: genus,
      description: `Familie ${genus}: ${NOUNS[form][0]}-artige Gewächse, ${traits.heightRange[0]}–${traits.heightRange[1]} m hoch.`,
      traits,
      memberIds: [],
    };
    families.push(fam);

    for (let si = 0; si < size; si++) {
      const rng = frng.fork(`species:${si}`);
      const rarity = rollRarity(rng, ctx.difficulty);
      const glow = form === 'crystal_plant' || form === 'fungus' ? rng.float(0.2, 1) : rarity === 'legendary' ? rng.float(0.3, 0.9) : rng.float(0, 0.3);
      const bloomTime = rng.weighted<TimeOfDay>([
        { item: 'any', weight: 4 },
        { item: 'day', weight: 3 },
        { item: 'night', weight: rarity === 'common' ? 1 : 3 },
        { item: 'dawn', weight: 1 },
        { item: 'dusk', weight: 1 },
      ]);
      const genome: FloraGenome = {
        kind: 'flora',
        form,
        heightM: round(rng.float(traits.heightRange[0], traits.heightRange[1]), 2),
        trunkHue: round(rng.float(15, 50), 1),
        leafHue: round((baseLeafHue + rng.float(-20, 20) + 360) % 360, 1),
        flowerHue: round(rng.float(0, 360), 1),
        leafShape: traits.leafShape,
        branching: round(rng.float(0.2, 1), 2),
        density: round(rng.float(0.3, 1), 2),
        glow: round(glow, 2),
        bloomTime,
      };
      const biomes = si === 0 ? familyBiomes : pickBiomes(rng, familyBiomes, 2);
      const spawn = makeSpawn(rng, planet, biomes, rarity, { allowSpecial: ['cave', 'solstice', 'after_storm'] });
      if (bloomTime !== 'any' && rarity !== 'common' && rng.bool(0.5)) spawn.timeOfDay = bloomTime;
      const behaviors = rng.sample(BEHAVIORS[form], rng.int(1, 2));
      const cPrefix = colorPrefix(genome.form === 'crystal_plant' ? genome.leafHue : genome.flowerHue, 0.5, 0.7);
      const prefixOptions = [
        ...biomes.flatMap((b) => BIOMES[b.kind].prefixes.map((p) => ({ item: p, weight: 1.2 }))),
        { item: cPrefix, weight: 1.3 },
        { item: genome.heightM > 15 ? 'Riesen' : genome.heightM < 0.2 ? 'Zwerg' : '', weight: 0.8 },
        { item: glow > 0.5 ? 'Leucht' : '', weight: 1 },
        { item: bloomTime === 'night' ? 'Nacht' : bloomTime === 'dawn' ? 'Morgen' : '', weight: 0.8 },
        { item: rng.pick(['Dorn', 'Samt', 'Feder', 'Glas', 'Wind', 'Stern', 'Flammen', 'Schleier']), weight: 0.7 },
      ].filter((o) => o.item !== '');
      const name = names.unique(() => compoundName(rng.weighted(prefixOptions), rng.pick(traits.nounPool)));
      const latinName = uniqueLatin(names, rng, genus, { colorPrefix: cPrefix, biomeKind: biomes[0]?.kind });
      const id = entryId(planet, 'flora', entryNo++);
      entries.push({
        id,
        category: 'flora',
        subcategory: form,
        familyId: fam.id,
        name,
        latinName,
        planetId: planet.id,
        biomeIds: biomes.map((b) => b.id),
        rarity,
        description: describeFlora(rng, planet, biomes, genome, rarity, spawn, behaviors),
        spawn,
        behaviors,
        hints: rarity === 'common' ? ['seeds'] : rng.bool(0.5) ? ['seeds', 'scent'] : ['scent', 'logbook_rumor'],
        captureMethod: 'photo',
        genome,
      });
      fam.memberIds.push(id);
    }
  });
  return { entries, families };
}
