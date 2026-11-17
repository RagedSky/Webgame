/**
 * Charakter (rein): parametrische Konfiguration mit Versionierung, Begrenzung, Zufall (seedbar),
 * kurzem Share-Code und Migration. Darstellung in world/character/CharacterBuilder.ts.
 *
 * Version 2: Der Helm bleibt immer geschlossen, Gesicht und Haare entfallen. Dafür sind Helmform, Visier,
 * Helmaufsatz, Panzerung, Lackierung und Rucksack wählbar. Ältere Stände werden übernommen (Körper, Farben,
 * Muster, Abzeichen, Hintergrund), die Gesichtswerte verworfen.
 */
import type { Random } from '@/math/Random';
import { clamp01 } from '@/math/utils';

export const CHARACTER_VERSION = 2;

export const SUIT_PATTERNS = ['solid', 'stripes', 'panels', 'split', 'bands'] as const;
export type SuitPattern = (typeof SUIT_PATTERNS)[number];
export const SUIT_FINISHES = ['matt', 'satin', 'gloss'] as const;
export type SuitFinish = (typeof SUIT_FINISHES)[number];
export const BADGES = ['none', 'archive', 'star', 'leaf', 'crystal'] as const;
export type BadgeKind = (typeof BADGES)[number];
export const HELMET_SHAPES = ['round', 'wide', 'tall', 'angular'] as const;
export type HelmetShape = (typeof HELMET_SHAPES)[number];
export const VISOR_STYLES = ['panorama', 'band', 'window', 'slit'] as const;
export type VisorStyle = (typeof VISOR_STYLES)[number];
export const CRESTS = ['none', 'fin', 'antenna', 'lamps'] as const;
export type CrestKind = (typeof CRESTS)[number];
export const PACKS = ['compact', 'tanks', 'explorer', 'none'] as const;
export type PackKind = (typeof PACKS)[number];
export const BACKGROUND_IDS = ['biologist', 'geologist', 'engineer', 'photographer'] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export interface CharacterConfig {
  version: number;
  name: string;
  /** Alle Regler 0..1. */
  body: { height: number; build: number; shoulders: number; legLength: number };
  suit: { primary: string; secondary: string; accent: string; pattern: SuitPattern; finish: SuitFinish; armor: number; badge: BadgeKind };
  helmet: { shape: HelmetShape; visor: VisorStyle; visorTint: string; crest: CrestKind };
  gear: { pack: PackKind };
  background: BackgroundId;
}

export const PATTERN_LABELS: Record<SuitPattern, string> = { solid: 'Einfarbig', stripes: 'Seitenstreifen', panels: 'Abgesetzte Platten', split: 'Zweigeteilt', bands: 'Bänder' };
export const FINISH_LABELS: Record<SuitFinish, string> = { matt: 'Matt', satin: 'Seidenmatt', gloss: 'Hochglanz' };
export const BADGE_LABELS: Record<BadgeKind, string> = { none: 'Kein Abzeichen', archive: 'Archiv-Siegel', star: 'Stern', leaf: 'Blatt', crystal: 'Kristall' };
export const HELMET_SHAPE_LABELS: Record<HelmetShape, string> = { round: 'Rund', wide: 'Breit', tall: 'Hoch', angular: 'Kantig' };
export const VISOR_LABELS: Record<VisorStyle, string> = { panorama: 'Panorama', band: 'Sichtband', window: 'Fenster', slit: 'Sehschlitz' };
export const CREST_LABELS: Record<CrestKind, string> = { none: 'Kein Aufsatz', fin: 'Kamm', antenna: 'Antenne', lamps: 'Stirnlampen' };
export const PACK_LABELS: Record<PackKind, string> = { compact: 'Kompakt', tanks: 'Doppeltank', explorer: 'Expedition', none: 'Ohne Rucksack' };

const HEX = /^#[0-9a-f]{6}$/i;
/** Muster aus Version 1, die es nicht mehr gibt. */
const PATTERN_ALIASES: Record<string, SuitPattern> = { chevron: 'bands', hex: 'panels' };

