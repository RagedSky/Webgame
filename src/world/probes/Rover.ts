import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight, Raycaster, SphereGeometry, Vector3, type BufferGeometry, type Scene } from 'three';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import { clamp, lerp } from '@/math/utils';

export const ROVER_RANGE = 900;
export const ROVER_REVEAL = 180;
const MAX_SPEED = 9;
const REVERSE_SPEED = 4;
const TURN_RATE = 1.7;

/**
 * Ferngesteuerter Rover: Kasten mit sechs Rädern und Kameramast, folgt dem Terrain (Nick/Roll aus dem Gefälle),
 * stoppt am Wasser und an der Weltgrenze. Keine Allokationen in `drive()`.
 */
export class Rover {
  readonly group = new Group();
  readonly position = new Vector3();
  yaw: number;
  speed = 0;
  private readonly wheels: Mesh[] = [];
  private readonly geos: BufferGeometry[] = [];
  private readonly body = new MeshStandardMaterial({ color: 0x9fb3c8, roughness: 0.5, metalness: 0.5 });
  private readonly dark = new MeshStandardMaterial({ color: 0x23272e, roughness: 0.9 });
  private readonly accent = new MeshStandardMaterial({ color: 0xff9f40, emissive: 0xff7a1a, emissiveIntensity: 0.6, roughness: 0.4 });
  private readonly light = new PointLight(0xffc080, 6, 18, 1.8);
  private readonly raycaster = new Raycaster();
  private readonly forward = new Vector3();
  private readonly tmp = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly model: TerrainModel,
    x: number,
    z: number,
    yaw: number,
  ) {
    this.yaw = yaw;
    const geo = (g: BufferGeometry): BufferGeometry => {
      this.geos.push(g);
      return g;
    };
    const body = new Mesh(geo(new BoxGeometry(1.6, 0.5, 2.3)), this.body);
    body.position.y = 0.62;
    body.castShadow = true;
    const cabin = new Mesh(geo(new BoxGeometry(1.1, 0.4, 1.0)), this.dark);
    cabin.position.set(0, 1.05, -0.2);
    const mast = new Mesh(geo(new CylinderGeometry(0.05, 0.05, 1.0, 6)), this.dark);
    mast.position.set(0.4, 1.7, 0.6);
    const cam = new Mesh(geo(new BoxGeometry(0.3, 0.2, 0.3)), this.accent);
    cam.position.set(0.4, 2.25, 0.6);
    const dish = new Mesh(geo(new SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), this.body);
    dish.position.set(-0.45, 1.3, -0.5);
    dish.rotation.x = -0.7;
    this.light.position.set(0.4, 2.3, 0.9);
    this.group.add(body, cabin, mast, cam, dish, this.light);
    const wheelGeo = geo(new CylinderGeometry(0.32, 0.32, 0.26, 12));
    for (const [wx, wz] of [[-0.9, -0.8], [0.9, -0.8], [-0.9, 0], [0.9, 0], [-0.9, 0.8], [0.9, 0.8]] as Array<[number, number]>) {
      const w = new Mesh(wheelGeo, this.dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.32, wz);
      w.castShadow = true;
      this.wheels.push(w);
      this.group.add(w);
    }
    this.group.traverse((o) => {
      o.userData.rover = true;
    });
    this.place(x, z);
    scene.add(this.group);
  }

  place(x: number, z: number): void {
    this.position.set(x, this.model.heightAt(x, z), z);
    this.speed = 0;
    this.applyPose();
  }

  /** Fahrphysik: Gas −1..1, Lenkung −1..1. Liefert true, wenn eine Bewegung blockiert wurde. */
  drive(dt: number, throttle: number, steer: number): boolean {
    const target = throttle > 0 ? MAX_SPEED * throttle : REVERSE_SPEED * throttle;
    this.speed = lerp(this.speed, target, 1 - Math.exp(-3.5 * dt));
    if (Math.abs(this.speed) > 0.3) this.yaw -= steer * TURN_RATE * dt * Math.sign(this.speed) * Math.min(1, Math.abs(this.speed) / 3);
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const step = this.speed * dt;
    const nx = this.position.x + this.forward.x * step;
    const nz = this.position.z + this.forward.z * step;
    const half = this.model.size / 2 - 12;
    let blocked = false;
    if (Math.abs(nx) > half || Math.abs(nz) > half) blocked = true;
    const h = this.model.heightAt(nx, nz);
    if (!blocked && this.model.hasWater && h < this.model.seaLevel - 0.5) blocked = true;
    if (!blocked && Math.abs(step) > 1e-4) {
      const grade = (h - this.position.y) / Math.abs(step);
      if (grade > 1.3) blocked = true;
      else if (grade > 0.7) this.speed *= 1 - 0.6 * dt;
    }
    if (blocked) this.speed = 0;
    else this.position.set(nx, h, nz);
    this.applyPose();
    return blocked;
  }

  private applyPose(): void {
    const e = 1.2;
    const fwdH = this.model.heightAt(this.position.x + this.forward.x * e, this.position.z + this.forward.z * e) - this.model.heightAt(this.position.x - this.forward.x * e, this.position.z - this.forward.z * e);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const sideH = this.model.heightAt(this.position.x + rx * e, this.position.z + rz * e) - this.model.heightAt(this.position.x - rx * e, this.position.z - rz * e);
    this.group.position.copy(this.position);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.set(clamp(-Math.atan2(fwdH, 2 * e), -0.6, 0.6), this.yaw, clamp(Math.atan2(sideH, 2 * e), -0.6, 0.6));
  }

  update(dt: number): void {
    const spin = (this.speed * dt) / 0.32;
    for (const w of this.wheels) w.rotation.x += spin;
  }

  /** Blickrichtung des Rovers (flach), für Kamera und Interaktion. */
  forwardDir(out: Vector3): Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /** Augpunkt der Rover-Kamera (Mast). */
  eye(out: Vector3): Vector3 {
    return out.set(this.position.x, this.position.y + 2.3, this.position.z);
  }

  pick(origin: Vector3, dir: Vector3, maxDist: number): number {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObject(this.group, true);
    if (hits.length) return hits[0]!.distance;
    this.tmp.set(this.position.x - origin.x, this.position.y + 0.9 - origin.y, this.position.z - origin.z);
    const d = this.tmp.length();
    if (d > maxDist + 1.5) return -1;
    return this.tmp.divideScalar(d).dot(dir) >= Math.cos(Math.min(0.6, Math.atan2(1.4, d))) ? d : -1;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    this.body.dispose();
    this.dark.dispose();
    this.accent.dispose();
    this.light.dispose();
    this.scene.remove(this.group);
  }
}
