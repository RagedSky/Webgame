import type { BufferGeometry} from 'three';
import { BufferGeometry as Geo, Color, ConeGeometry, Float32BufferAttribute, MeshPhysicalMaterial, SphereGeometry, Uint16BufferAttribute, Vector2 } from 'three';
import { textures, type TextureKind } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';
import { Random } from '@/math/Random';
import { clamp, clamp01 } from '@/math/utils';
import { SimplexNoise } from '@/math/Noise';
import type { ArchiveEntry, FaunaGenome } from '@/gen/archive/types';
import { blade, hsl, mergeParts } from '../geometry';
import { arc, blob, lathe, tube, weldNormals, type TubePoint } from '../organic';
import { addGlow } from '@/render/glow';

export type BoneKind = 'root' | 'body' | 'segment' | 'neck' | 'head' | 'hip' | 'knee' | 'tail' | 'wing' | 'fin';

export interface BoneDef {
  name: string;
  kind: BoneKind;
  parent: number;
  /** Position relativ zum Elternknochen (Bind-Pose). */
  x: number;
  y: number;
  z: number;
  /** Seite (−1 links, 1 rechts, 0 mitte) und Index innerhalb der Art (Beinpaar, Segment …). */
  side: number;
  index: number;
}

export interface CreatureTemplate {
  geometry: BufferGeometry;
  material: MeshPhysicalMaterial;
  bones: BoneDef[];
  lengthM: number;
  /** Höhe des Körperzentrums über dem Boden (Bind-Pose). */
  bodyY: number;
  legLength: number;
  /** Zahl der Beinpaare (für Gangart). */
  legPairs: number;
  glow: boolean;
  /** Farbe der Leuchtorgane (null = leuchtet nicht). */
  glowColor: Color | null;
}

/** Mittlere Fortbewegungsgeschwindigkeit in m/s (Maximum bei Flucht). */
export function maxSpeedFor(genome: FaunaGenome): number {
  const base = genome.locomotion === 'air' ? 9 : genome.locomotion === 'water' ? 4 : 3;
  return base + genome.speed * (genome.locomotion === 'air' ? 10 : 7) + Math.min(3, genome.lengthM * 0.4);
}

interface Part {
  geo: BufferGeometry;
  /** Knochen für Teile ohne eigene Skin-Attribute (starr an einem Knochen). */
  bone: number;
}

/** Querschnitt des Rumpf-Lofts an einer Stelle der Körperachse (z), mit zwei überblendeten Knochen. */
interface Ring {
  z: number;
  y: number;
  rx: number;
  /** Halbe Höhe nach oben / nach unten (flacherer Bauch). */
  rt: number;
  rb: number;
  b0: number;
  b1: number;
  /** Gewicht des zweiten Knochens 0..1. */
  w: number;
  part: 'body' | 'head' | 'tail';
  fixed?: Color;
}

const smooth01 = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Baut aus einem Fauna-Genom eine geskinnte Geometrie plus Material. Rumpf, Hals, Kopf und Schwanz sind ein
 * durchgehender, weicher Körper (Loft entlang der Körperachse) mit überblendeten Knochengewichten; Beine sind
 * verjüngte Röhren mit Kniegelenk. Muster werden als Vertexfarben berechnet (Streifen, Flecken, Bänder, Verlauf …).
 */