export function defaultCharacter(): CharacterConfig {
  return {
    version: CHARACTER_VERSION,
    name: 'Archivar',
    body: { height: 0.5, build: 0.45, shoulders: 0.5, legLength: 0.5 },
    suit: { primary: '#d9b36a', secondary: '#2f3a48', accent: '#41b8ff', pattern: 'solid', finish: 'satin', armor: 0.5, badge: 'archive' },
    helmet: { shape: 'round', visor: 'panorama', visorTint: '#1b2f52', crest: 'antenna' },
    gear: { pack: 'compact' },
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
  const c = (input ?? {}) as { name?: unknown; background?: unknown; body?: Partial<CharacterConfig['body']>; suit?: Partial<Record<keyof CharacterConfig['suit'], unknown>>; helmet?: Partial<Record<keyof CharacterConfig['helmet'], unknown>>; gear?: Partial<Record<keyof CharacterConfig['gear'], unknown>> };
  const name = typeof c.name === 'string' ? c.name.trim().slice(0, 24) : '';
  const pattern = typeof c.suit?.pattern === 'string' ? (PATTERN_ALIASES[c.suit.pattern] ?? c.suit.pattern) : undefined;
  return {
    version: CHARACTER_VERSION,
    name: name || d.name,
    body: { height: num(c.body?.height, d.body.height), build: num(c.body?.build, d.body.build), shoulders: num(c.body?.shoulders, d.body.shoulders), legLength: num(c.body?.legLength, d.body.legLength) },
    suit: {
      primary: color(c.suit?.primary, d.suit.primary),
      secondary: color(c.suit?.secondary, d.suit.secondary),
      accent: color(c.suit?.accent, d.suit.accent),
      pattern: pickEnum(pattern, SUIT_PATTERNS, d.suit.pattern),
      finish: pickEnum(c.suit?.finish, SUIT_FINISHES, d.suit.finish),
      armor: num(c.suit?.armor, d.suit.armor),
      badge: pickEnum(c.suit?.badge, BADGES, d.suit.badge),
    },
    helmet: {
      shape: pickEnum(c.helmet?.shape, HELMET_SHAPES, d.helmet.shape),
      visor: pickEnum(c.helmet?.visor, VISOR_STYLES, d.helmet.visor),
      visorTint: color(c.helmet?.visorTint, d.helmet.visorTint),
      crest: pickEnum(c.helmet?.crest, CRESTS, d.helmet.crest),
    },
    gear: { pack: pickEnum(c.gear?.pack, PACKS, d.gear.pack) },
    background: pickEnum(c.background, BACKGROUND_IDS, d.background),
  };
}

/**
 * Migration älterer Konfigurationen: Version 1 trug Gesicht, Haare und einen Helmmodus. Körper, Anzugfarben, Muster,
 * Abzeichen und Hintergrund bleiben erhalten, alles Übrige bekommt Standardwerte.
 */
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

/** Visiertönungen: Tiefblau, Gold, Kupfer, Smaragd, Violett, Rauchgrau, Eisblau. */
export const VISOR_TINTS = ['#1b2f52', '#c98a2b', '#a8482c', '#1f6b55', '#5b3a8f', '#2a2d33', '#6fb6d6'] as const;

export interface CharacterLocks {
  body?: boolean;
  suit?: boolean;
  helmet?: boolean;
  gear?: boolean;
}

/** Zufallscharakter (deterministisch aus dem PRNG). `locks` hält Gruppen fest. */
export function randomCharacter(rng: Random, base: CharacterConfig = defaultCharacter(), locks: CharacterLocks = {}): CharacterConfig {
  const r = rng.fork('character');
  const out: CharacterConfig = JSON.parse(JSON.stringify(base)) as CharacterConfig;
  if (!locks.body) out.body = { height: r.float(0.15, 0.95), build: r.float(0.1, 0.95), shoulders: r.float(0.2, 0.9), legLength: r.float(0.25, 0.8) };
  if (!locks.suit) {
    const [p, s, a] = r.pick(SUIT_PALETTES);
    out.suit = { primary: p, secondary: s, accent: a, pattern: r.pick(SUIT_PATTERNS), finish: r.pick(SUIT_FINISHES), armor: r.float(0.1, 1), badge: r.pick(BADGES) };
  }
  if (!locks.helmet) out.helmet = { shape: r.pick(HELMET_SHAPES), visor: r.pick(VISOR_STYLES), visorTint: r.pick(VISOR_TINTS), crest: r.pick(CRESTS) };
  if (!locks.gear) out.gear = { pack: r.pick(PACKS) };
  return sanitizeCharacter(out);
}

// ---------------------------------------------------------------------------
// Share-Code: kompakt, kopierbar. Aufbau: "SA2." + Base36-Quantisierung aller Regler/Auswahlen + "." + Name (URL-kodiert).
// Codes der Version 1 ("SA1.") werden weiter gelesen; Gesicht und Haare darin werden übersprungen.
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
    hexBody(c.suit.primary), hexBody(c.suit.secondary), hexBody(c.suit.accent),
    ALPHABET[SUIT_PATTERNS.indexOf(c.suit.pattern)], ALPHABET[SUIT_FINISHES.indexOf(c.suit.finish)], q(c.suit.armor), ALPHABET[BADGES.indexOf(c.suit.badge)],
    ALPHABET[HELMET_SHAPES.indexOf(c.helmet.shape)], ALPHABET[VISOR_STYLES.indexOf(c.helmet.visor)], hexBody(c.helmet.visorTint), ALPHABET[CRESTS.indexOf(c.helmet.crest)],
    ALPHABET[PACKS.indexOf(c.gear.pack)],
    ALPHABET[BACKGROUND_IDS.indexOf(c.background)],
  ];
  return `SA2.${parts.join('')}.${encodeURIComponent(c.name)}`;
}

