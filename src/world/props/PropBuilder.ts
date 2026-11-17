import type { BufferGeometry} from 'three';
import { BoxGeometry, Color, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, MeshPhysicalMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { textures } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';
import { Random } from '@/math/Random';
import { clamp } from '@/math/utils';
import type { ArchiveEntry, FossilGenome, MineralGenome } from '@/gen/archive/types';
import { colorize, gradientColor, hsl, jitter, mergeParts } from '../geometry';
import { arc, blob, lathe, prism, tube } from '../organic';

export interface PropTemplate {
  geometry: BufferGeometry;
  material: MeshPhysicalMaterial;
  /** Ungefährer Radius für Foto-/Interaktionsprüfungen. */
  radius: number;
  /** Höhe des Mittelpunkts über dem Boden. */
  centerY: number;
}

const STONE = new Color(0.45, 0.43, 0.4);
const BONE = new Color(0.85, 0.8, 0.68);
const RUIN = new Color(0.4, 0.42, 0.46);

function mineralGeometry(g: MineralGenome, rng: Random, seed: string): { geo: BufferGeometry; radius: number; centerY: number } {
  const S = clamp(g.sizeM, 0.15, 6);
  const parts: BufferGeometry[] = [];
  const light = g.luster === 'metallic' ? 0.42 : g.luster === 'adamantine' ? 0.62 : g.luster === 'glassy' ? 0.55 : 0.45;
  const main = hsl(g.hue, g.saturation, light);
  const host = STONE.clone().lerp(main, 0.2);
  let radius = S * 0.5;
  let centerY = S * 0.3;
  switch (g.form) {
    case 'vein': {
      const slab = new BoxGeometry(S * 1.2, S * 0.35, S * 0.6);
      slab.translate(0, S * 0.17, 0);
      parts.push(colorize(jitter(slab, S * 0.03, seed), host));
      for (let i = 0; i < 4; i++) {
        const v = new BoxGeometry(S * 0.9, S * 0.05, S * 0.08);
        v.rotateY(rng.float(-0.4, 0.4));
        v.translate(rng.float(-S * 0.1, S * 0.1), S * 0.36, rng.float(-S * 0.2, S * 0.2));
        parts.push(colorize(v, main));
      }
      radius = S * 0.7;
      centerY = S * 0.2;
      break;
    }
    case 'nodule': {
      const n = new SphereGeometry(S * 0.4, 10, 7);
      n.scale(1, 0.75, 1);
      parts.push(colorize(jitter(n, S * 0.04, seed), host.clone().lerp(main, 0.5), 0.2));
      for (let i = 0; i < 5; i++) {
        const b = new SphereGeometry(S * 0.12, 6, 5);
        const a = rng.float(0, Math.PI * 2);
        b.translate(Math.cos(a) * S * 0.3, S * 0.2 + rng.float(-0.05, 0.1) * S, Math.sin(a) * S * 0.3);
        parts.push(colorize(b, main));
      }
      centerY = S * 0.25;
      break;
    }
    case 'geode': {
      const shell = new SphereGeometry(S * 0.45, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65);
      shell.scale(1, 0.8, 1);
      shell.translate(0, S * 0.3, 0);
      parts.push(colorize(shell, host, 0.2));
      for (let i = 0; i < 9; i++) {
        const o = new OctahedronGeometry(S * 0.07, 0);
        o.scale(1, 2.2, 1);
        const a = rng.float(0, Math.PI * 2);
        const r = rng.float(0, S * 0.28);
        o.translate(Math.cos(a) * r, S * 0.25, Math.sin(a) * r);
        parts.push(colorize(o, main));
      }
      centerY = S * 0.3;
      break;
    }
    case 'placer': {
      for (let i = 0; i < 12; i++) {
        const p = new SphereGeometry(S * rng.float(0.04, 0.09), 5, 4);
        p.translate(rng.float(-S * 0.6, S * 0.6), S * 0.04, rng.float(-S * 0.6, S * 0.6));
        parts.push(colorize(p, main));
      }
      const bed = new BoxGeometry(S * 1.4, S * 0.05, S * 1.4);
      bed.translate(0, S * 0.02, 0);
      parts.push(colorize(bed, host.clone().multiplyScalar(0.9)));
      radius = S * 0.8;
      centerY = S * 0.05;
      break;
    }
    case 'outcrop': {
      const o = new BoxGeometry(S * 0.8, S * 0.9, S * 0.5);
      o.rotateZ(0.35);
      o.rotateX(0.2);
      o.translate(0, S * 0.35, 0);
      parts.push(colorize(jitter(o, S * 0.04, seed), host.clone().lerp(main, 0.45), 0.25));
      centerY = S * 0.4;
      break;
    }
    case 'crystal_cluster': {
      const n = 5 + rng.int(0, 4);
      for (let i = 0; i < n; i++) {
        const o = new OctahedronGeometry(S * 0.12, 0);
        const h = S * rng.float(0.4, 0.9);
        o.scale(1, h / (S * 0.12), 1);
        o.rotateX(rng.float(-0.5, 0.5));
        o.rotateZ(rng.float(-0.5, 0.5));
        o.rotateY(rng.float(0, Math.PI * 2));
        o.translate(rng.float(-S * 0.25, S * 0.25), h * 0.4, rng.float(-S * 0.25, S * 0.25));
        parts.push(colorize(o, main, 0.3));
      }
      const base = new DodecahedronGeometry(S * 0.3, 0);
      base.scale(1, 0.5, 1);
      parts.push(colorize(base, host));
      centerY = S * 0.4;
      break;
    }
    case 'boulder': {
      const b = new DodecahedronGeometry(S * 0.5, 1);
      b.scale(1, 0.8, 1);
      b.translate(0, S * 0.35, 0);
      parts.push(colorize(jitter(b, S * 0.06, seed), host.clone().lerp(main, 0.5), 0.25));
      centerY = S * 0.4;
      break;
    }
    case 'layer': {
      for (let i = 0; i < 4; i++) {
        const l = new BoxGeometry(S * (1.1 - i * 0.12), S * 0.12, S * (0.8 - i * 0.08));
        l.rotateY(rng.float(-0.15, 0.15));
        l.translate(rng.float(-S * 0.05, S * 0.05), S * 0.06 + i * S * 0.13, 0);
        parts.push(colorize(l, i % 2 === 0 ? host : host.clone().lerp(main, 0.6)));
      }
      radius = S * 0.6;
      centerY = S * 0.28;
      break;
    }
  }
  return { geo: mergeParts(parts, `mineral ${g.form}`), radius, centerY };
}

function fossilGeometry(g: FossilGenome, rng: Random, seed: string): { geo: BufferGeometry; radius: number; centerY: number } {
  const S = clamp(g.sizeM, 0.1, 30);
  const parts: BufferGeometry[] = [];
  let radius = S * 0.5;
  let centerY = S * 0.3;
  const stone = STONE.clone().offsetHSL(0, 0, (g.erosion - 0.5) * 0.1);
  const fossilTint = hsl(g.hue, 0.3, 0.55);
  if (g.ruinKind) {
    const ruin = RUIN.clone().lerp(hsl(g.hue, 0.25, 0.4), 0.4).offsetHSL(0, 0, (0.5 - g.erosion) * 0.08);
    // Am Fuß dunkel und erdig: Mauerwerk wächst aus dem Boden, statt auf ihm zu liegen
    const dirt = ruin.clone().multiplyScalar(0.5).lerp(new Color(0.2, 0.17, 0.13), 0.35);
    const glow = hsl(g.hue + 180, 0.8, 0.6);
    /** Fundamenttiefe: so weit reicht jedes Teil unter den Boden (füllt Lücken am Hang). */
    const BURY = S * 0.3;
    /**
     * Verwitterter Quader mit gefasten Kanten und Fundament. `w`/`d` Breite und Tiefe, `h` Höhe über dem Boden,
     * `lean` Neigung um die Tiefenachse, `yaw` Drehung, `taper` Verjüngung nach oben.
     */
    const block = (w: number, h: number, d: number, x: number, z: number, lean = 0, yaw = 0, taper = 0.94, bottom = dirt, top = ruin): void => {
      const r = w / Math.SQRT2;
      const b = prism(
        [
          [r * 1.04, -BURY],
          [r * 1.02, 0],
          [r * taper, h * 0.93],
          [r * taper * 0.9, h],
          [0.001, h],
        ],
        4,
      );
      b.scale(1, 1, d / w);
      if (lean) b.rotateZ(lean);
      if (yaw) b.rotateY(yaw);
      b.translate(x, 0, z);
      parts.push(gradientColor(b, bottom, top, 0.55));
    };
    /** Umgestürztes, halb versunkenes Bruchstück. */
    const fragment = (size: number, x: number, z: number, i: number): void => {
      const f = blob(size, `${seed}:frag${i}`, 0.3, 1.7, 0.6, 7, 5);
      f.rotateY(rng.float(0, Math.PI));
      f.translate(x, size * 0.12, z);
      parts.push(gradientColor(f, dirt, ruin, 0.7));
    };
    switch (g.ruinKind) {
      case 'monolith': {
        block(S * 0.27, S, S * 0.17, 0, 0, rng.float(-0.07, 0.07), 0, 0.82);
        fragment(S * 0.1, S * 0.3, S * 0.12, 0);
        fragment(S * 0.07, -S * 0.26, -S * 0.1, 1);
        centerY = S * 0.5;
        radius = S * 0.5;
        break;
      }
      case 'wall': {
        const n = 3 + rng.int(0, 4);
        // durchgehendes Fundament, darauf unterschiedlich hohe Mauerreste
        const course = prism(
          [
            [S * 0.11, -BURY],
            [S * 0.11, S * 0.06],
            [0.001, S * 0.06],
          ],
          4,
        );
        course.scale(n * 1.45, 1, 1.25);
        parts.push(gradientColor(course, dirt, ruin.clone().multiplyScalar(0.85), 0.6));
        for (let i = 0; i < n; i++) {
          const h = S * rng.float(0.2, 0.45);
          block(S * 0.27, h, S * 0.15, (i - (n - 1) / 2) * S * 0.29, rng.float(-0.015, 0.015) * S, rng.float(-0.03, 0.03), 0, 0.97);
        }
        fragment(S * 0.08, S * 0.1, S * 0.2, 0);
        fragment(S * 0.06, -S * 0.3, -S * 0.2, 1);
        radius = S * 0.5;
        centerY = S * 0.15;
        break;
      }
      case 'statue': {
        block(S * 0.42, S * 0.1, S * 0.42, 0, 0, 0, 0, 0.98);
        const step = prism(
          [
            [S * 0.21, S * 0.1],
            [S * 0.2, S * 0.17],
            [0.001, S * 0.17],
          ],
          4,
        );
        parts.push(colorize(step, ruin));
        // Gestalt: Gewand, Schultern, Kopf – als Rotationskörper verwittert und ohne Details
        const body = lathe(
          [
            [S * 0.13, S * 0.17],
            [S * 0.1, S * 0.36],
            [S * 0.085, S * 0.52],
            [S * 0.12, S * 0.62],
            [S * 0.1, S * 0.68],
            [S * 0.04, S * 0.72],
          ],
          9,
        );
        parts.push(gradientColor(body, ruin.clone().multiplyScalar(0.8), ruin, 0.8));
        const head = blob(S * 0.085, `${seed}:head`, 0.12, 1.4, 1.1, 8, 6);
        head.translate(0, S * 0.79, 0);
        parts.push(colorize(head, ruin));
        fragment(S * 0.07, S * 0.3, S * 0.05, 0);
        centerY = S * 0.45;
        break;
      }
      case 'machine': {
        const dark = ruin.clone().multiplyScalar(0.75);
        block(S * 0.52, S * 0.3, S * 0.42, 0, 0, 0, 0, 0.9, dirt, dark);
        const dome = lathe(
          [
            [S * 0.17, S * 0.29],
            [S * 0.16, S * 0.36],
            [S * 0.1, S * 0.43],
            [0.001, S * 0.45],
          ],
          10,
        );
        parts.push(colorize(dome, hsl(g.hue, 0.5, 0.5)));
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          const px = Math.cos(a) * S * 0.2;
          const pz = Math.sin(a) * S * 0.16;
          parts.push(colorize(tube(arc([px, S * 0.3, pz], [px * 1.9, -S * 0.05, pz * 1.9], [0, S * 0.12, 0], S * 0.028, S * 0.028, 5), 6), dark));
        }
        const eye = blob(S * 0.04, `${seed}:eye`, 0, 1, 1, 7, 5);
        eye.translate(0, S * 0.2, S * 0.215);
        parts.push(colorize(eye, glow));
        centerY = S * 0.2;
        break;
      }
      case 'glyph_stone': {
        // nach hinten geneigte Tafel, Unterkante im Boden
        const slab = prism(
          [
            [S * 0.36, -BURY],
            [S * 0.35, 0],
            [S * 0.33, S * 0.5],
            [S * 0.28, S * 0.55],
            [0.001, S * 0.55],
          ],
          4,
        );
        slab.scale(1.3, 1, 0.24);
        slab.rotateX(-0.22);
        parts.push(gradientColor(slab, dirt, ruin, 0.6));
        for (let i = 0; i < 5; i++) {
          const gl = prism(
            [
              [S * 0.04, 0],
              [S * 0.04, S * 0.07],
              [0.001, S * 0.07],
            ],
            4,
          );
          gl.scale(1, 1, 0.3);
          gl.rotateX(-0.22);
          gl.translate((i - 2) * S * 0.13, S * 0.26 + (i % 2) * S * 0.05, S * 0.07 - (S * 0.26 + (i % 2) * S * 0.05) * 0.22);
          parts.push(colorize(gl, glow));
        }
        fragment(S * 0.06, S * 0.38, S * 0.1, 0);
        centerY = S * 0.25;
        break;
      }
      case 'wreck': {
        // schräg im Boden steckender Rumpf: das Heck ist versunken
        const dark = ruin.clone().multiplyScalar(0.7);
        const hull = lathe(
          [
            [0.001, -S * 0.5],
            [S * 0.14, -S * 0.42],
            [S * 0.21, -S * 0.15],
            [S * 0.2, S * 0.2],
            [S * 0.12, S * 0.4],
            [0.001, S * 0.46],
          ],
          9,
        );
        hull.rotateZ(Math.PI / 2 - 0.32);
        hull.rotateY(0.3);
        hull.translate(0, S * 0.1, 0);
        parts.push(gradientColor(hull, dirt, dark, 0.5));
        const fin = prism(
          [
            [S * 0.2, -S * 0.1],
            [S * 0.17, S * 0.2],
            [S * 0.06, S * 0.38],
            [0.001, S * 0.38],
          ],
          4,
        );
        fin.scale(0.16, 1, 1);
        fin.translate(-S * 0.33, S * 0.12, 0);
        parts.push(colorize(fin, dark));
        for (let i = 0; i < 3; i++) fragment(S * rng.float(0.04, 0.08), S * rng.float(-0.45, 0.45), S * rng.float(0.2, 0.4) * (i % 2 ? -1 : 1), i);
        centerY = S * 0.2;
        break;
      }
      case 'beacon': {
        const foot = lathe(
          [
            [S * 0.2, -BURY],
            [S * 0.19, 0],
            [S * 0.14, S * 0.06],
            [S * 0.1, S * 0.08],
          ],
          8,
        );
        parts.push(gradientColor(foot, dirt, ruin, 0.6));
        const mast = lathe(
          [
            [S * 0.1, S * 0.08],
            [S * 0.07, S * 0.4],
            [S * 0.085, S * 0.43],
            [S * 0.06, S * 0.46],
            [S * 0.04, S * 0.86],
            [S * 0.07, S * 0.9],
          ],
          8,
        );
        parts.push(gradientColor(mast, ruin.clone().multiplyScalar(0.85), ruin, 0.8));
        const top = blob(S * 0.09, `${seed}:top`, 0.05, 1.2, 1, 8, 6);
        top.translate(0, S * 0.97, 0);
        parts.push(colorize(top, hsl(g.hue, 0.9, 0.65)));
        centerY = S * 0.5;
        radius = S * 0.5;
        break;
      }
    }
  } else {
    const slab = new BoxGeometry(S * 1.6, S * 0.12, S * 1.2);
    slab.translate(0, S * 0.06, 0);
    parts.push(colorize(jitter(slab, S * 0.02, seed), stone));
    switch (g.fossilKind ?? 'imprint') {
      case 'shell': {
        const t = new TorusGeometry(S * 0.3, S * 0.07, 6, 16, Math.PI * 1.6);
        t.rotateX(Math.PI / 2);
        t.translate(0, S * 0.13, 0);
        parts.push(colorize(t, fossilTint));
        break;
      }
      case 'bone': {
        for (let i = 0; i < 4; i++) {
          const b = new CylinderGeometry(S * 0.035, S * 0.035, S * rng.float(0.5, 0.9), 6);
          b.rotateZ(Math.PI / 2);
          b.rotateY(rng.float(-0.4, 0.4));
          b.translate(rng.float(-S * 0.2, S * 0.2), S * 0.14, (i - 1.5) * S * 0.2);
          parts.push(colorize(b, BONE));
        }
        break;
      }
      case 'imprint': {
        for (let i = 0; i < 6; i++) {
          const r = new BoxGeometry(S * 0.5, S * 0.02, S * 0.05);
          r.rotateY((i / 6) * Math.PI - Math.PI / 2 + 0.3);
          r.translate(i * S * 0.08 - S * 0.2, S * 0.13, 0);
          parts.push(colorize(r, fossilTint.clone().multiplyScalar(0.8)));
        }
        break;
      }
      case 'amber': {
        const a = new IcosahedronGeometry(S * 0.3, 1);
        a.translate(0, S * 0.35, 0);
        parts.push(colorize(jitter(a, S * 0.03, seed), hsl(38, 0.85, 0.5)));
        break;
      }
      case 'petrified_wood': {
        const log = new CylinderGeometry(S * 0.2, S * 0.24, S * 1.2, 9);
        log.rotateZ(Math.PI / 2);
        log.translate(0, S * 0.3, 0);
        parts.push(colorize(jitter(log, S * 0.02, seed), hsl(g.hue, 0.35, 0.4), 0.2));
        break;
      }
      case 'trace': {
        for (let i = 0; i < 5; i++) {
          const f = new SphereGeometry(S * 0.07, 6, 4);
          f.scale(1, 0.3, 1.4);
          f.translate((i - 2) * S * 0.28, S * 0.12, (i % 2) * S * 0.18 - S * 0.09);
          parts.push(colorize(f, stone.clone().multiplyScalar(0.7)));
        }
        break;
      }
      case 'egg': {
        for (let i = 0; i < 3; i++) {
          const e = new SphereGeometry(S * 0.16, 8, 6);
          e.scale(1, 1.25, 1);
          const a = (i / 3) * Math.PI * 2;
          e.translate(Math.cos(a) * S * 0.18, S * 0.25, Math.sin(a) * S * 0.18);
          parts.push(colorize(e, BONE.clone().lerp(fossilTint, 0.3)));
        }
        break;
      }
    }
    radius = S * 0.8;
    centerY = S * 0.15;
  }
  return { geo: mergeParts(parts, `fossil ${g.ruinKind ?? g.fossilKind}`), radius, centerY };
}

