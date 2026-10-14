import { Color, FogExp2, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, Scene, SphereGeometry, Vector3 } from 'three';
import { BloomEffect, EffectPass, type EffectComposer } from 'postprocessing';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Biome, Planet, ResourceId, StarSystem, WeatherType } from '@/gen/universe/types';
import { RESOURCES, WEATHER } from '@/gen/universe/catalog';
import { RARITY_LABELS, TIME_LABELS, type ArchiveEntry } from '@/gen/archive/types';
import { BEHAVIOR_LABELS } from '@/gen/archive/descriptions';
import { matchesSpawn, pointTemperature, type SpawnContext } from '@/gen/archive/conditions';
import { kelvinToCelsius } from '@/math/utils';
import { DayCycle } from '@/world/DayCycle';
import { Sky } from '@/world/Sky';
import { WeatherSystem } from '@/world/Weather';
import { Precipitation } from '@/world/Precipitation';
import { Water } from '@/world/Water';
import { TerrainManager } from '@/world/terrain/TerrainManager';
import { VegetationAssets } from '@/world/VegetationAssets';
import { VegetationManager, type SpeciesPlacement } from '@/world/Vegetation';
import { FloraAssets } from '@/world/flora/FloraAssets';
import { CreatureManager, type CreatureEnv } from '@/world/creatures/CreatureManager';
import { STATE_LABELS } from '@/world/creatures/CreatureAI';
import { Player } from '@/world/Player';
import { PropManager, type WorldProp } from '@/world/props/PropManager';
import { HintSystem } from '@/world/HintSystem';
import { PhotoMode, type PhotoEnv, type ScoredSubject, type SubjectCandidate } from '@/world/photo/PhotoMode';
import { ArchiveProgress, type Sample } from '@/game/progress/ArchiveProgress';
import { analyzeMineralSample, createSample, microCellsForSample } from '@/game/samples';
import { getDb, type GameDb } from '@/save/Db';
import { PlayerState, type BaseModule, type PlayerStateSnapshot } from '@/game/PlayerState';
import { LAUNCH_FUEL_TARGET, MODULE_LABELS, RECIPE_BY_ID, type ItemId, type ModuleType, type Recipe } from '@/game/crafting/recipes';
import { ResourceNodeManager, type LiveNode } from '@/world/resources/ResourceNodeManager';
import { BaseManager, RECHARGE_RADIUS } from '@/world/base/BaseModules';
import { InventoryUi } from '@/ui/InventoryUi';
import { LabUi } from '@/ui/LabUi';
import { audio } from '@/audio/AudioManager';
import { Hud } from '@/ui/Hud';
import { PauseMenu } from '@/ui/PauseMenu';
import { LoadingOverlay } from '@/ui/LoadingOverlay';
import { PhotoUi } from '@/ui/PhotoUi';
import { ArchiveUi } from '@/ui/ArchiveUi';
import { MicroscopeView } from '@/ui/MicroscopeView';
import { STR } from '@/ui/strings';
import { showToast } from '@/ui/toast';
import { downloadBlob, el } from '@/ui/dom';
import { MainMenuScene } from './MainMenuScene';
import { SystemViewScene } from './SystemViewScene';

const VIEW_DISTANCE = 1700;
const PHOTO_SLOWMO = 0.1;
const HARVEST_SECONDS = 1.2;
const HARVEST_RANGE = 4.5;
const BUILD_RANGE = 12;
const LURE_SECONDS = 60;
const PLANT_REGROW_SECONDS = 300;
const BUILD_TYPES: ModuleType[] = ['workbench', 'shelter', 'charger', 'lab'];

interface Interaction {
  kind: 'none' | 'prop' | 'water' | 'plant' | 'soil';
  label: string;
  prop?: WorldProp;
  species?: SpeciesPlacement;
  biome?: Biome;
}

/** Ziel der E-Taste: Modul öffnen oder Rohstoff sammeln (halten). */
interface Harvest {
  kind: 'none' | 'module' | 'node' | 'water' | 'plant';
  label: string;
  module?: BaseModule;
  node?: LiveNode;
  resourceId?: ResourceId;
  plantKey?: string;
}

interface Lure {
  mesh: Mesh;
  ttl: number;
}

/**
 * Planetenoberfläche: Terrain, Himmel, Wetter, Wasser, Vegetation, Kreaturen, Props, Hinweise,
 * Foto-Modus mit Bewertung, Archiv-UI, Proben/Mikroskop und Persistenz (IndexedDB).
 */
export class PlanetScene implements GameScene {
  readonly name = 'Planet';
  private ctx!: GameContext;
  private system!: StarSystem;
  private planet!: Planet;
  private model!: TerrainModel;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(72, 1, 0.3, 4200);
  private readonly disposer = new Disposer();
  private sky!: Sky;
  private cycle!: DayCycle;
  private weather!: WeatherSystem;
  private terrain!: TerrainManager;
  private assets!: VegetationAssets;
  private flora!: FloraAssets;
  private vegetation!: VegetationManager;
  private creatures!: CreatureManager;
  private props!: PropManager;
  private hints!: HintSystem;
  private water: Water | null = null;
  private precipitation!: Precipitation;
  private player!: Player;
  private composer!: EffectComposer;
  private hud!: Hud;
  private pauseMenu!: PauseMenu;
  private fog!: FogExp2;
  private readonly waterFog = new Color();
  private paused = false;
  private switching = false;
  private ready = false;
  private elapsed = 0;
  private hudAccum = 1;
  private baseFog = 0.0005;
  private lockChangedAt = 0;
  private readonly camDir = new Vector3();
  private readonly tmpV = new Vector3();

  // Phase 4: Archiv, Foto, Proben
  private db!: GameDb;
  private progress!: ArchiveProgress;
  private photo!: PhotoMode;
  private photoUi!: PhotoUi;
  private archiveUi!: ArchiveUi;
  private microscope: MicroscopeView | null = null;
  private captureRequested = false;
  private lastPng: Blob | null = null;
  private photoCounter = 0;
  private sampleCounter = 0;
  private readonly sampledProps = new Set<string>();
  private readonly speciesBuf: SpeciesPlacement[] = [];
  private readonly propBuf: WorldProp[] = [];
  private readonly previewBuf: Array<{ entry: ArchiveEntry; ndcX: number; ndcY: number; frameFill: number }> = [];
  private interaction: Interaction = { kind: 'none', label: '' };
  private dirty = false;
  private saveTimer = 0;
  private previewAccum = 0;
  private skyActive: ArchiveEntry[] = [];

  // Phase 5: Überleben, Rohstoffe, Basis
  private state!: PlayerState;
  private nodes!: ResourceNodeManager;
  private base!: BaseManager;
  private inventoryUi!: InventoryUi;
  private labUi!: LabUi;
  private harvest: Harvest = { kind: 'none', label: '' };
  private harvestTarget: Harvest | null = null;
  private harvestProgress = 0;
  private readonly harvestedPlants = new Map<string, number>();
  private buildMode = false;
  private buildIndex = 0;
  private buildRot = 0;
  private readonly buildPos = { x: 0, z: 0, valid: false, reason: '' };
  private readonly lures: Lure[] = [];
  private readonly lurePositions: Vector3[] = [];
  private readonly lureGeometry = new SphereGeometry(0.22, 10, 7);
  private readonly lureMaterial = new MeshStandardMaterial({ color: 0xd87a3a, emissive: 0x7a3a10, emissiveIntensity: 0.5, roughness: 0.7 });
  private collapsing = false;
  private collapseTimer = 0;
  private respawned = false;
  private playerDirty = false;
  private playerSaveTimer = 0;

  constructor(private readonly planetId: string) {}

