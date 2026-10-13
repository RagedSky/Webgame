import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Random } from '@/math/Random';

/** Gemeinsame Geometrie-Helfer für prozedurale Pflanzen, Steine und Kreaturen. */

/** Konstantes Vertex-Farbattribut; `gradient` dunkelt zur Unterseite ab (0 = aus). */
export function colorize(geo: BufferGeometry, color: Color, gradient = 0): BufferGeometry {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const arr = new Float32Array(n * 3);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let i = 0; i < n; i++) {
    const t = gradient > 0 && maxY > minY ? 1 - gradient * (1 - (pos.getY(i) - minY) / (maxY - minY)) : 1;
    arr[i * 3] = color.r * t;
    arr[i * 3 + 1] = color.g * t;
    arr[i * 3 + 2] = color.b * t;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

/** Zufällige Vertex-Verschiebung (organischer Look), deterministisch. */
export function jitter(geo: BufferGeometry, amount: number, seed: string): BufferGeometry {
  const rng = new Random(seed);
  const pos = geo.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + rng.float(-amount, amount), pos.getY(i) + rng.float(-amount, amount), pos.getZ(i) + rng.float(-amount, amount));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Vertikales, nach oben verjüngtes Rechteck (Grashalm, Blatt, Flosse, Flügel). */
export function taperedQuad(width: number, height: number, tipWidth = 0): BufferGeometry {
  const g = new BufferGeometry();
  const w = width / 2;
  const t = tipWidth / 2;
  g.setAttribute('position', new Float32BufferAttribute([-w, 0, 0, w, 0, 0, t, height, 0, -t, height, 0], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Führt Teile zu einer Geometrie zusammen (nicht-indiziert, einheitliche Attribute) und gibt die Teile frei. */
export function mergeParts(parts: BufferGeometry[], label: string): BufferGeometry {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  // Nur gemeinsame Attribute behalten (uv fehlt z. B. bei handgebauten Teilen)
  const common = new Set(Object.keys(flat[0]?.attributes ?? {}));
  for (const g of flat) for (const k of Array.from(common)) if (!g.attributes[k]) common.delete(k);
  for (const g of flat) for (const k of Object.keys(g.attributes)) if (!common.has(k)) g.deleteAttribute(k);
  const merged = mergeGeometries(flat, false);
  if (!merged) throw new Error(`Geometrie „${label}“ konnte nicht zusammengeführt werden`);
  for (const g of parts) g.dispose();
  for (const g of flat) if (!parts.includes(g)) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

export const hsl = (h: number, s: number, l: number): Color => new Color().setHSL((((h % 360) + 360) % 360) / 360, s, l);
