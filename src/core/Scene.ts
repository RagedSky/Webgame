import type { GameContext } from './GameContext';

/**
 * Eine Szene ist ein in sich geschlossener Spielzustand (Hauptmenü, Systemansicht, Planet, Schiffseditor …).
 * Der SceneManager ruft enter/exit; die Szene besitzt ihre Ressourcen und gibt sie in dispose() frei.
 */
export interface GameScene {
  /** Kurzname für Debug-Overlay und Logs. */
  readonly name: string;
  enter(ctx: GameContext): void | Promise<void>;
  exit(): void;
  /** Fester Simulationsschritt (dt in Sekunden, konstant). */
  update(dt: number): void;
  /** Rendern eines Frames (alpha = Interpolation zwischen zwei Simulationsschritten, frameDt = reale Framezeit). */
  render(alpha: number, frameDt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
