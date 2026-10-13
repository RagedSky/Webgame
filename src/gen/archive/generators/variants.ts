/** Varianten und Mutationen: Farbvarianten, Albinos, Riesen-/Zwergformen, Jugend-/Altersstadien, Nachtformen. */
import { round } from '@/math/utils';
import { WEATHER } from '../../universe/catalog';
import { describeVariant } from '../descriptions';
import type { ArchiveEntry, Family, FaunaGenome, FloraGenome, Rarity, SpawnConditions } from '../types';
import { entryId, rollRarity, type GenContext } from './common';

interface VariantDef {
  kind: string;
  prefix: string;
  label: string;
  epithet: string;
  for: Array<'fauna' | 'flora'>;
  weight: number;
}

const VARIANTS: VariantDef[] = [
  { kind: 'albino', prefix: 'Albino', label: 'Albino-Form', epithet: 'albina', for: ['fauna'], weight: 2 },
  { kind: 'melanistic', prefix: 'Schatten', label: 'Melanistische Form', epithet: 'nigra', for: ['fauna'], weight: 1.5 },
  { kind: 'giant', prefix: 'Riesen', label: 'Riesenform', epithet: 'gigantea', for: ['fauna', 'flora'], weight: 2 },
  { kind: 'dwarf', prefix: 'Zwerg', label: 'Zwergform', epithet: 'minor', for: ['fauna', 'flora'], weight: 1.5 },
  { kind: 'juvenile', prefix: 'Jung', label: 'Jugendstadium', epithet: 'juvenilis', for: ['fauna'], weight: 2 },
  { kind: 'elder', prefix: 'Alt', label: 'Altersstadium', epithet: 'senex', for: ['fauna'], weight: 1.2 },
  { kind: 'nocturnal_form', prefix: 'Nacht', label: 'Nachtform', epithet: 'nocturna', for: ['fauna', 'flora'], weight: 1.5 },
  { kind: 'luminescent', prefix: 'Leucht', label: 'Leuchtende Mutation', epithet: 'lucens', for: ['fauna', 'flora'], weight: 1.2 },
  { kind: 'color_morph', prefix: 'Bunt', label: 'Farbvariante', epithet: 'varia', for: ['fauna', 'flora'], weight: 2 },
  { kind: 'ancient', prefix: 'Ur', label: 'Uralte Form', epithet: 'antiqua', for: ['flora'], weight: 1.5 },
];

function applyVariant(kind: string, base: FaunaGenome | FloraGenome, rng: { float: (a: number, b: number) => number }): FaunaGenome | FloraGenome {
  const g = structuredClone(base);
  if (g.kind === 'fauna') {
    switch (kind) {
      case 'albino':
        g.lightness = 0.92;
        g.saturation = 0.05;
        g.pattern = 'none';
        break;
      case 'melanistic':
        g.lightness = 0.12;
        g.saturation = 0.2;
        break;
      case 'giant':
        g.lengthM = round(g.lengthM * rng.float(1.8, 2.6), 2);
        break;
      case 'dwarf':
        g.lengthM = round(g.lengthM * rng.float(0.35, 0.55), 2);
        break;
      case 'juvenile':
        g.lengthM = round(g.lengthM * rng.float(0.3, 0.5), 2);
        g.pattern = 'spots';
        break;
      case 'elder':
        g.lengthM = round(g.lengthM * rng.float(1.1, 1.3), 2);
        g.saturation = round(g.saturation * 0.6, 2);
        g.extras = [...g.extras, 'Narben'];
        break;
      case 'nocturnal_form':
        g.lightness = round(Math.max(0.15, g.lightness - 0.25), 2);
        g.hue = round((g.hue + 180) % 360, 1);
        break;
      case 'luminescent':
        g.covering = 'bioluminescent';
        break;
      case 'color_morph':
        g.hue = round((g.hue + rng.float(60, 300)) % 360, 1);
        g.saturation = round(Math.min(1, g.saturation + 0.2), 2);
        break;
    }
  } else {
    switch (kind) {
      case 'giant':
        g.heightM = round(g.heightM * rng.float(1.8, 3), 2);
        break;
      case 'dwarf':
        g.heightM = round(g.heightM * rng.float(0.3, 0.5), 2);
        break;
      case 'nocturnal_form':
        g.bloomTime = 'night';
        g.glow = round(Math.max(g.glow, 0.5), 2);
        break;
      case 'luminescent':
        g.glow = 1;
        break;
      case 'color_morph':
        g.leafHue = round((g.leafHue + rng.float(60, 300)) % 360, 1);
        g.flowerHue = round((g.flowerHue + rng.float(60, 300)) % 360, 1);
        break;
      case 'ancient':
        g.heightM = round(g.heightM * rng.float(1.5, 2.2), 2);
        g.branching = round(Math.min(1, g.branching + 0.3), 2);
        break;
    }
  }
  return g;
}

export function generateVariants(ctx: GenContext, count: number, bases: ArchiveEntry[], familiesById: Map<string, Family>): ArchiveEntry[] {
  const { planet, names } = ctx;
  const entries: ArchiveEntry[] = [];
  if (count <= 0 || bases.length === 0) return entries;
  const rng = ctx.rng.fork('variants');
  const preferred = bases.filter((b) => b.rarity === 'common' || b.rarity === 'uncommon');
  const pool = preferred.length >= count ? preferred : bases;
  const chosen = rng.sample(pool, Math.min(count, pool.length));
  let entryNo = 1;

  for (const base of chosen) {
    const vrng = rng.fork(`variant:${base.id}`);
    const def = vrng.weighted(VARIANTS.filter((v) => v.for.includes(base.category as 'fauna' | 'flora')).map((v) => ({ item: v, weight: v.weight })));
    let rarity: Rarity = vrng.weighted<Rarity>([
      { item: 'uncommon', weight: 30 },
      { item: 'rare', weight: 50 },
      { item: 'legendary', weight: 20 },
    ]);
    if (rollRarity(vrng, ctx.difficulty) === 'legendary') rarity = 'legendary';
    const genome = applyVariant(def.kind, base.genome as FaunaGenome | FloraGenome, vrng);
    const spawn: SpawnConditions = structuredClone(base.spawn);
    if (def.kind === 'nocturnal_form' || def.kind === 'luminescent') spawn.timeOfDay = 'night';
    if (rarity === 'legendary' && spawn.weather === 'any' && planet.weather.length > 1) {
      const candidates = planet.weather.filter((w) => w !== 'clear');
      if (candidates.length) spawn.weather = [vrng.weighted(candidates.map((w) => ({ item: w, weight: WEATHER[w].hazardous ? 2 : 1 })))];
    }
    const name = names.unique(() => `${def.prefix}-${base.name}`);
    const latinName = names.unique(() => `${base.latinName} var. ${def.epithet}`);
    const id = entryId(planet, 'variant', entryNo++);
    const fam = familiesById.get(base.familyId);
    fam?.memberIds.push(id);
    entries.push({
      id,
      category: 'variant',
      subcategory: def.kind,
      familyId: base.familyId,
      name,
      latinName,
      planetId: planet.id,
      biomeIds: [...base.biomeIds],
      rarity,
      description: describeVariant(base.name, def.label, rarity, spawn),
      spawn,
      behaviors: base.behaviors.slice(0, 2),
      hints: [...new Set([...base.hints, 'logbook_rumor' as const])],
      captureMethod: base.captureMethod,
      genome,
      baseEntryId: base.id,
      variantKind: def.kind,
    });
  }
  return entries;
}
