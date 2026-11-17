import type { Collider, CollisionWorld } from '../Collision';
import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Raycaster, SphereGeometry, Vector3, type BufferGeometry, type Scene } from 'three';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import { NODE_CELL, generateResourceNodes, type ResourceNode } from '@/gen/terrain/ResourceNodes';
import { RESOURCES } from '@/gen/universe/catalog';
import type { Planet, ResourceId } from '@/gen/universe/types';
import { blade, colorize, gradientColor, mergeParts } from '../geometry';
import { arc, blob, crystal, lathe, tube } from '../organic';
import { addRim, vivid } from '@/render/stylize';

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
  const vividCol = vivid(col.clone(), 1.25);
  const bright = vividCol.clone().offsetHSL(0.04, 0, 0.18);
  switch (def.kind) {
    case 'metal': {
      // Erzbrocken: weicher Fels mit eingewachsenen, glänzenden Erzkristallen
      const rock = blob(0.55, `node:${id}`, 0.24, 1.6, 0.72, 10, 8);
      rock.translate(0, 0.32, 0);
      parts.push(gradientColor(rock, ROCK.clone().multiplyScalar(0.6).lerp(col, 0.2), ROCK.clone().lerp(vividCol, 0.35), 0.8));
      for (let i = 0; i < 5; i++) {
        const c = crystal(0.09, 0.3 + (i % 3) * 0.08, 0.4);
        const a = (i / 5) * Math.PI * 2;
        c.rotateX(0.5 + (i % 2) * 0.3);
        c.rotateY(a);
        c.translate(Math.sin(a) * 0.3, 0.42 + (i % 2) * 0.1, Math.cos(a) * 0.3);
        parts.push(gradientColor(c, vividCol, bright));
      }
      break;
    }
    case 'crystal': {
      // Kristalldruse: sechseckige Säulen auf einem Sockel
      for (let i = 0; i < 6; i++) {
        const c = crystal(0.11 + (i % 2) * 0.03, 0.7 + (i % 3) * 0.28, 0.3);
        if (i > 0) {
          c.rotateX(0.45 * (i % 2 ? 1 : 0.6));
          c.rotateY((i / 5) * Math.PI * 2);
        }
        c.translate(i === 0 ? 0 : Math.sin((i / 5) * Math.PI * 2) * 0.16, 0.05, i === 0 ? 0 : Math.cos((i / 5) * Math.PI * 2) * 0.16);
        parts.push(gradientColor(c, vividCol.clone().multiplyScalar(0.7), bright, 0.9));
      }
      const base = blob(0.4, `base:${id}`, 0.2, 1.5, 0.4, 8, 6);
      base.translate(0, 0.06, 0);
      parts.push(colorize(base, ROCK));
      glow = id === 'lumite';
      centerY = 0.5;
      break;
    }
    case 'mineral': {
      if (id === 'silica') {
        const pile = lathe(
          [
            [0.85, 0],
            [0.7, 0.14],
            [0.42, 0.34],
            [0.14, 0.46],
            [0, 0.48],
          ],
          12,
        );
        parts.push(gradientColor(pile, col.clone().multiplyScalar(0.75), bright));
        centerY = 0.25;
      } else {
        const n = blob(0.5, `node:${id}`, 0.2, 1.5, 0.62, 10, 8);
        n.scale(1.2, 1, 1);
        n.translate(0, 0.28, 0);
        parts.push(gradientColor(n, col.clone().lerp(ROCK, 0.5).multiplyScalar(0.7), vividCol.clone().lerp(ROCK, 0.15), 0.8));
        for (let i = 0; i < 4; i++) {
          const b = blob(0.17, `nub:${id}:${i}`, 0.15, 1.4, 0.9, 7, 5);
          b.translate(Math.cos(i * 1.6) * 0.45, 0.34, Math.sin(i * 1.6) * 0.4);
          parts.push(gradientColor(b, vividCol, bright));
        }
      }
      glow = id === 'uranite' || id === 'lumite';
      break;
    }
    case 'gas': {
      const vent = lathe(
        [
          [1.05, 0],
          [0.95, 0.22],
          [0.72, 0.3],
          [0.5, 0.18],
          [0.3, 0.04],
        ],
        12,
      );
      parts.push(gradientColor(vent, ROCK.clone().multiplyScalar(0.6), ROCK));
      const column = new CylinderGeometry(0.25, 0.45, 1.6, 8, 1, true);
      column.translate(0, 1.0, 0);
      parts.push(colorize(column, vividCol, 0.6));
      radius = 1;
      centerY = 0.6;
      glow = true;
      break;
    }
    case 'organic': {
      if (id === 'fiber') {
        // Faserbüschel: hohe, überhängende Halme
        for (let i = 0; i < 11; i++) {
          const b = blade(0.11, 0.85 + (i % 3) * 0.22, 0.35 + (i % 4) * 0.12, 3, 0.01, 0.4);
          b.rotateX(0.12 + (i % 2) * 0.12);
          b.rotateY((i / 11) * Math.PI * 2);
          parts.push(gradientColor(b, col.clone().multiplyScalar(0.55), bright, 0.8));
        }
        centerY = 0.5;
      } else if (id === 'resin') {
        const stump = tube(arc([0, 0, 0], [0.05, 0.62, 0], [0.04, 0, 0], 0.34, 0.26, 4, 0.5), 8);
        parts.push(gradientColor(stump, new Color(0.22, 0.14, 0.08), new Color(0.42, 0.28, 0.16)));
        for (const [x, y, z, r] of [[0.2, 0.6, 0.02, 0.2], [-0.12, 0.42, 0.2, 0.12], [0.05, 0.3, -0.24, 0.1]] as Array<[number, number, number, number]>) {
          const drop = blob(r, `resin:${x}`, 0.12, 1.3, 1.15, 7, 5);
          drop.translate(x, y, z);
          parts.push(gradientColor(drop, vividCol.clone().multiplyScalar(0.8), bright));
        }
        centerY = 0.45;
      } else {
        // Sporenpilz: Knolle mit kleinen Fruchtkörpern
        const puff = blob(0.4, 'spores', 0.14, 1.4, 0.8, 10, 7);
        puff.translate(0, 0.32, 0);
        parts.push(gradientColor(puff, vividCol.clone().multiplyScalar(0.6), bright, 0.8));
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3;
          const nub = new SphereGeometry(0.06, 6, 4);
          nub.translate(Math.cos(a) * 0.26, 0.56 + (i % 2) * 0.06, Math.sin(a) * 0.26);
          parts.push(colorize(nub, bright));
        }
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
  addRim(material, def.kind === 'crystal' ? 1.2 : 0.7);
  return { geometry, material, radius, centerY };
}

/**
 * Abbaubare Rohstoffknoten in Zellen (128 m) um den Spieler. Je Rohstoffart ein InstancedMesh (ein Draw-Call,
 * Phase 9), Raycast per Instanz-Index plus Kegel-Fallback, Abbau mit Restmenge und Respawn nach 10 Minuten.
 */
export class ResourceNodeManager {
  readonly group = new Group();
  readonly stats = { nodes: 0, drawCalls: 0 };
  /** Kollisionswelt (von der Szene gesetzt). */
  collision: CollisionWorld | null = null;
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
    const colliders: Collider[] = [];
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
        colliders.push({ x: n.node.x, z: n.node.z, r: t.radius * 0.72, top: n.node.y + t.radius * 1.3 });
        i++;
      }
    }
    t.mesh.count = i;
    t.mesh.instanceMatrix.needsUpdate = true;
    // Hindernisse der sichtbaren Knoten dieser Art (abgebaute Knoten geben den Weg frei)
    this.collision?.set(`nodes:${id}`, colliders);
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
