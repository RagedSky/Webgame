/**
 * Schiffsentwurf (rein): ein Rumpf mit Sockeln, daran Teile. Live-Werte (Masse, Schub, Tank, Stufen),
 * Platzierungsregeln, Rumpfwechsel und Validierung gegen die Schwerkraft des Standorts.
 */
import type { ResourceCost } from '../Inventory';
import { partDef, PART_TYPE_LABELS, SOCKET_FOR_TYPE, type PartDef, type SocketDef, type SocketKind } from './parts';

export interface PlacedPart {
  id: string;
  partId: string;
  /** Index in den Sockeln des Rumpfs. */
  socket: number;
}

export interface ShipDesign {
  hullId: string;
  parts: PlacedPart[];
}

export interface ShipStats {
  /** Leermasse in t (ohne Treibstoff). */
  dryMass: number;
  maxFuel: number;
  /** Gesamtschub in kN. */
  thrust: number;
  /** Bester Effizienzfaktor der Triebwerke (teilt den Verbrauch). */
  efficiency: number;
  engineTier: 0 | 1 | 2 | 3;
  shieldTier: 0 | 1 | 2;
  scannerTier: 0 | 1 | 2;
  cargo: number;
  legs: number;
  /** Kleinste Schwerkraft-Auslegung der verbauten Beine (0 ohne Beine). */
  legRating: number;
  hasCockpit: boolean;
  partCount: number;
}

export const FUEL_MASS_PER_UNIT = 0.05;
export const MIN_LEGS = 3;
export const G0 = 9.81;

/** Der beschädigte Lander zu Spielbeginn: Rumpf und Kanzel vorhanden, Triebwerk, Tank und Beine fehlen. */
export function starterDesign(): ShipDesign {
  return { hullId: 'hull_1', parts: [{ id: 'p-cockpit', partId: 'cockpit_1', socket: 0 }] };
}

/** Vollständiger Stufe-1-Lander (Tests, Lösungshilfe). */
export function repairedDesign(): ShipDesign {
  let d = starterDesign();
  d = placePart(d, 'engine_1', firstFreeSocket(d, 'bottom')!);
  d = placePart(d, 'tank_1', firstFreeSocket(d, 'side')!);
  for (let i = 0; i < 3; i++) d = placePart(d, 'legs_1', firstFreeSocket(d, 'leg')!);
  return d;
}

export function hullOf(design: ShipDesign): PartDef {
  return partDef(design.hullId);
}

export function socketsOf(design: ShipDesign): SocketDef[] {
  return hullOf(design).hull?.sockets ?? [];
}

export function partAt(design: ShipDesign, socket: number): PlacedPart | undefined {
  return design.parts.find((p) => p.socket === socket);
}

export function freeSockets(design: ShipDesign, kind?: SocketKind): number[] {
  const out: number[] = [];
  socketsOf(design).forEach((s, i) => {
    if (kind && s.kind !== kind) return;
    if (!partAt(design, i)) out.push(i);
  });
  return out;
}

export function firstFreeSocket(design: ShipDesign, kind: SocketKind): number | undefined {
  return freeSockets(design, kind)[0];
}

export function canPlace(design: ShipDesign, partId: string, socket: number): { ok: boolean; reason: string } {
  const def = partDef(partId);
  if (def.type === 'hull') return { ok: false, reason: 'Rumpf über „Rumpf wechseln“ tauschen' };
  const s = socketsOf(design)[socket];
  if (!s) return { ok: false, reason: 'Kein Sockel' };
  const wanted = SOCKET_FOR_TYPE[def.type];
  if (s.kind !== wanted) return { ok: false, reason: `${PART_TYPE_LABELS[def.type]} passt nur an Sockel „${wanted}“` };
  if (partAt(design, socket)) return { ok: false, reason: 'Sockel belegt' };
  return { ok: true, reason: '' };
}

let placedCounter = 0;

export function placePart(design: ShipDesign, partId: string, socket: number): ShipDesign {
  const check = canPlace(design, partId, socket);
  if (!check.ok) throw new Error(check.reason);
  return { hullId: design.hullId, parts: [...design.parts, { id: `p-${++placedCounter}-${partId}-${socket}`, partId, socket }] };
}

export function removePart(design: ShipDesign, placedId: string): ShipDesign {
  return { hullId: design.hullId, parts: design.parts.filter((p) => p.id !== placedId) };
}

