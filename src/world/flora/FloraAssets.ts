import { Color, MeshStandardMaterial, Vector2, type BufferGeometry } from 'three';
import { textures } from '@/render/ProceduralTextures';
import type { ArchiveEntry, FloraGenome } from '@/gen/archive/types';
import { buildFloraGeometry } from './FloraBuilder';
import type { VegetationAssets } from '../VegetationAssets';

/** Geometrie-Cache für Flora-Arten (ein Mesh je Eintrag) plus Materialien (Standard / leuchtend). */
export class FloraAssets {
  private readonly cache = new Map<string, BufferGeometry>();
  readonly material: MeshStandardMaterial;
  readonly glowMaterial: MeshStandardMaterial;

  constructor(assets: VegetationAssets) {
    const bark = textures.get('bark');
    const crystal = textures.get('crystal');
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, map: bark.map, normalMap: bark.normalMap, normalScale: new Vector2(0.5, 0.5), roughnessMap: bark.roughnessMap });
    this.glowMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0, emissive: new Color(0.6, 0.55, 0.8), emissiveIntensity: 0.35, normalMap: crystal.normalMap, normalScale: new Vector2(0.5, 0.5) });
    assets.patchWind(this.material, 0.35);
    assets.patchWind(this.glowMaterial, 0.2);
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
