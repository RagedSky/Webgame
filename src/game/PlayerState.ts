/**
 * Spielerzustand je Seed (rein, serialisierbar): Inventar, Überleben, Basis-Module, Labor-Stufe, Respawn.
 * Wird getrennt vom Archiv-Fortschritt gespeichert (IndexedDB kv `player:<seed>`).
 */
import { Inventory, type InventorySnapshot } from './Inventory';
import { Survival, type SurvivalState } from './survival/Survival';
import type { ModuleType } from './crafting/recipes';

export const PLAYER_STATE_VERSION = 1;

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
  updatedAt: number;
}

export class PlayerState {
  readonly inventory: Inventory;
  readonly survival: Survival;
  readonly modules: BaseModule[] = [];
  labLevel = 0;
  readonly respawn: Record<string, { x: number; z: number }> = {};
  goalStep = 0;
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
  return out;
}
