/** Erze/Minerale (Kategorie ore) und Gesteine/Kristalle (Kategorie rock): Probenentnahme und Analyse. */
import type { Random } from '@/math/Random';
import { round } from '@/math/utils';
import { BIOMES, RESOURCES } from '../../universe/catalog';
import type { Planet, ResourceId } from '../../universe/types';
import { describeMineral } from '../descriptions';
import { colorPrefix, compoundName } from '../names';
import { makeSpawn } from '../spawn';
import type { ArchiveEntry, Category, Family, MineralFamilyTraits, MineralForm, MineralGenome } from '../types';
import { caveBiomes, entryId, familyId, landBiomes, pickBiomes, rollRarity, splitIntoFamilies, type GenContext } from './common';

interface GroupDef {
  id: string;
  label: string;
  nouns: string[];
  forms: MineralForm[];
  hueRange: [number, number];
  luster: MineralGenome['luster'][];
  magnetic: number;
  glow: number;
  /** Rohstoffe, auf die diese Gruppe verweisen kann. */
  resources: ResourceId[];
}

const ORE_GROUPS: GroupDef[] = [
  { id: 'iron', label: 'Eisenerz', nouns: ['erz', 'ader', 'kies', 'glanz'], forms: ['vein', 'nodule', 'outcrop', 'layer'], hueRange: [10, 40], luster: ['dull', 'metallic'], magnetic: 0.7, glow: 0, resources: ['ferrite', 'cobaltite'] },
  { id: 'copper', label: 'Buntmetallerz', nouns: ['erz', 'ader', 'kies', 'blüte'], forms: ['vein', 'nodule', 'outcrop'], hueRange: [140, 210], luster: ['metallic', 'glassy'], magnetic: 0.1, glow: 0.1, resources: ['cuprite', 'titanite'] },
  { id: 'noble', label: 'Edelmetall', nouns: ['ader', 'flitter', 'nugget', 'seife'], forms: ['vein', 'placer', 'nodule'], hueRange: [40, 60], luster: ['metallic'], magnetic: 0, glow: 0, resources: ['aurum'] },
  { id: 'crystal', label: 'Kristall', nouns: ['kristall', 'druse', 'spat', 'prisma'], forms: ['geode', 'crystal_cluster', 'vein'], hueRange: [0, 360], luster: ['glassy', 'adamantine', 'pearly'], magnetic: 0, glow: 0.5, resources: ['quartz', 'lumite'] },
  { id: 'radioactive', label: 'Radioaktives Erz', nouns: ['blende', 'pechblende', 'glimmer'], forms: ['vein', 'nodule', 'layer'], hueRange: [60, 110], luster: ['dull', 'glassy'], magnetic: 0.1, glow: 0.9, resources: ['uranite'] },
  { id: 'salt', label: 'Salzmineral', nouns: ['salz', 'kruste', 'blüte', 'spat'], forms: ['layer', 'crystal_cluster', 'outcrop'], hueRange: [0, 60], luster: ['glassy', 'pearly', 'dull'], magnetic: 0, glow: 0.2, resources: ['saltpeter', 'perchlorate', 'brine'] },
  { id: 'sulfide', label: 'Sulfidmineral', nouns: ['kies', 'glanz', 'blende'], forms: ['vein', 'nodule', 'crystal_cluster'], hueRange: [40, 70], luster: ['metallic', 'adamantine'], magnetic: 0.2, glow: 0.1, resources: ['sulfur', 'phosphor'] },
];

