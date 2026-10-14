/**
 * Spielstand-Bundle (rein): fasst Spielerzustand, Archiv-Fortschritt und optional Fotos/Einstellungen eines Seeds
 * zu einem versionierten Objekt zusammen – für Speicherslots (IndexedDB) und Export/Import als JSON-Datei.
 * Migration: `migrateBundle` hebt ältere Bundles auf die aktuelle Version (und delegiert an die Teil-Migrationen).
 */
import { migratePlayerState, type PlayerStateSnapshot } from '@/game/PlayerState';
import { migrateProgress, type ProgressSnapshot } from '@/game/progress/ArchiveProgress';
import type { PhotoMeta } from './Db';

export const SAVE_BUNDLE_VERSION = 1;
export const SAVE_BUNDLE_KIND = 'stellar-archive-save';
export const SAVE_SLOT_COUNT = 5;

export interface PhotoExport {
  meta: PhotoMeta;
  /** JPEG als Base64 (ohne Data-URL-Präfix). */
  jpeg: string;
  thumb: string;
}

export interface SaveBundle {
  kind: typeof SAVE_BUNDLE_KIND;
  version: number;
  seed: string;
  savedAt: number;
  player: PlayerStateSnapshot;
  progress: ProgressSnapshot;
  /** Nur im Datei-Export enthalten. */
  photos?: PhotoExport[];
  /** Nur im Datei-Export enthalten (globale Einstellungen). */
  settings?: unknown;
}

/** Kurzinfo eines Slots für die Liste (ohne das Bundle zu laden). */
export interface SaveSummary {
  slot: number;
  name: string;
  seed: string;
  savedAt: number;
  playtime: number;
  characterName: string;
  /** Aufenthaltsort als Text (Planetenname oder „Orbit von …“). */
  location: string;
  discovered: number;
  total: number;
  stars: number;
}

export function buildBundle(player: PlayerStateSnapshot, progress: ProgressSnapshot, savedAt = Date.now()): SaveBundle {
  if (player.seed !== progress.seed) throw new Error(`Spielstand-Bundle: Seeds passen nicht (${player.seed} / ${progress.seed})`);
  return { kind: SAVE_BUNDLE_KIND, version: SAVE_BUNDLE_VERSION, seed: player.seed, savedAt, player, progress };
}

/** Prüft und migriert ein eingelesenes Objekt; wirft bei ungültigem Inhalt. */
export function migrateBundle(raw: unknown): SaveBundle {
  if (!raw || typeof raw !== 'object') throw new Error('Kein Spielstand');
  const b = raw as Partial<SaveBundle>;
  if (b.kind !== SAVE_BUNDLE_KIND) throw new Error('Keine Stellar-Archive-Datei');
  if (!b.player || typeof b.player !== 'object' || !b.progress || typeof b.progress !== 'object') throw new Error('Spielstand unvollständig');
  const version = typeof b.version === 'number' && b.version >= 1 ? b.version : 1;
  if (version > SAVE_BUNDLE_VERSION) throw new Error(`Spielstand aus neuerer Version (${version})`);
  const player = migratePlayerState(b.player as PlayerStateSnapshot);
  const progress = migrateProgress(b.progress as ProgressSnapshot);
  const seed = typeof b.seed === 'string' && b.seed.length ? b.seed : player.seed;
  if (typeof player.seed !== 'string' || !player.seed.length) throw new Error('Spielstand ohne Seed');
  if (player.seed !== seed || progress.seed !== seed) throw new Error('Spielstand: Seeds passen nicht zusammen');
  const out: SaveBundle = { kind: SAVE_BUNDLE_KIND, version: SAVE_BUNDLE_VERSION, seed, savedAt: typeof b.savedAt === 'number' ? b.savedAt : 0, player, progress };
  if (Array.isArray(b.photos)) out.photos = b.photos.filter((p): p is PhotoExport => !!p && typeof p === 'object' && typeof p.jpeg === 'string' && typeof p.thumb === 'string' && !!p.meta && typeof p.meta.id === 'string');
  if (b.settings && typeof b.settings === 'object') out.settings = b.settings;
  return out;
}

export interface SummaryInput {
  slot: number;
  name: string;
  bundle: SaveBundle;
  /** Anzahl aller Archiv-Einträge des Seeds (aus dem generierten System). */
  total: number;
  planetName: (id: string) => string;
}

export function summarize(i: SummaryInput): SaveSummary {
  const { bundle } = i;
  let discovered = 0;
  let stars = 0;
  for (const e of Object.values(bundle.progress.entries)) {
    if (e.stars > 0) {
      discovered++;
      stars += e.stars;
    }
  }
  const loc = bundle.player.ship.location;
  const location = loc ? (loc.kind === 'orbit' ? `Orbit: ${i.planetName(loc.planetId)}` : i.planetName(loc.planetId)) : '–';
  return {
    slot: i.slot,
    name: i.name,
    seed: bundle.seed,
    savedAt: bundle.savedAt,
    playtime: bundle.player.playtime,
    characterName: bundle.player.character?.name ?? '–',
    location,
    discovered,
    total: i.total,
    stars,
  };
}

/** Dateiname für den Export. */
export function exportFilename(seed: string, savedAt: number): string {
  const d = new Date(savedAt);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `stellar-archive-${seed.toLowerCase()}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** Spielzeit als „12 h 34 min“. */
export function formatPlaytime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