export function buildCreatureTemplate(entry: ArchiveEntry): CreatureTemplate {
  const g = entry.genome as FaunaGenome;
  const rng = new Random(`creature:${entry.id}`);
  const noise = new SimplexNoise(`pattern:${entry.id}`);
  const L = clamp(g.lengthM, 0.08, 25);
  const bones: BoneDef[] = [];
  const parts: Part[] = [];
  const addBone = (name: string, kind: BoneKind, parent: number, x: number, y: number, z: number, side = 0, index = 0): number => {
    bones.push({ name, kind, parent, x, y, z, side, index });
    return bones.length - 1;
  };

  // ---------------------------------------------------------------------------
  // Proportionen
  const shape = g.bodyShape;
  const serpentine = shape === 'serpentine';
  const bodyLen = serpentine ? L * 0.9 : L * (shape === 'round' ? 0.42 : 0.52);
  const bodyH = L * (shape === 'bulky' ? 0.28 : shape === 'round' ? 0.3 : shape === 'flat' ? 0.1 : serpentine ? 0.085 : 0.18);
  const bodyW = L * (shape === 'bulky' ? 0.27 : shape === 'round' ? 0.3 : shape === 'flat' ? 0.36 : serpentine ? 0.085 : 0.17);
  const legPairs = g.locomotion === 'water' ? 0 : Math.floor(g.legs / 2);
  const legLength = legPairs > 0 ? L * (shape === 'slender' ? 0.3 : shape === 'bulky' ? 0.2 : 0.24) : 0;
  const legR = Math.max(0.01, L * (legPairs >= 3 ? 0.022 : 0.036));
  const bodyY = legLength + bodyH * 0.5;

  // ---------------------------------------------------------------------------
  // Farben und Muster (kräftig, mit hellem Bauch und dunkleren Gliedmaßen-Enden)
  const base = hsl(g.hue, clamp01(g.saturation * 1.1 + 0.08), g.lightness);
  const second = hsl(g.hue2, clamp01(g.saturation * 1.0 + 0.05), clamp01(g.lightness * 0.78));
  const belly = base.clone().offsetHSL(0.02, -0.12, 0.2);
  const dark = base.clone().multiplyScalar(0.3);
  const k = (1 / L) * (0.6 + g.patternScale * 1.4);
  const scratch = new Color();
  const colorAt = (x: number, y: number, z: number, part: 'body' | 'limb' | 'head' | 'tail'): Color => {
    const px = x * k * 6;
    const py = y * k * 6;
    const pz = z * k * 6;
    scratch.copy(base);
    switch (g.pattern) {
      case 'stripes':
        scratch.lerp(second, smooth01(0.1, 0.4, Math.sin(pz * 2.2 + noise.noise2D(px, py) * 1.5)));
        break;
      case 'spots':
        scratch.lerp(second, smooth01(0.22, 0.42, noise.noise3D(px * 1.3, py * 1.3, pz * 1.3)));
        break;
      case 'bands':
        if (part === 'limb' || part === 'tail') scratch.lerp(second, smooth01(0.15, 0.45, Math.sin(py * 3 + pz * 3)));
        else if (part === 'body') scratch.lerp(second, smooth01(0.45, 0.75, Math.sin(pz * 1.4)));
        break;
      case 'mottled':
        scratch.lerp(second, smooth01(-0.1, 0.2, noise.noise3D(px * 0.8, py * 0.8, pz * 0.8)));
        break;
      case 'gradient':
        scratch.lerp(second, clamp01(0.5 + z / Math.max(0.01, bodyLen)));
        break;
      case 'rings':
        if (part === 'tail' || part === 'limb') scratch.lerp(second, smooth01(-0.15, 0.15, Math.sin(pz * 4 + py * 4)));
        break;
      case 'none':
        break;
    }
    // Weicher Übergang zur hellen Unterseite, dunklere Füße
    if (part !== 'limb') scratch.lerp(belly, 0.6 * smooth01(0.05, 0.45, (bodyY - y) / Math.max(1e-4, bodyH)));
    else scratch.multiplyScalar(0.55 + 0.45 * clamp01(y / Math.max(1e-4, bodyY)));
    return scratch;
  };

  const push = (geo: BufferGeometry, bone: number, part: 'body' | 'limb' | 'head' | 'tail', fixedColor?: Color): void => {
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const c = fixedColor ?? colorAt(pos.getX(i), pos.getY(i), pos.getZ(i), part);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    parts.push({ geo, bone });
  };

  /** Loft durch Querschnitts-Ringe (aufsteigendes z) mit Skin-Gewichten und Farben je Ring. */
  const loft = (rings: Ring[], radial: number): void => {
    const pos: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const si: number[] = [];
    const sw: number[] = [];
    const idx: number[] = [];
    const vScale = 1 / Math.max(0.05, L * 0.3);
    for (const r of rings) {
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        const x = r.rx * cx;
        const y = r.y + (sy >= 0 ? r.rt : r.rb) * sy;
        pos.push(x, y, r.z);
        uv.push((j / radial) * 2, r.z * vScale);
        const c = r.fixed ?? colorAt(x, y, r.z, r.part);
        col.push(c.r, c.g, c.b);
        si.push(r.b0, r.b1, 0, 0);
        sw.push(1 - r.w, r.w, 0, 0);
      }
    }
    const stride = radial + 1;
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a0 = i * stride + j;
        const b0 = (i + 1) * stride + j;
        idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
      }
    }
    const geo = new Geo();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
    geo.setIndex(idx);
    weldNormals(geo);
    parts.push({ geo, bone: 0 });
  };

  // ---------------------------------------------------------------------------
  // Knochen
  const root = addBone('root', 'root', -1, 0, 0, 0);
  const body = addBone('body', 'body', root, 0, bodyY, 0);
  const segs: number[] = [];
  const nSeg = 6;
  const segLen = bodyLen / nSeg;
  if (serpentine) {
    let parent = body;
    for (let i = 0; i < nSeg; i++) {
      const b = addBone(`seg${i}`, 'segment', parent, 0, 0, i === 0 ? bodyLen / 2 - segLen / 2 : -segLen, 0, i);
      segs.push(b);
      parent = b;
    }
  }
  /** Knochenpaar und Gewicht für eine Stelle des Rumpfs. */
  const bodyBones = (z: number): [number, number, number] => {
    if (!serpentine) return [body, body, 0];
    const f = clamp((bodyLen / 2 - segLen / 2 - z) / segLen, 0, nSeg - 1);
    const i0 = Math.min(nSeg - 2, Math.floor(f));
    return [segs[i0] as number, segs[i0 + 1] as number, clamp01(f - i0)];
  };
  const frontBone = serpentine ? (segs[0] as number) : body;
  const rearBone = serpentine ? (segs[nSeg - 1] as number) : body;
  const frontBoneZ = serpentine ? bodyLen / 2 - segLen / 2 : 0;
  const rearBoneZ = serpentine ? -bodyLen / 2 + segLen / 2 : 0;

  // Kopf/Hals
  const hasHead = g.headType !== 'none';
  const headR = L * (shape === 'round' ? 0.11 : 0.085) * (g.headType === 'dome' ? 1.35 : 1);
  const neckLen = shape === 'slender' && L > 0.6 ? L * 0.14 : L * 0.05;
  const headZ = bodyLen / 2 + neckLen + headR * 0.6;
  const headY = bodyY + bodyH * 0.25;
  const neckZ = bodyLen / 2 - headR * 0.2;
  let neckBone = frontBone;
  let headBone = frontBone;
  if (hasHead) {
    neckBone = addBone('neck', 'neck', frontBone, 0, bodyH * 0.25, neckZ - frontBoneZ);
    headBone = addBone('head', 'head', neckBone, 0, 0, neckLen + headR * 0.8);
  }

  // Schwanz
  const tailType = g.locomotion === 'water' && g.tailType === 'none' ? 'fin' : g.tailType;
  const hasTail = tailType !== 'none';
  const tailLen = hasTail ? L * (tailType === 'short' ? 0.18 : tailType === 'long' ? 0.42 : 0.28) : 0;
  const tailSeg = tailLen / 2;
  const tailZ1 = -bodyLen / 2 + L * 0.02;
  let t1 = rearBone;
  let t2 = rearBone;
  if (hasTail) {
    t1 = addBone('tail1', 'tail', rearBone, 0, 0, tailZ1 - rearBoneZ, 0, 0);
    t2 = addBone('tail2', 'tail', t1, 0, 0, -tailSeg, 0, 1);
  }

  // ---------------------------------------------------------------------------
  // Rumpfprofil
  const minRear = hasTail ? clamp((Math.min(bodyW, bodyH) * (tailType === 'short' ? 0.42 : 0.5)) / Math.max(1e-4, Math.min(bodyW, bodyH)), 0.2, 0.6) : 0.03;
  const neckR = Math.min(headR * 0.62, Math.min(bodyW, bodyH) * 0.42);
  const minFront = hasHead ? clamp(neckR / (Math.min(bodyW, bodyH) * 0.5), 0.2, 0.75) : 0.03;
  const profile = (u: number): number => {
    const s = Math.sin(Math.PI * clamp(u, 0, 1));
    let f: number;
    if (serpentine) f = (0.5 + 0.5 * u) * Math.pow(Math.max(0, s), 0.28);
    else if (shape === 'slender') f = Math.pow(Math.max(0, s), 0.7) * (0.86 + 0.24 * u);
    else if (shape === 'flat') f = Math.pow(Math.max(0, s), 0.55);
    else f = Math.pow(Math.max(0, s), 0.5);
    return Math.max(f, u < 0.5 ? minRear : minFront);
  };
  /** Oberkante des Rumpfs an der Stelle z (für Stacheln und Platten). */
  const topAt = (z: number): number => bodyY + (bodyH / 2) * 1.05 * profile((z + bodyLen / 2) / bodyLen);

  const rings: Ring[] = [];
  // Schwanz (von der Spitze zur Basis)
  if (hasTail) {
    const rBase = Math.min(bodyW, bodyH) * 0.5 * minRear;
    const rTip = Math.max(0.004, rBase * (tailType === 'club' ? 0.45 : tailType === 'fin' || tailType === 'fan' ? 0.3 : 0.12));
    const nT = 6;
    const tipZ = -bodyLen / 2 - tailLen;
    const droop = tailType === 'long' ? bodyH * 0.25 : 0;
    const ringAt = (z: number, r: number): void => {
      const d = (tailZ1 - z) / Math.max(1e-4, tailSeg);
      const y = bodyY - droop * clamp01((-bodyLen / 2 - z) / Math.max(1e-4, tailLen));
      if (d < 1) rings.push({ z, y, rx: r, rt: r, rb: r, b0: rearBone, b1: t1, w: smooth01(0, 0.55, d), part: 'tail' });
      else rings.push({ z, y, rx: r, rt: r, rb: r, b0: t1, b1: t2, w: smooth01(1, 1.55, d), part: 'tail' });
    };
    ringAt(tipZ - rTip * 0.6, rTip * 0.08);
    for (let i = 0; i < nT; i++) {
      const u = i / nT;
      ringAt(tipZ + tailLen * u, rTip + (rBase - rTip) * Math.pow(u, 0.85));
    }
  }
  // Rumpf
  const nB = serpentine ? 18 : 9;
  for (let i = 0; i <= nB; i++) {
    const u = i / nB;
    if (!hasTail && i === 0) rings.push({ z: -bodyLen / 2 - bodyLen * 0.01, y: bodyY, rx: 1e-3, rt: 1e-3, rb: 1e-3, b0: rearBone, b1: rearBone, w: 0, part: 'body' });
    const f = profile(u);
    const z = -bodyLen / 2 + bodyLen * u;
    const [b0, b1, w] = bodyBones(z);
    rings.push({ z, y: bodyY + (shape === 'slender' ? bodyH * 0.06 * u : 0), rx: (bodyW / 2) * f, rt: (bodyH / 2) * f * 1.05, rb: (bodyH / 2) * f * 0.92, b0, b1, w, part: 'body' });
    if (!hasHead && i === nB) rings.push({ z: bodyLen / 2 + bodyLen * 0.01, y: bodyY, rx: 1e-3, rt: 1e-3, rb: 1e-3, b0: frontBone, b1: frontBone, w: 0, part: 'body' });
  }
  // Hals und Kopf
  if (hasHead) {
    const headBack = headZ - headR * 0.8;
    const span = Math.max(1e-4, headBack - bodyLen / 2);
    const nN = neckLen > L * 0.1 ? 4 : 2;
    for (let i = 1; i <= nN; i++) {
      const t = i / (nN + 1);
      const z = bodyLen / 2 + span * t;
      const r = neckR * (1 - 0.12 * Math.sin(t * Math.PI));
      const y = bodyY + (headY - bodyY) * (0.3 + 0.7 * smooth01(0, 1, t));
      rings.push({ z, y, rx: r, rt: r, rb: r, b0: frontBone, b1: neckBone, w: smooth01(0, 0.6, t + 0.15), part: 'body' });
    }
    // Schädelprofil: [Position entlang der Kopfachse in Kopfradien, Radiusfaktor]
    let skull: Array<[number, number]>;
    if (g.headType === 'snout') skull = [[-0.8, 0.6], [-0.5, 0.87], [-0.15, 0.99], [0.2, 0.95], [0.55, 0.74], [0.9, 0.55], [1.25, 0.46], [1.5, 0.38], [1.68, 0.22], [1.76, 0.02]];
    else if (g.headType === 'beak') skull = [[-0.8, 0.6], [-0.5, 0.87], [-0.15, 0.99], [0.2, 0.93], [0.5, 0.74], [0.8, 0.46], [1.2, 0.26], [1.6, 0.11], [1.9, 0.01]];
    else skull = [[-0.8, 0.6], [-0.5, 0.87], [-0.15, 0.99], [0.2, 0.98], [0.5, 0.87], [0.75, 0.66], [0.92, 0.39], [1.0, 0.02]];
    const dome = g.headType === 'dome' ? 1.25 : 1;
    for (const [sPos, rf] of skull) {
      const r = headR * rf;
      const snoutDrop = g.headType === 'snout' || g.headType === 'beak' ? headR * 0.18 * clamp01((sPos - 0.3) / 1.2) : 0;
      const ring: Ring = { z: headZ + sPos * headR, y: headY - snoutDrop, rx: r, rt: r * (sPos < 0.7 ? dome : 1), rb: r * 0.95, b0: neckBone, b1: headBone, w: smooth01(-1.1, -0.45, sPos), part: 'head' };
      if (g.headType === 'beak' && sPos > 0.7) ring.fixed = dark;
      rings.push(ring);
    }
  }
  loft(rings, legPairs >= 3 || L < 0.3 ? 10 : 14);

  // ---------------------------------------------------------------------------
  // Kopfdetails
  if (hasHead) {
    if (g.headType === 'crest' || g.extras.includes('Rückenkamm') || g.extras.includes('Federbusch') || g.extras.includes('Drüsenkamm')) {
      const crest = blade(headR * 1.5, headR * 1.4, -0.35, 3, headR * 0.12, 0.2);
      crest.rotateY(Math.PI / 2);
      crest.translate(0, headY + headR * 0.7, headZ - headR * 0.1);
      push(crest, headBone, 'head', second);
    }
    if (g.headType === 'mandible') {
      for (const side of [-1, 1]) {
        const m = tube(arc([side * headR * 0.45, headY - headR * 0.3, headZ + headR * 0.6], [side * headR * 0.12, headY - headR * 0.4, headZ + headR * 1.7], [side * headR * 0.45, 0, 0], headR * 0.16, headR * 0.03, 5), 6);
        push(m, headBone, 'head', dark);
      }
    }
    if (g.extras.includes('Fühlerpaar')) {
      for (const side of [-1, 1]) {
        const tip: [number, number, number] = [side * headR * 1.1, headY + headR * 2.0, headZ + headR * 1.0];
        const a = tube(arc([side * headR * 0.35, headY + headR * 0.8, headZ + headR * 0.3], tip, [0, headR * 0.3, -headR * 0.2], headR * 0.07, headR * 0.03, 5), 5);
        push(a, headBone, 'head', dark);
        const bulb = new SphereGeometry(headR * 0.1, 8, 6);
        bulb.translate(tip[0], tip[1], tip[2]);
        push(bulb, headBone, 'head', second);
      }
    }
    if (g.extras.includes('Halskrause')) {
      const R = headR * 1.7;
      const frill = lathe(
        [
          [R * 0.3, -R * 0.05],
          [R * 0.9, -R * 0.03],
          [R, 0],
          [R * 0.9, R * 0.03],
          [R * 0.3, R * 0.05],
        ],
        12,
      );
      frill.rotateX(Math.PI / 2 - 0.25);
      frill.translate(0, headY, headZ - headR * 0.85);
      push(frill, headBone, 'head', second);
    }
    // Augen
    const eyeR = Math.max(0.006, headR * 0.24);
    const eyeColor = g.extras.includes('leuchtende Augen') ? hsl(g.hue2, 0.9, 0.6) : new Color(0.02, 0.02, 0.03);
    const eyePositions: Array<[number, number, number]> = [];
    if (g.eyeCount === 1) eyePositions.push([0, headY + headR * 0.3, headZ + headR * 0.85]);
    else if (g.eyeCount === 2) eyePositions.push([-headR * 0.62, headY + headR * 0.32, headZ + headR * 0.5], [headR * 0.62, headY + headR * 0.32, headZ + headR * 0.5]);
    else if (g.eyeCount === 4) eyePositions.push([-headR * 0.62, headY + headR * 0.3, headZ + headR * 0.5], [headR * 0.62, headY + headR * 0.3, headZ + headR * 0.5], [-headR * 0.38, headY + headR * 0.68, headZ + headR * 0.45], [headR * 0.38, headY + headR * 0.68, headZ + headR * 0.45]);
    else for (let i = 0; i < g.eyeCount; i++) {
      const a = (i / g.eyeCount) * Math.PI * 2;
      eyePositions.push([Math.cos(a) * headR * 0.62, headY + headR * 0.25 + Math.sin(a) * headR * 0.4, headZ + headR * 0.55]);
    }
    for (const [x, y, z] of eyePositions) {
      const e = new SphereGeometry(eyeR, 10, 8);
      e.translate(x, y, z);
      push(e, headBone, 'head', eyeColor);
    }
  } else {
    // Kopfloser Körper: Augen vorn am Rumpf
    const eyeR = Math.max(0.006, bodyW * 0.08);
    for (const side of [-1, 1]) {
      const e = new SphereGeometry(eyeR, 10, 8);
      e.translate(side * bodyW * 0.2, bodyY + bodyH * 0.18, bodyLen / 2 - bodyLen * 0.08);
      push(e, frontBone, 'head', new Color(0.02, 0.02, 0.03));
    }
  }

  // ---------------------------------------------------------------------------
  // Beine: verjüngte Röhren von der Hüfte zum Fuß, Kniegelenk mit überblendeten Gewichten
  const hipY = bodyY - bodyH * 0.25;
  const upperLen = hipY * 0.52;
  const lowerLen = hipY * 0.48;
  const thighR = legR * (legPairs >= 3 ? 1.6 : shape === 'bulky' ? 2.4 : 2.0);
  for (let p = 0; p < legPairs; p++) {
    const t = legPairs === 1 ? 0.5 : p / (legPairs - 1);
    const z = (bodyLen / 2) * 0.7 - t * bodyLen * 0.7;
    const [bb0, bb1, bw] = bodyBones(z);
    const hipParent = bw > 0.5 ? bb1 : bb0;
    const parentZ = serpentine ? bodyLen / 2 - segLen / 2 - segs.indexOf(hipParent) * segLen : 0;
    for (const side of [-1, 1]) {
      const hx = side * bodyW * 0.42 * profile((z + bodyLen / 2) / bodyLen);
      const hip = addBone(`hip${p}${side > 0 ? 'R' : 'L'}`, 'hip', hipParent, hx, -bodyH * 0.25, z - parentZ, side, p);
      const knee = addBone(`knee${p}${side > 0 ? 'R' : 'L'}`, 'knee', hip, 0, -upperLen, 0, side, p);
      const kneeY = hipY - upperLen;
      const splay = side * legR * (legPairs >= 3 ? 2.2 : 0.6);
      const path: TubePoint[] = [
        { x: hx * 0.75, y: hipY + bodyH * 0.14, z, r: thighR * 0.9 },
        { x: hx, y: hipY, z, r: thighR },
        { x: hx + splay * 0.5, y: hipY - upperLen * 0.5, z: z + legR * 0.4, r: thighR * 0.86 },
        { x: hx + splay, y: kneeY, z, r: legR * 1.05 },
        { x: hx + splay, y: kneeY - lowerLen * 0.5, z: z - legR * 0.5, r: legR * 0.78 },
        { x: hx + splay, y: kneeY - lowerLen * 0.9, z, r: legR * 0.72 },
        { x: hx + splay, y: Math.max(legR * 0.5, kneeY - lowerLen + legR * 0.7), z: z + legR * 1.3, r: legR * 1.2 },
      ];
      const leg = tube(path, legPairs >= 3 ? 6 : 8);
      const lp = leg.getAttribute('position');
      const si = new Uint16Array(lp.count * 4);
      const sw = new Float32Array(lp.count * 4);
      for (let i = 0; i < lp.count; i++) {
        const w = smooth01(kneeY + upperLen * 0.18, kneeY - upperLen * 0.18, lp.getY(i));
        si[i * 4] = hip;
        si[i * 4 + 1] = knee;
        sw[i * 4] = 1 - w;
        sw[i * 4 + 1] = w;
      }
      leg.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
      leg.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
      push(leg, hip, 'limb');
    }
  }

  // Flügel
  if (g.wings > 0) {
    const pairs = g.wings >= 4 ? 2 : 1;
    for (let p = 0; p < pairs; p++) {
      const z = pairs === 1 ? bodyLen * 0.1 : bodyLen * (0.25 - p * 0.35);
      for (const side of [-1, 1]) {
        const wing = addBone(`wing${p}${side > 0 ? 'R' : 'L'}`, 'wing', body, side * bodyW * 0.4, bodyH * 0.3, z, side, p);
        const span = L * (0.55 + g.speed * 0.3);
        const w = blade(L * 0.38, span, 0.12, 4, L * 0.05, 0.1);
        w.rotateZ(side * (Math.PI / 2)); // Flügel liegt in der XZ-Ebene, zeigt nach außen
        w.rotateX(-Math.PI / 2);
        w.rotateY(side > 0 ? 0 : Math.PI);
        w.translate(side * bodyW * 0.4, bodyY + bodyH * 0.3, z);
        push(w, wing, 'limb', g.covering === 'membrane' ? second : undefined);
      }
    }
  }

  // Flossen (Wasser)
  if (g.locomotion === 'water' && g.fins > 0) {
    const pairs = Math.max(1, Math.floor(g.fins / 2));
    for (let p = 0; p < pairs; p++) {
      const z = bodyLen * (0.2 - p * 0.3);
      for (const side of [-1, 1]) {
        const fin = addBone(`fin${p}${side > 0 ? 'R' : 'L'}`, 'fin', body, side * bodyW * 0.45, -bodyH * 0.1, z, side, p);
        const f = blade(L * 0.13, L * 0.22, 0.25, 3, L * 0.02, 0.1);
        f.rotateZ(side * 1.2);
        f.rotateX(-Math.PI / 2);
        f.translate(side * bodyW * 0.42, bodyY - bodyH * 0.1, z);
        push(f, fin, 'limb');
      }
    }
  }
  // Schwanzende
  if (hasTail) {
    const tipZ = -bodyLen / 2 - tailLen;
    const tipY = bodyY - (tailType === 'long' ? bodyH * 0.25 : 0);
    if (tailType === 'fin') {
      const f = blade(L * 0.05, L * 0.3, 0, 3, L * 0.24, 0.1);
      f.rotateY(Math.PI / 2);
      f.translate(0, tipY - L * 0.12, tipZ + L * 0.02);
      push(f, t2, 'tail');
    } else if (tailType === 'fan') {
      for (let i = -2; i <= 2; i++) {
        const f = blade(L * 0.05, L * 0.24, 0.2, 3, L * 0.09, 0.1);
        f.rotateX(-Math.PI / 2 + 0.3);
        f.rotateY(i * 0.3);
        f.translate(0, tipY, tipZ + L * 0.02);
        push(f, t2, 'tail', i % 2 === 0 ? second : undefined);
      }
    } else if (tailType === 'club') {
      const c = blob(bodyW * 0.4, `club:${entry.id}`, 0.18, 1.6, 0.9, 10, 8);
      c.translate(0, tipY, tipZ);
      push(c, t2, 'tail', dark);
    }
  }

  // Extras am Rücken
  if (g.extras.includes('Stachelsaum') || g.extras.includes('Hornplatten') || g.extras.includes('Panzerplatten')) {
    const n = (serpentine ? 8 : 4) + Math.round(rng.float(0, 4));
    const spikes = g.extras.includes('Stachelsaum');
    for (let i = 0; i < n; i++) {
      const z = bodyLen / 2 - (i + 0.5) * (bodyLen / n);
      const sc = 0.6 + 0.4 * Math.sin(((i + 0.5) / n) * Math.PI);
      const [b0, b1, w] = bodyBones(z);
      const bone = w > 0.5 ? b1 : b0;
      if (spikes) {
        const spike = new ConeGeometry(bodyW * 0.09 * sc, bodyH * 0.6 * sc, 8);
        spike.rotateX(-0.25);
        spike.translate(0, topAt(z) + bodyH * 0.22 * sc, z);
        push(spike, bone, 'body', dark);
      } else {
        const plate = blob(bodyW * 0.2 * sc, `plate:${entry.id}:${i}`, 0.12, 1.5, 0.4, 8, 6);
        plate.translate(0, topAt(z) + bodyH * 0.02, z);
        push(plate, bone, 'body', dark);
      }
    }
  }
  if (g.extras.includes('Fangarme') && hasHead) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const sx = side * headR * (0.25 + i * 0.3);
        const ten = tube(arc([sx, headY - headR * 0.45, headZ + headR * 0.5], [sx * 1.6, headY - headR * (1.6 + i * 0.5), headZ + headR * (1.5 - i * 0.4)], [0, 0, headR * 0.5], headR * 0.13, headR * 0.03, 6), 6);
        push(ten, headBone, 'limb');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Skinning-Attribute ergänzen und zusammenführen
  const skinned: BufferGeometry[] = [];
  for (const p of parts) {
    if (!p.geo.getAttribute('skinIndex')) {
      const n = p.geo.getAttribute('position').count;
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        si[i * 4] = p.bone;
        sw[i * 4] = 1;
      }
      p.geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
      p.geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
    }
    skinned.push(p.geo);
  }
  const geometry = mergeParts(skinned, `creature ${entry.id}`);

  const covering = g.covering;
  const glow = covering === 'bioluminescent' || g.extras.includes('Leuchtorgane');
  const texKind: TextureKind = covering === 'scales' ? 'scales' : covering === 'chitin' ? 'chitin' : covering === 'fur' ? 'fur' : covering === 'feathers' ? 'feathers' : covering === 'crystal' ? 'crystal' : 'skin';
  const tex = textures.get(texKind);
  const normalScale = covering === 'chitin' || covering === 'scales' ? 0.9 : covering === 'crystal' ? 0.6 : covering === 'skin' || covering === 'membrane' ? 0.4 : 0.7;
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new Vector2(normalScale, normalScale),
    roughnessMap: tex.roughnessMap,
    roughness: covering === 'scales' ? 0.5 : covering === 'chitin' ? 0.4 : covering === 'crystal' ? 0.2 : covering === 'skin' ? 0.65 : 0.9,
    metalness: covering === 'chitin' ? 0.2 : covering === 'crystal' ? 0.1 : 0,
    clearcoat: covering === 'chitin' ? 0.7 : covering === 'scales' ? 0.35 : covering === 'crystal' ? 0.9 : covering === 'skin' ? 0.15 : 0,
    clearcoatRoughness: covering === 'crystal' ? 0.05 : 0.3,
    iridescence: covering === 'crystal' ? 0.5 : covering === 'chitin' ? 0.3 : 0,
    iridescenceIOR: 1.3,
    sheen: covering === 'fur' || covering === 'feathers' ? 0.6 : 0,
    sheenRoughness: 0.7,
    transparent: covering === 'membrane',
    opacity: covering === 'membrane' ? 0.9 : 1,
  });

  addRim(material, 1);
  // Leuchtorgane: die Zeichnung in der Zweitfarbe leuchtet, der übrige Körper nur schwach
  const glowColor = glow ? hsl(g.hue2, 0.9, 0.55) : null;
  if (glowColor) addGlow(material, { tint: second, amount: 1.1, day: 0.3, floor: g.pattern === 'none' ? 0.45 : 0.14 });
  return { geometry, material, bones, lengthM: L, bodyY, legLength, legPairs, glow, glowColor };
}
