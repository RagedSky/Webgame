import type { Input } from './Input';
import type { SceneManager } from './SceneManager';
import type { Renderer } from '@/render/Renderer';
import type { DebugOverlay } from '@/ui/DebugOverlay';
import type { GameLoop } from './GameLoop';

/** Alles, was Szenen von außen brauchen. Wird in main.ts zusammengebaut. */
export interface GameContext {
  renderer: Renderer;
  input: Input;
  scenes: SceneManager;
  loop: GameLoop;
  debug: DebugOverlay;
  /** Root-Element für Spiel-UI (DOM-Overlays). */
  uiRoot: HTMLElement;
}
