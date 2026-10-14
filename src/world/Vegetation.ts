import { BatchedMesh, Color, Group, InstancedMesh, Matrix4, Quaternion, StaticDrawUsage, Vector3, type BufferGeometry, type Scene } from 'three';
import { Random } from '@/math/Random';
import { lerp } from '@/math/utils';
import type { TerrainModel, TerrainSample } from '@/gen/terrain/TerrainModel';
import { VEGETATION_PROFILES, type VegetationProfile } from '@/gen/terrain/VegetationProfiles';
import type { Planet } from '@/gen/universe/types';
import type { ArchiveEntry, FloraForm, FloraGenome } from '@/gen/archive/types';
import { RARITY_SPAWN_WEIGHT, matchesPlacement } from '@/gen/archive/conditions';
import type { PlantType, TreeStyle, VegetationAssets } from './VegetationAssets';
import type { FloraAssets } from './flora/FloraAssets';

export interface SpeciesPlacement {
  entry: ArchiveEntry;
  x: number;
  y: number;
  z: number;
  /** Höhe der Pflanze in Metern (skaliert). */
  height: number;
}

interface Cell {
  id: string;
  meshes: Array<InstancedMesh | BatchedMesh>;
  instances: number;
  species: SpeciesPlacement[];
}

interface GenericBatch {
  geometry: BufferGeometry;
  type: PlantType;
  style?: TreeStyle;
  matrices: Matrix4[];
  colors: Color[];
}

interface SpeciesInstance {
  entry: ArchiveEntry;
  matrix: Matrix4;
  color: Color;
  x: number;
  y: number;
  z: number;
  height: number;
}

export interface VegetationOptions {
  nearRadius?: number;
  farRadius?: number;
  nearCell?: number;
  farCell?: number;
  /** Globale Dichte (Einstellung „Vegetationsdichte“). */
  density?: number;
}

/** Arten-Dichte je Wuchsform (Instanzen pro 64 m × 64 m bei „häufig“, Biodiversität 1). */
const SPECIES_DENSITY: Record<FloraForm, number> = {
  tree: 8,
  shrub: 9,
  grass: 22,
  fungus: 7,
  aquatic: 10,
  succulent: 7,
  lichen: 16,
  vine: 5,
  crystal_plant: 6,
};
const FAR_FORMS = new Set<FloraForm>(['tree']);

const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpSample: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };
const tmpColor = new Color();
const tmpColor2 = new Color();
const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Vegetation in Zellen: nahe Zellen (64 m) mit generischem Gras/Steinen plus Arten-Pflanzen (Büsche, Kräuter, Pilze …),
 * ferne Zellen (256 m) mit Arten-Bäumen. Arten werden pro Zelle in einem BatchedMesh gezeichnet (ein Draw-Call je Material).
 * Platzierung deterministisch aus Zelle + Terrain-Seed; Arten nach Biom, Höhenband, Wasserregel und Seltenheit.
 */
