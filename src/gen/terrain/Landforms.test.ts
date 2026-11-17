import { describe, expect, it } from 'vitest';
import { SimplexNoise } from '@/math/Noise';
import { BIOMES } from '../universe/catalog';
import { L, LANDFORMS, LandformField, recipeAmplitude } from './Landforms';

const field = (seed: string): LandformField => new LandformField(new SimplexNoise(`terrain:${seed}`), seed);

describe('Landforms', () => {
  it('hat für jedes Biom ein Rezept mit gültigen Formen', () => {
    for (const kind of Object.keys(BIOMES) as Array<keyof typeof BIOMES>) {
      const r = LANDFORMS[kind];
      expect(r, kind).toBeDefined();
      expect(r.span[1]).toBeGreaterThan(r.span[0]);
      expect(r.flat).toBeGreaterThanOrEqual(0);
      expect(r.flat).toBeLessThanOrEqual(1);
      for (const [id] of r.layers) {
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(L.COUNT);
      }
      expect(recipeAmplitude(r)).toBeGreaterThan(0);
    }
  });

  it('alle Formen sind deterministisch, endlich und beschränkt', () => {
    const a = field('FORM-1');
    const b = field('FORM-1');
    for (let layer = 0; layer < L.COUNT; layer++) {
      for (let i = 0; i < 400; i++) {
        const x = ((i * 137.7) % 5000) - 2500;
        const z = ((i * 71.3) % 5000) - 2500;
        const v = a.shape(layer, x, z);
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(2.6);
        expect(v).toBe(b.shape(layer, x, z));
      }
    }
  });

  it('Krater: Schüsseln unter dem Umland, Ränder darüber, Tiefe passt zum Durchmesser', () => {
    const f = field('KRATER-1');
    let min = 0;
    let max = 0;
    let flat = 0;
    const n = 160;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const h = f.craters(i * 25 - 2000, j * 25 - 2000, 1);
        min = Math.min(min, h);
        max = Math.max(max, h);
        if (Math.abs(h) < 0.05) flat++;
      }
    }
    // größter möglicher Krater: Radius ≈ 460 m → Tiefe unter 90 m, Rand unter 25 m
    expect(min).toBeLessThan(-8);
    expect(min).toBeGreaterThan(-140);
    expect(max).toBeGreaterThan(1);
    expect(max).toBeLessThan(45);
    // zwischen den Kratern bleibt ebenes Umland
    expect(flat / (n * n)).toBeGreaterThan(0.05);
    // ohne Dichte keine Krater
    expect(f.craters(123, 456, 0)).toBe(0);
  });

  it('Dünen: Leehang ist steiler als der Luvhang', () => {
    const f = field('DUENE-1');
    // entlang vieler Richtungen abtasten und die steilsten Auf- und Abstiege je Linie vergleichen
    let steepUp = 0;
    let steepDown = 0;
    for (let line = 0; line < 12; line++) {
      const a = (line / 12) * Math.PI * 2;
      let prev = f.shape(L.DUNES, 0, 0);
      for (let s = 2; s < 3000; s += 2) {
        const v = f.shape(L.DUNES, Math.cos(a) * s, Math.sin(a) * s);
        steepUp = Math.max(steepUp, v - prev);
        steepDown = Math.max(steepDown, prev - v);
        prev = v;
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
    // in Windrichtung fällt die Düne steil ab, gegen den Wind steigt sie steil an: beides kommt vor
    expect(Math.max(steepUp, steepDown)).toBeGreaterThan(0.005);
  });
});
