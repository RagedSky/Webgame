import { BatchedMesh, Color, Group, InstancedMesh, Matrix4, Quaternion, StaticDrawUsage, Vector3, type BufferGeometry, type Scene } from 'three';
import { Random } from '@/math/Random';
import { clamp, lerp } from '@/math/utils';
import { stylize, vivid } from '@/render/stylize';
import type { TerrainModel, TerrainSample } from '@/gen/terrain/TerrainModel';
import { VEGETATION_PROFILES, type VegetationProfile } from '@/gen/terrain/VegetationProfiles';
import type { Planet } from '@/gen/universe/types';
import type { ArchiveEntry, FloraForm, FloraGenome } from '@/gen/archive/types';
import { RARITY_SPAWN_WEIGHT, matchesPlacement } from '@/gen/archive/conditions';
import type { PlantType, TreeStyle, VegetationAssets } from './VegetationAssets';
import type { Collider, CollisionWorld } from './Collision';
import type { FloraAssets } from './flora/FloraAssets';
import { buildFloraGeometry } from './flora/FloraBuilder';
import { glowField, glowSource, type GlowSource } from '@/render/glow';
import { floraGlowColor } from './flora/FloraAssets';

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
  /** Mittelpunkt und halbe Kantenlänge (für den Schattenwurf in Kameranähe); `far` = Baumzelle, `grass` = Grasring. */
  far: boolean;
  grass: boolean;
  cx: number;
  cz: number;
  half: number;
}

/** Bis zu dieser Entfernung zum Zellrand werfen Bäume ferner Zellen Schatten (Reichweite der Schattenkarte). */
const SHADOW_RANGE = 78;
/** Gras und Blumen werfen bis zu dieser Entfernung zum Zellrand Schatten (dahinter löst die Schattenkarte Halme nicht auf). */
const GRASS_SHADOW_RANGE = 22;

/** Hindernis einer Pflanze: Stamm bzw. Körper als Zylinder; kleine und weiche Gewächse bleiben begehbar. */
function floraCollider(genome: FloraGenome, height: number, x: number, y: number, z: number): Collider | null {
  if (height < 0.9) return null;
  let r: number;
  let top = y + height * 0.75;
  switch (genome.form) {
    case 'tree':
      r = height * 0.05;
      break;
    case 'fungus':
      r = height * 0.1;
      break;
    case 'succulent':
      r = genome.leafShape === 'pad' || genome.leafShape === 'broad' || genome.leafShape === 'lobed' ? height * 0.27 : height * 0.2;
      top = y + height * 0.85;
      break;
    case 'crystal_plant':
      r = height * 0.15;
      break;
    default:
      return null;
  }
  return { x, z, r: clamp(r, 0.12, 2.2), top };
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
  /** Radius und Zellgröße des dichten Grasrings um die Kamera. */
  grassRadius?: number;
  grassCell?: number;
  /** Kollisionswelt: Stämme, Felsen und Signaturpflanzen werden als Hindernisse eingetragen. */
  collision?: CollisionWorld;
}

type CellKind = 'n' | 'f' | 'g';
/** Grasbüschel je m² bei voller Bedeckung, Dichte 1. */
const GRASS_PER_M2 = 1.25;
/** Bezugsdichten der Biom-Profile: bei diesem Wert stehen Arten-Pflanzen in Normaldichte. */
const SPECIES_REF = { tree: 8, shrub: 16, grass: 140 } as const;
const SPECIES_MAX_FACTOR = 2.5;

