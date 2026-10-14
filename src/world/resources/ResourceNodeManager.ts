import { Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, OctahedronGeometry, Quaternion, Raycaster, SphereGeometry, Vector3, type BufferGeometry, type Scene } from 'three';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import { NODE_CELL, generateResourceNodes, type ResourceNode } from '@/gen/terrain/ResourceNodes';
import { RESOURCES } from '@/gen/universe/catalog';
import type { Planet, ResourceId } from '@/gen/universe/types';
import { colorize, jitter, mergeParts, taperedQuad } from '../geometry';

export const RESOURCE_COLORS: Record<ResourceId, string> = {
  ferrite: '#8a4a2a', cuprite: '#2a8a7a', titanite: '#b8c0c8', cobaltite: '#3a5ab8', aurum: '#e0b020',
  quartz: '#e8eef5', lumite: '#5ae8ff', obsidian: '#1a1a22', silica: '#e0d0a0', sulfur: '#f0e040', carbon: '#2a2a2a',
  phosphor: '#c0e8a0', uranite: '#70e040', saltpeter: '#f0f0f0', perchlorate: '#d8c8f0', peroxide_ice: '#c0e8ff',
  water: '#3a8ac0', ice: '#d8f0ff', brine: '#80a8c0', hydrogen: '#c0d8ff', methane: '#80c0ff', ammonia: '#a0d0c0',
  nitrogen: '#d0d8e0', helium3: '#ffe0a0', fiber: '#8ab060', resin: '#e09030', spores: '#c080c0',
};

interface NodeTemplate {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  radius: number;
  centerY: number;
  /** Ein InstancedMesh je Rohstoffart (ein Draw-Call), Instanz-Index → Knoten. */
  mesh: InstancedMesh;
  slots: LiveNode[];
}

interface LiveNode {
  node: ResourceNode;
  remaining: number;
  respawnAt: number;
}

interface Cell {
  id: string;
  nodes: LiveNode[];
}

const ROCK = new Color(0.4, 0.38, 0.36);
const RESPAWN_SECONDS = 600;
const CAPACITY = 768;
const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);

function buildTemplateGeometry(id: ResourceId): { geometry: BufferGeometry; material: MeshStandardMaterial; radius: number; centerY: number } {
  const def = RESOURCES[id];
  const col = new Color(RESOURCE_COLORS[id]);
  const parts: BufferGeometry[] = [];
  let radius = 0.7;
  let centerY = 0.4;
  let glow = false;
  switch (def.kind) {
    case 'metal': {
      const rock = new DodecahedronGeometry(0.55, 0);
      rock.scale(1, 0.75, 1);
      rock.translate(0, 0.35, 0);
      parts.push(colorize(jitter(rock, 0.06, `node:${id}`), ROCK.clone().lerp(col, 0.25), 0.3));
      for (let i = 0; i < 5; i++) {
        const o = new OctahedronGeometry(0.14, 0);
        const a = (i / 5) * Math.PI * 2;
        o.translate(Math.cos(a) * 0.38, 0.45 + (i % 2) * 0.15, Math.sin(a) * 0.38);
        parts.push(colorize(o, col));
      }
      break;
    }
    case 'crystal': {
      for (let i = 0; i < 6; i++) {
        const o = new OctahedronGeometry(0.16, 0);
        o.scale(1, 2.6 + (i % 3) * 0.6, 1);
        o.rotateX((i % 2) * 0.3 - 0.15);
        o.rotateZ(((i % 3) - 1) * 0.3);
        o.rotateY((i / 6) * Math.PI * 2);
        o.translate(Math.cos(i) * 0.25, 0.35, Math.sin(i) * 0.25);
        parts.push(colorize(o, col, 0.3));
      }
      const base = new DodecahedronGeometry(0.4, 0);
      base.scale(1, 0.4, 1);
      parts.push(colorize(base, ROCK));
      glow = id === 'lumite';
      centerY = 0.5;
      break;
    }
    case 'mineral': {
      if (id === 'silica') {
        const pile = new ConeGeometry(0.8, 0.5, 10);
        pile.translate(0, 0.25, 0);
        parts.push(colorize(jitter(pile, 0.03, 'silica'), col, 0.2));
        centerY = 0.25;
      } else {
        const n = new SphereGeometry(0.5, 10, 7);
        n.scale(1.2, 0.7, 1);
        n.translate(0, 0.3, 0);
        parts.push(colorize(jitter(n, 0.06, `node:${id}`), col.clone().lerp(ROCK, 0.3), 0.3));
        for (let i = 0; i < 4; i++) {
          const b = new SphereGeometry(0.16, 6, 5);
          b.translate(Math.cos(i * 1.6) * 0.45, 0.35, Math.sin(i * 1.6) * 0.4);
          parts.push(colorize(b, col));
        }
      }
      glow = id === 'uranite' || id === 'lumite';
      break;
    }
    case 'gas': {
      const crater = new ConeGeometry(0.9, 0.5, 12, 1, true);
      crater.scale(1, -1, 1);
      crater.translate(0, 0.25, 0);
      parts.push(colorize(crater, ROCK.clone().multiplyScalar(0.8)));
      const rim = new CylinderGeometry(0.95, 1.05, 0.25, 12, 1, true);
      rim.translate(0, 0.12, 0);
      parts.push(colorize(rim, ROCK));
      const column = new CylinderGeometry(0.25, 0.45, 1.6, 8, 1, true);
      column.translate(0, 1.0, 0);
      parts.push(colorize(column, col, 0.6));
      radius = 1;
      centerY = 0.6;
      glow = true;
      break;
    }
    case 'organic': {
      if (id === 'fiber') {
        for (let i = 0; i < 9; i++) {
          const b = taperedQuad(0.12, 0.9 + (i % 3) * 0.2, 0.01);
          b.rotateX(-0.25 + (i % 2) * 0.1);
          b.rotateY((i / 9) * Math.PI * 2);
          parts.push(colorize(b, col, 0.5));
        }
        centerY = 0.5;
      } else if (id === 'resin') {
        const stump = new CylinderGeometry(0.3, 0.38, 0.6, 8);
        stump.translate(0, 0.3, 0);
        parts.push(colorize(stump, new Color(0.35, 0.22, 0.12)));
        const blob = new SphereGeometry(0.22, 8, 6);
        blob.translate(0.2, 0.62, 0);
        parts.push(colorize(blob, col));
        centerY = 0.45;
      } else {
        const puff = new SphereGeometry(0.4, 10, 7);
        puff.scale(1, 0.8, 1);
        puff.translate(0, 0.35, 0);
        parts.push(colorize(jitter(puff, 0.03, 'spores'), col, 0.3));
      }
      break;
    }
    case 'liquid':
      break;
  }
  const geometry = mergeParts(parts, `node ${id}`);
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: def.kind === 'crystal' ? 0.25 : def.kind === 'metal' ? 0.6 : 0.9,
    metalness: def.kind === 'metal' ? 0.35 : 0,
    emissive: glow ? col : new Color(0, 0, 0),
    emissiveIntensity: glow ? 0.45 : 0,
    transparent: def.kind === 'gas',
    opacity: def.kind === 'gas' ? 0.55 : 1,
  });
  return { geometry, material, radius, centerY };
}

