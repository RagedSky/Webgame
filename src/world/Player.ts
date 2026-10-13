import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type PerspectiveCamera } from 'three';
import type { Input } from '@/core/Input';
import { clamp, lerp } from '@/math/utils';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet } from '@/gen/universe/types';

const WALK_SPEED = 5.2;
const SPRINT_SPEED = 9.5;
const CROUCH_SPEED = 2.6;
const SWIM_SPEED = 3.2;
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
  fly = false;
  thirdPerson = false;
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
    this.body = new Group();
    this.body.add(mesh);
    this.body.visible = false;
  }

  get eyeHeight(): number {
    return this.crouching ? 1.05 : 1.62;
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
    const mz = input.axis('move_back', 'move_forward');
    const mx = input.axis('move_left', 'move_right');
    this.wish.set(0, 0, 0).addScaledVector(this.forward, mz).addScaledVector(this.right, mx);
    if (this.wish.lengthSq() > 1) this.wish.normalize();

    const sea = this.model.seaLevel;
    const waterDepthAtBody = this.model.hasWater ? sea - this.position.y : -Infinity;

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
    } else {
      this.swimming = waterDepthAtBody > 1.0;
      this.crouching = !this.swimming && input.isDown('crouch');
      const targetSpeed = this.swimming ? SWIM_SPEED : this.crouching ? CROUCH_SPEED : input.isDown('sprint') ? SPRINT_SPEED : WALK_SPEED;
      const accel = this.swimming ? 4 : this.grounded ? 14 : 2.5;
      const k = 1 - Math.exp(-accel * dt);
      this.velocity.x = lerp(this.velocity.x, this.wish.x * targetSpeed, k);
      this.velocity.z = lerp(this.velocity.z, this.wish.z * targetSpeed, k);

      if (this.swimming) {
        // Auftrieb: Kopf bleibt knapp über der Oberfläche; Leertaste/Ducken: auf-/abtauchen
        const target = sea - 1.25;
        let vy = this.velocity.y;
        vy += (target - this.position.y) * 5 * dt - vy * 3 * dt;
        if (input.isDown('jump')) vy += 6 * dt;
        if (input.isDown('crouch')) vy -= 6 * dt;
        this.velocity.y = clamp(vy, -4, 4);
      } else {
        this.velocity.y -= this.gravity * dt;
        if (this.grounded && input.wasPressed('jump')) {
          this.velocity.y = JUMP_SPEED;
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
    this.body.visible = this.thirdPerson;
  }

  get nearWorldEdge(): boolean {
    return Math.abs(this.position.x) > this.halfWorld - 60 || Math.abs(this.position.z) > this.halfWorld - 60;
  }

  /** Setzt Kameraposition und -rotation (Position zwischen Simulationsschritten interpoliert). */
  applyCamera(alpha: number): void {
    this.camPos.copy(this.prevPosition).lerp(this.position, clamp(alpha, 0, 1));
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.thirdPerson) {
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
    this.bodyGeometry.dispose();
    this.bodyMaterial.dispose();
    this.body.removeFromParent();
  }
}
