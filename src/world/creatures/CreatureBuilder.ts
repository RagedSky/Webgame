import type { BufferGeometry} from 'three';
import { Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, MeshStandardMaterial, SphereGeometry, Uint16BufferAttribute } from 'three';
import { Random } from '@/math/Random';
import { clamp, clamp01 } from '@/math/utils';
import { SimplexNoise } from '@/math/Noise';
import type { ArchiveEntry, FaunaGenome } from '@/gen/archive/types';
import { hsl, mergeParts, taperedQuad } from '../geometry';

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
  material: MeshStandardMaterial;
  bones: BoneDef[];
  lengthM: number;
  /** Höhe des Körperzentrums über dem Boden (Bind-Pose). */
  bodyY: number;
  legLength: number;
  /** Zahl der Beinpaare (für Gangart). */
  legPairs: number;
  glow: boolean;
}

/** Mittlere Fortbewegungsgeschwindigkeit in m/s (Maximum bei Flucht). */
export function maxSpeedFor(genome: FaunaGenome): number {
  const base = genome.locomotion === 'air' ? 9 : genome.locomotion === 'water' ? 4 : 3;
  return base + genome.speed * (genome.locomotion === 'air' ? 10 : 7) + Math.min(3, genome.lengthM * 0.4);
}

interface Part {
  geo: BufferGeometry;
  bone: number;
  color?: Color;
}