/**
 * Abbaubare Rohstoffknoten in Zellen (128 m) um den Spieler. Je Rohstoffart ein InstancedMesh (ein Draw-Call,
 * Phase 9), Raycast per Instanz-Index plus Kegel-Fallback, Abbau mit Restmenge und Respawn nach 10 Minuten.
 */
export class ResourceNodeManager {
  readonly group = new Group();
  readonly stats = { nodes: 0, drawCalls: 0 };
  private readonly cells = new Map<string, Cell>();
  private readonly templates = new Map<ResourceId, NodeTemplate>();
  /** Abgebaute Knoten (id → Restmenge/Respawn) über Zellwechsel hinweg. */
  private readonly depleted = new Map<string, { remaining: number; respawnAt: number }>();
  private readonly raycaster = new Raycaster();
  private readonly tmpMatrix = new Matrix4();
  private readonly tmpQuat = new Quaternion();
  private readonly tmpPos = new Vector3();
  private readonly dirty = new Set<ResourceId>();
  private accum = 1;
  private clock = 0;

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    private readonly planet: Planet,
    private readonly radius = 220,
  ) {
    scene.add(this.group);
  }

  private template(id: ResourceId): NodeTemplate {
    let t = this.templates.get(id);
    if (!t) {
      const base = buildTemplateGeometry(id);
      const mesh = new InstancedMesh(base.geometry, base.material, CAPACITY);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.resourceId = id;
      this.group.add(mesh);
      t = { ...base, mesh, slots: [] };
      this.templates.set(id, t);
    }
    return t;
  }

  private buildCell(ix: number, iz: number): Cell {
    const nodes: LiveNode[] = [];
    for (const node of generateResourceNodes(this.model, this.planet, ix, iz)) {
      this.template(node.resourceId);
      const saved = this.depleted.get(node.id);
      nodes.push({ node, remaining: saved?.remaining ?? node.amount, respawnAt: saved?.respawnAt ?? 0 });
      this.dirty.add(node.resourceId);
    }
    return { id: `${ix}:${iz}`, nodes };
  }

  /** Instanzmatrizen einer Rohstoffart neu schreiben (nur sichtbare Knoten belegen Instanzen). */
  private rebuildInstances(id: ResourceId): void {
    const t = this.templates.get(id);
    if (!t) return;
    t.slots.length = 0;
    let i = 0;
    for (const cell of this.cells.values()) {
      for (const n of cell.nodes) {
        if (n.node.resourceId !== id || n.remaining <= 0 || i >= CAPACITY) continue;
        const rot = (n.node.x * 7.3 + n.node.z * 3.1) % (Math.PI * 2);
        this.tmpQuat.setFromAxisAngle(UP, rot);
        this.tmpPos.set(n.node.x, n.node.y - 0.05, n.node.z);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, ONE);
        t.mesh.setMatrixAt(i, this.tmpMatrix);
        t.slots[i] = n;
        i++;
      }
    }
    t.mesh.count = i;
    t.mesh.instanceMatrix.needsUpdate = true;
  }

  private refresh(cx: number, cz: number): void {
    const wanted = new Set<string>();
    const i0 = Math.floor((cx - this.radius) / NODE_CELL);
    const i1 = Math.floor((cx + this.radius) / NODE_CELL);
    const j0 = Math.floor((cz - this.radius) / NODE_CELL);
    const j1 = Math.floor((cz + this.radius) / NODE_CELL);
    for (let iz = j0; iz <= j1; iz++) {
      for (let ix = i0; ix <= i1; ix++) {
        const id = `${ix}:${iz}`;
        wanted.add(id);
        if (!this.cells.has(id)) this.cells.set(id, this.buildCell(ix, iz));
      }
    }
    for (const [id, cell] of this.cells) {
      if (wanted.has(id)) continue;
      for (const n of cell.nodes) this.dirty.add(n.node.resourceId);
      this.cells.delete(id);
    }
    let count = 0;
    for (const c of this.cells.values()) count += c.nodes.length;
    this.stats.nodes = count;
  }

  private flushDirty(): void {
    for (const id of this.dirty) this.rebuildInstances(id);
    this.dirty.clear();
    let calls = 0;
    for (const t of this.templates.values()) if (t.mesh.count > 0) calls++;
    this.stats.drawCalls = calls;
  }

  update(cameraPos: Vector3, dt: number): void {
    this.clock += dt;
    this.accum += dt;
    if (this.accum >= 1) {
      this.accum = 0;
      this.refresh(cameraPos.x, cameraPos.z);
      for (const cell of this.cells.values()) {
        for (const n of cell.nodes) {
          if (n.remaining <= 0 && this.clock >= n.respawnAt) {
            n.remaining = n.node.amount;
            this.depleted.delete(n.node.id);
            this.dirty.add(n.node.resourceId);
          }
        }
      }
      this.flushDirty();
    }
  }

  /** Für Tests/Debug: Zellen um eine Position sofort aufbauen. */
  refreshNow(x: number, z: number): void {
    this.refresh(x, z);
    this.flushDirty();
  }

  /**
   * Knoten im Blick: zuerst exakter Raycast (Instanz-Index), sonst nächster Knoten in einem engen Kegel
   * (dünne Kristalle und Büschel sind sonst schwer zu treffen).
   */
  pick(origin: Vector3, dir: Vector3, maxDist: number): { node: LiveNode; distance: number } | null {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(this.group.children, false);
    for (const hit of hits) {
      const id = hit.object.userData.resourceId as ResourceId | undefined;
      const t = id ? this.templates.get(id) : undefined;
      const n = t && hit.instanceId !== undefined ? t.slots[hit.instanceId] : undefined;
      if (n && n.remaining > 0) return { node: n, distance: hit.distance };
    }
    let best: LiveNode | null = null;
    let bestDist = maxDist;
    for (const cell of this.cells.values()) {
      for (const n of cell.nodes) {
        if (n.remaining <= 0) continue;
        const t = this.template(n.node.resourceId);
        const dx = n.node.x - origin.x;
        const dy = n.node.y + t.centerY - origin.y;
        const dz = n.node.z - origin.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= bestDist || d < 0.01) continue;
        const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
        const minCos = Math.cos(Math.min(0.5, Math.atan2(t.radius * 0.8, d)));
        if (cos < minCos) continue;
        bestDist = d;
        best = n;
      }
    }
    return best ? { node: best, distance: bestDist } : null;
  }

  /** Baut `amount` ab; gibt die tatsächlich entnommene Menge zurück. */
  harvest(live: LiveNode, amount: number): number {
    const take = Math.min(amount, live.remaining);
    live.remaining -= take;
    if (live.remaining <= 0) {
      live.respawnAt = this.clock + RESPAWN_SECONDS;
      this.depleted.set(live.node.id, { remaining: 0, respawnAt: live.respawnAt });
      this.dirty.add(live.node.resourceId);
      this.flushDirty();
    } else this.depleted.set(live.node.id, { remaining: live.remaining, respawnAt: 0 });
    return take;
  }

  dispose(): void {
    this.cells.clear();
    for (const t of this.templates.values()) {
      t.mesh.dispose();
      t.geometry.dispose();
      t.material.dispose();
    }
    this.templates.clear();
    this.group.removeFromParent();
  }
}

export type { LiveNode };
