import { describe, expect, it } from 'vitest';
import { Survival, type SurvivalEnv } from './Survival';
import { Inventory } from '../Inventory';
import { PlayerState } from '../PlayerState';
import { RECIPES, recipeResourceIds } from '../crafting/recipes';
import { LAUNCH_RESOURCES } from '@/gen/universe/catalog';
import { generateStarSystem } from '@/gen/universe/System';
import { TerrainModel } from '@/gen/terrain/TerrainModel';
import { generateResourceNodes } from '@/gen/terrain/ResourceNodes';

const env = (over: Partial<SurvivalEnv> = {}): SurvivalEnv => ({ dt: 1, breathable: true, underwater: false, sprinting: false, temperatureC: 20, radiation: false, recharging: false, ...over });

describe('Survival', () => {
  it('atembare Luft hält Sauerstoff voll, Energie sinkt langsam', () => {
    const s = new Survival();
    for (let i = 0; i < 300; i++) s.update(env());
    expect(s.oxygen).toBe(100);
    expect(s.energy).toBeLessThan(100);
    expect(s.energy).toBeGreaterThan(60);
  });

  it('nicht atembar: Sauerstoff sinkt, Warnungen kommen einmal, Zusammenbruch bei 0', () => {
    const s = new Survival();
    const events: string[] = [];
    for (let i = 0; i < 600; i++) events.push(...s.update(env({ breathable: false })));
    expect(s.oxygen).toBe(0);
    expect(events.filter((e) => e === 'oxygen_low').length).toBe(1);
    expect(events.filter((e) => e === 'oxygen_critical').length).toBe(1);
    expect(events).toContain('collapse');
    s.respawn();
    expect(s.oxygen).toBe(60);
  });

  it('Unterwasser verbraucht schnell, Aufladen füllt auf, Kälte erhöht Energieverbrauch', () => {
    const s = new Survival();
    for (let i = 0; i < 30; i++) s.update(env({ underwater: true }));
    expect(s.oxygen).toBeLessThan(60);
    for (let i = 0; i < 30; i++) s.update(env({ recharging: true }));
    expect(s.oxygen).toBe(100);
    const warm = new Survival();
    const cold = new Survival();
    for (let i = 0; i < 100; i++) {
      warm.update(env());
      cold.update(env({ temperatureC: -40 }));
    }
    expect(cold.energy).toBeLessThan(warm.energy);
    expect(cold.hazards).toContain('Kälte');
    s.useOxygenCell();
    expect(s.oxygen).toBe(100);
  });
});

describe('Inventory und Rezepte', () => {
  it('Kosten prüfen, bezahlen, Verluste', () => {
    const inv = new Inventory();
    inv.add('ferrite', 10);
    inv.add('quartz', 2);
    expect(inv.canAfford({ ferrite: 6, quartz: 3 })).toBe(false);
    expect(inv.missing({ ferrite: 6, quartz: 3 })).toEqual({ quartz: 1 });
    inv.add('quartz', 1);
    expect(inv.pay({ ferrite: 6, quartz: 3 })).toBe(true);
    expect(inv.get('ferrite')).toBe(4);
    expect(inv.get('quartz')).toBe(0);
    inv.addItem('oxygen_cell', 2);
    expect(inv.removeItem('oxygen_cell')).toBe(true);
    expect(inv.getItem('oxygen_cell')).toBe(1);
    inv.add('fiber', 20);
    const lost = inv.loseFraction(0.1);
    expect(lost.fiber).toBe(2);
    expect(inv.get('fiber')).toBe(18);
    const copy = Inventory.fromJSON(JSON.parse(JSON.stringify(inv.toJSON())));
    expect(copy.get('fiber')).toBe(18);
    expect(copy.getItem('oxygen_cell')).toBe(1);
  });

  it('alle Rezepte nutzen nur garantierte Start-Rohstoffe', () => {
    for (const id of recipeResourceIds()) expect(LAUNCH_RESOURCES).toContain(id);
    expect(RECIPES.some((r) => r.module === 'lab')).toBe(true);
    expect(RECIPES.some((r) => r.module === 'workbench' && r.station === 'hand')).toBe(true);
  });

  it('PlayerState: Module, Respawn, Roundtrip', () => {
    const p = new PlayerState('SEED');
    p.inventory.add('ferrite', 5);
    const m = p.addModule('shelter', 'p1', 10, 20, 1);
    p.addModule('lab', 'p1', 14, 20, 0);
    p.labLevel = 1;
    expect(p.respawn.p1).toEqual({ x: 10, z: 20 });
    expect(p.hasModule('p1', 'lab')).toBe(true);
    const q = PlayerState.fromJSON(JSON.parse(JSON.stringify(p.toJSON())));
    expect(q.modulesOn('p1').length).toBe(2);
    expect(q.labLevel).toBe(1);
    expect(q.inventory.get('ferrite')).toBe(5);
    expect(q.respawn.p1).toEqual({ x: 10, z: 20 });
    q.removeModule(m.id);
    expect(q.respawn.p1).toBeUndefined();
  });
});

describe('Rohstoffknoten', () => {
  it('sind deterministisch, liegen auf Land und passen zu den Vorkommen', () => {
    const sys = generateStarSystem('NODES-1');
    const planet = sys.planets.find((p) => p.isStart)!;
    const model = new TerrainModel(planet);
    const ids = new Set(planet.resources.map((r) => r.resourceId));
    let total = 0;
    for (let ix = -3; ix <= 3; ix++) {
      for (let iz = -3; iz <= 3; iz++) {
        const a = generateResourceNodes(model, planet, ix, iz);
        const b = generateResourceNodes(model, planet, ix, iz);
        expect(a.map((n) => n.id)).toEqual(b.map((n) => n.id));
        for (const n of a) {
          expect(ids.has(n.resourceId)).toBe(true);
          if (model.hasWater) expect(n.y).toBeGreaterThan(model.seaLevel);
          expect(n.amount).toBeGreaterThanOrEqual(4);
        }
        total += a.length;
      }
    }
    expect(total).toBeGreaterThan(10);
    // Start-Rohstoffe müssen in der Umgebung als Knoten vorkommen (Ferrit, Quarz, Faser)
    const near = new Set<string>();
    for (let ix = -6; ix <= 6; ix++) for (let iz = -6; iz <= 6; iz++) for (const n of generateResourceNodes(model, planet, ix, iz)) near.add(n.resourceId);
    for (const id of ['ferrite', 'quartz', 'fiber']) expect(near.has(id), `${id} fehlt in der Umgebung`).toBe(true);
  });
});
