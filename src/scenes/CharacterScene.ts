import { CircleGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import { ensurePlayerState, savePlayerState } from '@/game/playerStore';
import type { PlayerState } from '@/game/PlayerState';
import { defaultCharacter, sanitizeCharacter, type CharacterConfig, type CharacterPreset } from '@/game/character/Character';
import { loadPresets, saveOwnPresets } from '@/game/character/presetStore';
import { buildCharacter, type BuiltCharacter } from '@/world/character/CharacterBuilder';
import { createStarfield } from '@/render/Starfield';
import { EnvironmentMap, studioLook } from '@/render/Environment';
import { CharacterUi } from '@/ui/CharacterUi';
import { STR } from '@/ui/strings';
import { showToast } from '@/ui/toast';

export interface CharacterSceneOptions {
  onDone: (cfg: CharacterConfig) => void;
  onCancel: () => void;
  applyLabel?: string;
}

/**
 * Charaktererstellung: Studio-Bühne (Key/Fill/Rim-Licht, Boden, Sterne), Orbit-Kamera mit Drehteller und
 * Schnellansichten, Live-Vorschau des prozeduralen Charakters, Editor-UI mit Presets und Share-Code.
 */
export class CharacterScene implements GameScene {
  readonly name = 'Character';
  private ctx!: GameContext;
  private state!: PlayerState;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.05, 200);
  private readonly disposer = new Disposer();
  private controls!: OrbitControls;
  private ui!: CharacterUi;
  private built: BuiltCharacter | null = null;
  private presets: CharacterPreset[] = [];
  private turntable = true;
  private spin = 0;
  private readonly camGoal = new Vector3(2.4, 1.4, -3.2);
  private readonly targetGoal = new Vector3(0, 1.0, 0);
  private ready = false;
  private time = 0;

  constructor(private readonly options: CharacterSceneOptions) {}

  async enter(ctx: GameContext): Promise<void> {
    this.ctx = ctx;
    ctx.debug.setScene(this.name);
    ctx.debug.setSeed(gameState.seed);
    this.state = await ensurePlayerState(gameState.seed);
    this.presets = await loadPresets();
    const initial = this.state.character ?? defaultCharacter();

    this.scene.background = new Color(0x0a0d16);
    this.scene.add(createStarfield(this.disposer, 'char-stars', 1200, [40, 120]));
    const floorGeo = this.disposer.add(new CircleGeometry(2.2, 40));
    const floorMat = this.disposer.add(new MeshStandardMaterial({ color: 0x1b2230, roughness: 0.35, metalness: 0.4 }));
    const floor = new Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.add(new HemisphereLight(0x8fb0ff, 0x2a2420, 0.6));
    const env = this.disposer.add(new EnvironmentMap(ctx.renderer.gl));
    this.scene.environment = env.update(studioLook());
    this.scene.environmentIntensity = 0.9;
    this.disposer.addFn(() => (this.scene.environment = null));
    const key = new DirectionalLight(0xfff1e0, 2.4);
    key.position.set(2.5, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const fill = new DirectionalLight(0x9fc8ff, 0.8);
    fill.position.set(-3, 2, 1);
    this.scene.add(fill);
    const rim = new PointLight(0x41b8ff, 14, 12, 1.5);
    rim.position.set(-1.5, 2.5, -2.5);
    this.scene.add(rim);
    const gl = ctx.renderer.gl;
    gl.shadowMap.enabled = true;

    this.camera.position.copy(this.camGoal);
    this.controls = new OrbitControls(this.camera, gl.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.copy(this.targetGoal);
    this.disposer.addFn(() => this.controls.dispose());
    this.disposer.listen(gl.domElement, 'pointerdown', () => {
      this.turntable = false;
    });

    this.rebuild(initial);
    this.ui = new CharacterUi(ctx.uiRoot, initial, this.presets, {
      onChange: (cfg) => this.rebuild(cfg),
      onApply: (cfg) => this.apply(cfg),
      onCancel: () => this.options.onCancel(),
      onSavePreset: (p) => this.savePreset(p),
      onDeletePreset: (id) => this.deletePreset(id),
      onCamera: (view) => this.view(view),
      onTurntable: (on) => (this.turntable = on),
    }, this.options.applyLabel ?? STR.character.apply);
    this.disposer.addFn(() => this.ui.dispose());
    this.ready = true;
  }

  private rebuild(cfg: CharacterConfig): void {
    const rot = this.built?.group.rotation.y ?? 0;
    this.built?.dispose();
    this.built = buildCharacter(sanitizeCharacter(cfg));
    this.built.group.rotation.y = rot;
    this.built.group.traverse((o) => {
      o.castShadow = true;
    });
    this.scene.add(this.built.group);
  }

  private view(which: 'face' | 'body'): void {
    const h = this.built?.height ?? 1.8;
    // Gesicht zeigt nach −z: Kamera davor, Drehteller aus und Figur zur Kamera drehen
    this.turntable = false;
    this.spin = 0;
    if (this.built) this.built.group.rotation.y = 0;
    if (which === 'face') {
      this.targetGoal.set(0, h - 0.12, 0);
      this.camGoal.set(0.3, h - 0.05, -0.85);
    } else {
      this.targetGoal.set(0, h * 0.55, 0);
      this.camGoal.set(2.4, h * 0.8, -3.2);
    }
  }

  private async savePreset(p: CharacterPreset): Promise<void> {
    this.presets = [...this.presets, p];
    await saveOwnPresets(this.presets);
    this.ui.setPresets(this.presets);
    showToast(`${STR.character.savePreset}: ${p.name}`);
  }

  private async deletePreset(id: string): Promise<void> {
    this.presets = this.presets.filter((p) => p.id !== id || p.builtIn);
    await saveOwnPresets(this.presets);
    this.ui.setPresets(this.presets);
  }

  private apply(cfg: CharacterConfig): void {
    this.state.character = sanitizeCharacter(cfg);
    this.state.touch();
    void savePlayerState(this.state);
    showToast(`${STR.character.applied}: ${this.state.character.name}`);
    this.options.onDone(this.state.character);
  }

  exit(): void {}

  update(dt: number): void {
    if (!this.ready) return;
    this.time += dt;
    if (this.ctx.input.wasPressed('pause')) this.options.onCancel();
  }

  render(_alpha: number, frameDt: number): void {
    if (!this.ready) return;
    if (this.built) {
      this.built.animate(frameDt, 0, true);
      if (this.turntable) {
        this.spin += frameDt * 0.5;
        this.built.group.rotation.y = this.spin;
      }
    }
    // sanfte Kamerafahrt zu Schnellansichten
    this.controls.target.lerp(this.targetGoal, 1 - Math.exp(-4 * frameDt));
    if (this.camera.position.distanceTo(this.camGoal) > 0.02) this.camera.position.lerp(this.camGoal, 1 - Math.exp(-3 * frameDt));
    else this.camGoal.copy(this.camera.position);
    this.controls.update();
    this.ctx.renderer.gl.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.ready = false;
    this.built?.dispose();
    this.disposer.dispose();
    this.scene.clear();
    this.ctx.renderer.gl.shadowMap.enabled = false;
  }
}
