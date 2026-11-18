import { describe, expect, it } from 'vitest';
import { Color, PerspectiveCamera } from 'three';
import { GLOW_MAX, GlowField, glow, glowSource } from './glow';

const white = new Color(1, 1, 1);

describe('GlowField', () => {
  it('wählt die nächsten Quellen in Reichweite', () => {
    const f = new GlowField();
    f.set('a', [glowSource(5, 0, 0, 4, white, 1), glowSource(200, 0, 0, 4, white, 1), glowSource(2, 0, 0, 4, white, 1)]);
    expect(f.pick(0, 0, 0)).toBe(2);
    expect(f.size).toBe(3);
  });

  it('begrenzt auf GLOW_MAX und blendet zur Auswahlgrenze aus', () => {
    const f = new GlowField();
    f.set('a', Array.from({ length: 20 }, (_, i) => glowSource(2 + i * 2, 0, 0, 4, white, 1)));
    expect(f.pick(0, 0, 0)).toBe(GLOW_MAX);
    // die erste nicht gewählte Quelle liegt bei 14 m: dort ist die Stärke 0, nah an der Kamera 1
    expect(f.fade(14)).toBeCloseTo(0, 5);
    expect(f.fade(2)).toBeCloseTo(1, 5);
    expect(f.fade(12)).toBeGreaterThan(0);
    expect(f.fade(12)).toBeLessThan(1);
  });

  it('schreibt Position im Kameraraum und Farbe mal Nachtanteil', () => {
    const f = new GlowField();
    const cam = new PerspectiveCamera();
    cam.position.set(0, 0, 10);
    f.set('a', [glowSource(0, 0, 0, 5, new Color(1, 0.5, 0.25), 2)]);
    f.update(cam, 0.5);
    expect(glow.lightCount.value).toBe(1);
    const p = glow.lightPos.value[0]!;
    expect(p.z).toBeCloseTo(-10, 5);
    expect(p.w).toBe(5);
    expect(glow.lightColor.value[0]!.r).toBeCloseTo(1, 5);
    expect(glow.lightColor.value[0]!.g).toBeCloseTo(0.5, 5);
    // am Tag wirkt nichts
    f.update(cam, 0);
    expect(glow.lightCount.value).toBe(0);
  });

  it('entfernt Gruppen wieder', () => {
    const f = new GlowField();
    f.set('a', [glowSource(1, 0, 0, 4, white, 1)]);
    f.set('b', [glowSource(2, 0, 0, 4, white, 1)]);
    f.remove('a');
    expect(f.pick(0, 0, 0)).toBe(1);
    f.set('b', []);
    expect(f.pick(0, 0, 0)).toBe(0);
  });
});
