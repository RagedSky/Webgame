import { Group, Vector3, type Scene } from 'three';
import { Random } from '@/math/Random';
import type { TerrainModel, TerrainSample } from '@/gen/terrain/TerrainModel';
import type { Planet, StarSystem, WeatherType } from '@/gen/universe/types';
import type { ArchiveEntry, FaunaGenome, Family, TimeOfDay } from '@/gen/archive/types';
import { matchesSpawn, pointTemperature, spawnWeight, type SpawnContext } from '@/gen/archive/conditions';
import { buildCreatureTemplate, type CreatureTemplate } from './CreatureBuilder';
import { Creature, type CreatureWorld } from './Creature';

export interface CreatureEnv {
  timeOfDay: Exclude<TimeOfDay, 'any'>;
  weather: WeatherType;
  daylight: number;
  afterStorm: boolean;
  solstice: boolean;
  eclipse: boolean;
}

export interface PlayerInfo {
  pos: Vector3;
  yaw: number;
  noise: number;
}

export interface CreatureManagerOptions {
  maxPopulation?: number;
  spawnMin?: number;
  spawnMax?: number;
  despawnRadius?: number;
  spawnInterval?: number;
}

const STORMS: WeatherType[] = ['storm', 'thunderstorm', 'blizzard', 'sandstorm', 'lightning_storm'];
const tmpSample: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };
const tmpA = new Vector3();
const tmpB = new Vector3();

/**
 * Bevölkert die Umgebung des Spielers mit Kreaturen, deren Spawn-Bedingungen (Biom, Zeit, Wetter, Höhe,
 * Temperatur, Spezial) gerade erfüllt sind. Seltenheit steuert die Häufigkeit; Gruppen nach Verhalten.
 * Entfernte Kreaturen werden abgebaut. Vorlagen (Geometrie/Material) werden je Art gecacht.
 */
export class CreatureManager {
  readonly group = new Group();
  readonly creatures: Creature[] = [];
  readonly stats = { count: 0, templates: 0, spawned: 0, attempts: 0 };
  private readonly templates = new Map<string, CreatureTemplate>();
  private readonly families = new Map<string, Family>();
  private readonly byBiome = new Map<string, ArchiveEntry[]>();
  private readonly rng: Random;
  private tick = 0;
  private accum = 0;
  private readonly maxPopulation: number;
  private readonly spawnMin: number;
  private readonly spawnMax: number;
  private readonly despawnRadius: number;
  private readonly spawnInterval: number;
  private readonly world: CreatureWorld;

  constructor(
    scene: Scene,
    system: StarSystem,
    private readonly planet: Planet,
    private readonly model: TerrainModel,
    options: CreatureManagerOptions = {},
  ) {
    this.maxPopulation = options.maxPopulation ?? 26;
    this.spawnMin = options.spawnMin ?? 45;
    this.spawnMax = options.spawnMax ?? 170;
    this.despawnRadius = options.despawnRadius ?? 240;
    this.spawnInterval = options.spawnInterval ?? 1.5;
    this.rng = new Random(`creatures:${system.seed}:${planet.id}`);
    for (const f of system.families) this.families.set(f.id, f);
    for (const e of system.entries) {
      if (e.planetId !== planet.id) continue;
      if ((e.genome as FaunaGenome).kind !== 'fauna') continue;
      for (const b of e.biomeIds) {
        let list = this.byBiome.get(b);
        if (!list) {
          list = [];
          this.byBiome.set(b, list);
        }
        list.push(e);
      }
    }
    this.world = {
      heightAt: (x, z) => model.heightAt(x, z),
      slopeAt: (x, z, eps) => model.slopeAt(x, z, eps),
      seaLevel: model.seaLevel,
      hasWater: model.hasWater,
      halfWorld: model.size / 2 - 30,
      playerPos: new Vector3(),
      playerYaw: 0,
      playerNoise: 0,
      timeOfDay: 'day',
      daylight: 1,
    };
    scene.add(this.group);
  }

  private getTemplate(entry: ArchiveEntry): CreatureTemplate {
    let t = this.templates.get(entry.id);
    if (!t) {
      t = buildCreatureTemplate(entry);
      this.templates.set(entry.id, t);
    }
    return t;
  }

  private countOf(entryId: string): number {
    let n = 0;
    for (const c of this.creatures) if (c.entry.id === entryId) n++;
    return n;
  }

