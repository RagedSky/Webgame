import { Color, Group, InstancedMesh, Matrix4, Quaternion, StaticDrawUsage, Vector3, type BufferGeometry, type Scene } from 'three';
import { Random } from '@/math/Random';
import { lerp } from '@/math/utils';
import type { TerrainModel, TerrainSample } from '@/gen/terrain/TerrainModel';
import { VEGETATION_PROFILES, type VegetationProfile } from '@/gen/terrain/VegetationProfiles';
import type { Planet } from '@/gen/universe/types';
import type { PlantType, TreeStyle, VegetationAssets } from './VegetationAssets';

interface Cell {
  id: string;
  cx: number;
  cz: number;
  meshes: InstancedMesh[];
  instances: number;
}

interface Batch {
  geometry: BufferGeometry;
  type: PlantType;
  style?: TreeStyle;
  matrices: Matrix4[];
  colors: Color[];
  castShadow: boolean;
}

export interface VegetationOptions {
  nearRadius?: number;
  farRadius?: number;
  nearCell?: number;
  farCell?: number;
  /** Globale Dichte (Einstellung „Vegetationsdichte“). */
  density?: number;
}

const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpSample: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };
const tmpColor = new Color();
const tmpColor2 = new Color();
const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Vegetation und Streugut per Instancing in Zellen: nahe Zellen (64 m) mit Gras/Büschen/Steinen,
 * ferne Zellen (256 m) mit Bäumen. Platzierung deterministisch aus Zelle + Terrain-Seed.
 */
