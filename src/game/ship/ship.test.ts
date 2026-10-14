import { describe, expect, it } from 'vitest';
import { canPlace, costDelta, firstFreeSocket, placePart, removePart, repairedDesign, setHull, shipStats, starterDesign, twr, validateDesign } from './ShipDesign';
import { PART_DEFS, partDef, partResourceIds } from './parts';
import { landCheck, launchCheck, launchCost, landingCost, planTrip, rangeAu, reachCheck, transferCost } from './travel';
import { blueprintIds, blueprintOrder, isPartAvailable, milestonesEarned, nextBlueprint } from './blueprints';
import { LAUNCH_RESOURCES } from '@/gen/universe/catalog';
import { generateStarSystem } from '@/gen/universe/System';
import { generateUniverse } from '@/gen';
import { LAUNCH_FUEL_TARGET } from '../crafting/recipes';
import { PlayerState } from '../PlayerState';

describe('Schiffsentwurf', () => {
  it('Startentwurf ist unvollständig, reparierter Lander ist startklar bis 1,25 g', () => {
    const start = starterDesign();
    expect(validateDesign(start, 1)).toContain('Kein Triebwerk');
    const d = repairedDesign();
    const s = shipStats(d);
    expect(s.hasCockpit).toBe(true);
    expect(s.legs).toBe(3);
    expect(s.maxFuel).toBe(20);
    expect(s.engineTier).toBe(1);
    expect(validateDesign(d, 1.25)).toEqual([]);
    expect(twr(s, 20, 1.25)).toBeGreaterThan(1.1);
  });

  it('Platzierungsregeln: Sockelart, Belegung, Rumpfwechsel behält passende Teile', () => {
    const d = starterDesign();
    expect(canPlace(d, 'engine_1', 0).ok).toBe(false); // oben ist die Kanzel
    const bottom = firstFreeSocket(d, 'bottom')!;
    expect(canPlace(d, 'tank_1', bottom).ok).toBe(false);
    const d2 = placePart(d, 'engine_1', bottom);
    expect(canPlace(d2, 'engine_1', bottom).reason).toBe('Sockel belegt');
    const d3 = removePart(d2, d2.parts[d2.parts.length - 1]!.id);
    expect(d3.parts.length).toBe(1);
    const full = repairedDesign();
    const swapped = setHull(full, 'hull_2');
    expect(swapped.dropped.length).toBe(0);
    expect(shipStats(swapped.design).legs).toBe(3);
    expect(shipStats(swapped.design).maxFuel).toBe(20);
    const delta = costDelta(full, swapped.design);
    expect(delta.ferrite).toBe(30 - 18);
  });

  it('alle Teile kosten nur garantierte Startrohstoffe', () => {
    for (const id of partResourceIds()) expect(LAUNCH_RESOURCES).toContain(id);
    expect(PART_DEFS.every((p) => p.mass > 0)).toBe(true);
  });
});

describe('Raumflug', () => {
  it('Kosten steigen mit Masse, Schwerkraft und Distanz; Effizienz senkt sie', () => {
    const s1 = shipStats(repairedDesign());
    expect(launchCost(s1, 20, 1.5)).toBeGreaterThan(launchCost(s1, 20, 0.8));
    expect(transferCost(s1, 20, 1, 3)).toBeGreaterThan(transferCost(s1, 20, 1, 1.5));
    expect(transferCost(s1, 20, 1, 1)).toBe(0);
    let d = repairedDesign();
    d = removePart(d, d.parts.find((p) => p.partId === 'engine_1')!.id);
    d = placePart(d, 'engine_2', firstFreeSocket(d, 'bottom')!);
    const s2 = shipStats(d);
    expect(landingCost(s2, 20, 1)).toBeLessThanOrEqual(landingCost(s1, 20, 1));
    expect(rangeAu(s2, 20)).toBeGreaterThan(rangeAu(s1, 20));
  });

  it('Start + Rückkehr auf jedem Startplaneten mit 20 Treibstoff möglich', () => {
    const s = shipStats(repairedDesign());
    for (let i = 0; i < 30; i++) {
      const sys = generateStarSystem(`FLIGHT-${i}`);
      const start = sys.planets.find((p) => p.isStart)!;
      const need = launchCost(s, LAUNCH_FUEL_TARGET, start.gravity) + landingCost(s, LAUNCH_FUEL_TARGET, start.gravity);
      expect(need).toBeLessThanOrEqual(LAUNCH_FUEL_TARGET);
      expect(launchCheck(s, LAUNCH_FUEL_TARGET, start).ok).toBe(true);
      expect(landCheck(s, 10, start).ok).toBe(true);
      expect(reachCheck(s, start).ok).toBe(true);
    }
  });

  it('Gasriesen sind nicht landbar, Stufen sperren Orbits', () => {
    const sys = generateStarSystem('GAS-1');
    const s = shipStats(repairedDesign());
    const gas = sys.planets.find((p) => p.type === 'gas_giant');
    if (gas) {
      expect(landCheck(s, 20, gas).reasons).toContain('Keine feste Oberfläche');
      expect(reachCheck(s, gas).ok).toBe(false);
    }
    const start = sys.planets.find((p) => p.isStart)!;
    const other = sys.planets.find((p) => !p.isStart)!;
    const plan = planTrip(s, 20, start, other);
    expect(plan.total).toBe(plan.transfer + plan.landing);
  });
});

