/**
 * Ambient-Mischung (rein): leitet aus Biom, Tageszeit, Wetter und Spielerlage die Pegel der prozeduralen
 * Klangschichten ab (Wind, Wasser, Regen, Insekten/Nachtleben, Grundton, Lava). Alle Werte 0..1.
 */
import type { BiomeKind } from '@/gen/universe/types';
import type { PrecipitationKind } from '@/world/Weather';
import { clamp } from '@/math/utils';

export type FootSurface = 'rock' | 'sand' | 'grass' | 'snow' | 'water' | 'metal';

export interface AmbientInput {
  biomeKind: BiomeKind;
  biomeHasWater: boolean;
  isCave: boolean;
  /** Luftfeuchte des Bioms 0..1. */
  humidity: number;
  /** Tageslicht 0..1. */
  daylight: number;
  /** Wind 0..1 (Wetter). */
  wind: number;
  precipitation: PrecipitationKind;
  precipIntensity: number;
  underwater: boolean;
  /** Ufer in der Nähe (Spieler nahe am Meeresspiegel). */
  nearWater: boolean;
  breathable: boolean;
}

export interface AmbientMix {
  wind: number;
  water: number;
  rain: number;
  insects: number;
  drone: number;
  lava: number;
}

const OPEN_PLAINS = new Set<BiomeKind>(['steppe', 'dune_sea', 'salt_flat', 'ice_plain', 'tundra', 'crater_plain', 'regolith_desert', 'basalt_plateau', 'ash_desert', 'slag_plain']);
const HIGH = new Set<BiomeKind>(['mountains', 'snow_mountains', 'highlands', 'glacier', 'mesas', 'obsidian_ridge']);
const COAST = new Set<BiomeKind>(['coastal_plain', 'island_coast', 'archipelago', 'fjord_coast', 'river_delta', 'shallow_sea', 'reef', 'kelp_forest', 'deep_sea']);
const LUSH = new Set<BiomeKind>(['cloud_forest', 'swamp', 'fern_forest', 'river_delta', 'fungal_grove', 'oasis', 'permafrost_bog']);
const FOREST = new Set<BiomeKind>(['frost_forest', 'krummholz', 'lichen_heath', 'kelp_forest', 'coastal_plain', 'highlands', 'steppe']);
const DEAD = new Set<BiomeKind>(['lava_fields', 'ash_desert', 'slag_plain', 'crater_plain', 'regolith_desert', 'rift_fields', 'basalt_desert', 'glacier', 'ice_plain', 'acid_marsh', 'methane_lakes', 'crystal_fields', 'salt_flat']);
const VOLCANIC = new Set<BiomeKind>(['lava_fields', 'lava_tubes', 'obsidian_ridge', 'sulfur_springs']);

export function ambientMixFor(i: AmbientInput): AmbientMix {
  const k = i.biomeKind;
  let wind = 0.2 + i.wind * 0.85;
  if (OPEN_PLAINS.has(k)) wind += 0.15;
  if (HIGH.has(k)) wind += 0.2;
  if (i.isCave) wind *= 0.25;
  if (i.underwater) wind = 0;

  let water = i.biomeHasWater ? 0.3 : 0;
  if (COAST.has(k)) water += 0.2;
  if (i.nearWater) water = Math.max(water, 0.7);
  if (i.underwater) water = 0.9;

  let rain = 0;
  if (i.precipitation === 'rain' || i.precipitation === 'acid' || i.precipitation === 'methane') rain = 0.3 + i.precipIntensity * 0.7;
  else if (i.precipitation === 'snow') rain = 0.12;
  else if (i.precipitation === 'ash' || i.precipitation === 'sand') wind += 0.25;
  if (i.underwater) rain *= 0.1;

  let life = LUSH.has(k) ? 0.9 : FOREST.has(k) ? 0.55 : DEAD.has(k) ? 0 : 0.3;
  life *= 0.5 + i.humidity * 0.5;
  if (!i.breathable) life *= 0.6;
  const night = 1 - i.daylight;
  let insects = life * (0.25 + 0.75 * night) * (1 - rain * 0.7);
  if (i.underwater || i.isCave) insects *= 0.15;

  const drone = i.underwater ? 0.55 : i.isCave ? 0.6 : 0.12;
  const lava = VOLCANIC.has(k) && !i.underwater ? 0.7 : 0;

  return { wind: clamp(wind, 0, 1), water: clamp(water, 0, 1), rain: clamp(rain, 0, 1), insects: clamp(insects, 0, 1), drone, lava };
}

const SNOW = new Set<BiomeKind>(['glacier', 'ice_plain', 'frost_forest', 'ice_caves', 'snow_mountains', 'tundra', 'permafrost_bog']);
const SAND = new Set<BiomeKind>(['dune_sea', 'salt_flat', 'rock_desert', 'ash_desert', 'regolith_desert', 'basalt_desert', 'crater_plain']);
const GRASS = new Set<BiomeKind>(['cloud_forest', 'swamp', 'fern_forest', 'river_delta', 'fungal_grove', 'oasis', 'steppe', 'coastal_plain', 'lichen_heath', 'krummholz', 'acid_marsh']);

/** Untergrund für Schrittgeräusche aus dem Biom. */
export function footSurfaceFor(kind: BiomeKind, wading: boolean): FootSurface {
  if (wading) return 'water';
  if (SNOW.has(kind)) return 'snow';
  if (SAND.has(kind)) return 'sand';
  if (GRASS.has(kind)) return 'grass';
  return 'rock';
}
