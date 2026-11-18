import { describe, expect, it } from 'vitest';
import { CREST, WAVES, maxWaveHeight, prepareWaves, seaState, shoreFactor, waveHeight, wavesGlsl } from './waves';

describe('Wellenmodell', () => {
  const waves = prepareWaves(9.81);

  it('bleibt innerhalb der Summe der Amplituden', () => {
    const max = maxWaveHeight();
    for (let i = 0; i < 4000; i++) {
      const h = waveHeight(waves, i * 3.7, i * -1.9, i * 0.13, 1);
      expect(Math.abs(h)).toBeLessThanOrEqual(max + 1e-9);
    }
  });

  it('ist stetig in Ort und Zeit', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 5.3;
      const z = i * 2.1;
      const t = i * 0.4;
      const h = waveHeight(waves, x, z, t, 1);
      expect(Math.abs(waveHeight(waves, x + 0.05, z, t, 1) - h)).toBeLessThan(0.02);
      expect(Math.abs(waveHeight(waves, x, z, t + 0.01, 1) - h)).toBeLessThan(0.02);
    }
  });

  it('hat spitzere Kämme als Täler (Mittel unter null)', () => {
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += waveHeight(waves, i * 0.83, i * 0.41, 0, 1);
    expect(CREST).toBeGreaterThan(1);
    expect(sum / 20000).toBeLessThan(-0.02);
  });

  it('lange Wellen laufen schneller, geringe Schwerkraft macht die See langsamer', () => {
    const speed = (w: { kx: number; kz: number; omega: number }): number => w.omega / Math.hypot(w.kx, w.kz);
    expect(speed(waves[0]!)).toBeGreaterThan(speed(waves[4]!));
    const low = prepareWaves(3.7);
    expect(low[0]!.omega).toBeLessThan(waves[0]!.omega);
  });

  it('Seegang wächst mit dem Wind, Wellen laufen zum Ufer aus', () => {
    expect(seaState(0)).toBeLessThan(seaState(0.5));
    expect(seaState(1)).toBeGreaterThan(1);
    expect(shoreFactor(0)).toBe(0);
    expect(shoreFactor(-2)).toBe(0);
    expect(shoreFactor(50)).toBe(1);
    expect(shoreFactor(2)).toBeGreaterThan(0);
    expect(shoreFactor(2)).toBeLessThan(1);
  });

  it('erzeugt Shader-Code für alle Wellen', () => {
    const glsl = wavesGlsl(9.81);
    expect(glsl).toContain('float waveH(vec2 p, float t)');
    expect(glsl).toContain('vec3 waveHD(vec2 p, float t)');
    expect(glsl.match(/sin\(/g)?.length).toBe(WAVES.length * 2);
    expect(glsl).not.toContain('NaN');
  });
});
