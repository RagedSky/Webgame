import { describe, expect, it } from 'vitest';
import { BUILTIN_PRESETS, CHARACTER_VERSION, HELMET_SHAPES, decodeShareCode, defaultCharacter, encodeShareCode, migrateCharacter, randomCharacter, sanitizeCharacter } from './Character';
import { BACKGROUNDS, bonusesFor, scaleCost } from './backgrounds';
import { Random } from '@/math/Random';

describe('CharacterConfig', () => {
  it('begrenzt Werte und ersetzt ungültige Felder', () => {
    const c = sanitizeCharacter({ name: '  Nova  ', body: { height: 7, build: -2 }, suit: { primary: '#ABCDEF', pattern: 'karo', armor: 3 }, helmet: { shape: 'eckig', visorTint: 'gold' }, gear: { pack: 'koffer' }, background: 'pilot' });
    expect(c.name).toBe('Nova');
    expect(c.body.height).toBe(1);
    expect(c.body.build).toBe(0);
    expect(c.suit.primary).toBe('#abcdef');
    expect(c.suit.pattern).toBe('solid');
    expect(c.suit.armor).toBe(1);
    expect(c.helmet.shape).toBe('round');
    expect(c.helmet.visorTint).toBe(defaultCharacter().helmet.visorTint);
    expect(c.gear.pack).toBe('compact');
    expect(c.background).toBe('biologist');
    expect(migrateCharacter(undefined)).toEqual(defaultCharacter());
    expect(sanitizeCharacter({ name: 'x'.repeat(40) }).name.length).toBe(24);
  });

  it('übernimmt Stände der Version 1 ohne Gesicht und Haare', () => {
    const old = {
      version: 1,
      name: 'Mira',
      body: { height: 0.8, build: 0.3, shoulders: 0.6, legLength: 0.7 },
      face: { jaw: 0.5, eyeSize: 0.5, eyeSpacing: 0.5, nose: 0.5, skinTone: 0.3, skinHue: 0.5, eyeColor: '#4a7fb5', markings: 'freckles' },
      hair: { style: 'bun', color: '#1a1410', beard: 'none' },
      suit: { primary: '#c94f3a', secondary: '#2a2a30', accent: '#ffd34d', pattern: 'hex', badge: 'star', helmet: 'off' },
      background: 'geologist',
    };
    const c = migrateCharacter(old);
    expect(c.version).toBe(CHARACTER_VERSION);
    expect(c.name).toBe('Mira');
    expect(c.body).toEqual(old.body);
    expect(c.suit.primary).toBe('#c94f3a');
    expect(c.suit.badge).toBe('star');
    // entfallenes Muster wird auf das nächste passende abgebildet
    expect(c.suit.pattern).toBe('panels');
    expect(migrateCharacter({ suit: { pattern: 'chevron' } }).suit.pattern).toBe('bands');
    expect(c.background).toBe('geologist');
    expect(c.helmet).toEqual(defaultCharacter().helmet);
    expect(Object.keys(c).sort()).toEqual(['background', 'body', 'gear', 'helmet', 'name', 'suit', 'version']);
  });

  it('Zufall ist deterministisch und respektiert Sperren', () => {
    const a = randomCharacter(new Random('CHAR-1'));
    const b = randomCharacter(new Random('CHAR-1'));
    const c = randomCharacter(new Random('CHAR-2'));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    const base = defaultCharacter();
    const locked = randomCharacter(new Random('CHAR-3'), base, { suit: true, gear: true });
    expect(locked.suit).toEqual(base.suit);
    expect(locked.gear).toEqual(base.gear);
    expect(HELMET_SHAPES).toContain(locked.helmet.shape);
  });

  it('Share-Code ist kurz und verlustarm umkehrbar', () => {
    for (let i = 0; i < 20; i++) {
      const c = randomCharacter(new Random(`SHARE-${i}`));
      c.name = i % 2 ? 'Mira Ünal' : 'Kai';
      const code = encodeShareCode(c);
      expect(code.startsWith('SA2.')).toBe(true);
      expect(code.length).toBeLessThan(90);
      const d = decodeShareCode(code)!;
      expect(d).not.toBeNull();
      expect(d.name).toBe(c.name);
      expect(d.helmet).toEqual(c.helmet);
      expect(d.gear).toEqual(c.gear);
      expect(d.background).toBe(c.background);
      expect({ ...d.suit, armor: 0 }).toEqual({ ...c.suit, armor: 0 });
      expect(Math.abs(d.suit.armor - c.suit.armor)).toBeLessThan(0.002);
      expect(Math.abs(d.body.height - c.body.height)).toBeLessThan(0.002);
    }
    expect(decodeShareCode('SA2.zz.x')).toBeNull();
    expect(decodeShareCode('hallo')).toBeNull();
  });

  it('liest Share-Codes der Version 1', () => {
    const d = decodeShareCode('SA1.i0g7i0i0i0i0i0i0jsi04a7fb5003b2a1a0c94f3a2a2a30ffd34d3202.Kai')!;
    expect(d).not.toBeNull();
    expect(d.name).toBe('Kai');
    expect(d.suit.primary).toBe('#c94f3a');
    expect(d.suit.secondary).toBe('#2a2a30');
    expect(d.suit.accent).toBe('#ffd34d');
    expect(d.suit.pattern).toBe('panels');
    expect(d.suit.badge).toBe('star');
    expect(d.background).toBe('engineer');
    expect(Math.abs(d.body.height - 0.5)).toBeLessThan(0.01);
    expect(d.helmet).toEqual(defaultCharacter().helmet);
  });

  it('mitgelieferte Presets sind gültig und eindeutig, Hintergründe haben Boni', () => {
    const ids = new Set(BUILTIN_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(BUILTIN_PRESETS.length);
    for (const p of BUILTIN_PRESETS) expect(sanitizeCharacter(p.config)).toEqual(p.config);
    expect(BACKGROUNDS.length).toBe(4);
    expect(bonusesFor('engineer').costFactor).toBeLessThan(1);
    expect(bonusesFor(null).costFactor).toBe(1);
    expect(scaleCost({ ferrite: 10, quartz: 3, fiber: 1 }, 0.8)).toEqual({ ferrite: 8, quartz: 3, fiber: 1 });
    expect(scaleCost({ ferrite: 10 }, 1)).toEqual({ ferrite: 10 });
  });
});
