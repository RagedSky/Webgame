/**
 * Verteilung des Eintragsbudgets: erst auf Kategorien (feste Anteile), dann je Kategorie auf Planeten
 * (Gewicht = Typ-Eignung × Biodiversität × Größe, Startplanet-Bonus) mit Obergrenzen.
 */
import { distributeInteger } from '@/math/utils';
import { PLANET_TYPES } from '../universe/catalog';
import type { Planet, StarSystem } from '../universe/types';
import { CATEGORIES, CATEGORY_SHARE, type Category } from './types';

export function categoryBudget(total: number): Record<Category, number> {
  const counts = distributeInteger(
    total,
    CATEGORIES.map((c) => CATEGORY_SHARE[c]),
  );
  return Object.fromEntries(CATEGORIES.map((c, i) => [c, counts[i] as number])) as Record<Category, number>;
}

const LIFE_CATEGORIES = new Set<Category>(['fauna', 'flora', 'micro', 'variant']);

export function planetCategoryWeight(planet: Planet, category: Category): number {
  const def = PLANET_TYPES[planet.type];
  let w = def.categoryWeights[category];
  if (w <= 0) return 0;
  const size = Math.min(1.4, Math.max(0.6, planet.radiusKm / 6000));
  w *= def.gasGiant ? 1 : size;
  if (LIFE_CATEGORIES.has(category)) w *= 0.5 + planet.biodiversity;
  if (planet.isStart) w *= 1.5;
  return w;
}

export interface BudgetCaps {
  /** Obergrenze je Planet für Wetter-Einträge (Größe des Phänomen-Pools). */
  weatherPool: Record<string, number>;
}

/** Verteilt alle Kategorien außer `variant` (die hängt von den erzeugten Fauna/Flora-Einträgen ab). */
export function distributeBudget(system: StarSystem, caps: BudgetCaps): Record<string, Record<Category, number>> {
  const perCategory = categoryBudget(system.entryBudget);
  const result: Record<string, Record<Category, number>> = {};
  for (const p of system.planets) {
    result[p.id] = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  }
  for (const category of CATEGORIES) {
    if (category === 'variant') continue;
    const weights = system.planets.map((p) => planetCategoryWeight(p, category));
    const capList = system.planets.map((p) => {
      const def = PLANET_TYPES[p.type];
      let cap = def.categoryCaps[category] ?? Infinity;
      if (category === 'weather') cap = Math.min(cap, caps.weatherPool[p.id] ?? 0);
      return cap;
    });
    const counts = distributeInteger(perCategory[category], weights, capList);
    system.planets.forEach((p, i) => {
      result[p.id]![category] = counts[i] as number;
    });
  }
  return result;
}

/** Verteilt das Varianten-Budget proportional zu den Fauna+Flora-Einträgen je Planet (Cap = deren Anzahl). */
export function distributeVariants(system: StarSystem, baseCounts: Record<string, number>): Record<string, number> {
  const total = categoryBudget(system.entryBudget).variant;
  const weights = system.planets.map((p) => (baseCounts[p.id] ?? 0) * (p.isStart ? 1.5 : 1));
  const caps = system.planets.map((p) => Math.min(PLANET_TYPES[p.type].categoryCaps.variant ?? Infinity, baseCounts[p.id] ?? 0));
  const counts = distributeInteger(total, weights, caps);
  const out: Record<string, number> = {};
  system.planets.forEach((p, i) => (out[p.id] = counts[i] as number));
  return out;
}
