import type { Mesh} from 'three';
import { Color, DirectionalLight, GridHelper, HemisphereLight, PerspectiveCamera, Raycaster, Scene, Vector2 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import { ensurePlayerState, savePlayerState } from '@/game/playerStore';
import type { PlayerState } from '@/game/PlayerState';
import { partDef, SOCKET_FOR_TYPE } from '@/game/ship/parts';
import { canPlace, costDelta, placePart, removePart, setHull, shipStats, type ShipDesign } from '@/game/ship/ShipDesign';
import { createStarfield } from '@/render/Starfield';
import { buildShip, ShipMaterials, type BuiltShip } from '@/world/ship/ShipBuilder';
import { ShipEditorUi } from '@/ui/ShipEditorUi';
import { STR } from '@/ui/strings';
import { showToast } from '@/ui/toast';
import { PlanetScene } from './PlanetScene';
import type { ResourceId } from '@/gen/universe/types';

/**
 * Werft: 3D-Baueditor für den Lander. Teil wählen, freien Sockel anklicken; platzierte Teile anklicken und
 * entfernen; Rumpf wechseln. Änderungen werden erst mit „Übernehmen“ bezahlt (Erstattung voll).
 */
export class ShipEditorScene implements GameScene {
  readonly name = 'ShipEditor';
  private ctx!: GameContext;
  private state!: PlayerState;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.1, 500);
  private readonly disposer = new Disposer();
  private readonly mats = new ShipMaterials();
  private controls!: OrbitControls;
  private ui!: ShipEditorUi;
  private built: BuiltShip | null = null;
  private saved!: ShipDesign;
  private working!: ShipDesign;
  private gravity = 1;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private pointerDown: { x: number; y: number } | null = null;
  private ready = false;
  private time = 0;

  constructor(private readonly planetId: string) {}

  async enter(ctx: GameContext): Promise<void> {
    this.ctx = ctx;
    const system = gameState.getSystem();
    const planet = system.planets.find((p) => p.id === this.planetId) ?? system.planets[0]!;
    this.gravity = planet.gravity;
    ctx.debug.setScene(this.name);
    ctx.debug.setSeed(system.seed);
    this.state = await ensurePlayerState(system.seed);
    this.saved = this.state.ship.design;
    this.working = { hullId: this.saved.hullId, parts: this.saved.parts.map((p) => ({ ...p })) };

    this.scene.background = new Color(0x070a12);
    this.scene.add(createStarfield(this.disposer, `yard:${system.seed}`, 1500, [80, 200]));
    const grid = new GridHelper(40, 40, 0x335577, 0x1b2a3f);
    this.disposer.add(grid.geometry);
    this.disposer.add(grid.material as never);
    this.scene.add(grid);
    this.scene.add(new HemisphereLight(0x9ab8ff, 0x2a2420, 1.1));
    const sun = new DirectionalLight(0xfff2dd, 2.2);
    sun.position.set(8, 14, 6);
    this.scene.add(sun);

    this.camera.position.set(9, 6, 11);
    this.controls = new OrbitControls(this.camera, ctx.renderer.gl.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.disposer.addFn(() => this.controls.dispose());

    this.ui = new ShipEditorUi(ctx.uiRoot, this.state, this.gravity, {
      onSelectPart: () => this.rebuild(),
      onSetHull: (id) => this.changeHull(id),
      onRemoveSelected: () => this.removeSelected(),
      onApply: () => this.apply(),
      onDiscard: () => this.discard(),
    });
    this.disposer.addFn(() => this.ui.dispose());
    const canvas = ctx.renderer.canvas;
    this.disposer.listen(canvas, 'pointerdown', (e) => (this.pointerDown = { x: e.clientX, y: e.clientY }));
    this.disposer.listen(canvas, 'pointerup', (e) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved < 5 && e.button === 0) this.click(e.clientX, e.clientY);
    });
    this.rebuild();
    this.ready = true;
  }

  private rebuild(): void {
    this.built?.dispose();
    const sel = this.ui.selectedPart;
    const kind = sel ? SOCKET_FOR_TYPE[partDef(sel).type] : null;
    this.built = buildShip(this.working, this.mats, { withSockets: true, socketKind: kind });
    this.scene.add(this.built.group);
    this.controls.target.set(0, this.built.height * 0.45, 0);
    this.ui.render(this.saved, this.working);
    this.ui.setHint(sel ? `${STR.editor.selected}: ${partDef(sel).name} – ${STR.editor.place}` : STR.editor.place);
  }

  private click(clientX: number, clientY: number): void {
    if (!this.built) return;
    const rect = this.ctx.renderer.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.built.group, true);
    for (const hit of hits) {
      const obj = hit.object as Mesh;
      const socket = obj.userData.socket as number | undefined;
      if (socket !== undefined) {
        if (!obj.userData.active || !this.ui.selectedPart) continue;
        const check = canPlace(this.working, this.ui.selectedPart, socket);
        if (!check.ok) {
          showToast(check.reason);
          return;
        }
        this.working = placePart(this.working, this.ui.selectedPart, socket);
        this.ui.selectedPlaced = null;
        this.rebuild();
        return;
      }
      const placedId = obj.userData.placedId as string | undefined;
      if (placedId && placedId !== 'hull') {
        const p = this.working.parts.find((x) => x.id === placedId);
        this.ui.selectedPlaced = placedId;
        this.ui.setHint(p ? `${STR.editor.selected}: ${partDef(p.partId).name} → ${STR.editor.remove}` : STR.editor.place);
        this.ui.render(this.saved, this.working);
        return;
      }
    }
  }

  private removeSelected(): void {
    if (!this.ui.selectedPlaced) return;
    this.working = removePart(this.working, this.ui.selectedPlaced);
    this.ui.selectedPlaced = null;
    this.rebuild();
  }

  private changeHull(hullId: string): void {
    if (hullId === this.working.hullId) return;
    const r = setHull(this.working, hullId);
    this.working = r.design;
    if (r.dropped.length) showToast(`${STR.editor.dropped}: ${r.dropped.map((p) => partDef(p.partId).name).join(', ')}`);
    this.ui.selectedPlaced = null;
    this.rebuild();
  }

  private apply(): void {
    const delta = costDelta(this.saved, this.working);
    const pay = ShipEditorUi.toPay(delta);
    const inv = this.state.inventory;
    if (!inv.canAfford(pay)) {
      showToast(STR.editor.unaffordable);
      return;
    }
    inv.pay(pay);
    for (const [id, n] of Object.entries(delta) as [ResourceId, number][]) if (n < 0) inv.add(id, -n);
    this.state.ship.design = { hullId: this.working.hullId, parts: this.working.parts.map((p) => ({ ...p })) };
    const max = shipStats(this.state.ship.design).maxFuel;
    if (this.state.ship.fuel > max) {
      inv.addItem('fuel', this.state.ship.fuel - max);
      this.state.ship.fuel = max;
    }
    this.state.touch();
    void savePlayerState(this.state);
    this.saved = this.state.ship.design;
    showToast(`${STR.editor.apply}: ${this.working.parts.length} Teile`);
    this.back();
  }

  private discard(): void {
    const changed = JSON.stringify(this.working) !== JSON.stringify(this.saved);
    if (changed) showToast(STR.editor.discard);
    this.back();
  }

  private back(): void {
    this.ctx.scenes.switchTo(new PlanetScene(this.planetId));
  }

  exit(): void {}

  update(dt: number): void {
    if (!this.ready) return;
    this.time += dt;
    if (this.ctx.input.wasPressed('pause')) this.discard();
  }

  render(_alpha: number, frameDt: number): void {
    if (!this.ready) return;
    this.controls.update();
    if (this.built) {
      for (const s of this.built.sockets) {
        if (!s.mesh.userData.active) continue;
        const pulse = 1 + Math.sin(this.time * 5 + s.index) * 0.18;
        s.mesh.scale.setScalar(pulse);
      }
    }
    void frameDt;
    this.ctx.renderer.gl.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.ready = false;
    this.built?.dispose();
    this.mats.dispose();
    this.disposer.dispose();
    this.scene.clear();
  }
}
