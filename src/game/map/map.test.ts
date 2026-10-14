import { describe, expect, it } from 'vitest';
import { MAP_CELLS, MapGrid } from './MapGrid';
import { atmosphereTargets, catalogGaps, deepSeaTargets, probeHintText } from './hotspots';
import { generateUniverse } from '@/gen';
import { terrainSizeFor } from '@/gen/terrain/TerrainModel';
import { PlayerState } from '../PlayerState';
import { RECIPES, recipeResourceIds } from '../crafting/recipes';
import { LAUNCH_RESOURCES } from '@/gen/universe/catalog';

describe('MapGrid', () => {
  it('deckt Kreise auf, senkt nie Stufen und serialisiert verlustfrei', () => {
    const g = new MapGrid(9600);
    expect(g.cellSize).toBe(100);
    expect(g.fraction()).toBe(0);
    const n = g.reveal(0, 0, 250, 1);
    expect(n).toBeGreaterThan(10);
    expect(g.level(0, 0)).toBe(1);
    expect(g.level(4000, 4000)).toBe(0);
    g.reveal(0, 0, 100, 2);
    expect(g.level(0, 0)).toBe(2);
    g.reveal(0, 0, 100, 1);
    expect(g.level(0, 0)).toBe(2);
    const copy = MapGrid.fromBase64(9600, g.toBase64());
    expect(Array.from(copy.cells)).toEqual(Array.from(g.cells));
    expect(copy.fraction()).toBeCloseTo(g.fraction(), 6);
    g.revealAll(2);
    expect(g.fraction(2)).toBe(1);
    expect(g.center(0, 0)).toEqual({ x: -4750, z: -4750 });
    expect(g.center(MAP_CELLS - 1, MAP_CELLS - 1)).toEqual({ x: 4750, z: 4750 });
    expect(MapGrid.fromBase64(9600, '###').fraction()).toBe(0);
  });
});

describe('Katalog-Lücken und Sondenziele', () => {
  const sys = generateUniverse('MAP-1');
  const start = sys.planets.find((p) => p.isStart)!;

  it('zählt fehlende Einträge je Biom und reagiert auf Entdeckungen', () => {
    const gaps = catalogGaps(sys.entries, start, () => false);
    expect(gaps.length).toBe(start.biomes.length);
    expect(gaps.reduce((a, g) => a + g.total, 0)).toBeGreaterThan(0);
    const first = gaps.find((g) => g.total > 0)!;
    const some = sys.entries.find((e) => e.planetId === start.id && e.biomeIds.includes(first.biome.id))!;
    const after = catalogGaps(sys.entries, start, (id) => id === some.id).find((g) => g.biome === first.biome)!;
    expect(after.missing).toBe(first.missing - 1);
  });

  it('Tiefsee- und Atmosphärenziele sind nicht entdeckte Einträge der passenden Welt', () => {
    const water = sys.planets.find((p) => p.biomes.some((b) => b.hasWater));
    if (water) {
      const t = deepSeaTargets(sys.entries, water, () => false);
      for (const e of t) expect(e.planetId).toBe(water.id);
    }
    const gas = sys.planets.find((p) => p.type === 'gas_giant');
    if (gas) {
      const t = atmosphereTargets(sys.entries, gas, () => false);
      expect(t.length).toBeGreaterThan(0);
      expect(atmosphereTargets(sys.entries, gas, () => true).length).toBe(0);
      expect(probeHintText('Atmosphärensonde', t[0]!, gas)).toContain('Atmosphärensonde');
    }
  });

  it('Sonden-Rezepte nutzen nur Startrohstoffe', () => {
    for (const id of ['satellite', 'rover', 'deep_probe', 'atmo_probe']) expect(RECIPES.some((r) => r.id === id)).toBe(true);
    for (const id of recipeResourceIds()) expect(LAUNCH_RESOURCES).toContain(id);
  });

  it('PlayerState v3: Karten, Satelliten, Rover und Sonden überleben den Roundtrip', () => {
    const p = new PlayerState('MAP-2');
    const size = terrainSizeFor(start);
    p.mapGrid('p1', size).reveal(100, 100, 300, 1);
    p.markersOn('p1').push({ x: 10, z: 20, label: 'Nest' });
    p.satellites.p1 = 2;
    p.rovers.p1 = { x: 5, z: 6, yaw: 1 };
    p.deepProbes.p1 = [{ x: -50, z: 40 }];
    p.atmoProbes.push('p4');
    const q = PlayerState.fromJSON(JSON.parse(JSON.stringify(p.toJSON())));
    expect(q.mapGrid('p1', size).level(100, 100)).toBe(1);
    expect(q.mapGrid('p1', size).fraction()).toBeCloseTo(p.mapGrid('p1', size).fraction(), 6);
    expect(q.markersOn('p1')).toEqual([{ x: 10, z: 20, label: 'Nest' }]);
    expect(q.satellites.p1).toBe(2);
    expect(q.rovers.p1).toEqual({ x: 5, z: 6, yaw: 1 });
    expect(q.deepProbes.p1).toEqual([{ x: -50, z: 40 }]);
    expect(q.atmoProbes).toEqual(['p4']);
    expect(q.mapGrid('p9', size).fraction()).toBe(0);
  });
});
