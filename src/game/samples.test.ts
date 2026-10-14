import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import { analyzeMineralSample, createSample, microCellsForSample } from './samples';

describe('Proben', () => {
  it('Mikroorganismen einer Probe sind deterministisch und passen zu Biom und Quelle', () => {
    const sys = generateUniverse('SAMPLE-1');
    const planet = sys.planets.find((p) => p.isStart)!;
    let found = 0;
    for (const biome of planet.biomes) {
      for (const source of ['water', 'soil', 'rock', 'plant'] as const) {
        const s = createSample(source, planet, biome, 10, 1);
        const a = microCellsForSample(s, sys.entries);
        const b = microCellsForSample(s, sys.entries);
        expect(a.map((c) => c.entry.id)).toEqual(b.map((c) => c.entry.id));
        for (const c of a) {
          expect(c.genome.sampleSource).toBe(source);
          expect(c.entry.biomeIds).toContain(biome.id);
          expect(c.depth).toBeGreaterThanOrEqual(0);
          expect(c.depth).toBeLessThanOrEqual(1);
        }
        found += a.length;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('Mineralanalyse liefert Werte in 0..1', () => {
    const sys = generateUniverse('SAMPLE-2');
    const planet = sys.planets.find((p) => p.isStart)!;
    const ore = sys.entries.find((e) => e.category === 'ore' && e.planetId === planet.id)!;
    const s = createSample('rock', planet, planet.biomes[0]!, 5, 2, ore);
    const a = analyzeMineralSample(s);
    expect(a.quality).toBeGreaterThan(0);
    expect(a.quality).toBeLessThanOrEqual(1);
    expect(analyzeMineralSample(s).quality).toBe(a.quality);
    expect(s.entryId).toBe(ore.id);
    expect(s.label).toContain(ore.name);
  });
});
