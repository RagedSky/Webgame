/**
 * Quad-Netz mit Catmull-Clark-Unterteilung (rein, ohne Three.js). Grundlage des Charakterkörpers:
 * ein grober Käfig aus Vierecken mit sauberen Kantenschleifen wird ein- oder mehrfach unterteilt und ergibt ein
 * glattes, dichtes Netz, das weiterhin nur aus Vierecken besteht. Punktattribute (Knochengewichte) werden mit denselben
 * Regeln geglättet wie die Positionen; Flächenattribute (Zone, UV je Ecke) vererben sich an die Teilflächen.
 */
export interface QuadMesh {
  /** xyz je Punkt. */
  positions: number[];
  /** Vier Punktindizes je Fläche. */
  faces: number[];
  /** Materialzone je Fläche. */
  zones: number[];
  /** UV je Flächenecke (8 Werte je Fläche); Nähte sind erlaubt, weil UVs nicht an Punkten hängen. */
  uvs: number[];
  /** Knochengewichte je Punkt (`bones` Werte, Summe 1). */
  weights: number[];
  bones: number;
}

interface Edges {
  /** Kante je Flächenseite (4 je Fläche). */
  faceEdges: Int32Array;
  v0: number[];
  v1: number[];
  f0: number[];
  /** Zweite angrenzende Fläche oder −1 (Rand); −2 = mehr als zwei Flächen (nicht mannigfaltig). */
  f1: number[];
}

function buildEdges(mesh: QuadMesh): Edges {
  const vertexCount = mesh.positions.length / 3;
  const faceCount = mesh.faces.length / 4;
  const ids = new Map<number, number>();
  const edges: Edges = { faceEdges: new Int32Array(faceCount * 4), v0: [], v1: [], f0: [], f1: [] };
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 4; k++) {
      const a = mesh.faces[f * 4 + k] as number;
      const b = mesh.faces[f * 4 + ((k + 1) % 4)] as number;
      const key = a < b ? a * vertexCount + b : b * vertexCount + a;
      let e = ids.get(key);
      if (e === undefined) {
        e = edges.v0.length;
        ids.set(key, e);
        edges.v0.push(a);
        edges.v1.push(b);
        edges.f0.push(f);
        edges.f1.push(-1);
      } else if (edges.f1[e] === -1) edges.f1[e] = f;
      else edges.f1[e] = -2;
      edges.faceEdges[f * 4 + k] = e;
    }
  }
  return edges;
}

function flipFace(mesh: QuadMesh, f: number): void {
  const i = f * 4;
  const b = mesh.faces[i + 1] as number;
  mesh.faces[i + 1] = mesh.faces[i + 3] as number;
  mesh.faces[i + 3] = b;
  const u = f * 8;
  const u1 = mesh.uvs[u + 2] as number;
  const v1 = mesh.uvs[u + 3] as number;
  mesh.uvs[u + 2] = mesh.uvs[u + 6] as number;
  mesh.uvs[u + 3] = mesh.uvs[u + 7] as number;
  mesh.uvs[u + 6] = u1;
  mesh.uvs[u + 7] = v1;
}