export function decodeShareCode(code: string): CharacterConfig | null {
  const m = /^SA([12])\.([0-9a-z]+)\.(.*)$/i.exec(code.trim());
  if (!m) return null;
  const legacy = m[1] === '1';
  const s = (m[2] ?? '').toLowerCase();
  let i = 0;
  const take = (n: number): string => {
    const out = s.slice(i, i + n);
    i += n;
    return out;
  };
  const idx = (ch: string, len: number): number => Math.max(0, Math.min(len - 1, ALPHABET.indexOf(ch)));
  const d = defaultCharacter();
  try {
    const name = decodeURIComponent(m[3] ?? '');
    const body = { height: dq(take(2)), build: dq(take(2)), shoulders: dq(take(2)), legLength: dq(take(2)) };
    let cfg: unknown;
    if (legacy) {
      // Version 1: Gesicht (12 + 6 + 1), Haare (1 + 6 + 1) überspringen, dann Anzug, Helmmodus, Hintergrund
      take(27);
      const suit = { primary: `#${take(6)}`, secondary: `#${take(6)}`, accent: `#${take(6)}`, pattern: ['solid', 'stripes', 'chevron', 'panels', 'hex'][idx(take(1), 5)], badge: BADGES[idx(take(1), BADGES.length)] };
      take(1);
      cfg = { name, body, suit, helmet: d.helmet, gear: d.gear, background: BACKGROUND_IDS[idx(take(1), BACKGROUND_IDS.length)] };
    } else {
      const suit = {
        primary: `#${take(6)}`, secondary: `#${take(6)}`, accent: `#${take(6)}`,
        pattern: SUIT_PATTERNS[idx(take(1), SUIT_PATTERNS.length)], finish: SUIT_FINISHES[idx(take(1), SUIT_FINISHES.length)], armor: dq(take(2)), badge: BADGES[idx(take(1), BADGES.length)],
      };
      const helmet = { shape: HELMET_SHAPES[idx(take(1), HELMET_SHAPES.length)], visor: VISOR_STYLES[idx(take(1), VISOR_STYLES.length)], visorTint: `#${take(6)}`, crest: CRESTS[idx(take(1), CRESTS.length)] };
      const gear = { pack: PACKS[idx(take(1), PACKS.length)] };
      cfg = { name, body, suit, helmet, gear, background: BACKGROUND_IDS[idx(take(1), BACKGROUND_IDS.length)] };
    }
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
    c.suit = { primary: '#b35b2f', secondary: '#3a2a1f', accent: '#ffd34d', pattern: 'panels', finish: 'matt', armor: 0.8, badge: 'crystal' };
    c.helmet = { shape: 'angular', visor: 'band', visorTint: '#c98a2b', crest: 'lamps' };
    c.gear = { pack: 'explorer' };
  }),
  preset('schrauber', 'Schrauber', (c) => {
    c.background = 'engineer';
    c.body = { height: 0.4, build: 0.85, shoulders: 0.8, legLength: 0.4 };
    c.suit = { primary: '#2f3a48', secondary: '#d9b36a', accent: '#ff9f40', pattern: 'stripes', finish: 'satin', armor: 1, badge: 'none' };
    c.helmet = { shape: 'wide', visor: 'window', visorTint: '#2a2d33', crest: 'lamps' };
    c.gear = { pack: 'tanks' };
  }),
  preset('linse', 'Linse', (c) => {
    c.background = 'photographer';
    c.body = { height: 0.7, build: 0.25, shoulders: 0.4, legLength: 0.65 };
    c.suit = { primary: '#e8e2d6', secondary: '#4a4e57', accent: '#ff6b6b', pattern: 'bands', finish: 'gloss', armor: 0.2, badge: 'star' };
    c.helmet = { shape: 'round', visor: 'panorama', visorTint: '#6fb6d6', crest: 'none' };
    c.gear = { pack: 'compact' };
  }),
  preset('leuchtfeuer', 'Leuchtfeuer', (c) => {
    c.background = 'biologist';
    c.suit = { primary: '#8a4fb3', secondary: '#2b1f3a', accent: '#5ee39a', pattern: 'split', finish: 'gloss', armor: 0.4, badge: 'leaf' };
    c.helmet = { shape: 'tall', visor: 'slit', visorTint: '#1f6b55', crest: 'fin' };
    c.gear = { pack: 'none' };
  }),
  preset('veteran', 'Veteran', (c) => {
    c.background = 'engineer';
    c.body = { height: 0.6, build: 0.6, shoulders: 0.7, legLength: 0.5 };
    c.suit = { primary: '#3f8f7a', secondary: '#1f2a2a', accent: '#9fe3c8', pattern: 'solid', finish: 'matt', armor: 0.9, badge: 'archive' };
    c.helmet = { shape: 'angular', visor: 'slit', visorTint: '#a8482c', crest: 'antenna' };
    c.gear = { pack: 'tanks' };
  }),
];
