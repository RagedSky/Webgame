import type { BufferGeometry, Vector3} from 'three';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Raycaster, SphereGeometry, TorusGeometry, type Scene } from 'three';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet } from '@/gen/universe/types';
import type { ModuleType } from '@/game/crafting/recipes';
import type { BaseModule, PlayerState } from '@/game/PlayerState';
import { colorize, mergeParts } from '../geometry';

export const GRID = 2;
export const RECHARGE_RADIUS = 5;

const HULL = new Color(0.55, 0.6, 0.66);
const DARK = new Color(0.22, 0.24, 0.28);
const ACCENT: Record<ModuleType, Color> = {
  shelter: new Color(1, 0.75, 0.3),
  workbench: new Color(0.3, 0.8, 1),
  lab: new Color(0.4, 1, 0.8),
  charger: new Color(1, 0.85, 0.2),
};

interface ModuleTemplate {
  body: BufferGeometry;
  light: BufferGeometry;
  radius: number;
}

function buildModuleTemplate(type: ModuleType): ModuleTemplate {
  const body: BufferGeometry[] = [];
  const light: BufferGeometry[] = [];
  let radius = 1.5;
  switch (type) {
    case 'shelter': {
      const dome = new SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.translate(0, 0.1, 0);
      body.push(colorize(dome, HULL, 0.15));
      const door = new BoxGeometry(0.9, 1.6, 0.3);
      door.translate(0, 0.85, 2.1);
      body.push(colorize(door, DARK));
      const win = new BoxGeometry(0.6, 0.4, 0.1);
      win.translate(1.2, 1.3, 1.7);
      win.rotateY(-0.6);
      light.push(win);
      const base = new CylinderGeometry(2.4, 2.5, 0.2, 16);
      base.translate(0, 0.1, 0);
      body.push(colorize(base, DARK));
      radius = 2.4;
      break;
    }
    case 'workbench': {
      const top = new BoxGeometry(1.8, 0.12, 0.9);
      top.translate(0, 0.9, 0);
      body.push(colorize(top, HULL));
      for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]] as Array<[number, number]>) {
        const leg = new BoxGeometry(0.1, 0.9, 0.1);
        leg.translate(x, 0.45, z);
        body.push(colorize(leg, DARK));
      }
      const tool = new CylinderGeometry(0.08, 0.08, 0.5, 8);
      tool.translate(-0.5, 1.2, 0);
      body.push(colorize(tool, DARK));
      const panel = new BoxGeometry(0.5, 0.3, 0.05);
      panel.translate(0.5, 1.15, -0.4);
      light.push(panel);
      radius = 1.1;
      break;
    }
    case 'lab': {
      const tank = new CylinderGeometry(1.0, 1.1, 1.6, 14);
      tank.translate(0, 0.8, 0);
      body.push(colorize(tank, HULL, 0.2));
      const top = new SphereGeometry(0.75, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      top.translate(0, 1.6, 0);
      light.push(top);
      for (let i = 0; i < 3; i++) {
        const pipe = new CylinderGeometry(0.08, 0.08, 1.2, 6);
        pipe.rotateZ(Math.PI / 2);
        pipe.translate(0, 0.4 + i * 0.35, 0);
        pipe.rotateY((i / 3) * Math.PI);
        body.push(colorize(pipe, DARK));
      }
      radius = 1.4;
      break;
    }
    case 'charger': {
      const base = new CylinderGeometry(0.9, 1.0, 0.2, 12);
      base.translate(0, 0.1, 0);
      body.push(colorize(base, DARK));
      const pole = new CylinderGeometry(0.12, 0.16, 2.6, 8);
      pole.translate(0, 1.4, 0);
      body.push(colorize(pole, HULL));
      const ring = new TorusGeometry(0.6, 0.08, 8, 20);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, 2.5, 0);
      light.push(ring);
      radius = 1.1;
      break;
    }
  }
  return { body: mergeParts(body, `module ${type}`), light: mergeParts(light, `module ${type} light`), radius };
}

export interface PlacementCheck {
  ok: boolean;
  reason: string;
}

/**
 * Basis-Module in der Welt: Meshes aus dem PlayerState, Geist-Vorschau für den Bau-Modus,
 * Gültigkeitsprüfung (Gefälle, Wasser, Abstand), Raycast-Auswahl und Nähe-Abfragen.
 */