/** Baut die Vorlage (Geometrie + Material) für Erze, Gesteine, Fossilien und Ruinen aus dem Genom. */
export function buildPropTemplate(entry: ArchiveEntry): PropTemplate {
  const rng = new Random(`prop:${entry.id}`);
  const seed = `prop:${entry.id}`;
  if (entry.genome.kind === 'mineral') {
    const g = entry.genome as MineralGenome;
    const { geo, radius, centerY } = mineralGeometry(g, rng, seed);
    const glow = g.glow > 0.4;
    const glassy = g.luster === 'glassy' || g.luster === 'adamantine';
    const tex = textures.get(glassy ? 'crystal' : g.luster === 'metallic' ? 'metal' : 'rock');
    const material = new MeshPhysicalMaterial({
      vertexColors: true,
      map: tex.map,
      normalMap: tex.normalMap,
      normalScale: new Vector2(glassy ? 0.5 : 0.9, glassy ? 0.5 : 0.9),
      roughnessMap: tex.roughnessMap,
      roughness: g.luster === 'metallic' ? 0.35 : glassy ? 0.2 : g.luster === 'pearly' ? 0.45 : 0.9,
      metalness: g.luster === 'metallic' ? 0.6 : g.luster === 'adamantine' ? 0.2 : 0,
      clearcoat: glassy ? 0.8 : g.luster === 'pearly' ? 0.5 : 0,
      clearcoatRoughness: glassy ? 0.08 : 0.3,
      iridescence: g.luster === 'pearly' ? 0.6 : g.luster === 'adamantine' ? 0.4 : 0,
      emissive: glow ? hsl(g.hue, 0.8, 0.5) : new Color(0, 0, 0),
      emissiveIntensity: glow ? 0.5 : 0,
    });
    addRim(material, 0.8);
    return { geometry: geo, material, radius, centerY };
  }
  const g = entry.genome as FossilGenome;
  const { geo, radius, centerY } = fossilGeometry(g, rng, seed);
  const emissive = g.ruinKind === 'beacon' || g.ruinKind === 'glyph_stone' || g.ruinKind === 'machine';
  const metalRuin = g.ruinKind === 'machine' || g.ruinKind === 'wreck';
  const ftex = textures.get(g.fossilKind === 'amber' ? 'crystal' : metalRuin ? 'metal' : 'rock');
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    map: ftex.map,
    normalMap: ftex.normalMap,
    normalScale: new Vector2(0.8, 0.8),
    roughnessMap: ftex.roughnessMap,
    roughness: g.fossilKind === 'amber' ? 0.25 : 0.85,
    clearcoat: g.fossilKind === 'amber' ? 0.9 : 0,
    metalness: metalRuin ? 0.4 : 0,
    emissive: emissive ? hsl(g.hue + 180, 0.8, 0.5) : new Color(0, 0, 0),
    emissiveIntensity: emissive ? 0.35 : 0,
    transparent: g.fossilKind === 'amber',
    opacity: g.fossilKind === 'amber' ? 0.85 : 1,
  });
  addRim(material, 0.6);
  return { geometry: geo, material, radius, centerY };
}
