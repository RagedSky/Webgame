import { describe, expect, it } from 'vitest';
import { PlayerState } from '@/game/PlayerState';
import { ArchiveProgress } from '@/game/progress/ArchiveProgress';
import { generateUniverse } from '@/gen';
import { buildBundle, exportFilename, formatPlaytime, migrateBundle, SAVE_BUNDLE_KIND, SAVE_BUNDLE_VERSION, summarize } from './SaveBundle';

describe('SaveBundle', () => {
  const system = generateUniverse('SAVE-TEST');
  const player = new PlayerState(system.seed);
  const progress = new ArchiveProgress(system.seed, system.entries);

  it('baut, migriert und fasst ein Bundle zusammen', () => {
    player.playtime = 3725;
    player.inventory.add('ferrite', 5);
    const first = system.entries[0]!;
    progress.recordPhoto(first.id, 80, 'p1', undefined, 1);
    const bundle = buildBundle(player.toJSON(), progress.toJSON(), 1000);
    expect(bundle.kind).toBe(SAVE_BUNDLE_KIND);
    expect(bundle.version).toBe(SAVE_BUNDLE_VERSION);
    const json = JSON.parse(JSON.stringify(bundle)) as unknown;
    const back = migrateBundle(json);
    expect(back.seed).toBe(system.seed);
    expect(back.player.inventory.resources.ferrite).toBe(5);
    expect(back.player.playtime).toBe(3725);
    expect(PlayerState.fromJSON(back.player).inventory.get('ferrite')).toBe(5);
    const restored = ArchiveProgress.fromJSON(back.progress, system.entries);
    expect(restored.isDiscovered(first.id)).toBe(true);
    const sum = summarize({ slot: 1, name: 'Test', bundle: back, total: system.entries.length, planetName: (id) => system.planets.find((p) => p.id === id)?.name ?? id });
    expect(sum.discovered).toBe(1);
    expect(sum.stars).toBeGreaterThan(0);
    expect(sum.total).toBe(system.entries.length);
    expect(sum.location).toBe('–');
    expect(sum.playtime).toBe(3725);
  });

  it('lehnt fremde oder kaputte Dateien ab und migriert alte Spielerstände', () => {
    expect(() => migrateBundle(null)).toThrow();
    expect(() => migrateBundle({ kind: 'other' })).toThrow();
    expect(() => migrateBundle({ kind: SAVE_BUNDLE_KIND, version: 1, player: { seed: 'A' }, progress: { seed: 'B' } })).toThrow(/Seeds/);
    expect(() => migrateBundle({ kind: SAVE_BUNDLE_KIND, version: 99, player: {}, progress: {} })).toThrow(/neuerer/);
    // Spielerstand Version 1 (ohne Schiff, Karten, Charakter, Spielzeit) wird aufgefüllt
    const old = { kind: SAVE_BUNDLE_KIND, version: 1, seed: 'OLD', player: { version: 1, seed: 'OLD', inventory: { resources: {}, items: {} }, survival: { oxygen: 50, energy: 50 }, modules: [], labLevel: 0, respawn: {}, goalStep: 0 }, progress: { version: 1, seed: 'OLD', entries: {}, samples: [], logbook: [], photosTaken: 0 } };
    const b = migrateBundle(old);
    expect(b.player.version).toBeGreaterThanOrEqual(5);
    expect(b.player.ship.fuel).toBe(0);
    expect(b.player.playtime).toBe(0);
    expect(b.player.tutorial).toEqual({ step: 0, done: false });
    expect(b.player.character).toBeNull();
  });

  it('formatiert Dateinamen und Spielzeit', () => {
    expect(exportFilename('ARCHIV-1', new Date(2026, 0, 5, 9, 7).getTime())).toBe('stellar-archive-archiv-1-20260105-0907.json');
    expect(formatPlaytime(59)).toBe('0 min');
    expect(formatPlaytime(3725)).toBe('1 h 2 min');
  });
});
