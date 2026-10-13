import { describe, expect, it } from 'vitest';
import { Random } from '@/math/Random';
import { CreatureAI, type AIInput, type AIProfile } from './CreatureAI';

const profile = (over: Partial<AIProfile> = {}): AIProfile => ({
  temperament: 'shy',
  shyness: 0.8,
  activity: 'diurnal',
  locomotion: 'land',
  diet: 'herbivore',
  behaviors: ['grazing', 'sleeping', 'courting'],
  ...over,
});

const input = (over: Partial<AIInput> = {}): AIInput => ({
  dt: 0.1,
  distToPlayer: 200,
  angleToPlayer: 0,
  playerNoise: 0.1,
  playerFacing: false,
  timeOfDay: 'day',
  angleToHome: 0,
  distToHome: 0,
  ...over,
});

describe('CreatureAI', () => {
  it('ist deterministisch bei gleichem Zufallsstrom', () => {
    const a = new CreatureAI(profile(), () => new Random('ai').next());
    const ra = new Random('ai');
    const rb = new Random('ai');
    const ai1 = new CreatureAI(profile(), () => ra.next());
    const ai2 = new CreatureAI(profile(), () => rb.next());
    const states1: string[] = [];
    const states2: string[] = [];
    for (let i = 0; i < 600; i++) {
      ai1.update(input());
      ai2.update(input());
      states1.push(ai1.state);
      states2.push(ai2.state);
    }
    expect(states1).toEqual(states2);
    expect(new Set(states1).size).toBeGreaterThan(1);
    void a;
  });

  it('scheue Tiere flüchten vor lautem, nahem Spieler', () => {
    const rng = new Random('flee');
    const ai = new CreatureAI(profile(), () => rng.next());
    ai.update(input({ distToPlayer: 6, playerNoise: 1, playerFacing: true, angleToPlayer: 1 }));
    expect(ai.state).toBe('flee');
    expect(ai.targetSpeed).toBe(1);
    // Fluchtrichtung zeigt vom Spieler weg (≈ Winkel + π)
    const diff = Math.abs(((ai.heading - (1 + Math.PI) + Math.PI) % (2 * Math.PI)) - Math.PI);
    expect(diff).toBeLessThan(0.6);
  });

  it('ruhige Beobachter in Distanz lösen keine Flucht aus', () => {
    const rng = new Random('calm');
    const ai = new CreatureAI(profile({ temperament: 'neutral', shyness: 0.3 }), () => rng.next());
    for (let i = 0; i < 50; i++) ai.update(input({ distToPlayer: 40, playerNoise: 0.05 }));
    expect(ai.state).not.toBe('flee');
  });

  it('tagaktive Tiere schlafen nachts irgendwann', () => {
    const rng = new Random('sleep');
    const ai = new CreatureAI(profile(), () => rng.next());
    let slept = false;
    for (let i = 0; i < 3000 && !slept; i++) {
      ai.update(input({ timeOfDay: 'night' }));
      if (ai.state === 'sleep') slept = true;
    }
    expect(slept).toBe(true);
  });

  it('neugierige Tiere nähern sich', () => {
    const rng = new Random('curious');
    const ai = new CreatureAI(profile({ temperament: 'curious', shyness: 0.2 }), () => rng.next());
    let curious = false;
    for (let i = 0; i < 600 && !curious; i++) {
      ai.update(input({ distToPlayer: 20, playerNoise: 0.1, angleToPlayer: 2 }));
      if (ai.state === 'curious') curious = true;
    }
    expect(curious).toBe(true);
    expect(Math.abs(ai.heading - 2)).toBeLessThan(0.01);
  });
});
