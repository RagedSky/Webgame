import type { BufferGeometry} from 'three';
import { Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, IcosahedronGeometry, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, Vector2, type Material } from 'three';
import { textures } from '@/render/ProceduralTextures';
import type { VegetationProfile } from '@/gen/terrain/VegetationProfiles';
import { colorize, jitter, mergeParts, taperedQuad } from './geometry';

export type PlantType = 'grass' | 'shrub' | 'tree' | 'rock';
export type TreeStyle = VegetationProfile['treeStyle'];

const WHITE = new Color(1, 1, 1);
const TRUNK = new Color(0.42, 0.28, 0.16);
const STEM = new Color(0.85, 0.8, 0.72);

function grassGeometry(): BufferGeometry {
  const blades: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const q = taperedQuad(0.22, 0.55, 0.02);
    q.rotateY((i * Math.PI) / 3);
    blades.push(q);
  }
  return colorize(mergeParts(blades, 'grass'), WHITE, 0.55);
}

function shrubGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(0.6, 1);
  g.scale(1, 0.75, 1);
  g.translate(0, 0.45, 0);
  jitter(g, 0.08, 'shrub');
  return colorize(g, WHITE, 0.35);
}

function treeGeometry(style: TreeStyle): BufferGeometry {
  const parts: BufferGeometry[] = [];
  switch (style) {
    case 'conifer': {
      const trunk = new CylinderGeometry(0.12, 0.24, 2.4, 6);
      trunk.translate(0, 1.2, 0);
      parts.push(colorize(trunk, TRUNK));
      for (const [r, h, y] of [[1.5, 2.4, 2.7], [1.15, 2.2, 4.0], [0.8, 2.0, 5.2]] as Array<[number, number, number]>) {
        const c = new ConeGeometry(r, h, 7);
        c.translate(0, y, 0);
        parts.push(colorize(c, WHITE, 0.25));
      }
      break;
    }
    case 'broadleaf': {
      const trunk = new CylinderGeometry(0.16, 0.3, 3, 6);
      trunk.translate(0, 1.5, 0);
      parts.push(colorize(trunk, TRUNK));
      const c1 = new IcosahedronGeometry(1.7, 1);
      c1.scale(1, 0.85, 1);
      c1.translate(0, 3.7, 0);
      parts.push(colorize(jitter(c1, 0.12, 'canopy1'), WHITE, 0.3));
      const c2 = new IcosahedronGeometry(1.1, 1);
      c2.translate(0.9, 4.4, 0.5);
      parts.push(colorize(jitter(c2, 0.1, 'canopy2'), WHITE, 0.3));
      break;
    }
    case 'palm': {
      const trunk = new CylinderGeometry(0.13, 0.26, 5.2, 6);
      trunk.translate(0, 2.6, 0);
      parts.push(colorize(trunk, TRUNK));
      for (let i = 0; i < 7; i++) {
        const f = taperedQuad(0.55, 2.8, 0.05);
        f.rotateX(-0.45 - (i % 2) * 0.25);
        f.rotateY((i / 7) * Math.PI * 2);
        f.translate(0, 5.2, 0);
        parts.push(colorize(f, WHITE, 0.2));
      }
      break;
    }
    case 'fungus': {
      const stem = new CylinderGeometry(0.26, 0.42, 2.0, 7);
      stem.translate(0, 1, 0);
      parts.push(colorize(stem, STEM));
      const cap = new SphereGeometry(1.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.6, 1);
      cap.translate(0, 1.95, 0);
      parts.push(colorize(cap, WHITE, 0.15));
      break;
    }
    case 'crystal': {
      ([[0, 0, 0], [0.35, 1.2, 0.3], [-0.3, 2.4, 0.2]] as Array<[number, number, number]>).forEach(([rx, ry, rz], i) => {
        const o = new OctahedronGeometry(0.5, 0);
        o.scale(0.45 - i * 0.08, 2.2 - i * 0.5, 0.45 - i * 0.08);
        o.rotateX(rx);
        o.rotateZ(rz);
        o.rotateY(ry);
        o.translate(i * 0.25, 0.9 - i * 0.2, i * 0.2);
        parts.push(colorize(o, WHITE, 0.3));
      });
      break;
    }
  }
  return mergeParts(parts, `tree ${style}`);
}

