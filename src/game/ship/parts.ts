/**
 * Schiffsteile (rein): Rümpfe mit Sockeln, Triebwerke, Tanks, Kanzel, Landebeine, Scanner, Schilde, Frachträume.
 * Alle Kosten nutzen nur die garantierten Startrohstoffe (siehe D-030); höhere Stufen brauchen Baupläne (D-035).
 */
import type { ResourceCost } from '../Inventory';

export type PartType = 'hull' | 'cockpit' | 'engine' | 'tank' | 'legs' | 'scanner' | 'shield' | 'cargo';
export type SocketKind = 'top' | 'bottom' | 'leg' | 'side';
export type Tier = 1 | 2 | 3;

export interface SocketDef {
  kind: SocketKind;
  /** Position relativ zur Rumpfbasis (m). */
  x: number;
  y: number;
  z: number;
  /** Ausrichtung um die Hochachse (rad), für seitliche Anbauten. */
  angle: number;
}

export interface HullSpec {
  radius: number;
  height: number;
  sockets: SocketDef[];
}

export interface PartDef {
  id: string;
  type: PartType;
  tier: Tier;
  name: string;
  description: string;
  /** Masse in Tonnen. */
  mass: number;
  cost: ResourceCost;
  /** Triebwerk: Schub in kN und Effizienzfaktor (teilt den Treibstoffverbrauch). */
  thrust?: number;
  efficiency?: number;
  /** Tank: Treibstoffeinheiten. */
  fuelCapacity?: number;
  /** Schildgenerator: Schutzstufe. */
  shield?: 1 | 2;
  /** Scanner-Stufe (Phase 7: Karten-Layer). */
  scanner?: 1 | 2;
  /** Fracht-Slots (Phase 7: Sonden). */
  cargo?: number;
  /** Landebein: maximale Schwerkraft (g), für die das Bein ausgelegt ist. */
  legRating?: number;
  hull?: HullSpec;
}

export const PART_TYPE_LABELS: Record<PartType, string> = {
  hull: 'Rumpf',
  cockpit: 'Kanzel',
  engine: 'Triebwerk',
  tank: 'Tank',
  legs: 'Landebein',
  scanner: 'Scanner',
  shield: 'Schild',
  cargo: 'Frachtraum',
};

/** Welcher Sockel-Typ ein Teil aufnimmt (Rumpf ist die Wurzel). */
export const SOCKET_FOR_TYPE: Record<PartType, SocketKind | null> = {
  hull: null,
  cockpit: 'top',
  engine: 'bottom',
  legs: 'leg',
  tank: 'side',
  scanner: 'side',
  shield: 'side',
  cargo: 'side',
};

export const SOCKET_LABELS: Record<SocketKind, string> = { top: 'Oben', bottom: 'Unten', leg: 'Beinhalterung', side: 'Seite' };

function hullSockets(radius: number, height: number, bottoms: number, legs: number, sides: number): SocketDef[] {
  const out: SocketDef[] = [{ kind: 'top', x: 0, y: height, z: 0, angle: 0 }];
  for (let i = 0; i < bottoms; i++) {
    const a = bottoms === 1 ? 0 : (i / bottoms) * Math.PI * 2;
    const r = bottoms === 1 ? 0 : radius * 0.5;
    out.push({ kind: 'bottom', x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, angle: a });
  }
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + Math.PI / legs;
    out.push({ kind: 'leg', x: Math.cos(a) * radius, y: 0.35, z: Math.sin(a) * radius, angle: a });
  }
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    out.push({ kind: 'side', x: Math.cos(a) * radius, y: height * 0.48, z: Math.sin(a) * radius, angle: a });
  }
  return out;
}

