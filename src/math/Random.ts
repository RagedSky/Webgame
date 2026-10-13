/**
 * Seedbarer Pseudozufallsgenerator (sfc32) mit String-Hash (cyrb128).
 *
 * Regeln:
 * - Alle Generatoren nutzen ausschließlich diese Klasse (kein Math.random).
 * - Teilgeneratoren erhalten einen eigenen Strom über `fork(label)`. Ein Fork hängt nur vom Seed-String
 *   und dem Label ab, nicht davon, wie viele Zahlen vorher gezogen wurden. Dadurch bleiben Seeds stabil,
 *   wenn ein Teilgenerator später mehr oder weniger Zufallszahlen verbraucht.
 */

export type Seed128 = [number, number, number, number];

/** cyrb128: 128-Bit-Hash eines Strings (Bryc). */
export function hashString(str: string): Seed128 {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Kleiner 32-Bit-Hash (für Chunk-/Zell-Seeds aus Koordinaten). */
export function hashInts(...values: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of values) {
    const x = Math.floor(v) | 0;
    h = Math.imul(h ^ (x & 0xff), 16777619);
    h = Math.imul(h ^ ((x >>> 8) & 0xff), 16777619);
    h = Math.imul(h ^ ((x >>> 16) & 0xff), 16777619);
    h = Math.imul(h ^ ((x >>> 24) & 0xff), 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

export interface Weighted<T> {
  item: T;
  weight: number;
}

export class Random {
  readonly seedString: string;
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: string | number) {
    this.seedString = typeof seed === 'number' ? `n:${seed}` : seed;
    const [a, b, c, d] = hashString(this.seedString);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    // Aufwärmen, damit nahe beieinanderliegende Seeds schnell divergieren.
    for (let i = 0; i < 12; i++) this.nextUint32();
  }

  /** Neuer, unabhängiger Strom, der nur von Seed + Label abhängt. */
  fork(label: string): Random {
    return new Random(`${this.seedString}/${label}`);
  }

  /** Ganzzahl in [0, 2^32). */
  nextUint32(): number {
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Gleitkommazahl in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Gleitkommazahl in [min, max). */
  float(min = 0, max = 1): number {
    return min + (max - min) * this.next();
  }

  /** Ganzzahl in [min, max] (inklusive). */
  int(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) return lo;
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Normalverteilt (Box-Muller). */
  gaussian(mean = 0, stdDev = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
  }

  /** Wert in [min, max], in Richtung Mitte verdichtet (Mittel aus n Ziehungen). */
  centered(min: number, max: number, samples = 2): number {
    let sum = 0;
    for (let i = 0; i < samples; i++) sum += this.next();
    return min + (max - min) * (sum / samples);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Random.pick: leeres Array');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Zieht `count` verschiedene Elemente (Reihenfolge zufällig). */
  sample<T>(items: readonly T[], count: number): T[] {
    const copy = this.shuffle(items);
    return copy.slice(0, Math.min(count, copy.length));
  }

  weighted<T>(items: readonly Weighted<T>[]): T {
    let total = 0;
    for (const w of items) total += Math.max(0, w.weight);
    if (total <= 0) {
      if (items.length === 0) throw new Error('Random.weighted: leeres Array');
      return this.pick(items).item;
    }
    let r = this.next() * total;
    for (const w of items) {
      r -= Math.max(0, w.weight);
      if (r < 0) return w.item;
    }
    return items[items.length - 1]!.item;
  }

  /** Fisher-Yates auf einer Kopie. */
  shuffle<T>(items: readonly T[]): T[] {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }

  /** Zufälliger Seed-String aus einem bereits seedbaren Strom (für Sub-Seeds). */
  seedWord(length = 8): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i++) out += alphabet[this.int(0, alphabet.length - 1)];
    return out;
  }
}

/**
 * Erzeugt einen nicht-deterministischen Seed-String für den Button „Zufälliges Universum“.
 * Nutzt bewusst `crypto.getRandomValues` und ist nicht Teil der Generierung.
 */
export function randomSeedString(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback (z. B. sehr alte Umgebungen): Zeit-basiert, ebenfalls ohne Math.random.
    let t = Date.now();
    for (let i = 0; i < length; i++) {
      t = (t * 1103515245 + 12345) >>> 0;
      bytes[i] = t & 0xff;
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] as number) % alphabet.length];
  return out;
}
