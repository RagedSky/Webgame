import { getDb } from '@/save/Db';
import type { ArchiveEntry } from '@/gen/archive/types';
import { ArchiveProgress } from './progress/ArchiveProgress';
import { gameState } from './GameState';

/** Gemeinsamer Archiv-Fortschritt je Seed (eine Instanz für Planet und Orbit, Persistenz in IndexedDB). */
export async function ensureProgress(seed: string, entries: ArchiveEntry[]): Promise<ArchiveProgress> {
  if (gameState.progress && gameState.progress.seed === seed) return gameState.progress;
  const db = await getDb();
  const snapshot = await db.loadProgress(seed);
  const progress = snapshot ? ArchiveProgress.fromJSON(snapshot, entries) : new ArchiveProgress(seed, entries);
  gameState.progress = progress;
  return progress;
}

export async function saveProgressStore(progress: ArchiveProgress): Promise<void> {
  const db = await getDb();
  await db.saveProgress(progress.toJSON());
}
