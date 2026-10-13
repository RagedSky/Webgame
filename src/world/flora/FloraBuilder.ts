import type { BufferGeometry} from 'three';
import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, OctahedronGeometry, SphereGeometry } from 'three';
import { Random } from '@/math/Random';
import { clamp } from '@/math/utils';
import type { FloraGenome } from '@/gen/archive/types';
import { colorize, hsl, jitter, mergeParts, taperedQuad } from '../geometry';

/**
 * Prozedurale Pflanzen aus Flora-Genomen: Wuchsform, Höhe, Blattform, Farben, Verzweigung, Dichte, Blüten.
 * Alle Farben liegen als Vertexfarben vor; Instanzen variieren nur Größe und leichte Helligkeit.
 */
export function buildFloraGeometry(genome: FloraGenome, seed: string): BufferGeometry {
  const rng = new Random(`flora:${seed}`);
  const H = clamp(genome.heightM, 0.05, 45);
  const leaf = hsl(genome.leafHue, 0.55, 0.38);
  const trunk = hsl(genome.trunkHue, 0.45, 0.28);
  const flower = hsl(genome.flowerHue, 0.75, 0.6);
  const parts: BufferGeometry[] = [];
  const blooms = genome.bloomTime !== 'any' || rng.bool(0.4);

  const addFlowers = (count: number, cx: number, cy: number, cz: number, radius: number, size: number): void => {
    for (let i = 0; i < count; i++) {
      const s = new SphereGeometry(size, 6, 4);
      const a = rng.float(0, Math.PI * 2);
      const r = radius * Math.sqrt(rng.next());
      s.translate(cx + Math.cos(a) * r, cy + rng.float(-radius * 0.3, radius * 0.5), cz + Math.sin(a) * r);
      parts.push(colorize(s, flower));
    }
  };

  switch (genome.form) {
    case 'tree': {
      const trunkH = H * 0.5;
      const t = new CylinderGeometry(H * 0.018, H * 0.032, trunkH, 6);
      t.translate(0, trunkH / 2, 0);
      parts.push(colorize(t, trunk, 0.2));
      const branches = Math.round(genome.branching * 4);
      for (let i = 0; i < branches; i++) {
        const b = new CylinderGeometry(H * 0.008, H * 0.014, H * 0.22, 5);
        b.translate(0, H * 0.11, 0);
        b.rotateZ(rng.float(0.5, 1.1) * (rng.bool() ? 1 : -1));
        b.rotateY(rng.float(0, Math.PI * 2));
        b.translate(0, trunkH * rng.float(0.55, 0.95), 0);
        parts.push(colorize(b, trunk, 0.1));
      }
      const cy = H * 0.68;
      if (genome.leafShape === 'needle') {
        const tiers: Array<[number, number, number]> = [
          [0.2, 0.3, 0.45],
          [0.16, 0.28, 0.62],
          [0.12, 0.26, 0.78],
        ];
        for (const [r, h, y] of tiers) {
          const c = new ConeGeometry(H * r, H * h, 7);
          c.translate(0, H * y, 0);
          parts.push(colorize(c, leaf, 0.25));
        }
      } else if (genome.leafShape === 'frond') {
        const n = 6 + Math.round(genome.density * 4);
        for (let i = 0; i < n; i++) {
          const f = taperedQuad(H * 0.09, H * 0.42, H * 0.01);
          f.rotateX(-0.4 - (i % 2) * 0.3);
          f.rotateY((i / n) * Math.PI * 2);
          f.translate(0, trunkH, 0);
          parts.push(colorize(f, leaf, 0.2));
        }
      } else {
        const n = 2 + Math.round(genome.density * 3);
        for (let i = 0; i < n; i++) {
          const r = H * rng.float(0.16, 0.24);
          const c = new IcosahedronGeometry(r, 1);
          c.scale(1, genome.leafShape === 'broad' ? 0.8 : 1, 1);
          c.translate(rng.float(-H * 0.15, H * 0.15), cy + rng.float(-H * 0.1, H * 0.12), rng.float(-H * 0.15, H * 0.15));
          parts.push(colorize(jitter(c, r * 0.1, `${seed}:c${i}`), leaf, 0.3));
        }
      }
      if (blooms) addFlowers(6 + Math.round(rng.float(0, 8)), 0, cy + H * 0.08, 0, H * 0.22, H * 0.018);
      break;
    }
    case 'shrub': {
      const n = 1 + Math.round(genome.density * 2);
      for (let i = 0; i < n; i++) {
        const r = H * rng.float(0.4, 0.55);
        const c = new IcosahedronGeometry(r, 1);
        c.scale(1, 0.8, 1);
        c.translate(rng.float(-H * 0.3, H * 0.3) * (n > 1 ? 1 : 0), r * 0.75, rng.float(-H * 0.3, H * 0.3) * (n > 1 ? 1 : 0));
        parts.push(colorize(jitter(c, r * 0.12, `${seed}:s${i}`), leaf, 0.35));
      }
      if (blooms) addFlowers(3 + Math.round(rng.float(0, 5)), 0, H * 0.65, 0, H * 0.45, Math.max(0.02, H * 0.05));
      break;
    }
    case 'grass': {
      const n = 5 + Math.round(genome.density * 3);
      const w = Math.max(0.03, H * 0.08);
      for (let i = 0; i < n; i++) {
        const q = taperedQuad(w, H * rng.float(0.7, 1), w * 0.1);
        q.rotateX(rng.float(-0.25, 0.25));
        q.rotateY((i / n) * Math.PI * 2 + rng.float(-0.3, 0.3));
        q.translate(rng.float(-w, w), 0, rng.float(-w, w));
        parts.push(colorize(q, leaf, 0.5));
      }
      if (blooms) addFlowers(2, 0, H * 0.9, 0, w * 2, Math.max(0.015, H * 0.03));
      break;
    }
    case 'fungus': {
      const stemH = H * 0.6;
      const stem = new CylinderGeometry(H * 0.08, H * 0.12, stemH, 7);
      stem.translate(0, stemH / 2, 0);
      parts.push(colorize(stem, hsl(genome.leafHue, 0.15, 0.72), 0.2));
      const cap = new SphereGeometry(H * 0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.55, 1);
      cap.translate(0, stemH, 0);
      parts.push(colorize(cap, hsl(genome.leafHue, 0.5, 0.42), 0.15));
      if (genome.density > 0.5) addFlowers(5 + Math.round(genome.density * 6), 0, stemH + H * 0.08, 0, H * 0.3, H * 0.03);
      break;
    }
    case 'aquatic': {
      const n = 3 + Math.round(genome.density * 3);
      for (let i = 0; i < n; i++) {
        const q = taperedQuad(Math.max(0.05, H * 0.08), H * rng.float(0.6, 1), H * 0.02);
        q.rotateX(rng.float(-0.3, 0.3));
        q.rotateY((i / n) * Math.PI * 2);
        q.translate(rng.float(-H * 0.05, H * 0.05), 0, rng.float(-H * 0.05, H * 0.05));
        parts.push(colorize(q, hsl(genome.leafHue, 0.5, 0.32), 0.5));
      }
      break;
    }
    case 'succulent': {
      const body = new CylinderGeometry(H * 0.16, H * 0.2, H * 0.8, 8);
      body.translate(0, H * 0.4, 0);
      parts.push(colorize(jitter(body, H * 0.015, `${seed}:b`), hsl(genome.leafHue, 0.4, 0.38), 0.25));
      const pads = 5 + Math.round(genome.density * 3);
      for (let i = 0; i < pads; i++) {
        const p = taperedQuad(H * 0.22, H * 0.5, H * 0.06);
        p.rotateX(-0.9);
        p.rotateY((i / pads) * Math.PI * 2);
        parts.push(colorize(p, hsl(genome.leafHue, 0.45, 0.4), 0.3));
      }
      if (blooms) addFlowers(1 + Math.round(rng.float(0, 2)), 0, H * 0.82, 0, H * 0.08, Math.max(0.02, H * 0.08));
      break;
    }
    case 'lichen': {
      const r = clamp(H * 3, 0.15, 1.2);
      const disc = new CylinderGeometry(r, r * 0.9, Math.max(0.02, H * 0.5), 10);
      disc.translate(0, Math.max(0.01, H * 0.25), 0);
      parts.push(colorize(jitter(disc, r * 0.12, `${seed}:l`), hsl(genome.leafHue, 0.35, 0.5), 0.3));
      if (genome.density > 0.4) addFlowers(4 + Math.round(genome.density * 6), 0, H * 0.5, 0, r * 0.8, Math.max(0.01, r * 0.08));
      break;
    }
    case 'vine': {
      // Bodenkriecher: flache Blätter um ein kurzes Rankenzentrum, Beeren als Blüten
      const n = 6 + Math.round(genome.density * 5);
      const reach = Math.max(0.3, H * 0.35);
      const stem = new CylinderGeometry(Math.max(0.01, H * 0.012), Math.max(0.012, H * 0.016), Math.max(0.08, H * 0.25), 5);
      stem.translate(0, Math.max(0.04, H * 0.12), 0);
      parts.push(colorize(stem, trunk));
      for (let i = 0; i < n; i++) {
        const l = taperedQuad(Math.max(0.08, reach * 0.35), reach * rng.float(0.7, 1), reach * 0.05);
        l.rotateX(-1.25 - rng.float(0, 0.2));
        l.rotateY((i / n) * Math.PI * 2 + rng.float(-0.2, 0.2));
        l.translate(0, Math.max(0.03, H * 0.06), 0);
        parts.push(colorize(l, leaf, 0.3));
      }
      if (blooms) addFlowers(3 + Math.round(rng.float(0, 4)), 0, Math.max(0.05, H * 0.1), 0, reach * 0.6, Math.max(0.015, H * 0.025));
      break;
    }
    case 'crystal_plant': {
      const n = 3 + Math.round(genome.density * 3);
      for (let i = 0; i < n; i++) {
        const o = new OctahedronGeometry(1, 0);
        const h = H * rng.float(0.6, 1);
        o.scale(Math.max(0.04, H * 0.1), h * 0.5, Math.max(0.04, H * 0.1));
        o.rotateX(rng.float(-0.35, 0.35));
        o.rotateZ(rng.float(-0.35, 0.35));
        o.rotateY(rng.float(0, Math.PI * 2));
        o.translate(rng.float(-H * 0.12, H * 0.12), h * 0.5, rng.float(-H * 0.12, H * 0.12));
        parts.push(colorize(o, hsl(genome.leafHue, 0.6, 0.62), 0.4));
      }
      break;
    }
  }
  return mergeParts(parts, `flora ${genome.form}`);
}