export class VegetationManager {
  readonly group = new Group();
  readonly stats = { cells: 0, instances: 0, species: 0 };
  private readonly cells = new Map<string, Cell>();
  private readonly nearRadius: number;
  private readonly farRadius: number;
  private readonly nearCell: number;
  private readonly farCell: number;
  private density: number;
  private accum = 1;
  private queue: Array<{ id: string; ix: number; iz: number; far: boolean; d: number }> = [];
  private readonly palettes: Color[];
  private readonly groundPalettes: Color[];
  private readonly profiles: VegetationProfile[];
  private readonly maxDensity: Record<PlantType, number>;
  private readonly bioFactor: number;
  private readonly nearSpecies: ArchiveEntry[];
  private readonly farSpecies: ArchiveEntry[];
  /** Summe der Seltenheitsgewichte je Wuchsform (zur Normierung der Dichte). */
  private readonly formWeight = new Map<FloraForm, number>();

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    private readonly planet: Planet,
    private readonly assets: VegetationAssets,
    private readonly flora: FloraAssets,
    species: ArchiveEntry[],
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
    const floraEntries = species.filter((e) => e.planetId === planet.id && (e.genome as FloraGenome).kind === 'flora');
    this.nearSpecies = floraEntries.filter((e) => !FAR_FORMS.has((e.genome as FloraGenome).form));
    this.farSpecies = floraEntries.filter((e) => FAR_FORMS.has((e.genome as FloraGenome).form));
    for (const e of floraEntries) {
      const form = (e.genome as FloraGenome).form;
      this.formWeight.set(form, (this.formWeight.get(form) ?? 0) + RARITY_SPAWN_WEIGHT[e.rarity]);
    }
    scene.add(this.group);
  }

  private densityAt(s: TerrainSample, type: PlantType): number {
    const a = (this.profiles[s.biome] as VegetationProfile)[type];
    const b = (this.profiles[s.biome2] as VegetationProfile)[type];
    return lerp(a, b, s.blend);
  }

  /** Generische Platzhalter (Gras, Steine; Bäume nur, wenn der Planet keine Baum-Arten hat). */
  private placeGeneric(rng: Random, x0: number, z0: number, size: number, types: PlantType[]): GenericBatch[] {
    const area = (size / 64) ** 2;
    const sea = this.model.seaLevel;
    const batches = new Map<string, GenericBatch>();
    for (const type of types) {
      const bio = type === 'rock' ? 1 : this.bioFactor;
      const typeScale = type === 'tree' ? 0.6 : type === 'grass' ? 0.8 : 1;
      const candidates = Math.round(this.maxDensity[type] * area * bio * typeScale * this.density);
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
          batch = { geometry, type, matrices: [], colors: [], ...(type === 'tree' ? { style } : {}) };
          batches.set(key, batch);
        }
        const baseScale = type === 'tree' ? profile.scale * rng.float(0.7, 1.5) : type === 'grass' ? rng.float(0.6, 1.3) : type === 'rock' ? rng.float(0.3, 1.6) : profile.scale * rng.float(0.7, 1.3);
        tmpPos.set(x, s.height - (type === 'rock' ? 0.15 * baseScale : 0.02), z);
        tmpQuat.setFromAxisAngle(Y_AXIS, rng.float(0, Math.PI * 2));
        tmpScale.set(baseScale * rng.float(0.85, 1.15), baseScale, baseScale * rng.float(0.85, 1.15));
        batch.matrices.push(new Matrix4().compose(tmpPos, tmpQuat, tmpScale));
        if (type === 'rock') tmpColor.copy(this.groundPalettes[biome] as Color).multiplyScalar(0.75).lerp(tmpColor2.set(0.45, 0.44, 0.42), 0.4);
        else {
          tmpColor.copy(this.palettes[s.biome] as Color);
          if (s.blend > 0) tmpColor.lerp(this.palettes[s.biome2] as Color, s.blend);
          tmpColor.offsetHSL(rng.float(-0.025, 0.025), rng.float(-0.08, 0.08), rng.float(-0.08, 0.08));
        }
        batch.colors.push(tmpColor.clone());
      }
    }
    return Array.from(batches.values());
  }

  /** Arten-Pflanzen aus dem Archiv: Biom, Höhenband, Wasserregel, Seltenheit. */
  private placeSpecies(rng: Random, x0: number, z0: number, size: number, species: ArchiveEntry[]): SpeciesInstance[] {
    const out: SpeciesInstance[] = [];
    const area = (size / 64) ** 2;
    const sea = this.model.seaLevel;
    const biomes = this.planet.biomes;
    for (const entry of species) {
      const genome = entry.genome as FloraGenome;
      // Gesamtdichte je Wuchsform ist konstant; Arten teilen sie nach Seltenheit (viele Arten → jede seltener)
      const share = RARITY_SPAWN_WEIGHT[entry.rarity] / Math.max(0.5, this.formWeight.get(genome.form) ?? 1);
      const base = SPECIES_DENSITY[genome.form] * 2.2 * share * this.bioFactor * this.density * area;
      const candidates = Math.floor(base) + (rng.next() < base - Math.floor(base) ? 1 : 0);
      for (let c = 0; c < candidates; c++) {
        const x = x0 + rng.next() * size;
        const z = z0 + rng.next() * size;
        const s = this.model.sample(x, z, tmpSample);
        const biome = biomes[s.blend > 0.5 ? s.biome2 : s.biome]!;
        const underwater = this.model.hasWater && s.height < sea - 0.4;
        if (!matchesPlacement(entry, biome, s.altitude, underwater)) continue;
        if (genome.form !== 'grass' && genome.form !== 'lichen' && this.model.slopeAt(x, z, 1.2) > (genome.form === 'tree' ? 0.5 : 0.7)) continue;
        const scale = rng.float(0.8, 1.2);
        tmpPos.set(x, s.height - 0.03, z);
        tmpQuat.setFromAxisAngle(Y_AXIS, rng.float(0, Math.PI * 2));
        tmpScale.set(scale * rng.float(0.9, 1.1), scale, scale * rng.float(0.9, 1.1));
        const l = rng.float(0.85, 1.1);
        out.push({ entry, matrix: new Matrix4().compose(tmpPos, tmpQuat, tmpScale), color: new Color(l, l, l), x, y: s.height, z, height: genome.heightM * scale });
      }
    }
    return out;
  }

  private buildSpeciesMeshes(instances: SpeciesInstance[], castShadow: boolean): BatchedMesh[] {
    if (instances.length === 0) return [];
    // Nach Material gruppieren → je ein BatchedMesh
    const groups = new Map<string, { material: ReturnType<FloraAssets['materialFor']>; items: SpeciesInstance[] }>();
    for (const inst of instances) {
      const material = this.flora.materialFor(inst.entry);
      const key = material.uuid;
      let g = groups.get(key);
      if (!g) {
        g = { material, items: [] };
        groups.set(key, g);
      }
      g.items.push(inst);
    }
    const meshes: BatchedMesh[] = [];
    for (const { material, items } of groups.values()) {
      const unique = new Map<string, BufferGeometry>();
      for (const it of items) if (!unique.has(it.entry.id)) unique.set(it.entry.id, this.flora.get(it.entry));
      let verts = 0;
      let idx = 0;
      for (const g of unique.values()) {
        verts += g.getAttribute('position').count;
        idx += g.index ? g.index.count : g.getAttribute('position').count;
      }
      const mesh = new BatchedMesh(items.length, verts, Math.max(idx, 3), material);
      const geoIds = new Map<string, number>();
      for (const [id, g] of unique) geoIds.set(id, mesh.addGeometry(g));
      for (const it of items) {
        const iid = mesh.addInstance(geoIds.get(it.entry.id) as number);
        mesh.setMatrixAt(iid, it.matrix);
        mesh.setColorAt(iid, it.color);
      }
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.perObjectFrustumCulled = false;
      mesh.sortObjects = false;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
    }
    return meshes;
  }

  private buildCell(ix: number, iz: number, far: boolean): Cell {
    const size = far ? this.farCell : this.nearCell;
    const x0 = ix * size;
    const z0 = iz * size;
    const id = `${far ? 'f' : 'n'}:${ix}:${iz}`;
    const rng = new Random(`veg:${this.planet.terrainSeed}:${size}:${ix}:${iz}`);
    const meshes: Array<InstancedMesh | BatchedMesh> = [];
    let total = 0;

    const genericTypes: PlantType[] = far ? (this.farSpecies.length === 0 ? ['tree'] : []) : ['grass', 'rock'];
    for (const batch of this.placeGeneric(rng.fork('generic'), x0, z0, size, genericTypes)) {
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
      mesh.castShadow = batch.type !== 'grass';
      mesh.receiveShadow = batch.type !== 'grass';
      mesh.computeBoundingSphere();
      meshes.push(mesh);
      total += n;
    }

    const species = this.placeSpecies(rng.fork('species'), x0, z0, size, far ? this.farSpecies : this.nearSpecies);
    for (const mesh of this.buildSpeciesMeshes(species, true)) meshes.push(mesh);
    total += species.length;

    for (const m of meshes) this.group.add(m);
    return { id, meshes, instances: total, species: species.map((i) => ({ entry: i.entry, x: i.x, y: i.y, z: i.z, height: i.height })) };
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
    for (const cell of Array.from(this.cells.values())) if (!wanted.has(cell.id)) this.removeCell(cell);
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
    this.stats.species = this.flora.size;
  }

  /** Dichte ändern: alle Zellen verwerfen, sie werden mit neuer Dichte neu aufgebaut. */
  setDensity(density: number): void {
    if (density === this.density) return;
    this.density = density;
    for (const cell of Array.from(this.cells.values())) this.removeCell(cell);
    this.queue.length = 0;
    this.accum = 1;
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

  /** Arten-Pflanzen im Umkreis (für Fotomotive und Pflanzenproben). */
  querySpecies(x: number, z: number, radius: number, out: SpeciesPlacement[] = []): SpeciesPlacement[] {
    out.length = 0;
    const r2 = radius * radius;
    for (const cell of this.cells.values()) {
      for (const sp of cell.species) {
        const dx = sp.x - x;
        const dz = sp.z - z;
        if (dx * dx + dz * dz <= r2) out.push(sp);
      }
    }
    return out;
  }

  dispose(): void {
    for (const cell of Array.from(this.cells.values())) this.removeCell(cell);
    this.group.removeFromParent();
  }
}
