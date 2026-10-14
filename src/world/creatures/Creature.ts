import { Bone, Group, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { Random } from '@/math/Random';
import { clamp, clamp01, lerp } from '@/math/utils';
import type { ArchiveEntry, FaunaGenome, TimeOfDay } from '@/gen/archive/types';
import type { FaunaFamilyTraits, Family } from '@/gen/archive/types';
import { CreatureAI } from './CreatureAI';
import { maxSpeedFor, type BoneDef, type CreatureTemplate } from './CreatureBuilder';

export interface CreatureWorld {
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number, eps?: number): number;
  seaLevel: number;
  hasWater: boolean;
  halfWorld: number;
  playerPos: Vector3;
  playerYaw: number;
  /** 0 (still) … 1 (sprintend). */
  playerNoise: number;
  timeOfDay: Exclude<TimeOfDay, 'any'>;
  daylight: number;
  /** Aktive Köder (Positionen). */
  lures: Vector3[];
}

const tmp = new Vector3();

/**
 * Eine Kreatur in der Welt: geskinntes Mesh mit eigenem Skelett, Verhaltens-FSM, prozedurale Animation
 * (Gang, Flügelschlag, Flossen, Schlängeln, Schlafen, Fressen) und Bewegung je Fortbewegungsart.
 */
export class Creature {
  readonly root = new Group();
  readonly mesh: SkinnedMesh;
  readonly bones: Bone[] = [];
  readonly ai: CreatureAI;
  readonly home = new Vector3();
  readonly genome: FaunaGenome;
  yaw: number;
  speed = 0;
  age = 0;
  private phase = 0;
  private y = 0;
  private vy = 0;
  private readonly maxSpeed: number;
  private readonly gaitFreq: number;
  private readonly hover: number;
  private readonly defs: BoneDef[];
  private readonly rng: Random;

  constructor(
    readonly entry: ArchiveEntry,
    readonly template: CreatureTemplate,
    family: Family | undefined,
    seed: string,
    spawn: Vector3,
    yaw: number,
  ) {
    this.genome = entry.genome as FaunaGenome;
    this.rng = new Random(seed);
    this.defs = template.bones;
    for (const def of template.bones) {
      const b = new Bone();
      b.name = def.name;
      b.position.set(def.x, def.y, def.z);
      this.bones.push(b);
      if (def.parent >= 0) (this.bones[def.parent] as Bone).add(b);
    }
    this.mesh = new SkinnedMesh(template.geometry, template.material);
    this.mesh.add(this.bones[0] as Bone);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.root.add(this.mesh);
    this.root.updateMatrixWorld(true);
    this.mesh.bind(new Skeleton(this.bones));
    this.root.position.copy(spawn);
    this.home.copy(spawn);
    this.yaw = yaw;
    this.y = spawn.y;
    this.maxSpeed = maxSpeedFor(this.genome);
    const legs = template.legLength;
    this.gaitFreq = Math.PI * 2 * (legs > 0 ? clamp(2.4 / Math.sqrt(legs * 4 + 0.15), 1.2, 9) : 2.5);
    this.hover = 7 + template.lengthM * 1.5 + this.genome.speed * 14;
    const traits = family?.traits.kind === 'fauna' ? (family.traits as FaunaFamilyTraits) : null;
    this.ai = new CreatureAI(
      {
        temperament: traits?.temperament ?? (this.genome.shyness > 0.6 ? 'shy' : 'neutral'),
        shyness: this.genome.shyness,
        activity: traits?.activity ?? 'cathemeral',
        locomotion: this.genome.locomotion,
        diet: traits?.diet ?? 'omnivore',
        behaviors: entry.behaviors,
      },
      () => this.rng.next(),
      yaw,
    );
  }

  get position(): Vector3 {
    return this.root.position;
  }

  /** Bewegungsanteil 0..1 (für Bewegungsunschärfe in der Fotobewertung). */
  get motion(): number {
    return Math.min(1, this.speed / this.maxSpeed);
  }

