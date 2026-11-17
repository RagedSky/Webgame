import type { BufferGeometry, Vector3} from 'three';
import { Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Raycaster, SphereGeometry, TorusGeometry, Vector2, type Scene, type Texture } from 'three';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet } from '@/gen/universe/types';
import type { ModuleType } from '@/game/crafting/recipes';
import type { BaseModule, PlayerState } from '@/game/PlayerState';
import { colorize, gradientColor, mergeParts } from '../geometry';
import { arc, blob, crystal, lathe, prism, tube } from '../organic';
import { textures } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';

export const GRID = 2;
export const RECHARGE_RADIUS = 5;

const HULL = new Color(0.86, 0.84, 0.78);
const HULL_SHADE = new Color(0.6, 0.6, 0.58);
const DARK = new Color(0.14, 0.15, 0.18);
const PAINT = new Color(0.95, 0.4, 0.12);
const METAL = new Color(0.55, 0.58, 0.62);
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

/**
 * Modul-Vorlagen in der organischen Formensprache: gewölbte Hüllen (Rotationskörper), gebogene Rohre,
 * weiche Gelenke und Lackbänder. `body` trägt Vertexfarben, `light` sind die leuchtenden Teile.
 */
function buildModuleTemplate(type: ModuleType): ModuleTemplate {
  const body: BufferGeometry[] = [];
  const light: BufferGeometry[] = [];
  let radius = 1.5;
  const hull = (geo: BufferGeometry): void => void body.push(gradientColor(geo, HULL_SHADE, HULL));
  const dark = (geo: BufferGeometry): void => void body.push(colorize(geo, DARK));
  const paint = (geo: BufferGeometry): void => void body.push(colorize(geo, PAINT));
  const metal = (geo: BufferGeometry): void => void body.push(colorize(geo, METAL));
  const at = (geo: BufferGeometry, x: number, y: number, z: number): BufferGeometry => geo.translate(x, y, z);
  switch (type) {
    case 'shelter': {
      // Wohnkuppel: gewölbte Hülle, Schleusentunnel, Fensterband, Dachluke mit Antenne
      hull(
        lathe(
          [
            [2.3, 0.12],
            [2.36, 0.5],
            [2.2, 1.05],
            [1.75, 1.65],
            [1.05, 2.05],
            [0.45, 2.2],
            [0, 2.23],
          ],
          24,
        ),
      );
      dark(
        lathe(
          [
            [2.25, 0],
            [2.52, 0.04],
            [2.5, 0.16],
            [2.3, 0.22],
          ],
          24,
        ),
      );
      paint(
        lathe(
          [
            [2.385, 0.56],
            [2.36, 0.74],
          ],
          24,
        ),
      );
      // Schleuse: kurzer Tunnel nach vorn (+z) mit dunkler Tür
      const tunnel = tube(
        [
          { x: 0, y: 0.95, z: 1.75, r: 0.98 },
          { x: 0, y: 0.95, z: 2.45, r: 0.95 },
          { x: 0, y: 0.95, z: 2.75, r: 0.88 },
        ],
        14,
        false,
      );
      hull(tunnel);
      const door = lathe(
        [
          [0.02, 0],
          [0.8, 0.02],
          [0.86, 0.06],
        ],
        14,
      );
      door.rotateX(Math.PI / 2);
      dark(at(door, 0, 0.95, 2.74));
      const frame = new TorusGeometry(0.9, 0.07, 8, 18);
      metal(at(frame, 0, 0.95, 2.76));
      // Fensterband (leuchtet) links und rechts der Schleuse
      for (const side of [-1, 1]) {
        light.push(
          lathe(
            [
              [2.3, 1.02],
              [2.16, 1.3],
            ],
            8,
            side * 1.25 - 0.42,
            0.84,
          ),
        );
      }
      light.push(at(new SphereGeometry(0.1, 8, 6), 0, 2.02, 2.74));
      // Dachluke und Antenne
      metal(
        lathe(
          [
            [0.5, 2.16],
            [0.56, 2.24],
            [0.4, 2.34],
            [0, 2.36],
          ],
          14,
        ),
      );
      dark(tube(arc([-0.9, 1.95, -0.6], [-1.0, 3.3, -0.65], [0.05, 0, 0], 0.035, 0.02, 4), 5));
      light.push(at(new SphereGeometry(0.06, 8, 6), -1.0, 3.3, -0.65));
      radius = 2.5;
      break;
    }
    case 'workbench': {
      // Werkbank: gefaste Arbeitsplatte, schräge Rohrbeine, Greifarm, Anzeige, Werkzeugkiste
      hull(
        at(
          prism(
            [
              [0.96, 0],
              [1.02, 0.04],
              [1.02, 0.1],
              [0.96, 0.14],
              [0, 0.14],
            ],
            4,
          ).scale(1.28, 1, 0.66),
          0,
          0.86,
          0,
        ),
      );
      for (const [x, z] of [[-0.78, -0.34], [0.78, -0.34], [-0.78, 0.34], [0.78, 0.34]] as Array<[number, number]>) {
        metal(tube(arc([x * 0.82, 0.88, z * 0.8], [x * 1.08, 0, z * 1.15], [0, 0, 0], 0.05, 0.04, 3), 6));
        dark(at(lathe([[0.09, 0], [0.1, 0.03], [0.05, 0.06]], 8), x * 1.08, 0, z * 1.15));
      }
      metal(tube(arc([-0.85, 0.3, -0.36], [0.85, 0.3, -0.36], [0, 0, 0], 0.03, 0.03, 2), 5));
      // Greifarm mit zwei Gelenken
      dark(at(blob(0.11, 'wb-base', 0.05, 1.2, 0.8, 8, 6), -0.62, 1.04, -0.08));
      metal(tube(arc([-0.62, 1.05, -0.08], [-0.42, 1.55, -0.02], [-0.12, 0.1, 0], 0.045, 0.04, 4), 6));
      dark(at(blob(0.07, 'wb-joint', 0.05, 1.2, 1, 8, 6), -0.42, 1.55, -0.02));
      metal(tube(arc([-0.42, 1.55, -0.02], [-0.08, 1.3, 0.08], [0.06, 0.1, 0], 0.035, 0.028, 4), 6));
      light.push(at(new SphereGeometry(0.045, 8, 6), -0.08, 1.28, 0.08));
      // Anzeige und Werkzeugkiste
      const screen = prism(
        [
          [0.34, 0],
          [0.36, 0.02],
          [0.34, 0.04],
          [0, 0.04],
        ],
        4,
      ).scale(1, 1, 0.6);
      screen.rotateX(-1.15);
      light.push(at(screen, 0.52, 1.2, -0.32));
      dark(tube(arc([0.52, 1.0, -0.36], [0.52, 1.16, -0.36], [0, 0, 0], 0.03, 0.03, 2), 5));
      paint(
        at(
          prism(
            [
              [0.24, 0],
              [0.28, 0.04],
              [0.28, 0.2],
              [0.24, 0.24],
              [0, 0.24],
            ],
            4,
          ).scale(1.3, 1, 0.8),
          0.5,
          1.0,
          0.18,
        ),
      );
      radius = 1.2;
      break;
    }
    case 'lab': {
      // Labor: bauchiger Reaktor mit Glaskuppel, Vorratskapseln und gebogenen Leitungen
      hull(
        lathe(
          [
            [0.82, 0.1],
            [1.05, 0.22],
            [1.12, 0.7],
            [1.06, 1.3],
            [0.86, 1.56],
            [0.78, 1.62],
          ],
          20,
        ),
      );
      dark(
        lathe(
          [
            [1.0, 0],
            [1.22, 0.03],
            [1.2, 0.14],
            [0.9, 0.2],
          ],
          20,
        ),
      );
      paint(
        lathe(
          [
            [1.13, 0.86],
            [1.125, 1.04],
          ],
          20,
        ),
      );
      metal(at(new TorusGeometry(0.8, 0.06, 8, 22).rotateX(Math.PI / 2), 0, 1.62, 0));
      light.push(
        lathe(
          [
            [0.76, 1.62],
            [0.72, 1.86],
            [0.5, 2.1],
            [0.2, 2.22],
            [0, 2.24],
          ],
          16,
        ),
      );
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const cx = Math.cos(a) * 1.32;
        const cz = Math.sin(a) * 1.32;
        const cap = lathe(
          [
            [0, 0.08],
            [0.18, 0.14],
            [0.24, 0.3],
            [0.24, 0.86],
            [0.18, 1.02],
            [0, 1.08],
          ],
          10,
        );
        metal(at(cap, cx, 0, cz));
        dark(tube(arc([cx, 1.02, cz], [Math.cos(a) * 0.9, 1.5, Math.sin(a) * 0.9], [Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12], 0.05, 0.05, 6), 6));
        light.push(at(new SphereGeometry(0.06, 8, 6), cx + Math.cos(a) * 0.24, 0.6, cz + Math.sin(a) * 0.24));
      }
      radius = 1.6;
      break;
    }
    case 'charger': {
      // Ladestation: Sockel, sich verjüngender Mast, zwei Zinken, schwebender Energiekristall, Leuchtringe
      dark(
        lathe(
          [
            [0.9, 0],
            [1.02, 0.04],
            [0.98, 0.16],
            [0.5, 0.26],
            [0.3, 0.3],
          ],
          16,
        ),
      );
      paint(
        lathe(
          [
            [0.99, 0.09],
            [0.985, 0.15],
          ],
          16,
        ),
      );
      hull(tube(arc([0, 0.28, 0], [0, 1.85, 0], [0, 0, 0], 0.2, 0.11, 5), 10, false));
      for (const side of [-1, 1]) {
        hull(tube(arc([side * 0.06, 1.8, 0], [side * 0.42, 2.75, 0], [side * 0.3, -0.1, 0], 0.09, 0.045, 6), 8));
      }
      light.push(at(new TorusGeometry(0.6, 0.06, 8, 24).rotateX(Math.PI / 2), 0, 2.45, 0));
      light.push(at(new TorusGeometry(0.24, 0.035, 6, 18).rotateX(Math.PI / 2), 0, 1.25, 0));
      const core = crystal(0.14, 0.5, 0.5);
      core.translate(0, -0.25, 0);
      light.push(at(core, 0, 2.45, 0));
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
  private readonly panelNormal: Texture = textures.get('suit').normalMap.clone();
  private readonly bodyMaterial = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, normalMap: this.panelNormal, normalScale: new Vector2(0.5, 0.5) });
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
    this.panelNormal.repeat.set(3, 2);
    addRim(this.bodyMaterial, 0.7);
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
    this.panelNormal.dispose();
    this.ghostMaterial.dispose();
    for (const m of this.lightMaterials.values()) m.dispose();
    this.group.removeFromParent();
  }
}
