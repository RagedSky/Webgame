import { describe, expect, it } from 'vitest';
import { SHORE_CELLS, SHORE_RES, ShoreMap } from './ShoreMap';

// Schräger Strand: Höhe steigt mit x, Meeresspiegel 0 → Tiefe = −0,05·x
const beach = (x: number): number => x * 0.05;

describe('ShoreMap', () => {
  it('füllt beim ersten Mal das ganze Fenster und speichert die Tiefe', () => {
    const map = new ShoreMap(beach, 0);
    expect(map.update(0, 0)).toBe(SHORE_CELLS * SHORE_CELLS);
    // Zelle bei x ≈ −100 m: 5 m tief; Zelle bei x ≈ +20 m: Land (untere Grenze −1 m)
    expect(map.depthAtCell(-50, 0)).toBeCloseTo(4.95, 0);
    expect(map.depthAtCell(10, 0)).toBeCloseTo(-1.05, 0);
  });

  it('rechnet bei kleinen Bewegungen nur die neuen Spalten und Zeilen', () => {
    const map = new ShoreMap(beach, 0);
    map.update(0, 0);
    expect(map.update(0.5, 0.5)).toBe(0);
    expect(map.update(SHORE_RES, 0)).toBe(SHORE_CELLS);
    expect(map.update(SHORE_RES, SHORE_RES)).toBe(SHORE_CELLS);
    expect(map.update(3 * SHORE_RES, 2 * SHORE_RES)).toBe(2 * SHORE_CELLS + SHORE_CELLS - 2);
  });

  it('stimmt nach vielen Schritten mit einer frisch gefüllten Karte überein', () => {
    const wavy = (x: number, z: number): number => Math.sin(x * 0.07) * 3 + Math.cos(z * 0.05) * 2;
    const moved = new ShoreMap(wavy, 0.5);
    moved.update(0, 0);
    for (let s = 1; s <= 40; s++) moved.update(s * 7.3, s * -4.1);
    const fresh = new ShoreMap(wavy, 0.5);
    fresh.update(40 * 7.3, 40 * -4.1);
    const i0 = Math.floor((40 * 7.3) / SHORE_RES);
    const j0 = Math.floor((40 * -4.1) / SHORE_RES);
    for (let k = -120; k < 120; k += 7) {
      expect(moved.depthAtCell(i0 + k, j0 - k)).toBe(fresh.depthAtCell(i0 + k, j0 - k));
      expect(moved.depthAtCell(i0 + k, j0 + 3)).toBe(fresh.depthAtCell(i0 + k, j0 + 3));
    }
    expect(moved.centerX).toBe(fresh.centerX);
  });
});