  /** Mittelpunkt des Körpers in Weltkoordinaten (für Sicht- und Fotoprüfungen). */
  bodyCenter(out: Vector3): Vector3 {
    return out.copy(this.root.position).setY(this.root.position.y + this.template.bodyY);
  }

  update(dt: number, world: CreatureWorld): void {
    this.age += dt;
    const pos = this.root.position;
    // Eingaben für die FSM
    tmp.subVectors(world.playerPos, pos);
    const dist = Math.hypot(tmp.x, tmp.z);
    const angleToPlayer = Math.atan2(-tmp.x, -tmp.z);
    // Spieler schaut auf die Kreatur, wenn seine Blickrichtung (−sin yaw, −cos yaw) zur Kreatur zeigt
    const fx = -Math.sin(world.playerYaw);
    const fz = -Math.cos(world.playerYaw);
    const facing = dist > 0.01 && (-tmp.x * fx - tmp.z * fz) / dist > 0.85;
    tmp.subVectors(this.home, pos);
    let lureAngle: number | undefined;
    let lureDist: number | undefined;
    if (this.genome.locomotion !== 'water') {
      for (const l of world.lures) {
        const d = Math.hypot(l.x - pos.x, l.z - pos.z);
        if (d < 40 && (lureDist === undefined || d < lureDist)) {
          lureDist = d;
          lureAngle = Math.atan2(-(l.x - pos.x), -(l.z - pos.z));
        }
      }
    }
    this.ai.update({
      ...(lureAngle !== undefined ? { lureAngle, lureDist } : {}),
      dt,
      distToPlayer: dist,
      angleToPlayer,
      playerNoise: world.playerNoise,
      playerFacing: facing,
      timeOfDay: world.timeOfDay,
      angleToHome: Math.atan2(-tmp.x, -tmp.z),
      distToHome: Math.hypot(tmp.x, tmp.z),
    });

    // Drehen und beschleunigen
    const targetSpeed = this.ai.targetSpeed * this.maxSpeed;
    this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-3 * dt));
    let dYaw = ((this.ai.heading - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const turnRate = 1.6 + (this.speed / this.maxSpeed) * 2.2;
    this.yaw += clamp(dYaw, -turnRate * dt, turnRate * dt);

    // Bewegung
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const nx = pos.x + fwdX * this.speed * dt;
    const nz = pos.z + fwdZ * this.speed * dt;
    const groundNext = world.heightAt(nx, nz);
    const loco = this.genome.locomotion;
    const waterNext = world.hasWater && groundNext < world.seaLevel - 0.3;
    let blocked = false;
    if (loco === 'land' && (waterNext || world.slopeAt(nx, nz, 1) > 0.85)) blocked = true;
    if (loco === 'water' && (!world.hasWater || groundNext > world.seaLevel - 1.2)) blocked = true;
    if (Math.abs(nx) > world.halfWorld || Math.abs(nz) > world.halfWorld) blocked = true;
    if (blocked) {
      this.ai.heading += Math.PI * 0.6 + this.rng.float(0, 0.8);
      this.speed *= 0.5;
    } else {
      pos.x = nx;
      pos.z = nz;
    }

    const ground = world.heightAt(pos.x, pos.z);
    const anim = this.ai.animation;
    if (loco === 'land') {
      this.y = ground;
    } else if (loco === 'water') {
      const depth = 1.2 + this.template.lengthM * 0.6;
      const target = clamp(world.seaLevel - depth, ground + 0.4, world.seaLevel - 0.4);
      this.y = lerp(this.y, target, 1 - Math.exp(-1.5 * dt));
    } else {
      const floor = Math.max(ground, world.hasWater ? world.seaLevel : ground);
      let target = floor + this.hover;
      if (anim === 'sleep' || anim === 'feed') target = ground + 0.05 * this.template.lengthM;
      if (anim === 'run') target = floor + this.hover * 1.6;
      const prev = this.y;
      this.y = lerp(this.y, target, 1 - Math.exp(-1.2 * dt));
      this.vy = (this.y - prev) / Math.max(dt, 1e-3);
    }
    pos.y = this.y;
    this.root.rotation.y = this.yaw;

    this.animate(dt, anim);
  }

  private animate(dt: number, anim: CreatureAI['animation']): void {
    const speedRatio = clamp01(this.speed / this.maxSpeed);
    const loco = this.genome.locomotion;
    const flying = loco === 'air' && anim !== 'sleep' && anim !== 'feed';
    this.phase += dt * this.gaitFreq * (loco === 'air' ? 0.6 + speedRatio : 0.15 + speedRatio * 1.3);
    const t = this.age;
    const L = this.template.lengthM;
    const sleeping = anim === 'sleep';
    for (let i = 0; i < this.defs.length; i++) {
      const def = this.defs[i] as BoneDef;
      const b = this.bones[i] as Bone;
      switch (def.kind) {
        case 'body': {
          const bob = sleeping ? -this.template.legLength * 0.55 : Math.sin(this.phase * 2) * 0.03 * L * speedRatio;
          b.position.y = def.y + bob + (flying ? Math.sin(t * 2.1) * 0.02 * L : 0);
          b.rotation.x = flying ? clamp(-this.vy * 0.08, -0.5, 0.5) : anim === 'display' ? -0.12 : 0;
          b.rotation.z = anim === 'run' ? Math.sin(this.phase) * 0.04 : 0;
          const breathe = sleeping ? 1 + Math.sin(t * 1.6) * 0.03 : 1;
          b.scale.set(1, breathe, 1);
          break;
        }
        case 'hip': {
          const offset = def.side > 0 ? 0 : Math.PI;
          const pairOffset = this.template.legPairs >= 3 ? def.index * (Math.PI * 2) / 3 : def.index * Math.PI;
          const amp = 0.6 * speedRatio + (anim === 'display' ? 0.1 : 0);
          b.rotation.x = sleeping ? 1.1 : Math.sin(this.phase + offset + pairOffset) * amp;
          break;
        }
        case 'knee': {
          const offset = def.side > 0 ? 0 : Math.PI;
          const pairOffset = this.template.legPairs >= 3 ? def.index * (Math.PI * 2) / 3 : def.index * Math.PI;
          b.rotation.x = sleeping ? -2.0 : Math.max(0, -Math.sin(this.phase + offset + pairOffset)) * 0.9 * speedRatio;
          break;
        }
        case 'neck':
        case 'head': {
          const down = anim === 'feed' ? 0.55 + Math.sin(t * 2.4) * 0.12 : anim === 'sleep' ? 0.5 : anim === 'display' ? -0.25 : Math.sin(t * 0.7 + i) * 0.06;
          b.rotation.x = def.kind === 'neck' ? down * 0.6 : down * 0.7;
          b.rotation.y = anim === 'idle' ? Math.sin(t * 0.5 + i) * 0.2 : 0;
          break;
        }
        case 'tail': {
          const sway = Math.sin(t * (2 + speedRatio * 3) + def.index * 0.9) * (0.22 + speedRatio * 0.3);
          b.rotation.y = sway;
          b.rotation.x = anim === 'display' ? -0.5 : sleeping ? 0.2 : 0;
          break;
        }
        case 'wing': {
          if (flying) {
            const glide = speedRatio > 0.75 && this.vy <= 0.2;
            const flap = glide ? Math.sin(this.phase * 1.2) * 0.12 : Math.sin(this.phase * 2.6 + def.index) * 0.95;
            b.rotation.z = def.side * (flap + 0.1);
            b.rotation.y = 0;
          } else {
            b.rotation.z = def.side * 0.35;
            b.rotation.y = def.side * 1.25;
          }
          break;
        }
        case 'fin': {
          b.rotation.z = def.side * Math.sin(this.phase * 2.2 + def.index) * (0.25 + speedRatio * 0.3);
          break;
        }
        case 'segment': {
          b.rotation.y = Math.sin(this.phase * 1.4 - def.index * 0.9) * (0.12 + speedRatio * 0.35);
          break;
        }
        case 'root':
          break;
      }
    }
  }

  dispose(): void {
    this.mesh.skeleton.dispose();
    this.root.removeFromParent();
  }
}
