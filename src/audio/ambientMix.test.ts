import { describe, expect, it } from 'vitest';
import { ambientMixFor, footSurfaceFor, type AmbientInput } from './ambientMix';

const base: AmbientInput = { biomeKind: 'steppe', biomeHasWater: false, isCave: false, humidity: 0.4, daylight: 1, wind: 0.3, precipitation: 'none', precipIntensity: 0, underwater: false, nearWater: false, breathable: true };

describe('ambientMixFor', () => {
  it('Nacht im Dschungel bringt Nachtleben, Wüste am Tag kaum', () => {
    const jungleNight = ambientMixFor({ ...base, biomeKind: 'fern_forest', humidity: 0.9, daylight: 0 });
    const desertDay = ambientMixFor({ ...base, biomeKind: 'dune_sea', humidity: 0.05, daylight: 1 });
    expect(jungleNight.insects).toBeGreaterThan(0.6);
    expect(desertDay.insects).toBeLessThan(0.15);
    expect(desertDay.wind).toBeGreaterThan(jungleNight.wind);
  });

  it('Wasser, Regen, Höhle und Lava setzen die passenden Schichten', () => {
    const under = ambientMixFor({ ...base, biomeKind: 'shallow_sea', biomeHasWater: true, underwater: true });
    expect(under.water).toBeGreaterThan(0.8);
    expect(under.wind).toBe(0);
    const rain = ambientMixFor({ ...base, precipitation: 'rain', precipIntensity: 1 });
    expect(rain.rain).toBe(1);
    const cave = ambientMixFor({ ...base, biomeKind: 'lava_tubes', isCave: true });
    expect(cave.drone).toBeGreaterThan(0.5);
    expect(cave.lava).toBeGreaterThan(0);
    for (const v of Object.values(rain)) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of Object.values(rain)) expect(v).toBeLessThanOrEqual(1);
  });

  it('ordnet Biomen einen Schritt-Untergrund zu', () => {
    expect(footSurfaceFor('glacier', false)).toBe('snow');
    expect(footSurfaceFor('dune_sea', false)).toBe('sand');
    expect(footSurfaceFor('fern_forest', false)).toBe('grass');
    expect(footSurfaceFor('lava_fields', false)).toBe('rock');
    expect(footSurfaceFor('lava_fields', true)).toBe('water');
  });
});
