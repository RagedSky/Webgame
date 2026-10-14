/**
 * Raumflug (rein): Treibstoffkosten für Start, Transfer und Landung, Erreichbarkeit nach Stufen,
 * Landefähigkeit nach Beinen und Schub. Kosten steigen mit Masse und Schwerkraft, sinken mit Triebwerkseffizienz.
 */
import type { Planet } from '@/gen/universe/types';
import { FUEL_MASS_PER_UNIT, LANDING_TWR, LAUNCH_TWR, MIN_LEGS, twr, type ShipStats } from './ShipDesign';

export function wetMass(stats: ShipStats, fuel: number): number {
  return stats.dryMass + fuel * FUEL_MASS_PER_UNIT;
}

export function launchCost(stats: ShipStats, fuel: number, gravity: number): number {
  return Math.max(1, Math.ceil((2 + 0.25 * gravity * wetMass(stats, fuel)) / stats.efficiency));
}

export function landingCost(stats: ShipStats, fuel: number, gravity: number): number {
  return Math.max(1, Math.ceil((1 + 0.15 * gravity * wetMass(stats, fuel)) / stats.efficiency));
}

export function transferCost(stats: ShipStats, fuel: number, fromAu: number, toAu: number): number {
  const d = Math.abs(fromAu - toAu);
  if (d < 1e-6) return 0;
  return Math.max(1, Math.ceil((1.5 * d * wetMass(stats, fuel)) / 15 / stats.efficiency));
}

/** Reichweite in AU für Transfers mit dem gegebenen Treibstoff (ohne Start/Landung). */
export function rangeAu(stats: ShipStats, fuel: number): number {
  if (fuel <= 0 || stats.efficiency <= 0) return 0;
  return (fuel * 15 * stats.efficiency) / (1.5 * wetMass(stats, fuel));
}

export interface Check {
  ok: boolean;
  reasons: string[];
}

/** Darf das Schiff den Orbit dieses Planeten anfliegen (Stufen)? */
export function reachCheck(stats: ShipStats, planet: Planet): Check {
  const reasons: string[] = [];
  const req = planet.requirements;
  if (stats.engineTier < req.engineTier) reasons.push(`Triebwerk Stufe ${req.engineTier} nötig`);
  if (stats.shieldTier < req.shieldTier) reasons.push(`Schild Stufe ${req.shieldTier} nötig`);
  return { ok: reasons.length === 0, reasons };
}

/** Kann das Schiff dort landen (Oberfläche, Beine, Schub)? */
export function landCheck(stats: ShipStats, fuel: number, planet: Planet): Check {
  const reasons: string[] = [];
  if (planet.type === 'gas_giant') reasons.push('Keine feste Oberfläche');
  if (stats.legs < MIN_LEGS) reasons.push(`Mindestens ${MIN_LEGS} Landebeine`);
  else if (stats.legRating < planet.gravity) reasons.push(`Landebeine nur bis ${stats.legRating.toFixed(1)} g (${planet.gravity.toFixed(2)} g)`);
  if (twr(stats, fuel, planet.gravity) < LANDING_TWR) reasons.push(`Schub/Gewicht ${twr(stats, fuel, planet.gravity).toFixed(2)} < ${LANDING_TWR}`);
  return { ok: reasons.length === 0, reasons };
}

export function launchCheck(stats: ShipStats, fuel: number, planet: Planet): Check {
  const reasons: string[] = [];
  const t = twr(stats, fuel, planet.gravity);
  if (t < LAUNCH_TWR) reasons.push(`Schub/Gewicht ${t.toFixed(2)} < ${LAUNCH_TWR}`);
  const need = launchCost(stats, fuel, planet.gravity) + landingCost(stats, fuel, planet.gravity);
  if (fuel < need) reasons.push(`Treibstoff ${fuel}/${need} (Start + Rückkehr)`);
  return { ok: reasons.length === 0, reasons };
}

export interface TripPlan {
  transfer: number;
  landing: number;
  total: number;
  reach: Check;
  land: Check;
  affordable: boolean;
}

/** Plan für einen Flug aus dem Orbit von `from` in den Orbit von `to` plus Landung dort. */
export function planTrip(stats: ShipStats, fuel: number, from: Planet, to: Planet): TripPlan {
  const transfer = transferCost(stats, fuel, from.orbitRadiusAu, to.orbitRadiusAu);
  const afterTransfer = Math.max(0, fuel - transfer);
  const landing = landingCost(stats, afterTransfer, to.gravity);
  const reach = reachCheck(stats, to);
  const land = landCheck(stats, afterTransfer, to);
  return { transfer, landing, total: transfer + landing, reach, land, affordable: fuel >= transfer + landing };
}