function rockGeometry(): BufferGeometry {
  const g = new DodecahedronGeometry(0.7, 0);
  g.scale(1, 0.75, 1);
  jitter(g, 0.12, 'rock');
  g.translate(0, 0.25, 0);
  return colorize(g, WHITE, 0.2);
}

/**
 * Generische Platzhalter (Gras, Steine, Fallback-Bäume) und Materialien mit Wind-Shader.
 * Arten-Pflanzen kommen aus `flora/FloraAssets` (gleiche Wind-Patches über `patchWind`).
 */
export class VegetationAssets {
  readonly time = { value: 0 };
  readonly wind = { value: 0.3 };
  readonly grass: BufferGeometry;
  readonly shrub: BufferGeometry;
  readonly rock: BufferGeometry;
  readonly trees: Record<TreeStyle, BufferGeometry>;
  readonly grassMaterial: MeshStandardMaterial;
  readonly plantMaterial: MeshStandardMaterial;
  readonly crystalMaterial: MeshStandardMaterial;
  readonly rockMaterial: MeshStandardMaterial;

  constructor() {
    this.grass = grassGeometry();
    this.shrub = shrubGeometry();
    this.rock = rockGeometry();
    this.trees = { conifer: treeGeometry('conifer'), broadleaf: treeGeometry('broadleaf'), palm: treeGeometry('palm'), fungus: treeGeometry('fungus'), crystal: treeGeometry('crystal') };
    const leaf = textures.get('leaf');
    const bark = textures.get('bark');
    const rock = textures.get('rock');
    const crystal = textures.get('crystal');
    this.grassMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9, metalness: 0, map: leaf.map, normalMap: leaf.normalMap, normalScale: new Vector2(0.4, 0.4) });
    this.plantMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, map: bark.map, normalMap: bark.normalMap, normalScale: new Vector2(0.6, 0.6), roughnessMap: bark.roughnessMap });
    this.crystalMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.1, emissive: new Color(0.25, 0.2, 0.5), emissiveIntensity: 0.6, transparent: true, opacity: 0.9, normalMap: crystal.normalMap, normalScale: new Vector2(0.5, 0.5) });
    this.rockMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: rock.map, normalMap: rock.normalMap, normalScale: new Vector2(0.9, 0.9), roughnessMap: rock.roughnessMap });
    this.patchWind(this.grassMaterial, 1.0);
    this.patchWind(this.plantMaterial, 0.35);
  }

  /** Wind-Schwingen im Vertex-Shader für Instanzen (InstancedMesh) und Batches (BatchedMesh); Stärke wächst mit der Höhe. */
  patchWind(material: MeshStandardMaterial, strength: number): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.uniforms.uWind = this.wind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWind;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  vec3 wpos = vec3(0.0);
  bool hasAnchor = false;
#ifdef USE_INSTANCING
  wpos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; hasAnchor = true;
#endif
#ifdef USE_BATCHING
  wpos = (modelMatrix * batchingMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; hasAnchor = true;
#endif
  if (hasAnchor) {
    float hgt = max(transformed.y, 0.0);
    float sway = sin(uTime * 1.6 + wpos.x * 0.31 + wpos.z * 0.23) * uWind * ${strength.toFixed(2)} * 0.14 * hgt;
    float sway2 = cos(uTime * 2.3 + wpos.x * 0.17 - wpos.z * 0.29) * uWind * ${strength.toFixed(2)} * 0.06 * hgt;
    transformed.x += sway;
    transformed.z += sway2;
  }
}`,
        );
    };
    material.customProgramCacheKey = () => `wind-${strength}`;
  }

  materialFor(type: PlantType, style?: TreeStyle): Material {
    if (type === 'grass') return this.grassMaterial;
    if (type === 'rock') return this.rockMaterial;
    if (type === 'tree' && style === 'crystal') return this.crystalMaterial;
    return this.plantMaterial;
  }

  dispose(): void {
    this.grass.dispose();
    this.shrub.dispose();
    this.rock.dispose();
    for (const g of Object.values(this.trees)) g.dispose();
    this.grassMaterial.dispose();
    this.plantMaterial.dispose();
    this.crystalMaterial.dispose();
    this.rockMaterial.dispose();
  }
}
