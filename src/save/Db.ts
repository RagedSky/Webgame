import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProgressSnapshot } from '@/game/progress/ArchiveProgress';

export interface PhotoSettingsMeta {
  focusDistance: number;
  aperture: number;
  exposure: number;
  fov: number;
  filter: string;
}

export interface PhotoMeta {
  id: string;
  seed: string;
  planetId: string;
  entryIds: string[];
  primaryEntryId?: string;
  score: number;
  stars: number;
  behavior?: string;
  takenAt: number;
  width: number;
  height: number;
  settings: PhotoSettingsMeta;
}

export interface PhotoRecordDb extends PhotoMeta {
  blob: Blob;
  thumb: Blob;
}

interface StellarSchema extends DBSchema {
  photos: { key: string; value: PhotoRecordDb; indexes: { seed: string; entry: string } };
  progress: { key: string; value: ProgressSnapshot };
  kv: { key: string; value: unknown };
}

/**
 * IndexedDB-Zugriff: Fotos (JPEG + Thumbnail als Blob), Archiv-Fortschritt je Seed, Schlüssel/Wert (Einstellungen).
 * Alle Methoden fangen Fehler (z. B. privater Modus) ab und melden sie nur in der Konsole.
 */
export class GameDb {
  private constructor(private readonly db: IDBPDatabase<StellarSchema> | null) {}

  static async open(): Promise<GameDb> {
    try {
      const db = await openDB<StellarSchema>('stellar-archive', 1, {
        upgrade(d) {
          const photos = d.createObjectStore('photos', { keyPath: 'id' });
          photos.createIndex('seed', 'seed');
          photos.createIndex('entry', 'entryIds', { multiEntry: true });
          d.createObjectStore('progress', { keyPath: 'seed' });
          d.createObjectStore('kv');
        },
      });
      return new GameDb(db);
    } catch (err) {
      console.warn('[db] IndexedDB nicht verfügbar – Fortschritt wird nicht gespeichert', err);
      return new GameDb(null);
    }
  }

  get available(): boolean {
    return this.db !== null;
  }

  async savePhoto(rec: PhotoRecordDb): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.put('photos', rec);
    } catch (err) {
      console.warn('[db] Foto konnte nicht gespeichert werden', err);
    }
  }

  async getPhoto(id: string): Promise<PhotoRecordDb | undefined> {
    if (!this.db) return undefined;
    try {
      return await this.db.get('photos', id);
    } catch {
      return undefined;
    }
  }

  async listPhotos(seed: string): Promise<PhotoMeta[]> {
    if (!this.db) return [];
    try {
      const all = await this.db.getAllFromIndex('photos', 'seed', seed);
      return all.map(({ blob: _b, thumb: _t, ...meta }) => meta).sort((a, b) => b.takenAt - a.takenAt);
    } catch {
      return [];
    }
  }

  async photosForEntry(entryId: string): Promise<PhotoRecordDb[]> {
    if (!this.db) return [];
    try {
      return await this.db.getAllFromIndex('photos', 'entry', entryId);
    } catch {
      return [];
    }
  }

  async deletePhoto(id: string): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.delete('photos', id);
    } catch {
      /* ignorieren */
    }
  }

  async saveProgress(snapshot: ProgressSnapshot): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.put('progress', snapshot);
    } catch (err) {
      console.warn('[db] Fortschritt konnte nicht gespeichert werden', err);
    }
  }

  async loadProgress(seed: string): Promise<ProgressSnapshot | undefined> {
    if (!this.db) return undefined;
    try {
      return await this.db.get('progress', seed);
    } catch {
      return undefined;
    }
  }

  async setValue(key: string, value: unknown): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.put('kv', value, key);
    } catch {
      /* ignorieren */
    }
  }

  async deleteValue(key: string): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.delete('kv', key);
    } catch {
      /* ignorieren */
    }
  }

  async getValue<T>(key: string): Promise<T | undefined> {
    if (!this.db) return undefined;
    try {
      return (await this.db.get('kv', key)) as T | undefined;
    } catch {
      return undefined;
    }
  }
}

let shared: Promise<GameDb> | null = null;
/** Gemeinsame Datenbank-Instanz (lazy). */
export function getDb(): Promise<GameDb> {
  if (!shared) shared = GameDb.open();
  return shared;
}
