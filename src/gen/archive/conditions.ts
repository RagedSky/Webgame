/**
 * Laufzeit-Prüfung der Spawn-Bedingungen (rein, testbar): Passt ein Eintrag zu Ort, Zeit und Wetter?
 * Wird von Kreaturen-Spawner und Flora-Platzierung genutzt; Phase 4 nutzt dieselbe Logik für Hinweise.
 */
import { clamp01 } from '@/math/utils';
import type { Biome, Planet, WeatherType } from '../universe/types';
import type { ArchiveEntry, Rarity, SpawnConditions, TimeOfDay } from './types';

export interface SpawnContext {
  timeOfDay: Exclude<TimeOfDay, 'any'>;
  weather: WeatherType;
  /** Normierte Höhe 0..1 am Punkt. */
  altitude: number;
  /** Temperatur in Kelvin am Punkt (jetzt). */
  temperature: number;
  biomeId: string;
  inCave: boolean;
  underwater: boolean;
  deepSea: boolean;
  afterStorm: boolean;
  solstice: boolean;
  eclipse: boolean;
}

/** Relative Spawn-Häufigkeit je Seltenheit. */
export const RARITY_SPAWN_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 0.45, rare: 0.16, legendary: 0.05 };

export function timeMatches(required: TimeOfDay, now: Exclude<TimeOfDay, 'any'>): boolean {
  if (required === 'any') return true;
  if (required === now) return true;
  // Dämmerung zählt für Tag-/Nachtarten als Randzeit mit
  if (required === 'day' && now === 'dawn') return true;
  if (required === 'night' && now === 'dusk') return true;
  return false;
}

export function weatherMatches(required: SpawnConditions['weather'], now: WeatherType): boolean {
  return required === 'any' || required.includes(now);
}

export function specialMatches(spawn: SpawnConditions, ctx: SpawnContext): boolean {
  switch (spawn.special) {
    case undefined:
      return true;
    case 'cave':
      return ctx.inCave;
    case 'underwater':
      return ctx.underwater;
    case 'deep_sea':
      return ctx.deepSea;
    case 'after_storm':
      return ctx.afterStorm;
    case 'solstice':
      return ctx.solstice;
    case 'eclipse':
      return ctx.eclipse;
    case 'atmosphere_probe':
    case 'orbit':
      return false; // erst mit Sonden (Phase 7)
  }
}

/**
 * Prüft Biom, Zeit, Wetter, Höhe, Temperatur und Spezialbedingung.
 * `tolerance` weitet Höhen- (normiert) und Temperaturfenster (Kelvin) etwas auf, damit häufige Arten gut auffindbar sind.
 */
export function matchesSpawn(entry: ArchiveEntry, ctx: SpawnContext, tolerance = { altitude: 0.04, temperature: 6 }): boolean {
  if (!entry.biomeIds.includes(ctx.biomeId)) return false;
  const s = entry.spawn;
  if (!timeMatches(s.timeOfDay, ctx.timeOfDay)) return false;
  if (!weatherMatches(s.weather, ctx.weather)) return false;
  if (ctx.altitude < s.altitude[0] - tolerance.altitude || ctx.altitude > s.altitude[1] + tolerance.altitude) return false;
  if (ctx.temperature < s.temperature[0] - tolerance.temperature || ctx.temperature > s.temperature[1] + tolerance.temperature) return false;
  return specialMatches(s, ctx);
}

/** Flora wird statisch platziert: nur Biom, Höhe und Höhlen-/Wasserregel zählen. */
export function matchesPlacement(entry: ArchiveEntry, biome: Biome, altitude: number, underwater: boolean, tolerance = 0.05): boolean {
  if (!entry.biomeIds.includes(biome.id)) return false;
  const s = entry.spawn;
  if (altitude < s.altitude[0] - tolerance || altitude > s.altitude[1] + tolerance) return false;
  if (s.special === 'cave' && !biome.isCave) return false;
  const aquatic = entry.subcategory === 'aquatic';
  if (aquatic !== underwater) return false;
  return true;
}

/**
 * Geschätzte Temperatur (K) an einem Punkt: Planetenmittel + Biom-Offset − Höhenabnahme ± Tagesgang.
 * Bleibt innerhalb von planet.temperature.min/max, damit Eintragsfenster erreichbar sind.
 */
export function pointTemperature(planet: Planet, biome: Biome, altitude: number, daylight: number): number {
  const { mean, min, max } = planet.temperature;
  const swing = (max - min) * 0.5;
  const t = mean + biome.temperatureOffset - altitude * 14 + (clamp01(daylight) - 0.5) * swing * 0.9;
  return Math.min(max, Math.max(min, t));
}

/** Spawn-Gewicht eines Eintrags (Seltenheit × ggf. Nachtbonus für nachtaktive Arten). */
export function spawnWeight(entry: ArchiveEntry): number {
  return RARITY_SPAWN_WEIGHT[entry.rarity];
}
