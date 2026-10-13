import { DEFAULT_SEED } from '@/config/constants';

/**
 * Szenenübergreifender Spielzustand (Seed, später: Spielstand, Einstellungen).
 * Bewusst ein einfaches Objekt – keine Abhängigkeit zu Three.js oder DOM.
 */
export class GameState {
  private _seed: string = DEFAULT_SEED;

  get seed(): string {
    return this._seed;
  }

  set seed(value: string) {
    const cleaned = value.trim().toUpperCase().replace(/\s+/g, '-');
    this._seed = cleaned.length ? cleaned : DEFAULT_SEED;
  }
}

export const gameState = new GameState();
