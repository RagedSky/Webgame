/**
 * Spielerzustand je Seed (rein, serialisierbar): Inventar, Überleben, Basis-Module, Labor-Stufe, Respawn.
 * Wird getrennt vom Archiv-Fortschritt gespeichert (IndexedDB kv `player:<seed>`).
 */
import { Inventory, type InventorySnapshot } from './Inventory';
import { Survival, type SurvivalState } from './survival/Survival';
import type { ModuleType } from './crafting/recipes';
import { starterDesign, type ShipDesign } from './ship/ShipDesign';
import { milestonesEarned, nextBlueprint } from './ship/blueprints';
import { MapGrid } from './map/MapGrid';
import { migrateCharacter, type CharacterConfig } from './character/Character';

export const PLAYER_STATE_VERSION = 4;

export interface MapMarker {
  x: number;
  z: number;
  label: string;
}

export interface PlanetMapSnapshot {
  explored: string;
  markers: MapMarker[];
}

export interface RoverState {
  x: number;
  z: number;
  yaw: number;
}

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
  /** Karten je Planet: Fog of War (Base64) und Marker. */
  maps: Record<string, PlanetMapSnapshot>;
  /** Satelliten-Stufe je Planet (0/fehlend = keiner). */
  satellites: Record<string, number>;
  /** Abgesetzter Rover je Planet. */
  rovers: Record<string, RoverState>;
  /** Tiefseesonden je Planet (Positionen). */
  deepProbes: Record<string, Array<{ x: number; z: number }>>;
  /** Gasriesen mit gestarteter Atmosphärensonde. */
  atmoProbes: string[];
  /** Charakter (null = noch nicht erstellt → Editor vor dem ersten Spiel). */
  character: CharacterConfig | null;
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
  readonly satellites: Record<string, number> = {};
  readonly rovers: Record<string, RoverState> = {};
  readonly deepProbes: Record<string, Array<{ x: number; z: number }>> = {};
  readonly atmoProbes: string[] = [];
  readonly markers: Record<string, MapMarker[]> = {};
  character: CharacterConfig | null = null;
  private readonly grids = new Map<string, MapGrid>();
  private readonly gridData: Record<string, string> = {};
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

  /** Kartenraster eines Planeten (lazy aus dem Spielstand, Kantenlänge in Metern). */
  mapGrid(planetId: string, size: number): MapGrid {
    let g = this.grids.get(planetId);
    if (!g) {
      g = MapGrid.fromBase64(size, this.gridData[planetId]);
      this.grids.set(planetId, g);
    }
    return g;
  }

  markersOn(planetId: string): MapMarker[] {
    return (this.markers[planetId] ??= []);
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
      maps: this.mapsSnapshot(),
      satellites: { ...this.satellites },
      rovers: Object.fromEntries(Object.entries(this.rovers).map(([k, v]) => [k, { ...v }])),
      deepProbes: Object.fromEntries(Object.entries(this.deepProbes).map(([k, v]) => [k, v.map((p) => ({ ...p }))])),
      atmoProbes: this.atmoProbes.slice(),
      character: this.character ? migrateCharacter(this.character) : null,
      updatedAt: Date.now(),
    };
  }

  private mapsSnapshot(): Record<string, PlanetMapSnapshot> {
    const out: Record<string, PlanetMapSnapshot> = {};
    const ids = new Set([...Object.keys(this.gridData), ...this.grids.keys(), ...Object.keys(this.markers)]);
    for (const id of ids) {
      const grid = this.grids.get(id);
      const explored = grid ? (grid.cells.some((v) => v > 0) ? grid.toBase64() : '') : (this.gridData[id] ?? '');
      const markers = (this.markers[id] ?? []).map((m) => ({ ...m }));
      if (!explored && markers.length === 0) continue;
      out[id] = { explored, markers };
    }
    return out;
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
    for (const [id, m] of Object.entries(s.maps)) {
      if (m.explored) p.gridData[id] = m.explored;
      if (m.markers?.length) p.markers[id] = m.markers.map((x) => ({ ...x }));
    }
    Object.assign(p.satellites, s.satellites);
    for (const [id, r] of Object.entries(s.rovers)) p.rovers[id] = { ...r };
    for (const [id, list] of Object.entries(s.deepProbes)) p.deepProbes[id] = list.map((x) => ({ ...x }));
    p.atmoProbes.push(...s.atmoProbes);
    p.character = s.character ? migrateCharacter(s.character) : null;
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
  if (out.version < 3) out.version = 3;
  out.maps ??= {};
  out.satellites ??= {};
  out.rovers ??= {};
  out.deepProbes ??= {};
  out.atmoProbes ??= [];
  if (out.version < 4) out.version = 4;
  out.character ??= null;
  return out;
}
