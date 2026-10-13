import { describe, expect, it } from 'vitest';
import { generateUniverse } from '../index';
import { isSpawnSatisfiable } from './spawn';
import { CATEGORIES, CATEGORY_SHARE, type Category, type Rarity } from './types';
import { PLANET_TYPES } from '../universe/catalog';

const SEEDS = Array.from({ length: 60 }, (_, i) => `ARCHIVE-TEST-${i}`);

describe('generateUniverse / Archiv', () => {
  it('ist deterministisch inklusive Archiv', () => {
    const a = JSON.stringify(generateUniverse('ARCHIV-1'));
    const b = JSON.stringify(generateUniverse('ARCHIV-1'));
    expect(a).toBe(b);
  });

  it('erzeugt 400–600 Einträge ohne doppelte IDs oder Namen', () => {
    for (const seed of SEEDS) {
      const sys = generateUniverse(seed);
      expect(sys.entries.length).toBeGreaterThanOrEqual(400);
      expect(sys.entries.length).toBeLessThanOrEqual(600);
      expect(sys.entries.length).toBe(sys.entryBudget);
      const ids = new Set(sys.entries.map((e) => e.id));
      expect(ids.size).toBe(sys.entries.length);
      const names = new Set(sys.entries.map((e) => e.name));
      expect(names.size).toBe(sys.entries.length);
      const latin = new Set(sys.entries.map((e) => e.latinName));
      expect(latin.size).toBe(sys.entries.length);
      const famIds = new Set(sys.families.map((f) => f.id));
      expect(famIds.size).toBe(sys.families.length);
    }
  });

  it('verteilt Kategorien nahe an den Richtwerten', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const sys = generateUniverse(seed);
      const total = sys.entries.length;
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
      for (const e of sys.entries) counts[e.category]++;
      for (const c of CATEGORIES) {
        const expected = (total * CATEGORY_SHARE[c]) / 100;
        // Toleranz: Caps (Gasriesen, Ödwelten, Wetter-Pool) können die Verteilung leicht verschieben
        expect(counts[c]).toBeGreaterThanOrEqual(Math.floor(expected * 0.7));
        expect(counts[c]).toBeLessThanOrEqual(Math.ceil(expected * 1.35));
      }
    }
  });

  it('jeder Eintrag ist auf seinem Planeten auffindbar', () => {
    for (const seed of SEEDS) {
      const sys = generateUniverse(seed);
      const planets = new Map(sys.planets.map((p) => [p.id, p]));
      const entryIds = new Set(sys.entries.map((e) => e.id));
      const familyIds = new Set(sys.families.map((f) => f.id));
      for (const e of sys.entries) {
        const planet = planets.get(e.planetId);
        expect(planet, `${e.id}: Planet fehlt`).toBeDefined();
        if (!planet) continue;
        expect(e.biomeIds.length, `${e.id}: keine Biome`).toBeGreaterThan(0);
        const biomes = e.biomeIds.map((id) => planet.biomes.find((b) => b.id === id));
        for (const b of biomes) expect(b, `${e.id}: Biom nicht auf Planet`).toBeDefined();
        const resolved = biomes.filter((b): b is NonNullable<typeof b> => !!b);
        expect(isSpawnSatisfiable(planet, resolved, e.spawn), `${e.id}: Spawn nicht erfüllbar ${JSON.stringify(e.spawn)}`).toBe(true);
        expect(familyIds.has(e.familyId), `${e.id}: Familie fehlt`).toBe(true);
        expect(e.name.length).toBeGreaterThan(2);
        expect(e.description.length).toBeGreaterThan(20);
        expect(['photo', 'microscope', 'sample']).toContain(e.captureMethod);
        if (e.category === 'micro') expect(e.captureMethod).toBe('microscope');
        if (e.category === 'ore' || e.category === 'rock') expect(e.captureMethod).toBe('sample');
        if (e.category === 'variant') {
          expect(e.baseEntryId).toBeDefined();
          expect(entryIds.has(e.baseEntryId!)).toBe(true);
          const base = sys.entries.find((x) => x.id === e.baseEntryId)!;
          expect(base.planetId).toBe(e.planetId);
        }
        // Gasriesen: keine Flora/Erze/Gesteine/Fossilien
        if (PLANET_TYPES[planet.type].gasGiant) expect(['flora', 'ore', 'rock', 'fossil']).not.toContain(e.category);
      }
      // Familien verweisen nur auf existierende Einträge
      for (const f of sys.families) for (const m of f.memberIds) expect(entryIds.has(m)).toBe(true);
    }
  });

  it('Seltenheiten sind verteilt; ca. 80 % ohne Legendär-Status', () => {
    let total = 0;
    const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    for (const seed of SEEDS.slice(0, 20)) {
      const sys = generateUniverse(seed);
      for (const e of sys.entries) {
        counts[e.rarity]++;
        total++;
      }
    }
    expect(counts.common / total).toBeGreaterThan(0.35);
    expect(counts.legendary / total).toBeLessThan(0.12);
    expect((counts.common + counts.uncommon) / total).toBeGreaterThan(0.6);
    expect(counts.rare).toBeGreaterThan(0);
    expect(counts.legendary).toBeGreaterThan(0);
  });

  it('Startplanet hat spürbar viele Einträge und alle Kategorien', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const sys = generateUniverse(seed);
      const start = sys.planets.find((p) => p.isStart)!;
      const n = sys.entries.filter((e) => e.planetId === start.id).length;
      expect(n).toBeGreaterThanOrEqual(Math.floor((sys.entries.length / sys.planets.length) * 0.8));
      for (const c of ['fauna', 'flora', 'micro', 'ore', 'rock', 'fossil', 'weather'] as Category[]) {
        expect(start.entryBudget[c], `${seed}: ${c} auf Startplanet`).toBeGreaterThan(0);
      }
    }
  });

  it('planet.entryBudget stimmt mit den Einträgen überein', () => {
    const sys = generateUniverse('BUDGET-CHECK');
    for (const p of sys.planets) {
      for (const c of CATEGORIES) {
        const n = sys.entries.filter((e) => e.planetId === p.id && e.category === c).length;
        expect(p.entryBudget[c]).toBe(n);
      }
    }
  });
});
