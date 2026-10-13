import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import type { FloraForm, FloraGenome } from '@/gen/archive/types';
import { buildFloraGeometry } from './FloraBuilder';

describe('FloraBuilder', () => {
  it('erzeugt für jede Wuchsform eine gültige Geometrie mit Farben', () => {
    const forms: FloraForm[] = ['tree', 'shrub', 'grass', 'fungus', 'aquatic', 'succulent', 'lichen', 'vine', 'crystal_plant'];
    for (const form of forms) {
      const genome: FloraGenome = { kind: 'flora', form, heightM: form === 'tree' ? 12 : form === 'lichen' ? 0.1 : 1.2, trunkHue: 30, leafHue: 110, flowerHue: 320, leafShape: 'broad', branching: 0.6, density: 0.7, glow: 0.2, bloomTime: 'day' };
      const g = buildFloraGeometry(genome, `test-${form}`);
      const pos = g.getAttribute('position');
      expect(pos.count).toBeGreaterThan(3);
      expect(pos.count).toBeLessThan(6000);
      expect(g.getAttribute('color')).toBeDefined();
      for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite((pos.array as Float32Array)[i])).toBe(true);
      g.dispose();
    }
  });

  it('baut alle Flora-Einträge eines Systems', () => {
    const sys = generateUniverse('FLORA-1');
    const flora = sys.entries.filter((e) => e.genome.kind === 'flora');
    expect(flora.length).toBeGreaterThan(20);
    let verts = 0;
    for (const e of flora) {
      const g = buildFloraGeometry(e.genome as FloraGenome, e.id);
      verts += g.getAttribute('position').count;
      g.dispose();
    }
    expect(verts / flora.length).toBeLessThan(2500);
  });
});
