import { describe, expect, it } from 'vitest';
import { Random, hashInts, hashString } from './Random';
import { distributeInteger } from './utils';

describe('Random (sfc32)', () => {
  it('ist deterministisch für gleichen Seed', () => {
    const a = new Random('stellar');
    const b = new Random('stellar');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('liefert verschiedene Folgen für verschiedene Seeds', () => {
    const a = new Random('seed-1');
    const b = new Random('seed-2');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('hält Wertebereiche ein', () => {
    const r = new Random('ranges');
    for (let i = 0; i < 10000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(-3, 3);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(3);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('int ist über den Bereich verteilt (alle Werte kommen vor)', () => {
    const r = new Random('dist');
    const counts = new Map<number, number>();
    for (let i = 0; i < 6000; i++) {
      const v = r.int(1, 6);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (let v = 1; v <= 6; v++) {
      expect(counts.get(v) ?? 0).toBeGreaterThan(700);
    }
  });

  it('fork hängt nur von Seed und Label ab, nicht vom Verbrauch', () => {
    const a = new Random('base');
    const b = new Random('base');
    b.next();
    b.next();
    expect(a.fork('x').next()).toBe(b.fork('x').next());
    expect(a.fork('x').next()).not.toBe(a.fork('y').next());
  });

  it('weighted respektiert Gewichte', () => {
    const r = new Random('weighted');
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      if (r.weighted([{ item: 'a', weight: 9 }, { item: 'b', weight: 1 }]) === 'a') hits++;
    }
    expect(hits).toBeGreaterThan(1700);
  });

  it('shuffle ist eine Permutation', () => {
    const r = new Random('shuffle');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const s = r.shuffle(arr);
    expect(s.slice().sort((x, y) => x - y)).toEqual(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('hashString / hashInts sind stabil', () => {
    expect(hashString('abc')).toEqual(hashString('abc'));
    expect(hashString('abc')).not.toEqual(hashString('abd'));
    expect(hashInts(1, 2, 3)).toBe(hashInts(1, 2, 3));
    expect(hashInts(1, 2, 3)).not.toBe(hashInts(3, 2, 1));
  });
});

describe('distributeInteger', () => {
  it('summiert exakt auf total', () => {
    const out = distributeInteger(500, [26, 18, 14, 12, 10, 8, 6, 6]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(500);
    expect(out).toEqual([130, 90, 70, 60, 50, 40, 30, 30]);
  });

  it('respektiert Caps und verteilt Überschuss', () => {
    const out = distributeInteger(100, [1, 1, 1, 1], [5, Infinity, 0, Infinity]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
    expect(out[0]).toBe(5);
    expect(out[2]).toBe(0);
  });
});
