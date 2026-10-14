/**
 * Speicherslots, Export und Import (IndexedDB + Datei).
 * - Der laufende Spielstand liegt immer „live“ unter `player:<seed>` und im Fortschritts-Store (Autosave).
 * - Ein Slot ist eine Kopie davon (`slot:<n>`), die Liste der Kurzinfos liegt unter `save-index`.
 * - Laden eines Slots schreibt die Kopie zurück in den Live-Stand des Seeds; Fotos bleiben im Foto-Store (per ID referenziert).
 * - Export erzeugt eine JSON-Datei inkl. Fotos (Base64) und Einstellungen; Import liest sie zurück.
 */
import type { StarSystem } from '@/gen/universe/types';
import type { PlayerState } from '@/game/PlayerState';
import type { ArchiveProgress } from '@/game/progress/ArchiveProgress';
import { getDb, type GameDb, type PhotoRecordDb } from './Db';
import { buildBundle, migrateBundle, SAVE_SLOT_COUNT, summarize, type PhotoExport, type SaveBundle, type SaveSummary } from './SaveBundle';

const INDEX_KEY = 'save-index';
const slotKey = (slot: number): string => `slot:${slot}`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export class SaveManager {
  private constructor(private readonly db: GameDb) {}

  static async open(): Promise<SaveManager> {
    return new SaveManager(await getDb());
  }

  get slotCount(): number {
    return SAVE_SLOT_COUNT;
  }

  async listSlots(): Promise<Array<SaveSummary | null>> {
    const index = (await this.db.getValue<Record<string, SaveSummary>>(INDEX_KEY)) ?? {};
    const out: Array<SaveSummary | null> = [];
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) out.push(index[String(i)] ?? null);
    return out;
  }

  private async updateIndex(slot: number, summary: SaveSummary | null): Promise<void> {
    const index = (await this.db.getValue<Record<string, SaveSummary>>(INDEX_KEY)) ?? {};
    if (summary) index[String(slot)] = summary;
    else delete index[String(slot)];
    await this.db.setValue(INDEX_KEY, index);
  }

  /** Aktuellen Spielstand in einen Slot kopieren. */
  async saveSlot(slot: number, name: string, player: PlayerState, progress: ArchiveProgress, system: StarSystem): Promise<SaveSummary> {
    const bundle = buildBundle(player.toJSON(), progress.toJSON());
    await this.db.setValue(slotKey(slot), bundle);
    const summary = summarize({ slot, name, bundle, total: system.entries.length, planetName: (id) => system.planets.find((p) => p.id === id)?.name ?? id });
    await this.updateIndex(slot, summary);
    // Der Live-Stand bleibt die Wahrheit: beim Speichern auch dort aktualisieren
    await this.writeLive(bundle);
    return summary;
  }

  async loadSlot(slot: number): Promise<SaveBundle | null> {
    const raw = await this.db.getValue<unknown>(slotKey(slot));
    if (!raw) return null;
    return migrateBundle(raw);
  }

  async deleteSlot(slot: number): Promise<void> {
    await this.db.deleteValue(slotKey(slot));
    await this.updateIndex(slot, null);
  }

  /** Bundle als Live-Stand des Seeds eintragen (Fotos aus Datei-Importen mitschreiben). */
  async writeLive(bundle: SaveBundle): Promise<void> {
    await this.db.setValue(`player:${bundle.seed}`, bundle.player);
    await this.db.saveProgress(bundle.progress);
    if (bundle.photos) {
      for (const p of bundle.photos) {
        try {
          const rec: PhotoRecordDb = { ...p.meta, seed: bundle.seed, blob: base64ToBlob(p.jpeg, 'image/jpeg'), thumb: base64ToBlob(p.thumb, 'image/jpeg') };
          await this.db.savePhoto(rec);
        } catch (err) {
          console.warn('[save] Foto konnte nicht importiert werden', p.meta.id, err);
        }
      }
    }
  }

  /** Aktuellen Spielstand als JSON-Datei (Blob) exportieren. */
  async exportBundle(player: PlayerState, progress: ArchiveProgress, settings: unknown, includePhotos: boolean, onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; bundle: SaveBundle }> {
    const bundle = buildBundle(player.toJSON(), progress.toJSON());
    bundle.settings = settings;
    if (includePhotos) {
      const metas = await this.db.listPhotos(bundle.seed);
      const photos: PhotoExport[] = [];
      for (let i = 0; i < metas.length; i++) {
        const meta = metas[i]!;
        const rec = await this.db.getPhoto(meta.id);
        if (!rec) continue;
        const { blob, thumb, ...m } = rec;
        photos.push({ meta: m, jpeg: await blobToBase64(blob), thumb: await blobToBase64(thumb) });
        onProgress?.(i + 1, metas.length);
      }
      bundle.photos = photos;
    }
    const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
    return { blob, bundle };
  }

  /** JSON-Datei einlesen, prüfen, migrieren und als Live-Stand schreiben. Liefert das Bundle (Seed für den Start). */
  async importFile(file: File): Promise<SaveBundle> {
    const text = await file.text();
    const bundle = migrateBundle(JSON.parse(text) as unknown);
    await this.writeLive(bundle);
    return bundle;
  }
}
