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

  it('Gelände ist natürlich geneigt: überwiegend sanft, Steilwände bleiben die Ausnahme', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      const planet = sys.planets.find((p) => p.isStart)!;
      const m = new TerrainModel(planet);
      const slopes: number[] = [];
      const half = m.size / 2;
      const n = 70;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = -half + ((i + 0.37) / n) * m.size;
          const z = -half + ((j + 0.61) / n) * m.size;
          if (m.isWaterAt(x, z)) continue;
          const gx = (m.heightAt(x + 3, z) - m.heightAt(x - 3, z)) / 6;
          const gz = (m.heightAt(x, z + 3) - m.heightAt(x, z - 3)) / 6;
          slopes.push((Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI);
        }
      }
      slopes.sort((a, b) => a - b);
      const median = slopes[Math.floor(slopes.length / 2)]!;
      const steep = slopes.filter((s) => s > 40).length / slopes.length;
      expect(median, `${seed}: Median der Hangneigung`).toBeLessThan(15);
      expect(steep, `${seed}: Anteil über 40°`).toBeLessThan(0.12);
    }
  });

  it('Höhenfeld ist stetig (keine Sprünge an Biomgrenzen)', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      for (const planet of sys.planets.filter((p) => p.type !== 'gas_giant').slice(0, 3)) {
        const m = new TerrainModel(planet);
        for (let i = 0; i < 1500; i++) {
          const x = ((i * 311.7) % m.size) - m.size / 2;
          const z = ((i * 173.9) % m.size) - m.size / 2;
          expect(Math.abs(m.heightAt(x + 0.05, z + 0.05) - m.heightAt(x, z)), `${seed}/${planet.id} bei ${x.toFixed(0)}/${z.toFixed(0)}`).toBeLessThan(1.5);
        }
      }
    }
  });

  it('relative Höhenlage deckt das Höhenband jedes Bioms ab (seltene Arten bleiben auffindbar)', () => {
    for (const seed of SEEDS) {
      const sys = generateStarSystem(seed);
      for (const planet of sys.planets.filter((p) => p.type !== 'gas_giant').slice(0, 3)) {
        const m = new TerrainModel(planet);
        const lo = planet.biomes.map(() => 1);
        const hi = planet.biomes.map(() => 0);
        const count = planet.biomes.map(() => 0);
        const half = m.size / 2;
        for (let z = -half; z < half; z += 90) {
          for (let x = -half; x < half; x += 90) {
            // wie im Spiel: es zählt das dominante Biom, Übergangszonen eingeschlossen
            const s = m.sample(x, z);
            count[s.biome]!++;
            lo[s.biome] = Math.min(lo[s.biome]!, s.altitude);
            hi[s.biome] = Math.max(hi[s.biome]!, s.altitude);
          }
        }
        planet.biomes.forEach((b, i) => {
          if (count[i]! < 60) return;
          const width = b.altitude[1] - b.altitude[0];
          // engstes Höhenfenster einer Art: 45 % des Bands (legendär) – 35 % Abstand zum Rand reichen sicher
          expect(lo[i]!, `${seed}/${planet.id}/${b.kind}: untere Lagen`).toBeLessThanOrEqual(b.altitude[0] + width * 0.35);
          expect(hi[i]!, `${seed}/${planet.id}/${b.kind}: obere Lagen`).toBeGreaterThanOrEqual(b.altitude[1] - width * 0.35);
        });
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