/**
 * Baut aus einem Fauna-Genom eine geskinnte Geometrie (starre Teile an Knochen) plus Material.
 * Muster werden als Vertexfarben berechnet (Streifen, Flecken, Bänder, Verlauf, Ringe, gesprenkelt).
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
  const bodyH = L * (shape === 'bulky' ? 0.26 : shape === 'round' ? 0.3 : shape === 'flat' ? 0.09 : serpentine ? 0.08 : 0.15);
  const bodyW = L * (shape === 'bulky' ? 0.26 : shape === 'round' ? 0.3 : shape === 'flat' ? 0.36 : serpentine ? 0.08 : 0.14);
  const legPairs = g.locomotion === 'water' ? 0 : Math.floor(g.legs / 2);
  const legLength = legPairs > 0 ? L * (shape === 'slender' ? 0.3 : shape === 'bulky' ? 0.2 : 0.24) : 0;
  const legR = Math.max(0.01, L * (legPairs >= 3 ? 0.012 : 0.028));
  const bodyY = g.locomotion === 'air' ? legLength + bodyH * 0.5 : legLength + bodyH * 0.5;

  // ---------------------------------------------------------------------------
  // Farben und Muster
  const base = hsl(g.hue, g.saturation, g.lightness);
  const second = hsl(g.hue2, clamp01(g.saturation * 0.9), clamp01(g.lightness * 0.75));
  const belly = base.clone().offsetHSL(0, -0.1, 0.16);
  const dark = base.clone().multiplyScalar(0.35);
  const k = (1 / L) * (0.6 + g.patternScale * 1.4);
  const scratch = new Color();
  const colorAt = (x: number, y: number, z: number, part: 'body' | 'limb' | 'head' | 'tail'): Color => {
    const px = x * k * 6;
    const py = y * k * 6;
    const pz = z * k * 6;
    let c = base;
    switch (g.pattern) {
      case 'stripes':
        if (Math.sin(pz * 2.2 + noise.noise2D(px, py) * 1.5) > 0.25) c = second;
        break;
      case 'spots':
        if (noise.noise3D(px * 1.3, py * 1.3, pz * 1.3) > 0.32) c = second;
        break;
      case 'bands':
        if ((part === 'limb' || part === 'tail') && Math.sin(py * 3 + pz * 3) > 0.3) c = second;
        else if (part === 'body' && Math.sin(pz * 1.4) > 0.6) c = second;
        break;
      case 'mottled':
        if (noise.noise3D(px * 0.8, py * 0.8, pz * 0.8) > 0.05) c = second;
        break;
      case 'gradient':
        c = scratch.copy(base).lerp(second, clamp01(0.5 + z / Math.max(0.01, bodyLen)));
        break;
      case 'rings':
        if ((part === 'tail' || part === 'limb') && Math.sin(pz * 4 + py * 4) > 0) c = second;
        break;
      case 'none':
        break;
    }
    // Helle Unterseite
    if (part === 'body' && y < bodyY - bodyH * 0.15) c = (c === scratch ? scratch : scratch.copy(c)).lerp(belly, 0.5);
    return c;
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

  // ---------------------------------------------------------------------------
  // Knochen und Teile
  const root = addBone('root', 'root', -1, 0, 0, 0);
  const body = addBone('body', 'body', root, 0, bodyY, 0);

  if (serpentine) {
    const n = 6;
    const segLen = bodyLen / n;
    let parent = body;
    for (let i = 0; i < n; i++) {
      const z = i === 0 ? bodyLen / 2 - segLen / 2 : -segLen;
      const b = addBone(`seg${i}`, 'segment', parent, 0, 0, z, 0, i);
      const r = bodyW * 0.5 * (1 - i / (n + 2));
      const s = new SphereGeometry(1, 10, 7);
      s.scale(r, r * 0.9, segLen * 0.62);
      // Weltposition des Segments zum Einfärben
      const wz = bodyLen / 2 - segLen / 2 - i * segLen;
      s.translate(0, bodyY, wz);
      push(s, b, 'body');
      parent = b;
    }
  } else {
    const s = new SphereGeometry(1, 14, 10);
    s.scale(bodyW * 0.5, bodyH * 0.5, bodyLen * 0.5);
    s.translate(0, bodyY, 0);
    push(s, body, 'body');
  }

  // Kopf (+ Hals)
  const headR = L * (shape === 'round' ? 0.11 : 0.085) * (g.headType === 'dome' ? 1.35 : 1);
  const neckLen = shape === 'slender' && L > 0.6 ? L * 0.14 : L * 0.05;
  const headZ = bodyLen / 2 + neckLen + headR * 0.6;
  const headY = bodyY + bodyH * 0.25;
  let headBone = body;
  if (g.headType !== 'none') {
    const neck = addBone('neck', 'neck', body, 0, bodyH * 0.25, bodyLen / 2 - headR * 0.2);
    const neckGeo = new CylinderGeometry(headR * 0.45, headR * 0.6, neckLen + headR * 0.8, 7);
    neckGeo.rotateX(Math.PI / 2);
    neckGeo.translate(0, headY, bodyLen / 2 + (neckLen + headR * 0.4) / 2);
    push(neckGeo, neck, 'body');
    headBone = addBone('head', 'head', neck, 0, 0, neckLen + headR * 0.8);
    const head = new SphereGeometry(headR, 12, 9);
    head.translate(0, headY, headZ);
    push(head, headBone, 'head');
    if (g.headType === 'snout' || g.headType === 'beak') {
      const snout = new ConeGeometry(headR * (g.headType === 'beak' ? 0.35 : 0.6), headR * (g.headType === 'beak' ? 1.6 : 1.1), 8);
      snout.rotateX(Math.PI / 2);
      snout.translate(0, headY - headR * 0.15, headZ + headR * 0.9);
      push(snout, headBone, 'head', g.headType === 'beak' ? dark : undefined);
    }
    if (g.headType === 'crest' || g.extras.includes('Rückenkamm') || g.extras.includes('Federbusch') || g.extras.includes('Drüsenkamm')) {
      const crest = taperedQuad(headR * 1.4, headR * 1.3, headR * 0.1);
      crest.rotateY(Math.PI / 2);
      crest.translate(0, headY + headR * 0.7, headZ - headR * 0.2);
      push(crest, headBone, 'head', second);
    }
    if (g.headType === 'mandible') {
      for (const side of [-1, 1]) {
        const m = new ConeGeometry(headR * 0.2, headR * 1.1, 6);
        m.rotateX(Math.PI / 2);
        m.rotateY(side * 0.5);
        m.translate(side * headR * 0.5, headY - headR * 0.3, headZ + headR * 0.8);
        push(m, headBone, 'head', dark);
      }
    }
    if (g.extras.includes('Fühlerpaar')) {
      for (const side of [-1, 1]) {
        const a = new CylinderGeometry(headR * 0.05, headR * 0.08, headR * 1.8, 5);
        a.rotateX(-0.9);
        a.rotateZ(side * 0.5);
        a.translate(side * headR * 0.4, headY + headR * 0.9, headZ + headR * 0.3);
        push(a, headBone, 'head', dark);
      }
    }
    if (g.extras.includes('Halskrause')) {
      const frill = new CylinderGeometry(headR * 1.6, headR * 1.6, headR * 0.12, 12);
      frill.rotateX(Math.PI / 2);
      frill.translate(0, headY, headZ - headR * 0.9);
      push(frill, headBone, 'head', second);
    }
    // Augen
    const eyeR = Math.max(0.006, headR * 0.22);
    const eyeColor = g.extras.includes('leuchtende Augen') ? hsl(g.hue2, 0.9, 0.6) : new Color(0.03, 0.03, 0.04);
    const eyePositions: Array<[number, number, number]> = [];
    if (g.eyeCount === 1) eyePositions.push([0, headY + headR * 0.3, headZ + headR * 0.85]);
    else if (g.eyeCount === 2) eyePositions.push([-headR * 0.55, headY + headR * 0.3, headZ + headR * 0.65], [headR * 0.55, headY + headR * 0.3, headZ + headR * 0.65]);
    else if (g.eyeCount === 4) eyePositions.push([-headR * 0.55, headY + headR * 0.35, headZ + headR * 0.65], [headR * 0.55, headY + headR * 0.35, headZ + headR * 0.65], [-headR * 0.35, headY + headR * 0.65, headZ + headR * 0.5], [headR * 0.35, headY + headR * 0.65, headZ + headR * 0.5]);
    else for (let i = 0; i < g.eyeCount; i++) {
      const a = (i / g.eyeCount) * Math.PI * 2;
      eyePositions.push([Math.cos(a) * headR * 0.6, headY + headR * 0.2 + Math.sin(a) * headR * 0.4, headZ + headR * 0.7]);
    }
    for (const [x, y, z] of eyePositions) {
      const e = new SphereGeometry(eyeR, 6, 5);
      e.translate(x, y, z);
      push(e, headBone, 'head', eyeColor);
    }
  } else {
    // Kopfloser Körper: Augen vorn am Rumpf
    const eyeR = Math.max(0.006, bodyW * 0.08);
    for (const side of [-1, 1]) {
      const e = new SphereGeometry(eyeR, 6, 5);
      e.translate(side * bodyW * 0.25, bodyY + bodyH * 0.2, bodyLen / 2 - eyeR);
      push(e, body, 'head', new Color(0.03, 0.03, 0.04));
    }
  }

  // Beine
  for (let p = 0; p < legPairs; p++) {
    const t = legPairs === 1 ? 0.5 : p / (legPairs - 1);
    const z = (bodyLen / 2) * 0.7 - t * bodyLen * 0.7;
    for (const side of [-1, 1]) {
      const hx = side * bodyW * 0.45;
      const hip = addBone(`hip${p}${side > 0 ? 'R' : 'L'}`, 'hip', body, hx, -bodyH * 0.25, z, side, p);
      const upperLen = legLength * 0.55;
      const lowerLen = legLength * 0.5;
      const upper = new CylinderGeometry(legR * 0.85, legR, upperLen, 6);
      upper.translate(hx, bodyY - bodyH * 0.25 - upperLen / 2, z);
      push(upper, hip, 'limb');
      const knee = addBone(`knee${p}${side > 0 ? 'R' : 'L'}`, 'knee', hip, 0, -upperLen, 0, side, p);
      const lower = new CylinderGeometry(legR * 0.7, legR * 0.9, lowerLen, 6);
      lower.translate(hx, bodyY - bodyH * 0.25 - upperLen - lowerLen / 2, z);
      push(lower, knee, 'limb');
      const foot = new SphereGeometry(legR * 1.4, 6, 5);
      foot.scale(1, 0.6, 1.4);
      foot.translate(hx, bodyY - bodyH * 0.25 - upperLen - lowerLen, z + legR * 0.5);
      push(foot, knee, 'limb', dark);
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
        const w = taperedQuad(L * 0.35, span, L * 0.06);
        w.rotateZ(side * (Math.PI / 2)); // Flügel liegt in der XZ-Ebene, zeigt nach außen
        w.rotateX(-Math.PI / 2);
        w.rotateY(side > 0 ? 0 : Math.PI);
        w.translate(side * bodyW * 0.4, bodyY + bodyH * 0.3, z);
        push(w, wing, 'limb', g.covering === 'membrane' ? second : undefined);
      }
    }
  }

  // Flossen (Wasser) und Schwanz
  if (g.locomotion === 'water' && g.fins > 0) {
    const pairs = Math.max(1, Math.floor(g.fins / 2));
    for (let p = 0; p < pairs; p++) {
      const z = bodyLen * (0.2 - p * 0.3);
      for (const side of [-1, 1]) {
        const fin = addBone(`fin${p}${side > 0 ? 'R' : 'L'}`, 'fin', body, side * bodyW * 0.45, -bodyH * 0.1, z, side, p);
        const f = taperedQuad(L * 0.12, L * 0.2, L * 0.02);
        f.rotateZ(side * 1.2);
        f.rotateX(-Math.PI / 2);
        f.translate(side * bodyW * 0.45, bodyY - bodyH * 0.1, z);
        push(f, fin, 'limb');
      }
    }
  }
  const tailType = g.locomotion === 'water' && g.tailType === 'none' ? 'fin' : g.tailType;
  if (tailType !== 'none') {
    const t1 = addBone('tail1', 'tail', body, 0, 0, -bodyLen / 2 + L * 0.02, 0, 0);
    const tailLen = L * (tailType === 'short' ? 0.18 : tailType === 'long' ? 0.42 : 0.28);
    const seg = tailLen / 2;
    const c1 = new CylinderGeometry(bodyW * 0.22, bodyW * 0.34, seg, 7);
    c1.rotateX(Math.PI / 2);
    c1.translate(0, bodyY, -bodyLen / 2 - seg / 2);
    push(c1, t1, 'tail');
    const t2 = addBone('tail2', 'tail', t1, 0, 0, -seg, 0, 1);
    const c2 = new CylinderGeometry(bodyW * 0.1, bodyW * 0.22, seg, 7);
    c2.rotateX(Math.PI / 2);
    c2.translate(0, bodyY, -bodyLen / 2 - seg * 1.5);
    push(c2, t2, 'tail');
    const tipZ = -bodyLen / 2 - tailLen;
    if (tailType === 'fin') {
      const f = taperedQuad(L * 0.04, L * 0.3, L * 0.22);
      f.rotateY(Math.PI / 2);
      f.translate(0, bodyY - L * 0.12, tipZ);
      push(f, t2, 'tail');
    } else if (tailType === 'fan') {
      for (let i = -2; i <= 2; i++) {
        const f = taperedQuad(L * 0.05, L * 0.22, L * 0.08);
        f.rotateX(-Math.PI / 2 + 0.3);
        f.rotateY(i * 0.3);
        f.translate(0, bodyY, tipZ);
        push(f, t2, 'tail', i % 2 === 0 ? second : undefined);
      }
    } else if (tailType === 'club') {
      const c = new SphereGeometry(bodyW * 0.4, 8, 6);
      c.translate(0, bodyY, tipZ);
      push(c, t2, 'tail', dark);
    }
  }

  // Extras am Rücken
  if (g.extras.includes('Stachelsaum') || g.extras.includes('Hornplatten') || g.extras.includes('Panzerplatten')) {
    const n = 4 + Math.round(rng.float(0, 4));
    for (let i = 0; i < n; i++) {
      const z = bodyLen / 2 - (i + 0.5) * (bodyLen / n);
      const spike = g.extras.includes('Stachelsaum') ? new ConeGeometry(bodyW * 0.08, bodyH * 0.5, 5) : new SphereGeometry(bodyW * 0.14, 6, 4);
      if (!g.extras.includes('Stachelsaum')) spike.scale(1, 0.45, 1);
      spike.translate(0, bodyY + bodyH * 0.48, z);
      push(spike, serpentine ? body : body, 'body', dark);
    }
  }
  if (g.extras.includes('Fangarme')) {
    for (const side of [-1, 1]) {
      let parent = headBone;
      for (let i = 0; i < 3; i++) {
        const z = headZ + headR * (0.6 + i * 0.7);
        const r = headR * (0.18 - i * 0.04);
        const s = new SphereGeometry(Math.max(0.005, r), 6, 5);
        s.translate(side * headR * 0.4, headY - headR * 0.4, z);
        push(s, parent, 'limb');
        parent = headBone;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Skinning-Attribute und Zusammenführen
  const skinned: BufferGeometry[] = [];
  for (const p of parts) {
    const geo = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (geo !== p.geo) p.geo.dispose();
    const n = geo.getAttribute('position').count;
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = p.bone;
      sw[i * 4] = 1;
    }
    geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
    skinned.push(geo);
  }
  const geometry = mergeParts(skinned, `creature ${entry.id}`);

  const covering = g.covering;
  const glow = covering === 'bioluminescent' || g.extras.includes('Leuchtorgane');
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: covering === 'scales' ? 0.5 : covering === 'chitin' ? 0.4 : covering === 'crystal' ? 0.2 : covering === 'skin' ? 0.65 : 0.9,
    metalness: covering === 'chitin' ? 0.25 : covering === 'crystal' ? 0.15 : 0,
    emissive: glow ? hsl(g.hue2, 0.9, 0.5) : new Color(0, 0, 0),
    emissiveIntensity: glow ? 0.6 : 0,
    transparent: covering === 'membrane',
    opacity: covering === 'membrane' ? 0.9 : 1,
  });

  return { geometry, material, bones, lengthM: L, bodyY, legLength, legPairs, glow };
}
