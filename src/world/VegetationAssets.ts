import type { BufferGeometry} from 'three';
import { Color, ConeGeometry, CylinderGeometry, DoubleSide, IcosahedronGeometry, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, OctahedronGeometry, SphereGeometry, Vector2, type Material } from 'three';
import { textures } from '@/render/ProceduralTextures';
import type { VegetationProfile } from '@/gen/terrain/VegetationProfiles';
import { blade, colorize, gradientColor, jitter, mergeParts, taperedQuad } from './geometry';
import { addRim, addShaderPatch, stylize } from '@/render/stylize';
import { blob } from './organic';
import { addGlow, addGlowLight } from '@/render/glow';

export type PlantType = 'grass' | 'shrub' | 'tree' | 'rock' | 'flower';
export type TreeStyle = VegetationProfile['treeStyle'];

const WHITE = new Color(1, 1, 1);
const TRUNK = new Color(0.42, 0.28, 0.16);
const STEM = new Color(0.85, 0.8, 0.72);

/** Grasbüschel: fünf breite, nach außen gebogene Halme; dunkler Fuß, helle warme Spitzen (Instanzfarbe multipliziert). */
function grassGeometry(): BufferGeometry {
  const blades: BufferGeometry[] = [];
  // [Winkel, Höhe, Biegung, Breite, Abstand von der Mitte] – ein lockerer Fleck statt eines Stachelbüschels
  const spec: Array<[number, number, number, number, number]> = [
    [0.0, 0.44, 0.45, 0.075, 0.03],
    [0.9, 0.34, 0.7, 0.07, 0.2],
    [1.7, 0.4, 0.55, 0.08, 0.12],
    [2.5, 0.3, 0.8, 0.065, 0.27],
    [3.2, 0.46, 0.4, 0.075, 0.16],
    [4.0, 0.33, 0.75, 0.07, 0.25],
    [4.7, 0.38, 0.6, 0.075, 0.09],
    [5.4, 0.28, 0.85, 0.06, 0.3],
    [6.0, 0.36, 0.65, 0.07, 0.21],
  ];
  for (const [angle, h, bend, w, off] of spec) {
    const b = blade(w, h, bend, 2, 0.012, 0.8, false);
    b.rotateY(angle * 1.7);
    b.translate(Math.cos(angle) * off, 0, Math.sin(angle) * off);
    blades.push(b);
  }
  return gradientColor(mergeParts(blades, 'grass'), new Color(0.5, 0.52, 0.45), new Color(1.12, 1.12, 0.94), 0.8);
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

/** Wiesenblume: gebogener Stiel mit Blütenkopf und zwei Blättchen; die Instanzfarbe bestimmt die Blütenfarbe. */
function flowerGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const stem = blade(0.035, 0.5, 0.25, 2, 0.02, 0.6);
  parts.push(colorize(stem, new Color(0.16, 0.3, 0.14)));
  for (const a of [0.8, 3.6]) {
    const leaf = blade(0.09, 0.2, 0.9, 2, 0.01, 0.6);
    leaf.rotateY(a);
    parts.push(colorize(leaf, new Color(0.2, 0.36, 0.16)));
  }
  const head = new SphereGeometry(0.075, 7, 5);
  head.scale(1, 0.8, 1);
  head.translate(0, 0.5, 0.12);
  parts.push(gradientColor(head, new Color(0.8, 0.8, 0.8), new Color(1.25, 1.25, 1.25)));
  const core = new SphereGeometry(0.035, 5, 4);
  core.translate(0, 0.545, 0.12);
  parts.push(colorize(core, new Color(1.4, 1.3, 0.8)));
  return mergeParts(parts, 'flower');
}

