import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '@/config/keybindings';
import { bindingLabel, conflictsFor, isDefaultBinding, keyName, sanitizeBindings, withBinding, withDefaultBinding } from './Keybindings';

describe('Keybindings', () => {
  it('bereinigt gespeicherte Belegungen und lässt feste Aktionen unverändert', () => {
    const b = sanitizeBindings({ move_forward: ['KeyZ', 'ArrowUp', 'KeyQ'], pause: ['KeyP'], jump: 'Space', unknown: ['KeyX'], sprint: ['bad code!'] });
    expect(b.move_forward).toEqual(['KeyZ', 'ArrowUp']);
    expect(b.pause).toEqual(DEFAULT_BINDINGS.pause);
    expect(b.jump).toEqual(DEFAULT_BINDINGS.jump);
    expect(b.sprint).toEqual(DEFAULT_BINDINGS.sprint);
    expect(sanitizeBindings(null)).toEqual(DEFAULT_BINDINGS);
  });

  it('setzt Primärtasten, erkennt Konflikte und Standard', () => {
    let b = sanitizeBindings(undefined);
    b = withBinding(b, 'interact', 'KeyF');
    expect(b.interact).toEqual(['KeyF', 'KeyE']);
    expect(isDefaultBinding(b, 'interact')).toBe(false);
    expect(conflictsFor(b, 'interact', 'KeyF')).toEqual(expect.arrayContaining(['photo_filter', 'sample']));
    b = withDefaultBinding(b, 'interact');
    expect(isDefaultBinding(b, 'interact')).toBe(true);
    expect(withBinding(b, 'pause', 'KeyP').pause).toEqual(['Escape']);
  });

  it('formatiert Tastennamen lesbar', () => {
    expect(keyName('KeyW')).toBe('W');
    expect(keyName('Digit3')).toBe('3');
    expect(keyName('Space')).toBe('Leertaste');
    expect(keyName('Numpad5')).toBe('Num 5');
    expect(keyName('F7')).toBe('F7');
    expect(bindingLabel(['ShiftLeft', 'ShiftRight'])).toBe('Shift / Shift (rechts)');
  });
});
