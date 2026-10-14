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
import { SystemViewScene } from './SystemViewScene';
import { CharacterScene } from './CharacterScene';
import { SettingsUi } from '@/ui/SettingsUi';
import { SaveUi } from '@/ui/SaveUi';
import { getDb } from '@/save/Db';
import { audio } from '@/audio/AudioManager';
import { startGame } from './startGame';

/**
 * Hauptmenü: Seed-Eingabe, „Zufälliges Universum“, Weiterspielen/Neues Spiel, Charakter, Spielstände,
 * Einstellungen, Credits, Debug-Systemansicht. Hintergrund: langsam rotierendes Sternenfeld.
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
  private startButton: HTMLButtonElement | null = null;
  private settingsUi: SettingsUi | null = null;
  private saveUi: SaveUi | null = null;
  private credits: HTMLElement | null = null;
  private seedCheckTimer = 0;
  private time = 0;

  enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.debug.setScene(this.name);
    ctx.debug.setSeed(gameState.seed);
    this.buildStars();
    this.buildUi();
    audio.clearAmbient();
    audio.setMusic('menu');
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
      if (e.key === 'Enter') this.newGame();
    });
    seedInput.addEventListener('input', () => this.scheduleSeedCheck());

    const randomBtn = el('button', { class: 'small', text: STR.randomUniverse, onClick: () => this.randomSeed() });
    this.startButton = el('button', { class: 'primary', text: STR.newGame, title: STR.newGameHint, onClick: () => this.newGame() });

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
        this.startButton,
        el('button', { text: STR.character.menu, onClick: () => this.openCharacter() }),
        el('button', { text: STR.load, onClick: () => this.saveUi?.show() }),
        el('button', { text: STR.settings, onClick: () => this.settingsUi?.show() }),
        el('button', { text: STR.showSystem, onClick: () => this.openSystemView() }),
        el('button', { text: STR.credits.title, onClick: () => this.toggleCredits() }),
      ),
      el('div', { class: 'hint', text: STR.debugOverlayHint }),
      el('div', { class: 'version', text: `v${GAME_VERSION}` }),
    );
    this.root = el('div', { class: 'main-menu' }, panel);
    this.ctx.uiRoot.append(this.root);
    this.disposer.addDom(this.root);
    this.settingsUi = new SettingsUi(this.ctx.uiRoot, this.ctx.settings, this.ctx.renderer, this.ctx.loop, () => this.settingsUi?.hide());
    this.disposer.addFn(() => this.settingsUi?.dispose());
    this.saveUi = new SaveUi(this.ctx.uiRoot, {
      onClose: () => this.saveUi?.hide(),
      onLoaded: (bundle) => {
        this.saveUi?.hide();
        void startGame(this.ctx, bundle.seed, true);
      },
      getGame: () => null,
    });
    this.disposer.addFn(() => this.saveUi?.dispose());
    this.credits = el(
      'div',
      { class: 'inv-ui credits-ui', style: 'display:none' },
      el('div', { class: 'panel inv-panel' }, el('div', { class: 'row inv-head' }, el('h2', { text: STR.credits.title }), el('button', { class: 'small', text: STR.back, onClick: () => this.toggleCredits() })), ...STR.credits.lines.map((line) => el('p', { text: line })), el('p', { class: 'muted small', text: `v${GAME_VERSION}` })),
    );
    this.ctx.uiRoot.append(this.credits);
    this.disposer.addDom(this.credits);
    this.disposer.addFn(() => window.clearTimeout(this.seedCheckTimer));
    void this.checkSeed();
  }

  private toggleCredits(): void {
    if (!this.credits) return;
    this.credits.style.display = this.credits.style.display === 'none' ? 'flex' : 'none';
  }

  private scheduleSeedCheck(): void {
    window.clearTimeout(this.seedCheckTimer);
    this.seedCheckTimer = window.setTimeout(() => void this.checkSeed(), 300);
  }

  /** Beschriftung „Weiterspielen“, wenn für den eingegebenen Seed ein Spielstand existiert. */
  private async checkSeed(): Promise<void> {
    const raw = this.seedInput?.value ?? gameState.seed;
    const seed = raw.trim().toUpperCase().replace(/\s+/g, '-') || gameState.seed;
    const db = await getDb();
    const exists = (await db.getValue(`player:${seed}`)) !== undefined;
    if (!this.startButton || (this.seedInput && this.seedInput.value !== raw)) return;
    this.startButton.textContent = exists ? STR.continueGame : STR.newGame;
  }

  private randomSeed(): void {
    const seed = randomSeedString(8);
    if (this.seedInput) this.seedInput.value = seed;
    gameState.seed = seed;
    this.ctx.debug.setSeed(seed);
    void this.checkSeed();
  }

  /** Neues Spiel bzw. Weiterspielen: ohne Charakter zuerst der Editor; im Orbit → Raumflug, sonst Planet des Schiffs. */
  private newGame(): void {
    if (!this.root) return;
    void startGame(this.ctx, this.seedInput?.value ?? gameState.seed);
  }

  /** Charakter des aktuellen Seeds bearbeiten (auch nachträglich; Boni gelten ab dem nächsten Planetenbesuch). */
  private openCharacter(): void {
    gameState.seed = this.seedInput?.value ?? gameState.seed;
    this.ctx.scenes.switchTo(new CharacterScene({ onDone: () => this.ctx.scenes.switchTo(new MainMenuScene()), onCancel: () => this.ctx.scenes.switchTo(new MainMenuScene()) }));
  }

  private openSystemView(): void {
    gameState.seed = this.seedInput?.value ?? gameState.seed;
    this.ctx.scenes.switchTo(new SystemViewScene());
  }

  exit(): void {}

  update(dt: number): void {
    this.time += dt;
    if (this.ctx.input.wasPressed('pause')) {
      if (this.settingsUi?.isOpen && !this.settingsUi.isListening) this.settingsUi.hide();
      else if (this.saveUi?.isOpen) this.saveUi.hide();
      else if (this.credits && this.credits.style.display !== 'none') this.toggleCredits();
    }
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
