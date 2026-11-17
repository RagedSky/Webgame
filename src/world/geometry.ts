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

/**
 * Zufällige Vertex-Verschiebung (organischer Look), deterministisch. Eckpunkte an derselben Position erhalten
 * dieselbe Verschiebung – sonst reißen Flächen bei Geometrien mit doppelten Eckpunkten (Naht, nicht-indiziert) auf.
 */
export function jitter(geo: BufferGeometry, amount: number, seed: string): BufferGeometry {
  const rng = new Random(seed);
  const pos = geo.getAttribute('position') as BufferAttribute;
  const offsets = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 4096)},${Math.round(pos.getY(i) * 4096)},${Math.round(pos.getZ(i) * 4096)}`;
    let o = offsets.get(key);
    if (!o) {
      o = [rng.float(-amount, amount), rng.float(-amount, amount), rng.float(-amount, amount)];
      offsets.set(key, o);
    }
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
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

/**
 * Gebogener Halm/Wedel: Band aus `segments` Abschnitten, das sich nach +z neigt und zur Spitze verjüngt.
 * Die Normalen zeigen überwiegend nach oben, damit Gras wie der Boden beleuchtet wird (weicher, dichter Eindruck).
 */
export function blade(width: number, height: number, bend: number, segments = 3, tipWidth = 0, upNormals = 0.8, twoSided = true): BufferGeometry {
  const g = new BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = (width + (tipWidth - width) * Math.pow(t, 1.4)) / 2;
    const y = height * t * (1 - 0.18 * bend * t);
    const z = bend * height * t * t;
    pos.push(-w, y, z, w, y, z);
    // Flächennormale (aus der Biegung) mit Aufwärtsanteil mischen
    const ny = upNormals + (1 - upNormals) * (2 * bend * t);
    const nz = (1 - upNormals) * 1;
    const len = Math.hypot(ny, nz) || 1;
    nor.push(0, ny / len, nz / len, 0, ny / len, nz / len);
    uv.push(0, t, 1, t);
    if (i < segments) {
      const a = i * 2;
      // optional beide Wicklungen: von beiden Seiten sichtbar, mit denselben Normalen (keine dunklen Rückseiten)
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      if (twoSided) idx.push(a, a + 3, a + 1, a, a + 2, a + 3);
    }
  }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Vertexfarben als Verlauf von unten (`bottom`) nach oben (`top`) entlang der Y-Achse; `power` formt den Verlauf. */
export function gradientColor(geo: BufferGeometry, bottom: Color, top: Color, power = 1): BufferGeometry {
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
  const span = maxY - minY || 1;
  for (let i = 0; i < n; i++) {
    const t = Math.pow((pos.getY(i) - minY) / span, power);
    arr[i * 3] = bottom.r + (top.r - bottom.r) * t;
    arr[i * 3 + 1] = bottom.g + (top.g - bottom.g) * t;
    arr[i * 3 + 2] = bottom.b + (top.b - bottom.b) * t;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
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