/** Vorzeichenbehaftetes Volumen (positiv, wenn alle Flächen nach außen zeigen). */
export function signedVolume(mesh: QuadMesh): number {
  const p = mesh.positions;
  let vol = 0;
  const tri = (a: number, b: number, c: number): number => {
    const ax = p[a * 3] as number;
    const ay = p[a * 3 + 1] as number;
    const az = p[a * 3 + 2] as number;
    const bx = p[b * 3] as number;
    const by = p[b * 3 + 1] as number;
    const bz = p[b * 3 + 2] as number;
    const cx = p[c * 3] as number;
    const cy = p[c * 3 + 1] as number;
    const cz = p[c * 3 + 2] as number;
    return (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  };
  for (let f = 0; f < mesh.faces.length; f += 4) {
    const a = mesh.faces[f] as number;
    const b = mesh.faces[f + 1] as number;
    const c = mesh.faces[f + 2] as number;
    const d = mesh.faces[f + 3] as number;
    vol += tri(a, b, c) + tri(a, c, d);
  }
  return vol;
}

/**
 * Richtet alle Flächen einheitlich aus (Nachbarn durchlaufen gemeinsame Kanten gegenläufig) und dreht das Netz so,
 * dass die Normalen nach außen zeigen. Der Käfigbau muss sich damit nicht um die Umlaufrichtung kümmern.
 */
export function orient(mesh: QuadMesh): void {
  const edges = buildEdges(mesh);
  const faceCount = mesh.faces.length / 4;
  const seen = new Uint8Array(faceCount);
  for (let start = 0; start < faceCount; start++) {
    if (seen[start]) continue;
    seen[start] = 1;
    const queue = [start];
    while (queue.length) {
      const f = queue.pop() as number;
      for (let k = 0; k < 4; k++) {
        const e = edges.faceEdges[f * 4 + k] as number;
        const g = edges.f0[e] === f ? (edges.f1[e] as number) : (edges.f0[e] as number);
        if (g < 0 || seen[g]) continue;
        const a = mesh.faces[f * 4 + k] as number;
        const b = mesh.faces[f * 4 + ((k + 1) % 4)] as number;
        // gleiche Laufrichtung in der Nachbarfläche → umdrehen
        for (let j = 0; j < 4; j++) {
          if (mesh.faces[g * 4 + j] === a && mesh.faces[g * 4 + ((j + 1) % 4)] === b) {
            flipFace(mesh, g);
            // Kantenzuordnung der gedrehten Fläche mitdrehen (Seite 0 ↔ 3, 1 ↔ 2)
            const fe = edges.faceEdges;
            const e0 = fe[g * 4] as number;
            const e1 = fe[g * 4 + 1] as number;
            fe[g * 4] = fe[g * 4 + 3] as number;
            fe[g * 4 + 1] = fe[g * 4 + 2] as number;
            fe[g * 4 + 2] = e1;
            fe[g * 4 + 3] = e0;
            break;
          }
        }
        seen[g] = 1;
        queue.push(g);
      }
    }
  }
  if (signedVolume(mesh) < 0) for (let f = 0; f < faceCount; f++) flipFace(mesh, f);
}

export interface MeshReport {
  vertices: number;
  edges: number;
  faces: number;
  /** Kanten mit nur einer Fläche (Löcher). */
  boundaryEdges: number;
  /** Kanten mit mehr als zwei Flächen. */
  nonManifoldEdges: number;
  /** Nachbarflächen laufen an der gemeinsamen Kante gleich herum (falsche Ausrichtung). */
  inconsistentEdges: number;
  /** Euler-Charakteristik V − E + F (2 = geschlossene Fläche ohne Henkel). */
  euler: number;
  /** Anzahl Punkte je Valenz (4 = regulär). */
  valence: Record<number, number>;
  /** Anteil regulärer Punkte (Valenz 4). */
  regular: number;
  /** Zusammenhangskomponenten. */
  components: number;
  volume: number;
}

/** Prüft Geschlossenheit, Mannigfaltigkeit, Ausrichtung und Regelmäßigkeit eines Netzes. */
export function analyze(mesh: QuadMesh): MeshReport {
  const edges = buildEdges(mesh);
  const vertexCount = mesh.positions.length / 3;
  const faceCount = mesh.faces.length / 4;
  const degree = new Int32Array(vertexCount);
  let boundary = 0;
  let nonManifold = 0;
  let inconsistent = 0;
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    while (parent[i] !== r) {
      const next = parent[i] as number;
      parent[i] = r;
      i = next;
    }
    return r;
  };
  for (let e = 0; e < edges.v0.length; e++) {
    const a = edges.v0[e] as number;
    const b = edges.v1[e] as number;
    degree[a] = (degree[a] as number) + 1;
    degree[b] = (degree[b] as number) + 1;
    parent[find(a)] = find(b);
    const f1 = edges.f1[e] as number;
    if (f1 === -1) boundary++;
    else if (f1 === -2) nonManifold++;
    else {
      // in der zweiten Fläche muss die Kante b→a laufen
      let ok = false;
      for (let j = 0; j < 4; j++) if (mesh.faces[f1 * 4 + j] === b && mesh.faces[f1 * 4 + ((j + 1) % 4)] === a) ok = true;
      if (!ok) inconsistent++;
    }
  }
  const valence: Record<number, number> = {};
  let regular = 0;
  const roots = new Set<number>();
  for (let i = 0; i < vertexCount; i++) {
    const d = degree[i] as number;
    valence[d] = (valence[d] ?? 0) + 1;
    if (d === 4) regular++;
    roots.add(find(i));
  }
  return {
    vertices: vertexCount,
    edges: edges.v0.length,
    faces: faceCount,
    boundaryEdges: boundary,
    nonManifoldEdges: nonManifold,
    inconsistentEdges: inconsistent,
    euler: vertexCount - edges.v0.length + faceCount,
    valence,
    regular: vertexCount ? regular / vertexCount : 0,
    components: roots.size,
    volume: signedVolume(mesh),
  };
}