  private trySpawn(player: PlayerInfo, env: CreatureEnv): void {
    this.tick++;
    this.stats.attempts++;
    const rng = this.rng.fork(`t${this.tick}`);
    // Bevorzugt hinter dem Spieler (außerhalb des Blickfelds)
    const behind = rng.bool(0.65);
    const baseAngle = behind ? player.yaw + Math.PI : rng.float(0, Math.PI * 2);
    const angle = baseAngle + (behind ? rng.float(-1.1, 1.1) : 0);
    const dist = rng.float(this.spawnMin, this.spawnMax);
    const x = player.pos.x + -Math.sin(angle) * dist;
    const z = player.pos.z + -Math.cos(angle) * dist;
    if (Math.abs(x) > this.world.halfWorld || Math.abs(z) > this.world.halfWorld) return;
    const s = this.model.sample(x, z, tmpSample);
    const biome = this.planet.biomes[s.blend > 0.5 ? s.biome2 : s.biome]!;
    const underwater = this.model.hasWater && s.height < this.model.seaLevel - 1.5;
    const ctx: SpawnContext = {
      timeOfDay: env.timeOfDay,
      weather: env.weather,
      altitude: s.altitude,
      temperature: pointTemperature(this.planet, biome, s.altitude, env.daylight),
      biomeId: biome.id,
      inCave: biome.isCave,
      underwater,
      deepSea: underwater && biome.kind === 'deep_sea',
      afterStorm: env.afterStorm,
      solstice: env.solstice,
      eclipse: env.eclipse,
    };
    const list = this.byBiome.get(biome.id);
    if (!list) return;
    const candidates: Array<{ item: ArchiveEntry; weight: number }> = [];
    for (const e of list) {
      const g = e.genome as FaunaGenome;
      if (g.locomotion === 'water' && !underwater) continue;
      if (g.locomotion !== 'water' && underwater) continue;
      if (!matchesSpawn(e, ctx)) continue;
      const n = this.countOf(e.id);
      if (n >= 5) continue;
      candidates.push({ item: e, weight: spawnWeight(e) / (1 + n) });
    }
    if (candidates.length === 0) return;
    const entry = rng.weighted(candidates);
    const g = entry.genome as FaunaGenome;
    const schooling = entry.behaviors.includes('schooling') || entry.behaviors.includes('migrating');
    const herd = g.locomotion === 'land' && (entry.behaviors.includes('grazing') || entry.behaviors.includes('playing'));
    const groupSize = schooling ? rng.int(3, 6) : herd ? rng.int(1, 4) : rng.int(1, 2);
    const template = this.getTemplate(entry);
    const family = this.families.get(entry.familyId);
    const spread = 4 + template.lengthM * 2;
    for (let i = 0; i < groupSize && this.creatures.length < this.maxPopulation; i++) {
      const px = x + rng.float(-spread, spread);
      const pz = z + rng.float(-spread, spread);
      const ground = this.model.heightAt(px, pz);
      const py = g.locomotion === 'water' ? Math.max(ground + 0.5, this.model.seaLevel - 2) : g.locomotion === 'air' ? Math.max(ground, this.model.seaLevel) + 8 : ground;
      const c = new Creature(entry, template, family, `${entry.id}:${this.tick}:${i}`, new Vector3(px, py, pz), rng.float(0, Math.PI * 2));
      this.group.add(c.root);
      this.creatures.push(c);
      this.stats.spawned++;
    }
    this.stats.templates = this.templates.size;
  }

  /** Debug/Test: bis zu `count` Spawn-Versuche sofort ausführen; gibt die Zahl neuer Kreaturen zurück. */
  forceSpawn(player: PlayerInfo, env: CreatureEnv, count = 10): number {
    const before = this.creatures.length;
    for (let i = 0; i < count * 4 && this.creatures.length - before < count; i++) this.trySpawn(player, env);
    this.stats.count = this.creatures.length;
    return this.creatures.length - before;
  }

  update(dt: number, player: PlayerInfo, env: CreatureEnv): void {
    const w = this.world;
    w.playerPos.copy(player.pos);
    w.playerYaw = player.yaw;
    w.playerNoise = player.noise;
    w.timeOfDay = env.timeOfDay;
    w.daylight = env.daylight;

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i] as Creature;
      c.update(dt, w);
      const d = Math.hypot(c.position.x - player.pos.x, c.position.z - player.pos.z);
      if (d > this.despawnRadius) {
        c.dispose();
        this.creatures.splice(i, 1);
      }
    }

    this.accum += dt;
    if (this.accum >= this.spawnInterval) {
      this.accum = 0;
      if (this.creatures.length < this.maxPopulation) this.trySpawn(player, env);
    }
    this.stats.count = this.creatures.length;
  }

  /** Nächste Kreatur im Sichtkegel der Kamera. */
  nearestInView(cameraPos: Vector3, cameraDir: Vector3, maxDist: number, cosHalfAngle: number): { creature: Creature; distance: number } | null {
    let best: Creature | null = null;
    let bestDist = Infinity;
    for (const c of this.creatures) {
      c.bodyCenter(tmpA);
      tmpB.subVectors(tmpA, cameraPos);
      const d = tmpB.length();
      if (d > maxDist || d < 0.01) continue;
      tmpB.divideScalar(d);
      if (tmpB.dot(cameraDir) < cosHalfAngle) continue;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best ? { creature: best, distance: bestDist } : null;
  }

  static isStorm(w: WeatherType): boolean {
    return STORMS.includes(w);
  }

  dispose(): void {
    for (const c of this.creatures) c.dispose();
    this.creatures.length = 0;
    for (const t of this.templates.values()) {
      t.geometry.dispose();
      t.material.dispose();
    }
    this.templates.clear();
    this.group.removeFromParent();
  }
}
