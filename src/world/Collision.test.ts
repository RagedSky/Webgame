import { describe, expect, it } from 'vitest';
import { CollisionWorld } from './Collision';

describe('CollisionWorld', () => {
  it('schiebt einen Läufer aus einem Zylinder heraus und lässt ihn sonst in Ruhe', () => {
    const w = new CollisionWorld();
    w.set('a', [{ x: 10, z: 10, r: 1, top: 5 }]);
    const p = { x: 10.5, y: 0, z: 10 };
    expect(w.resolve(p, 0.4)).toBe(true);
    expect(Math.hypot(p.x - 10, p.z - 10)).toBeCloseTo(1.4, 5);
    expect(p.y).toBe(0);
    const far = { x: 20, y: 0, z: 20 };
    expect(w.resolve(far, 0.4)).toBe(false);
    expect(far).toEqual({ x: 20, y: 0, z: 20 });
  });

  it('wer über der Oberkante ist, wird nicht geschoben; niedrige Kanten übersteigt man', () => {
    const w = new CollisionWorld();
    w.set('rock', [{ x: 0, z: 0, r: 1, top: 0.6 }]);
    expect(w.resolve({ x: 0.2, y: 0.4, z: 0 }, 0.3)).toBe(false);
    expect(w.resolve({ x: 0.2, y: 0.1, z: 0 }, 0.3)).toBe(true);
  });

  it('gleitet entlang: der Abstand zum Hindernis bleibt nach jedem Schritt eingehalten', () => {
    const w = new CollisionWorld();
    w.set('tree', [{ x: 0, z: 0, r: 0.8, top: 10 }]);
    const p = { x: -3, y: 0, z: 0.3 };
    for (let i = 0; i < 200; i++) {
      p.x += 0.05;
      w.resolve(p, 0.35);
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1.15 - 1e-6);
    }
    // der Läufer ist außen herum auf die andere Seite gekommen
    expect(p.x).toBeGreaterThan(1);
  });

  it('erfasst Zylinder über Rasterzellen hinweg und in der Ecke zwischen zwei Hindernissen', () => {
    const w = new CollisionWorld();
    w.set('big', [{ x: 7.9, z: 7.9, r: 2, top: 9 }]);
    for (const [x, z] of [[9, 9], [6, 9], [9, 6], [8.2, 8.2]] as Array<[number, number]>) {
      const p = { x, y: 0, z };
      expect(w.resolve(p, 0.4), `${x}/${z}`).toBe(true);
    }
    // Durchgang von 1 m zwischen zwei Stämmen: der Läufer (0,8 m breit) passt hindurch und berührt keinen
    w.set('pair', [{ x: 30, z: 30, r: 1, top: 9 }, { x: 33, z: 30, r: 1, top: 9 }]);
    const p = { x: 31.2, y: 0, z: 30.2 };
    w.resolve(p, 0.4);
    expect(Math.hypot(p.x - 30, p.z - 30)).toBeGreaterThanOrEqual(1.4 - 0.05);
    expect(Math.hypot(p.x - 33, p.z - 30)).toBeGreaterThanOrEqual(1.4 - 0.05);
  });

  it('Gruppen lassen sich ersetzen und entfernen', () => {
    const w = new CollisionWorld();
    w.set('cell', [{ x: 0, z: 0, r: 1, top: 5 }, { x: 40, z: 0, r: 1, top: 5 }]);
    expect(w.size).toBe(2);
    expect(w.blocked(40.5, 0, 0.3)).toBe(true);
    w.set('cell', [{ x: 0, z: 0, r: 1, top: 5 }]);
    expect(w.size).toBe(1);
    expect(w.blocked(40.5, 0, 0.3)).toBe(false);
    w.remove('cell');
    expect(w.size).toBe(0);
    expect(w.resolve({ x: 0.1, y: 0, z: 0 }, 0.3)).toBe(false);
    w.set('x', [{ x: 1, z: 1, r: 1, top: 1 }]);
    w.clear();
    expect(w.size).toBe(0);
  });
});
