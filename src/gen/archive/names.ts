/**
 * Namensgenerierung für Archiv-Einträge: deutsche Trivialnamen (Präfix + Grundwort),
 * pseudo-lateinische Gattungs-/Artnamen und eine Registry für Eindeutigkeit pro System.
 */
import type { Random } from '@/math/Random';
import { capitalize, toRoman } from '@/math/utils';
import { syllableWord } from '../universe/names';
import type { Activity, SizeClass } from './types';

export class NameRegistry {
  private readonly used = new Set<string>();
  private readonly genera = new Set<string>();

  /** Ruft `make` bis zu 8-mal auf, bis ein unbenutzter Name entsteht; danach römische Suffixe. */
  unique(make: () => string): string {
    let candidate = make();
    for (let i = 0; i < 8 && this.used.has(candidate); i++) candidate = make();
    if (this.used.has(candidate)) {
      const base = candidate;
      for (let n = 2; ; n++) {
        candidate = `${base} ${toRoman(n)}`;
        if (!this.used.has(candidate)) break;
      }
    }
    this.used.add(candidate);
    return candidate;
  }

  uniqueGenus(rng: Random): string {
    let g = syllableWord(rng, rng.int(2, 3));
    for (let i = 0; i < 10 && this.genera.has(g); i++) g = syllableWord(rng, rng.int(2, 3));
    if (this.genera.has(g)) g = `${g}${toRoman(this.genera.size)}`;
    this.genera.add(g);
    return g;
  }

  has(name: string): boolean {
    return this.used.has(name);
  }
}

/** Deutsches Kompositum: „Nebel“ + „Schleicher“ → „Nebelschleicher“; mit Bindestrich bei Mehrwortteilen. */
export function compoundName(prefix: string, noun: string): string {
  if (!prefix) return capitalize(noun);
  if (prefix.includes(' ') || noun.includes(' ') || prefix.endsWith('-')) return `${prefix.replace(/-$/, '')}-${capitalize(noun)}`;
  return capitalize(prefix) + noun.toLowerCase();
}

export function colorPrefix(hue: number, lightness: number, saturation = 0.6): string {
  if (lightness < 0.2) return 'Schatten';
  if (lightness > 0.82) return 'Silber';
  if (saturation < 0.18) return 'Grau';
  const h = ((hue % 360) + 360) % 360;
  if (h < 18 || h >= 342) return 'Rot';
  if (h < 42) return 'Bernstein';
  if (h < 68) return 'Gold';
  if (h < 160) return 'Grün';
  if (h < 200) return 'Türkis';
  if (h < 262) return 'Blau';
  if (h < 300) return 'Violett';
  return 'Rosen';
}

export const SIZE_PREFIX: Record<SizeClass, string[]> = {
  tiny: ['Zwerg', 'Mini', 'Kleinst'],
  small: ['Klein', 'Zwerg'],
  medium: ['', ''],
  large: ['Groß', 'Riesen'],
  huge: ['Riesen', 'Koloss'],
};

export const ACTIVITY_PREFIX: Record<Activity, string[]> = {
  diurnal: ['Sonnen', 'Tag'],
  nocturnal: ['Nacht', 'Mond', 'Dunkel'],
  crepuscular: ['Dämmer', 'Abend', 'Morgen'],
  cathemeral: ['Wander', 'Streif'],
};

const EPITHETS_GENERIC = [
  'vulgaris', 'mirabilis', 'velox', 'tarda', 'rex', 'minor', 'major', 'stellaris', 'umbra', 'serena',
  'ferox', 'placida', 'vagans', 'tenax', 'levis', 'gravis', 'spectabilis', 'obscura', 'clara', 'acuta',
  'rotunda', 'longa', 'brevis', 'aspera', 'mollis', 'cristata', 'cornuta', 'squamata', 'pilosa', 'nuda',
  'bicolor', 'tricolor', 'picta', 'striata', 'maculata', 'annulata', 'radians', 'fulgens', 'lucens', 'tacita',
];

const EPITHETS_COLOR: Record<string, string[]> = {
  Rot: ['rubra', 'ignea', 'sanguinea'],
  Bernstein: ['succinea', 'fulva'],
  Gold: ['aurata', 'flava', 'lutea'],
  Grün: ['viridis', 'smaragdina', 'olivacea'],
  Türkis: ['cyanea', 'glauca'],
  Blau: ['caerulea', 'azurea', 'cobaltina'],
  Violett: ['violacea', 'purpurea'],
  Rosen: ['rosea', 'carnea'],
  Schatten: ['nigra', 'atra', 'umbrosa'],
  Silber: ['argentea', 'alba', 'candida'],
  Grau: ['cinerea', 'grisea'],
};

