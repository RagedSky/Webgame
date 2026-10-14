import { Group, PointLight, Raycaster, Vector3, type Scene } from 'three';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { ShipDesign } from '@/game/ship/ShipDesign';
import { buildShip, setFlames, ShipMaterials, type BuiltShip } from './ShipBuilder';

export const SHIP_RECHARGE_RADIUS = 7;
export const LAUNCH_SECONDS = 6;
export const LANDING_SECONDS = 6.5;
export const LANDING_START_HEIGHT = 160;

/**
 * Der Lander auf der Planetenoberfläche: Mesh aus dem Entwurf, Triebwerksflammen und -licht,
 * Start- und Landeanimation (Höhe über dem Landeplatz), Raycast-Auswahl.
 */
export class ShipActor {
  readonly group = new Group();
  readonly position = new Vector3();
  private readonly mats = new ShipMaterials();
  private built: BuiltShip;
  private readonly light = new PointLight(0xffa050, 0, 60, 1.6);
  private readonly raycaster = new Raycaster();
  private throttle = 0;
  /** Zusätzliche Höhe über dem Landeplatz (Animation). */
  lift = 0;

  constructor(
    private readonly scene: Scene,
    private readonly model: TerrainModel,
    design: ShipDesign,
    x: number,
    z: number,
    rot: number,
  ) {
    this.built = buildShip(design, this.mats);
    this.group.add(this.built.group);
    this.light.position.set(0, 0.6, 0);
    this.group.add(this.light);
    this.position.set(x, this.model.heightAt(x, z), z);
    this.group.position.copy(this.position);
    this.group.rotation.y = rot;
    scene.add(this.group);
  }

  get radius(): number {
    return this.built.radius;
  }

  get height(): number {
    return this.built.height;
  }

  setDesign(design: ShipDesign): void {
    this.built.dispose();
    this.built = buildShip(design, this.mats);
    this.group.add(this.built.group);
  }

  setThrottle(t: number): void {
    this.throttle = t;
  }

  update(time: number): void {
    setFlames(this.built, this.throttle, time);
    this.light.intensity = this.throttle * 40;
    this.group.position.set(this.position.x, this.position.y + this.lift, this.position.z);
  }

  /** Startanimation: liefert die Höhe für t ∈ [0, LAUNCH_SECONDS]. */
  launchLift(t: number): number {
    const u = Math.max(0, t);
    return 0.5 * 7 * u * u;
  }

  /** Landeanimation: Höhe für t ∈ [0, LANDING_SECONDS] (sanftes Abbremsen). */
  landingLift(t: number): number {
    const u = Math.max(0, Math.min(1, t / LANDING_SECONDS));
    const e = 1 - Math.pow(1 - u, 3);
    return LANDING_START_HEIGHT * (1 - e);
  }

  /** Trifft der Blick das Schiff (Raycast oder Nähe-Kegel)? Liefert die Distanz oder -1. */
  pick(origin: Vector3, dir: Vector3, maxDist: number): number {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObject(this.built.group, true);
    if (hits.length) return hits[0]!.distance;
    const dx = this.position.x - origin.x;
    const dy = this.position.y + this.built.height * 0.45 - origin.y;
    const dz = this.position.z - origin.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > maxDist + this.built.radius) return -1;
    const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
    return cos >= Math.cos(Math.min(0.7, Math.atan2(this.built.radius, d))) ? d : -1;
  }

  dispose(): void {
    this.built.dispose();
    this.mats.dispose();
    this.light.dispose();
    this.scene.remove(this.group);
  }
}
