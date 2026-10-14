import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Scene } from 'three';

/** Bojen der Tiefseesonden: Zylinder mit Leuchtkugel, wippen auf dem Wasser. */
export class Buoys {
  readonly group = new Group();
  private readonly geo = new CylinderGeometry(0.35, 0.45, 1.2, 10);
  private readonly lampGeo = new SphereGeometry(0.22, 10, 8);
  private readonly mat = new MeshStandardMaterial({ color: 0xffb347, roughness: 0.6 });
  private readonly lamp = new MeshStandardMaterial({ color: 0x8fe3ff, emissive: 0x3fc8ff, emissiveIntensity: 1.2 });
  private readonly items: Array<{ mesh: Group; phase: number }> = [];

  constructor(
    private readonly scene: Scene,
    private readonly seaLevel: number,
  ) {
    scene.add(this.group);
  }

  add(x: number, z: number): void {
    const g = new Group();
    const body = new Mesh(this.geo, this.mat);
    body.position.y = 0.3;
    const lamp = new Mesh(this.lampGeo, this.lamp);
    lamp.position.y = 1.05;
    g.add(body, lamp);
    g.position.set(x, this.seaLevel, z);
    this.group.add(g);
    this.items.push({ mesh: g, phase: x * 0.37 + z * 0.11 });
  }

  update(time: number): void {
    for (const it of this.items) {
      it.mesh.position.y = this.seaLevel + Math.sin(time * 1.3 + it.phase) * 0.12;
      it.mesh.rotation.z = Math.sin(time * 0.9 + it.phase) * 0.08;
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.lampGeo.dispose();
    this.mat.dispose();
    this.lamp.dispose();
    this.scene.remove(this.group);
  }
}