export class BaseManager {
  readonly group = new Group();
  private readonly templates = new Map<ModuleType, ModuleTemplate>();
  private readonly meshes = new Map<string, Group>();
  private readonly bodyMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.35 });
  private readonly lightMaterials = new Map<ModuleType, MeshStandardMaterial>();
  private ghost: Group | null = null;
  private ghostType: ModuleType | null = null;
  private readonly ghostMaterial = new MeshStandardMaterial({ color: 0x5ee39a, transparent: true, opacity: 0.45, depthWrite: false });
  private readonly raycaster = new Raycaster();

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    private readonly planet: Planet,
    private readonly state: PlayerState,
  ) {
    scene.add(this.group);
    this.sync();
  }

  private template(type: ModuleType): ModuleTemplate {
    let t = this.templates.get(type);
    if (!t) {
      t = buildModuleTemplate(type);
      this.templates.set(type, t);
    }
    return t;
  }

  private lightMaterial(type: ModuleType): MeshStandardMaterial {
    let m = this.lightMaterials.get(type);
    if (!m) {
      m = new MeshStandardMaterial({ color: ACCENT[type], emissive: ACCENT[type], emissiveIntensity: 0.9, roughness: 0.4 });
      this.lightMaterials.set(type, m);
    }
    return m;
  }

  private createMesh(m: BaseModule): Group {
    const t = this.template(m.type);
    const g = new Group();
    const body = new Mesh(t.body, this.bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.moduleId = m.id;
    const light = new Mesh(t.light, this.lightMaterial(m.type));
    light.userData.moduleId = m.id;
    g.add(body, light);
    g.position.set(m.x, this.model.heightAt(m.x, m.z), m.z);
    g.rotation.y = (m.rot * Math.PI) / 2;
    g.userData.moduleId = m.id;
    return g;
  }

  /** Meshes mit dem Zustand abgleichen. */
  sync(): void {
    const wanted = new Set<string>();
    for (const m of this.state.modulesOn(this.planet.id)) {
      wanted.add(m.id);
      if (!this.meshes.has(m.id)) {
        const g = this.createMesh(m);
        this.meshes.set(m.id, g);
        this.group.add(g);
      }
    }
    for (const [id, g] of this.meshes) {
      if (!wanted.has(id)) {
        this.group.remove(g);
        this.meshes.delete(id);
      }
    }
  }

  snap(x: number, z: number): { x: number; z: number } {
    return { x: Math.round(x / GRID) * GRID, z: Math.round(z / GRID) * GRID };
  }

  validate(type: ModuleType, x: number, z: number): PlacementCheck {
    if (this.model.hasWater && this.model.heightAt(x, z) < this.model.seaLevel + 0.2) return { ok: false, reason: 'Nicht im Wasser' };
    if (this.model.slopeAt(x, z, 1.5) > 0.35) return { ok: false, reason: 'Zu steil' };
    const r = this.template(type).radius;
    for (const m of this.state.modulesOn(this.planet.id)) {
      const other = this.template(m.type).radius;
      if (Math.hypot(m.x - x, m.z - z) < r + other + 0.5) return { ok: false, reason: 'Zu nah an einem Modul' };
    }
    return { ok: true, reason: '' };
  }

  setGhost(type: ModuleType | null): void {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
    this.ghostType = type;
    if (!type) return;
    const t = this.template(type);
    const g = new Group();
    g.add(new Mesh(t.body, this.ghostMaterial), new Mesh(t.light, this.ghostMaterial));
    this.ghost = g;
    this.group.add(g);
  }

  updateGhost(x: number, z: number, rot: number, valid: boolean): void {
    if (!this.ghost) return;
    this.ghost.position.set(x, this.model.heightAt(x, z), z);
    this.ghost.rotation.y = (rot * Math.PI) / 2;
    this.ghostMaterial.color.set(valid ? 0x5ee39a : 0xff6b6b);
  }

  get ghostActive(): ModuleType | null {
    return this.ghostType;
  }

  place(type: ModuleType, x: number, z: number, rot: number): BaseModule {
    const m = this.state.addModule(type, this.planet.id, x, z, rot);
    this.sync();
    return m;
  }

  remove(id: string): BaseModule | null {
    const m = this.state.removeModule(id);
    this.sync();
    return m;
  }

  nearest(pos: Vector3, maxDist: number, types?: ModuleType[]): { module: BaseModule; distance: number } | null {
    let best: BaseModule | null = null;
    let bd = maxDist;
    for (const m of this.state.modulesOn(this.planet.id)) {
      if (types && !types.includes(m.type)) continue;
      const d = Math.hypot(m.x - pos.x, m.z - pos.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best ? { module: best, distance: bd } : null;
  }

  /** Modul im Blick: exakter Raycast, sonst nächstes Modul in einem Kegel (dünne Teile wie Tischplatten). */
  pick(origin: Vector3, dir: Vector3, maxDist: number): BaseModule | null {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const targets = Array.from(this.meshes.values());
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length) {
      const id = hits[0]!.object.userData.moduleId as string | undefined;
      const m = this.state.modules.find((x) => x.id === id);
      if (m) return m;
    }
    let best: BaseModule | null = null;
    let bestDist = maxDist;
    for (const m of this.state.modulesOn(this.planet.id)) {
      const t = this.template(m.type);
      const dx = m.x - origin.x;
      const dy = this.model.heightAt(m.x, m.z) + t.radius * 0.5 - origin.y;
      const dz = m.z - origin.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= bestDist + t.radius || d < 0.01) continue;
      const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (cos < Math.cos(Math.min(0.6, Math.atan2(t.radius * 0.9, d)))) continue;
      bestDist = d;
      best = m;
    }
    return best;
  }

  dispose(): void {
    this.setGhost(null);
    for (const g of this.meshes.values()) this.group.remove(g);
    this.meshes.clear();
    for (const t of this.templates.values()) {
      t.body.dispose();
      t.light.dispose();
    }
    this.templates.clear();
    this.bodyMaterial.dispose();
    this.ghostMaterial.dispose();
    for (const m of this.lightMaterials.values()) m.dispose();
    this.group.removeFromParent();
  }
}