describe('Baupläne', () => {
  it('Reihenfolge ist deterministisch, vollständig und beginnt mit Antrieb oder Schild', () => {
    const a = blueprintOrder('BP-1');
    const b = blueprintOrder('BP-1');
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(blueprintIds().length);
    expect(['engine_2', 'shield_1']).toContain(a[0]);
    const tier3Start = a.findIndex((id) => partDef(id).tier === 3);
    expect(a.slice(tier3Start).every((id) => partDef(id).tier === 3)).toBe(true);
    expect(nextBlueprint('BP-1', [])).toBe(a[0]);
    expect(nextBlueprint('BP-1', a)).toBeNull();
    expect(isPartAvailable('engine_1', [])).toBe(true);
    expect(isPartAvailable('engine_2', [])).toBe(false);
    expect(milestonesEarned(0.25)).toBe(2);
  });

  it('PlayerState vergibt Pläne je Ruine einmal und je Meilenstein, Roundtrip erhält Schiff und Pläne', () => {
    const p = new PlayerState('BP-2');
    const order = blueprintOrder('BP-2');
    expect(p.grantRuinBlueprint('ruin-a')).toBe(order[0]);
    expect(p.grantRuinBlueprint('ruin-a')).toBeNull();
    expect(p.grantRuinBlueprint('ruin-b')).toBe(order[1]);
    expect(p.claimMilestones(0.05)).toEqual([]);
    expect(p.claimMilestones(0.21)).toEqual([order[2], order[3]]);
    expect(p.claimMilestones(0.21)).toEqual([]);
    p.ship.design = repairedDesign();
    p.ship.fuel = 7;
    p.ship.location = { kind: 'orbit', planetId: 'p3' };
    p.ship.flights = 2;
    p.sites.p1 = { x: 1, z: 2, rot: 0.5 };
    const q = PlayerState.fromJSON(JSON.parse(JSON.stringify(p.toJSON())));
    expect(q.blueprints).toEqual(order.slice(0, 4));
    expect(q.scannedRuins).toEqual(['ruin-a', 'ruin-b']);
    expect(q.milestonesClaimed).toBe(2);
    expect(shipStats(q.ship.design).legs).toBe(3);
    expect(q.ship.fuel).toBe(7);
    expect(q.ship.location).toEqual({ kind: 'orbit', planetId: 'p3' });
    expect(q.ship.flights).toBe(2);
    expect(q.sites.p1).toEqual({ x: 1, z: 2, rot: 0.5 });
  });

  it('jeder Startplanet bietet Ruinen für Baupläne oder einen Stufe-1-Nachbarn', () => {
    for (let i = 0; i < 25; i++) {
      const sys = generateUniverse(`BP-SYS-${i}`);
      const start = sys.planets.find((p) => p.isStart)!;
      const ruins = sys.entries.filter((e) => e.planetId === start.id && e.subcategory === 'ruin').length;
      const tier1Neighbor = sys.planets.some((p) => !p.isStart && p.requirements.engineTier === 1 && p.requirements.shieldTier === 0 && p.type !== 'gas_giant');
      expect(ruins > 0 || tier1Neighbor).toBe(true);
    }
  });
});
