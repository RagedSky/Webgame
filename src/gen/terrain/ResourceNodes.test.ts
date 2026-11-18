import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import { TerrainModel } from './TerrainModel';
import { COMMON_RESOURCES, NODE_CELL, STARTER_NODES, STARTER_RING, generateResourceNodes, generateStarterNodes } from './ResourceNodes';
import type { Planet } from '../universe/types';

function startPlanet(seed: string): Planet {
  const u = generateUniverse(seed) as unknown as { system?: { planets: Planet[]; startPlanetId: string }; planets?: Planet[]; startPlanetId?: string };
  const sys = u.system ?? (u as { planets: Planet[]; startPlanetId: string });
  return sys.planets.find((p) => p.id === sys.startPlanetId) ?? (sys.planets[0] as Planet);
}

describe('Rohstoffknoten', () => {
  for (const seed of ['ARCHIV-1', 'TEST-7', 'NOVA-3']) {
    const planet = startPlanet(seed);
    const model = new TerrainModel(planet);
    const spawn = model.findSpawn();

    it(`${seed}: garantierte Grundrohstoffe liegen im Ring um den Landeplatz`, () => {
      const starters = generateStarterNodes(model, planet, spawn);
      for (const [id, count] of STARTER_NODES) {
        const has = planet.resources.some((d) => d.resourceId === id);
        const found = starters.filter((n) => n.resourceId === id);
        if (has) expect(found.length).toBeGreaterThanOrEqual(Math.min(count, 2));
        else expect(found.length).toBe(0);
        for (const n of found) {
          const d = Math.hypot(n.x - spawn.x, n.z - spawn.z);
          expect(d).toBeGreaterThanOrEqual(STARTER_RING[0] - 1e-6);
          expect(d).toBeLessThanOrEqual(STARTER_RING[1] + 1e-6);
          if (model.hasWater) expect(n.y).toBeGreaterThan(model.seaLevel);
        }
      }
      // gleiche Eingabe, gleiches Ergebnis
      expect(generateStarterNodes(model, planet, spawn)).toEqual(starters);
    });

    it(`${seed}: Grundrohstoffe sind die häufigsten Knoten rund um den Start`, () => {
      const counts = new Map<string, number>();
      const ci = Math.floor(spawn.x / NODE_CELL);
      const cj = Math.floor(spawn.z / NODE_CELL);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) for (const n of generateResourceNodes(model, planet, ci + i, cj + j)) counts.set(n.resourceId, (counts.get(n.resourceId) ?? 0) + 1);
      for (const id of COMMON_RESOURCES) {
        if (!planet.resources.some((d) => d.resourceId === id)) continue;
        // 49 Zellen von 128 m: im Mittel mehr als ein Knoten je Zelle
        expect(counts.get(id) ?? 0).toBeGreaterThan(49);
      }
    });
  }
});