export class VegetationManager {
  readonly group = new Group();
  readonly stats = { cells: 0, instances: 0 };
  private readonly cells = new Map<string, Cell>();
  private readonly nearRadius: number;
  private readonly farRadius: number;
  private readonly nearCell: number;
  private readonly farCell: number;
  private readonly density: number;
  private accum = 1;
  private queue: Array<{ id: string; ix: number; iz: number; far: boolean; d: number }> = [];
  private readonly palettes: Color[];
  private readonly groundPalettes: Color[];
  private readonly profiles: VegetationProfile[];
  private readonly maxDensity: Record<PlantType, number>;
  private readonly bioFactor: number;

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    private readonly planet: Planet,
    private readonly assets: VegetationAssets,
    options: VegetationOptions = {},
  ) {
    this.nearRadius = options.nearRadius ?? 200;
    this.farRadius = options.farRadius ?? 620;
    this.nearCell = options.nearCell ?? 64;
    this.farCell = options.farCell ?? 256;
    this.density = options.density ?? 1;
    this.palettes = planet.biomes.map((b) => new Color(b.palette.vegetation));
    this.groundPalettes = planet.biomes.map((b) => new Color(b.palette.ground));
    this.profiles = planet.biomes.map((b) => VEGETATION_PROFILES[b.kind]);
    const maxOf = (t: PlantType): number => this.profiles.reduce((m, p) => Math.max(m, p[t]), 0);
    this.maxDensity = { grass: maxOf('grass'), shrub: maxOf('shrub'), tree: maxOf('tree'), rock: maxOf('rock') };
    this.bioFactor = 0.35 + planet.biodiversity;
    scene.add(this.group);
  }

  private densityAt(s: TerrainSample, type: PlantType): number {
    const a = (this.profiles[s.biome] as VegetationProfile)[type];
    const b = (this.profiles[s.biome2] as VegetationProfile)[type];
    return lerp(a, b, s.blend);
  }

  private buildCell(ix: number, iz: number, far: boolean): Cell {
    const size = far ? this.farCell : this.nearCell;
    const x0 = ix * size;
    const z0 = iz * size;
    const id = `${far ? 'f' : 'n'}:${ix}:${iz}`;
    const rng = new Random(`veg:${this.planet.terrainSeed}:${size}:${ix}:${iz}`);
    const types: PlantType[] = far ? ['tree'] : ['grass', 'shrub', 'rock'];
    const area = (size / 64) ** 2;
    const batches = new Map<string, Batch>();
    const sea = this.model.seaLevel;
    let total = 0;

    for (const type of types) {
      const bio = type === 'rock' ? 1 : this.bioFactor;
      const typeScale = type === 'tree' ? 0.6 : type === 'grass' ? 0.9 : 1;
      const candidates = Math.round(this.maxDensity[type] * area * bio * typeScale * this.density);
      if (candidates <= 0) continue;
      for (let c = 0; c < candidates; c++) {
        const x = x0 + rng.next() * size;
        const z = z0 + rng.next() * size;
        const s = this.model.sample(x, z, tmpSample);
        const d = this.densityAt(s, type);
        if (d <= 0 || rng.next() > d / this.maxDensity[type]) continue;
        if (this.model.hasWater && s.height < sea + 0.3) continue;
        if (type !== 'grass') {
          const slope = this.model.slopeAt(x, z, 1.2);
          if (slope > (type === 'tree' ? 0.5 : type === 'shrub' ? 0.65 : 0.9)) continue;
        }
        const biome = s.blend > 0.5 ? s.biome2 : s.biome;
        const profile = this.profiles[biome] as VegetationProfile;
        const style = profile.treeStyle;
        const key = type === 'tree' ? `tree:${style}` : type;
        let batch = batches.get(key);
        if (!batch) {
          const geometry = type === 'grass' ? this.assets.grass : type === 'shrub' ? this.assets.shrub : type === 'rock' ? this.assets.rock : this.assets.trees[style];
          batch = { geometry, type, matrices: [], colors: [], castShadow: type !== 'grass', ...(type === 'tree' ? { style } : {}) };
          batches.set(key, batch);
        }
        const baseScale = type === 'tree' ? profile.scale * rng.float(0.7, 1.5) : type === 'grass' ? rng.float(0.6, 1.3) : type === 'rock' ? rng.float(0.3, 1.6) : profile.scale * rng.float(0.7, 1.3);
        tmpPos.set(x, s.height - (type === 'rock' ? 0.15 * baseScale : 0.02), z);
        tmpQuat.setFromAxisAngle(Y_AXIS, rng.float(0, Math.PI * 2));
        tmpScale.set(baseScale * rng.float(0.85, 1.15), baseScale, baseScale * rng.float(0.85, 1.15));
        batch.matrices.push(new Matrix4().compose(tmpPos, tmpQuat, tmpScale));
        if (type === 'rock') {
          tmpColor.copy(this.groundPalettes[biome] as Color).multiplyScalar(0.75).lerp(tmpColor2.set(0.45, 0.44, 0.42), 0.4);
        } else {
          tmpColor.copy(this.palettes[s.biome] as Color);
          if (s.blend > 0) tmpColor.lerp(this.palettes[s.biome2] as Color, s.blend);
          tmpColor.offsetHSL(rng.float(-0.025, 0.025), rng.float(-0.08, 0.08), rng.float(-0.08, 0.08));
        }
        batch.colors.push(tmpColor.clone());
        total++;
      }
    }

    const meshes: InstancedMesh[] = [];
    for (const batch of batches.values()) {
      const n = batch.matrices.length;
      if (n === 0) continue;
      const mesh = new InstancedMesh(batch.geometry, this.assets.materialFor(batch.type, batch.style), n);
      mesh.instanceMatrix.setUsage(StaticDrawUsage);
      for (let i = 0; i < n; i++) {
        mesh.setMatrixAt(i, batch.matrices[i] as Matrix4);
        mesh.setColorAt(i, batch.colors[i] as Color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = batch.castShadow;
      mesh.receiveShadow = batch.type !== 'grass';
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      meshes.push(mesh);
    }
    return { id, cx: x0 + size / 2, cz: z0 + size / 2, meshes, instances: total };
  }

  private removeCell(cell: Cell): void {
    for (const m of cell.meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.cells.delete(cell.id);
  }

  private refresh(cx: number, cz: number): void {
    const wanted = new Set<string>();
    this.queue = [];
    const scan = (radius: number, size: number, far: boolean): void => {
      const i0 = Math.floor((cx - radius) / size);
      const i1 = Math.floor((cx + radius) / size);
      const j0 = Math.floor((cz - radius) / size);
      const j1 = Math.floor((cz + radius) / size);
      for (let iz = j0; iz <= j1; iz++) {
        for (let ix = i0; ix <= i1; ix++) {
          const mx = (ix + 0.5) * size;
          const mz = (iz + 0.5) * size;
          const d = Math.hypot(mx - cx, mz - cz);
          if (d > radius + size * 0.5) continue;
          const id = `${far ? 'f' : 'n'}:${ix}:${iz}`;
          wanted.add(id);
          if (!this.cells.has(id)) this.queue.push({ id, ix, iz, far, d });
        }
      }
    };
    scan(this.nearRadius, this.nearCell, false);
    scan(this.farRadius, this.farCell, true);
    this.queue.sort((a, b) => a.d - b.d);
    for (const cell of Array.from(this.cells.values())) {
      if (!wanted.has(cell.id)) this.removeCell(cell);
    }
  }

  /** Baut sofort alle Zellen (Ladebildschirm). */
  buildAllNow(cameraPos: Vector3): void {
    this.refresh(cameraPos.x, cameraPos.z);
    while (this.queue.length) this.buildQueued();
    this.updateStats();
  }

  private buildQueued(): void {
    const item = this.queue.shift();
    if (!item || this.cells.has(item.id)) return;
    const cell = this.buildCell(item.ix, item.iz, item.far);
    this.cells.set(cell.id, cell);
  }

  private updateStats(): void {
    this.stats.cells = this.cells.size;
    let n = 0;
    for (const c of this.cells.values()) n += c.instances;
    this.stats.instances = n;
  }

  update(cameraPos: Vector3, dt: number, time: number, wind: number): void {
    this.assets.time.value = time;
    this.assets.wind.value = wind;
    this.accum += dt;
    if (this.accum >= 0.5) {
      this.accum = 0;
      this.refresh(cameraPos.x, cameraPos.z);
    }
    if (this.queue.length) {
      const t0 = performance.now();
      do {
        this.buildQueued();
      } while (this.queue.length && performance.now() - t0 < 4);
      this.updateStats();
    }
  }

  dispose(): void {
    for (const cell of Array.from(this.cells.values())) this.removeCell(cell);
    this.group.removeFromParent();
  }
}