/** Catmull-Clark-Regeln auf ein Punktattribut mit `stride` Werten anwenden (Positionen, Gewichte). */
function refine(values: number[], stride: number, mesh: QuadMesh, edges: Edges): number[] {
  const vertexCount = mesh.positions.length / 3;
  const edgeCount = edges.v0.length;
  const faceCount = mesh.faces.length / 4;
  const out = new Array<number>((vertexCount + edgeCount + faceCount) * stride).fill(0);
  const facePoint = vertexCount + edgeCount;
  // Flächenpunkte: Mittel der vier Ecken
  for (let f = 0; f < faceCount; f++) {
    for (let s = 0; s < stride; s++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += values[(mesh.faces[f * 4 + k] as number) * stride + s] as number;
      out[(facePoint + f) * stride + s] = sum / 4;
    }
  }
  // Kantenpunkte und Summen für die Punktregel
  const sumFace = new Array<number>(vertexCount * stride).fill(0);
  const sumMid = new Array<number>(vertexCount * stride).fill(0);
  const edgeDegree = new Int32Array(vertexCount);
  const faceDegree = new Int32Array(vertexCount);
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 4; k++) {
      const v = mesh.faces[f * 4 + k] as number;
      faceDegree[v] = (faceDegree[v] as number) + 1;
      for (let s = 0; s < stride; s++) sumFace[v * stride + s] = (sumFace[v * stride + s] as number) + (out[(facePoint + f) * stride + s] as number);
    }
  }
  for (let e = 0; e < edgeCount; e++) {
    const a = edges.v0[e] as number;
    const b = edges.v1[e] as number;
    const f0 = edges.f0[e] as number;
    const f1 = edges.f1[e] as number;
    edgeDegree[a] = (edgeDegree[a] as number) + 1;
    edgeDegree[b] = (edgeDegree[b] as number) + 1;
    for (let s = 0; s < stride; s++) {
      const mid = ((values[a * stride + s] as number) + (values[b * stride + s] as number)) / 2;
      sumMid[a * stride + s] = (sumMid[a * stride + s] as number) + mid;
      sumMid[b * stride + s] = (sumMid[b * stride + s] as number) + mid;
      out[(vertexCount + e) * stride + s] = f1 >= 0 ? (mid * 2 + (out[(facePoint + f0) * stride + s] as number) + (out[(facePoint + f1) * stride + s] as number)) / 4 : mid;
    }
  }
  // Ursprüngliche Punkte: (F + 2R + (n − 3)P) / n
  for (let v = 0; v < vertexCount; v++) {
    const n = edgeDegree[v] as number;
    const nf = faceDegree[v] as number;
    for (let s = 0; s < stride; s++) {
      const p = values[v * stride + s] as number;
      if (n < 3 || nf !== n) {
        out[v * stride + s] = p;
        continue;
      }
      out[v * stride + s] = ((sumFace[v * stride + s] as number) / nf + (2 * (sumMid[v * stride + s] as number)) / n + (n - 3) * p) / n;
    }
  }
  return out;
}

/** Eine Stufe Catmull-Clark: jede Fläche zerfällt in vier, das Netz bleibt ein reines Quad-Netz. */
export function subdivide(mesh: QuadMesh): QuadMesh {
  const edges = buildEdges(mesh);
  const vertexCount = mesh.positions.length / 3;
  const edgeCount = edges.v0.length;
  const faceCount = mesh.faces.length / 4;
  const out: QuadMesh = { positions: refine(mesh.positions, 3, mesh, edges), weights: refine(mesh.weights, mesh.bones, mesh, edges), bones: mesh.bones, faces: [], zones: [], uvs: [] };
  for (let f = 0; f < faceCount; f++) {
    const fp = vertexCount + edgeCount + f;
    const zone = mesh.zones[f] as number;
    const u = mesh.uvs.slice(f * 8, f * 8 + 8) as number[];
    const cu = ((u[0] as number) + (u[2] as number) + (u[4] as number) + (u[6] as number)) / 4;
    const cv = ((u[1] as number) + (u[3] as number) + (u[5] as number) + (u[7] as number)) / 4;
    for (let k = 0; k < 4; k++) {
      const prev = (k + 3) % 4;
      const next = (k + 1) % 4;
      const corner = mesh.faces[f * 4 + k] as number;
      const eNext = vertexCount + (edges.faceEdges[f * 4 + k] as number);
      const ePrev = vertexCount + (edges.faceEdges[f * 4 + prev] as number);
      out.faces.push(corner, eNext, fp, ePrev);
      out.zones.push(zone);
      const ku = u[k * 2] as number;
      const kv = u[k * 2 + 1] as number;
      out.uvs.push(ku, kv, (ku + (u[next * 2] as number)) / 2, (kv + (u[next * 2 + 1] as number)) / 2, cu, cv, (ku + (u[prev * 2] as number)) / 2, (kv + (u[prev * 2 + 1] as number)) / 2);
    }
  }
  return out;
}

