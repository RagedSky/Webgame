/**
 * Akzentfarbe der gesamten Oberfläche. Sie stammt vom Anzug des Charakters und gilt für HUD, Menüs und Dialoge.
 * Sehr dunkle oder blasse Farben werden angehoben, damit Linien und Schaltflächen auf dunklem Grund lesbar bleiben.
 */
import { hexToHsl, hslToHex } from '@/gen/terrain/PlanetStyle';

const STORAGE_KEY = 'stellar-archive:accent';
const DEFAULT_ACCENT = '#41b8ff';

/** Lesbare Variante einer Akzentfarbe (Mindesthelligkeit und -sättigung). */
export function readableAccent(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return DEFAULT_ACCENT;
  const [h, s, l] = hexToHsl(hex);
  // Grautöne bleiben grau, werden aber hell genug
  return hslToHex(h, s < 0.08 ? s : Math.max(s, 0.45), Math.min(0.78, Math.max(l, 0.58)));
}

/** Setzt die Akzentfarbe und merkt sie für den nächsten Start (Menüs vor dem Laden eines Spielstands). */
export function setUiAccent(hex: string): void {
  const color = readableAccent(hex);
  document.documentElement.style.setProperty('--hud-accent', color);
  try {
    localStorage.setItem(STORAGE_KEY, color);
  } catch {
    /* Speicher nicht verfügbar: Farbe gilt nur für diese Sitzung */
  }
}

/** Beim Start: zuletzt verwendete Akzentfarbe wiederherstellen. */
export function initUiAccent(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) document.documentElement.style.setProperty('--hud-accent', readableAccent(saved));
  } catch {
    /* ohne gespeicherte Farbe gilt der Standard aus hud.css */
  }
}