const EPITHETS_SIZE: Record<SizeClass, string[]> = {
  tiny: ['minima', 'pusilla', 'nana'],
  small: ['minor', 'parva'],
  medium: ['media', 'communis'],
  large: ['magna', 'major', 'grandis'],
  huge: ['gigantea', 'colossea', 'titanica'],
};

const EPITHETS_ACTIVITY: Record<Activity, string[]> = {
  diurnal: ['diurna', 'solaris'],
  nocturnal: ['nocturna', 'lunaris', 'noctivaga'],
  crepuscular: ['crepuscularis', 'vespertina'],
  cathemeral: ['vagans', 'errans'],
};

export const EPITHETS_BIOME: Record<string, string[]> = {
  highlands: ['montana', 'altitudinis'], steppe: ['campestris', 'pratensis'], scree: ['saxatilis'], canyons: ['rupestris'],
  coastal_plain: ['litoralis'], mountains: ['alpina', 'nivalis'], crystal_caverns: ['cavernae', 'speluncae'],
  shallow_sea: ['marina', 'litoralis'], deep_sea: ['abyssalis', 'profunda'], reef: ['corallina'], island_coast: ['insularis'],
  archipelago: ['insularis'], kelp_forest: ['algarum'], dune_sea: ['arenaria', 'deserti'], salt_flat: ['salina'],
  rock_desert: ['petraea'], oasis: ['fontana'], mesas: ['tabularis'], glacier: ['glacialis'], ice_plain: ['nivea'],
  frost_forest: ['pruinosa'], ice_caves: ['cryptica'], snow_mountains: ['nivalis'], cloud_forest: ['nebulosa'],
  swamp: ['palustris'], fern_forest: ['silvestris', 'filicum'], river_delta: ['fluvialis'], fungal_grove: ['fungorum'],
  lava_fields: ['ignea', 'vulcanica'], ash_desert: ['cinerea'], sulfur_springs: ['sulphurea'], obsidian_ridge: ['vitrea'],
  basalt_plateau: ['basaltica'], lava_tubes: ['cavernae'], tundra: ['borealis'], lichen_heath: ['lichenum'],
  permafrost_bog: ['paludosa'], krummholz: ['ventosa'], fjord_coast: ['fjordica'], acid_marsh: ['acida'],
  methane_lakes: ['methanica'], crystal_fields: ['crystallina'], slag_plain: ['scoriae'], crater_plain: ['crateris'],
  regolith_desert: ['pulveris'], rift_fields: ['fissurae'], basalt_desert: ['basaltica'], upper_clouds: ['nubium'],
  storm_band: ['tempestatis'], ammonia_layer: ['ammoniaca'], cloud_crowns: ['aetheris'],
};

export interface EpithetHints {
  colorPrefix?: string;
  sizeClass?: SizeClass;
  activity?: Activity;
  biomeKind?: string;
}

export function latinEpithet(rng: Random, hints: EpithetHints = {}): string {
  const pools: Array<{ item: string[]; weight: number }> = [{ item: EPITHETS_GENERIC, weight: 3 }];
  if (hints.colorPrefix && EPITHETS_COLOR[hints.colorPrefix]) pools.push({ item: EPITHETS_COLOR[hints.colorPrefix]!, weight: 2 });
  if (hints.sizeClass) pools.push({ item: EPITHETS_SIZE[hints.sizeClass], weight: 1.5 });
  if (hints.activity) pools.push({ item: EPITHETS_ACTIVITY[hints.activity], weight: 1.5 });
  if (hints.biomeKind && EPITHETS_BIOME[hints.biomeKind]) pools.push({ item: EPITHETS_BIOME[hints.biomeKind]!, weight: 2 });
  return rng.pick(rng.weighted(pools));
}

/** Eindeutiger Artname „Gattung epitheton“ innerhalb der Gattung. */
export function uniqueLatin(registry: NameRegistry, rng: Random, genus: string, hints: EpithetHints): string {
  return registry.unique(() => `${genus} ${latinEpithet(rng, hints)}`);
}
