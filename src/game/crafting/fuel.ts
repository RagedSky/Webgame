/**
 * Treibstoff-Synthese im Labor (rein): Testmischungen analysieren, Chargen synthetisieren.
 * Qualität < 0,6 → instabil, Rohstoffe verpuffen. Labor-Stufe erhöht Ausbeute und Detailgrad der Analyse.
 */
import { analyzeMix, FUEL_ROLE_LABELS, type FuelAnalysis, type FuelMix } from '@/gen/universe/Fuel';
import { RESOURCES } from '@/gen/universe/catalog';
import type { FuelFormula, ResourceId } from '@/gen/universe/types';
import type { ResourceCost } from '../Inventory';
import { labEfficiency } from './recipes';

export interface SynthesisResult {
  analysis: FuelAnalysis;
  fuelProduced: number;
  consumed: ResourceCost;
  stable: boolean;
}

export const MIN_STABLE_QUALITY = 0.6;

/** Kosten einer Testmischung: 1 Einheit je gewählter Rohstoff. */
export function analysisCost(mix: FuelMix): ResourceCost {
  const out: ResourceCost = {};
  for (const [id, parts] of Object.entries(mix.parts) as [ResourceId, number][]) if (parts > 0) out[id] = 1;
  return out;
}

/** Kosten einer Charge: Anteile × Chargen. */
export function batchCost(mix: FuelMix, batches: number): ResourceCost {
  const out: ResourceCost = {};
  for (const [id, parts] of Object.entries(mix.parts) as [ResourceId, number][]) if (parts > 0) out[id] = parts * batches;
  return out;
}

export function synthesize(formula: FuelFormula, mix: FuelMix, batches: number, labLevel: number): SynthesisResult {
  const analysis = analyzeMix(formula, mix);
  const consumed = batchCost(mix, batches);
  const stable = analysis.quality >= MIN_STABLE_QUALITY;
  const fuelProduced = stable ? Math.max(1, Math.round(batches * 4 * labEfficiency(labLevel) * analysis.quality)) : 0;
  return { analysis, fuelProduced, consumed, stable };
}

/** Analysebericht je Labor-Stufe: Stufe 0 nur Werte, Stufe 1 Hinweise, Stufe 2 Rollen-Hinweise. */
export function analysisReport(formula: FuelFormula, mix: FuelMix, analysis: FuelAnalysis, labLevel: number): string[] {
  const lines: string[] = [];
  if (labLevel >= 1) lines.push(...analysis.notes);
  if (labLevel >= 2) {
    const correct = new Set(formula.components.map((c) => c.resourceId));
    for (const [id, parts] of Object.entries(mix.parts) as [ResourceId, number][]) {
      if (parts <= 0) continue;
      const role = RESOURCES[id].fuelRole;
      if (!correct.has(id)) lines.push(`${RESOURCES[id].name}: reagiert nicht – ${role ? `anderer ${FUEL_ROLE_LABELS[role]}` : 'kein Treibstoffbestandteil'}.`);
    }
    const missingRoles = formula.components.filter((c) => !(mix.parts[c.resourceId] ?? 0)).map((c) => FUEL_ROLE_LABELS[c.role]);
    if (missingRoles.length) lines.push(`Es fehlt: ${missingRoles.join(', ')}.`);
  }
  return lines;
}
