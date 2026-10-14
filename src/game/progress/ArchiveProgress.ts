/**
 * Fortschritt des Archivs (rein, serialisierbar): Sterne je Eintrag, Fotos, Verhaltens-Slots, Hinweise,
 * Proben, Logbuch, Abschlussgrad („Archiv versiegelt“ ab 80 %).
 */
import type { ArchiveEntry, Category, SampleSource } from '@/gen/archive/types';
import { starsForScore, type Stars } from '../photo/PhotoScoring';

export const PROGRESS_VERSION = 1;
export const SEAL_FRACTION = 0.8;

export interface EntryProgress {
  entryId: string;
  stars: Stars;
  bestScore: number;
  bestPhotoId?: string;
  photoIds: string[];
  /** Fotografierte Verhaltensweisen (Bonus-Slots). */
  behaviors: string[];
  customName?: string;
  discoveredAt?: number;
  /** Hinweise (Spuren, Gerüchte), die auf diesen Eintrag deuten. */
  hints: string[];
}

export interface Sample {
  id: string;
  source: SampleSource;
  planetId: string;
  biomeId: string;
  /** Zufallsseed der Probe (bestimmt enthaltene Mikroorganismen). */
  seed: string;
  takenAt: number;
  analyzed: boolean;
  /** Bei Mineralproben: der zugehörige Eintrag. */
  entryId?: string;
  label: string;
}

export interface LogEntry {
  id: string;
  at: number;
  kind: 'hint' | 'rumor' | 'discovery' | 'info';
  text: string;
  entryId?: string;
  planetId?: string;
}

export interface ProgressSnapshot {
  version: number;
  seed: string;
  entries: Record<string, EntryProgress>;
  samples: Sample[];
  logbook: LogEntry[];
  photosTaken: number;
  updatedAt: number;
}

export interface CompletionStats {
  total: number;
  discovered: number;
  fraction: number;
  stars: number;
  maxStars: number;
  byCategory: Record<Category, { total: number; discovered: number }>;
}

export interface PhotoResult {
  stars: Stars;
  previousStars: Stars;
  improved: boolean;
  newDiscovery: boolean;
  newBehavior: boolean;
}

export class ArchiveProgress {
  private readonly entries = new Map<string, EntryProgress>();
  private readonly catalog = new Map<string, ArchiveEntry>();
  readonly samples: Sample[] = [];
  readonly logbook: LogEntry[] = [];
  photosTaken = 0;
  private listeners = new Set<() => void>();
  private logCounter = 0;

