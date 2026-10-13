/** Fossilien (versteinerte Spuren) und Ruinen (Reste einer unbekannten Zivilisation, Wracks). */
import { round } from '@/math/utils';
import { BIOMES } from '../../universe/catalog';
import { describeFossil } from '../descriptions';
import { makeSpawn } from '../spawn';
import type { ArchiveEntry, Family, FossilFamilyTraits, FossilGenome, FossilKind, Rarity, RuinKind } from '../types';
import { caveBiomes, entryId, familyId, landBiomes, pickBiomes, rollRarity, splitIntoFamilies, type GenContext } from './common';

const FOSSIL_NOUNS: Record<FossilKind, string[]> = {
  shell: ['Muschelabdruck', 'Schalenfossil', 'Spiralgehäuse'],
  bone: ['Knochenplatte', 'Wirbelsäulenfossil', 'Schädelrest'],
  imprint: ['Farnabdruck', 'Flügelabdruck', 'Hautabdruck'],
  amber: ['Bernsteinklumpen', 'Harzeinschluss'],
  petrified_wood: ['Versteinerter Stamm', 'Kieselholz'],
  trace: ['Fährtenplatte', 'Grabgang', 'Kriechspur'],
  egg: ['Eiergelege', 'Nestfossil'],
};
const RUIN_NOUNS: Record<RuinKind, string[]> = {
  monolith: ['Monolith', 'Obelisk'],
  wall: ['Mauerrest', 'Torbogen', 'Fundament'],
  statue: ['Statue', 'Wächterfigur'],
  machine: ['Maschinenrest', 'Antriebsblock', 'Relaisturm'],
  glyph_stone: ['Glyphenstein', 'Schriftplatte'],
  wreck: ['Wrack', 'Landekapsel', 'Rumpfsegment'],
  beacon: ['Leuchtfeuer', 'Signalmast'],
};
const ADJ = ['Versunkener', 'Gespaltener', 'Überwucherter', 'Vergrabener', 'Verwitterter', 'Geborstener', 'Stiller', 'Vergessener', 'Halb freigelegter', 'Moosiger', 'Singender', 'Rostiger'];
const ADJ_F = ['Versunkene', 'Gespaltene', 'Überwucherte', 'Vergrabene', 'Verwitterte', 'Geborstene', 'Stille', 'Vergessene', 'Halb freigelegte', 'Moosige', 'Singende', 'Rostige'];
const ADJ_N = ['Versunkenes', 'Gespaltenes', 'Überwuchertes', 'Vergrabenes', 'Verwittertes', 'Geborstenes', 'Stilles', 'Vergessenes', 'Halb freigelegtes', 'Moosiges', 'Singendes', 'Rostiges'];

function article(noun: string): 'm' | 'f' | 'n' {
  if (/(platte|spur|figur|statue|kapsel|säule)$/i.test(noun)) return 'f';
  if (/(fossil|gehäuse|gelege|holz|segment|fundament|leuchtfeuer|wrack)$/i.test(noun)) return 'n';
  return 'm';
}

export function generateFossils(ctx: GenContext, count: number): { entries: ArchiveEntry[]; families: Family[] } {
  const { planet, names } = ctx;
  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  if (count <= 0) return { entries, families };
  const sizes = splitIntoFamilies(ctx.rng.fork('split'), count, 2, 5);
  let entryNo = 1;

  sizes.forEach((size, fi) => {
    const frng = ctx.rng.fork(`family:${fi}`);
    const isRuin = frng.bool(0.35);
    const fossilKind = frng.pick(Object.keys(FOSSIL_NOUNS) as FossilKind[]);
    const ruinKind = frng.pick(Object.keys(RUIN_NOUNS) as RuinKind[]);
    const nounPool = isRuin ? RUIN_NOUNS[ruinKind] : FOSSIL_NOUNS[fossilKind];
    const traits: FossilFamilyTraits = { kind: 'fossil', group: isRuin ? 'ruin' : 'fossil', nounPool };
    const land = landBiomes(planet).length ? landBiomes(planet) : planet.biomes;
    const caves = caveBiomes(planet);
    const familyBiomes = pickBiomes(frng, frng.bool(0.2) && caves.length ? caves : land, 3);
    const fam: Family = {
      id: familyId(planet, 'fossil', fi + 1),
      category: 'fossil',
      subcategory: isRuin ? 'ruin' : 'fossil',
      planetId: planet.id,
      name: isRuin ? `Ruinenfeld ${fi + 1}` : `Fossillager ${fi + 1}`,
      description: isRuin ? `Fundstellen einer vergangenen Zivilisation: ${nounPool[0]} und Verwandtes.` : `Fossilschicht mit ${nounPool[0]} und verwandten Funden.`,
      traits,
      memberIds: [],
    };
    families.push(fam);

    for (let si = 0; si < size; si++) {
      const rng = frng.fork(`species:${si}`);
      let rarity: Rarity = rollRarity(rng, ctx.difficulty);
      if (isRuin && rarity === 'common') rarity = 'uncommon';
      const sizeM = round(isRuin ? rng.float(1, 25) : rng.float(0.05, 4), 2);
      const genome: FossilGenome = {
        kind: 'fossil',
        ...(isRuin ? { ruinKind } : { fossilKind }),
        sizeM,
        hue: round(rng.float(15, 50), 1),
        erosion: round(rng.float(0, 1), 2),
      };
      const biomes = si === 0 ? familyBiomes : pickBiomes(rng, familyBiomes, 2);
      const spawn = makeSpawn(rng, planet, biomes, rarity, { allowSpecial: ['cave', 'after_storm', 'solstice'] });
      spawn.timeOfDay = rarity === 'legendary' && isRuin ? rng.pick(['night', 'dawn', 'dusk']) : 'any';
      const name = names.unique(() => {
        const noun = rng.pick(nounPool);
        const g = article(noun);
        const adjIdx = rng.int(0, ADJ.length - 1);
        const adj = g === 'f' ? ADJ_F[adjIdx] : g === 'n' ? ADJ_N[adjIdx] : ADJ[adjIdx];
        const biomePrefix = rng.bool(0.5) ? ` von ${biomes[0]?.name ?? planet.name}` : '';
        return `${adj} ${noun}${biomePrefix}`;
      });
      const latinName = names.unique(() => `${isRuin ? 'Reliquia' : 'Vestigium'} ${rng.pick(['antiqua', 'prisca', 'obscura', 'petrosa', 'perdita', 'tacita', 'rupta', 'sacra', 'ferrea', 'vitrea'])} ${planet.name.slice(0, 3)}-${rng.int(10, 99)}`);
      const id = entryId(planet, 'fossil', entryNo++);
      entries.push({
        id,
        category: 'fossil',
        subcategory: isRuin ? 'ruin' : 'fossil',
        familyId: fam.id,
        name,
        latinName,
        planetId: planet.id,
        biomeIds: biomes.map((b) => b.id),
        rarity,
        description: describeFossil(planet, biomes, isRuin, sizeM, rarity, spawn),
        spawn,
        behaviors: [],
        hints: isRuin ? ['terrain_anomaly', 'logbook_rumor'] : rarity === 'common' ? ['terrain_anomaly'] : ['terrain_anomaly', 'scanner_ping'],
        captureMethod: 'photo',
        genome,
      });
      fam.memberIds.push(id);
    }
  });
  const unused = BIOMES; // Katalog-Referenz, damit Biom-Namen im Import erhalten bleiben
  void unused;
  return { entries, families };
}
