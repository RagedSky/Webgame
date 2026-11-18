import type { CollisionWorld } from './Collision';
import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type PerspectiveCamera } from 'three';
import type { Input } from '@/core/Input';
import { clamp, lerp } from '@/math/utils';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet } from '@/gen/universe/types';
import type { CharacterConfig } from '@/game/character/Character';
import { buildCharacter, type BuiltCharacter } from '@/world/character/CharacterBuilder';

const WALK_SPEED = 5.2;
/** Körperradius für die Kollision mit festen Objekten. */
const PLAYER_RADIUS = 0.34;
const SPRINT_SPEED = 9.5;
const CROUCH_SPEED = 2.6;
const SWIM_SPEED = 3.0;
const SWIM_FAST = 4.4;
/** Ab dieser Wassertiefe an den Füßen schwimmt man (mit etwas Spiel, damit der Zustand am Ufer nicht flattert). */
const SWIM_START = 1.12;
const SWIM_STOP = 0.92;
/** So tief liegen die Füße beim Treiben unter der Oberfläche (Kopf bleibt über Wasser). */
const FLOAT_LINE = 1.25;

/** Wasseroberfläche mit Wellen: Höhe an einem Ort, `ground` ist die Geländehöhe dort. */
export interface WaterSurface {
  surfaceAt(x: number, z: number, ground: number): number;
}
const JUMP_SPEED = 5.4;
const FLY_SPEED = 32;

/**
 * Ego-/Schulter-Controller: WASD, Maus (Pointer Lock), Springen, Sprinten, Ducken, Schwimmen,
 * Terrain-Kollision über das Höhenfeld, Planeten-Gravitation. Position wird für die Kamera interpoliert.
 */
export class Player {
  readonly position = new Vector3();
  readonly prevPosition = new Vector3();
  readonly velocity = new Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;
  swimming = false;
  crouching = false;
  /** Waten 0..1: knietief bis brusttief (bremst, Sprinten nicht mehr möglich). */
  wading = 0;
  /** Kopf unter Wasser. */
  submerged = false;
  fly = false;
  thirdPerson = false;
  /** Selfie-Kamera (vor dem Charakter, Blick zurück). */
  selfie = false;
  /** Bewegung gesperrt (Foto-Modus), Umsehen bleibt möglich. */
  frozen = false;
  sensitivity = 0.0022;
  readonly body: Group;
  private readonly gravity: number;
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly wish = new Vector3();
  private readonly camPos = new Vector3();
  private readonly camOffset = new Vector3();
  private readonly halfWorld: number;
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly bodyGeometry: CapsuleGeometry;
  private readonly placeholder: Mesh;
  private built: BuiltCharacter | null = null;
  /** Feste Hindernisse der Welt (von der Szene gesetzt). */
  collision: CollisionWorld | null = null;
  /** Wasserfläche mit Wellen (von der Szene gesetzt; ohne sie gilt der ruhige Meeresspiegel). */
  water: WaterSurface | null = null;

  constructor(
    private readonly model: TerrainModel,
    planet: Planet,
    private readonly input: Input,
    private readonly camera: PerspectiveCamera,
  ) {
    this.gravity = 9.81 * planet.gravity;
    this.halfWorld = model.size / 2 - 40;
    this.bodyGeometry = new CapsuleGeometry(0.32, 1.0, 4, 8);
    this.bodyMaterial = new MeshStandardMaterial({ color: 0xd9b36a, roughness: 0.6 });
    const mesh = new Mesh(this.bodyGeometry, this.bodyMaterial);
    mesh.position.y = 0.85;
    mesh.castShadow = true;
    this.placeholder = mesh;
    this.body = new Group();
    this.body.add(mesh);
    this.body.visible = false;
  }

  get eyeHeight(): number {
    const stand = this.built?.eyeHeight ?? 1.62;
    return this.crouching ? stand * 0.65 : stand;
  }

  /** Prozeduralen Charakter als Körper verwenden (ersetzt die Platzhalter-Kapsel). */
  setCharacter(cfg: CharacterConfig): void {
    this.built?.dispose();
    this.built = buildCharacter(cfg);
    this.placeholder.visible = false;
    this.body.add(this.built.group);
  }