/** Findling: weich verformter Klumpen mit dunkler Unterseite. */
function rockGeometry(): BufferGeometry {
  const g = blob(0.7, 'rock', 0.28, 1.5, 0.72, 10, 8);
  g.translate(0, 0.25, 0);
  return gradientColor(g, new Color(0.55, 0.55, 0.55), new Color(1.08, 1.08, 1.08), 0.8);
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
  readonly flower: BufferGeometry;
  readonly trees: Record<TreeStyle, BufferGeometry>;
  readonly grassMaterial: MeshStandardMaterial;
  readonly plantMaterial: MeshStandardMaterial;
  readonly crystalMaterial: MeshStandardMaterial;
  readonly rockMaterial: MeshStandardMaterial;
  /** Tiefenmaterial für den Schattenwurf von Gras und Blumen: gleiche Windbewegung und Ausblendung wie im Bild. */
  readonly grassDepthMaterial: MeshDepthMaterial;

  /** Farbe der Grasspitzen (Planetenstil); wird von der Szene gesetzt. */
  readonly grassTip = { value: new Color(0.75, 0.8, 0.35) };

  /** `grassTip`: Farbe, in die die Halme zur Spitze hin auslaufen (zweifarbiges Gras). */
  constructor(grassTip?: Color) {
    if (grassTip) this.grassTip.value.copy(grassTip);
    this.grass = grassGeometry();
    this.shrub = shrubGeometry();
    this.rock = rockGeometry();
    this.flower = flowerGeometry();
    this.trees = { conifer: treeGeometry('conifer'), broadleaf: treeGeometry('broadleaf'), palm: treeGeometry('palm'), fungus: treeGeometry('fungus'), crystal: treeGeometry('crystal') };
    const leaf = textures.get('leaf');
    const bark = textures.get('bark');
    const rock = textures.get('rock');
    const crystal = textures.get('crystal');
    this.grassMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9, metalness: 0, map: leaf.map, normalMap: leaf.normalMap, normalScale: new Vector2(0.4, 0.4) });
    this.plantMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.85, metalness: 0, map: bark.map, normalMap: bark.normalMap, normalScale: new Vector2(0.6, 0.6), roughnessMap: bark.roughnessMap });
    this.crystalMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.2, metalness: 0.1, normalMap: crystal.normalMap, normalScale: new Vector2(0.5, 0.5) });
    this.rockMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: rock.map, normalMap: rock.normalMap, normalScale: new Vector2(0.9, 0.9), roughnessMap: rock.roughnessMap });
    this.patchWind(this.grassMaterial, 1.0, true);
    this.grassDepthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
    this.patchWind(this.grassDepthMaterial, 1.0, true);
    // Gras ist einlagig und doppelseitig: die Rückseite behält die (nach oben zeigende) Normale statt gespiegelt dunkel zu werden
    addShaderPatch(this.grassMaterial, 'unflip', (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif');
    });
    // Zweifarbiges Gras: der Halm läuft von der Instanzfarbe (Bewuchston) in die Spitzenfarbe des Planeten aus
    addShaderPatch(this.grassMaterial, 'tip', (shader) => {
      shader.uniforms.uGrassTip = this.grassTip;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vTip;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = smoothstep(0.1, 0.4, position.y);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uGrassTip;\nvarying float vTip;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uGrassTip, vTip * 0.72);');
    });
    this.patchWind(this.plantMaterial, 0.35);
    addRim(this.plantMaterial, 0.8);
    addRim(this.rockMaterial, 0.6);
    addRim(this.crystalMaterial, 1.2);
    addGlow(this.crystalMaterial, { amount: 0.95, day: 0.3, lo: 0.25, hi: 0.75 });
    addGlowLight(this.grassMaterial);
    addGlowLight(this.plantMaterial);
    addGlowLight(this.rockMaterial);
  }

  /** Wind-Schwingen im Vertex-Shader für Instanzen (InstancedMesh) und Batches (BatchedMesh); Stärke wächst mit der Höhe. */
  patchWind(material: Material, strength: number, distanceFade = false): void {
    addShaderPatch(material, `wind-${strength}-${distanceFade ? 'fade' : 'nofade'}`, (shader) => {
      shader.uniforms.uTime = this.time;
      shader.uniforms.uWind = this.wind;
      shader.uniforms.uCamPos = stylize.camPos;
      shader.uniforms.uGrassFar = stylize.grassFar;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWind;\nuniform vec3 uCamPos;\nuniform float uGrassFar;`)
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
    ${distanceFade ? 'transformed *= 1.0 - smoothstep(uGrassFar * 0.6, uGrassFar, distance(wpos.xz, uCamPos.xz));' : ''}
  }
}`,
        );
    });
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
    this.flower.dispose();
    for (const g of Object.values(this.trees)) g.dispose();
    this.grassMaterial.dispose();
    this.grassDepthMaterial.dispose();
    this.plantMaterial.dispose();
    this.crystalMaterial.dispose();
    this.rockMaterial.dispose();
  }
}
