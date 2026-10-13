import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { showToast } from '@/ui/toast';
import { MainMenuScene } from './MainMenuScene';

/** Platzhalter (Phase 0) – wird in Phase 1 durch die echte Systemansicht ersetzt. */
export class SystemViewScene implements GameScene {
  readonly name = 'SystemView';
  private ctx!: GameContext;

  enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.debug.setScene(this.name);
    showToast('Systemansicht folgt in Phase 1.');
    ctx.scenes.switchTo(new MainMenuScene());
  }

  exit(): void {}
  update(): void {}
  render(): void {
    this.ctx.renderer.gl.clear();
  }
  resize(): void {}
  dispose(): void {}
}