  spawn(x: number, y: number, z: number, yaw = 0): void {
    this.position.set(x, y, z);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = -0.05;
    this.body.position.copy(this.position);
  }

  private look(): void {
    const dx = this.input.mouseDelta.x;
    const dy = this.input.mouseDelta.y;
    this.yaw -= dx * this.sensitivity;
    this.pitch = clamp(this.pitch - dy * this.sensitivity, -1.5, 1.5);
  }

  update(dt: number, lookEnabled: boolean): void {
    this.prevPosition.copy(this.position);
    const input = this.input;
    if (lookEnabled) this.look();

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    this.forward.set(-sinY, 0, -cosY);
    this.right.set(cosY, 0, -sinY);
    const mz = this.frozen ? 0 : input.axis('move_back', 'move_forward');
    const mx = this.frozen ? 0 : input.axis('move_left', 'move_right');
    this.wish.set(0, 0, 0).addScaledVector(this.forward, mz).addScaledVector(this.right, mx);
    if (this.wish.lengthSq() > 1) this.wish.normalize();

    // Wasseroberfläche am Ort des Spielers (mit Wellen) und Tiefe an den Füßen
    const surface = !this.model.hasWater ? -Infinity : this.water ? this.water.surfaceAt(this.position.x, this.position.z, this.model.heightAt(this.position.x, this.position.z)) : this.model.seaLevel;
    const waterDepthAtBody = surface - this.position.y;

    if (this.fly) {
      const speed = input.isDown('sprint') ? FLY_SPEED * 4 : FLY_SPEED;
      const up = (input.isDown('jump') ? 1 : 0) - (input.isDown('crouch') ? 1 : 0);
      this.wish.y = 0;
      const pitchDir = this.wish.clone().multiplyScalar(Math.cos(this.pitch));
      pitchDir.y = mz * Math.sin(this.pitch) + up;
      this.velocity.lerp(pitchDir.multiplyScalar(speed), 1 - Math.exp(-8 * dt));
      this.position.addScaledVector(this.velocity, dt);
      this.grounded = false;
      this.swimming = false;
      this.wading = 0;
      this.submerged = false;
    } else {
      this.swimming = waterDepthAtBody > (this.swimming ? SWIM_STOP : SWIM_START);
      // Waten: ab den Knien bremst das Wasser, ab der Hüfte kann man weder sprinten noch schleichen
      this.wading = this.swimming ? 0 : clamp((waterDepthAtBody - 0.25) / 0.75, 0, 1);
      this.crouching = !this.swimming && this.wading < 0.5 && input.isDown('crouch');
      this.submerged = this.swimming && this.position.y + this.eyeHeight < surface - 0.05;
      const sprint = input.isDown('sprint');
      const landSpeed = this.crouching ? CROUCH_SPEED : sprint && this.wading < 0.55 ? SPRINT_SPEED : WALK_SPEED;
      const targetSpeed = this.swimming ? (sprint ? SWIM_FAST : SWIM_SPEED) : landSpeed * (1 - 0.5 * this.wading);
      const accel = this.swimming ? 3.2 : this.grounded ? 14 * (1 - 0.5 * this.wading) : 2.5;
      const k = 1 - Math.exp(-accel * dt);
      // unter Wasser schwimmt man in Blickrichtung: der waagrechte Anteil schrumpft mit der Neigung
      const level = this.submerged ? Math.max(0.35, Math.cos(this.pitch)) : 1;
      this.velocity.x = lerp(this.velocity.x, this.wish.x * targetSpeed * level, k);
      this.velocity.z = lerp(this.velocity.z, this.wish.z * targetSpeed * level, k);

      if (this.swimming) {
        // Auftrieb als gedämpfte Feder zur Schwimmlinie: der Körper hebt und senkt sich mit den Wellen. In der Tiefe
        // ist der Auftrieb begrenzt, sonst käme man nicht nach unten; Wasserwiderstand bremst jede Bewegung (auch
        // den Sturz ins Wasser).
        let vy = this.velocity.y;
        vy += clamp((surface - FLOAT_LINE - this.position.y) * 9, -30, 4.5) * dt;
        vy -= vy * 4.2 * dt;
        if (!this.frozen) {
          if (input.isDown('jump')) vy += 8 * dt;
          if (input.isDown('crouch')) vy -= 12 * dt;
          // vorwärts schwimmen mit gesenktem Blick taucht ab, unter Wasser folgt man dem Blick auch nach oben
          if (mz !== 0 && (this.submerged || this.pitch < -0.45)) vy += mz * Math.sin(this.pitch) * 14 * dt;
        }
        this.velocity.y = clamp(vy, -9, 4.5);
      } else {
        this.velocity.y -= this.gravity * dt;
        if (this.grounded && !this.frozen && this.wading < 0.7 && input.wasPressed('jump')) {
          this.velocity.y = JUMP_SPEED * (1 - 0.4 * this.wading);
          this.grounded = false;
        }
      }

      // Horizontal mit Hindernisprüfung (Wände/steile Hänge) je Achse
      const stepUp = this.grounded ? 1.1 : 0.4;
      const nx = this.position.x + this.velocity.x * dt;
      const nz = this.position.z + this.velocity.z * dt;
      const groundNow = this.position.y;
      const hx = this.model.heightAt(nx, this.position.z);
      if (hx - groundNow > stepUp && this.model.slopeAt(nx, this.position.z, 1) > 0.75) this.velocity.x = 0;
      else this.position.x = nx;
      const hz = this.model.heightAt(this.position.x, nz);
      if (hz - groundNow > stepUp && this.model.slopeAt(this.position.x, nz, 1) > 0.75) this.velocity.z = 0;
      else this.position.z = nz;

      // Feste Objekte: aus Bäumen, Felsen, Modulen und dem Schiff herausschieben (gleitet an ihnen entlang)
      if (this.collision && !this.frozen) this.collision.resolve(this.position, PLAYER_RADIUS);

      // Vertikal + Boden
      this.position.y += this.velocity.y * dt;
      const ground = this.model.heightAt(this.position.x, this.position.z);
      if (this.position.y <= ground) {
        this.position.y = ground;
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.grounded = this.position.y - ground < 0.05;
      }
    }

    // Weltgrenze
    this.position.x = clamp(this.position.x, -this.halfWorld, this.halfWorld);
    this.position.z = clamp(this.position.z, -this.halfWorld, this.halfWorld);
    this.body.position.copy(this.position);
    this.body.rotation.y = this.yaw;
    this.body.visible = this.thirdPerson || this.selfie;
    if (this.built && this.body.visible) this.built.animate(dt, this.fly || this.swimming ? 0 : this.speed, this.grounded && !this.swimming);
  }

