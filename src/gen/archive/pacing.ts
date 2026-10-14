/**
 * Pacing-Modell (rein): schätzt die Spielzeit bis zur Archiv-Versiegelung (80 %) aus dem generierten System.
 * Es kodiert die Balancing-Annahmen (Minuten je Kategorie, Seltenheit, Bedingungen, Reise- und Aufbau-Overhead)
 * und dient als Regressionsschutz: Ändern sich Budget, Seltenheitsmix oder Planetenzahl stark, schlägt der Test an.
 * Ziel laut Design: 50–80 Stunden bis 80 %. Details in docs/BALANCING.md.
 */
import type { StarSystem } from '../universe/types';
import { SEAL_FRACTION } from '@/game/progress/ArchiveProgress';
import type { ArchiveEntry, Category, Rarity } from './types';

/** Minuten, um einen gewöhnlichen Eintrag ohne Bedingungen zu finden und mit ≥1 Stern zu erfassen. */
export const BASE_MINUTES: Record<Category, number> = { fauna: 7, flora: 3.5, micro: 5, ore: 3, rock: 3, fossil: 4.5, weather: 9, variant: 9 };
/** Mehraufwand je Seltenheit (Spawn-Gewicht 1 / 0,45 / 0,16 / 0,05, abgemildert durch Hinweise, Köder, Rover). */
export const RARITY_FACTOR: Record<Rarity, number> = { common: 1, uncommon: 1.7, rare: 3.2, legendary: 6.5 };
/** Mehraufwand für Tageszeit-, Wetter- und Sonderbedingungen (ein Planetentag dauert 20 min Echtzeit). */
export const CONDITION_FACTOR = { time: 1.4, weather: 1.7, special: 1.3 };
/** Overhead in Minuten: Basis/Lander-Reparatur/Treibstoff einmalig, je weiterem besuchten Planeten, je Biom (Erkundung). */
export const OVERHEAD_MINUTES = { firstShip: 120, perPlanet: 60, perBiome: 10 };

export interface PacingEstimate {
  /** Geschätzte Stunden bis 80 %. */
  hours: number;
  /** Stunden, wenn man alles (100 %) erfasst. */
  hoursComplete: number;
  entries: number;
  needed: number;
  planetsVisited: number;
  /** Anteil der Zeit, der auf Einträge (statt Reise/Aufbau) entfällt. */
  entryShare: number;
}

export function entryMinutes(e: ArchiveEntry): number {
  let m = BASE_MINUTES[e.category] * RARITY_FACTOR[e.rarity];
  if (e.spawn.timeOfDay !== 'any') m *= CONDITION_FACTOR.time;
  if (e.spawn.weather !== 'any') m *= CONDITION_FACTOR.weather;
  if (e.spawn.special) m *= CONDITION_FACTOR.special;
  return m;
}

/** Schätzt Spielzeit bis zur Versiegelung: der Spieler erfasst zuerst die leichten Einträge. */
export function estimatePlaytime(system: StarSystem): PacingEstimate {
  const costs = system.entries.map((e) => ({ planetId: e.planetId, minutes: entryMinutes(e) })).sort((a, b) => a.minutes - b.minutes);
  const needed = Math.ceil(system.entries.length * SEAL_FRACTION);
  const chosen = costs.slice(0, needed);
  let entryMin = 0;
  const planets = new Set<string>();
  for (const c of chosen) {
    entryMin += c.minutes;
    planets.add(c.planetId);
  }
  let overhead = OVERHEAD_MINUTES.firstShip;
  for (const p of system.planets) {
    if (!planets.has(p.id)) continue;
    if (!p.isStart) overhead += OVERHEAD_MINUTES.perPlanet;
    overhead += p.biomes.length * OVERHEAD_MINUTES.perBiome;
  }
  const total = entryMin + overhead;
  const complete = costs.reduce((s, c) => s + c.minutes, 0) + overhead + system.planets.filter((p) => !p.isStart && !planets.has(p.id)).length * OVERHEAD_MINUTES.perPlanet;
  return { hours: total / 60, hoursComplete: complete / 60, entries: system.entries.length, needed, planetsVisited: planets.size, entryShare: entryMin / total };
}
