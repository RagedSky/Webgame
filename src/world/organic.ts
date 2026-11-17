/**
 * Organische Grundformen für prozedurale Pflanzen, Felsen und Kreaturen: gebogene Röhren mit Verjüngung,
 * weiche Klumpen (verrauschte Kugeln), Rotationskörper und facettierte Kristalle. Alle Formen liefern
 * Position, Normale und UV – Farben setzen die Aufrufer (`gradientColor`, `colorize`).
 */
import { BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, SphereGeometry, Vector2, Vector3, type BufferAttribute } from 'three';
import { SimplexNoise } from '@/math/Noise';

export interface TubePoint {
  x: number;
  y: number;
  z: number;
  /** Radius an dieser Stelle. */
  r: number;
}

const tA = new Vector3();
const tB = new Vector3();
const tT = new Vector3();
const tN = new Vector3();
const tBi = new Vector3();

/** Röhre entlang einer Punktfolge (Stamm, Ast, Ranke, Bein): runde Querschnitte, glatte Normalen, geschlossene Enden. */
export function tube(points: TubePoint[], radial = 8, closed = true): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = points.length;
  let ref = new Vector3(1, 0, 0);
  const rings: number[] = [];
  const pushRing = (c: TubePoint, tangent: Vector3, radius: number, v: number): void => {
    // Rahmen: Referenzvektor senkrecht zur Tangente fortschreiben (verhindert Verdrehen)
    tN.copy(ref).addScaledVector(tangent, -ref.dot(tangent));
    if (tN.lengthSq() < 1e-6) tN.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
    tN.normalize();
    ref = tN.clone();
    tBi.crossVectors(tangent, tN).normalize();
    rings.push(pos.length / 3);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a);
      const sx = Math.sin(a);
      const nx = tN.x * cx + tBi.x * sx;
      const ny = tN.y * cx + tBi.y * sx;
      const nz = tN.z * cx + tBi.z * sx;
      pos.push(c.x + nx * radius, c.y + ny * radius, c.z + nz * radius);
      nor.push(nx, ny, nz);
      uv.push(j / radial, v);
    }
  };
  for (let i = 0; i < n; i++) {
    const p = points[i] as TubePoint;
    const prev = points[Math.max(0, i - 1)] as TubePoint;
    const next = points[Math.min(n - 1, i + 1)] as TubePoint;
    tT.set(next.x - prev.x, next.y - prev.y, next.z - prev.z);
    if (tT.lengthSq() < 1e-10) tT.set(0, 1, 0);
    tT.normalize();
    if (closed && i === 0) pushRing(p, tT, Math.max(1e-4, p.r * 0.05), 0);
    pushRing(p, tT, Math.max(1e-4, p.r), i / (n - 1));
    if (closed && i === n - 1) pushRing(p, tT, Math.max(1e-4, p.r * 0.05), 1);
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const a0 = rings[r] as number;
    const b0 = rings[r + 1] as number;
    for (let j = 0; j < radial; j++) {
      idx.push(a0 + j, a0 + j + 1, b0 + j, a0 + j + 1, b0 + j + 1, b0 + j);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Gebogene Punktfolge von `from` nach `to` mit seitlichem Bogen (`bow`) und Radiusverlauf r0 → r1. */
export function arc(from: [number, number, number], to: [number, number, number], bow: [number, number, number], r0: number, r1: number, steps = 6, flare = 0): TubePoint[] {
  const out: TubePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = Math.sin(t * Math.PI);
    const r = r0 + (r1 - r0) * t;
    out.push({
      x: from[0] + (to[0] - from[0]) * t + bow[0] * k,
      y: from[1] + (to[1] - from[1]) * t + bow[1] * k,
      z: from[2] + (to[2] - from[2]) * t + bow[2] * k,
      r: r * (1 + flare * Math.pow(1 - t, 4)),
    });
  }
  return out;
}

/** Normalen an identischen Positionen mitteln (schließt die Naht einer verformten Kugel). */
export function weldNormals(geo: BufferGeometry): BufferGeometry {
  geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal') as BufferAttribute;
  const map = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    const list = map.get(key);
    if (list) list.push(i);
    else map.set(key, [i]);
  }
  for (const list of map.values()) {
    if (list.length < 2) continue;
    tA.set(0, 0, 0);
    for (const i of list) tA.add(tB.fromBufferAttribute(nor, i));
    tA.normalize();
    for (const i of list) nor.setXYZ(i, tA.x, tA.y, tA.z);
  }
  nor.needsUpdate = true;
  return geo;
}