  constructor(
    readonly seed: string,
    catalog: ArchiveEntry[],
  ) {
    for (const e of catalog) this.catalog.set(e.id, e);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  get(entryId: string): EntryProgress {
    let p = this.entries.get(entryId);
    if (!p) {
      p = { entryId, stars: 0, bestScore: 0, photoIds: [], behaviors: [], hints: [] };
      this.entries.set(entryId, p);
    }
    return p;
  }

  has(entryId: string): boolean {
    return this.entries.has(entryId);
  }

  isDiscovered(entryId: string): boolean {
    return (this.entries.get(entryId)?.stars ?? 0) > 0;
  }

  isHinted(entryId: string): boolean {
    return (this.entries.get(entryId)?.hints.length ?? 0) > 0;
  }

  displayName(entry: ArchiveEntry): string {
    return this.entries.get(entry.id)?.customName ?? entry.name;
  }

  recordPhoto(entryId: string, score: number, photoId: string, behavior: string | undefined, at: number, countPhoto = true): PhotoResult {
    const p = this.get(entryId);
    const previousStars = p.stars;
    const stars = starsForScore(score, true);
    if (countPhoto) this.photosTaken++;
    p.photoIds.push(photoId);
    let improved = false;
    if (score > p.bestScore || !p.bestPhotoId) {
      p.bestScore = Math.max(p.bestScore, score);
      p.bestPhotoId = photoId;
      improved = score > 0;
    }
    if (stars > p.stars) {
      p.stars = stars;
      improved = true;
    }
    const newDiscovery = previousStars === 0 && p.stars > 0;
    if (newDiscovery) {
      p.discoveredAt = at;
      const e = this.catalog.get(entryId);
      if (e) this.addLog('discovery', `Neuer Eintrag: ${this.displayName(e)}`, at, entryId, e.planetId);
    }
    let newBehavior = false;
    if (behavior && !p.behaviors.includes(behavior) && stars > 0) {
      p.behaviors.push(behavior);
      newBehavior = true;
    }
    this.emit();
    return { stars, previousStars, improved, newDiscovery, newBehavior };
  }

  /** Entdeckung per Probe/Analyse (Erze, Gesteine, Mikroorganismen): Qualität 0..1 → Sterne. */
  discoverByAnalysis(entryId: string, quality: number, at: number): PhotoResult {
    const p = this.get(entryId);
    const previousStars = p.stars;
    const stars: Stars = quality >= 0.85 ? 3 : quality >= 0.55 ? 2 : 1;
    let improved = false;
    if (stars > p.stars) {
      p.stars = stars;
      improved = true;
    }
    p.bestScore = Math.max(p.bestScore, Math.round(quality * 100));
    const newDiscovery = previousStars === 0;
    if (newDiscovery) {
      p.discoveredAt = at;
      const e = this.catalog.get(entryId);
      if (e) this.addLog('discovery', `Neuer Eintrag: ${this.displayName(e)}`, at, entryId, e.planetId);
    }
    this.emit();
    return { stars: p.stars, previousStars, improved, newDiscovery, newBehavior: false };
  }

  addHint(entryId: string, text: string, at: number): boolean {
    const p = this.get(entryId);
    if (p.hints.includes(text)) return false;
    p.hints.push(text);
    const e = this.catalog.get(entryId);
    this.addLog('hint', text, at, entryId, e?.planetId);
    this.emit();
    return true;
  }

  rename(entryId: string, name: string): void {
    const p = this.get(entryId);
    const trimmed = name.trim();
    if (trimmed.length === 0) delete p.customName;
    else p.customName = trimmed.slice(0, 40);
    this.emit();
  }

  addSample(sample: Sample): void {
    this.samples.push(sample);
    this.emit();
  }

  removeSample(id: string): void {
    const i = this.samples.findIndex((s) => s.id === id);
    if (i >= 0) this.samples.splice(i, 1);
    this.emit();
  }

  addLog(kind: LogEntry['kind'], text: string, at: number, entryId?: string, planetId?: string): void {
    this.logbook.push({ id: `log-${++this.logCounter}-${at.toFixed(0)}`, at, kind, text, ...(entryId ? { entryId } : {}), ...(planetId ? { planetId } : {}) });
    if (this.logbook.length > 400) this.logbook.splice(0, this.logbook.length - 400);
  }

  completion(planetId?: string): CompletionStats {
    const byCategory = {} as Record<Category, { total: number; discovered: number }>;
    let total = 0;
    let discovered = 0;
    let stars = 0;
    for (const e of this.catalog.values()) {
      if (planetId && e.planetId !== planetId) continue;
      total++;
      const bc = (byCategory[e.category] ??= { total: 0, discovered: 0 });
      bc.total++;
      const s = this.entries.get(e.id)?.stars ?? 0;
      if (s > 0) {
        discovered++;
        bc.discovered++;
        stars += s;
      }
    }
    return { total, discovered, fraction: total ? discovered / total : 0, stars, maxStars: total * 3, byCategory };
  }

  isSealed(): boolean {
    return this.completion().fraction >= SEAL_FRACTION;
  }

  toJSON(): ProgressSnapshot {
    return {
      version: PROGRESS_VERSION,
      seed: this.seed,
      entries: Object.fromEntries(this.entries),
      samples: this.samples.slice(),
      logbook: this.logbook.slice(),
      photosTaken: this.photosTaken,
      updatedAt: Date.now(),
    };
  }

  static fromJSON(snapshot: ProgressSnapshot, catalog: ArchiveEntry[]): ArchiveProgress {
    const migrated = migrateProgress(snapshot);
    const p = new ArchiveProgress(migrated.seed, catalog);
    for (const [id, ep] of Object.entries(migrated.entries)) {
      if (p.catalog.has(id)) p.entries.set(id, { ...ep, photoIds: ep.photoIds.slice(), behaviors: ep.behaviors.slice(), hints: ep.hints.slice() });
    }
    p.samples.push(...migrated.samples);
    p.logbook.push(...migrated.logbook);
    p.photosTaken = migrated.photosTaken;
    p.logCounter = migrated.logbook.length;
    return p;
  }
}

/** Migration älterer Spielstände (aktuell nur Version 1; Platzhalter für spätere Felder). */
export function migrateProgress(snapshot: ProgressSnapshot): ProgressSnapshot {
  const s = { ...snapshot };
  if (!s.version || s.version < 1) s.version = 1;
  s.entries ??= {};
  s.samples ??= [];
  s.logbook ??= [];
  s.photosTaken ??= 0;
  return s;
}