export const PART_DEFS: PartDef[] = [
  { id: 'hull_1', type: 'hull', tier: 1, name: 'Leichter Rumpf', description: '3 Beinhalterungen, 1 Triebwerk, 3 seitliche Anbauten.', mass: 6, cost: { ferrite: 18, quartz: 6 }, hull: { radius: 1.1, height: 3.6, sockets: hullSockets(1.1, 3.6, 1, 3, 3) } },
  { id: 'hull_2', type: 'hull', tier: 2, name: 'Mittlerer Rumpf', description: '4 Beine, 2 Triebwerke, 5 seitliche Anbauten.', mass: 10, cost: { ferrite: 30, quartz: 12, fiber: 6 }, hull: { radius: 1.5, height: 5, sockets: hullSockets(1.5, 5, 2, 4, 5) } },
  { id: 'hull_3', type: 'hull', tier: 3, name: 'Schwerer Rumpf', description: '4 Beine, 3 Triebwerke, 7 seitliche Anbauten.', mass: 16, cost: { ferrite: 48, quartz: 20, fiber: 10 }, hull: { radius: 2.0, height: 6.5, sockets: hullSockets(2.0, 6.5, 3, 4, 7) } },
  { id: 'cockpit_1', type: 'cockpit', tier: 1, name: 'Kanzel', description: 'Steuerung und Lebenserhaltung. Pflicht.', mass: 2, cost: { ferrite: 6, quartz: 6 } },
  { id: 'engine_1', type: 'engine', tier: 1, name: 'Standardtriebwerk', description: '220 kN Schub.', mass: 2.5, cost: { ferrite: 12, quartz: 6, water: 2 }, thrust: 220, efficiency: 1 },
  { id: 'engine_2', type: 'engine', tier: 2, name: 'Plasmatriebwerk', description: '360 kN Schub, 25 % sparsamer. Nötig für schwere Welten und Gasriesen-Orbits.', mass: 3.5, cost: { ferrite: 22, quartz: 14, fiber: 4 }, thrust: 360, efficiency: 1.25 },
  { id: 'engine_3', type: 'engine', tier: 3, name: 'Fusionstriebwerk', description: '540 kN Schub, 50 % sparsamer. Erreicht jede Welt.', mass: 5, cost: { ferrite: 36, quartz: 24, fiber: 8, water: 6 }, thrust: 540, efficiency: 1.5 },
  { id: 'tank_1', type: 'tank', tier: 1, name: 'Tank', description: '20 Einheiten Treibstoff.', mass: 1.5, cost: { ferrite: 8, quartz: 3 }, fuelCapacity: 20 },
  { id: 'tank_2', type: 'tank', tier: 2, name: 'Großtank', description: '40 Einheiten Treibstoff.', mass: 2.5, cost: { ferrite: 16, quartz: 8 }, fuelCapacity: 40 },
  { id: 'tank_3', type: 'tank', tier: 3, name: 'Schwertank', description: '70 Einheiten Treibstoff.', mass: 4, cost: { ferrite: 28, quartz: 14, fiber: 4 }, fuelCapacity: 70 },
  { id: 'legs_1', type: 'legs', tier: 1, name: 'Landebein', description: 'Bis 1,6 g. Mindestens drei Beine für eine Landung.', mass: 0.8, cost: { ferrite: 4 }, legRating: 1.6 },
  { id: 'legs_2', type: 'legs', tier: 2, name: 'Schwerlast-Landebein', description: 'Bis 2,6 g.', mass: 1.2, cost: { ferrite: 8, quartz: 2 }, legRating: 2.6 },
  { id: 'shield_1', type: 'shield', tier: 1, name: 'Schildgenerator I', description: 'Schutzstufe 1: Strahlungszonen und dichte Atmosphären.', mass: 2, cost: { ferrite: 14, quartz: 10 }, shield: 1 },
  { id: 'shield_2', type: 'shield', tier: 2, name: 'Schildgenerator II', description: 'Schutzstufe 2: Glutwelten und harte Strahlung.', mass: 3, cost: { ferrite: 24, quartz: 18, fiber: 6 }, shield: 2 },
  { id: 'scanner_1', type: 'scanner', tier: 1, name: 'Orbitalscanner', description: 'Höhenkarte aus dem Orbit (Phase 7).', mass: 1.2, cost: { ferrite: 8, quartz: 8 }, scanner: 1 },
  { id: 'scanner_2', type: 'scanner', tier: 2, name: 'Tiefenscanner', description: 'Biom-, Erz- und Lebenszeichen-Layer (Phase 7).', mass: 1.8, cost: { ferrite: 14, quartz: 14, fiber: 4 }, scanner: 2 },
  { id: 'cargo_1', type: 'cargo', tier: 1, name: 'Frachtraum', description: '1 Sonden-Slot (Phase 7).', mass: 1.5, cost: { ferrite: 10, fiber: 4 }, cargo: 1 },
  { id: 'cargo_2', type: 'cargo', tier: 2, name: 'Großer Frachtraum', description: '2 Sonden-Slots (Phase 7).', mass: 2.5, cost: { ferrite: 18, fiber: 8, quartz: 4 }, cargo: 2 },
];

export const PART_BY_ID: Record<string, PartDef> = Object.fromEntries(PART_DEFS.map((p) => [p.id, p]));

export function partDef(id: string): PartDef {
  const def = PART_BY_ID[id];
  if (!def) throw new Error(`Unbekanntes Schiffsteil: ${id}`);
  return def;
}

/** Teile, die ohne Bauplan verfügbar sind (Stufe 1). */
export function isBasePart(id: string): boolean {
  return partDef(id).tier === 1;
}

/** Rohstoffe, die irgendein Teil braucht (Test: Teilmenge der garantierten Startrohstoffe). */
export function partResourceIds(): string[] {
  const set = new Set<string>();
  for (const p of PART_DEFS) for (const id of Object.keys(p.cost)) set.add(id);
  return Array.from(set);
}
