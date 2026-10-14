import { describe, expect, it } from 'vitest';
import { BUILTIN_PRESETS, decodeShareCode, defaultCharacter, encodeShareCode, migrateCharacter, randomCharacter, sanitizeCharacter, HAIR_STYLES } from './Character';
import { BACKGROUNDS, bonusesFor, scaleCost } from './backgrounds';
import { Random } from '@/math/Random';

describe('CharacterConfig', () => {
  it('begrenzt Werte und ersetzt ungültige Felder', () => {
    const c = sanitizeCharacter({ name: '  Nova  ', body: { height: 7, build: -2 }, face: { eyeColor: 'rot', markings: 'tattoo' }, hair: { style: 'afro' }, suit: { primary: '#ABCDEF' }, background: 'pilot' });
    expect(c.name).toBe('Nova');
    expect(c.body.height).toBe(1);
    expect(c.body.build).toBe(0);
    expect(c.face.eyeColor).toBe(defaultCharacter().face.eyeColor);
    expect(c.face.markings).toBe('none');
    expect(c.hair.style).toBe('short');
    expect(c.suit.primary).toBe('#abcdef');
    expect(c.background).toBe('biologist');
    expect(migrateCharacter(undefined)).toEqual(defaultCharacter());
    expect(sanitizeCharacter({ name: 'x'.repeat(40) }).name.length).toBe(24);
  });

  it('Zufall ist deterministisch und respektiert Sperren', () => {
    const a = randomCharacter(new Random('CHAR-1'));
    const b = randomCharacter(new Random('CHAR-1'));
    const c = randomCharacter(new Random('CHAR-2'));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    const base = defaultCharacter();
    const locked = randomCharacter(new Random('CHAR-3'), base, { face: true, suit: true });
    expect(locked.face).toEqual(base.face);
    expect(locked.suit).toEqual(base.suit);
    expect(HAIR_STYLES).toContain(locked.hair.style);
  });

  it('Share-Code ist kurz und verlustarm umkehrbar', () => {
    for (let i = 0; i < 20; i++) {
      const c = randomCharacter(new Random(`SHARE-${i}`));
      c.name = i % 2 ? 'Mira Ünal' : 'Kai';
      const code = encodeShareCode(c);
      expect(code.length).toBeLessThan(110);
      const d = decodeShareCode(code)!;
      expect(d).not.toBeNull();
      expect(d.name).toBe(c.name);
      expect(d.hair).toEqual(c.hair);
      expect(d.suit).toEqual(c.suit);
      expect(d.background).toBe(c.background);
      expect(d.face.eyeColor).toBe(c.face.eyeColor);
      expect(d.face.markings).toBe(c.face.markings);
      expect(Math.abs(d.body.height - c.body.height)).toBeLessThan(0.002);
      expect(Math.abs(d.face.jaw - c.face.jaw)).toBeLessThan(0.002);
    }
    expect(decodeShareCode('SA1.zz.x')).toBeNull();
    expect(decodeShareCode('hallo')).toBeNull();
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
