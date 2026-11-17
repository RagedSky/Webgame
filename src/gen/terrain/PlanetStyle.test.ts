import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import { hexToHsl, hslToHex, planetStyle } from './PlanetStyle';

describe('PlanetStyle', () => {
  const system = generateUniverse('STIL-1');
  const planets = system.planets.filter((p) => p.type !== 'gas_giant');

  it('ist deterministisch und liefert je Biom gültige Zweitfarben', () => {
    for (const planet of planets) {
      const a = planetStyle(planet);
      const b = planetStyle(planet);
      expect(a.biomes).toEqual(b.biomes);
      expect(a.grassTip).toEqual(b.grassTip);
      expect(a.grassTip).toMatch(/^#[0-9a-f]{6}$/);
      expect(a.landmarks).toEqual(b.landmarks);
      expect(a.biomes).toHaveLength(planet.biomes.length);
      for (const s of a.biomes) for (const hex of [s.vegetation2, s.ground2, s.strata]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('verschiebt die zweite Bewuchsfarbe sichtbar im Farbton', () => {
    for (const planet of planets) {
      const style = planetStyle(planet);
      planet.biomes.forEach((biome, i) => {
        const [h1, s1] = hexToHsl(biome.palette.vegetation);
        const [h2] = hexToHsl(style.biomes[i]!.vegetation2);
        if (s1 < 0.08) return; // graue Paletten haben keinen belastbaren Farbton
        const d = Math.abs(h1 - h2);
        expect(Math.min(d, 1 - d)).toBeGreaterThan(0.05);
      });
    }
  });

  it('Zonen liegen in 0..1, sind ortsstabil und decken beide Farben ab', () => {
    const style = planetStyle(planets[0]!);
    let low = 0;
    let high = 0;
    for (let i = 0; i < 400; i++) {
      const x = (i % 20) * 97 - 900;
      const z = Math.floor(i / 20) * 113 - 1100;
      for (const v of [style.vegZone(x, z), style.groundZone(x, z), style.groveZone(x, z)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(style.vegZone(x, z)).toBe(style.vegZone(x, z));
      if (style.vegZone(x, z) < 0.2) low++;
      if (style.vegZone(x, z) > 0.8) high++;
    }
    expect(low).toBeGreaterThan(40);
    expect(high).toBeGreaterThan(40);
  });

  it('Signaturpflanzen sind deutlich größer als normale Flora', () => {
    for (const planet of planets) {
      const style = planetStyle(planet);
      expect(style.landmarks.length).toBeGreaterThanOrEqual(1);
      expect(Math.max(...style.landmarks.map((l) => l.genome.heightM))).toBeGreaterThanOrEqual(11);
      for (const l of style.landmarks) {
        expect(l.genome.leafHue).toBeGreaterThanOrEqual(0);
        expect(l.genome.leafHue).toBeLessThan(360);
        expect(l.perCell).toBeGreaterThan(0);
      }
    }
  });

  it('HSL-Umrechnung ist umkehrbar', () => {
    for (const hex of ['#3a7f4c', '#c9b89a', '#102030', '#ff8000', '#808080']) {
      const [h, s, l] = hexToHsl(hex);
      expect(hslToHex(h, s, l)).toBe(hex);
    }
  });
});
