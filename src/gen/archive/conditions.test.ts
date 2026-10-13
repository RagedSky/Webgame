import { describe, expect, it } from 'vitest';
import { generateUniverse } from '../index';
import { matchesPlacement, matchesSpawn, pointTemperature, timeMatches, type SpawnContext } from './conditions';

function ctxFor(entry: ReturnType<typeof generateUniverse>['entries'][number], over: Partial<SpawnContext> = {}): SpawnContext {
  const s = entry.spawn;
  return {
    timeOfDay: s.timeOfDay === 'any' ? 'day' : s.timeOfDay,
    weather: s.weather === 'any' ? 'clear' : s.weather[0]!,
    altitude: (s.altitude[0] + s.altitude[1]) / 2,
    temperature: (s.temperature[0] + s.temperature[1]) / 2,
    biomeId: entry.biomeIds[0]!,
    inCave: s.special === 'cave',
    underwater: s.special === 'underwater' || s.special === 'deep_sea',
    deepSea: s.special === 'deep_sea',
    afterStorm: s.special === 'after_storm',
    solstice: s.special === 'solstice',
    eclipse: s.special === 'eclipse',
    ...over,
  };
}

describe('Spawn-Bedingungen (Laufzeit)', () => {
  it('jeder Eintrag matcht seinen eigenen Idealzustand', () => {
    const sys = generateUniverse('COND-1');
    for (const e of sys.entries) {
      if (e.spawn.special === 'atmosphere_probe' || e.spawn.special === 'orbit') continue;
      const ctx = ctxFor(e);
      if (e.spawn.weather !== 'any' && !sys.planets.find((p) => p.id === e.planetId)!.weather.includes(ctx.weather)) continue;
      expect(matchesSpawn(e, ctx), `${e.id} ${JSON.stringify(e.spawn)}`).toBe(true);
    }
  });

  it('weist falsche Zeit, falsches Wetter und falsches Biom ab', () => {
    const sys = generateUniverse('COND-2');
    const night = sys.entries.find((e) => e.spawn.timeOfDay === 'night' && e.spawn.weather === 'any' && !e.spawn.special)!;
    expect(matchesSpawn(night, ctxFor(night, { timeOfDay: 'day' }))).toBe(false);
    expect(matchesSpawn(night, ctxFor(night, { timeOfDay: 'dusk' }))).toBe(true);
    const wx = sys.entries.find((e) => e.spawn.weather !== 'any' && !e.spawn.special)!;
    const other = sys.planets.find((p) => p.id === wx.planetId)!.weather.find((w) => !(wx.spawn.weather as string[]).includes(w));
    if (other) expect(matchesSpawn(wx, ctxFor(wx, { weather: other }))).toBe(false);
    const any = sys.entries.find((e) => e.spawn.timeOfDay === 'any' && e.spawn.weather === 'any' && !e.spawn.special)!;
    expect(matchesSpawn(any, ctxFor(any, { biomeId: 'nope' }))).toBe(false);
    expect(matchesSpawn(any, ctxFor(any, { altitude: 2 }))).toBe(false);
    expect(matchesSpawn(any, ctxFor(any, { temperature: 9999 }))).toBe(false);
    expect(timeMatches('any', 'night')).toBe(true);
    expect(timeMatches('dawn', 'day')).toBe(false);
  });

  it('Spezialbedingungen brauchen den passenden Kontext', () => {
    const sys = generateUniverse('COND-3');
    const cave = sys.entries.find((e) => e.spawn.special === 'cave');
    if (cave) {
      expect(matchesSpawn(cave, ctxFor(cave, { inCave: false }))).toBe(false);
      expect(matchesSpawn(cave, ctxFor(cave, { inCave: true }))).toBe(true);
    }
    const storm = sys.entries.find((e) => e.spawn.special === 'after_storm');
    if (storm) expect(matchesSpawn(storm, ctxFor(storm, { afterStorm: false }))).toBe(false);
  });

  it('Punkt-Temperatur bleibt im Planetenbereich', () => {
    const sys = generateUniverse('COND-4');
    for (const p of sys.planets) {
      for (const b of p.biomes) {
        for (const d of [0, 0.5, 1]) {
          const t = pointTemperature(p, b, 0.5, d);
          expect(t).toBeGreaterThanOrEqual(p.temperature.min);
          expect(t).toBeLessThanOrEqual(p.temperature.max);
        }
      }
    }
  });

  it('Flora-Platzierung: Wasserpflanzen nur unter Wasser, Rest nur darüber', () => {
    const sys = generateUniverse('COND-5');
    const aquatic = sys.entries.find((e) => e.category === 'flora' && e.subcategory === 'aquatic');
    const land = sys.entries.find((e) => e.category === 'flora' && e.subcategory !== 'aquatic' && !e.spawn.special)!;
    const planet = sys.planets.find((p) => p.id === land.planetId)!;
    const biome = planet.biomes.find((b) => b.id === land.biomeIds[0])!;
    const alt = (land.spawn.altitude[0] + land.spawn.altitude[1]) / 2;
    expect(matchesPlacement(land, biome, alt, false)).toBe(true);
    expect(matchesPlacement(land, biome, alt, true)).toBe(false);
    if (aquatic) {
      const ap = sys.planets.find((p) => p.id === aquatic.planetId)!;
      const ab = ap.biomes.find((b) => b.id === aquatic.biomeIds[0])!;
      const aalt = (aquatic.spawn.altitude[0] + aquatic.spawn.altitude[1]) / 2;
      expect(matchesPlacement(aquatic, ab, aalt, true)).toBe(true);
      expect(matchesPlacement(aquatic, ab, aalt, false)).toBe(false);
    }
  });
});
