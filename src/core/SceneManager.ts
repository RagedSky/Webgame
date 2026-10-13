import type { GameContext } from './GameContext';
import type { GameScene } from './Scene';

/**
 * Verwaltet genau eine aktive Szene. Beim Wechsel wird die alte Szene vollständig freigegeben.
 */
export class SceneManager {
  private current: GameScene | null = null;
  private pending: GameScene | null = null;
  private ctx: GameContext | null = null;
  private switching = false;

  init(ctx: GameContext): void {
    this.ctx = ctx;
  }

  get active(): GameScene | null {
    return this.current;
  }

  /** Wechselt zur nächsten Szene (wird am Beginn des nächsten Updates ausgeführt, nie mitten im Frame). */
  switchTo(scene: GameScene): void {
    this.pending = scene;
  }

  private async applyPending(): Promise<void> {
    if (!this.pending || this.switching || !this.ctx) return;
    this.switching = true;
    const next = this.pending;
    this.pending = null;
    const prev = this.current;
    this.current = null;
    if (prev) {
      try {
        prev.exit();
        prev.dispose();
      } catch (err) {
        console.error(`Szene "${prev.name}": Fehler beim Verlassen`, err);
      }
    }
    try {
      await next.enter(this.ctx);
      const { width, height } = this.ctx.renderer.size;
      next.resize(width, height);
      this.current = next;
    } catch (err) {
      console.error(`Szene "${next.name}": Fehler beim Betreten`, err);
    } finally {
      this.switching = false;
    }
  }

  update(dt: number): void {
    if (this.pending && !this.switching) void this.applyPending();
    this.current?.update(dt);
  }

  render(alpha: number, frameDt: number): void {
    this.current?.render(alpha, frameDt);
  }

  resize(width: number, height: number): void {
    this.current?.resize(width, height);
  }

  dispose(): void {
    if (this.current) {
      this.current.exit();
      this.current.dispose();
      this.current = null;
    }
    this.pending = null;
  }
}
