import { describe, expect, it } from 'vitest';
import type { Moon } from '@/gen/universe/types';
import { moonTextureData } from './MoonTexture';

const moon: Moon = { id: 'p1-m1', name: 'Test', radiusKm: 900, orbitRadiusKm: 120000, orbitPeriodDays: 9, color: '#c9b89a' };

describe('MoonTexture', () => {
  it('ist deterministisch und füllt alle Pixel deckend', () => {
    const a = moonTextureData(moon, 64, 32);
    const b = moonTextureData(moon, 64, 32);
    expect(a).toHaveLength(64 * 32 * 4);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });

  it('zeigt Struktur (Krater und Ebenen) statt einer Einheitsfläche', () => {
    const data = moonTextureData(moon, 64, 32);
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      min = Math.min(min, data[i]!);
      max = Math.max(max, data[i]!);
    }
    expect(max - min).toBeGreaterThan(50);
  });

  it('unterscheidet sich je Mond', () => {
    const other = moonTextureData({ ...moon, id: 'p1-m2' }, 64, 32);
    expect(Array.from(other)).not.toEqual(Array.from(moonTextureData(moon, 64, 32)));
  });
});