/** Glatte Punktnormalen (flächengewichtet über alle angrenzenden Vierecke). */
export function vertexNormals(mesh: QuadMesh): Float32Array {
  const p = mesh.positions;
  const n = new Float32Array(p.length);
  for (let f = 0; f < mesh.faces.length; f += 4) {
    const a = (mesh.faces[f] as number) * 3;
    const b = (mesh.faces[f + 1] as number) * 3;
    const c = (mesh.faces[f + 2] as number) * 3;
    const d = (mesh.faces[f + 3] as number) * 3;
    // Normale aus den Diagonalen (für ebene und leicht verwundene Vierecke stabil)
    const ux = (p[c] as number) - (p[a] as number);
    const uy = (p[c + 1] as number) - (p[a + 1] as number);
    const uz = (p[c + 2] as number) - (p[a + 2] as number);
    const vx = (p[d] as number) - (p[b] as number);
    const vy = (p[d + 1] as number) - (p[b + 1] as number);
    const vz = (p[d + 2] as number) - (p[b + 2] as number);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [a, b, c, d]) {
      n[i] = (n[i] as number) + nx;
      n[i + 1] = (n[i + 1] as number) + ny;
      n[i + 2] = (n[i + 2] as number) + nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i] as number, n[i + 1] as number, n[i + 2] as number) || 1;
    n[i] = (n[i] as number) / len;
    n[i + 1] = (n[i + 1] as number) / len;
    n[i + 2] = (n[i + 2] as number) / len;
  }
  return n;
}

/**
 * Abgerundeter Quader als Käfig: jede Seite 3 × 3 Vierecke, die äußeren Reihen sind nur `bevel` breit. Nach der
 * Unterteilung entstehen ebene Flächen mit gleichmäßig gerundeten Kanten (harte Technikteile wie der Rucksack).
 * `shape` kann die Eckpunkte verformen (z. B. nach unten verjüngen).
 */
export function roundedBox(width: number, height: number, depth: number, bevel: number, shape?: (x: number, y: number, z: number) => [number, number, number]): QuadMesh {
  const mesh: QuadMesh = { positions: [], faces: [], zones: [], uvs: [], weights: [], bones: 1 };
  const axis = (size: number): number[] => [-size / 2, -size / 2 + bevel, size / 2 - bevel, size / 2];
  const xs = axis(width);
  const ys = axis(height);
  const zs = axis(depth);
  const ids = new Map<number, number>();
  const vertex = (i: number, j: number, k: number): number => {
    const key = i * 16 + j * 4 + k;
    let id = ids.get(key);
    if (id === undefined) {
      id = mesh.positions.length / 3;
      ids.set(key, id);
      const p: [number, number, number] = [xs[i] as number, ys[j] as number, zs[k] as number];
      const q = shape ? shape(p[0], p[1], p[2]) : p;
      mesh.positions.push(q[0], q[1], q[2]);
      mesh.weights.push(1);
    }
    return id;
  };
  const face = (a: number, b: number, c: number, d: number): void => {
    mesh.faces.push(a, b, c, d);
    mesh.zones.push(0);
    mesh.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
  };
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      for (const side of [0, 3]) {
        face(vertex(side, a, b), vertex(side, a + 1, b), vertex(side, a + 1, b + 1), vertex(side, a, b + 1));
        face(vertex(a, side, b), vertex(a + 1, side, b), vertex(a + 1, side, b + 1), vertex(a, side, b + 1));
        face(vertex(a, b, side), vertex(a + 1, b, side), vertex(a + 1, b + 1, side), vertex(a, b + 1, side));
      }
    }
  }
  orient(mesh);
  return mesh;
}
