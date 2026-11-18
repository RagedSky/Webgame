import { describe, expect, it } from 'vitest';
import { ShaderChunk } from 'three';
import { installGaussianShadows, shadowBlurRadius, sunShadowRadius } from './softShadows';

describe('Gaußsche Schattenfilterung', () => {
  it('ersetzt die Abtastung im Schatten-Shader von Three.js', () => {
    expect(installGaussianShadows()).toBe(true);
    const src = ShaderChunk.shadowmap_pars_fragment;
    expect(src).toContain('// gaussian-pcf');
    // die zufällig gedrehte Fünf-Punkt-Abtastung ist aus der 2D-Schattenfunktion verschwunden
    const fn = src.slice(src.indexOf('float getShadow( sampler2DShadow'), src.indexOf('SHADOWMAP_TYPE_VSM'));
    expect(fn).not.toContain('* 0.2;');
    expect(fn).toContain('return mix( 1.0, shadow, shadowIntensity );');
    // zweiter Aufruf ändert nichts mehr
    expect(installGaussianShadows()).toBe(true);
    expect(ShaderChunk.shadowmap_pars_fragment).toBe(src);
  });

  it('Gewichte der beiden Kerne summieren sich zu 1', () => {
    expect(0.375 + 2 * 0.3125).toBeCloseTo(1, 6);
    expect(0.40264 + 2 * 0.24421 + 2 * 0.05448).toBeCloseTo(1, 3);
  });

  it('hält die Weichheit in Metern über die Qualitätsstufen ähnlich', () => {
    const low = shadowBlurRadius(0.1, 70, 1024);
    const mid = shadowBlurRadius(0.1, 70, 2048);
    const high = shadowBlurRadius(0.1, 70, 4096);
    expect(low).toBeCloseTo(0.8, 5);
    expect(mid).toBeGreaterThan(1.1);
    expect(mid).toBeLessThanOrEqual(1.5);
    expect(high).toBeGreaterThan(1.5);
    expect(high).toBeLessThanOrEqual(2);
  });

  it('kennzeichnet den Sonnenschatten für scharfe Kontaktschatten', () => {
    expect(sunShadowRadius(0.1, 70, 2048)).toBeCloseTo(100 + shadowBlurRadius(0.1, 70, 2048), 6);
    installGaussianShadows();
    const src = ShaderChunk.shadowmap_pars_fragment;
    expect(src).toContain('float gaussShadow(');
    expect(src).toContain('float tightShadow(');
    // die Hilfsfunktionen stehen vor der Schattenfunktion, die sie aufruft
    expect(src.indexOf('float gaussShadow(')).toBeLessThan(src.indexOf('float getShadow( sampler2DShadow'));
  });
});