const ROCK_GROUPS: GroupDef[] = [
  { id: 'igneous', label: 'Magmatisches Gestein', nouns: ['basalt', 'granit', 'tuff', 'bims', 'porphyr'], forms: ['boulder', 'outcrop', 'layer'], hueRange: [0, 40], luster: ['dull'], magnetic: 0.2, glow: 0, resources: ['obsidian'] },
  { id: 'sedimentary', label: 'Sedimentgestein', nouns: ['sandstein', 'kalk', 'schiefer', 'konglomerat', 'mergel'], forms: ['layer', 'outcrop', 'boulder'], hueRange: [20, 60], luster: ['dull'], magnetic: 0, glow: 0, resources: ['silica', 'carbon'] },
  { id: 'metamorphic', label: 'Metamorphes Gestein', nouns: ['gneis', 'marmor', 'quarzit', 'schiefer'], forms: ['outcrop', 'boulder', 'layer'], hueRange: [0, 360], luster: ['dull', 'pearly'], magnetic: 0.1, glow: 0, resources: [] },
  { id: 'crystal', label: 'Kristallgestein', nouns: ['kristall', 'geode', 'spat', 'glas'], forms: ['geode', 'crystal_cluster', 'boulder'], hueRange: [0, 360], luster: ['glassy', 'adamantine'], magnetic: 0, glow: 0.4, resources: ['quartz'] },
  { id: 'impact', label: 'Impaktgestein', nouns: ['tektit', 'brekzie', 'schmelzglas', 'sphärule'], forms: ['boulder', 'nodule', 'outcrop'], hueRange: [0, 40], luster: ['glassy', 'dull'], magnetic: 0.4, glow: 0.1, resources: [] },
  { id: 'ice', label: 'Eisgestein', nouns: ['eisgestein', 'firn', 'klareis', 'frostglas'], forms: ['layer', 'boulder', 'crystal_cluster'], hueRange: [180, 220], luster: ['glassy', 'pearly'], magnetic: 0, glow: 0.2, resources: ['ice', 'peroxide_ice'] },
];

function groupsFor(category: 'ore' | 'rock', planet: Planet): GroupDef[] {
  const groups = category === 'ore' ? ORE_GROUPS : ROCK_GROUPS;
  const present = new Set(planet.resources.map((r) => r.resourceId));
  return groups.filter((g) => {
    if (g.id === 'ice') return planet.type === 'ice' || planet.type === 'tundra';
    if (g.id === 'impact') return planet.type === 'barren' || planet.type === 'rocky' || planet.type === 'desert' || planet.type === 'ice';
    if (g.id === 'radioactive') return present.has('uranite') || planet.type === 'barren' || planet.type === 'volcanic';
    if (g.id === 'noble') return present.has('aurum') || planet.type === 'volcanic' || planet.type === 'rocky';
    return true;
  });
}

function altitudeForForm(rng: Random, form: MineralForm): [number, number] | null {
  switch (form) {
    case 'placer':
      return [0, 0.3];
    case 'vein':
    case 'outcrop':
      return rng.bool(0.5) ? [0.4, 1] : null;
    default:
      return null;
  }
}

