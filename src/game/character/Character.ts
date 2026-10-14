/**
 * Charakter (rein): parametrische Konfiguration mit Versionierung, Begrenzung, Zufall (seedbar),
 * kurzem Share-Code und Migration. Darstellung in world/character/CharacterBuilder.ts.
 */
import type { Random } from '@/math/Random';
import { clamp01 } from '@/math/utils';

export const CHARACTER_VERSION = 1;

export const HAIR_STYLES = ['short', 'buzz', 'long', 'bun', 'ponytail', 'mohawk', 'bob', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const BEARD_STYLES = ['none', 'stubble', 'full', 'goatee'] as const;
export type BeardStyle = (typeof BEARD_STYLES)[number];
export const SUIT_PATTERNS = ['solid', 'stripes', 'chevron', 'panels', 'hex'] as const;
export type SuitPattern = (typeof SUIT_PATTERNS)[number];
export const BADGES = ['none', 'archive', 'star', 'leaf', 'crystal'] as const;
export type BadgeKind = (typeof BADGES)[number];
export const MARKINGS = ['none', 'freckles', 'glow', 'scar'] as const;
export type MarkingKind = (typeof MARKINGS)[number];
export const HELMET_MODES = ['auto', 'on', 'off'] as const;
export type HelmetMode = (typeof HELMET_MODES)[number];
export const BACKGROUND_IDS = ['biologist', 'geologist', 'engineer', 'photographer'] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export interface CharacterConfig {
  version: number;
  name: string;
  /** Alle Regler 0..1. */
  body: { height: number; build: number; shoulders: number; legLength: number };
  face: { jaw: number; eyeSize: number; eyeSpacing: number; nose: number; skinTone: number; skinHue: number; eyeColor: string; markings: MarkingKind };
  hair: { style: HairStyle; color: string; beard: BeardStyle };
  suit: { primary: string; secondary: string; accent: string; pattern: SuitPattern; badge: BadgeKind; helmet: HelmetMode };
  background: BackgroundId;
}

export const HAIR_LABELS: Record<HairStyle, string> = { short: 'Kurz', buzz: 'Stoppeln', long: 'Lang', bun: 'Dutt', ponytail: 'Pferdeschwanz', mohawk: 'Irokese', bob: 'Bob', bald: 'Glatze' };
export const BEARD_LABELS: Record<BeardStyle, string> = { none: 'Kein Bart', stubble: 'Stoppelbart', full: 'Vollbart', goatee: 'Kinnbart' };
export const PATTERN_LABELS: Record<SuitPattern, string> = { solid: 'Einfarbig', stripes: 'Streifen', chevron: 'Winkel', panels: 'Schulterpanels', hex: 'Wabenplatten' };
export const BADGE_LABELS: Record<BadgeKind, string> = { none: 'Kein Abzeichen', archive: 'Archiv-Siegel', star: 'Stern', leaf: 'Blatt', crystal: 'Kristall' };
export const MARKING_LABELS: Record<MarkingKind, string> = { none: 'Keine', freckles: 'Sommersprossen', glow: 'Leuchtadern', scar: 'Narbe' };
export const HELMET_LABELS: Record<HelmetMode, string> = { auto: 'Automatisch (nicht atembar)', on: 'Immer', off: 'Nie' };

const HEX = /^#[0-9a-f]{6}$/i;

export function defaultCharacter(): CharacterConfig {
  return {
    version: CHARACTER_VERSION,
    name: 'Archivar',
    body: { height: 0.5, build: 0.45, shoulders: 0.5, legLength: 0.5 },
    face: { jaw: 0.5, eyeSize: 0.5, eyeSpacing: 0.5, nose: 0.5, skinTone: 0.55, skinHue: 0.5, eyeColor: '#4a7fb5', markings: 'none' },
    hair: { style: 'short', color: '#3b2a1a', beard: 'none' },
    suit: { primary: '#d9b36a', secondary: '#2f3a48', accent: '#41b8ff', pattern: 'solid', badge: 'archive', helmet: 'auto' },
    background: 'biologist',
  };
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? clamp01(n) : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback;
}

/** Begrenzt alle Werte und ersetzt ungültige Felder durch Standardwerte (auch für Migration älterer Stände). */
export function sanitizeCharacter(input: unknown): CharacterConfig {
  const d = defaultCharacter();
  const c = (input ?? {}) as Partial<CharacterConfig> & { body?: Partial<CharacterConfig['body']>; face?: Partial<CharacterConfig['face']>; hair?: Partial<CharacterConfig['hair']>; suit?: Partial<CharacterConfig['suit']> };
  const name = typeof c.name === 'string' ? c.name.trim().slice(0, 24) : '';
  return {
    version: CHARACTER_VERSION,
    name: name || d.name,
    body: { height: num(c.body?.height, d.body.height), build: num(c.body?.build, d.body.build), shoulders: num(c.body?.shoulders, d.body.shoulders), legLength: num(c.body?.legLength, d.body.legLength) },
    face: {
      jaw: num(c.face?.jaw, d.face.jaw),
      eyeSize: num(c.face?.eyeSize, d.face.eyeSize),
      eyeSpacing: num(c.face?.eyeSpacing, d.face.eyeSpacing),
      nose: num(c.face?.nose, d.face.nose),
      skinTone: num(c.face?.skinTone, d.face.skinTone),
      skinHue: num(c.face?.skinHue, d.face.skinHue),
      eyeColor: color(c.face?.eyeColor, d.face.eyeColor),
      markings: pickEnum(c.face?.markings, MARKINGS, d.face.markings),
    },
    hair: { style: pickEnum(c.hair?.style, HAIR_STYLES, d.hair.style), color: color(c.hair?.color, d.hair.color), beard: pickEnum(c.hair?.beard, BEARD_STYLES, d.hair.beard) },
    suit: {
      primary: color(c.suit?.primary, d.suit.primary),
      secondary: color(c.suit?.secondary, d.suit.secondary),
      accent: color(c.suit?.accent, d.suit.accent),
      pattern: pickEnum(c.suit?.pattern, SUIT_PATTERNS, d.suit.pattern),
      badge: pickEnum(c.suit?.badge, BADGES, d.suit.badge),
      helmet: pickEnum(c.suit?.helmet, HELMET_MODES, d.suit.helmet),
    },
    background: pickEnum(c.background, BACKGROUND_IDS, d.background),
  };
}

/** Migration älterer Konfigurationen (derzeit nur Version 1; unbekannte Felder werden verworfen). */
export function migrateCharacter(input: unknown): CharacterConfig {
  return sanitizeCharacter(input);
}

export const SUIT_PALETTES: Array<[string, string, string]> = [
  ['#d9b36a', '#2f3a48', '#41b8ff'],
  ['#c94f3a', '#2a2a30', '#ffd34d'],
  ['#3f8f7a', '#1f2a2a', '#9fe3c8'],
  ['#5a6fd1', '#1c2238', '#ff9f40'],
  ['#e8e2d6', '#4a4e57', '#ff6b6b'],
  ['#8a4fb3', '#2b1f3a', '#5ee39a'],
  ['#2f3a48', '#d9b36a', '#ffffff'],
  ['#b35b2f', '#3a2a1f', '#8fe3ff'],
];

const HAIR_COLORS = ['#1a1410', '#3b2a1a', '#6b4a2a', '#b07a3a', '#d8b06a', '#e8e0d0', '#8a2f2f', '#2f4a8a', '#3f8f5a', '#9a4fb3'];
const EYE_COLORS = ['#4a7fb5', '#3f8f5a', '#6b4a2a', '#8a8f9a', '#b3a24f', '#9a4fb3', '#e04f4f'];

/** Zufallscharakter (deterministisch aus dem PRNG). `locks` hält Gruppen fest. */
export function randomCharacter(rng: Random, base: CharacterConfig = defaultCharacter(), locks: { body?: boolean; face?: boolean; hair?: boolean; suit?: boolean } = {}): CharacterConfig {
  const r = rng.fork('character');
  const out: CharacterConfig = JSON.parse(JSON.stringify(base)) as CharacterConfig;
  if (!locks.body) out.body = { height: r.float(0.15, 0.95), build: r.float(0.1, 0.95), shoulders: r.float(0.2, 0.9), legLength: r.float(0.25, 0.8) };
  if (!locks.face) {
    out.face = { jaw: r.float(0.1, 0.9), eyeSize: r.float(0.2, 0.9), eyeSpacing: r.float(0.3, 0.8), nose: r.float(0.2, 0.9), skinTone: r.float(0.08, 0.95), skinHue: r.float(0.2, 0.8), eyeColor: r.pick(EYE_COLORS), markings: r.bool(0.35) ? r.pick(MARKINGS.slice(1)) : 'none' };
  }
  if (!locks.hair) out.hair = { style: r.pick(HAIR_STYLES), color: r.pick(HAIR_COLORS), beard: r.bool(0.4) ? r.pick(BEARD_STYLES.slice(1)) : 'none' };
  if (!locks.suit) {
    const [p, s, a] = r.pick(SUIT_PALETTES);
    out.suit = { primary: p, secondary: s, accent: a, pattern: r.pick(SUIT_PATTERNS), badge: r.pick(BADGES), helmet: 'auto' };
  }
  return sanitizeCharacter(out);
}

// ---------------------------------------------------------------------------
// Share-Code: kompakt, kopierbar. Aufbau: "SA1." + Base36-Quantisierung aller Regler/Auswahlen + "." + Name (URL-kodiert).
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function q(v: number): string {
  const n = Math.round(clamp01(v) * 1295);
  return `${ALPHABET[Math.floor(n / 36)]}${ALPHABET[n % 36]}`;
}

function dq(s: string): number {
  return (ALPHABET.indexOf(s[0] ?? '0') * 36 + ALPHABET.indexOf(s[1] ?? '0')) / 1295;
}

function hexBody(c: string): string {
  return c.replace('#', '').toLowerCase();
}

export function encodeShareCode(cfg: CharacterConfig): string {
  const c = sanitizeCharacter(cfg);
  const parts = [
    q(c.body.height), q(c.body.build), q(c.body.shoulders), q(c.body.legLength),
    q(c.face.jaw), q(c.face.eyeSize), q(c.face.eyeSpacing), q(c.face.nose), q(c.face.skinTone), q(c.face.skinHue),
    hexBody(c.face.eyeColor), ALPHABET[MARKINGS.indexOf(c.face.markings)],
    ALPHABET[HAIR_STYLES.indexOf(c.hair.style)], hexBody(c.hair.color), ALPHABET[BEARD_STYLES.indexOf(c.hair.beard)],
    hexBody(c.suit.primary), hexBody(c.suit.secondary), hexBody(c.suit.accent),
    ALPHABET[SUIT_PATTERNS.indexOf(c.suit.pattern)], ALPHABET[BADGES.indexOf(c.suit.badge)], ALPHABET[HELMET_MODES.indexOf(c.suit.helmet)],
    ALPHABET[BACKGROUND_IDS.indexOf(c.background)],
  ];
  return `SA1.${parts.join('')}.${encodeURIComponent(c.name)}`;
}

export function decodeShareCode(code: string): CharacterConfig | null {
  const m = /^SA1\.([0-9a-z]+)\.(.*)$/i.exec(code.trim());
  if (!m) return null;
  const s = (m[1] ?? '').toLowerCase();
  let i = 0;
  const take = (n: number): string => {
    const out = s.slice(i, i + n);
    i += n;
    return out;
  };
  const idx = (ch: string, len: number): number => Math.max(0, Math.min(len - 1, ALPHABET.indexOf(ch)));
  try {
    const cfg: CharacterConfig = {
      version: CHARACTER_VERSION,
      name: decodeURIComponent(m[2] ?? ''),
      body: { height: dq(take(2)), build: dq(take(2)), shoulders: dq(take(2)), legLength: dq(take(2)) },
      face: { jaw: dq(take(2)), eyeSize: dq(take(2)), eyeSpacing: dq(take(2)), nose: dq(take(2)), skinTone: dq(take(2)), skinHue: dq(take(2)), eyeColor: `#${take(6)}`, markings: MARKINGS[idx(take(1), MARKINGS.length)] as MarkingKind },
      hair: { style: HAIR_STYLES[idx(take(1), HAIR_STYLES.length)] as HairStyle, color: `#${take(6)}`, beard: BEARD_STYLES[idx(take(1), BEARD_STYLES.length)] as BeardStyle },
      suit: { primary: `#${take(6)}`, secondary: `#${take(6)}`, accent: `#${take(6)}`, pattern: SUIT_PATTERNS[idx(take(1), SUIT_PATTERNS.length)] as SuitPattern, badge: BADGES[idx(take(1), BADGES.length)] as BadgeKind, helmet: HELMET_MODES[idx(take(1), HELMET_MODES.length)] as HelmetMode },
      background: BACKGROUND_IDS[idx(take(1), BACKGROUND_IDS.length)] as BackgroundId,
    };
    if (i !== s.length) return null;
    return sanitizeCharacter(cfg);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Presets
export interface CharacterPreset {
  id: string;
  name: string;
  config: CharacterConfig;
  builtIn?: boolean;
}

function preset(id: string, name: string, over: (c: CharacterConfig) => void): CharacterPreset {
  const c = defaultCharacter();
  c.name = name;
  over(c);
  return { id, name, config: sanitizeCharacter(c), builtIn: true };
}

export const BUILTIN_PRESETS: CharacterPreset[] = [
  preset('archivar', 'Archivar', (c) => {
    c.background = 'biologist';
  }),
  preset('steinleser', 'Steinleserin', (c) => {
    c.background = 'geologist';
    c.hair = { style: 'bun', color: '#1a1410', beard: 'none' };
    c.suit = { primary: '#b35b2f', secondary: '#3a2a1f', accent: '#ffd34d', pattern: 'panels', badge: 'crystal', helmet: 'auto' };
    c.face.skinTone = 0.3;
  }),
  preset('schrauber', 'Schrauber', (c) => {
    c.background = 'engineer';
    c.body = { height: 0.4, build: 0.85, shoulders: 0.8, legLength: 0.4 };
    c.hair = { style: 'buzz', color: '#6b4a2a', beard: 'full' };
    c.suit = { primary: '#2f3a48', secondary: '#d9b36a', accent: '#ff9f40', pattern: 'stripes', badge: 'none', helmet: 'auto' };
  }),
  preset('linse', 'Linse', (c) => {
    c.background = 'photographer';
    c.body = { height: 0.7, build: 0.25, shoulders: 0.4, legLength: 0.65 };
    c.hair = { style: 'long', color: '#8a2f2f', beard: 'none' };
    c.suit = { primary: '#e8e2d6', secondary: '#4a4e57', accent: '#ff6b6b', pattern: 'chevron', badge: 'star', helmet: 'auto' };
    c.face.markings = 'freckles';
  }),
  preset('leuchtfeuer', 'Leuchtfeuer', (c) => {
    c.background = 'biologist';
    c.hair = { style: 'mohawk', color: '#2f4a8a', beard: 'none' };
    c.suit = { primary: '#8a4fb3', secondary: '#2b1f3a', accent: '#5ee39a', pattern: 'hex', badge: 'leaf', helmet: 'on' };
    c.face.markings = 'glow';
    c.face.eyeColor = '#5ee39a';
  }),
  preset('veteran', 'Veteran', (c) => {
    c.background = 'engineer';
    c.body = { height: 0.6, build: 0.6, shoulders: 0.7, legLength: 0.5 };
    c.hair = { style: 'bald', color: '#e8e0d0', beard: 'goatee' };
    c.face = { ...c.face, jaw: 0.8, skinTone: 0.7, markings: 'scar' };
    c.suit = { primary: '#3f8f7a', secondary: '#1f2a2a', accent: '#9fe3c8', pattern: 'solid', badge: 'archive', helmet: 'auto' };
  }),
];