/** Rumpf tauschen; Teile bleiben, wenn im neuen Rumpf ein freier Sockel gleicher Art existiert (gleicher Index bevorzugt). */
export function setHull(design: ShipDesign, hullId: string): { design: ShipDesign; dropped: PlacedPart[] } {
  const def = partDef(hullId);
  if (!def.hull) throw new Error('Kein Rumpf');
  let next: ShipDesign = { hullId, parts: [] };
  const dropped: PlacedPart[] = [];
  for (const p of design.parts) {
    const kind = SOCKET_FOR_TYPE[partDef(p.partId).type];
    const sameIndex = socketsOf(next)[p.socket];
    let target: number | undefined;
    if (sameIndex && sameIndex.kind === kind && !partAt(next, p.socket)) target = p.socket;
    else if (kind) target = firstFreeSocket(next, kind);
    if (target === undefined) dropped.push(p);
    else next = { hullId, parts: [...next.parts, { ...p, socket: target }] };
  }
  return { design: next, dropped };
}

export function allParts(design: ShipDesign): PartDef[] {
  return [hullOf(design), ...design.parts.map((p) => partDef(p.partId))];
}

export function addCost(into: ResourceCost, cost: ResourceCost, factor = 1): ResourceCost {
  for (const [id, n] of Object.entries(cost) as [keyof ResourceCost, number][]) into[id] = (into[id] ?? 0) + n * factor;
  return into;
}

export function designCost(design: ShipDesign): ResourceCost {
  const out: ResourceCost = {};
  for (const p of allParts(design)) addCost(out, p.cost);
  return out;
}

/** Kostenunterschied zweier Entwürfe: positive Werte sind zu zahlen, negative werden erstattet (voll). */
export function costDelta(from: ShipDesign, to: ShipDesign): ResourceCost {
  const out: ResourceCost = {};
  addCost(out, designCost(to));
  addCost(out, designCost(from), -1);
  for (const id of Object.keys(out) as (keyof ResourceCost)[]) if (out[id] === 0) delete out[id];
  return out;
}

export function shipStats(design: ShipDesign): ShipStats {
  const parts = allParts(design);
  let dryMass = 0;
  let maxFuel = 0;
  let thrust = 0;
  let efficiency = 1;
  let engineTier: ShipStats['engineTier'] = 0;
  let shieldTier: ShipStats['shieldTier'] = 0;
  let scannerTier: ShipStats['scannerTier'] = 0;
  let cargo = 0;
  let legs = 0;
  let legRating = Infinity;
  let hasCockpit = false;
  for (const p of parts) {
    dryMass += p.mass;
    if (p.fuelCapacity) maxFuel += p.fuelCapacity;
    if (p.thrust) {
      thrust += p.thrust;
      efficiency = Math.max(efficiency, p.efficiency ?? 1);
      engineTier = Math.max(engineTier, p.tier) as ShipStats['engineTier'];
    }
    if (p.shield) shieldTier = Math.max(shieldTier, p.shield) as ShipStats['shieldTier'];
    if (p.scanner) scannerTier = Math.max(scannerTier, p.scanner) as ShipStats['scannerTier'];
    if (p.cargo) cargo += p.cargo;
    if (p.legRating) {
      legs++;
      legRating = Math.min(legRating, p.legRating);
    }
    if (p.type === 'cockpit') hasCockpit = true;
  }
  return { dryMass, maxFuel, thrust, efficiency, engineTier, shieldTier, scannerTier, cargo, legs, legRating: legs ? legRating : 0, hasCockpit, partCount: parts.length };
}

/** Schub-zu-Gewicht-Verhältnis bei gegebener Treibstoffmenge und Schwerkraft (in g). */
export function twr(stats: ShipStats, fuel: number, gravity: number): number {
  const mass = stats.dryMass + fuel * FUEL_MASS_PER_UNIT;
  if (mass <= 0 || gravity <= 0) return 0;
  return stats.thrust / (mass * G0 * gravity);
}

export const LAUNCH_TWR = 1.1;
export const LANDING_TWR = 1.05;

/** Fehler, die den Start verhindern (leer = startklar). `fuel` = Füllstand für die Massenrechnung. */
export function validateDesign(design: ShipDesign, gravity: number, fuel = shipStats(design).maxFuel): string[] {
  const s = shipStats(design);
  const errors: string[] = [];
  if (!s.hasCockpit) errors.push('Keine Kanzel');
  if (s.engineTier === 0) errors.push('Kein Triebwerk');
  if (s.maxFuel === 0) errors.push('Kein Tank');
  if (s.legs < MIN_LEGS) errors.push(`Mindestens ${MIN_LEGS} Landebeine (${s.legs} verbaut)`);
  if (s.legs >= MIN_LEGS && s.legRating < gravity) errors.push(`Landebeine nur bis ${s.legRating.toFixed(1)} g (hier ${gravity.toFixed(2)} g)`);
  if (s.engineTier > 0) {
    const t = twr(s, fuel, gravity);
    if (t < LAUNCH_TWR) errors.push(`Schub zu gering: Schub/Gewicht ${t.toFixed(2)} (nötig ${LAUNCH_TWR})`);
  }
  return errors;
}
