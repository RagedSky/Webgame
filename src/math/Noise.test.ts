import { describe, expect, it } from 'vitest';
import { SimplexNoise } from './Noise';

describe('SimplexNoise', () => {
  it('ist deterministisch', () => {
    const a = new SimplexNoise('terrain');
    const b = new SimplexNoise('terrain');
    for (let i = 0; i < 100; i++) {
      expect(a.noise2D(i * 0.37, i * 0.11)).toBe(b.noise2D(i * 0.37, i * 0.11));
      expect(a.noise3D(i * 0.37, i * 0.11, i * 0.05)).toBe(b.noise3D(i * 0.37, i * 0.11, i * 0.05));
    }
  });

  it('liegt in [-1, 1] und ist nicht konstant', () => {
    const n = new SimplexNoise('range');
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        const v = n.fbm2D(x * 0.1, y * 0.1, 5);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    expect(max - min).toBeGreaterThan(0.5);
  });

  it('unterscheidet sich zwischen Seeds', () => {
    const a = new SimplexNoise('a');
    const b = new SimplexNoise('b');
    let diff = 0;
    for (let i = 0; i < 50; i++) diff += Math.abs(a.noise2D(i * 0.3, 1.7) - b.noise2D(i * 0.3, 1.7));
    expect(diff).toBeGreaterThan(1);
  });
});
