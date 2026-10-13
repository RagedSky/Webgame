/**
 * Archiv-Generator: verteilt das Budget und erzeugt alle Einträge und Familien pro Planet.
 * Reihenfolge pro Planet: Fauna → Flora → Mikro → Erze → Gesteine → Fossilien → Wetter; Varianten zuletzt (system-weit).
 */
import type { Random } from '@/math/Random';
import type { StarSystem } from '../universe/types';
import { distributeBudget, distributeVariants } from './budget';
import { generateFauna } from './generators/fauna';
import { generateFlora } from './generators/flora';
import { generateFossils } from './generators/fossils';
import { generateMicro } from './generators/micro';
import { generateMinerals } from './generators/minerals';
import { generateVariants } from './generators/variants';
import { buildWeatherPool, generateWeather } from './generators/weather';
import type { GenContext } from './generators/common';
import { NameRegistry } from './names';
import type { ArchiveEntry, Category, Family } from './types';

export interface ArchiveResult {
  entries: ArchiveEntry[];
  families: Family[];
  perPlanet: Record<string, Record<Category, number>>;
}

/** Füllt `system.entries`, `system.families` und `planet.entryBudget`. Gibt das Ergebnis zusätzlich zurück. */
export function generateArchive(system: StarSystem, rootRng: Random): ArchiveResult {
  const names = new NameRegistry();
  const weatherPool: Record<string, number> = {};
  for (const p of system.planets) weatherPool[p.id] = buildWeatherPool(p, system).length;
  const budget = distributeBudget(system, { weatherPool });

  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  const familiesById = new Map<string, Family>();
  const basesByPlanet: Record<string, ArchiveEntry[]> = {};

  for (const planet of system.planets) {
    const counts = budget[planet.id]!;
    const ctx = (category: Category): GenContext => ({
      rng: rootRng.fork(`archive:${planet.id}:${category}`),
      system,
      planet,
      names,
      difficulty: system.difficulty,
    });
    const add = (r: { entries: ArchiveEntry[]; families: Family[] }): void => {
      entries.push(...r.entries);
      families.push(...r.families);
      for (const f of r.families) familiesById.set(f.id, f);
    };
    const fauna = generateFauna(ctx('fauna'), counts.fauna);
    add(fauna);
    const flora = generateFlora(ctx('flora'), counts.flora);
    add(flora);
    add(generateMicro(ctx('micro'), counts.micro, flora.entries.length));
    add(generateMinerals(ctx('ore'), 'ore', counts.ore));
    add(generateMinerals(ctx('rock'), 'rock', counts.rock));
    add(generateFossils(ctx('fossil'), counts.fossil));
    add(generateWeather(ctx('weather'), counts.weather));
    basesByPlanet[planet.id] = [...fauna.entries, ...flora.entries];
  }

  const variantCounts = distributeVariants(
    system,
    Object.fromEntries(system.planets.map((p) => [p.id, basesByPlanet[p.id]?.length ?? 0])),
  );
  for (const planet of system.planets) {
    const n = variantCounts[planet.id] ?? 0;
    const ctx: GenContext = {
      rng: rootRng.fork(`archive:${planet.id}:variant`),
      system,
      planet,
      names,
      difficulty: system.difficulty,
    };
    const v = generateVariants(ctx, n, basesByPlanet[planet.id] ?? [], familiesById);
    entries.push(...v);
    budget[planet.id]!.variant = v.length;
  }

  // Tatsächliche Zahlen in die Planeten schreiben (Caps können Budget reduziert haben)
  for (const planet of system.planets) {
    const actual = budget[planet.id]!;
    for (const key of Object.keys(actual) as Category[]) actual[key] = 0;
    for (const e of entries) if (e.planetId === planet.id) actual[e.category]++;
    planet.entryBudget = { ...actual };
  }

  system.entries = entries;
  system.families = families;
  return { entries, families, perPlanet: budget };
}
