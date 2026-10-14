import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import { buildPropTemplate } from './PropBuilder';

describe('PropBuilder', () => {
  it('baut Erze, Gesteine, Fossilien und Ruinen ohne NaN', () => {
    const sys = generateUniverse('PROP-1');
    const props = sys.entries.filter((e) => e.category === 'ore' || e.category === 'rock' || e.category === 'fossil');
    expect(props.length).toBeGreaterThan(30);
    for (const e of props) {
      const t = buildPropTemplate(e);
      const pos = t.geometry.getAttribute('position');
      expect(pos.count).toBeGreaterThan(3);
      expect(pos.count).toBeLessThan(8000);
      const arr = pos.array as Float32Array;
      let finite = true;
      for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i] as number)) finite = false;
      expect(finite, e.id).toBe(true);
      expect(t.radius).toBeGreaterThan(0);
      t.geometry.dispose();
      t.material.dispose();
    }
  });
});