export function generateMinerals(ctx: GenContext, category: 'ore' | 'rock', count: number): { entries: ArchiveEntry[]; families: Family[] } {
  const { planet, names } = ctx;
  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  if (count <= 0) return { entries, families };
  const groups = groupsFor(category, planet);
  const present = new Set(planet.resources.map((r) => r.resourceId));
  const sizes = splitIntoFamilies(ctx.rng.fork('split'), count, 2, 5);
  let entryNo = 1;

  sizes.forEach((size, fi) => {
    const frng = ctx.rng.fork(`family:${fi}`);
    const group = frng.weighted(groups.map((g) => ({ item: g, weight: g.resources.some((r) => present.has(r)) ? 2 : 1 })));
    const traits: MineralFamilyTraits = { kind: 'mineral', group: group.id, forms: group.forms, nounPool: group.nouns };
    const land = landBiomes(planet).length ? landBiomes(planet) : planet.biomes;
    const caves = caveBiomes(planet);
    const familyBiomes = pickBiomes(frng, frng.bool(0.25) && caves.length ? caves : land, 3);
    const familyName = `${group.label}-Gruppe ${fi + 1}`;
    const linked = group.resources.filter((r) => present.has(r));
    const fam: Family = {
      id: familyId(planet, category, fi + 1),
      category,
      subcategory: group.id,
      planetId: planet.id,
      name: familyName,
      description: `${group.label} auf ${planet.name}${linked.length ? `, verweist auf ${linked.map((r) => RESOURCES[r].name).join(', ')}` : ''}.`,
      traits,
      memberIds: [],
    };
    families.push(fam);

    for (let si = 0; si < size; si++) {
      const rng = frng.fork(`species:${si}`);
      const rarity = rollRarity(rng, ctx.difficulty);
      const form = rng.pick(group.forms);
      const hue = rng.float(group.hueRange[0], group.hueRange[1]);
      const resourceId = linked.length && rng.bool(0.5) ? rng.pick(linked) : undefined;
      const genome: MineralGenome = {
        kind: 'mineral',
        form,
        hue: round(hue, 1),
        saturation: round(rng.float(0.1, 0.9), 2),
        luster: rng.pick(group.luster),
        sizeM: round(form === 'boulder' ? rng.float(0.5, 6) : form === 'geode' ? rng.float(0.1, 1.2) : rng.float(0.2, 3), 2),
        glow: round(rng.bool(group.glow) ? rng.float(0.4, 1) : rng.float(0, 0.3), 2),
        magnetic: rng.bool(group.magnetic),
        ...(resourceId ? { resourceId } : {}),
      };
      const biomes = si === 0 ? familyBiomes : pickBiomes(rng, familyBiomes, 2);
      const spawn = makeSpawn(rng, planet, biomes, rarity, { allowSpecial: ['cave', 'after_storm'] });
      spawn.timeOfDay = 'any';
      const alt = altitudeForForm(rng, form);
      if (alt && rarity !== 'legendary') spawn.altitude = alt;
      const cPrefix = colorPrefix(genome.hue, genome.luster === 'metallic' ? 0.5 : 0.6, genome.saturation);
      const prefixOptions = [
        ...biomes.flatMap((b) => BIOMES[b.kind].prefixes.map((p) => ({ item: p, weight: 1 }))),
        { item: cPrefix, weight: 2 },
        { item: genome.luster === 'metallic' ? 'Glanz' : genome.luster === 'adamantine' ? 'Funkel' : genome.luster === 'pearly' ? 'Perl' : 'Matt', weight: 1 },
        { item: genome.magnetic ? 'Magnet' : '', weight: 1 },
        { item: genome.glow > 0.4 ? 'Leucht' : '', weight: 1 },
        { item: resourceId ? RESOURCES[resourceId].name.split('-')[0]! : '', weight: 1.5 },
      ].filter((o) => o.item !== '');
      const name = names.unique(() => compoundName(rng.weighted(prefixOptions), rng.pick(group.nouns)));
      const latinName = names.unique(() => `${group.label.split(' ')[0]} ${rng.pick(['typus', 'variabilis', 'densus', 'purus', 'mixtus', 'nitens', 'rudis', 'nobilis', 'fragilis', 'durus'])} ${planet.name.slice(0, 3)}-${rng.int(10, 99)}`);
      const id = entryId(planet, category as Category, entryNo++);
      entries.push({
        id,
        category,
        subcategory: group.id,
        familyId: fam.id,
        name,
        latinName,
        planetId: planet.id,
        biomeIds: biomes.map((b) => b.id),
        rarity,
        description: describeMineral(planet, biomes, genome, rarity, spawn, group.label),
        spawn,
        behaviors: [],
        hints: genome.magnetic ? ['magnetic_anomaly', 'scanner_ping'] : genome.glow > 0.4 ? ['glint'] : ['scanner_ping'],
        captureMethod: 'sample',
        genome,
      });
      fam.memberIds.push(id);
    }
  });
  return { entries, families };
}
