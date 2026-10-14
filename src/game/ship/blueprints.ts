/**
 * Baupläne (rein): Teile ab Stufe 2 werden beim Erkunden freigeschaltet – Ruinen scannen (Wracks, Maschinenreste)
 * und Archiv-Meilensteine. Die Reihenfolge ist je Seed fest (Stufe 2 vor Stufe 3), damit Fortschritt planbar bleibt.
 */
import { Random } from '@/math/Random';
import { PART_DEFS, partDef } from './parts';

export const MILESTONE_FRACTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

export function blueprintIds(): string[] {
  return PART_DEFS.filter((p) => p.tier > 1).map((p) => p.id);
}

/** Freischalt-Reihenfolge je Seed: Stufe-2-Teile gemischt, dann Stufe-3-Teile gemischt. */
export function blueprintOrder(seed: string): string[] {
  const rng = new Random(`blueprints:${seed}`);
  const tier2 = rng.shuffle(blueprintIds().filter((id) => partDef(id).tier === 2));
  const tier3 = rng.shuffle(blueprintIds().filter((id) => partDef(id).tier === 3));
  // Antrieb und Schild früh: der erste Plan ist immer ein Triebwerk oder ein Schild
  const firstIdx = tier2.findIndex((id) => id === 'engine_2' || id === 'shield_1');
  if (firstIdx > 0) {
    const [first] = tier2.splice(firstIdx, 1);
    tier2.unshift(first as string);
  }
  return [...tier2, ...tier3];
}

/** Nächster noch nicht freigeschalteter Plan (oder null, wenn alle gefunden sind). */
export function nextBlueprint(seed: string, unlocked: readonly string[]): string | null {
  for (const id of blueprintOrder(seed)) if (!unlocked.includes(id)) return id;
  return null;
}

/** Wie viele Meilenstein-Pläne bei diesem Abschlussgrad zustehen. */
export function milestonesEarned(fraction: number): number {
  return MILESTONE_FRACTIONS.filter((f) => fraction >= f - 1e-9).length;
}

export function isPartAvailable(partId: string, unlocked: readonly string[]): boolean {
  return partDef(partId).tier === 1 || unlocked.includes(partId);
}
