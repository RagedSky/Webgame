import { describe, expect, it } from 'vitest';
import { BoxGeometry, CylinderGeometry } from 'three';
import { bandFootprint, footprintCircles } from './geometry';

describe('Grundriss für Kollisionen', () => {
  it('misst den Stamm und nicht die Krone', () => {
    // dünner Mast (Radius 0,2, 8 m hoch) – Eckpunkte nur unten und oben
    const mast = new CylinderGeometry(0.2, 0.2, 8, 12);
    mast.translate(0, 4, 0);
    const fp = bandFootprint(mast, 0.3, 1.8);
    expect(fp).not.toBeNull();
    expect(fp!.radius).toBeCloseTo(0.2, 2);
  });

  it('folgt einer Verjüngung im Band', () => {
    // Kegelstumpf: unten 1,0, oben 0 bei 4 m → bei 1 m Höhe Radius 0,75
    const cone = new CylinderGeometry(0, 1, 4, 16);
    cone.translate(0, 2, 0);
    const fp = bandFootprint(cone, 1, 2);
    expect(fp!.radius).toBeCloseTo(0.75, 2);
  });

  it('liefert null, wenn nichts im Band liegt', () => {
    const slab = new BoxGeometry(2, 0.2, 2);
    slab.translate(0, 0.1, 0);
    expect(bandFootprint(slab, 0.3, 1.8)).toBeNull();
  });

  it('deckt rundliche Formen mit einem Kreis, Mauern mit einer Reihe', () => {
    const block = new BoxGeometry(1, 2, 1.1);
    block.translate(0, 1, 0);
    expect(footprintCircles(bandFootprint(block, 0.3, 1.8)!)).toHaveLength(1);

    const wall = new BoxGeometry(6, 2, 0.8);
    wall.translate(0, 1, 0);
    const circles = footprintCircles(bandFootprint(wall, 0.3, 1.8)!);
    expect(circles.length).toBeGreaterThanOrEqual(4);
    for (const c of circles) {
      expect(c.r).toBeCloseTo(0.4, 5);
      expect(Math.abs(c.x)).toBeLessThanOrEqual(2.6 + 1e-9);
      expect(c.z).toBeCloseTo(0, 5);
    }
    // Enden der Mauer sind erreicht, Lücken zwischen den Kreisen kleiner als ein Spieler (0,68 m)
    expect(Math.max(...circles.map((c) => c.x + c.r))).toBeCloseTo(3, 5);
    const xs = circles.map((c) => c.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]! - 0.8).toBeLessThan(0.68);
  });
});
