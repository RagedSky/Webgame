import { Color, FogExp2, PCFShadowMap, PerspectiveCamera, Scene, Vector3 } from 'three';
import { BloomEffect, EffectPass, type EffectComposer } from 'postprocessing';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Biome, Planet, StarSystem, WeatherType } from '@/gen/universe/types';
import { WEATHER } from '@/gen/universe/catalog';
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

interface Interaction {
  kind: 'none' | 'prop' | 'water' | 'plant' | 'soil';
  label: string;
  prop?: WorldProp;
  species?: SpeciesPlacement;
  biome?: Biome;
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
    if (saved) this.player.spawn(saved.x, saved.y, saved.z, saved.yaw);
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

    // Fortschritt laden
    this.db = await dbPromise;
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
    this.pauseMenu = new PauseMenu(ctx.uiRoot, {
      onResume: () => this.resume(),
      onSystemView: () => this.leave(new SystemViewScene()),
      onMainMenu: () => this.leave(new MainMenuScene()),
    }, [STR.pause.phase4]);
    const canvas = ctx.renderer.canvas;
    this.disposer.listen(canvas, 'click', () => {
      audio.unlock();
      if (!this.paused && !this.archiveUi.isOpen && !ctx.input.pointerLocked) ctx.input.requestPointerLock();
    });
    this.disposer.listen(document, 'pointerlockchange', () => {
      const locked = ctx.input.pointerLocked;
      this.lockChangedAt = performance.now();
      this.hud.setHint(locked ? '' : this.archiveUi.isOpen ? '' : STR.planet.clickToStart);
      this.hud.setCrosshair(locked && !this.photo.active);
      if (!locked && !this.switching && !this.paused && !this.archiveUi.isOpen) this.pause();
    });
    this.disposer.addFn(() => {
      this.hud.dispose();
      this.pauseMenu.dispose();
      this.photoUi.dispose();
      this.archiveUi.dispose();
      this.closeMicroscope();
    });
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
  // Interaktion (E)
  private computeInteraction(): Interaction {
    this.camera.getWorldDirection(this.camDir);
    const hit = this.props.pick(this.camera.position, this.camDir, 4.5);
    if (hit) {
      const e = hit.prop.entry;
      const name = this.progress.isDiscovered(e.id) ? this.progress.displayName(e) : `${STR.archive.unknown} (${e.category === 'fossil' ? (e.subcategory === 'ruin' ? 'Ruine' : 'Fossil') : e.category === 'ore' ? 'Erz' : 'Gestein'})`;
      if (e.category === 'fossil') return { kind: 'prop', label: `E: ${STR.interact.scan} – ${name}`, prop: hit.prop };
      const done = this.sampledProps.has(hit.prop.id);
      return { kind: 'prop', label: `E: ${STR.interact.sample} – ${name}${done ? ` (${STR.interact.sampled})` : ''}`, prop: hit.prop };
    }
    const sea = this.model.seaLevel;
    if (this.model.hasWater && this.camera.position.y > sea && this.camDir.y < -0.05) {
      const dist = (sea - this.camera.position.y) / this.camDir.y;
      if (dist > 0 && dist < 5) {
        const x = this.camera.position.x + this.camDir.x * dist;
        const z = this.camera.position.z + this.camDir.z * dist;
        if (this.model.heightAt(x, z) < sea) return { kind: 'water', label: `E: ${STR.interact.water}`, biome: this.model.biomeAt(x, z) };
      }
    }
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
    if (best) {
      const name = this.progress.isDiscovered(best.entry.id) ? this.progress.displayName(best.entry) : STR.archive.unknown;
      return { kind: 'plant', label: `E: ${STR.interact.plant} – ${name}`, species: best, biome: this.model.biomeAt(best.x, best.z) };
    }
    if (this.player.grounded && !this.player.swimming) {
      const biome = this.model.biomeAt(this.player.position.x, this.player.position.z);
      return { kind: 'soil', label: `E: ${STR.interact.soil} (${biome.name})`, biome };
    }
    return { kind: 'none', label: '' };
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
        showToast(`${STR.interact.taken}: ${it.label.replace(/^E: /, '')} – im Archiv (Tab) unter „Proben“ analysieren`, 3500);
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
      if (this.archiveUi.isOpen) this.closeCatalog();
      else if (this.photo.active) this.exitPhoto();
      else if (this.paused) this.resume();
      else this.pause();
    }
    if (this.paused) return;
    if (input.wasPressed('catalog')) {
      if (this.archiveUi.isOpen) this.closeCatalog();
      else this.openCatalog();
    }
    if (this.archiveUi.isOpen) {
      this.saveTick(dt);
      return;
    }
    if (input.wasPressed('camera')) {
      if (this.photo.active) this.exitPhoto();
      else this.enterPhoto();
    }
    if (this.photo.active) this.updatePhotoInput();
    else {
      if (input.wasPressed('toggle_view')) this.player.thirdPerson = !this.player.thirdPerson;
      if (input.wasPressed('fly')) {
        this.player.fly = !this.player.fly;
        showToast(this.player.fly ? 'Flugmodus an (Debug)' : 'Flugmodus aus');
      }
      if (input.wasPressed('debug_weather')) showToast(`Wetter: ${WEATHER[this.weather.cycle()].name}`);
      if (input.wasPressed('interact')) this.doInteract();
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
    this.creatures.update(dt * slow, { pos: pl.position, yaw: pl.yaw, noise }, this.creatureEnv());
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
    if (this.dirty && this.saveTimer > 3) {
      this.saveTimer = 0;
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
    if (!this.photo.active) {
      this.interaction = this.computeInteraction();
      this.hud.setPrompt(this.ctx.input.pointerLocked ? this.interaction.label : '');
    } else this.hud.setPrompt('');
    const d = this.ctx.debug;
    d.set('Chunks', `${this.terrain.stats.chunks} (offen ${this.terrain.stats.pending})`);
    d.set('Vegetation', `${this.vegetation.stats.cells} Zellen · ${this.vegetation.stats.instances} Instanzen · ${this.vegetation.stats.species} Arten`);
    d.set('Kreaturen', `${this.creatures.stats.count} (${this.creatures.stats.templates} Arten, ${this.creatures.stats.spawned} gespawnt)`);
    d.set('Props', `${this.props.stats.props} · Hinweise ${this.hints.stats.active}`);
    const c = this.progress.completion();
    d.set('Archiv', `${c.discovered}/${c.total} (${(c.fraction * 100).toFixed(1)} %) · Fotos ${this.progress.photosTaken}`);
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
    for (const k of ['Chunks', 'Vegetation', 'Spieler', 'Kreaturen', 'Props', 'Archiv']) this.ctx.debug.set(k, '');
  }
}
