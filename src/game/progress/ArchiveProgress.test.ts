import { describe, expect, it } from 'vitest';
import { generateUniverse } from '@/gen';
import { ArchiveProgress } from './ArchiveProgress';

describe('ArchiveProgress', () => {
  it('zählt Entdeckungen, Sterne und Verhalten korrekt und nur aufwärts', () => {
    const sys = generateUniverse('PROG-1');
    const p = new ArchiveProgress(sys.seed, sys.entries);
    const e = sys.entries.find((x) => x.category === 'fauna')!;
    const r1 = p.recordPhoto(e.id, 40, 'ph1', 'grazing', 1);
    expect(r1.newDiscovery).toBe(true);
    expect(r1.stars).toBe(1);
    expect(r1.newBehavior).toBe(true);
    const r2 = p.recordPhoto(e.id, 90, 'ph2', 'grazing', 2);
    expect(r2.stars).toBe(3);
    expect(r2.improved).toBe(true);
    expect(r2.newBehavior).toBe(false);
    const r3 = p.recordPhoto(e.id, 30, 'ph3', 'sleeping', 3);
    expect(r3.stars).toBe(1);
    expect(p.get(e.id).stars).toBe(3);
    expect(p.get(e.id).bestPhotoId).toBe('ph2');
    expect(p.get(e.id).behaviors).toEqual(['grazing', 'sleeping']);
    expect(p.get(e.id).photoIds.length).toBe(3);
    expect(p.completion().discovered).toBe(1);
    expect(p.photosTaken).toBe(3);
    expect(p.logbook.some((l) => l.kind === 'discovery')).toBe(true);
  });

  it('Analyse, Hinweise, Umbenennen, Abschluss', () => {
    const sys = generateUniverse('PROG-2');
    const p = new ArchiveProgress(sys.seed, sys.entries);
    const ore = sys.entries.find((x) => x.category === 'ore')!;
    expect(p.discoverByAnalysis(ore.id, 0.9, 5).stars).toBe(3);
    expect(p.discoverByAnalysis(ore.id, 0.2, 6).stars).toBe(3);
    const rare = sys.entries.find((x) => x.rarity === 'rare')!;
    expect(p.addHint(rare.id, 'Fußspuren im Schlamm', 7)).toBe(true);
    expect(p.addHint(rare.id, 'Fußspuren im Schlamm', 8)).toBe(false);
    expect(p.isHinted(rare.id)).toBe(true);
    expect(p.isDiscovered(rare.id)).toBe(false);
    p.rename(ore.id, '  Mein Erz  ');
    expect(p.displayName(ore)).toBe('Mein Erz');
    p.rename(ore.id, '');
    expect(p.displayName(ore)).toBe(ore.name);
    // 80 % → versiegelt
    const target = Math.ceil(sys.entries.length * 0.8);
    for (let i = 0; i < target; i++) p.discoverByAnalysis(sys.entries[i]!.id, 0.6, 10 + i);
    expect(p.isSealed()).toBe(true);
    expect(p.completion().fraction).toBeGreaterThanOrEqual(0.8);
    const start = sys.planets.find((pl) => pl.isStart)!;
    const c = p.completion(start.id);
    expect(c.total).toBe(sys.entries.filter((e) => e.planetId === start.id).length);
  });

  it('serialisiert und lädt identisch (Roundtrip)', () => {
    const sys = generateUniverse('PROG-3');
    const p = new ArchiveProgress(sys.seed, sys.entries);
    p.recordPhoto(sys.entries[0]!.id, 70, 'a', 'feeding', 1);
    p.addHint(sys.entries[5]!.id, 'Kot am Wegrand', 2);
    p.addSample({ id: 's1', source: 'water', planetId: sys.planets[0]!.id, biomeId: sys.planets[0]!.biomes[0]!.id, seed: 'x', takenAt: 3, analyzed: false, label: 'Wasserprobe' });
    const json = JSON.parse(JSON.stringify(p.toJSON()));
    const q = ArchiveProgress.fromJSON(json, sys.entries);
    expect(q.get(sys.entries[0]!.id).stars).toBe(2);
    expect(q.get(sys.entries[0]!.id).behaviors).toEqual(['feeding']);
    expect(q.get(sys.entries[5]!.id).hints).toEqual(['Kot am Wegrand']);
    expect(q.samples.length).toBe(1);
    expect(q.logbook.length).toBe(p.logbook.length);
    expect(q.completion().discovered).toBe(1);
    const again = JSON.parse(JSON.stringify(q.toJSON()));
    delete again.updatedAt;
    const first = JSON.parse(JSON.stringify(p.toJSON()));
    delete first.updatedAt;
    expect(again).toEqual(first);
  });
});
