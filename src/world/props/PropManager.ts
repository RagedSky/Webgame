import { Group, Mesh, Raycaster, Vector3, type Scene } from 'three';
import { Random } from '@/math/Random';
import type { TerrainModel, TerrainSample } from '@/gen/terrain/TerrainModel';
import type { Planet } from '@/gen/universe/types';
import type { ArchiveEntry } from '@/gen/archive/types';
import { RARITY_SPAWN_WEIGHT, matchesPlacement } from '@/gen/archive/conditions';
import { buildPropTemplate, type PropTemplate } from './PropBuilder';

export interface WorldProp {
  id: string;
  entry: ArchiveEntry;
  mesh: Mesh;
  radius: number;
  center: Vector3;
}

interface Cell {
  id: string;
  props: WorldProp[];
}

const tmpSample: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };
const CELL = 128;

/**
 * Platziert Erze, Gesteine, Fossilien und Ruinen als anklickbare Objekte in Zellen (128 m) um den Spieler.
 * Deterministisch aus Terrain-Seed + Zelle; Seltenheit steuert die Wahrscheinlichkeit je Zelle.
 */
export class PropManager {
  readonly group = new Group();
  readonly stats = { cells: 0, props: 0 };
  private readonly cells = new Map<string, Cell>();
  private readonly templates = new Map<string, PropTemplate>();
  private readonly entries: ArchiveEntry[];
  private accum = 1;
  private readonly raycaster = new Raycaster();

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    private readonly planet: Planet,
    entries: ArchiveEntry[],
    private readonly radius = 260,
  ) {
    this.entries = entries.filter((e) => e.planetId === planet.id && (e.category === 'ore' || e.category === 'rock' || e.category === 'fossil'));
    scene.add(this.group);
  }

  private template(entry: ArchiveEntry): PropTemplate {
    let t = this.templates.get(entry.id);
    if (!t) {
      t = buildPropTemplate(entry);
      this.templates.set(entry.id, t);
    }
    return t;
  }

  private buildCell(ix: number, iz: number): Cell {
    const id = `${ix}:${iz}`;
    const rng = new Random(`props:${this.planet.terrainSeed}:${ix}:${iz}`);
    const props: WorldProp[] = [];
    const x0 = ix * CELL;
    const z0 = iz * CELL;
    for (const entry of this.entries) {
      const chance = RARITY_SPAWN_WEIGHT[entry.rarity] * (entry.category === 'fossil' ? 0.55 : 0.8);
      const count = (rng.next() < chance ? 1 : 0) + (entry.rarity === 'common' && rng.next() < 0.35 ? 1 : 0);
      for (let c = 0; c < count; c++) {
        // bis zu 4 Versuche, einen passenden Punkt zu finden
        for (let attempt = 0; attempt < 4; attempt++) {
          const x = x0 + rng.next() * CELL;
          const z = z0 + rng.next() * CELL;
          const s = this.model.sample(x, z, tmpSample);
          const biome = this.planet.biomes[s.blend > 0.5 ? s.biome2 : s.biome]!;
          const underwater = this.model.hasWater && s.height < this.model.seaLevel - 0.3;
          if (underwater || !matchesPlacement(entry, biome, s.altitude, false, 0.03)) continue;
          if (this.model.slopeAt(x, z, 1) > 0.75) continue;
          const t = this.template(entry);
          const mesh = new Mesh(t.geometry, t.material);
          const scale = rng.float(0.85, 1.2);
          mesh.scale.setScalar(scale);
          mesh.position.set(x, s.height - 0.02, z);
          mesh.rotation.y = rng.float(0, Math.PI * 2);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.entryId = entry.id;
          this.group.add(mesh);
          props.push({ id: `${entry.id}@${ix}:${iz}:${c}`, entry, mesh, radius: t.radius * scale, center: new Vector3(x, s.height + t.centerY * scale, z) });
          break;
        }
      }
    }
    return { id, props };
  }

  private refresh(cx: number, cz: number): void {
    const wanted = new Set<string>();
    const i0 = Math.floor((cx - this.radius) / CELL);
    const i1 = Math.floor((cx + this.radius) / CELL);
    const j0 = Math.floor((cz - this.radius) / CELL);
    const j1 = Math.floor((cz + this.radius) / CELL);
    for (let iz = j0; iz <= j1; iz++) {
      for (let ix = i0; ix <= i1; ix++) {
        const id = `${ix}:${iz}`;
        wanted.add(id);
        if (!this.cells.has(id)) this.cells.set(id, this.buildCell(ix, iz));
      }
    }
    for (const [id, cell] of this.cells) {
      if (wanted.has(id)) continue;
      for (const p of cell.props) this.group.remove(p.mesh);
      this.cells.delete(id);
    }
    this.stats.cells = this.cells.size;
    let n = 0;
    for (const c of this.cells.values()) n += c.props.length;
    this.stats.props = n;
  }

  update(cameraPos: Vector3, dt: number): void {
    this.accum += dt;
    if (this.accum >= 1) {
      this.accum = 0;
      this.refresh(cameraPos.x, cameraPos.z);
    }
  }

  /** Alle Props in Reichweite (für Fotomotive). */
  nearby(pos: Vector3, radius: number, out: WorldProp[] = []): WorldProp[] {
    out.length = 0;
    for (const cell of this.cells.values()) {
      for (const p of cell.props) {
        if (Math.hypot(p.center.x - pos.x, p.center.z - pos.z) <= radius) out.push(p);
      }
    }
    return out;
  }

  /** Prop im Fadenkreuz (Raycast aus der Kamera) innerhalb maxDist. */
  pick(origin: Vector3, dir: Vector3, maxDist: number): { prop: WorldProp; distance: number } | null {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(this.group.children, false);
    if (!hits.length) return null;
    const hit = hits[0]!;
    const entryId = hit.object.userData.entryId as string;
    for (const cell of this.cells.values()) {
      for (const p of cell.props) if (p.mesh === hit.object) return { prop: p, distance: hit.distance };
    }
    void entryId;
    return null;
  }

  /** Entfernt ein Prop (z. B. nach Probenentnahme). */
  remove(prop: WorldProp): void {
    for (const cell of this.cells.values()) {
      const i = cell.props.indexOf(prop);
      if (i >= 0) {
        cell.props.splice(i, 1);
        this.group.remove(prop.mesh);
        return;
      }
    }
  }

  dispose(): void {
    for (const cell of this.cells.values()) for (const p of cell.props) this.group.remove(p.mesh);
    this.cells.clear();
    for (const t of this.templates.values()) {
      t.geometry.dispose();
      t.material.dispose();
    }
    this.templates.clear();
    this.group.removeFromParent();
  }
}