  async enter(ctx: GameContext): Promise<void> {
    this.ctx = ctx;
    this.system = gameState.getSystem();
    const planet = this.system.planets.find((p) => p.id === this.planetId);
    if (!planet || planet.type === 'gas_giant') {
      showToast(STR.planet.noSurface);
      ctx.scenes.switchTo(new SystemViewScene());
      return;
    }
    this.planet = planet;
    ctx.debug.setScene(`${this.name}:${planet.name}`);
    ctx.debug.setSeed(this.system.seed);
    const gl = ctx.renderer.gl;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFShadowMap;

    const loading = new LoadingOverlay(ctx.uiRoot, `${STR.planet.landing}: ${planet.name}`, STR.planet.buildingTerrain);
    await loading.nextFrame();
    const dbPromise = getDb();

    this.model = new TerrainModel(planet);
    this.fog = new FogExp2(0x000000, this.baseFog);
    this.scene.fog = this.fog;
    this.sky = new Sky(this.scene, this.system, planet);
    const saved = gameState.surface?.planetId === planet.id ? gameState.surface : null;
    this.cycle = new DayCycle(planet, 1200, saved?.dayT ?? 0.3);
    if (saved) this.cycle.totalDays = saved.totalDays;
    this.weather = new WeatherSystem(planet, this.system.seed);
    this.terrain = new TerrainManager(this.scene, this.model, { viewDistance: VIEW_DISTANCE });
    this.assets = new VegetationAssets();
    this.flora = new FloraAssets(this.assets);
    this.vegetation = new VegetationManager(this.scene, this.model, planet, this.assets, this.flora, this.system.entries);
    this.creatures = new CreatureManager(this.scene, this.system, planet, this.model);
    this.props = new PropManager(this.scene, this.model, planet, this.system.entries);
    if (this.model.hasWater) this.water = new Water(this.scene, planet, this.model.seaLevel);
    this.precipitation = new Precipitation(2400, `precip:${planet.id}`);
    this.scene.add(this.precipitation.points);
    this.player = new Player(this.model, planet, ctx.input, this.camera);
    this.scene.add(this.player.body);

    // Spielerzustand (Inventar, Überleben, Basis) laden – vor dem Spawn, damit der Respawn-Punkt zählt
    this.db = await dbPromise;
    const playerSnapshot = await this.db.getValue<PlayerStateSnapshot>(`player:${this.system.seed}`);
    this.state = playerSnapshot ? PlayerState.fromJSON(playerSnapshot) : new PlayerState(this.system.seed);
    this.state.onChange(() => {
      this.playerDirty = true;
      this.checkGoal();
    });
    this.nodes = new ResourceNodeManager(this.scene, this.model, planet);
    this.base = new BaseManager(this.scene, this.model, planet, this.state);

    const respawn = this.state.respawn[planet.id];
    if (saved) this.player.spawn(saved.x, saved.y, saved.z, saved.yaw);
    else if (respawn) this.player.spawn(respawn.x + 3, this.model.heightAt(respawn.x + 3, respawn.z + 3), respawn.z + 3, 0);
    else {
      const s = this.model.findSpawn();
      this.player.spawn(s.x, s.y, s.z, 0);
    }
    this.player.applyCamera(1);
    this.baseFog = (0.95 / VIEW_DISTANCE) * Math.max(0.12, Math.min(1, this.sky.look.density));
    this.waterFog.set(this.planet.biomes.find((b) => b.hasWater)?.palette.ground ?? '#2f6f9a').multiplyScalar(0.5);

    this.composer = ctx.renderer.createComposer(this.scene, this.camera);
    this.composer.addPass(new EffectPass(this.camera, new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.3, intensity: 0.45, mipmapBlur: true })));
    this.photo = new PhotoMode(gl, this.camera, this.composer, [
      { collectSubjects: (pos, maxDist, out) => this.collectCreatures(pos, maxDist, out) },
      { collectSubjects: (pos, maxDist, out) => this.collectFlora(pos, maxDist, out) },
      { collectSubjects: (pos, maxDist, out) => this.collectProps(pos, maxDist, out) },
      { collectSubjects: (_pos, _maxDist, out) => this.collectSky(out) },
    ]);

    // Terrain in Scheiben aufbauen
    this.terrain.update(this.camera.position, 1);
    const total = Math.max(1, this.terrain.pending + 1);
    while (this.terrain.pending > 0) {
      this.terrain.buildAllNow(this.camera.position, 40);
      loading.set(1 - this.terrain.pending / total, `${STR.planet.buildingTerrain} ${total - this.terrain.pending}/${total}`);
      await loading.nextFrame();
    }
    loading.set(1, STR.planet.vegetation);
    await loading.nextFrame();
    this.vegetation.buildAllNow(this.camera.position);
    this.props.update(this.camera.position, 2);
    this.nodes.update(this.camera.position, 1);

    // Fortschritt laden
    const snapshot = await this.db.loadProgress(this.system.seed);
    this.progress = snapshot ? ArchiveProgress.fromJSON(snapshot, this.system.entries) : new ArchiveProgress(this.system.seed, this.system.entries);
    this.progress.onChange(() => (this.dirty = true));
    this.hints = new HintSystem(this.scene, this.model, planet, this.system.entries, this.system.families, this.progress, this.system.seed);
    loading.dispose();

    this.hud = new Hud(ctx.uiRoot);
    this.hud.setHint(STR.planet.clickToStart);
    this.photoUi = new PhotoUi(ctx.uiRoot);
    this.archiveUi = new ArchiveUi(
      ctx.uiRoot,
      this.system,
      this.progress,
      this.db,
      {
        onClose: () => this.closeCatalog(),
        onTabChange: () => this.closeMicroscope(),
        onAnalyzeSample: (s) => this.analyzeSample(s),
        onDiscardSample: (s) => this.progress.removeSample(s.id),
        onExportPhoto: (id) => void this.exportPhoto(id),
      },
      planet.id,
    );
    this.inventoryUi = new InventoryUi(ctx.uiRoot, this.state, { onCraft: (r) => this.craft(r), onUseItem: (id) => this.useItem(id), onClose: () => this.closeInventory() }, () => this.goalText());
    this.inventoryUi.planetIdForLab = planet.id;
    this.labUi = new LabUi(ctx.uiRoot, this.state, this.system.fuelFormula, { onClose: () => this.closeLab(), onFuelProduced: (n) => this.onFuelProduced(n) });
    this.pauseMenu = new PauseMenu(ctx.uiRoot, {
      onResume: () => this.resume(),
      onSystemView: () => this.leave(new SystemViewScene()),
      onMainMenu: () => this.leave(new MainMenuScene()),
    }, [STR.pause.phase4, STR.pause.phase5]);
    const canvas = ctx.renderer.canvas;
    this.disposer.listen(canvas, 'click', () => {
      audio.unlock();
      if (!this.paused && !this.uiOpen && !ctx.input.pointerLocked) ctx.input.requestPointerLock();
    });
    this.disposer.listen(document, 'pointerlockchange', () => {
      const locked = ctx.input.pointerLocked;
      this.lockChangedAt = performance.now();
      this.hud.setHint(locked ? '' : this.uiOpen ? '' : STR.planet.clickToStart);
      this.hud.setCrosshair(locked && !this.photo.active);
      if (!locked && !this.switching && !this.paused && !this.uiOpen) this.pause();
    });
    this.disposer.addFn(() => {
      this.hud.dispose();
      this.pauseMenu.dispose();
      this.photoUi.dispose();
      this.archiveUi.dispose();
      this.inventoryUi.dispose();
      this.labUi.dispose();
      this.closeMicroscope();
    });
    this.checkGoal();
    this.ready = true;
    const c = this.progress.completion(planet.id);
    showToast(`${planet.name} · ${planet.typeLabel} · Archiv ${c.discovered}/${c.total}`);
  }

  // ---------------------------------------------------------------------------
  // Debug-API
  setTimeOfDay(t: number): void {
    this.cycle.t = ((t % 1) + 1) % 1;
    this.cycle.advance(0);
  }

  spawnNearby(count = 8): number {
    const pl = this.player;
    return this.creatures.forceSpawn({ pos: pl.position, yaw: pl.yaw, noise: 0 }, this.creatureEnv(), count);
  }

  forceWeather(type: WeatherType, instant = false): void {
    this.weather.force(type);
    if (instant) this.weather.update(1000);
  }

  /** Debug/Test: Foto auslösen (auch ohne Foto-Modus). */
  takePhoto(): void {
    if (!this.photo.active) this.enterPhoto();
    this.captureRequested = true;
  }

  get archive(): ArchiveProgress {
    return this.progress;
  }

  get playerState(): PlayerState {
    return this.state;
  }

  get baseManager(): BaseManager {
    return this.base;
  }

  get nodeManager(): ResourceNodeManager {
    return this.nodes;
  }

  /** Debug/Test: aktuelles E-Ziel sofort sammeln (ohne Halten). */
  harvestNow(): string {
    this.harvest = this.computeHarvest();
    if (this.harvest.kind === 'none' || this.harvest.kind === 'module') return this.harvest.kind;
    this.performHarvest(this.harvest);
    return this.harvest.kind;
  }

  /** Debug/Test: Modul direkt platzieren (ohne Bau-Modus). */
  placeModule(type: ModuleType, x: number, z: number): boolean {
    const p = this.base.snap(x, z);
    const check = this.base.validate(type, p.x, p.z);
    if (!check.ok) return false;
    this.base.place(type, p.x, p.z, 0);
    return true;
  }

  private get uiOpen(): boolean {
    return this.archiveUi.isOpen || this.inventoryUi.isOpen || this.labUi.isOpen;
  }

  // ---------------------------------------------------------------------------
  private creatureEnv(): CreatureEnv {
    return {
      timeOfDay: this.cycle.timeOfDay,
      weather: this.weather.activeType,
      daylight: this.cycle.daylight,
      afterStorm: this.weather.afterStorm,
      solstice: false,
      eclipse: this.sky.eclipse,
    };
  }

  private spawnContextAt(x: number, z: number): SpawnContext {
    const s = this.model.sample(x, z);
    const biome = this.planet.biomes[s.blend > 0.5 ? s.biome2 : s.biome]!;
    const underwater = this.model.hasWater && s.height < this.model.seaLevel - 1.5;
    return {
      timeOfDay: this.cycle.timeOfDay,
      weather: this.weather.activeType,
      altitude: s.altitude,
      temperature: pointTemperature(this.planet, biome, s.altitude, this.cycle.daylight),
      biomeId: biome.id,
      inCave: biome.isCave,
      underwater,
      deepSea: underwater && biome.kind === 'deep_sea',
      afterStorm: this.weather.afterStorm,
      solstice: false,
      eclipse: this.sky.eclipse,
    };
  }

  private collectCreatures(pos: Vector3, maxDist: number, out: SubjectCandidate[]): void {
    for (const c of this.creatures.creatures) {
      if (Math.hypot(c.position.x - pos.x, c.position.z - pos.z) > maxDist) continue;
      out.push({ entry: c.entry, center: c.bodyCenter(new Vector3()), radius: Math.max(0.15, c.template.lengthM * 0.55), ...(c.ai.behavior ? { behavior: c.ai.behavior } : {}), motion: c.motion, underwater: c.position.y < this.model.seaLevel - 0.3 });
    }
  }

  private collectFlora(pos: Vector3, maxDist: number, out: SubjectCandidate[]): void {
    this.vegetation.querySpecies(pos.x, pos.z, Math.min(maxDist, 90), this.speciesBuf);
    for (const sp of this.speciesBuf) {
      const bloom = (sp.entry.genome.kind === 'flora' ? sp.entry.genome.bloomTime : 'any') as string;
      const blooming = bloom !== 'any' && (bloom === this.cycle.timeOfDay || (bloom === 'day' && this.cycle.daylight > 0.6) || (bloom === 'night' && this.cycle.daylight < 0.3));
      out.push({ entry: sp.entry, center: new Vector3(sp.x, sp.y + sp.height * 0.5, sp.z), radius: Math.max(0.25, sp.height * 0.5), motion: 0, underwater: sp.entry.subcategory === 'aquatic', ...(blooming && sp.entry.behaviors.includes('blooming') ? { behavior: 'blooming' } : {}) });
    }
  }

  private collectProps(pos: Vector3, maxDist: number, out: SubjectCandidate[]): void {
    this.props.nearby(pos, Math.min(maxDist, 90), this.propBuf);
    for (const p of this.propBuf) {
      if (p.entry.category !== 'fossil') continue;
      out.push({ entry: p.entry, center: p.center, radius: Math.max(0.3, p.radius), motion: 0, underwater: false });
    }
  }

  private collectSky(out: SubjectCandidate[]): void {
    for (const e of this.skyActive) out.push({ entry: e, center: this.camera.position, radius: 0, motion: 0, underwater: false, sky: true });
  }

  private refreshSkyPhenomena(): void {
    const ctx = this.spawnContextAt(this.player.position.x, this.player.position.z);
    this.skyActive = this.system.entries.filter((e) => e.planetId === this.planet.id && e.category === 'weather' && matchesSpawn(e, ctx, { altitude: 2, temperature: 999 }));
  }

  private photoEnv(): PhotoEnv {
    return {
      daylight: this.cycle.daylight,
      sunDir: this.cycle.sunDir,
      cameraUnderwater: this.model.hasWater && this.camera.position.y < this.model.seaLevel,
      occluders: [this.terrain.group, this.props.group],
      tolerance: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Foto-Modus
  private enterPhoto(): void {
    if (this.photo.active) return;
    this.photo.enter();
    this.player.frozen = true;
    this.photoUi.show();
    this.hud.setCrosshair(false);
    this.hud.setPrompt('');
    this.hud.setPhotoMode(true);
    this.refreshSkyPhenomena();
    audio.blip();
  }

  private exitPhoto(): void {
    if (!this.photo.active) return;
    this.photo.exit();
    this.player.frozen = false;
    this.player.selfie = false;
    this.photoUi.hide();
    this.hud.setPhotoMode(false);
    this.hud.setCrosshair(this.ctx.input.pointerLocked);
  }

  private updatePhotoInput(): void {
    const input = this.ctx.input;
    const p = this.photo;
    if (this.photoUi.resultOpen) {
      if (input.wasPressed('shutter') || input.mouseButtonPressed(0) || input.wasPressed('interact')) this.photoUi.hideResult();
      return;
    }
    if (input.wheelDelta !== 0) p.zoom(-input.wheelDelta * 4);
    if (input.isDown('photo_focus_near')) p.focus(-1 / 12);
    if (input.isDown('photo_focus_far')) p.focus(1 / 12);
    if (input.wasPressed('photo_aperture')) p.cycleAperture();
    if (input.wasPressed('photo_exposure_down')) p.exposureStep(-1);
    if (input.wasPressed('photo_exposure_up')) p.exposureStep(1);
    if (input.wasPressed('photo_filter')) p.cycleFilter();
    if (input.wasPressed('photo_grid')) p.settings.grid = !p.settings.grid;
    if (input.wasPressed('photo_selfie')) {
      p.settings.selfie = !p.settings.selfie;
      this.player.selfie = p.settings.selfie;
    }
    if (input.mouseButtonPressed(2)) p.autofocus(this.photoEnv());
    if (input.wasPressed('shutter') || input.mouseButtonPressed(0)) this.captureRequested = true;
  }

  private capture(): void {
    const canvas = this.ctx.renderer.canvas;
    const subjects = this.photo.evaluate(this.photoEnv());
    const photoId = `${this.system.seed}-${this.planet.id}-${Date.now()}-${++this.photoCounter}`;
    const width = canvas.width;
    const height = canvas.height;
    const settings = { ...this.photo.settings };
    this.photoUi.triggerFlash();
    audio.shutter();
    canvas.toBlob((png) => (this.lastPng = png), 'image/png');
    canvas.toBlob(
      (jpeg) => {
        if (!jpeg) return;
        void this.finishCapture(photoId, jpeg, width, height, subjects, settings);
      },
      'image/jpeg',
      0.9,
    );
  }

  private async makeThumb(blob: Blob, width: number, height: number): Promise<Blob> {
    const bmp = await createImageBitmap(blob);
    const w = 480;
    const h = Math.round((w * height) / width);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b ?? blob), 'image/jpeg', 0.82));
  }

  private async finishCapture(photoId: string, jpeg: Blob, width: number, height: number, subjects: ScoredSubject[], settings: PhotoMode['settings']): Promise<void> {
    const thumb = await this.makeThumb(jpeg, width, height);
    const at = this.elapsed;
    const results = subjects.map((s, i) => ({
      subject: s,
      result: this.progress.recordPhoto(s.entry.id, s.score.total, photoId, s.observation.behavior, at, i === 0),
      name: this.progress.displayName(s.entry),
    }));
    if (subjects.length === 0) this.progress.photosTaken++;
    let maxStars = 0;
    for (const r of results) {
      maxStars = Math.max(maxStars, r.result.stars);
      if (r.result.newDiscovery) {
        const rumor = this.hints.rumorFor(r.subject.entry, (id) => this.planet.biomes.find((b) => b.id === id)?.name ?? id);
        if (rumor) showToast(`✦ ${rumor.text}`, 6000);
      }
    }
    if (maxStars > 0) setTimeout(() => audio.success(maxStars), 150);
    const primary = subjects[0];
    await this.db.savePhoto({
      id: photoId,
      seed: this.system.seed,
      planetId: this.planet.id,
      entryIds: subjects.map((s) => s.entry.id),
      ...(primary ? { primaryEntryId: primary.entry.id } : {}),
      score: primary?.score.total ?? 0,
      stars: primary?.stars ?? 0,
      ...(primary?.observation.behavior ? { behavior: primary.observation.behavior } : {}),
      takenAt: Date.now(),
      width,
      height,
      settings: { focusDistance: settings.focusDistance, aperture: settings.aperture, exposure: settings.exposure, fov: settings.fov, filter: settings.filter },
      blob: jpeg,
      thumb,
    });
    const thumbUrl = URL.createObjectURL(thumb);
    this.photoUi.showResult({
      thumbUrl,
      subjects: results,
      onExportPng: () => {
        if (this.lastPng) downloadBlob(this.lastPng, `stellar-${photoId}.png`);
      },
      onClose: () => {
        this.photoUi.hideResult();
        URL.revokeObjectURL(thumbUrl);
      },
    });
  }

  private async exportPhoto(photoId: string): Promise<void> {
    const rec = await this.db.getPhoto(photoId);
    if (!rec) return;
    const bmp = await createImageBitmap(rec.blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d')?.drawImage(bmp, 0, 0);
    bmp.close();
    c.toBlob((b) => {
      if (b) downloadBlob(b, `stellar-${photoId}.png`);
    }, 'image/png');
  }

  // ---------------------------------------------------------------------------
  // Katalog, Proben, Mikroskop
  private openCatalog(): void {
    if (this.archiveUi.isOpen) return;
    this.exitPhoto();
    this.archiveUi.show();
    this.hud.setPrompt('');
    this.ctx.input.exitPointerLock();
    this.ctx.input.reset();
    this.saveSurface();
  }

  private closeCatalog(): void {
    if (!this.archiveUi.isOpen) return;
    this.closeMicroscope();
    this.archiveUi.hide();
    this.ctx.input.requestPointerLock();
  }

  private closeMicroscope(): void {
    if (!this.microscope) return;
    this.microscope.dispose();
    this.microscope = null;
    this.archiveUi.holdRender = false;
  }

  private analyzeSample(sample: Sample): void {
    if (sample.entryId) {
      const a = analyzeMineralSample(sample);
      const entry = this.system.entries.find((e) => e.id === sample.entryId);
      if (!entry) return;
      const r = this.progress.discoverByAnalysis(entry.id, a.quality, this.elapsed);
      sample.analyzed = true;
      showToast(`${this.progress.displayName(entry)}: ${'★'.repeat(r.stars)} · Reinheit ${(a.purity * 100).toFixed(0)} % · ${a.notes.join(' ')}`, 5000);
      audio.success(r.stars);
      this.archiveUi.selectEntry(entry.id);
      return;
    }
    const cells = microCellsForSample(sample, this.system.entries);
    sample.analyzed = true;
    if (cells.length === 0) {
      showToast(STR.micro.none);
      this.dirty = true;
      return;
    }
    this.closeMicroscope();
    this.archiveUi.holdRender = true;
    const host = this.archiveUi.bodyElement;
    const closeBtn = el('button', { class: 'small', text: STR.micro.close, onClick: () => { this.closeMicroscope(); this.archiveUi.show('samples'); } });
    const wrapper = el('div', { class: 'microscope-wrap' }, el('div', { class: 'row' }, el('span', { class: 'name', text: sample.label }), closeBtn));
    host.prepend(wrapper);
    this.microscope = new MicroscopeView(wrapper);
    const labels = new Map(cells.map((c) => [c.entry.id, this.progress.isDiscovered(c.entry.id) ? this.progress.displayName(c.entry) : `${STR.archive.unknown} (${c.entry.subcategory})`]));
    this.microscope.load(cells, labels, (cell, sharpness) => {
      const quality = 0.3 + sharpness * 0.7;
      const r = this.progress.discoverByAnalysis(cell.entry.id, quality, this.elapsed);
      labels.set(cell.entry.id, this.progress.displayName(cell.entry));
      showToast(`${this.progress.displayName(cell.entry)}: ${'★'.repeat(r.stars)}${r.newDiscovery ? ` · ${STR.photo.newEntry}` : ''}`, 3500);
      audio.success(r.stars);
    });
  }

  // ---------------------------------------------------------------------------
  // Proben/Scan (F)
  private computeInteraction(): Interaction {
    this.camera.getWorldDirection(this.camDir);
    const hit = this.props.pick(this.camera.position, this.camDir, 4.5);
    if (hit) {
      const e = hit.prop.entry;
      const name = this.progress.isDiscovered(e.id) ? this.progress.displayName(e) : `${STR.archive.unknown} (${e.category === 'fossil' ? (e.subcategory === 'ruin' ? 'Ruine' : 'Fossil') : e.category === 'ore' ? 'Erz' : 'Gestein'})`;
      if (e.category === 'fossil') return { kind: 'prop', label: `F: ${STR.interact.scan} – ${name}`, prop: hit.prop };
      const done = this.sampledProps.has(hit.prop.id);
      return { kind: 'prop', label: `F: ${STR.interact.sample} – ${name}${done ? ` (${STR.interact.sampled})` : ''}`, prop: hit.prop };
    }
    const sea = this.model.seaLevel;
    if (this.model.hasWater && this.camera.position.y > sea && this.camDir.y < -0.05) {
      const dist = (sea - this.camera.position.y) / this.camDir.y;
      if (dist > 0 && dist < 5) {
        const x = this.camera.position.x + this.camDir.x * dist;
        const z = this.camera.position.z + this.camDir.z * dist;
        if (this.model.heightAt(x, z) < sea) return { kind: 'water', label: `F: ${STR.interact.water}`, biome: this.model.biomeAt(x, z) };
      }
    }
    const best = this.plantInView();
    if (best) {
      const name = this.progress.isDiscovered(best.entry.id) ? this.progress.displayName(best.entry) : STR.archive.unknown;
      return { kind: 'plant', label: `F: ${STR.interact.plant} – ${name}`, species: best, biome: this.model.biomeAt(best.x, best.z) };
    }
    if (this.player.grounded && !this.player.swimming) {
      const biome = this.model.biomeAt(this.player.position.x, this.player.position.z);
      return { kind: 'soil', label: `F: ${STR.interact.soil} (${biome.name})`, biome };
    }
    return { kind: 'none', label: '' };
  }

  /** Nächste Pflanze im Blickkegel (erwartet `camDir` aktuell). */
  private plantInView(): SpeciesPlacement | null {
    this.vegetation.querySpecies(this.player.position.x, this.player.position.z, 3.2, this.speciesBuf);
    let best: SpeciesPlacement | null = null;
    let bestCos = 0.8;
    for (const sp of this.speciesBuf) {
      this.tmpV.set(sp.x, sp.y + sp.height * 0.5, sp.z).sub(this.camera.position);
      const d = this.tmpV.length();
      if (d < 0.1) continue;
      const cos = this.tmpV.divideScalar(d).dot(this.camDir);
      if (cos > bestCos) {
        bestCos = cos;
        best = sp;
      }
    }
    return best;
  }

  /** Blick auf eine Wasseroberfläche in Reichweite? Liefert die Distanz oder -1. */
  private waterInView(maxDist: number): number {
    const sea = this.model.seaLevel;
    if (!this.model.hasWater || this.camera.position.y <= sea || this.camDir.y >= -0.05) return -1;
    const dist = (sea - this.camera.position.y) / this.camDir.y;
    if (dist <= 0 || dist >= maxDist) return -1;
    const x = this.camera.position.x + this.camDir.x * dist;
    const z = this.camera.position.z + this.camDir.z * dist;
    return this.model.heightAt(x, z) < sea ? dist : -1;
  }

  // ---------------------------------------------------------------------------
  // Sammeln und Module (E)
  private hasDeposit(id: ResourceId): boolean {
    return this.planet.resources.some((d) => d.resourceId === id);
  }

  private computeHarvest(): Harvest {
    this.camera.getWorldDirection(this.camDir);
    const mod = this.base.pick(this.camera.position, this.camDir, HARVEST_RANGE);
    if (mod) return { kind: 'module', label: `E: ${STR.interact.open} – ${MODULE_LABELS[mod.type]}`, module: mod };
    const hit = this.nodes.pick(this.camera.position, this.camDir, HARVEST_RANGE);
    if (hit) {
      const id = hit.node.node.resourceId;
      return { kind: 'node', label: `E halten: ${STR.interact.harvest} – ${RESOURCES[id].name} (${hit.node.remaining})`, node: hit.node, resourceId: id };
    }
    if (this.waterInView(5) > 0) {
      const id: ResourceId | null = this.hasDeposit('water') ? 'water' : this.hasDeposit('brine') ? 'brine' : null;
      if (id) return { kind: 'water', label: `E halten: ${STR.interact.collectWater} (${RESOURCES[id].name})`, resourceId: id };
    }
    const plant = this.plantInView();
    if (plant) {
      const form = plant.entry.genome.kind === 'flora' ? plant.entry.genome.form : 'shrub';
      let id: ResourceId | null = null;
      if (form === 'fungus' && this.hasDeposit('spores')) id = 'spores';
      else if (form === 'tree' && this.hasDeposit('resin')) id = 'resin';
      else if (this.hasDeposit('fiber')) id = 'fiber';
      else if (this.hasDeposit('resin')) id = 'resin';
      else if (this.hasDeposit('spores')) id = 'spores';
      if (id) {
        const key = `${plant.x.toFixed(1)}:${plant.z.toFixed(1)}`;
        const regrow = this.harvestedPlants.get(key);
        if (regrow !== undefined && regrow > this.elapsed) return { kind: 'none', label: '' };
        const label = id === 'spores' ? STR.interact.collectSpores : id === 'resin' ? STR.interact.collectResin : STR.interact.collectFiber;
        return { kind: 'plant', label: `E halten: ${label}`, resourceId: id, plantKey: key };
      }
    }
    return { kind: 'none', label: '' };
  }

  private updateHarvest(dt: number): void {
    const input = this.ctx.input;
    if (input.wasPressed('interact')) {
      audio.unlock();
      this.harvest = this.computeHarvest();
      if (this.harvest.kind === 'module') {
        this.openModule(this.harvest.module as BaseModule);
        return;
      }
      if (this.harvest.kind !== 'none') {
        this.harvestTarget = this.harvest;
        this.harvestProgress = 0;
      }
    }
    if (!this.harvestTarget) return;
    if (!input.isDown('interact') || this.player.speed > 2) {
      this.harvestTarget = null;
      this.hud.setHarvest(null);
      return;
    }
    this.harvestProgress += dt / HARVEST_SECONDS;
    this.hud.setHarvest(Math.min(1, this.harvestProgress));
    if (this.harvestProgress >= 1) {
      this.performHarvest(this.harvestTarget);
      this.harvestTarget = null;
      this.hud.setHarvest(null);
      this.harvest = this.computeHarvest();
      this.hud.setPrompt(this.promptText());
    }
  }

  private performHarvest(h: Harvest): void {
    const inv = this.state.inventory;
    const id = h.resourceId as ResourceId;
    let got = 0;
    if (h.kind === 'node' && h.node) {
      got = inv.add(id, this.nodes.harvest(h.node, 2));
      if (h.node.remaining <= 0) showToast(STR.interact.depleted, 2500);
    } else if (h.kind === 'water') got = inv.add(id, 2);
    else if (h.kind === 'plant') {
      got = inv.add(id, 1);
      if (h.plantKey) this.harvestedPlants.set(h.plantKey, this.elapsed + PLANT_REGROW_SECONDS);
    }
    if (got > 0) {
      showToast(`+${got} ${RESOURCES[id].name} ${STR.interact.gained} (${inv.get(id)})`, 1800);
      audio.blip();
    }
  }

  private openModule(m: BaseModule): void {
    if (m.type === 'workbench') this.openInventory('workbench');
    else if (m.type === 'lab') this.openLab();
    else if (m.type === 'shelter') {
      this.state.respawn[this.planet.id] = { x: m.x, z: m.z };
      this.state.touch();
      showToast(`${STR.survival.respawnSet} · ${STR.survival.recharging}`);
    } else showToast(`${MODULE_LABELS[m.type]}: ${STR.survival.recharging} (${RECHARGE_RADIUS} m)`);
  }

  // ---------------------------------------------------------------------------
  // Inventar, Fertigung, Labor
  private openInventory(station: 'hand' | 'workbench'): void {
    if (this.inventoryUi.isOpen) return;
    this.exitPhoto();
    this.exitBuild();
    this.inventoryUi.show(station);
    this.hud.setPrompt('');
    this.ctx.input.exitPointerLock();
    this.ctx.input.reset();
  }

  private closeInventory(): void {
    if (!this.inventoryUi.isOpen) return;
    this.inventoryUi.hide();
    this.ctx.input.requestPointerLock();
  }

  private openLab(): void {
    if (this.labUi.isOpen) return;
    this.exitPhoto();
    this.exitBuild();
    this.labUi.show();
    this.hud.setPrompt('');
    this.ctx.input.exitPointerLock();
    this.ctx.input.reset();
    if (this.state.goalStep < 3) {
      this.state.goalStep = 3;
      this.state.touch();
    }
  }

  private closeLab(): void {
    if (!this.labUi.isOpen) return;
    this.labUi.hide();
    this.ctx.input.requestPointerLock();
  }

  private craft(r: Recipe): void {
    const st = this.state;
    if (r.requiresLab && !st.hasModule(this.planet.id, 'lab')) return;
    if (r.max !== undefined && st.labLevel >= r.max) return;
    if (!st.inventory.pay(r.cost)) {
      const miss = Object.entries(st.inventory.missing(r.cost)).map(([id, n]) => `${n} ${RESOURCES[id as ResourceId].name}`);
      showToast(`Fehlt: ${miss.join(', ')}`);
      return;
    }
    if (r.id === 'lab_upgrade') {
      st.labLevel++;
      st.touch();
      showToast(`${STR.lab.level} ${st.labLevel + 1}`);
    } else {
      st.inventory.addItem(r.id, 1);
      showToast(`${r.name} gefertigt${r.module ? ` – ${STR.inventory.craftModule}` : ''}`);
    }
    audio.blip();
  }

  private useItem(id: ItemId): void {
    const st = this.state;
    if (id === 'oxygen_cell' || id === 'energy_cell') {
      const full = id === 'oxygen_cell' ? st.survival.oxygen >= 99.5 : st.survival.energy >= 99.5;
      if (full || !st.inventory.removeItem(id)) return;
      if (id === 'oxygen_cell') st.survival.useOxygenCell();
      else st.survival.useEnergyCell();
      st.touch();
      audio.blip();
      return;
    }
    if (id === 'lure') {
      if (!st.inventory.removeItem('lure')) return;
      this.closeInventory();
      this.placeLure();
      return;
    }
    const module = RECIPE_BY_ID[id]?.module;
    if (module) {
      this.closeInventory();
      this.buildIndex = Math.max(0, BUILD_TYPES.indexOf(module));
      this.enterBuild();
    }
  }

  private onFuelProduced(amount: number): void {
    audio.success(amount >= 10 ? 3 : 2);
    this.progress.addLog('info', `Treibstoff synthetisiert: +${amount} (${this.state.inventory.getItem('fuel')}/${LAUNCH_FUEL_TARGET})`, this.elapsed, undefined, this.planet.id);
    if (this.state.inventory.getItem('fuel') >= LAUNCH_FUEL_TARGET) showToast(STR.goals[5] as string, 6000);
  }

  private goalText(): string {
    return STR.goals[Math.min(STR.goals.length - 1, this.state.goalStep)] as string;
  }

  /** Zielschritt aus dem Zustand ableiten (nur aufwärts). */
  private checkGoal(): void {
    const st = this.state;
    const inv = st.inventory;
    let step = 0;
    if (inv.getItem('fuel') >= LAUNCH_FUEL_TARGET) step = 5;
    else if (inv.getItem('fuel') > 0) step = 4;
    else if (st.modules.some((m) => m.type === 'lab')) step = 3;
    else if (st.modules.some((m) => m.type === 'workbench')) step = 2;
    else if (inv.getItem('workbench') > 0 || inv.canAfford(RECIPE_BY_ID.workbench?.cost ?? {})) step = 1;
    if (step > st.goalStep) {
      st.goalStep = step;
      this.playerDirty = true;
    }
    this.hud?.setGoal(this.goalText());
  }

  // ---------------------------------------------------------------------------
  // Bau-Modus (B)
  private enterBuild(): void {
    if (this.buildMode) return;
    this.exitPhoto();
    this.buildMode = true;
    this.harvestTarget = null;
    this.hud.setHarvest(null);
    this.hud.setPrompt('');
    this.base.setGhost(BUILD_TYPES[this.buildIndex] as ModuleType);
    this.refreshPalette();
    showToast(`${STR.build.enter}: ${STR.build.hint}`, 3500);
  }

  private exitBuild(): void {
    if (!this.buildMode) return;
    this.buildMode = false;
    this.base.setGhost(null);
    this.hud.setPalette(null, 0, '');
  }

  private refreshPalette(): void {
    const inv = this.state.inventory;
    this.hud.setPalette(
      BUILD_TYPES.map((t) => ({ label: `${MODULE_LABELS[t]} ×${inv.getItem(t)}`, affordable: inv.getItem(t) > 0 })),
      this.buildIndex,
      STR.build.hint,
    );
  }

  private updateBuildInput(): void {
    const input = this.ctx.input;
    const slots: Array<'slot1' | 'slot2' | 'slot3' | 'slot4'> = ['slot1', 'slot2', 'slot3', 'slot4'];
    slots.forEach((a, i) => {
      if (input.wasPressed(a) && i < BUILD_TYPES.length) {
        this.buildIndex = i;
        this.base.setGhost(BUILD_TYPES[i] as ModuleType);
        this.refreshPalette();
      }
    });
    if (input.wasPressed('rotate')) this.buildRot = (this.buildRot + 1) % 4;
    if (input.wasPressed('build')) {
      this.exitBuild();
      return;
    }
    if (input.wasPressed('inventory')) {
      this.openInventory('hand');
      return;
    }
    const type = BUILD_TYPES[this.buildIndex] as ModuleType;
    // Zielpunkt: Strahl von der Kamera auf das Terrain (Schrittsuche bis BUILD_RANGE)
    this.camera.getWorldDirection(this.camDir);
    let tx = this.camera.position.x + this.camDir.x * 6;
    let tz = this.camera.position.z + this.camDir.z * 6;
    for (let t = 1; t <= BUILD_RANGE; t += 0.5) {
      const x = this.camera.position.x + this.camDir.x * t;
      const z = this.camera.position.z + this.camDir.z * t;
      const y = this.camera.position.y + this.camDir.y * t;
      if (y <= this.model.heightAt(x, z)) {
        tx = x;
        tz = z;
        break;
      }
      tx = x;
      tz = z;
    }
    const p = this.base.snap(tx, tz);
    const check = this.base.validate(type, p.x, p.z);
    this.buildPos.x = p.x;
    this.buildPos.z = p.z;
    this.buildPos.valid = check.ok;
    this.buildPos.reason = check.reason;
    this.base.updateGhost(p.x, p.z, this.buildRot, check.ok && this.state.inventory.getItem(type) > 0);

    if (input.mouseButtonPressed(0) && input.pointerLocked) {
      if (this.state.inventory.getItem(type) <= 0) showToast(STR.build.noItem);
      else if (!check.ok) showToast(`${STR.build.invalid}: ${check.reason}`);
      else {
        this.state.inventory.removeItem(type);
        this.base.place(type, p.x, p.z, this.buildRot);
        showToast(`${MODULE_LABELS[type]} ${STR.build.placed.toLowerCase()}${type === 'shelter' ? ` · ${STR.survival.respawnSet}` : ''}`);
        audio.success(1);
        this.refreshPalette();
      }
    }
    if (input.wasPressed('remove')) {
      const m = this.base.pick(this.camera.position, this.camDir, BUILD_RANGE);
      if (m) {
        this.base.remove(m.id);
        const cost = RECIPE_BY_ID[m.type]?.cost ?? {};
        for (const [id, n] of Object.entries(cost) as [ResourceId, number][]) this.state.inventory.add(id, Math.floor(n / 2));
        showToast(`${MODULE_LABELS[m.type]} ${STR.build.removed.toLowerCase()}`);
        audio.blip();
        this.refreshPalette();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Köder
  private placeLure(): void {
    const mesh = new Mesh(this.lureGeometry, this.lureMaterial);
    this.camera.getWorldDirection(this.camDir);
    const x = this.player.position.x + this.camDir.x * 1.5;
    const z = this.player.position.z + this.camDir.z * 1.5;
    mesh.position.set(x, this.model.heightAt(x, z) + 0.2, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.lures.push({ mesh, ttl: LURE_SECONDS });
    showToast(`Köder ausgelegt (${LURE_SECONDS} s)`);
    audio.blip();
  }

  private updateLures(dt: number): void {
    for (let i = this.lures.length - 1; i >= 0; i--) {
      const l = this.lures[i]!;
      l.ttl -= dt;
      if (l.ttl <= 0) {
        this.scene.remove(l.mesh);
        this.lures.splice(i, 1);
      }
    }
    this.lurePositions.length = 0;
    for (const l of this.lures) this.lurePositions.push(l.mesh.position);
    this.creatures.setLures(this.lurePositions);
  }

  // ---------------------------------------------------------------------------
  // Überleben
  private survivalTick(dt: number): void {
    const p = this.player.position;
    const s = this.model.sample(p.x, p.z);
    const biome = this.planet.biomes[s.biome]!;
    const tempC = kelvinToCelsius(pointTemperature(this.planet, biome, s.altitude, this.cycle.daylight));
    const near = this.base.nearest(p, RECHARGE_RADIUS, ['shelter', 'charger']);
    const sv = this.state.survival;
    const events = sv.update({
      dt,
      breathable: this.planet.atmosphere.breathable,
      underwater: this.model.hasWater && this.camera.position.y < this.model.seaLevel,
      sprinting: this.player.speed > 7,
      temperatureC: tempC,
      radiation: this.planet.hazards.includes('radiation'),
      recharging: near !== null,
    });
    for (const ev of events) {
      switch (ev) {
        case 'oxygen_low':
          showToast(STR.survival.oxygenLow);
          audio.hint();
          break;
        case 'energy_low':
          showToast(STR.survival.energyLow);
          audio.hint();
          break;
        case 'oxygen_critical':
          if (this.state.inventory.removeItem('oxygen_cell')) {
            sv.useOxygenCell();
            showToast(`${STR.survival.cellUsed}: ${STR.inventory.items} – Sauerstoffzelle`);
          } else showToast(STR.survival.oxygenCritical, 4000);
          audio.hint();
          break;
        case 'energy_critical':
          if (this.state.inventory.removeItem('energy_cell')) {
            sv.useEnergyCell();
            showToast(`${STR.survival.cellUsed}: Energiezelle`);
          } else showToast(STR.survival.energyCritical, 4000);
          audio.hint();
          break;
        case 'collapse':
          this.startCollapse();
          break;
        case 'recovered':
          break;
      }
    }
    // Überlebenswerte ändern sich laufend → regelmäßig (gedrosselt) sichern
    this.playerDirty = true;
  }

  private startCollapse(): void {
    if (this.collapsing) return;
    this.collapsing = true;
    this.collapseTimer = 0;
    this.respawned = false;
    this.exitPhoto();
    this.exitBuild();
    this.harvestTarget = null;
    this.hud.setHarvest(null);
    this.player.frozen = true;
    showToast(STR.survival.collapse, 6000);
  }

  private updateCollapse(dt: number): void {
    if (!this.collapsing) return;
    this.collapseTimer += dt;
    const t = this.collapseTimer;
    this.hud.setFade(t < 1.2 ? t / 1.2 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 1.2));
    if (t >= 1.2 && !this.respawned) {
      this.respawned = true;
      this.doRespawn();
    }
    if (t >= 2.8) {
      this.collapsing = false;
      this.player.frozen = false;
      this.hud.setFade(0);
    }
  }

  private doRespawn(): void {
    const r = this.state.respawn[this.planet.id];
    let x: number;
    let z: number;
    if (r) {
      x = r.x + 3;
      z = r.z + 3;
    } else {
      const s = this.model.findSpawn();
      x = s.x;
      z = s.z;
    }
    const y = Math.max(this.model.heightAt(x, z), this.model.hasWater ? this.model.seaLevel : -Infinity) + 0.3;
    this.player.spawn(x, y, z, this.player.yaw);
    this.player.applyCamera(1);
    this.terrain.update(this.camera.position, 1);
    this.terrain.buildAllNow(this.camera.position, 120);
    const lost = this.state.inventory.loseFraction(0.1);
    this.state.survival.respawn();
    this.state.touch();
    const lostText = Object.entries(lost).map(([id, n]) => `${n} ${RESOURCES[id as ResourceId].name}`).join(', ');
    this.progress.addLog('info', `Zusammenbruch – Rückkehr ${r ? 'zur Unterkunft' : 'zum Landeplatz'}${lostText ? `, verloren: ${lostText}` : ''}`, this.elapsed, undefined, this.planet.id);
  }

  private promptText(): string {
    if (this.buildMode) return this.buildPos.valid ? '' : `${STR.build.invalid}: ${this.buildPos.reason}`;
    return [this.harvest.label, this.interaction.label].filter(Boolean).join('   ·   ');
  }

  private doInteract(): void {
    const it = this.interaction;
    audio.unlock();
    switch (it.kind) {
      case 'prop': {
        const prop = it.prop as WorldProp;
        const e = prop.entry;
        if (e.category === 'fossil') {
          const r = this.progress.discoverByAnalysis(e.id, 0.4, this.elapsed);
          showToast(`${STR.interact.scanned}: ${this.progress.displayName(e)} ${'★'.repeat(r.stars)} – Foto für bessere Bewertung`, 3500);
          audio.success(r.stars);
        } else {
          if (this.sampledProps.has(prop.id)) {
            showToast(STR.interact.sampled);
            return;
          }
          this.sampledProps.add(prop.id);
          const biome = this.model.biomeAt(prop.center.x, prop.center.z);
          this.progress.addSample(createSample('rock', this.planet, biome, this.elapsed, ++this.sampleCounter, e));
          showToast(`${STR.interact.taken}: ${e.category === 'ore' ? 'Erz' : 'Gestein'} – im Archiv (Tab) analysieren`, 3500);
          audio.blip();
        }
        break;
      }
      case 'water':
      case 'plant':
      case 'soil': {
        const source = it.kind === 'water' ? 'water' : it.kind === 'plant' ? 'plant' : 'soil';
        const biome = it.biome as Biome;
        this.progress.addSample(createSample(source, this.planet, biome, this.elapsed, ++this.sampleCounter, it.species?.entry));
        showToast(`${STR.interact.taken}: ${it.label.replace(/^F: /, '')} – im Archiv (Tab) unter „Proben“ analysieren`, 3500);
        audio.blip();
        break;
      }
      case 'none':
        break;
    }
  }

  // ---------------------------------------------------------------------------
  private pause(): void {
    if (this.paused) return;
    this.exitPhoto();
    this.exitBuild();
    this.harvestTarget = null;
    this.hud.setHarvest(null);
    this.paused = true;
    this.pauseMenu.show();
    this.hud.setCrosshair(false);
    this.saveSurface();
    void this.saveProgress();
    this.ctx.input.exitPointerLock();
    this.ctx.input.reset();
  }

  private resume(): void {
    this.paused = false;
    this.pauseMenu.hide();
    this.ctx.input.requestPointerLock();
  }

  private saveSurface(): void {
    const p = this.player;
    gameState.surface = { planetId: this.planet.id, x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw, pitch: p.pitch, dayT: this.cycle.t, totalDays: this.cycle.totalDays };
  }

  private async saveProgress(): Promise<void> {
    if (!this.progress) return;
    this.dirty = false;
    await this.db.saveProgress(this.progress.toJSON());
    if (this.state) {
      this.playerDirty = false;
      await this.db.setValue(`player:${this.system.seed}`, this.state.toJSON());
    }
  }

  private leave(next: GameScene): void {
    this.switching = true;
    this.saveSurface();
    void this.saveProgress();
    this.ctx.input.exitPointerLock();
    this.ctx.scenes.switchTo(next);
  }

  exit(): void {
    this.ctx.input.exitPointerLock();
  }

  update(dt: number): void {
    if (!this.ready || this.switching) return;
    const input = this.ctx.input;

    if (input.wasPressed('pause') && performance.now() - this.lockChangedAt > 400) {
      if (this.inventoryUi.isOpen) this.closeInventory();
      else if (this.labUi.isOpen) this.closeLab();
      else if (this.archiveUi.isOpen) this.closeCatalog();
      else if (this.buildMode) this.exitBuild();
      else if (this.photo.active) this.exitPhoto();
      else if (this.paused) this.resume();
      else this.pause();
    }
    if (this.paused) return;
    if (input.wasPressed('catalog') && !this.inventoryUi.isOpen && !this.labUi.isOpen) {
      if (this.archiveUi.isOpen) this.closeCatalog();
      else this.openCatalog();
    }
    if (input.wasPressed('inventory') && !this.archiveUi.isOpen && !this.labUi.isOpen && !this.buildMode) {
      if (this.inventoryUi.isOpen) this.closeInventory();
      else this.openInventory('hand');
    }
    if (this.uiOpen) {
      this.saveTick(dt);
      return;
    }
    if (input.wasPressed('camera') && !this.collapsing) {
      if (this.photo.active) this.exitPhoto();
      else {
        this.exitBuild();
        this.enterPhoto();
      }
    }
    if (this.photo.active) this.updatePhotoInput();
    else if (this.buildMode) this.updateBuildInput();
    else if (!this.collapsing) {
      if (input.wasPressed('toggle_view')) this.player.thirdPerson = !this.player.thirdPerson;
      if (input.wasPressed('fly')) {
        this.player.fly = !this.player.fly;
        showToast(this.player.fly ? 'Flugmodus an (Debug)' : 'Flugmodus aus');
      }
      if (input.wasPressed('debug_weather')) showToast(`Wetter: ${WEATHER[this.weather.cycle()].name}`);
      if (input.wasPressed('build')) this.enterBuild();
      else {
        if (input.wasPressed('sample')) this.doInteract();
        this.updateHarvest(dt);
      }
    }
    this.cycle.timeScale = input.isDown('debug_time') && !this.photo.active ? 60 : 1;

    const slow = this.photo.active ? PHOTO_SLOWMO : 1;
    this.cycle.advance(dt * slow);
    this.weather.update(dt * this.cycle.timeScale * slow);
    this.player.update(dt, input.pointerLocked);
    this.elapsed += dt;
    this.terrain.update(this.camera.position, dt);
    this.vegetation.update(this.camera.position, dt, this.elapsed, this.weather.params.wind);
    this.props.update(this.camera.position, dt);
    const pl = this.player;
    const noise = pl.fly ? 0.25 : pl.swimming ? 0.4 : pl.speed > 7 ? 1 : pl.speed > 0.8 ? (pl.crouching ? 0.15 : 0.5) : pl.crouching ? 0.04 : 0.08;
    this.updateLures(dt * slow);
    this.creatures.update(dt * slow, { pos: pl.position, yaw: pl.yaw, noise }, this.creatureEnv());
    this.nodes.update(this.camera.position, dt);
    if (!this.collapsing) this.survivalTick(dt * slow);
    this.updateCollapse(dt);
    if (!this.photo.active) {
      const here = this.model.biomeAt(pl.position.x, pl.position.z);
      this.hints.update(dt, pl.position, here.id, here.name);
      for (const ev of this.hints.drainEvents()) {
        showToast(`◆ ${ev.text}`, 6000);
        audio.hint();
      }
    }
    this.saveTick(dt);

    this.hudAccum += dt;
    if (this.hudAccum >= 0.2) {
      this.hudAccum = 0;
      this.refreshHud();
    }
  }

  private saveTick(dt: number): void {
    this.saveTimer += dt;
    this.playerSaveTimer += dt;
    if ((this.dirty && this.saveTimer > 3) || (this.playerDirty && this.playerSaveTimer > 10)) {
      this.saveTimer = 0;
      this.playerSaveTimer = 0;
      void this.saveProgress();
    }
  }

  private refreshHud(): void {
    const p = this.player.position;
    const s = this.model.sample(p.x, p.z);
    const biome = this.planet.biomes[s.biome]!;
    const temp = pointTemperature(this.planet, biome, s.altitude, this.cycle.daylight);
    this.refreshSkyPhenomena();
    this.hud.update({
      planet: this.planet.name,
      biome: biome.name,
      clock: this.cycle.clock,
      timeOfDay: TIME_LABELS[this.cycle.timeOfDay],
      weather: this.weather.label,
      temperatureC: kelvinToCelsius(temp),
      altitude: p.y,
      x: p.x,
      z: p.z,
      swimming: this.player.swimming,
      nearEdge: this.player.nearWorldEdge,
      fly: this.player.fly,
      timeScale: this.cycle.timeScale,
      ...(this.skyActive.length ? { phenomena: `${STR.interact.phenomenon}: ${this.skyActive.map((e) => (this.progress.isDiscovered(e.id) ? this.progress.displayName(e) : e.name)).join(', ')}` } : {}),
    });
    this.camera.getWorldDirection(this.camDir);
    const seen = this.creatures.nearestInView(this.camera.position, this.camDir, 60, 0.93);
    if (seen) {
      const c = seen.creature;
      const known = this.progress.isDiscovered(c.entry.id);
      const beh = c.ai.behavior && c.ai.state !== 'flee' ? (BEHAVIOR_LABELS[c.ai.behavior] ?? c.ai.behavior) : STATE_LABELS[c.ai.state];
      this.hud.setSighting(`Sichtung: ${known ? this.progress.displayName(c.entry) : `${STR.archive.unknown}`}${known || this.progress.isHinted(c.entry.id) ? ` · ${RARITY_LABELS[c.entry.rarity]}` : ''} · ${beh} · ${seen.distance.toFixed(0)} m`);
    } else this.hud.setSighting('');
    if (!this.photo.active && !this.collapsing) {
      if (!this.buildMode) {
        this.interaction = this.computeInteraction();
        if (!this.harvestTarget) this.harvest = this.computeHarvest();
      }
      this.hud.setPrompt(this.ctx.input.pointerLocked ? this.promptText() : '');
    } else this.hud.setPrompt('');
    const sv = this.state.survival;
    const near = this.base.nearest(p, RECHARGE_RADIUS, ['shelter', 'charger']);
    const parts = [...sv.hazards];
    if (near) parts.push(STR.survival.recharging);
    this.hud.setSurvival(sv.oxygen, sv.energy, parts.join(' · '), sv.oxygen <= 25 || sv.energy <= 25);
    const d = this.ctx.debug;
    d.set('Chunks', `${this.terrain.stats.chunks} (offen ${this.terrain.stats.pending})`);
    d.set('Vegetation', `${this.vegetation.stats.cells} Zellen · ${this.vegetation.stats.instances} Instanzen · ${this.vegetation.stats.species} Arten`);
    d.set('Kreaturen', `${this.creatures.stats.count} (${this.creatures.stats.templates} Arten, ${this.creatures.stats.spawned} gespawnt)`);
    d.set('Props', `${this.props.stats.props} · Hinweise ${this.hints.stats.active}`);
    const c = this.progress.completion();
    d.set('Archiv', `${c.discovered}/${c.total} (${(c.fraction * 100).toFixed(1)} %) · Fotos ${this.progress.photosTaken}`);
    d.set('Basis', `${this.state.modulesOn(this.planet.id).length} Module · Knoten ${this.nodes.stats.nodes} · O₂ ${sv.oxygen.toFixed(0)} · ⚡ ${sv.energy.toFixed(0)} · Treibstoff ${this.state.inventory.getItem('fuel')}`);
  }

  render(_alpha: number, frameDt: number): void {
    if (!this.ready) return;
    this.player.applyCamera(this.paused ? 1 : _alpha);
    const params = this.weather.params;
    const slow = this.photo.active ? PHOTO_SLOWMO : 1;
    this.sky.update(this.cycle, params, this.weather.lightningFlash, this.camera, this.paused ? 0 : frameDt * slow, this.player.position);
    const underwater = this.model.hasWater && this.camera.position.y < this.model.seaLevel;
    if (underwater) {
      this.fog.color.copy(this.waterFog).multiplyScalar(0.25 + 0.75 * this.cycle.daylight);
      this.fog.density = 0.035;
    } else {
      this.fog.color.copy(this.sky.fogColor);
      this.fog.density = this.baseFog * params.fog;
    }
    this.ctx.renderer.gl.setClearColor(this.fog.color, 1);
    this.water?.update(this.elapsed, this.camera.position, this.cycle.sunDir, this.sky.sun.color, this.sky.zenithColor, this.cycle.daylight);
    this.precipitation.setKind(params.precipitation, params.precipIntensity, params.wind);
    if (!this.paused) this.precipitation.update(frameDt * slow, this.camera.position);
    this.composer.render(frameDt);
    if (this.captureRequested) {
      this.captureRequested = false;
      this.capture();
    }
    if (this.photo.active) {
      this.previewAccum += frameDt;
      if (this.previewAccum > 0.2) {
        this.previewAccum = 0;
        const items = this.photo.preview(this.previewBuf);
        this.photoUi.setTargets(items.map((i) => ({ x: i.ndcX, y: i.ndcY + i.frameFill * 0.6, label: this.progress.isDiscovered(i.entry.id) ? this.progress.displayName(i.entry) : '?', known: this.progress.isDiscovered(i.entry.id) })));
        this.photoUi.setSettings(this.photo.settings, this.photo.focusRange, items.length);
      }
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(width, height);
  }

  dispose(): void {
    this.ready = false;
    void this.saveProgress();
    this.disposer.dispose();
    this.photo?.dispose();
    this.composer?.dispose();
    for (const l of this.lures) this.scene.remove(l.mesh);
    this.lures.length = 0;
    this.lureGeometry.dispose();
    this.lureMaterial.dispose();
    this.base?.dispose();
    this.nodes?.dispose();
    this.hints?.dispose();
    this.props?.dispose();
    this.creatures?.dispose();
    this.vegetation?.dispose();
    this.flora?.dispose();
    this.assets?.dispose();
    this.water?.dispose();
    this.precipitation?.dispose();
    this.player?.dispose();
    this.sky?.dispose();
    this.scene.clear();
    const gl = this.ctx.renderer.gl;
    gl.shadowMap.enabled = false;
    gl.setClearColor(0x05070d, 1);
    for (const k of ['Chunks', 'Vegetation', 'Spieler', 'Kreaturen', 'Props', 'Archiv', 'Basis']) this.ctx.debug.set(k, '');
  }
}