  get nearWorldEdge(): boolean {
    return Math.abs(this.position.x) > this.halfWorld - 60 || Math.abs(this.position.z) > this.halfWorld - 60;
  }

  /** Setzt Kameraposition und -rotation (Position zwischen Simulationsschritten interpoliert). */
  applyCamera(alpha: number): void {
    this.camPos.copy(this.prevPosition).lerp(this.position, clamp(alpha, 0, 1));
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.selfie) {
      // Kamera vor dem Charakter, Blick auf den Kopf (Blickrichtung des Spielers bleibt Richtung Kamera)
      this.camera.rotation.set(-this.pitch * 0.3, this.yaw + Math.PI, 0);
      this.camOffset.set(0, 0, -1).applyEuler(this.camera.rotation).multiplyScalar(-2.4);
      this.camera.position.copy(this.camPos).add(this.camOffset);
      this.camera.position.y += this.eyeHeight + 0.1;
      const ground = this.model.heightAt(this.camera.position.x, this.camera.position.z) + 0.4;
      if (this.camera.position.y < ground) this.camera.position.y = ground;
    } else if (this.thirdPerson) {
      this.camOffset.set(0, 0, 1).applyEuler(this.camera.rotation).multiplyScalar(4.2);
      this.camera.position.copy(this.camPos).add(this.camOffset);
      this.camera.position.y += this.eyeHeight + 0.4;
      // Kamera nicht unter den Boden
      const ground = this.model.heightAt(this.camera.position.x, this.camera.position.z) + 0.5;
      if (this.camera.position.y < ground) this.camera.position.y = ground;
    } else {
      this.camera.position.copy(this.camPos);
      this.camera.position.y += this.eyeHeight;
    }
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  dispose(): void {
    this.built?.dispose();
    this.bodyGeometry.dispose();
    this.bodyMaterial.dispose();
    this.body.removeFromParent();
  }
}
