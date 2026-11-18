import { Color, Group, MeshStandardMaterial, Vector2, type Scene, type Vector3 } from 'three';
import { textures } from '@/render/ProceduralTextures';
import { addRim, addShaderPatch, vivid } from '@/render/stylize';
import { VEGETATION_PROFILES } from '@/gen/terrain/VegetationProfiles';
import { clamp01 } from '@/math/utils';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import { ChunkGeometryPool, TerrainChunk, buildChunkGeometry, chunkId, type BiomePalette, type ChunkBuildContext, type ChunkKey } from './TerrainChunk';
import { addGlowLight } from '@/render/glow';

export interface TerrainOptions {
  viewDistance?: number;
  minCell?: number;
  maxCell?: number;
  /** Zellen teilen sich, wenn die Kamera näher als size × splitFactor ist. */
  splitFactor?: number;
  /** Zeitbudget pro Update für Chunk-Aufbau in ms. */
  buildBudgetMs?: number;
}

/**
 * Chunk-Terrain mit Quadtree-LOD: nahe Zellen klein (64 m), ferne groß (bis 1024 m), alle mit
 * gleicher Segmentzahl. Chunks werden nach Entfernung priorisiert aufgebaut (Zeitbudget pro Frame),
 * alte Chunks erst entfernt, wenn ihre Nachfolger fertig sind (keine Löcher), Geometrien gepoolt.
 */
