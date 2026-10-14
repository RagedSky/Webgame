import { getDb } from '@/save/Db';
import { BUILTIN_PRESETS, sanitizeCharacter, type CharacterPreset } from './Character';

const KEY = 'character-presets';

/** Eigene Presets aus IndexedDB (plus mitgelieferte). */
export async function loadPresets(): Promise<CharacterPreset[]> {
  const db = await getDb();
  const own = (await db.getValue<CharacterPreset[]>(KEY)) ?? [];
  const cleaned = own.filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, name: String(p.name).slice(0, 24), config: sanitizeCharacter(p.config) }));
  return [...BUILTIN_PRESETS, ...cleaned];
}

export async function saveOwnPresets(presets: CharacterPreset[]): Promise<void> {
  const db = await getDb();
  await db.setValue(KEY, presets.filter((p) => !p.builtIn).map((p) => ({ id: p.id, name: p.name, config: p.config })));
}
