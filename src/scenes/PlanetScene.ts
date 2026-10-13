import { Color, FogExp2, PCFShadowMap, PerspectiveCamera, Scene } from 'three';
import { BloomEffect, EffectPass, type EffectComposer } from 'postprocessing';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet, StarSystem, WeatherType } from '@/gen/universe/types';
import { WEATHER } from '@/gen/universe/catalog';
import { TIME_LABELS } from '@/gen/archive/types';
import { Vector3 } from 'three';
import { kelvinToCelsius } from '@/math/utils';
import { DayCycle } from '@/world/DayCycle';
import { Sky } from '@/world/Sky';
import { WeatherSystem } from '@/world/Weather';
import { Precipitation } from '@/world/Precipitation';
import { Water } from '@/world/Water';
import { TerrainManager } from '@/world/terrain/TerrainManager';
import { VegetationAssets } from '@/world/VegetationAssets';
import { VegetationManager } from '@/world/Vegetation';
import { FloraAssets } from '@/world/flora/FloraAssets';
import { CreatureManager } from '@/world/creatures/CreatureManager';
import { STATE_LABELS } from '@/world/creatures/CreatureAI';
import { BEHAVIOR_LABELS } from '@/gen/archive/descriptions';
import { RARITY_LABELS } from '@/gen/archive/types';
import { Player } from '@/world/Player';
import { Hud } from '@/ui/Hud';
import { PauseMenu } from '@/ui/PauseMenu';
import { LoadingOverlay } from '@/ui/LoadingOverlay';
import { STR } from '@/ui/strings';
import { showToast } from '@/ui/toast';
import { MainMenuScene } from './MainMenuScene';
import { SystemViewScene } from './SystemViewScene';

const VIEW_DISTANCE = 1700;

