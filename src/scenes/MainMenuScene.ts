import { PerspectiveCamera, Scene, type Points } from 'three';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { randomSeedString } from '@/math/Random';
import { createStarfield } from '@/render/Starfield';
import { gameState } from '@/game/GameState';
import { GAME_VERSION } from '@/config/constants';
import { STR } from '@/ui/strings';
import { el } from '@/ui/dom';
import { showToast } from '@/ui/toast';
import { SystemViewScene } from './SystemViewScene';
import { PlanetScene } from './PlanetScene';

/**
 * Hauptmenü: Seed-Eingabe, „Zufälliges Universum“, Debug-Systemansicht.
 * Hintergrund: langsam rotierendes Sternenfeld (deterministisch aus festem Seed).
 */
export class MainMenuScene implements GameScene {
  readonly name = 'MainMenu';
  private ctx!: GameContext;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(60, 1, 0.1, 500);
  private readonly disposer = new Disposer();
  private stars: Points | null = null;
  private root: HTMLElement | null = null;
  private seedInput: HTMLInputElement | null = null;
  private time = 0;

  enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.debug.setScene(this.name);
    ctx.debug.setSeed(gameState.seed);
    this.buildStars();
    this.buildUi();
  }

  private buildStars(): void {
    this.stars = createStarfield(this.disposer, 'menu-stars', 2500, [60, 200]);
    this.scene.add(this.stars);
    this.camera.position.set(0, 0, 0.1);
  }

  private buildUi(): void {
    const seedInput = el('input', {
      type: 'text',
      value: gameState.seed,
      placeholder: STR.seedPlaceholder,
      spellcheck: false,
      maxlength: 32,
      autocomplete: 'off',
    });
    this.seedInput = seedInput;
    seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.openSystemView();
    });

    const randomBtn = el('button', { class: 'small', text: STR.randomUniverse, onClick: () => this.randomSeed() });

    const panel = el(
      'div',
      { class: 'panel' },
      el('h1', { text: STR.title }),
      el('p', { class: 'subtitle', text: STR.subtitle }),
      el('label', { text: STR.seedLabel }),
      el('div', { class: 'row seed-row' }, seedInput, randomBtn),
      el(
        'div',
        { class: 'menu-buttons' },
        el('button', { class: 'primary', text: STR.newGame, title: STR.newGameHint, onClick: () => this.newGame() }),
        el('button', { text: STR.showSystem, onClick: () => this.openSystemView() }),
        el('button', { text: STR.load, onClick: () => showToast(STR.comingSoon) }),
        el('button', { text: STR.settings, onClick: () => showToast(STR.comingSoon) }),
        el('button', { text: STR.credits, onClick: () => showToast('Stellar Archive · prozedural, Three.js, TypeScript') }),
      ),
      el('div', { class: 'hint', text: STR.debugOverlayHint }),
      el('div', { class: 'version', text: `v${GAME_VERSION} · Phase 2` }),
    );
    this.root = el('div', { class: 'main-menu' }, panel);
    this.ctx.uiRoot.append(this.root);
    this.disposer.addDom(this.root);
  }

  private randomSeed(): void {
    const seed = randomSeedString(8);
    if (this.seedInput) this.seedInput.value = seed;
    gameState.seed = seed;
    this.ctx.debug.setSeed(seed);
  }

  private newGame(): void {
    gameState.seed = this.seedInput?.value ?? gameState.seed;
    const system = gameState.getSystem();
    this.ctx.scenes.switchTo(new PlanetScene(system.startPlanetId));
  }

  private openSystemView(): void {
    gameState.seed = this.seedInput?.value ?? gameState.seed;
    this.ctx.scenes.switchTo(new SystemViewScene());
  }

  exit(): void {}

  update(dt: number): void {
    this.time += dt;
  }

  render(_alpha: number, frameDt: number): void {
    if (this.stars) {
      this.stars.rotation.y += frameDt * 0.01;
      this.stars.rotation.x = Math.sin(this.time * 0.05) * 0.05;
    }
    this.ctx.renderer.gl.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposer.dispose();
    this.scene.clear();
  }
}
