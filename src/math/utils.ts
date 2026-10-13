/** Reine Hilfsfunktionen ohne Abhängigkeiten. */

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  lerp(outMin, outMax, clamp01(inverseLerp(inMin, inMax, v)));
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01(inverseLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
};
export const round = (v: number, decimals = 2): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};
export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Summe eines Zahlen-Arrays. */
export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * Verteilt `total` ganzzahlig proportional zu `weights` (Largest-Remainder-Verfahren).
 * Optionale `caps` begrenzen einzelne Anteile; Überschuss wird auf freie Positionen verteilt.
 * Das Ergebnis summiert sich zu `total`, sofern die Caps das zulassen.
 */
export function distributeInteger(total: number, weights: readonly number[], caps?: readonly number[]): number[] {
  const n = weights.length;
  const result = new Array<number>(n).fill(0);
  if (n === 0 || total <= 0) return result;
  const cap = (i: number): number => (caps ? Math.max(0, caps[i] ?? Infinity) : Infinity);

  let remaining = total;
  const active = new Set<number>();
  for (let i = 0; i < n; i++) if ((weights[i] ?? 0) > 0 && cap(i) > 0) active.add(i);

  // Iterativ: verteilen, Caps anwenden, Rest erneut auf nicht gedeckelte Positionen verteilen.
  for (let guard = 0; guard < n + 2 && remaining > 0 && active.size > 0; guard++) {
    const idx = Array.from(active);
    const wsum = idx.reduce((acc, i) => acc + (weights[i] as number), 0);
    const shares = idx.map((i) => (remaining * (weights[i] as number)) / wsum);
    const floors = shares.map((s) => Math.floor(s));
    let used = floors.reduce((a, b) => a + b, 0);
    const order = idx
      .map((_, k) => k)
      .sort((x, y) => shares[y]! - floors[y]! - (shares[x]! - floors[x]!) || idx[x]! - idx[y]!);
    for (let k = 0; k < order.length && used < remaining; k++) {
      floors[order[k]!]! += 1;
      used++;
    }
    remaining = 0;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k] as number;
      const room = cap(i) - (result[i] as number);
      const give = Math.min(room, floors[k] as number);
      result[i] = (result[i] as number) + give;
      remaining += (floors[k] as number) - give;
      if ((result[i] as number) >= cap(i)) active.delete(i);
    }
  }
  return result;
}

/** Erzeugt ein Array [0, 1, …, n-1]. */
export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Römische Zahl (1–20 reicht für Planeten/Monde). */
export function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let v = Math.max(1, Math.floor(n));
  for (const [val, sym] of map) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

/** Deutsche Großschreibung des ersten Buchstabens. */
export const capitalize = (s: string): string => (s.length ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Formatiert Kelvin als °C-String für die UI. */
export const kelvinToCelsius = (k: number): number => k - 273.15;
