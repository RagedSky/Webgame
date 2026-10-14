/**
 * Spielerzustand je Seed (rein, serialisierbar): Inventar, Überleben, Basis-Module, Labor-Stufe, Respawn.
 * Wird getrennt vom Archiv-Fortschritt gespeichert (IndexedDB kv `player:<seed>`).
 */
import { Inventory, type InventorySnapshot } from './Inventory';
import { Survival, type SurvivalState } from './survival/Survival';
import type { ModuleType } from './crafting/recipes';
import { starterDesign, type ShipDesign } from './ship/ShipDesign';
import { milestonesEarned, nextBlueprint } from './ship/blueprints';

export const PLAYER_STATE_VERSION = 2;

export type ShipLocation = { kind: 'surface'; planetId: string; x: number; z: number; rot: number } | { kind: 'orbit'; planetId: string };

export interface ShipState {
  design: ShipDesign;
  /** Treibstoff im Tank (Einheiten). */
  fuel: number;
  /** null = noch nicht platziert (Landeplatz des Startplaneten wird beim ersten Betreten gesetzt). */
  location: ShipLocation | null;
  /** Anzahl erfolgreicher Starts. */
  flights: number;
}

export function defaultShip(): ShipState {
  return { design: starterDesign(), fuel: 0, location: null, flights: 0 };
}

export interface BaseModule {
  id: string;
  type: ModuleType;
  planetId: string;
  x: number;
  z: number;
  /** Rotation in 90°-Schritten (0–3). */
  rot: number;
}

export interface PlayerStateSnapshot {
  version: number;
  seed: string;
  inventory: InventorySnapshot;
  survival: SurvivalState;
  modules: BaseModule[];
  labLevel: number;
  /** Respawn-Punkt (Unterkunft) je Planet. */
  respawn: Record<string, { x: number; z: number }>;
  /** Tutorial-/Zielschritt für das HUD. */
  goalStep: number;
  ship: ShipState;
  /** Freigeschaltete Baupläne (Teil-IDs ab Stufe 2). */
  blueprints: string[];
  /** Ruinen-Einträge, die bereits einen Bauplan geliefert haben. */
  scannedRuins: string[];
  /** Bereits eingelöste Archiv-Meilensteine. */
  milestonesClaimed: number;
  /** Landeplätze je Planet (Rückkehr landet an derselben Stelle). */
  sites: Record<string, { x: number; z: number; rot: number }>;
  updatedAt: number;
}

export class PlayerState {
  readonly inventory: Inventory;
  readonly survival: Survival;
  readonly modules: BaseModule[] = [];
  labLevel = 0;
  readonly respawn: Record<string, { x: number; z: number }> = {};
  goalStep = 0;
  ship: ShipState = defaultShip();
  readonly blueprints: string[] = [];
  readonly scannedRuins: string[] = [];
  milestonesClaimed = 0;
  readonly sites: Record<string, { x: number; z: number; rot: number }> = {};
  private counter = 0;
  private listeners = new Set<() => void>();

