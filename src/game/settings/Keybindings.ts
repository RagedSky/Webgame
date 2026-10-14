/**
 * Tastenbelegung (rein): Bereinigen gespeicherter Belegungen, lesbare Tastennamen, Konflikte.
 * Belegungen sind je Aktion eine Liste von `KeyboardEvent.code`-Werten (maximal zwei).
 */
import { DEFAULT_BINDINGS, type GameAction } from '@/config/keybindings';

export type Bindings = Record<GameAction, string[]>;
export const MAX_KEYS_PER_ACTION = 2;
/** Aktionen, die nicht umbelegt werden (Esc bleibt immer Pause/Zurück, F3/F12 sind Debug). */
export const FIXED_ACTIONS: ReadonlySet<GameAction> = new Set<GameAction>(['pause', 'debug', 'screenshot']);

export function defaultBindings(): Bindings {
  return structuredClone(DEFAULT_BINDINGS);
}

/** Gespeicherte Belegung mit den Standardwerten zusammenführen (unbekannte Aktionen/Werte ignorieren). */
export function sanitizeBindings(input: unknown): Bindings {
  const out = defaultBindings();
  if (!input || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;
  for (const action of Object.keys(out) as GameAction[]) {
    if (FIXED_ACTIONS.has(action)) continue;
    const list = raw[action];
    if (!Array.isArray(list)) continue;
    const codes = list.filter((c): c is string => typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c));
    if (codes.length) out[action] = [...new Set(codes)].slice(0, MAX_KEYS_PER_ACTION);
  }
  return out;
}

/** Taste als Primärbelegung setzen; die bisherige Primärtaste rückt auf Platz 2. */
export function withBinding(bindings: Bindings, action: GameAction, code: string): Bindings {
  if (FIXED_ACTIONS.has(action)) return bindings;
  const rest = bindings[action].filter((c) => c !== code);
  return { ...bindings, [action]: [code, ...rest].slice(0, MAX_KEYS_PER_ACTION) };
}

export function withDefaultBinding(bindings: Bindings, action: GameAction): Bindings {
  return { ...bindings, [action]: DEFAULT_BINDINGS[action].slice() };
}

/** Andere Aktionen, die dieselbe Taste nutzen (Hinweis, kein Fehler – Kontexte wie Foto-Modus teilen Tasten). */
export function conflictsFor(bindings: Bindings, action: GameAction, code: string): GameAction[] {
  return (Object.keys(bindings) as GameAction[]).filter((a) => a !== action && bindings[a].includes(code));
}

export function isDefaultBinding(bindings: Bindings, action: GameAction): boolean {
  const a = bindings[action];
  const d = DEFAULT_BINDINGS[action];
  return a.length === d.length && a.every((c, i) => c === d[i]);
}

const SPECIAL: Record<string, string> = {
  Space: 'Leertaste',
  Tab: 'Tab',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: 'Rücktaste',
  Delete: 'Entf',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift (rechts)',
  ControlLeft: 'Strg',
  ControlRight: 'Strg (rechts)',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
  CapsLock: 'Feststell',
  Home: 'Pos1',
  End: 'Ende',
  PageUp: 'Bild ↑',
  PageDown: 'Bild ↓',
  Insert: 'Einfg',
};

/** Lesbarer Name einer Taste („KeyW“ → „W“, „Digit1“ → „1“, „Numpad5“ → „Num 5“). */
export function keyName(code: string): string {
  if (SPECIAL[code]) return SPECIAL[code] as string;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function bindingLabel(codes: readonly string[]): string {
  return codes.map(keyName).join(' / ');
}