/** Arten-Dichte je Wuchsform (Instanzen pro 64 m × 64 m bei „häufig“, Biodiversität 1). */
const SPECIES_DENSITY: Record<FloraForm, number> = {
  // Abgestimmt auf sanftes Gelände: kaum eine Pflanze scheitert noch am Hangtest, die Werte sind entsprechend niedriger
  tree: 2.3,
  shrub: 5,
  grass: 22,
  fungus: 4,
  aquatic: 6,
  succulent: 4,
  lichen: 16,
  vine: 3,
  crystal_plant: 4,
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
  private queue: Array<{ id: string; ix: number; iz: number; kind: CellKind; d: number }> = [];
  private readonly grassRadius: number;
  private readonly grassCell: number;
  private readonly collision: CollisionWorld | null;
  /** Hindernisse der Zelle, die gerade aufgebaut wird. */
  private pending: Collider[] = [];
  /** Lichtquellen der Zelle, die gerade gebaut wird (Signaturpflanzen legen hier ab). */
  private pendingGlow: GlowSource[] = [];
  private readonly palettes: Color[];
  /** Zweite Bewuchsfarbe je Biom (Zonen des Planetenstils). */
  private readonly palettes2: Color[];
  /** Geometrien der Signaturpflanzen (eine je Sorte, riesig, prägen die Silhouette). */
  private readonly landmarkGeos: BufferGeometry[];
  private readonly groundPalettes: Color[];
  private readonly profiles: VegetationProfile[];
  private readonly maxDensity: Record<'grass' | 'shrub' | 'tree' | 'rock', number>;
  /** Drei Blütenfarben des Planeten (aus dem Terrain-Seed, komplementär zum Bewuchs). */
  private readonly flowerColors: Color[];
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
    this.grassRadius = options.grassRadius ?? 56;
    this.grassCell = options.grassCell ?? 24;
    this.collision = options.collision ?? null;
    stylize.grassFar.value = this.grassRadius;
    // Dieselbe Stilisierung wie das Terrain, damit Gras und Boden farblich zusammenpassen
    this.palettes = planet.biomes.map((b) => vivid(new Color(b.palette.vegetation), 1.25));
    this.palettes2 = model.style.biomes.map((b) => vivid(new Color(b.vegetation2), 1.25));
    this.landmarkGeos = model.style.landmarks.map((l, i) => buildFloraGeometry(l.genome, `landmark:${planet.terrainSeed}:${i}`));
    this.groundPalettes = planet.biomes.map((b) => vivid(new Color(b.palette.ground), 1.35));
    this.profiles = planet.biomes.map((b) => VEGETATION_PROFILES[b.kind]);
    const maxOf = (t: 'grass' | 'shrub' | 'tree' | 'rock'): number => this.profiles.reduce((m, p) => Math.max(m, p[t]), 0);
    const frng = new Random(`flowers:${planet.terrainSeed}`);
    const vegHue = { h: 0, s: 0, l: 0 };
    (this.palettes[0] ?? new Color(0.3, 0.6, 0.3)).getHSL(vegHue);
    this.flowerColors = [0.5, 0.36, 0.64].map((off) => new Color().setHSL((vegHue.h + off + frng.float(-0.06, 0.06) + 1) % 1, frng.float(0.75, 0.95), frng.float(0.55, 0.68)));
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

  private densityAt(s: TerrainSample, type: 'grass' | 'shrub' | 'tree' | 'rock'): number {
    const a = (this.profiles[s.biome] as VegetationProfile)[type];
    const b = (this.profiles[s.biome2] as VegetationProfile)[type];
    return lerp(a, b, s.blend);
  }

  /** Bewuchsfarbe an einer Stelle: Biom-Mischung und Zonenwechsel zur zweiten Farbe (wie im Terrain). */
  private vegColor(s: TerrainSample, x: number, z: number, out: Color): Color {
    const vz = this.model.style.vegZone(x, z);
    out.copy(this.palettes[s.biome] as Color).lerp(this.palettes2[s.biome] as Color, vz);
    if (s.blend > 0) out.lerp(tmpColor2.copy(this.palettes[s.biome2] as Color).lerp(this.palettes2[s.biome2] as Color, vz), s.blend);
    return out;
  }

  /** Signaturpflanzen: wenige riesige Gewächse in Hainen (ferne Zellen), unabhängig von der Vegetationsdichte. */
  private placeLandmarks(rng: Random, x0: number, z0: number, size: number): InstancedMesh[] {
    const out: InstancedMesh[] = [];
    const style = this.model.style;
    const area = (size / 256) ** 2;
    const sea = this.model.seaLevel;
    style.landmarks.forEach((landmark, li) => {
      const matrices: Matrix4[] = [];
      const base = landmark.perCell * area;
      const candidates = Math.floor(base) + (rng.next() < base - Math.floor(base) ? 1 : 0);
      for (let c = 0; c < candidates; c++) {
        const x = x0 + rng.next() * size;
        const z = z0 + rng.next() * size;
        const scale = rng.float(0.7, 1.25);
        const yaw = rng.float(0, Math.PI * 2);
        const keep = rng.next();
        if (keep > style.groveZone(x, z) * 0.88 + 0.1) continue;
        const s = this.model.sample(x, z, tmpSample);
        if (this.model.hasWater && s.height < sea + 0.6) continue;
        const slope = this.model.slopeAt(x, z, 3);
        if (slope > 0.75) continue;
        // am Hang tiefer einsinken, damit der Stammfuß nicht in der Luft hängt
        tmpPos.set(x, s.height - (0.25 + slope * 1.6) * scale, z);
        tmpQuat.setFromAxisAngle(Y_AXIS, yaw);
        tmpScale.set(scale, scale * rng.float(0.9, 1.15), scale);
        matrices.push(new Matrix4().compose(tmpPos, tmpQuat, tmpScale));
        const lc = floraCollider(landmark.genome, landmark.genome.heightM * scale, x, s.height, z);
        if (lc) this.pending.push(lc);
        const lg = floraGlowColor(landmark.genome);
        if (lg) this.pendingGlow.push(glowSource(x, s.height + landmark.genome.heightM * scale * 0.6, z, clamp(2.2 + landmark.genome.heightM * scale * 1.6, 2.6, 11), lg, 1.05));
      }
      if (matrices.length === 0) return;
      const g = landmark.genome;
      const material = g.glow > 0.5 || g.form === 'crystal_plant' ? this.flora.glowMaterial : this.flora.material;
      const mesh = new InstancedMesh(this.landmarkGeos[li] as BufferGeometry, material, matrices.length);
      mesh.instanceMatrix.setUsage(StaticDrawUsage);
      for (let i = 0; i < matrices.length; i++) {
        mesh.setMatrixAt(i, matrices[i] as Matrix4);
        const l = 0.9 + ((i * 7) % 5) * 0.045;
        mesh.setColorAt(i, tmpColor.setRGB(l, l, l));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      out.push(mesh);
    });
    return out;
  }

  /** Generische Platzhalter (Gras, Steine; Bäume nur, wenn der Planet keine Baum-Arten hat). */
  private placeGeneric(rng: Random, x0: number, z0: number, size: number, types: Array<'grass' | 'shrub' | 'tree' | 'rock'>): GenericBatch[] {
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
        // größere Findlinge und Stämme sind Hindernisse, kleine Steine übersteigt man
        if (type === 'rock' && baseScale >= 0.85) this.pending.push({ x, z, r: 0.52 * baseScale, top: s.height + 0.5 * baseScale });
        else if (type === 'tree') this.pending.push({ x, z, r: 0.26 * baseScale, top: s.height + 3 * baseScale });
        if (type === 'rock') tmpColor.copy(this.groundPalettes[biome] as Color).multiplyScalar(0.75).lerp(tmpColor2.set(0.45, 0.44, 0.42), 0.4);
        else {
          this.vegColor(s, x, z, tmpColor);
          tmpColor.offsetHSL(rng.float(-0.025, 0.025), rng.float(-0.08, 0.08), rng.float(-0.08, 0.08));
        }
        batch.colors.push(tmpColor.clone());
      }
    }
    return Array.from(batches.values());
  }

  /** Dichter Grasring: Büschel nach Biom-Bedeckung, Farbe aus der Vegetationspalette (passt zum Graston des Terrains). */
  private placeGrass(rng: Random, x0: number, z0: number, size: number): GenericBatch[] {
    const maxG = this.maxDensity.grass;
    if (maxG <= 0) return [];
    const perM2 = GRASS_PER_M2 * Math.min(1, maxG / 150) * Math.min(1.15, this.bioFactor) * this.density;
    const candidates = Math.round(size * size * perM2);
    const sea = this.model.seaLevel;
    const batch: GenericBatch = { geometry: this.assets.grass, type: 'grass', matrices: [], colors: [] };
    const flowers: GenericBatch = { geometry: this.assets.flower, type: 'flower', matrices: [], colors: [] };
    for (let c = 0; c < candidates; c++) {
      const x = x0 + rng.next() * size;
      const z = z0 + rng.next() * size;
      const s = this.model.sample(x, z, tmpSample);
      const d = Math.min(1, this.densityAt(s, 'grass') / 150);
      if (d <= 0 || rng.next() > d) continue;
      if (this.model.hasWater && s.height < sea + 0.25) continue;
      // Kein Gras an Steilhängen (dort zeigt auch das Terrain Fels): Steigung aus zwei Nachbarhöhen
      const h0 = s.height;
      const gx = (this.model.heightAt(x + 0.9, z) - h0) / 0.9;
      const gz = (this.model.heightAt(x, z + 0.9) - h0) / 0.9;
      const steep = 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
      if (steep > 0.4 + rng.next() * 0.2) continue;
      const biome = s.blend > 0.5 ? s.biome2 : s.biome;
      const scale = (this.profiles[biome] as VegetationProfile).scale * rng.float(0.75, 1.5);
      // Farbtupfer: einzelne Blumen, in Flecken gehäuft (Geländerauschen), in einer der Planetenfarben
      if (rng.next() < 0.035 + 0.09 * Math.max(0, s.detail)) {
        tmpPos.set(x, h0 - 0.02, z);
        tmpQuat.setFromAxisAngle(Y_AXIS, rng.float(0, Math.PI * 2));
        const fs = scale * rng.float(0.8, 1.5);
        tmpScale.set(fs, fs * rng.float(0.8, 1.3), fs);
        flowers.matrices.push(new Matrix4().compose(tmpPos, tmpQuat, tmpScale));
        flowers.colors.push((this.flowerColors[Math.floor(rng.next() * this.flowerColors.length)] as Color).clone().offsetHSL(rng.float(-0.02, 0.02), 0, rng.float(-0.05, 0.05)));
        continue;
      }
      tmpPos.set(x, h0 - 0.03, z);
      tmpQuat.setFromAxisAngle(Y_AXIS, rng.float(0, Math.PI * 2));
      tmpScale.set(scale * rng.float(0.9, 1.3), scale * rng.float(0.8, 1.35), scale * rng.float(0.9, 1.3));
      batch.matrices.push(new Matrix4().compose(tmpPos, tmpQuat, tmpScale));
      this.vegColor(s, x, z, tmpColor);
      tmpColor.offsetHSL(rng.float(-0.03, 0.03), rng.float(-0.06, 0.08), rng.float(-0.06, 0.08));
      batch.colors.push(tmpColor.clone());
    }
    return [batch, flowers].filter((b) => b.matrices.length > 0);
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
      // Kandidaten für die höchste Biomdichte würfeln; das Biom-Profil dünnt danach aus (üppiger Dschungel, karge Wüste)
      const base = SPECIES_DENSITY[genome.form] * 2.2 * share * this.bioFactor * this.density * area * SPECIES_MAX_FACTOR;
      const candidates = Math.floor(base) + (rng.next() < base - Math.floor(base) ? 1 : 0);
      const profileType = genome.form === 'tree' ? 'tree' : genome.form === 'grass' || genome.form === 'lichen' ? 'grass' : 'shrub';
      for (let c = 0; c < candidates; c++) {
        const x = x0 + rng.next() * size;
        const z = z0 + rng.next() * size;
        const s = this.model.sample(x, z, tmpSample);
        const factor = clamp(this.densityAt(s, profileType) / SPECIES_REF[profileType], 0.35, SPECIES_MAX_FACTOR);
        if (rng.next() > factor / SPECIES_MAX_FACTOR) continue;
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
      // Ferne Zellen sind groß: je Baum prüfen, ob er im Bild (oder in der Schattenkarte) liegt
      mesh.perObjectFrustumCulled = !castShadow;
      mesh.sortObjects = false;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
    }
    return meshes;
  }

  private buildCell(ix: number, iz: number, kind: CellKind): Cell {
    const far = kind === 'f';
    this.pending = [];
    const size = kind === 'g' ? this.grassCell : far ? this.farCell : this.nearCell;
    const x0 = ix * size;
    const z0 = iz * size;
    const id = `${kind}:${ix}:${iz}`;
    const rng = new Random(`veg:${this.planet.terrainSeed}:${kind}:${size}:${ix}:${iz}`);
    const meshes: Array<InstancedMesh | BatchedMesh> = [];
    let total = 0;

    const genericTypes: Array<'grass' | 'shrub' | 'tree' | 'rock'> = kind === 'g' ? [] : far ? (this.farSpecies.length === 0 ? ['tree'] : []) : ['rock'];
    const batches = this.placeGeneric(rng.fork('generic'), x0, z0, size, genericTypes);
    if (kind === 'g') batches.push(...this.placeGrass(rng.fork('grass'), x0, z0, size));
    for (const batch of batches) {
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
      const blades = batch.type === 'grass' || batch.type === 'flower';
      // Halme werfen Schatten nur nahe der Kamera (siehe refresh) und schwingen dabei im Wind mit
      mesh.castShadow = !blades;
      if (blades) mesh.customDepthMaterial = this.assets.grassDepthMaterial;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
      total += n;
    }

    const species = kind === 'g' ? [] : this.placeSpecies(rng.fork('species'), x0, z0, size, far ? this.farSpecies : this.nearSpecies);
    // Ferne Zellen liegen außerhalb des Schattenbereichs: kein Schattenwurf (spart den zweiten Zeichendurchgang)
    for (const mesh of this.buildSpeciesMeshes(species, !far)) meshes.push(mesh);
    total += species.length;
    if (far) {
      for (const mesh of this.placeLandmarks(rng.fork('landmarks'), x0, z0, size)) {
        meshes.push(mesh);
        total += mesh.count;
      }
    }

    for (const m of meshes) this.group.add(m);
    if (this.collision && kind !== 'g') {
      for (const sp of species) {
        const c = floraCollider(sp.entry.genome as FloraGenome, sp.height, sp.x, sp.y, sp.z);
        if (c) this.pending.push(c);
      }
      this.collision.set(`veg:${id}`, this.pending);
    }
    this.pending = [];
    // Leuchtpflanzen als Lichtquellen (Lichtfleck am Boden bei Nacht)
    for (const sp of species) {
      const color = this.flora.glowColor(sp.entry);
      if (color) this.pendingGlow.push(glowSource(sp.x, sp.y + sp.height * 0.6, sp.z, clamp(2.2 + sp.height * 1.6, 2.6, 11), color, 1.05));
    }
    glowField.set(`veg:${id}`, this.pendingGlow);
    this.pendingGlow = [];
    return { id, meshes, instances: total, species: species.map((i) => ({ entry: i.entry, x: i.x, y: i.y, z: i.z, height: i.height })), far, grass: kind === 'g', cx: x0 + size / 2, cz: z0 + size / 2, half: size / 2 };
  }

  private removeCell(cell: Cell): void {
    for (const m of cell.meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.collision?.remove(`veg:${cell.id}`);
    glowField.remove(`veg:${cell.id}`);
    this.cells.delete(cell.id);
  }

  private refresh(cx: number, cz: number): void {
    const wanted = new Set<string>();
    this.queue = [];
    const scan = (radius: number, size: number, kind: CellKind): void => {
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
          const id = `${kind}:${ix}:${iz}`;
          wanted.add(id);
          if (!this.cells.has(id)) this.queue.push({ id, ix, iz, kind, d });
        }
      }
    };
    scan(this.grassRadius, this.grassCell, 'g');
    scan(this.nearRadius, this.nearCell, 'n');
    scan(this.farRadius, this.farCell, 'f');
    this.queue.sort((a, b) => a.d - b.d);
    for (const cell of Array.from(this.cells.values())) if (!wanted.has(cell.id)) this.removeCell(cell);
    // Bäume stehen in fernen Zellen: nur die Zellen in Reichweite der Schattenkarte werfen Schatten
    for (const cell of this.cells.values()) {
      if (!cell.far && !cell.grass) continue;
      const range = cell.far ? SHADOW_RANGE : GRASS_SHADOW_RANGE;
      const dx = Math.max(0, Math.abs(cx - cell.cx) - cell.half);
      const dz = Math.max(0, Math.abs(cz - cell.cz) - cell.half);
      const cast = dx * dx + dz * dz < range * range;
      for (const m of cell.meshes) if (m.castShadow !== cast) m.castShadow = cast;
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
    const cell = this.buildCell(item.ix, item.iz, item.kind);
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
    if (this.accum >= 0.35) {
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
    for (const g of this.landmarkGeos) g.dispose();
    this.group.removeFromParent();
  }
}
