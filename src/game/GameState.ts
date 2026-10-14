import { DEFAULT_SEED } from '@/config/constants';
import { generateUniverse } from '@/gen';
import type { StarSystem } from '@/gen/universe/types';
import type { PlayerState } from './PlayerState';
import type { ArchiveProgress } from './progress/ArchiveProgress';

/**
 * Szenenübergreifender Spielzustand (Seed, generiertes System; später Spielstand und Einstellungen).
 * Keine Abhängigkeit zu Three.js oder DOM.
 */
export interface SurfaceState {
  planetId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  dayT: number;
  totalDays: number;
}

export class GameState {
  private _seed: string = DEFAULT_SEED;
  /** Letzter Zustand auf einer Planetenoberfläche (für Rückkehr aus Systemansicht/Pause). */
  surface: SurfaceState | null = null;
  /** Nächster Planeteneintritt: 'landing' spielt die Landesequenz mit dem Schiff ab. */
  arrival: 'landing' | null = null;
  /** Geladener Spielerzustand (eine Instanz für alle Szenen; Persistenz über playerStore). */
  player: PlayerState | null = null;
  /** Geladener Archiv-Fortschritt (eine Instanz; Persistenz über progressStore). */
  progress: ArchiveProgress | null = null;
  private cachedSystem: StarSystem | null = null;
  private cachedSeed = '';

  get seed(): string {
    return this._seed;
  }

  set seed(value: string) {
    const cleaned = value.trim().toUpperCase().replace(/\s+/g, '-');
    const next = cleaned.length ? cleaned : DEFAULT_SEED;
    if (next !== this._seed) {
      this.surface = null;
      this.arrival = null;
      this.player = null;
      this.progress = null;
    }
    this._seed = next;
  }

  /** Liefert das Sternsystem zum aktuellen Seed (memoisiert). */
  getSystem(): StarSystem {
    if (!this.cachedSystem || this.cachedSeed !== this._seed) {
      const t0 = performance.now();
      this.cachedSystem = generateUniverse(this._seed);
      this.cachedSeed = this._seed;
      console.info(`[gen] System "${this.cachedSystem.name}" aus Seed ${this._seed}: ${this.cachedSystem.planets.length} Planeten, ${this.cachedSystem.entries.length} Einträge in ${(performance.now() - t0).toFixed(1)} ms`);
    }
    return this.cachedSystem;
  }
}

export const gameState = new GameState();
