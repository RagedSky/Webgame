import './ui/styles.css';
import { GameLoop } from './core/GameLoop';
import { Input } from './core/Input';
import { SceneManager } from './core/SceneManager';
import type { GameContext } from './core/GameContext';
import { Renderer } from './render/Renderer';
import { DebugOverlay } from './ui/DebugOverlay';
import { MainMenuScene } from './scenes/MainMenuScene';
import { FIXED_UPDATE_HZ } from './config/constants';

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  const debugRoot = document.getElementById('debug-root');
  if (!canvas || !uiRoot || !debugRoot) throw new Error('index.html: Canvas oder UI-Root fehlt');

  const renderer = new Renderer(canvas);
  const input = new Input(canvas);
  const loop = new GameLoop(FIXED_UPDATE_HZ);
  const scenes = new SceneManager();
  const debug = new DebugOverlay(debugRoot, loop, renderer, import.meta.env.DEV);

  const ctx: GameContext = { renderer, input, scenes, loop, debug, uiRoot };
  scenes.init(ctx);
  renderer.onResize((w, h) => scenes.resize(w, h));

  loop.setCallbacks(
    (dt) => {
      if (input.wasPressed('debug')) debug.toggle();
      scenes.update(dt);
      input.endFrame();
    },
    (alpha, frameDt) => {
      debug.update(frameDt); // liest die Zahlen des letzten Frames
      renderer.info.reset();
      scenes.render(alpha, frameDt);
    },
  );

  scenes.switchTo(new MainMenuScene());
  loop.start();

  // Für Konsolen-Debugging (z. B. window.__stellar.scenes.active)
  (window as unknown as { __stellar: GameContext }).__stellar = ctx;
}

bootstrap();
