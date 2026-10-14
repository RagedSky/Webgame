import type { BufferGeometry} from 'three';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, MeshPhysicalMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { textures } from '@/render/ProceduralTextures';
import { Random } from '@/math/Random';
import { clamp } from '@/math/utils';
import type { ArchiveEntry, FossilGenome, MineralGenome } from '@/gen/archive/types';
import { colorize, hsl, jitter, mergeParts } from '../geometry';

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
    const ruin = RUIN.clone().lerp(hsl(g.hue, 0.25, 0.4), 0.4);
    switch (g.ruinKind) {
      case 'monolith': {
        const m = new BoxGeometry(S * 0.25, S, S * 0.18);
        m.rotateZ(rng.float(-0.08, 0.08));
        m.translate(0, S * 0.5, 0);
        parts.push(colorize(jitter(m, S * 0.01, seed), ruin, 0.3));
        centerY = S * 0.5;
        radius = S * 0.5;
        break;
      }
      case 'wall': {
        const n = 3 + rng.int(0, 4);
        for (let i = 0; i < n; i++) {
          const h = S * rng.float(0.2, 0.45);
          const b = new BoxGeometry(S * 0.28, h, S * 0.14);
          b.translate((i - n / 2) * S * 0.3, h / 2, rng.float(-0.02, 0.02) * S);
          parts.push(colorize(b, ruin, 0.3));
        }
        radius = S * 0.5;
        centerY = S * 0.15;
        break;
      }
      case 'statue': {
        const base = new BoxGeometry(S * 0.4, S * 0.15, S * 0.4);
        base.translate(0, S * 0.075, 0);
        parts.push(colorize(base, ruin));
        const body = new CylinderGeometry(S * 0.08, S * 0.12, S * 0.55, 7);
        body.translate(0, S * 0.42, 0);
        parts.push(colorize(body, ruin, 0.2));
        const head = new SphereGeometry(S * 0.1, 8, 6);
        head.translate(0, S * 0.78, 0);
        parts.push(colorize(head, ruin));
        centerY = S * 0.45;
        break;
      }
      case 'machine': {
        const core = new BoxGeometry(S * 0.5, S * 0.35, S * 0.4);
        core.translate(0, S * 0.18, 0);
        parts.push(colorize(core, ruin.clone().multiplyScalar(0.8)));
        for (let i = 0; i < 3; i++) {
          const c = new CylinderGeometry(S * 0.06, S * 0.06, S * 0.5, 8);
          c.rotateZ(Math.PI / 2);
          c.translate(0, S * 0.3 + i * S * 0.08, (i - 1) * S * 0.12);
          parts.push(colorize(c, hsl(g.hue, 0.5, 0.5)));
        }
        centerY = S * 0.2;
        break;
      }
      case 'glyph_stone': {
        const slab = new BoxGeometry(S * 0.7, S * 0.5, S * 0.12);
        slab.rotateX(-0.25);
        slab.translate(0, S * 0.25, 0);
        parts.push(colorize(slab, ruin, 0.2));
        for (let i = 0; i < 5; i++) {
          const gl = new BoxGeometry(S * 0.08, S * 0.08, S * 0.02);
          gl.rotateX(-0.25);
          gl.translate((i - 2) * S * 0.12, S * 0.3, S * 0.07);
          parts.push(colorize(gl, hsl(g.hue + 180, 0.8, 0.6)));
        }
        centerY = S * 0.25;
        break;
      }
      case 'wreck': {
        const hull = new CylinderGeometry(S * 0.18, S * 0.22, S * 0.9, 8);
        hull.rotateZ(Math.PI / 2 + 0.2);
        hull.rotateY(0.3);
        hull.translate(0, S * 0.2, 0);
        parts.push(colorize(jitter(hull, S * 0.02, seed), ruin.clone().multiplyScalar(0.7), 0.3));
        const fin = new BoxGeometry(S * 0.05, S * 0.35, S * 0.3);
        fin.translate(-S * 0.35, S * 0.35, 0);
        parts.push(colorize(fin, ruin.clone().multiplyScalar(0.7)));
        centerY = S * 0.2;
        break;
      }
      case 'beacon': {
        const mast = new ConeGeometry(S * 0.12, S, 6);
        mast.translate(0, S * 0.5, 0);
        parts.push(colorize(mast, ruin, 0.3));
        const top = new SphereGeometry(S * 0.1, 8, 6);
        top.translate(0, S, 0);
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
  return { geometry: geo, material, radius, centerY };
}
