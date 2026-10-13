import { BufferAttribute, BufferGeometry, Color, Mesh, type Material } from 'three';
import { clamp01, smoothstep } from '@/math/utils';
import type { TerrainModel, TerrainSample } from '@/gen/terrain/TerrainModel';

/** Segmente pro Chunk-Kante (konstant → alle Geometrien gleich groß → Pooling möglich). */
export const CHUNK_SEGMENTS = 32;

export interface ChunkKey {
  size: number;
  x: number;
  z: number;
}

export const chunkId = (k: ChunkKey): string => `${k.size}:${k.x}:${k.z}`;

export interface BiomePalette {
  ground: Color;
  accent: Color;
  vegetation: Color;
}

/** Geometrie-Pool: Vertex-/Index-Anzahl ist für alle Chunks identisch. */
export class ChunkGeometryPool {
  private readonly free: BufferGeometry[] = [];
  constructor(private readonly max = 48) {}

  acquire(): BufferGeometry {
    const g = this.free.pop();
    if (g) return g;
    return createChunkGeometry();
  }

  release(g: BufferGeometry): void {
    if (this.free.length < this.max) this.free.push(g);
    else g.dispose();
  }

  dispose(): void {
    for (const g of this.free) g.dispose();
    this.free.length = 0;
  }
}

const S = CHUNK_SEGMENTS;
const GRID_VERTS = (S + 1) * (S + 1);
const SKIRT_VERTS = 4 * (S + 1);
const TOTAL_VERTS = GRID_VERTS + SKIRT_VERTS;

