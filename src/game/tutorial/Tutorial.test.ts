import { describe, expect, it } from 'vitest';
import { Tutorial, TUTORIAL_ADVANCE_DELAY, TUTORIAL_STEPS } from './Tutorial';

describe('Tutorial', () => {
  it('rückt nur beim passenden Ereignis und nach der Pause vor', () => {
    const t = new Tutorial();
    expect(t.current?.id).toBe('look');
    expect(t.notify('move')).toBe(false);
    expect(t.look(100)).toBe(false);
    expect(t.look(350)).toBe(true);
    expect(t.justCompleted).toBe(true);
    expect(t.notify('move')).toBe(false); // während der Pause werden keine weiteren Ereignisse gezählt
    expect(t.update(TUTORIAL_ADVANCE_DELAY / 2)).toBe(false);
    expect(t.update(TUTORIAL_ADVANCE_DELAY)).toBe(true);
    expect(t.current?.id).toBe('move');
    expect(t.move(5)).toBe(false);
    expect(t.move(4)).toBe(true);
  });

  it('läuft bis zum Ende durch, ist überspringbar und serialisierbar', () => {
    const t = new Tutorial();
    for (const step of TUTORIAL_STEPS) {
      expect(t.notify(step.done)).toBe(true);
      t.update(TUTORIAL_ADVANCE_DELAY + 0.01);
    }
    expect(t.active).toBe(false);
    expect(t.current).toBeNull();
    const snap = t.toJSON();
    expect(snap).toEqual({ step: TUTORIAL_STEPS.length, done: true });

    const u = new Tutorial({ step: 3, done: false });
    expect(u.current?.id).toBe('photo');
    u.skip();
    expect(u.active).toBe(false);
    expect(new Tutorial(u.toJSON()).active).toBe(false);
    u.restart();
    expect(u.current?.id).toBe('look');
    expect(new Tutorial({ step: 99, done: false }).active).toBe(false);
  });
});
