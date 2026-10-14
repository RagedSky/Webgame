import { describe, expect, it } from 'vitest';
import { generateStarSystem } from '@/gen/universe/System';
import { correctMix } from '@/gen/universe/Fuel';
import { analysisCost, analysisReport, batchCost, synthesize } from './fuel';

describe('Treibstoff-Synthese', () => {
  it('korrekte Mischung liefert stabilen Treibstoff, Ausbeute steigt mit Labor-Stufe', () => {
    for (const seed of ['FUEL-1', 'FUEL-2', 'FUEL-3']) {
      const sys = generateStarSystem(seed);
      const mix = correctMix(sys.fuelFormula);
      const r0 = synthesize(sys.fuelFormula, mix, 1, 0);
      const r2 = synthesize(sys.fuelFormula, mix, 1, 2);
      expect(r0.stable).toBe(true);
      expect(r0.fuelProduced).toBeGreaterThanOrEqual(4);
      expect(r2.fuelProduced).toBeGreaterThan(r0.fuelProduced);
      const cost = batchCost(mix, 2);
      for (const c of sys.fuelFormula.components) expect(cost[c.resourceId]).toBe(c.parts * 2);
      expect(Object.values(analysisCost(mix)).every((v) => v === 1)).toBe(true);
    }
  });

  it('falsche Mischung ist instabil und verpufft; Bericht wird mit Stufe detaillierter', () => {
    const sys = generateStarSystem('FUEL-4');
    const first = sys.fuelFormula.components[0]!.resourceId;
    const wrong = { parts: { [first]: 10 } };
    const r = synthesize(sys.fuelFormula, wrong, 1, 0);
    expect(r.stable).toBe(false);
    expect(r.fuelProduced).toBe(0);
    expect(analysisReport(sys.fuelFormula, wrong, r.analysis, 0).length).toBe(0);
    expect(analysisReport(sys.fuelFormula, wrong, r.analysis, 2).length).toBeGreaterThan(0);
  });
});
