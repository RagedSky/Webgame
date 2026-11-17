import type { BufferGeometry, Color } from 'three';
import { SphereGeometry } from 'three';
import { Random } from '@/math/Random';
import { clamp } from '@/math/utils';
import type { FloraGenome } from '@/gen/archive/types';
import { blade, colorize, gradientColor, hsl, mergeParts } from '../geometry';
import { arc, blob, crystal, lathe, tube } from '../organic';

/**
 * Prozedurale Pflanzen aus Flora-Genomen: Wuchsform, Höhe, Blattform, Farben, Verzweigung, Dichte, Blüten.
 * Formen sind organisch (gebogene Stämme, weiche Kronen, Schirme, Wedel, Scheiben) mit kräftigen Farbverläufen
 * von dunkler Basis zu hellen, farbverschobenen Spitzen. Alle Farben liegen als Vertexfarben vor.
 */
export function buildFloraGeometry(genome: FloraGenome, seed: string): BufferGeometry {
  const rng = new Random(`flora:${seed}`);
  const H = clamp(genome.heightM, 0.05, 45);
  const leaf = hsl(genome.leafHue, 0.62, 0.36);
  const leafTip = hsl(genome.leafHue + 26, 0.72, 0.58);
  const leafDark = hsl(genome.leafHue - 10, 0.55, 0.2);
  const trunk = hsl(genome.trunkHue, 0.42, 0.24);
  const trunkTop = hsl(genome.trunkHue + 12, 0.4, 0.42);
  const flower = hsl(genome.flowerHue, 0.85, 0.62);
  const flowerCore = hsl(genome.flowerHue + 30, 0.9, 0.78);
  const parts: BufferGeometry[] = [];
  const blooms = genome.bloomTime !== 'any' || rng.bool(0.4);
  const glow = genome.glow > 0.5;
  const TAU = Math.PI * 2;

  const bulb = (x: number, y: number, z: number, r: number, color: Color = flower): void => {
    const s = new SphereGeometry(r, 6, 4);
    s.translate(x, y, z);
    parts.push(colorize(s, color));
  };
  const addFlowers = (count: number, cx: number, cy: number, cz: number, radius: number, size: number): void => {
    for (let i = 0; i < count; i++) {
      const a = rng.float(0, TAU);
      const r = radius * Math.sqrt(rng.next());
      bulb(cx + Math.cos(a) * r, cy + rng.float(-radius * 0.3, radius * 0.5), cz + Math.sin(a) * r, size, i % 3 === 0 ? flowerCore : flower);
    }
  };
  /** Gebogener Stamm mit Wurzelansatz; liefert die Spitze. */
  const stem = (height: number, r0: number, r1: number, lean = 0.12, radial = 7): [number, number, number] => {
    const a = rng.float(0, TAU);
    const top: [number, number, number] = [Math.cos(a) * height * lean, height, Math.sin(a) * height * lean];
    const bow: [number, number, number] = [-Math.cos(a) * height * lean * 0.8, 0, -Math.sin(a) * height * lean * 0.8];
    parts.push(gradientColor(tube(arc([0, -height * 0.02, 0], top, bow, r0, r1, 5, 0.9), radial), trunk, trunkTop));
    return top;
  };
  /** Kranz aus Wedeln/Halmen um einen Punkt. */
  const rosette = (count: number, cx: number, cy: number, cz: number, length: number, width: number, bend: number, tilt: number, bottom: Color, top: Color, segments = 3): void => {
    for (let i = 0; i < count; i++) {
      const b = blade(width * rng.float(0.8, 1.2), length * rng.float(0.75, 1.1), bend * rng.float(0.8, 1.25), segments, width * 0.06, 0.45);
      b.rotateX(tilt * rng.float(0.8, 1.2));
      b.rotateY((i / count) * TAU + rng.float(-0.25, 0.25));
      b.translate(cx, cy, cz);
      parts.push(gradientColor(b, bottom, top, 0.8));
    }
  };

  switch (genome.form) {
    case 'tree': {
      const shape = genome.leafShape;
      const trunkH = H * (shape === 'cap' ? 0.74 : shape === 'frond' || shape === 'blade' ? 0.8 : 0.56);
      const [tx, ty, tz] = stem(trunkH, H * 0.045, H * (shape === 'cap' ? 0.03 : 0.016), 0.1);
      if (shape === 'needle') {
        // Hängende Nadelschürzen (Rotationskörper), nach oben kleiner
        const tiers = 3 + Math.round(genome.density * 2);
        for (let i = 0; i < tiers; i++) {
          const t = i / tiers;
          const r = H * (0.26 - t * 0.17);
          const h = H * 0.26;
          const y = H * (0.34 + t * 0.52);
          const g = lathe(
            [
              [r * 0.92, 0],
              [r, h * 0.1],
              [r * 0.62, h * 0.42],
              [r * 0.3, h * 0.74],
              [r * 0.03, h],
            ],
            10,
          );
          g.translate(tx * (y / trunkH) * 0.6, y, tz * (y / trunkH) * 0.6);
          parts.push(gradientColor(g, leafDark, leafTip, 0.9));
        }
      } else if (shape === 'frond' || shape === 'blade') {
        // Palmkrone: lange, überhängende Wedel
        const n = 8 + Math.round(genome.density * 6);
        rosette(n, tx, ty, tz, H * (shape === 'frond' ? 0.5 : 0.36), H * (shape === 'frond' ? 0.11 : 0.07), shape === 'frond' ? 0.95 : 0.35, shape === 'frond' ? 0.55 : 0.2, leaf, leafTip, 5);
        bulb(tx, ty, tz, H * 0.035, trunkTop);
      } else if (shape === 'cap') {
        // Schirmkrone: breiter, gewölbter Hut mit dunkler Unterseite
        const R = H * (0.34 + genome.density * 0.14);
        const cap = lathe(
          [
            [R * 0.12, -R * 0.1],
            [R * 0.78, -R * 0.16],
            [R, -R * 0.05],
            [R * 0.9, R * 0.1],
            [R * 0.6, R * 0.25],
            [R * 0.25, R * 0.33],
            [0, R * 0.35],
          ],
          12,
        );
        cap.translate(tx, ty, tz);
        parts.push(gradientColor(cap, leafDark, leafTip, 0.7));
        const spots = 5 + Math.round(genome.density * 6);
        for (let i = 0; i < spots; i++) {
          const a = rng.float(0, TAU);
          const d = R * rng.float(0.2, 0.8);
          bulb(tx + Math.cos(a) * d, ty + R * (0.3 - (d / R) * 0.22), tz + Math.sin(a) * d, R * 0.05, flowerCore);
        }
      } else if (shape === 'pad') {
        // Plattformen: versetzte Scheiben am Stamm
        const n = 3 + Math.round(genome.density * 2);
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / n;
          const R = H * (0.28 - t * 0.1);
          const a = rng.float(0, TAU);
          const off = i === n - 1 ? 0 : R * 0.55;
          const y = trunkH * (0.45 + t * 0.55);
          const pad = lathe(
            [
              [R * 0.2, -R * 0.08],
              [R * 0.9, -R * 0.06],
              [R, 0],
              [R * 0.85, R * 0.08],
              [0, R * 0.12],
            ],
            12,
          );
          pad.translate(tx * (y / trunkH) + Math.cos(a) * off, y, tz * (y / trunkH) + Math.sin(a) * off);
          parts.push(gradientColor(pad, leaf, leafTip, 0.6));
        }
      } else if (shape === 'lobed' || shape === 'none') {
        // Äste mit Knollen an den Enden (bei „none“ leuchtende Fruchtkörper)
        const n = 3 + Math.round(genome.branching * 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rng.float(-0.3, 0.3);
          const len = H * rng.float(0.2, 0.32);
          const end: [number, number, number] = [tx + Math.cos(a) * len, ty + H * rng.float(0.08, 0.26), tz + Math.sin(a) * len];
          parts.push(gradientColor(tube(arc([tx, ty - H * 0.04, tz], end, [0, H * 0.06, 0], H * 0.016, H * 0.008, 5), 6), trunk, trunkTop));
          if (shape === 'none') bulb(end[0], end[1], end[2], H * 0.045, i % 2 ? flower : flowerCore);
          else {
            const c = blob(H * rng.float(0.11, 0.16), `${seed}:lobe${i}`, 0.16, 1.4, 0.85, 8, 6);
            c.translate(end[0], end[1] + H * 0.03, end[2]);
            parts.push(gradientColor(c, leaf, leafTip, 0.9));
          }
        }
      } else {
        // Laubkrone: mehrere weiche Klumpen
        const n = 3 + Math.round(genome.density * 3);
        const cy = ty + H * 0.1;
        for (let i = 0; i < n; i++) {
          const r = H * rng.float(0.17, 0.25) * (i === 0 ? 1.15 : 1);
          const c = blob(r, `${seed}:c${i}`, 0.2, 1.3, 0.82, 9, 6);
          const a = rng.float(0, TAU);
          const d = i === 0 ? 0 : H * rng.float(0.1, 0.2);
          c.translate(tx + Math.cos(a) * d, cy + (i === 0 ? H * 0.05 : rng.float(-H * 0.08, H * 0.08)), tz + Math.sin(a) * d);
          parts.push(gradientColor(c, leafDark, leafTip, 0.85));
        }
        const branches = Math.round(genome.branching * 3);
        for (let i = 0; i < branches; i++) {
          const a = rng.float(0, TAU);
          const y = trunkH * rng.float(0.5, 0.85);
          parts.push(gradientColor(tube(arc([tx * (y / trunkH), y, tz * (y / trunkH)], [tx + Math.cos(a) * H * 0.2, y + H * 0.12, tz + Math.sin(a) * H * 0.2], [0, H * 0.03, 0], H * 0.014, H * 0.007, 4), 6), trunk, trunkTop));
        }
      }
      if (blooms && shape !== 'none' && shape !== 'cap') addFlowers(5 + Math.round(rng.float(0, 7)), tx, ty + H * 0.14, tz, H * 0.24, H * 0.02);
      break;
    }
    case 'shrub': {
      if (genome.leafShape === 'blade' || genome.leafShape === 'frond' || genome.leafShape === 'needle') {
        rosette(9 + Math.round(genome.density * 7), 0, 0, 0, H * 1.05, H * 0.2, 0.7, 0.35, leafDark, leafTip, 4);
      } else {
        const n = 2 + Math.round(genome.density * 3);
        for (let i = 0; i < n; i++) {
          const r = H * rng.float(0.36, 0.5);
          const c = blob(r, `${seed}:s${i}`, 0.2, 1.4, 0.8, 8, 6);
          const a = rng.float(0, TAU);
          const d = i === 0 ? 0 : H * rng.float(0.25, 0.4);
          c.translate(Math.cos(a) * d, r * 0.7, Math.sin(a) * d);
          parts.push(gradientColor(c, leafDark, leafTip, 0.9));
        }
      }
      if (blooms) {
        // Blüten auf Stielen
        const n = 3 + Math.round(rng.float(0, 4));
        for (let i = 0; i < n; i++) {
          const a = rng.float(0, TAU);
          const d = H * rng.float(0.1, 0.4);
          const top: [number, number, number] = [Math.cos(a) * d, H * rng.float(0.85, 1.2), Math.sin(a) * d];
          parts.push(colorize(tube(arc([Math.cos(a) * d * 0.4, H * 0.3, Math.sin(a) * d * 0.4], top, [0, 0, 0], Math.max(0.006, H * 0.012), Math.max(0.004, H * 0.008), 3), 5), leaf));
          bulb(top[0], top[1], top[2], Math.max(0.02, H * 0.06), i % 2 ? flower : flowerCore);
        }
      }
      break;
    }
    case 'grass': {
      const w = Math.max(0.03, H * 0.09);
      rosette(8 + Math.round(genome.density * 6), 0, 0, 0, H, w, 0.45, 0.18, leafDark, leafTip, 4);
      if (blooms) {
        for (let i = 0; i < 3; i++) {
          const a = rng.float(0, TAU);
          const top: [number, number, number] = [Math.cos(a) * H * 0.15, H * rng.float(1, 1.25), Math.sin(a) * H * 0.15];
          parts.push(colorize(tube(arc([0, H * 0.1, 0], top, [0, 0, 0], Math.max(0.004, H * 0.01), Math.max(0.003, H * 0.006), 3), 5), leaf));
          bulb(top[0], top[1], top[2], Math.max(0.015, H * 0.045));
        }
      }
      break;
    }
    case 'fungus': {
      const caps = 1 + Math.round(genome.density * 2);
      for (let i = 0; i < caps; i++) {
        const hh = H * (i === 0 ? 1 : rng.float(0.45, 0.7));
        const a = rng.float(0, TAU);
        const d = i === 0 ? 0 : H * rng.float(0.22, 0.34);
        const bx = Math.cos(a) * d;
        const bz = Math.sin(a) * d;
        const stemH = hh * 0.72;
        const lean = i === 0 ? 0.04 : 0.18;
        const top: [number, number, number] = [bx + Math.cos(a) * hh * lean, stemH, bz + Math.sin(a) * hh * lean];
        parts.push(gradientColor(tube(arc([bx, -hh * 0.02, bz], top, [0, 0, 0], hh * 0.1, hh * 0.06, 5, 0.6), 8), hsl(genome.leafHue, 0.18, 0.55), hsl(genome.leafHue, 0.12, 0.82)));
        const R = hh * 0.4;
        const cap = lathe(
          [
            [R * 0.15, -R * 0.12],
            [R * 0.85, -R * 0.2],
            [R, -R * 0.06],
            [R * 0.86, R * 0.2],
            [R * 0.52, R * 0.42],
            [R * 0.2, R * 0.52],
            [0, R * 0.55],
          ],
          12,
        );
        cap.translate(top[0], top[1], top[2]);
        parts.push(gradientColor(cap, hsl(genome.leafHue, 0.5, 0.22), hsl(genome.leafHue + 14, 0.75, 0.55), 0.75));
        const spots = 4 + Math.round(genome.density * 5);
        for (let k = 0; k < spots; k++) {
          const sa = rng.float(0, TAU);
          const sd = R * rng.float(0.15, 0.75);
          bulb(top[0] + Math.cos(sa) * sd, top[1] + R * (0.5 - (sd / R) * 0.34), top[2] + Math.sin(sa) * sd, R * 0.07, glow ? flowerCore : hsl(genome.flowerHue, 0.4, 0.86));
        }
      }
      break;
    }
    case 'aquatic': {
      // Tang: wellige Bänder mit Schwimmblasen
      const n = 4 + Math.round(genome.density * 4);
      for (let i = 0; i < n; i++) {
        const b = blade(Math.max(0.06, H * 0.1), H * rng.float(0.6, 1), rng.float(-0.3, 0.3), 6, H * 0.03, 0.3);
        b.rotateY((i / n) * TAU + rng.float(-0.3, 0.3));
        b.translate(rng.float(-H * 0.06, H * 0.06), 0, rng.float(-H * 0.06, H * 0.06));
        parts.push(gradientColor(b, hsl(genome.leafHue, 0.55, 0.2), hsl(genome.leafHue + 20, 0.65, 0.5), 0.8));
      }
      for (let i = 0; i < 3; i++) bulb(rng.float(-H * 0.1, H * 0.1), H * rng.float(0.4, 0.9), rng.float(-H * 0.1, H * 0.1), Math.max(0.02, H * 0.04), flowerCore);
      break;
    }
    case 'succulent': {
      if (genome.leafShape === 'pad' || genome.leafShape === 'broad' || genome.leafShape === 'lobed') {
        // Knollenkaktus: bauchiger Körper mit Krone
        const R = H * 0.3;
        const body = lathe(
          [
            [R * 0.5, 0],
            [R * 0.95, H * 0.2],
            [R, H * 0.45],
            [R * 0.75, H * 0.72],
            [R * 0.3, H * 0.88],
            [0, H * 0.9],
          ],
          10,
        );
        parts.push(gradientColor(body, hsl(genome.leafHue, 0.5, 0.24), hsl(genome.leafHue + 18, 0.6, 0.5), 0.9));
        rosette(5 + Math.round(genome.density * 4), 0, H * 0.82, 0, H * 0.28, H * 0.07, 0.5, 0.5, leaf, flower, 3);
        if (blooms) bulb(0, H * 0.95, 0, Math.max(0.02, H * 0.08), flowerCore);
      } else {
        // Agavenrosette: dicke, aufragende Blätter
        rosette(8 + Math.round(genome.density * 6), 0, 0, 0, H, H * 0.24, 0.4, 0.3, hsl(genome.leafHue, 0.45, 0.24), hsl(genome.leafHue + 20, 0.6, 0.55), 4);
        if (blooms) {
          parts.push(colorize(tube(arc([0, H * 0.2, 0], [0, H * 1.5, 0], [H * 0.05, 0, 0], H * 0.03, H * 0.015, 4), 6), leaf));
          addFlowers(5, 0, H * 1.5, 0, H * 0.12, Math.max(0.02, H * 0.06));
        }
      }
      break;
    }
    case 'lichen': {
      const r = clamp(H * 3, 0.15, 1.2);
      const n = 3 + Math.round(genome.density * 3);
      for (let i = 0; i < n; i++) {
        const rr = r * rng.float(0.35, 0.6);
        const c = blob(rr, `${seed}:l${i}`, 0.25, 1.6, 0.28, 8, 5);
        const a = rng.float(0, TAU);
        const d = i === 0 ? 0 : r * rng.float(0.3, 0.6);
        c.translate(Math.cos(a) * d, rr * 0.12, Math.sin(a) * d);
        parts.push(gradientColor(c, hsl(genome.leafHue, 0.4, 0.3), hsl(genome.leafHue + 24, 0.6, 0.62), 0.6));
      }
      if (genome.density > 0.4) addFlowers(4 + Math.round(genome.density * 6), 0, Math.max(0.03, r * 0.14), 0, r * 0.7, Math.max(0.012, r * 0.07));
      break;
    }
    case 'vine': {
      // Bodenranke: kriechende Triebe mit Blättern und Beeren
      const n = 4 + Math.round(genome.density * 3);
      const reach = clamp(H * 0.5, 0.4, 2.4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng.float(-0.3, 0.3);
        const end: [number, number, number] = [Math.cos(a) * reach, clamp(H * 0.05, 0.03, 0.2), Math.sin(a) * reach];
        const path = arc([0, clamp(H * 0.08, 0.03, 0.3), 0], end, [Math.sin(a) * reach * 0.25, clamp(H * 0.2, 0.05, 0.7), -Math.cos(a) * reach * 0.25], clamp(H * 0.02, 0.012, 0.07), clamp(H * 0.008, 0.006, 0.03), 6);
        parts.push(gradientColor(tube(path, 5), trunk, leaf));
        for (let k = 2; k < path.length; k += 2) {
          const p = path[k]!;
          const l = blade(Math.min(0.3, reach * 0.2), Math.min(0.45, reach * 0.3), 0.3, 2, 0.01, 0.5);
          l.rotateX(1.25);
          l.rotateY(a + (k % 4 ? 1.3 : -1.3));
          l.translate(p.x, p.y, p.z);
          parts.push(gradientColor(l, leaf, leafTip));
        }
        if (blooms) bulb(end[0], end[1] + 0.04, end[2], clamp(H * 0.035, 0.02, 0.12));
      }
      break;
    }
    case 'crystal_plant': {
      const n = 4 + Math.round(genome.density * 4);
      for (let i = 0; i < n; i++) {
        const h = H * rng.float(0.45, 1) * (i === 0 ? 1.1 : 1);
        const c = crystal(Math.max(0.04, H * rng.float(0.07, 0.13)), h, 0.3);
        if (i > 0) {
          c.rotateX(rng.float(-0.5, 0.5));
          c.rotateZ(rng.float(-0.5, 0.5));
        }
        c.rotateY(rng.float(0, TAU));
        c.translate(i === 0 ? 0 : rng.float(-H * 0.16, H * 0.16), -h * 0.05, i === 0 ? 0 : rng.float(-H * 0.16, H * 0.16));
        parts.push(gradientColor(c, hsl(genome.leafHue, 0.7, 0.34), hsl(genome.leafHue + 30, 0.75, 0.8), 0.9));
      }
      break;
    }
  }
  return mergeParts(parts, `flora ${genome.form}`);
}