function createChunkGeometry(): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(TOTAL_VERTS * 3), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(TOTAL_VERTS * 3), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(TOTAL_VERTS * 3), 3));
  // Indizes sind für alle Chunks gleich
  const idx: number[] = [];
  for (let z = 0; z < S; z++) {
    for (let x = 0; x < S; x++) {
      const a = z * (S + 1) + x;
      const b = a + 1;
      const c = a + (S + 1);
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // Skirts: je Kante S Quads zwischen Kantenvertex und abgesenkter Kopie
  const skirtBase = GRID_VERTS;
  const edges: Array<(i: number) => number> = [
    (i) => i, // Nord (z = 0)
    (i) => S * (S + 1) + i, // Süd (z = S)
    (i) => i * (S + 1), // West (x = 0)
    (i) => i * (S + 1) + S, // Ost (x = S)
  ];
  edges.forEach((edge, e) => {
    for (let i = 0; i < S; i++) {
      const g0 = edge(i);
      const g1 = edge(i + 1);
      const s0 = skirtBase + e * (S + 1) + i;
      const s1 = s0 + 1;
      // Beide Wicklungen, damit die Skirt von innen und außen sichtbar ist (DoubleSide nicht nötig)
      idx.push(g0, s0, g1, g1, s0, s1, g0, g1, s0, g1, s1, s0);
    }
  });
  geo.setIndex(idx);
  return geo;
}

// Wiederverwendete Puffer für den Aufbau (kein GC pro Chunk)
const B = S + 3; // Rand von 1 Vertex für Normalen
const heights = new Float32Array(B * B);
const samples: TerrainSample[] = Array.from({ length: (S + 1) * (S + 1) }, () => ({ height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 }));
const cRock = new Color(0x6a655f);
const cSnow = new Color(0xeef4fa);
const cSand = new Color(0xd6c48c);
const cTmp = new Color();
const cTmp2 = new Color();

export interface ChunkBuildContext {
  model: TerrainModel;
  palettes: BiomePalette[];
  waterTint: Color;
  snowLine: number; // normierte Höhe ab der Schnee liegt (>1 = nie)
}

/** Füllt die Geometrie eines Chunks aus dem Terrain-Modell. */
export function buildChunkGeometry(geo: BufferGeometry, key: ChunkKey, ctx: ChunkBuildContext): void {
  const { model, palettes } = ctx;
  const step = key.size / S;
  // Höhen inkl. Rand
  for (let z = 0; z < B; z++) {
    for (let x = 0; x < B; x++) {
      const wx = key.x + (x - 1) * step;
      const wz = key.z + (z - 1) * step;
      if (x >= 1 && x <= S + 1 && z >= 1 && z <= S + 1) {
        const s = samples[(z - 1) * (S + 1) + (x - 1)] as TerrainSample;
        model.sample(wx, wz, s);
        heights[z * B + x] = s.height;
      } else {
        heights[z * B + x] = model.heightAt(wx, wz);
      }
    }
  }
  const pos = geo.getAttribute('position') as BufferAttribute;
  const nor = geo.getAttribute('normal') as BufferAttribute;
  const col = geo.getAttribute('color') as BufferAttribute;
  const pa = pos.array as Float32Array;
  const na = nor.array as Float32Array;
  const ca = col.array as Float32Array;
  const sea = model.seaLevel;
  const hasWater = model.hasWater;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let z = 0; z <= S; z++) {
    for (let x = 0; x <= S; x++) {
      const vi = z * (S + 1) + x;
      const s = samples[vi] as TerrainSample;
      const hx0 = heights[(z + 1) * B + x] as number;
      const hx1 = heights[(z + 1) * B + x + 2] as number;
      const hz0 = heights[z * B + x + 1] as number;
      const hz1 = heights[(z + 2) * B + x + 1] as number;
      let nx = hx0 - hx1;
      let ny = 2 * step;
      let nz = hz0 - hz1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const lx = x * step;
      const lz = z * step;
      pa[vi * 3] = lx;
      pa[vi * 3 + 1] = s.height;
      pa[vi * 3 + 2] = lz;
      na[vi * 3] = nx;
      na[vi * 3 + 1] = ny;
      na[vi * 3 + 2] = nz;
      if (s.height < minY) minY = s.height;
      if (s.height > maxY) maxY = s.height;

      // Farbe
      const p1 = palettes[s.biome] as BiomePalette;
      const p2 = palettes[s.biome2] as BiomePalette;
      const t = clamp01(0.5 + s.detail * 0.7);
      cTmp.copy(p1.ground).lerp(p1.accent, t);
      if (s.blend > 0) {
        cTmp2.copy(p2.ground).lerp(p2.accent, t);
        cTmp.lerp(cTmp2, s.blend);
      }
      const slope = 1 - ny;
      if (slope > 0.3) cTmp.lerp(cRock, smoothstep(0.3, 0.55, slope) * 0.85);
      if (s.altitude > ctx.snowLine && slope < 0.5) cTmp.lerp(cSnow, smoothstep(ctx.snowLine, ctx.snowLine + 0.08, s.altitude) * (1 - slope));
      if (hasWater) {
        const d = s.height - sea;
        if (d > -1.5 && d < 2.5) cTmp.lerp(cSand, 0.6 * (1 - Math.abs(d - 0.5) / 2));
        if (d < 0) cTmp.lerp(ctx.waterTint, clamp01(-d / 18) * 0.7).multiplyScalar(clamp01(1 + d / 40));
      }
      ca[vi * 3] = cTmp.r;
      ca[vi * 3 + 1] = cTmp.g;
      ca[vi * 3 + 2] = cTmp.b;
    }
  }
  // Skirts
  const skirtDrop = key.size * 0.04 + 3;
  const edges: Array<(i: number) => number> = [(i) => i, (i) => S * (S + 1) + i, (i) => i * (S + 1), (i) => i * (S + 1) + S];
  edges.forEach((edge, e) => {
    for (let i = 0; i <= S; i++) {
      const g = edge(i);
      const sv = GRID_VERTS + e * (S + 1) + i;
      pa[sv * 3] = pa[g * 3] as number;
      pa[sv * 3 + 1] = (pa[g * 3 + 1] as number) - skirtDrop;
      pa[sv * 3 + 2] = pa[g * 3 + 2] as number;
      na[sv * 3] = na[g * 3] as number;
      na[sv * 3 + 1] = na[g * 3 + 1] as number;
      na[sv * 3 + 2] = na[g * 3 + 2] as number;
      ca[sv * 3] = (ca[g * 3] as number) * 0.8;
      ca[sv * 3 + 1] = (ca[g * 3 + 1] as number) * 0.8;
      ca[sv * 3 + 2] = (ca[g * 3 + 2] as number) * 0.8;
    }
  });
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  col.needsUpdate = true;
  // Bounding-Volumen manuell (schneller als computeBoundingSphere über alle Vertices)
  geo.computeBoundingSphere();
}

export class TerrainChunk {
  readonly mesh: Mesh;
  built = false;

  constructor(
    readonly key: ChunkKey,
    geometry: BufferGeometry,
    material: Material,
  ) {
    this.mesh = new Mesh(geometry, material);
    this.mesh.position.set(key.x, 0, key.z);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = key.size <= 256;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
  }

  intersects(other: ChunkKey): boolean {
    const a = this.key;
    return a.x < other.x + other.size && a.x + a.size > other.x && a.z < other.z + other.size && a.z + a.size > other.z;
  }
}