/**
 * Weicher Klumpen: Kugel mit niederfrequentem Rauschen verformt (Laubkrone, Busch, Felsblock, Pilzknolle).
 * `amp` ist die Verformung relativ zum Radius, `freq` die Rauschfrequenz, `squash` staucht die Höhe.
 */
export function blob(radius: number, seed: string, amp = 0.18, freq = 1.3, squash = 1, wSeg = 12, hSeg = 9): BufferGeometry {
  const g = new SphereGeometry(radius, wSeg, hSeg);
  const noise = new SimplexNoise(`blob:${seed}`);
  const pos = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    tA.fromBufferAttribute(pos, i);
    const len = tA.length() || 1;
    const nx = tA.x / len;
    const ny = tA.y / len;
    const nz = tA.z / len;
    const d = 1 + amp * noise.noise3D(nx * freq, ny * freq, nz * freq) + amp * 0.4 * noise.noise3D(nx * freq * 2.7 + 9, ny * freq * 2.7, nz * freq * 2.7);
    pos.setXYZ(i, nx * radius * d, ny * radius * d * squash, nz * radius * d);
  }
  pos.needsUpdate = true;
  return weldNormals(g);
}

/**
 * Rotationskörper aus einem Profil [Radius, Höhe] von unten nach oben (Pilzhut, Knolle, Schirmkrone, Scheibe).
 * Mit `phiStart`/`phiLength` entsteht nur ein Kreisausschnitt (Rüstungsplatte, Visier); φ = 0 zeigt nach +z.
 */
export function lathe(profile: Array<[number, number]>, segments = 12, phiStart = 0, phiLength = Math.PI * 2): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(1e-4, r), y)),
    segments,
    phiStart,
    phiLength,
  );
}

/**
 * Kantiges Prisma mit gefasten Enden: Rotationskörper mit wenigen Seiten und flachen Flächennormalen
 * (Frachtkiste, Sockel, Konsole). Mit `sides = 4` und 45°-Drehung entsteht ein Quader mit Fasen.
 */
export function prism(profile: Array<[number, number]>, sides = 4, twist = Math.PI / 4): BufferGeometry {
  const base = lathe(profile, sides, twist);
  const flat = base.toNonIndexed();
  base.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** Facettierter Kristall: sechseckige Säule mit Spitze (flache Normalen, damit die Flächen glitzern). */
export function crystal(radius: number, height: number, tip = 0.35, sides = 6): BufferGeometry {
  const shaft = new CylinderGeometry(radius * 0.72, radius, height * (1 - tip), sides, 1, false);
  shaft.translate(0, (height * (1 - tip)) / 2, 0);
  const cap = new ConeGeometry(radius * 0.72, height * tip, sides, 1, false);
  cap.translate(0, height * (1 - tip) + (height * tip) / 2, 0);
  const a = shaft.toNonIndexed();
  const b = cap.toNonIndexed();
  shaft.dispose();
  cap.dispose();
  a.computeVertexNormals();
  b.computeVertexNormals();
  // zusammenführen ohne Abhängigkeit zu geometry.ts (Zyklus vermeiden)
  const pa = a.getAttribute('position');
  const pb = b.getAttribute('position');
  const count = pa.count + pb.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  pos.set(pa.array as Float32Array, 0);
  pos.set(pb.array as Float32Array, pa.count * 3);
  nor.set(a.getAttribute('normal').array as Float32Array, 0);
  nor.set(b.getAttribute('normal').array as Float32Array, pa.count * 3);
  uv.set(a.getAttribute('uv').array as Float32Array, 0);
  uv.set(b.getAttribute('uv').array as Float32Array, pa.count * 2);
  a.dispose();
  b.dispose();
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}
