/**
 * Treibstoff-Formel: pro Seed andere Komponenten und Verhältnisse.
 * Die Analyse (`analyzeMix`) gibt stetige Werte zurück, sodass die richtige Mischung logisch
 * eingegrenzt werden kann (Reinheit → Komponenten, Energiedichte/Stabilität → Verhältnis).
 */
import type { Random } from '@/math/Random';
import { clamp01 } from '@/math/utils';
import { RESOURCES } from './catalog';
import type { FuelComponent, FuelFormula, FuelRole, Planet, ResourceId } from './types';

export interface FuelMix {
  /** Anteile pro Rohstoff (beliebige Skala, werden normiert). */
  parts: Partial<Record<ResourceId, number>>;
}

export interface FuelAnalysis {
  /** 0..1: Anteil der richtigen Komponenten an der Mischung. */
  purity: number;
  /** 0..1: wie nah das Verhältnis Energieträger/Oxidator am Optimum liegt. */
  energyDensity: number;
  /** 0..1: wie nah der Stabilisator-Anteil am Optimum liegt (ohne Stabilisator: 1 wenn keiner nötig). */
  stability: number;
  /** Gesamtqualität 0..1 (Produkt aller drei Werte – alle müssen stimmen). */
  quality: number;
  /** Hinweise für das Labor-Display. */
  notes: string[];
}

export const FUEL_ROLE_LABELS: Record<FuelRole, string> = {
  energy: 'Energieträger',
  oxidizer: 'Oxidator',
  stabilizer: 'Stabilisator',
};

export function resourcesWithRole(planet: Planet, role: FuelRole): ResourceId[] {
  return planet.resources.map((r) => r.resourceId).filter((id) => RESOURCES[id].fuelRole === role);
}

/** Erzeugt die Treibstoff-Formel aus den Rohstoffen des Startplaneten. */
export function generateFuelFormula(rng: Random, startPlanet: Planet): FuelFormula {
  const energy = resourcesWithRole(startPlanet, 'energy');
  const oxidizers = resourcesWithRole(startPlanet, 'oxidizer');
  const stabilizers = resourcesWithRole(startPlanet, 'stabilizer');
  if (energy.length === 0 || oxidizers.length === 0) {
    throw new Error('Startplanet hat keine Treibstoff-Rohstoffe (Generator-Garantie verletzt)');
  }
  const useStabilizer = stabilizers.length > 0 && rng.bool(0.65);
  const e = rng.pick(energy);
  const o = rng.pick(oxidizers);
  const components: FuelComponent[] = [];
  if (useStabilizer) {
    const s = rng.pick(stabilizers);
    const stabParts = rng.int(1, 3);
    const energyParts = rng.int(3, 6);
    const oxParts = 10 - stabParts - energyParts;
    components.push({ resourceId: e, role: 'energy', parts: energyParts });
    components.push({ resourceId: o, role: 'oxidizer', parts: Math.max(1, oxParts) });
    components.push({ resourceId: s, role: 'stabilizer', parts: stabParts });
  } else {
    const energyParts = rng.int(3, 7);
    components.push({ resourceId: e, role: 'energy', parts: energyParts });
    components.push({ resourceId: o, role: 'oxidizer', parts: 10 - energyParts });
  }
  // Sicherstellen, dass die Summe 10 ist
  const total = components.reduce((a, c) => a + c.parts, 0);
  if (total !== 10) components[0]!.parts += 10 - total;

  const nameA = rng.pick(['Hydra', 'Nova', 'Kryo', 'Pyro', 'Astra', 'Ion', 'Vela', 'Tetra', 'Sol', 'Aether']);
  const nameB = rng.pick(['zin', 'lith', 'gen', 'fuel', 'ol', 'ex', 'ium', 'pren', 'tan', 'dyn']);
  const energyPerUnit = Math.round(80 + rng.float(0, 60) + (useStabilizer ? 20 : 0));
  return { name: `${nameA}${nameB}`, components, totalParts: 10, energyPerUnit };
}

/** Bewertet eine Mischung gegen die Formel. */
export function analyzeMix(formula: FuelFormula, mix: FuelMix): FuelAnalysis {
  const notes: string[] = [];
  const entries = Object.entries(mix.parts).filter(([, v]) => (v ?? 0) > 0) as [ResourceId, number][];
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) {
    return { purity: 0, energyDensity: 0, stability: 0, quality: 0, notes: ['Keine Mischung.'] };
  }
  const norm = new Map<ResourceId, number>(entries.map(([id, v]) => [id, v / total]));
  const correctIds = new Set(formula.components.map((c) => c.resourceId));

  let correctMass = 0;
  for (const [id, frac] of norm) if (correctIds.has(id)) correctMass += frac;
  const missing = formula.components.filter((c) => !norm.has(c.resourceId));
  const found = formula.components.length - missing.length;
  const purity = clamp01(correctMass * (found / formula.components.length));
  if (missing.length) notes.push(`${missing.length} Komponente(n) fehlen.`);
  const foreign = entries.filter(([id]) => !correctIds.has(id)).length;
  if (foreign) notes.push(`${foreign} Fremdstoff(e) senken die Reinheit.`);

  // Verhältnis Energieträger : Oxidator (nur über die richtigen Komponenten)
  const target = (role: FuelRole): number =>
    formula.components.filter((c) => c.role === role).reduce((a, c) => a + c.parts, 0) / 10;
  const actual = (role: FuelRole): number =>
    formula.components.filter((c) => c.role === role).reduce((a, c) => a + (norm.get(c.resourceId) ?? 0), 0);

  const tE = target('energy');
  const tO = target('oxidizer');
  const aE = actual('energy');
  const aO = actual('oxidizer');
  const targetRatio = tE / (tE + tO);
  const actualRatio = aE + aO > 0 ? aE / (aE + aO) : 0;
  const energyDensity = aE + aO > 0 ? clamp01(1 - Math.abs(actualRatio - targetRatio) / 0.5) : 0;
  if (aE + aO > 0 && actualRatio < targetRatio - 0.05) notes.push('Mischung ist zu mager (mehr Energieträger).');
  if (aE + aO > 0 && actualRatio > targetRatio + 0.05) notes.push('Mischung ist zu fett (mehr Oxidator).');

  const tS = target('stabilizer');
  const aS = actual('stabilizer');
  let stability: number;
  if (tS === 0) {
    stability = 1 - clamp01(aS * 2);
    if (aS > 0.05) notes.push('Stabilisator unnötig – dämpft die Reaktion.');
  } else {
    stability = clamp01(1 - Math.abs(aS - tS) / 0.3);
    if (aS < tS - 0.05) notes.push('Instabil – mehr Stabilisator.');
    if (aS > tS + 0.05) notes.push('Überdämpft – weniger Stabilisator.');
  }
  const quality = purity * energyDensity * stability;
  return { purity, energyDensity, stability, quality, notes };
}

/** Die exakt richtige Mischung (für Tests und Lösungshilfe). */
export function correctMix(formula: FuelFormula): FuelMix {
  const parts: Partial<Record<ResourceId, number>> = {};
  for (const c of formula.components) parts[c.resourceId] = c.parts;
  return { parts };
}
