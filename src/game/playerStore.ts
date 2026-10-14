import { getDb } from '@/save/Db';
import { PlayerState, type PlayerStateSnapshot } from './PlayerState';
import { gameState } from './GameState';

const key = (seed: string): string => `player:${seed}`;

/** Spielerzustand je Seed laden (neu, wenn keiner gespeichert ist). */
export async function loadPlayerState(seed: string): Promise<PlayerState> {
  const db = await getDb();
  const snapshot = await db.getValue<PlayerStateSnapshot>(key(seed));
  return snapshot ? PlayerState.fromJSON(snapshot) : new PlayerState(seed);
}

export async function savePlayerState(state: PlayerState): Promise<void> {
  const db = await getDb();
  await db.setValue(key(state.seed), state.toJSON());
}

/** Gemeinsame Instanz für alle Szenen: lädt einmal je Seed und hält sie im GameState. */
export async function ensurePlayerState(seed: string): Promise<PlayerState> {
  if (gameState.player && gameState.player.seed === seed) return gameState.player;
  const state = await loadPlayerState(seed);
  gameState.player = state;
  return state;
}
