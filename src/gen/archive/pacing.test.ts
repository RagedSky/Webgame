import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import { estimatePlaytime } from './pacing';

const SEEDS = ['ARCHIV-1', 'NOVA-7', 'KEPLER', 'ZETA-99', 'ORION-3', 'HELIX-12', 'TAU-CETI', 'VEGA'];

describe('Pacing-Modell', () => {
  it('schätzt 50–80 Stunden bis zur Versiegelung (80 %) für typische Seeds', () => {
    const results = SEEDS.map((seed) => ({ seed, est: estimatePlaytime(generateUniverse(seed)) }));
    for (const { seed, est } of results) {
      expect(est.hours, `${seed}: ${est.hours.toFixed(1)} h (${est.entries} Einträge, ${est.planetsVisited} Planeten)`).toBeGreaterThanOrEqual(50);
      expect(est.hours, `${seed}: ${est.hours.toFixed(1)} h`).toBeLessThanOrEqual(80);
      expect(est.hoursComplete).toBeGreaterThan(est.hours * 1.3); // die letzten 20 % sind deutlich teurer (Komplettisten)
      expect(est.entryShare).toBeGreaterThan(0.6);
    }
  });
});