export class TerrainManager {
  readonly group = new Group();
  readonly material: MeshStandardMaterial;
  readonly stats = { chunks: 0, pending: 0, built: 0 };
  private readonly chunks = new Map<string, TerrainChunk>();
  private readonly pool = new ChunkGeometryPool();
  private readonly ctx: ChunkBuildContext;
  private desired = new Map<string, ChunkKey>();
  private queue: ChunkKey[] = [];
  private accum = 1;
  private viewDistance: number;
  private readonly minCell: number;
  private readonly maxCell: number;
  private readonly splitFactor: number;
  private readonly buildBudgetMs: number;
  private lastCam = { x: NaN, z: NaN };

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    options: TerrainOptions = {},
  ) {
    this.viewDistance = options.viewDistance ?? 1800;
    this.minCell = options.minCell ?? 64;
    this.maxCell = options.maxCell ?? 1024;
    this.splitFactor = options.splitFactor ?? 1.7;
    this.buildBudgetMs = options.buildBudgetMs ?? 7;
    const ground = textures.get('ground');
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, normalMap: ground.normalMap, normalScale: new Vector2(0.28, 0.28) });
    // Die Chunks haben keine UVs: die Normalmap wird in Weltkoordinaten gekachelt (einheitliche Dichte über alle LOD-Stufen)
    addShaderPatch(this.material, 'world-uv', (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n{ vec4 twp = modelMatrix * vec4( position, 1.0 ); vec2 flatUv = twp.xz * 0.23; vec2 steepUv = vec2( twp.x + twp.z, twp.y ) * 0.23; vNormalMapUv = mix( steepUv, flatUv, smoothstep( 0.55, 0.8, normal.y ) ); }');
    });
    addRim(this.material, 0.35);
    addGlowLight(this.material);
    // Gesteinsschichten an Steilwänden: waagrechte Bänder je Pixel aus der Welthöhe (unabhängig vom Raster der Chunks)
    const main = model.planet.biomes.reduce((best, b, i) => (b.coverage > model.planet.biomes[best]!.coverage ? i : best), 0);
    const strata = { value: vivid(new Color(model.style.biomes[main]!.strata), 0.85).multiplyScalar(0.8) };
    addShaderPatch(this.material, 'strata', (shader) => {
      shader.uniforms.uStrata = strata;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vStrataY;\nvarying float vSteep;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrataY = ( modelMatrix * vec4( position, 1.0 ) ).y;\nvSteep = 1.0 - normal.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uStrata;\nvarying float vStrataY;\nvarying float vSteep;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  // nur an echten Steilwänden und in der Nähe (ferne LOD-Stufen lösen die Wand nicht auf)
  float steep = smoothstep( 0.32, 0.54, vSteep ) * ( 1.0 - smoothstep( 380.0, 760.0, length( vViewPosition ) ) );
  if ( steep > 0.0 ) {
    // breite Schichten mit wechselnder Mächtigkeit, dazu feine dunkle Fugen; in der Ferne ausgeblendet
    float ph = vStrataY * 0.21 + sin( vStrataY * 0.057 ) * 1.7;
    float band = smoothstep( 0.6, 0.86, 0.5 + 0.5 * sin( ph ) ) * ( 1.0 - smoothstep( 0.6, 1.6, fwidth( ph ) ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, uStrata, band * steep * 0.45 );
    float jp = vStrataY * 1.3;
    float joint = smoothstep( 0.9, 1.0, 0.5 + 0.5 * sin( jp ) ) * ( 1.0 - smoothstep( 0.5, 1.4, fwidth( jp ) ) );
    diffuseColor.rgb *= 1.0 - 0.2 * joint * steep;
  }
}`,
        );
    });
    const planet = model.planet;
    const style = model.style;
    // Ein Hauch der Grasspitzenfarbe im Bewuchston: ferne Wiesen passen zum zweifarbigen Gras im Nahbereich
    const tip = vivid(new Color(style.grassTip), 1.1);
    // Ohne Atmosphäre fehlt das Streulicht, die Sonne trifft ungefiltert: Regolith ist in Wirklichkeit dunkel
    // (Mond: Albedo um 0,12). Dunklerer Boden hält das Relief lesbar, statt weiß auszubrennen.
    const albedo = 0.55 + 0.45 * clamp01(planet.atmosphere.density / 0.3);
    const palettes: BiomePalette[] = planet.biomes.map((b, i) => ({
      ground: vivid(new Color(b.palette.ground), 1.35).multiplyScalar(albedo),
      accent: vivid(new Color(b.palette.accent), 1.35).multiplyScalar(albedo),
      vegetation: vivid(new Color(b.palette.vegetation), 1.25).lerp(tip, 0.12),
      ground2: vivid(new Color(style.biomes[i]!.ground2), 1.3).multiplyScalar(albedo),
      vegetation2: vivid(new Color(style.biomes[i]!.vegetation2), 1.25).lerp(tip, 0.12),
    }));
    const bio = Math.min(1, 0.45 + planet.biodiversity);
    const grass = planet.biomes.map((b) => clamp01(VEGETATION_PROFILES[b.kind].grass / 150) * bio);
    const waterBiome = planet.biomes.find((b) => b.hasWater);
    // Schnee braucht Niederschlag: ohne nennenswerte Atmosphäre (Mond, Merkur) bleibt auch eine kalte Welt schneefrei
    const canSnow = planet.atmosphere.density >= 0.15 && planet.type !== 'barren';
    const snowLine = !canSnow ? 2 : planet.temperature.mean < 262 ? 0.25 : planet.temperature.mean < 285 ? 0.72 : planet.temperature.mean < 300 ? 0.9 : 2;
    this.ctx = { model, palettes, waterTint: new Color(waterBiome?.palette.ground ?? '#2f6f9a'), snowLine, grass, vegZone: style.vegZone, groundZone: style.groundZone };
    scene.add(this.group);
  }

  /** Berechnet die gewünschten Blattzellen des Quadtrees um die Kamera. */
  private select(cx: number, cz: number): Map<string, ChunkKey> {
    const out = new Map<string, ChunkKey>();
    const R = this.viewDistance + this.maxCell;
    const i0 = Math.floor((cx - R) / this.maxCell);
    const i1 = Math.floor((cx + R) / this.maxCell);
    const j0 = Math.floor((cz - R) / this.maxCell);
    const j1 = Math.floor((cz + R) / this.maxCell);
    const visit = (x: number, z: number, size: number): void => {
      const mx = x + size / 2;
      const mz = z + size / 2;
      const d = Math.hypot(mx - cx, mz - cz);
      if (d > this.viewDistance + size * 0.75) return;
      if (size > this.minCell && d < size * this.splitFactor) {
        const h = size / 2;
        visit(x, z, h);
        visit(x + h, z, h);
        visit(x, z + h, h);
        visit(x + h, z + h, h);
        return;
      }
      const key: ChunkKey = { size, x, z };
      out.set(chunkId(key), key);
    };
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) visit(i * this.maxCell, j * this.maxCell, this.maxCell);
    return out;
  }

  /** Baut alle gewünschten Chunks sofort (Ladebildschirm). Gibt die Anzahl zurück. */
  buildAllNow(cameraPos: Vector3, maxMs = Infinity): number {
    this.refresh(cameraPos.x, cameraPos.z);
    const t0 = performance.now();
    let n = 0;
    while (this.queue.length && performance.now() - t0 < maxMs) {
      this.buildNext();
      n++;
    }
    this.reconcile();
    return n;
  }

  get pending(): number {
    return this.queue.length;
  }

  private refresh(cx: number, cz: number): void {
    this.desired = this.select(cx, cz);
    this.queue = [];
    for (const [id, key] of this.desired) {
      if (!this.chunks.has(id)) this.queue.push(key);
    }
    this.queue.sort((a, b) => {
      const da = Math.hypot(a.x + a.size / 2 - cx, a.z + a.size / 2 - cz);
      const db = Math.hypot(b.x + b.size / 2 - cx, b.z + b.size / 2 - cz);
      return da - db;
    });
    this.lastCam.x = cx;
    this.lastCam.z = cz;
  }

  private buildNext(): void {
    const key = this.queue.shift();
    if (!key) return;
    const id = chunkId(key);
    if (this.chunks.has(id)) return;
    const geo = this.pool.acquire();
    buildChunkGeometry(geo, key, this.ctx);
    const chunk = new TerrainChunk(key, geo, this.material);
    chunk.built = true;
    this.chunks.set(id, chunk);
    this.group.add(chunk.mesh);
    this.stats.built++;
  }

  /** Entfernt überholte Chunks, sobald alle gewünschten Nachfolger existieren; macht neue sichtbar. */
  private reconcile(): void {
    const stale: TerrainChunk[] = [];
    for (const [id, chunk] of this.chunks) if (!this.desired.has(id)) stale.push(chunk);
    const desiredList = Array.from(this.desired.values());
    const remaining: TerrainChunk[] = [];
    for (const old of stale) {
      let covered = true;
      for (const k of desiredList) {
        if (old.intersects(k) && !this.chunks.has(chunkId(k))) {
          covered = false;
          break;
        }
      }
      if (covered) {
        this.group.remove(old.mesh);
        this.pool.release(old.mesh.geometry);
        this.chunks.delete(chunkId(old.key));
      } else remaining.push(old);
    }
    for (const [id, chunk] of this.chunks) {
      if (!this.desired.has(id)) continue;
      let blocked = false;
      for (const old of remaining) {
        if (old.intersects(chunk.key)) {
          blocked = true;
          break;
        }
      }
      chunk.mesh.visible = !blocked;
    }
    this.stats.chunks = this.chunks.size;
    this.stats.pending = this.queue.length;
  }

  /** Sichtweite ändern (Zellen werden beim nächsten Update neu ausgewählt). */
  setViewDistance(d: number): void {
    if (d === this.viewDistance) return;
    this.viewDistance = d;
    this.lastCam.x = NaN;
  }

  update(cameraPos: Vector3, dt: number): void {
    this.accum += dt;
    const moved = Math.hypot(cameraPos.x - this.lastCam.x, cameraPos.z - this.lastCam.z);
    if (this.accum >= 0.33 || moved > 24 || Number.isNaN(this.lastCam.x)) {
      this.accum = 0;
      this.refresh(cameraPos.x, cameraPos.z);
    }
    if (this.queue.length) {
      const t0 = performance.now();
      do {
        this.buildNext();
      } while (this.queue.length && performance.now() - t0 < this.buildBudgetMs);
    }
    this.reconcile();
  }

  heightAt(x: number, z: number): number {
    return this.model.heightAt(x, z);
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    this.chunks.clear();
    this.pool.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