/**
 * Planetenoberfläche: Chunk-Terrain mit LOD, Himmel mit Tag/Nacht, Wetter, Wasser, Vegetation (Instancing),
 * Spieler-Controller. Zustand (Position, Tageszeit) wird beim Verlassen in GameState gesichert.
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
  private readonly camDir = new Vector3();
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

    // Terrain in Scheiben aufbauen, damit der Ladebalken sichtbar bleibt
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
    loading.dispose();

    this.hud = new Hud(ctx.uiRoot);
    this.hud.setHint(STR.planet.clickToStart);
    this.pauseMenu = new PauseMenu(ctx.uiRoot, {
      onResume: () => this.resume(),
      onSystemView: () => this.leave(new SystemViewScene()),
      onMainMenu: () => this.leave(new MainMenuScene()),
    });
    const canvas = ctx.renderer.canvas;
    this.disposer.listen(canvas, 'click', () => {
      if (!this.paused && !ctx.input.pointerLocked) ctx.input.requestPointerLock();
    });
    this.disposer.listen(document, 'pointerlockchange', () => {
      const locked = ctx.input.pointerLocked;
      this.lockChangedAt = performance.now();
      this.hud.setHint(locked ? '' : STR.planet.clickToStart);
      this.hud.setCrosshair(locked);
      if (!locked && !this.switching && !this.paused) this.pause();
    });
    this.disposer.addFn(() => {
      this.hud.dispose();
      this.pauseMenu.dispose();
    });
    this.ready = true;
    showToast(`${planet.name} · ${planet.typeLabel}`);
  }

  /** Debug/Test: Tageszeit setzen (0 = Mitternacht, 0,5 = Mittag). */
  setTimeOfDay(t: number): void {
    this.cycle.t = ((t % 1) + 1) % 1;
    this.cycle.advance(0);
  }

  /** Debug/Test: Kreaturen in der Umgebung erzwingen. */
  spawnNearby(count = 8): number {
    const pl = this.player;
    return this.creatures.forceSpawn(
      { pos: pl.position, yaw: pl.yaw, noise: 0 },
      { timeOfDay: this.cycle.timeOfDay, weather: this.weather.activeType, daylight: this.cycle.daylight, afterStorm: this.weather.afterStorm, solstice: false, eclipse: this.sky.eclipse },
      count,
    );
  }

  /** Debug/Test: Wetter sofort erzwingen (Übergang läuft normal an). */
  forceWeather(type: WeatherType, instant = false): void {
    this.weather.force(type);
    if (instant) this.weather.update(1000);
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseMenu.show();
    this.hud.setCrosshair(false);
    this.saveSurface();
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

  private leave(next: GameScene): void {
    this.switching = true;
    this.saveSurface();
    this.ctx.input.exitPointerLock();
    this.ctx.scenes.switchTo(next);
  }

  exit(): void {
    this.ctx.input.exitPointerLock();
  }

  update(dt: number): void {
    if (!this.ready || this.switching) return;
    const input = this.ctx.input;
    // Esc: Browser beendet den Pointer-Lock selbst (→ pointerlockchange → pause); doppeltes Umschalten vermeiden
    if (input.wasPressed('pause') && performance.now() - this.lockChangedAt > 400) {
      if (this.paused) this.resume();
      else this.pause();
    }
    if (this.paused) return;

    if (input.wasPressed('toggle_view')) this.player.thirdPerson = !this.player.thirdPerson;
    if (input.wasPressed('fly')) {
      this.player.fly = !this.player.fly;
      showToast(this.player.fly ? 'Flugmodus an (Debug)' : 'Flugmodus aus');
    }
    if (input.wasPressed('debug_weather')) showToast(`Wetter: ${WEATHER[this.weather.cycle()].name}`);
    this.cycle.timeScale = input.isDown('debug_time') ? 60 : 1;

    const sim = dt * this.cycle.timeScale;
    this.cycle.advance(dt);
    this.weather.update(sim);
    this.player.update(dt, input.pointerLocked);
    this.elapsed += dt;
    this.terrain.update(this.camera.position, dt);
    this.vegetation.update(this.camera.position, dt, this.elapsed, this.weather.params.wind);
    const pl = this.player;
    const noise = pl.fly ? 0.25 : pl.swimming ? 0.4 : pl.speed > 7 ? 1 : pl.speed > 0.8 ? (pl.crouching ? 0.15 : 0.5) : 0.08;
    this.creatures.update(
      dt,
      { pos: pl.position, yaw: pl.yaw, noise },
      {
        timeOfDay: this.cycle.timeOfDay,
        weather: this.weather.activeType,
        daylight: this.cycle.daylight,
        afterStorm: this.weather.afterStorm,
        solstice: false,
        eclipse: this.sky.eclipse,
      },
    );

    this.hudAccum += dt;
    if (this.hudAccum >= 0.2) {
      this.hudAccum = 0;
      const p = this.player.position;
      const s = this.model.sample(p.x, p.z);
      const biome = this.planet.biomes[s.biome]!;
      const temp = this.planet.temperature.mean + biome.temperatureOffset - (this.cycle.daylight < 0.5 ? 8 : 0) - s.altitude * 25;
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
      });
      this.camera.getWorldDirection(this.camDir);
      const seen = this.creatures.nearestInView(this.camera.position, this.camDir, 60, 0.93);
      if (seen) {
        const c = seen.creature;
        const beh = c.ai.behavior && c.ai.state !== 'flee' ? (BEHAVIOR_LABELS[c.ai.behavior] ?? c.ai.behavior) : STATE_LABELS[c.ai.state];
        this.hud.setSighting(`Sichtung: ${c.entry.name} · ${RARITY_LABELS[c.entry.rarity]} · ${beh} · ${seen.distance.toFixed(0)} m`);
      } else this.hud.setSighting('');
      const d = this.ctx.debug;
      d.set('Chunks', `${this.terrain.stats.chunks} (offen ${this.terrain.stats.pending})`);
      d.set('Vegetation', `${this.vegetation.stats.cells} Zellen · ${this.vegetation.stats.instances} Instanzen · ${this.vegetation.stats.species} Arten`);
      d.set('Kreaturen', `${this.creatures.stats.count} (${this.creatures.stats.templates} Arten, ${this.creatures.stats.spawned} gespawnt)`);
      d.set('Spieler', `${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} · ${this.player.grounded ? 'Boden' : this.player.swimming ? 'Wasser' : 'Luft'}`);
    }
  }

  render(_alpha: number, frameDt: number): void {
    if (!this.ready) return;
    this.player.applyCamera(this.paused ? 1 : _alpha);
    const params = this.weather.params;
    this.sky.update(this.cycle, params, this.weather.lightningFlash, this.camera, this.paused ? 0 : frameDt, this.player.position);
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
    if (!this.paused) this.precipitation.update(frameDt, this.camera.position);
    this.composer.render(frameDt);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(width, height);
  }

  dispose(): void {
    this.ready = false;
    this.disposer.dispose();
    this.composer?.dispose();
    this.terrain?.dispose();
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
    this.ctx.debug.set('Chunks', '');
    this.ctx.debug.set('Vegetation', '');
    this.ctx.debug.set('Spieler', '');
    this.ctx.debug.set('Kreaturen', '');
  }
}
