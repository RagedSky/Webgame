/**
 * Karten-Auswertung (rein): Katalog-Lücken je Biom („hier fehlen 7 Einträge“), Sondenziele für
 * Tiefsee- und Atmosphärensonden, Hinweistexte.
 */
import type { ArchiveEntry } from '@/gen/archive/types';
import { TIME_LABELS } from '@/gen/archive/types';
import type { Biome, Planet } from '@/gen/universe/types';
import { WEATHER } from '@/gen/universe/catalog';

export interface BiomeGap {
  biome: Biome;
  missing: number;
  total: number;
}

/** Fehlende und gesamte Einträge je Biom eines Planeten (Einträge mit mehreren Biomen zählen in jedem). */
export function catalogGaps(entries: readonly ArchiveEntry[], planet: Planet, isDiscovered: (id: string) => boolean): BiomeGap[] {
  const out: BiomeGap[] = [];
  for (const biome of planet.biomes) {
    let total = 0;
    let missing = 0;
    for (const e of entries) {
      if (e.planetId !== planet.id || !e.biomeIds.includes(biome.id)) continue;
      total++;
      if (!isDiscovered(e.id)) missing++;
    }
    out.push({ biome, missing, total });
  }
  return out;
}

const WATER_KINDS = new Set(['shallow_sea', 'deep_sea', 'reef', 'island_coast', 'archipelago', 'kelp_forest']);

/** Einträge, die eine Tiefseesonde auf diesem Planeten erfassen kann (Wasser-Biome, nicht entdeckt). */
export function deepSeaTargets(entries: readonly ArchiveEntry[], planet: Planet, isDiscovered: (id: string) => boolean): ArchiveEntry[] {
  const water = new Set(planet.biomes.filter((b) => b.hasWater || WATER_KINDS.has(b.kind)).map((b) => b.id));
  return entries.filter((e) => e.planetId === planet.id && !isDiscovered(e.id) && (e.subcategory === 'aquatic' || e.biomeIds.some((id) => water.has(id))));
}

/** Einträge eines Gasriesen, die eine Atmosphärensonde erfasst (alle Kategorien, nicht entdeckt). */
export function atmosphereTargets(entries: readonly ArchiveEntry[], planet: Planet, isDiscovered: (id: string) => boolean): ArchiveEntry[] {
  return entries.filter((e) => e.planetId === planet.id && !isDiscovered(e.id));
}

/** Sonden-Hinweis ohne den Namen zu verraten: Biom, Tageszeit, Wetter. */
export function probeHintText(probe: string, e: ArchiveEntry, planet: Planet): string {
  const biome = planet.biomes.find((b) => e.biomeIds.includes(b.id));
  const parts = [`${probe}: Signatur (${e.category === 'fauna' ? 'Bewegung' : e.category === 'flora' ? 'Wuchs' : e.category === 'micro' ? 'Mikrobiologie' : e.category === 'weather' ? 'Phänomen' : 'Struktur'})`];
  if (biome) parts.push(`in ${biome.name}`);
  if (e.spawn.timeOfDay !== 'any') parts.push(TIME_LABELS[e.spawn.timeOfDay]);
  if (e.spawn.weather !== 'any' && e.spawn.weather.length) parts.push(`bei ${e.spawn.weather.map((w) => WEATHER[w].name).join('/')}`);
  return parts.join(' · ');
}
