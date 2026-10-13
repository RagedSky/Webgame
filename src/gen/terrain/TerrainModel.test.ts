import { describe, expect, it } from 'vitest';
import { generateStarSystem } from '../universe/System';
import { TerrainModel } from './TerrainModel';
import { VEGETATION_PROFILES } from './VegetationProfiles';
import { BIOMES } from '../universe/catalog';

const SEEDS = ['TERRAIN-1', 'TERRAIN-2', 'TERRAIN-3', 'ARCHIV-1', 'BLUE-7'];

describe('TerrainModel', () => {
  it('ist deterministisch und bleibt im Höhenbereich', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      const planet = sys.planets.find((p) => p.isStart)!;
      const a = new TerrainModel(planet);
      const b = new TerrainModel(planet);
      for (let i = 0; i < 200; i++) {
        const x = (i * 173.3) % 4000 - 2000;
        const z = (i * 97.7) % 4000 - 2000;
        const ha = a.heightAt(x, z);
        expect(ha).toBe(b.heightAt(x, z));
        expect(ha).toBeGreaterThanOrEqual(-1);
        expect(ha).toBeLessThanOrEqual(a.maxHeight + 1);
        const s = a.sample(x, z);
        expect(s.biome).toBeGreaterThanOrEqual(0);
        expect(s.biome).toBeLessThan(planet.biomes.length);
        expect(s.altitude).toBeGreaterThanOrEqual(0);
        expect(s.altitude).toBeLessThanOrEqual(1);
      }
    }
  });

  it('alle Biome des Planeten kommen auf der Karte vor', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      for (const planet of sys.planets.filter((p) => p.type !== 'gas_giant').slice(0, 3)) {
        const m = new TerrainModel(planet);
        const seen = new Set<number>();
        const half = m.size / 2;
        for (let z = -half; z < half; z += 150) for (let x = -half; x < half; x += 150) seen.add(m.sample(x, z).biome);
        for (let i = 0; i < planet.biomes.length; i++) expect(seen.has(i), `${seed}/${planet.id}: Biom ${planet.biomes[i]!.kind} fehlt`).toBe(true);
      }
    }
  });

  it('Wasser nur in Wasser-Biomen; Spawn an Land und flach', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      for (const planet of sys.planets.filter((p) => p.type !== 'gas_giant')) {
        const m = new TerrainModel(planet);
        const spawn = m.findSpawn();
        expect(Number.isFinite(spawn.y)).toBe(true);
        if (m.hasWater) expect(spawn.y).toBeGreaterThan(m.seaLevel);
        expect(m.slopeAt(spawn.x, spawn.z, 2)).toBeLessThanOrEqual(0.5);
        if (!m.hasWater) expect(m.isWaterAt(spawn.x, spawn.z)).toBe(false);
        // Stichprobe: Unterwasserpunkte liegen in hasWater-Biomen (ggf. im Übergang)
        for (let i = 0; i < 300; i++) {
          const x = ((i * 311.7) % m.size) - m.size / 2;
          const z = ((i * 173.9) % m.size) - m.size / 2;
          const s = m.sample(x, z);
          if (m.hasWater && s.height < m.seaLevel - 3) {
            const b1 = planet.biomes[s.biome]!;
            const b2 = planet.biomes[s.biome2]!;
            expect(b1.hasWater || b2.hasWater).toBe(true);
          }
        }
      }
    }
  });

  it('hat ein Vegetationsprofil für jedes Biom', () => {
    for (const kind of Object.keys(BIOMES) as Array<keyof typeof BIOMES>) {
      const p = VEGETATION_PROFILES[kind];
      expect(p).toBeDefined();
      expect(p.grass).toBeGreaterThanOrEqual(0);
      expect(p.scale).toBeGreaterThan(0);
    }
  });
});
