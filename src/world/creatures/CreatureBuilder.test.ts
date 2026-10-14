import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { generateUniverse } from '@/gen';
import { buildCreatureTemplate } from './CreatureBuilder';
import { Creature } from './Creature';

describe('CreatureBuilder', () => {
  it('erzeugt geskinnte Geometrien ohne NaN für viele Arten', { timeout: 30000 }, () => {
    for (const seed of ['CRE-1', 'CRE-2', 'BLUE-7']) {
      const sys = generateUniverse(seed);
      const fauna = sys.entries.filter((e) => e.category === 'fauna' || (e.category === 'variant' && e.genome.kind === 'fauna')).slice(0, 40);
      expect(fauna.length).toBeGreaterThan(10);
      for (const e of fauna) {
        const t = buildCreatureTemplate(e);
        const pos = t.geometry.getAttribute('position');
        expect(pos.count).toBeGreaterThan(50);
        expect(pos.count).toBeLessThan(40000);
        expect(t.geometry.getAttribute('skinIndex')).toBeDefined();
        expect(t.geometry.getAttribute('skinWeight')).toBeDefined();
        expect(t.geometry.getAttribute('color')).toBeDefined();
        const arr = pos.array as Float32Array;
        let finite = true;
        for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i] as number)) finite = false;
        expect(finite, `${e.id}: NaN in Geometrie`).toBe(true);
        expect(t.bones.length).toBeGreaterThanOrEqual(2);
        const maxBone = Math.max(...Array.from(t.geometry.getAttribute('skinIndex').array as Uint16Array));
        expect(maxBone).toBeLessThan(t.bones.length);
        t.geometry.dispose();
        t.material.dispose();
      }
    }
  });

  it('Kreatur bewegt sich und animiert ohne Fehler (Land, Wasser, Luft)', () => {
    const sys = generateUniverse('CRE-3');
    const picks = ['land', 'water', 'air'].map((l) => sys.entries.find((e) => e.category === 'fauna' && e.subcategory === l)).filter(Boolean);
    expect(picks.length).toBeGreaterThan(0);
    for (const e of picks) {
      const t = buildCreatureTemplate(e!);
      const fam = sys.families.find((f) => f.id === e!.familyId);
      const c = new Creature(e!, t, fam, 'test', new Vector3(0, 10, 0), 0);
      const world = {
        heightAt: (x: number, z: number) => Math.sin(x * 0.1) * 2 + Math.cos(z * 0.1) * 2,
        slopeAt: () => 0.1,
        seaLevel: -5,
        hasWater: false,
        halfWorld: 500,
        playerPos: new Vector3(50, 0, 50),
        playerYaw: 0,
        playerNoise: 0.2,
        timeOfDay: 'day' as const,
        daylight: 1,
        lures: [],
      };
      for (let i = 0; i < 600; i++) c.update(1 / 60, world);
      expect(Number.isFinite(c.position.x)).toBe(true);
      expect(Number.isFinite(c.position.y)).toBe(true);
      expect(Math.abs(c.position.x)).toBeLessThan(500);
      c.dispose();
      t.geometry.dispose();
      t.material.dispose();
    }
  });
});