  constructor(
    readonly seed: string,
    inventory = new Inventory(),
    survival = new Survival(),
  ) {
    this.inventory = inventory;
    this.survival = survival;
    this.inventory.onChange(() => this.emit());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  touch(): void {
    this.emit();
  }

  modulesOn(planetId: string): BaseModule[] {
    return this.modules.filter((m) => m.planetId === planetId);
  }

  hasModule(planetId: string, type: ModuleType): boolean {
    return this.modules.some((m) => m.planetId === planetId && m.type === type);
  }

  addModule(type: ModuleType, planetId: string, x: number, z: number, rot: number): BaseModule {
    const m: BaseModule = { id: `m-${planetId}-${++this.counter}-${Math.round(x)}-${Math.round(z)}`, type, planetId, x, z, rot };
    this.modules.push(m);
    if (type === 'shelter' && !this.respawn[planetId]) this.respawn[planetId] = { x, z };
    this.emit();
    return m;
  }

  /** Nächsten Bauplan freischalten (null, wenn alle gefunden). */
  unlockBlueprint(): string | null {
    const id = nextBlueprint(this.seed, this.blueprints);
    if (!id) return null;
    this.blueprints.push(id);
    this.emit();
    return id;
  }

  /** Ruine zum ersten Mal gescannt → Bauplan (sofern noch welche offen sind). */
  grantRuinBlueprint(entryId: string): string | null {
    if (this.scannedRuins.includes(entryId)) return null;
    this.scannedRuins.push(entryId);
    const id = this.unlockBlueprint();
    if (!id) this.emit();
    return id;
  }

  /** Archiv-Meilensteine einlösen; liefert die neu freigeschalteten Pläne. */
  claimMilestones(fraction: number): string[] {
    const earned = milestonesEarned(fraction);
    const out: string[] = [];
    while (this.milestonesClaimed < earned) {
      this.milestonesClaimed++;
      const id = this.unlockBlueprint();
      if (id) out.push(id);
    }
    if (out.length === 0 && earned > 0) this.emit();
    return out;
  }

  removeModule(id: string): BaseModule | null {
    const i = this.modules.findIndex((m) => m.id === id);
    if (i < 0) return null;
    const [m] = this.modules.splice(i, 1);
    if (m && m.type === 'shelter') {
      const other = this.modules.find((x) => x.planetId === m.planetId && x.type === 'shelter');
      if (other) this.respawn[m.planetId] = { x: other.x, z: other.z };
      else delete this.respawn[m.planetId];
    }
    this.emit();
    return m ?? null;
  }

  toJSON(): PlayerStateSnapshot {
    return {
      version: PLAYER_STATE_VERSION,
      seed: this.seed,
      inventory: this.inventory.toJSON(),
      survival: this.survival.toJSON(),
      modules: this.modules.map((m) => ({ ...m })),
      labLevel: this.labLevel,
      respawn: { ...this.respawn },
      goalStep: this.goalStep,
      ship: { design: { hullId: this.ship.design.hullId, parts: this.ship.design.parts.map((p) => ({ ...p })) }, fuel: this.ship.fuel, location: this.ship.location ? { ...this.ship.location } : null, flights: this.ship.flights },
      blueprints: this.blueprints.slice(),
      scannedRuins: this.scannedRuins.slice(),
      milestonesClaimed: this.milestonesClaimed,
      sites: { ...this.sites },
      updatedAt: Date.now(),
    };
  }

  static fromJSON(snapshot: PlayerStateSnapshot): PlayerState {
    const s = migratePlayerState(snapshot);
    const p = new PlayerState(s.seed, Inventory.fromJSON(s.inventory), new Survival(s.survival));
    p.modules.push(...s.modules.map((m) => ({ ...m })));
    p.labLevel = s.labLevel;
    Object.assign(p.respawn, s.respawn);
    p.goalStep = s.goalStep;
    p.ship = { design: { hullId: s.ship.design.hullId, parts: s.ship.design.parts.map((x) => ({ ...x })) }, fuel: s.ship.fuel, location: s.ship.location ? { ...s.ship.location } : null, flights: s.ship.flights };
    p.blueprints.push(...s.blueprints);
    p.scannedRuins.push(...s.scannedRuins);
    p.milestonesClaimed = s.milestonesClaimed;
    Object.assign(p.sites, s.sites);
    p.counter = s.modules.length;
    return p;
  }
}

export function migratePlayerState(s: PlayerStateSnapshot): PlayerStateSnapshot {
  const out = { ...s };
  if (!out.version || out.version < 1) out.version = 1;
  out.inventory ??= { resources: {}, items: {} };
  out.survival ??= { oxygen: 100, energy: 100 };
  out.modules ??= [];
  out.labLevel ??= 0;
  out.respawn ??= {};
  out.goalStep ??= 0;
  if (out.version < 2) {
    out.version = 2;
    out.ship = defaultShip();
    out.blueprints = [];
    out.scannedRuins = [];
    out.milestonesClaimed = 0;
  }
  out.ship ??= defaultShip();
  out.ship.design ??= starterDesign();
  out.ship.fuel ??= 0;
  out.ship.location ??= null;
  out.ship.flights ??= 0;
  out.blueprints ??= [];
  out.scannedRuins ??= [];
  out.milestonesClaimed ??= 0;
  out.sites ??= {};
  return out;
}
