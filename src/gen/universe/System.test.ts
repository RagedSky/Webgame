import { describe, expect, it } from 'vitest';
import { generateStarSystem, layoutOrbits } from './System';
import { Random } from '@/math/Random';
import { analyzeMix, correctMix } from './Fuel';
import { LAUNCH_RESOURCES, PLANET_TYPES, RESOURCES, STAR_TYPES } from './catalog';
import type { StarType } from './types';

const SEEDS = Array.from({ length: 150 }, (_, i) => `SYS-TEST-${i}`);

describe('generateStarSystem', () => {
  it('ist deterministisch (gleicher Seed → identisches JSON)', () => {
    for (const seed of ['ARCHIV-1', 'hello world', 'Ω-42']) {
      const a = JSON.stringify(generateStarSystem(seed));
      const b = JSON.stringify(generateStarSystem(seed));
      expect(a).toBe(b);
    }
  });

  it('unterscheidet sich zwischen Seeds', () => {
    const a = generateStarSystem('seed-a');
    const b = generateStarSystem('seed-b');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('hat 3–10 Planeten, aufsteigende Orbits und plausible Werte', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      expect(sys.planets.length).toBeGreaterThanOrEqual(3);
      expect(sys.planets.length).toBeLessThanOrEqual(10);
      expect(sys.entryBudget).toBeGreaterThanOrEqual(400);
      expect(sys.entryBudget).toBeLessThanOrEqual(600);
      let prev = 0;
      const ids = new Set<string>();
      for (const p of sys.planets) {
        expect(p.orbitRadiusAu).toBeGreaterThan(prev);
        prev = p.orbitRadiusAu;
        expect(ids.has(p.id)).toBe(false);
        ids.add(p.id);
        expect(p.radiusKm).toBeGreaterThan(1000);
        expect(p.gravity).toBeGreaterThan(0.1);
        expect(p.gravity).toBeLessThan(3.5);
        expect(p.temperature.min).toBeLessThan(p.temperature.max);
        expect(Number.isFinite(p.temperature.mean)).toBe(true);
        expect(p.temperature.mean).toBeGreaterThanOrEqual(40);
        expect(p.temperature.mean).toBeLessThan(1500);
        expect(p.dayLengthHours).toBeGreaterThan(0);
        expect(p.biomes.length).toBeGreaterThan(0);
        expect(p.weather.length).toBeGreaterThan(0);
        expect(p.resources.length).toBeGreaterThan(0);
        expect(p.biodiversity).toBeGreaterThanOrEqual(0);
        expect(p.biodiversity).toBeLessThanOrEqual(1);
        const cov = p.biomes.reduce((a, b) => a + b.coverage, 0);
        expect(Math.abs(cov - 1)).toBeLessThan(0.02);
        const comp = Object.values(p.atmosphere.composition).reduce((a, b) => a + b, 0);
        if (p.atmosphere.pressure > 0) expect(Math.abs(comp - 1)).toBeLessThan(0.01);
        for (const d of p.resources) {
          expect(d.biomeIds.length).toBeGreaterThan(0);
          for (const bid of d.biomeIds) expect(p.biomes.some((b) => b.id === bid)).toBe(true);
        }
        if (PLANET_TYPES[p.type].gasGiant) expect(p.requirements.engineTier).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('garantiert einen lebensfreundlichen Startplaneten mit allen Start-Rohstoffen', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      const start = sys.planets.find((p) => p.id === sys.startPlanetId);
      expect(start).toBeDefined();
      if (!start) continue;
      expect(start.isStart).toBe(true);
      expect(sys.planets.filter((p) => p.isStart).length).toBe(1);
      expect(PLANET_TYPES[start.type].lifeFriendly).toBe(true);
      expect(start.atmosphere.breathable).toBe(true);
      expect(start.temperature.mean).toBeGreaterThanOrEqual(270);
      expect(start.temperature.mean).toBeLessThanOrEqual(305);
      expect(start.orbitRadiusAu).toBeGreaterThanOrEqual(sys.star.habitableZoneAu[0] - 0.001);
      expect(start.orbitRadiusAu).toBeLessThanOrEqual(sys.star.habitableZoneAu[1] + 0.001);
      expect(start.requirements).toEqual({ engineTier: 1, shieldTier: 0 });
      expect(start.hazards).not.toContain('radiation');
      expect(start.hazards).not.toContain('heat');
      expect(start.hazards).not.toContain('toxic_atmosphere');
      expect(start.biodiversity).toBeGreaterThanOrEqual(0.6);
      const have = new Set(start.resources.map((r) => r.resourceId));
      for (const r of LAUNCH_RESOURCES) expect(have.has(r)).toBe(true);
      const roles = { energy: 0, oxidizer: 0, stabilizer: 0 };
      for (const r of have) {
        const role = RESOURCES[r].fuelRole;
        if (role) roles[role]++;
      }
      expect(roles.energy).toBeGreaterThanOrEqual(2);
      expect(roles.oxidizer).toBeGreaterThanOrEqual(2);
      expect(roles.stabilizer).toBeGreaterThanOrEqual(2);
    }
  });

  it('Treibstoff-Formel ist auf dem Startplaneten herstellbar und analysierbar', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      const start = sys.planets.find((p) => p.id === sys.startPlanetId)!;
      const have = new Set(start.resources.map((r) => r.resourceId));
      const f = sys.fuelFormula;
      expect(f.components.length).toBeGreaterThanOrEqual(2);
      expect(f.components.length).toBeLessThanOrEqual(3);
      expect(f.components.reduce((a, c) => a + c.parts, 0)).toBe(10);
      for (const c of f.components) {
        expect(have.has(c.resourceId)).toBe(true);
        expect(RESOURCES[c.resourceId].fuelRole).toBe(c.role);
        expect(c.parts).toBeGreaterThan(0);
      }
      const ok = analyzeMix(f, correctMix(f));
      expect(ok.purity).toBeGreaterThanOrEqual(0.99);
      expect(ok.energyDensity).toBeGreaterThanOrEqual(0.99);
      expect(ok.stability).toBeGreaterThanOrEqual(0.99);
      expect(ok.quality).toBeGreaterThanOrEqual(0.99);
      // Falsche Mischung ist messbar schlechter
      const wrong = analyzeMix(f, { parts: { [f.components[0]!.resourceId]: 10 } });
      expect(wrong.quality).toBeLessThan(0.6);
    }
  });

  it('erzeugt alle drei Sonnentypen mit passenden Lebenszonen', () => {
    for (const type of ['yellow', 'red_giant', 'blue_dwarf'] as StarType[]) {
      const sys = generateStarSystem(`star-${type}`, { starType: type });
      expect(sys.star.type).toBe(type);
      expect(sys.star.habitableZoneAu[0]).toBeLessThan(sys.star.habitableZoneAu[1]);
      const start = sys.planets.find((p) => p.isStart)!;
      expect(start.atmosphere.breathable).toBe(true);
    }
    const types = new Set(SEEDS.map((s) => generateStarSystem(s).star.type));
    expect(types.size).toBe(3);
    expect(Object.keys(STAR_TYPES).length).toBe(3);
  });

  it('layoutOrbits liefert monotone Orbits mit Lebenszonen-Treffer', () => {
    const sys = generateStarSystem('orbits');
    for (let count = 3; count <= 10; count++) {
      const { orbits, hzIndex } = layoutOrbits(new Random(`o-${count}`), sys.star, count);
      expect(orbits.length).toBe(count);
      for (let i = 1; i < count; i++) expect(orbits[i]!).toBeGreaterThan(orbits[i - 1]!);
      expect(orbits[hzIndex]!).toBeGreaterThanOrEqual(sys.star.habitableZoneAu[0] - 0.001);
      expect(orbits[hzIndex]!).toBeLessThanOrEqual(sys.star.habitableZoneAu[1] + 0.001);
    }
  });
});
