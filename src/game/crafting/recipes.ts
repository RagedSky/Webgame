/**
 * Rezepte und Gegenstände (rein). Alle Rezepte verwenden nur Rohstoffe, die der Startplanet garantiert
 * (Ferrit, Quarz, Wasser, Faser), damit jeder Seed lösbar bleibt.
 */
import type { ResourceId } from '@/gen/universe/types';

export type ItemId = 'workbench' | 'shelter' | 'charger' | 'lab' | 'oxygen_cell' | 'energy_cell' | 'lure' | 'lab_upgrade' | 'fuel' | 'satellite' | 'rover' | 'deep_probe' | 'atmo_probe';

export type StationId = 'hand' | 'workbench';

export type ModuleType = 'shelter' | 'workbench' | 'lab' | 'charger';

export interface Recipe {
  id: ItemId;
  name: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  station: StationId;
  /** Ergebnis: platzierbares Modul oder Verbrauchsgegenstand. */
  module?: ModuleType;
  /** Benötigt ein vorhandenes Labor (Upgrade). */
  requiresLab?: boolean;
  /** Maximale Anzahl (z. B. Upgrades). */
  max?: number;
}

export const RECIPES: Recipe[] = [
  { id: 'workbench', name: 'Werkbank', description: 'Feldfertigung für Stationen und Zellen. Von Hand baubar.', cost: { ferrite: 6, quartz: 3 }, station: 'hand', module: 'workbench' },
  { id: 'shelter', name: 'Unterkunft', description: 'Respawn-Punkt; lädt Sauerstoff und Energie in der Nähe auf.', cost: { ferrite: 10, fiber: 8 }, station: 'hand', module: 'shelter' },
  { id: 'charger', name: 'Ladestation', description: 'Lädt Anzug-Energie und Sauerstoff in 5 m Umkreis.', cost: { ferrite: 8, quartz: 6, water: 2 }, station: 'workbench', module: 'charger' },
  { id: 'lab', name: 'Labor', description: 'Treibstoff-Synthese und genauere Probenanalyse.', cost: { ferrite: 12, quartz: 8, fiber: 4 }, station: 'workbench', module: 'lab' },
  { id: 'oxygen_cell', name: 'Sauerstoffzelle', description: 'Füllt 50 % Sauerstoff; wird bei 10 % automatisch genutzt.', cost: { water: 2, quartz: 1 }, station: 'workbench' },
  { id: 'energy_cell', name: 'Energiezelle', description: 'Füllt 50 % Energie; wird bei 10 % automatisch genutzt.', cost: { quartz: 2, fiber: 1 }, station: 'workbench' },
  { id: 'lure', name: 'Köder', description: 'Lockt Tiere im Umkreis von 40 m für eine Minute an.', cost: { fiber: 2, water: 1 }, station: 'workbench' },
  { id: 'lab_upgrade', name: 'Labor-Upgrade', description: 'Erhöht Ausbeute und Analyse-Genauigkeit des Labors (max. Stufe 3).', cost: { ferrite: 10, quartz: 10, fiber: 6 }, station: 'workbench', requiresLab: true, max: 2 },
  { id: 'satellite', name: 'Orbital-Satellit', description: 'Im Orbit aussetzen: Höhenkarte des Planeten; mit Tiefenscanner am Schiff auch Biom-, Erz- und Lebenszeichen-Layer.', cost: { ferrite: 16, quartz: 12, fiber: 4 }, station: 'workbench' },
  { id: 'rover', name: 'Rover (Landesonde)', description: 'Ferngesteuert, erkundet Gefahrenzonen, nimmt Proben und Fotos (Signalreichweite 900 m).', cost: { ferrite: 20, quartz: 10, fiber: 6, water: 2 }, station: 'workbench' },
  { id: 'deep_probe', name: 'Tiefseesonde', description: 'Am Ufer aussetzen: kartiert das Gewässer, liefert Hinweise auf Wasserarten und eine Tiefenprobe.', cost: { ferrite: 10, quartz: 8, water: 4 }, station: 'workbench' },
  { id: 'atmo_probe', name: 'Atmosphärensonde', description: 'Im Orbit eines Gasriesen starten: erfasst Wetterphänomene, Hinweise auf Schwebewesen und eine Luftprobe.', cost: { ferrite: 12, quartz: 10, fiber: 4 }, station: 'workbench' },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const MODULE_LABELS: Record<ModuleType, string> = { shelter: 'Unterkunft', workbench: 'Werkbank', lab: 'Labor', charger: 'Ladestation' };

/** Rohstoffe, die irgendein Rezept braucht (für Tests: müssen auf dem Startplaneten garantiert sein). */
export function recipeResourceIds(): ResourceId[] {
  const set = new Set<ResourceId>();
  for (const r of RECIPES) for (const id of Object.keys(r.cost)) set.add(id as ResourceId);
  return Array.from(set);
}

/** Treibstoffziel für den ersten Start (Phase 6 verbraucht Treibstoff). */
export const LAUNCH_FUEL_TARGET = 20;

/** Labor-Stufe → Ausbeute-Faktor und Analysegenauigkeit. */
export function labEfficiency(level: number): number {
  return [1, 1.3, 1.6][Math.max(0, Math.min(2, level))] as number;
}
