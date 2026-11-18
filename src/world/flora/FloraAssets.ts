import { DoubleSide, MeshStandardMaterial, Vector2, type BufferGeometry, type Color } from 'three';
import { textures } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';
import type { ArchiveEntry, FloraGenome } from '@/gen/archive/types';
import { buildFloraGeometry } from './FloraBuilder';
import { hsl } from '../geometry';
import type { VegetationAssets } from '../VegetationAssets';
import { addGlow, addGlowLight } from '@/render/glow';

/** Leuchtet die Pflanze (wie in `materialFor`)? Liefert die Farbe ihres Lichts, sonst null. */
export function floraGlowColor(g: FloraGenome): Color | null {
  if (g.glow > 0.5) return hsl(g.flowerHue, 0.85, 0.6);
  if (g.form === 'crystal_plant') return hsl(g.leafHue + 26, 0.72, 0.58);
  return null;
}

/** Geometrie-Cache für Flora-Arten (ein Mesh je Eintrag) plus Materialien (Standard / leuchtend). */
export class FloraAssets {
  private readonly cache = new Map<string, BufferGeometry>();
  readonly material: MeshStandardMaterial;
  readonly glowMaterial: MeshStandardMaterial;

  constructor(assets: VegetationAssets) {
    const bark = textures.get('bark');
    const crystal = textures.get('crystal');
    // Beidseitig: Kronen, Hüte und Schirme sind unten offen und wären von unten gesehen durchsichtig
    this.material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.85, metalness: 0, map: bark.map, normalMap: bark.normalMap, normalScale: new Vector2(0.5, 0.5), roughnessMap: bark.roughnessMap });
    this.glowMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.35, metalness: 0, normalMap: crystal.normalMap, normalScale: new Vector2(0.5, 0.5) });
    assets.patchWind(this.material, 0.35);
    assets.patchWind(this.glowMaterial, 0.2);
    addRim(this.material, 0.8);
    addRim(this.glowMaterial, 1.2);
    // Leuchtpflanzen strahlen in ihrer eigenen Blüten- und Spitzenfarbe; normale Pflanzen empfangen deren Licht
    addGlow(this.glowMaterial, { amount: 1.15, day: 0.2, lo: 0.5, hi: 0.9 });
    addGlowLight(this.material);
  }

  get(entry: ArchiveEntry): BufferGeometry {
    let g = this.cache.get(entry.id);
    if (!g) {
      g = buildFloraGeometry(entry.genome as FloraGenome, entry.id);
      this.cache.set(entry.id, g);
    }
    return g;
  }

  materialFor(entry: ArchiveEntry): MeshStandardMaterial {
    const g = entry.genome as FloraGenome;
    return g.glow > 0.5 || g.form === 'crystal_plant' ? this.glowMaterial : this.material;
  }

  private readonly glowColors = new Map<string, Color | null>();

  /** Farbe des Lichts, das die Art abgibt (null = leuchtet nicht). */
  glowColor(entry: ArchiveEntry): Color | null {
    let c = this.glowColors.get(entry.id);
    if (c === undefined) {
      c = floraGlowColor(entry.genome as FloraGenome);
      this.glowColors.set(entry.id, c);
    }
    return c;
  }

  get size(): number {
    return this.cache.size;
  }

  dispose(): void {
    for (const g of this.cache.values()) g.dispose();
    this.cache.clear();
    this.material.dispose();
    this.glowMaterial.dispose();
  }
}
