import './ui/styles.css';
import { GameLoop } from './core/GameLoop';
import { Input } from './core/Input';
import { SceneManager } from './core/SceneManager';
import type { GameContext } from './core/GameContext';
import { Renderer } from './render/Renderer';
import { DebugOverlay } from './ui/DebugOverlay';
import { MainMenuScene } from './scenes/MainMenuScene';
import { FIXED_UPDATE_HZ } from './config/constants';
import { SettingsManager } from './game/settings/SettingsManager';
import { PRESET_LABELS } from './game/settings/Settings';
import { showActionToast } from './ui/toast';
import { STR } from './ui/strings';
import { audio } from './audio/AudioManager';

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

  const settings = new SettingsManager(renderer, loop, debug, input);
  void settings.load();
  const ctx: GameContext = { renderer, input, scenes, loop, debug, settings, uiRoot };
  scenes.init(ctx);
  renderer.onResize((w, h) => scenes.resize(w, h));
  // Audio darf erst nach einer Nutzergeste starten; danach läuft der Kontext dauerhaft.
  const unlock = (): void => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

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
      audio.update(frameDt);
      // Adaptive Qualität: nur auf der Planetenoberfläche (dort zählt die Last), Vorschlag statt Zwang
      if (settings.current.adaptiveQuality && scenes.active?.name === 'Planet' && settings.adaptive.push(loop.stats.fps, frameDt)) {
        const lower = settings.lowerPreset();
        if (lower) {
          showActionToast(`${STR.settingsUi.adaptiveAsk} „${PRESET_LABELS[lower]}“?`, [
            { label: STR.settingsUi.adaptiveYes, onClick: () => settings.setPreset(lower) },
            { label: STR.settingsUi.adaptiveNo, onClick: () => settings.adaptive.reset() },
            { label: STR.settingsUi.adaptiveNever, onClick: () => settings.set({ adaptiveQuality: false }) },
          ]);
        }
      }
    },
  );

  scenes.switchTo(new MainMenuScene());
  loop.start();

  // Für Konsolen-Debugging (z. B. window.__stellar.scenes.active)
  (window as unknown as { __stellar: GameContext & { audio: typeof audio } }).__stellar = Object.assign(ctx, { audio });
}

bootstrap();
