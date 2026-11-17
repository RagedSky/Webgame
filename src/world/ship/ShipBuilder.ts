import type { Object3D} from 'three';
import { AdditiveBlending, Color, ConeGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector2, type BufferGeometry, type Texture } from 'three';
import { textures } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';
import { arc, blob, lathe, prism, tube } from '../organic';
import { partDef, type SocketDef, type SocketKind } from '@/game/ship/parts';
import { hullOf, socketsOf, type ShipDesign } from '@/game/ship/ShipDesign';

/** Höhe der Rumpfbasis über dem Boden (Landebeine). */
export const HULL_BASE_Y = 1.5;

export interface SocketMarker {
  index: number;
  kind: SocketKind;
  mesh: Mesh;
}

export interface BuiltShip {
  group: Group;
  /** Teil-Objekte je platzierter Teil-ID (für Auswahl im Editor). */
  parts: Map<string, Object3D>;
  /** Marker für freie Sockel (nur wenn `withSockets`). */
  sockets: SocketMarker[];
  flames: Mesh[];
  /** Ungefährer Radius (m) für Interaktion/Kamera. */
  radius: number;
  height: number;
  dispose(): void;
}

const TIER_COLORS = [new Color(0x8c96a3), new Color(0x7fb2d9), new Color(0xd9a86b)];

/** Gemeinsame Materialien (einmal je Besitzer anlegen, in dispose() freigeben). */
export class ShipMaterials {
  private readonly panelNormal: Texture;
  /** Rumpf: warmweißer Lack mit Panelfugen und Klarlack. */
  readonly hull: MeshPhysicalMaterial;
  /** Farbiger Lackstreifen (kräftiges Orange). */
  readonly paint = new MeshPhysicalMaterial({ color: 0xff6a2a, roughness: 0.35, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  readonly dark = new MeshStandardMaterial({ color: 0x2c3138, roughness: 0.7, metalness: 0.4 });
  readonly glass = new MeshStandardMaterial({ color: 0x5ec8ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75, emissive: 0x1b4a66, emissiveIntensity: 0.4 });
  readonly tiers = TIER_COLORS.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.5 }));
  readonly flame = new MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
  readonly flameCore = new MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  readonly socketFree = new MeshBasicMaterial({ color: 0x5ee39a, transparent: true, opacity: 0.75 });
  readonly socketOther = new MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.25 });
  readonly socketHover = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  readonly ghost = new MeshStandardMaterial({ color: 0x5ee39a, transparent: true, opacity: 0.4, depthWrite: false });

  constructor() {
    this.panelNormal = textures.get('suit').normalMap.clone();
    this.panelNormal.repeat.set(3, 2);
    this.hull = new MeshPhysicalMaterial({ color: 0xe9e4d8, roughness: 0.42, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, normalMap: this.panelNormal, normalScale: new Vector2(0.6, 0.6) });
    addRim(this.hull, 0.7);
    addRim(this.paint, 0.7);
    for (const t of this.tiers) addRim(t, 0.6);
  }

  dispose(): void {
    this.panelNormal.dispose();
    this.paint.dispose();
    for (const m of [this.hull, this.dark, this.glass, ...this.tiers, this.flame, this.flameCore, this.socketFree, this.socketOther, this.socketHover, this.ghost]) m.dispose();
  }
}

function tierMat(mats: ShipMaterials, tier: number): MeshStandardMaterial {
  return mats.tiers[Math.max(0, Math.min(2, tier - 1))] as MeshStandardMaterial;
}

/**
 * Baut die Schiffsgeometrie aus dem Entwurf: Rumpf (Zylinder), Kanzel (Kuppel), Triebwerke (Düsen + Flammen),
 * Tanks/Fracht/Scanner/Schild seitlich, Landebeine als Streben mit Fußplatten. Ursprung = Boden unter dem Schiff.
 */
export function buildShip(design: ShipDesign, mats: ShipMaterials, options: { withSockets?: boolean; socketKind?: SocketKind | null } = {}): BuiltShip {
  const group = new Group();
  const geos: BufferGeometry[] = [];
  const parts = new Map<string, Object3D>();
  const flames: Mesh[] = [];
  const sockets: SocketMarker[] = [];
  const hull = hullOf(design);
  const spec = hull.hull!;
  const R = spec.radius;
  const H = spec.height;
  const base = new Group();
  base.position.y = HULL_BASE_Y;
  group.add(base);

  // Rumpf
  // Rumpf als Rotationskörper: eingezogener Sockel, gerade Flanke (Sockel sitzen auf Radius R), abgerundete Schulter
  const hullGeo = new LatheGeometry(
    [
      [R * 0.8, 0],
      [R * 0.97, H * 0.05],
      [R, H * 0.13],
      [R, H * 0.84],
      [R * 0.97, H * 0.93],
      [R * 0.92, H],
    ].map(([r, y]) => new Vector2(r, y)),
    28,
  );
  geos.push(hullGeo);
  const hullMesh = new Mesh(hullGeo, mats.hull);
  // Lackstreifen um die Rumpfmitte
  const stripeGeo = new CylinderGeometry(R * 1.004, R * 1.004, H * 0.16, 28, 1, true);
  geos.push(stripeGeo);
  const stripe = new Mesh(stripeGeo, mats.paint);
  stripe.position.y = H * 0.5;
  base.add(stripe);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  hullMesh.userData.placedId = 'hull';
  base.add(hullMesh);
  const band = new TorusGeometry(R * 0.96, 0.06, 6, 24);
  geos.push(band);
  for (const y of [H * 0.3, H * 0.7]) {
    const b = new Mesh(band, tierMat(mats, hull.tier));
    b.rotation.x = Math.PI / 2;
    b.position.y = y;
    base.add(b);
  }
  // Bodenschürze und Bullaugen
  const skirt = lathe(
    [
      [R * 0.78, -0.04],
      [R * 1.03, 0],
      [R * 1.06, 0.1],
      [R * 1.0, 0.2],
    ],
    28,
  );
  geos.push(skirt);
  base.add(new Mesh(skirt, mats.dark));
  const port = new SphereGeometry(0.16, 10, 8);
  geos.push(port);
  const portRing = new TorusGeometry(0.17, 0.03, 6, 14);
  geos.push(portRing);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const w = new Mesh(port, mats.glass);
    w.position.set(Math.cos(a) * R * 0.97, H * 0.76, Math.sin(a) * R * 0.97);
    w.scale.set(1, 1, 1);
    base.add(w);
    const r = new Mesh(portRing, tierMat(mats, hull.tier));
    r.position.set(Math.cos(a) * R * 1.0, H * 0.76, Math.sin(a) * R * 1.0);
    r.rotation.y = -a + Math.PI / 2;
    base.add(r);
  }
  parts.set('hull', hullMesh);

  const socketDefs = socketsOf(design);
  const used = new Set<number>();
  for (const p of design.parts) {
    const def = partDef(p.partId);
    const s = socketDefs[p.socket];
    if (!s) continue;
    used.add(p.socket);
    const obj = new Group();
    obj.userData.placedId = p.id;
    const tm = tierMat(mats, def.tier);
    const add = (geo: BufferGeometry, material: MeshStandardMaterial | MeshBasicMaterial, x = 0, y = 0, z = 0): Mesh => {
      geos.push(geo);
      const m = new Mesh(geo, material);
      m.position.set(x, y, z);
      obj.add(m);
      return m;
    };
    const ox = Math.cos(s.angle);
    const oz = Math.sin(s.angle);
    switch (def.type) {
      case 'cockpit': {
        // Kanzel: gewölbte Glaskuppel mit Spanten, Sockelring und Funkmast
        const dome = lathe(
          [
            [R * 0.84, 0],
            [R * 0.86, R * 0.16],
            [R * 0.74, R * 0.46],
            [R * 0.48, R * 0.7],
            [R * 0.2, R * 0.82],
            [0, R * 0.85],
          ],
          24,
        );
        add(dome, mats.glass);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          const rib = tube(arc([Math.cos(a) * R * 0.86, R * 0.02, Math.sin(a) * R * 0.86], [-Math.cos(a) * R * 0.86, R * 0.02, -Math.sin(a) * R * 0.86], [0, R * 0.86, 0], 0.035, 0.035, 10), 6);
          add(rib, tm);
        }
        const ring = lathe(
          [
            [R * 0.92, -0.24],
            [R * 0.97, -0.12],
            [R * 0.93, 0.02],
            [R * 0.84, 0.06],
          ],
          24,
        );
        add(ring, tm);
        add(tube(arc([R * 0.6, 0.05, 0], [R * 0.72, R * 1.15, 0], [0.04, 0, 0], 0.025, 0.014, 4), 5), mats.dark);
        add(new SphereGeometry(0.05, 8, 6), mats.paint, R * 0.72, R * 1.15, 0);
        obj.position.set(s.x, s.y, s.z);
        break;
      }
      case 'engine': {
        // Triebwerk: Glockendüse mit Kühlrippen, Brennkammer und Halsring
        const t0 = 0.28 + def.tier * 0.04;
        const t1 = 0.5 + def.tier * 0.08;
        const bell = lathe(
          [
            [t1, -0.9],
            [t1 * 0.97, -0.82],
            [t1 * 0.8, -0.55],
            [t0 * 1.02, -0.26],
            [t0 * 0.92, -0.12],
            [t0 * 1.15, 0],
          ],
          18,
        );
        add(bell, mats.dark);
        const inner = lathe(
          [
            [t0 * 0.85, -0.14],
            [t0 * 0.95, -0.26],
            [t1 * 0.74, -0.55],
            [t1 * 0.9, -0.84],
          ],
          18,
        );
        add(inner, mats.dark).scale.set(1, 1, 1);
        for (const y of [-0.45, -0.68]) {
          const rr = t0 + (t1 - t0) * ((-y - 0.26) / 0.64) * 0.98 + 0.02;
          const rib = new TorusGeometry(rr, 0.022, 6, 20);
          add(rib, tm, 0, y, 0).rotation.x = Math.PI / 2;
        }
        const collar = lathe(
          [
            [t0 * 1.1, -0.1],
            [t0 * 1.45, -0.04],
            [t0 * 1.5, 0.1],
            [t0 * 1.2, 0.18],
          ],
          16,
        );
        add(collar, tm);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          add(tube(arc([Math.cos(a) * t0 * 1.35, 0.1, Math.sin(a) * t0 * 1.35], [Math.cos(a) * t1 * 0.85, -0.52, Math.sin(a) * t1 * 0.85], [Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1], 0.025, 0.02, 4), 5), mats.hull);
        }
        const flameGeo = new ConeGeometry(0.42 + def.tier * 0.06, 2.2, 12, 1, true);
        geos.push(flameGeo);
        const flame = new Mesh(flameGeo, mats.flame);
        flame.rotation.x = Math.PI;
        flame.position.y = -0.9 - 1.1;
        flame.scale.set(1, 0.001, 1);
        flame.userData.baseY = -0.9;
        obj.add(flame);
        const core = new Mesh(flameGeo, mats.flameCore);
        core.rotation.x = Math.PI;
        core.scale.set(0.45, 0.001, 0.45);
        core.position.y = -0.9 - 0.5;
        core.userData.baseY = -0.9;
        obj.add(core);
        flames.push(flame, core);
        obj.position.set(s.x, s.y, s.z);
        break;
      }
      case 'legs': {
        // Landebein: gebogener Holm mit Hüftgelenk, Hydraulikstrebe und gewölbtem Fußteller
        const reach = R + 0.9 + def.tier * 0.15;
        const hipY = s.y + 0.4;
        const footY = -HULL_BASE_Y;
        const r0 = 0.1 + def.tier * 0.02;
        const path = arc([s.x, hipY, s.z], [ox * reach, footY + 0.14, oz * reach], [ox * 0.45, 0.5, oz * 0.45], r0, r0 * 0.68, 8);
        add(tube(path, 8), tm);
        const hip = blob(r0 * 1.7, `leg${p.socket}`, 0.06, 1.2, 1, 8, 6);
        add(hip, mats.dark, s.x + ox * 0.05, hipY, s.z + oz * 0.05);
        const mid = path[5]!;
        add(tube(arc([s.x, s.y + 1.3, s.z], [mid.x, mid.y, mid.z], [ox * 0.1, 0.05, oz * 0.1], 0.04, 0.03, 4), 6), mats.dark);
        add(tube(arc([s.x + ox * 0.25, s.y + 1.05, s.z + oz * 0.25], [mid.x, mid.y, mid.z], [0, 0, 0], 0.06, 0.06, 2), 6), mats.hull);
        const padR = 0.34 + def.tier * 0.08;
        const pad = lathe(
          [
            [padR * 0.95, 0],
            [padR, 0.03],
            [padR * 0.8, 0.09],
            [padR * 0.35, 0.14],
            [0, 0.15],
          ],
          14,
        );
        add(pad, mats.dark, ox * reach, footY, oz * reach);
        add(blob(r0 * 1.1, `ankle${p.socket}`, 0.05, 1.2, 1, 8, 6), tm, ox * reach, footY + 0.16, oz * reach);
        break;
      }
      case 'tank': {
        // Tank: Kapsel mit Spannbändern und Leitung zum Rumpf
        const len = 1.1 + def.tier * 0.5;
        const rad = 0.3 + def.tier * 0.08;
        const tx = s.x + ox * (rad + 0.05);
        const tz = s.z + oz * (rad + 0.05);
        const capsule = lathe(
          [
            [0, -len / 2 - rad * 0.9],
            [rad * 0.6, -len / 2 - rad * 0.68],
            [rad * 0.95, -len / 2 - rad * 0.2],
            [rad, -len / 2 + rad * 0.2],
            [rad, len / 2 - rad * 0.2],
            [rad * 0.95, len / 2 + rad * 0.2],
            [rad * 0.6, len / 2 + rad * 0.68],
            [0, len / 2 + rad * 0.9],
          ],
          16,
        );
        add(capsule, tm, tx, s.y, tz);
        for (const dy of [-len * 0.3, len * 0.3]) {
          const strap = new TorusGeometry(rad * 1.03, 0.03, 6, 20);
          add(strap, mats.dark, tx, s.y + dy, tz).rotation.x = Math.PI / 2;
        }
        add(tube(arc([tx, s.y + len / 2 + rad * 0.7, tz], [s.x - ox * 0.05, s.y + len / 2 + rad * 0.2, s.z - oz * 0.05], [0, 0.18, 0], 0.035, 0.035, 5), 6), mats.hull);
        add(new SphereGeometry(0.05, 8, 6), mats.paint, tx + ox * rad, s.y, tz + oz * rad);
        break;
      }
      case 'cargo': {
        // Frachtbehälter: gefaster Quader mit Griffleiste und Markierungsband
        const w = 0.8 + def.tier * 0.2;
        const h = 0.9 + def.tier * 0.3;
        const cx = s.x + ox * (w / 2 + 0.05);
        const cz = s.z + oz * (w / 2 + 0.05);
        const half = (w / 2) * Math.SQRT2;
        const crate = prism(
          [
            [half * 0.82, -h / 2],
            [half, -h / 2 + 0.09],
            [half, h / 2 - 0.09],
            [half * 0.82, h / 2],
            [0, h / 2],
          ],
          4,
        );
        add(crate, mats.dark, cx, s.y, cz).rotation.y = -s.angle;
        const band = prism(
          [
            [half * 1.02, -0.07],
            [half * 1.02, 0.07],
          ],
          4,
        );
        add(band, tm, cx, s.y + h * 0.18, cz).rotation.y = -s.angle;
        add(tube(arc([cx + ox * (w / 2 + 0.03) - oz * w * 0.25, s.y - h * 0.12, cz + oz * (w / 2 + 0.03) + ox * w * 0.25], [cx + ox * (w / 2 + 0.03) + oz * w * 0.25, s.y - h * 0.12, cz + oz * (w / 2 + 0.03) - ox * w * 0.25], [ox * 0.06, 0, oz * 0.06], 0.025, 0.025, 4), 5), mats.hull);
        add(new SphereGeometry(0.045, 8, 6), mats.paint, cx + ox * (w / 2 + 0.01), s.y + h * 0.34, cz + oz * (w / 2 + 0.01));
        break;
      }
      case 'scanner': {
        // Scanner: Schwenkarm, Parabolschüssel mit Empfänger
        const dr = 0.45 + def.tier * 0.1;
        const hx = s.x + ox * 0.75;
        const hy = s.y + 0.55;
        const hz = s.z + oz * 0.75;
        add(tube(arc([s.x, s.y, s.z], [hx, hy, hz], [0, 0.22, 0], 0.06, 0.045, 5), 6), mats.dark);
        add(blob(0.09, `scan${p.socket}`, 0.05, 1.2, 1, 8, 6), tm, hx, hy, hz);
        const dishGroup = new Group();
        dishGroup.position.set(hx, hy, hz);
        dishGroup.rotation.y = -s.angle + Math.PI / 2;
        dishGroup.rotation.x = 0.9;
        obj.add(dishGroup);
        const dish = lathe(
          [
            [0.02, 0.04],
            [dr * 0.45, 0.09],
            [dr * 0.8, 0.2],
            [dr, 0.36],
            [dr * 0.98, 0.38],
            [dr * 0.78, 0.23],
            [dr * 0.44, 0.12],
            [0.02, 0.07],
          ],
          18,
        );
        geos.push(dish);
        dishGroup.add(new Mesh(dish, tm));
        const feed = tube(arc([0, 0.07, 0], [0, 0.52, 0], [0, 0, 0], 0.02, 0.014, 2), 5);
        geos.push(feed);
        dishGroup.add(new Mesh(feed, mats.dark));
        const tip = new SphereGeometry(0.05, 8, 6);
        geos.push(tip);
        const tipMesh = new Mesh(tip, mats.paint);
        tipMesh.position.y = 0.54;
        dishGroup.add(tipMesh);
        break;
      }
      case 'shield': {
        // Schildgenerator: Emitterring mit Kern und drei Haltearmen
        const rr = 0.45 + def.tier * 0.12;
        const sx = s.x + ox * 0.38;
        const sz = s.z + oz * 0.38;
        const ring = new TorusGeometry(rr, 0.075, 10, 24);
        add(ring, tm, sx, s.y, sz).rotation.y = -s.angle + Math.PI / 2;
        add(blob(0.2, `shield${p.socket}`, 0.1, 1.5, 1, 10, 8), mats.glass, sx, s.y, sz);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          // Ringpunkt in der Ebene senkrecht zur Auswärtsrichtung
          const px = sx - oz * Math.cos(a) * rr;
          const py = s.y + Math.sin(a) * rr;
          const pz = sz + ox * Math.cos(a) * rr;
          add(tube(arc([s.x, s.y + Math.sin(a) * 0.15, s.z], [px, py, pz], [ox * 0.05, 0, oz * 0.05], 0.035, 0.028, 3), 5), mats.dark);
        }
        break;
      }
      case 'hull':
        break;
    }
    obj.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.userData.placedId = p.id;
      }
    });
    base.add(obj);
    parts.set(p.id, obj);
  }

  if (options.withSockets) {
    const markerGeo = new SphereGeometry(0.18, 10, 8);
    geos.push(markerGeo);
    socketDefs.forEach((s: SocketDef, i) => {
      if (used.has(i)) return;
      const active = !options.socketKind || options.socketKind === s.kind;
      const m = new Mesh(markerGeo, active ? mats.socketFree : mats.socketOther);
      const off = s.kind === 'side' ? 0.25 : s.kind === 'bottom' ? -0.35 : s.kind === 'leg' ? 0.3 : 0.2;
      m.position.set(s.x + (s.kind === 'side' || s.kind === 'leg' ? Math.cos(s.angle) * off : 0), s.y + (s.kind === 'top' ? off : s.kind === 'bottom' ? off : 0), s.z + (s.kind === 'side' || s.kind === 'leg' ? Math.sin(s.angle) * off : 0));
      m.userData.socket = i;
      m.userData.active = active;
      base.add(m);
      sockets.push({ index: i, kind: s.kind, mesh: m });
    });
  }

  return {
    group,
    parts,
    sockets,
    flames,
    radius: R + 1.4,
    height: HULL_BASE_Y + H + R * 0.8,
    dispose() {
      for (const g of geos) g.dispose();
      group.removeFromParent();
    },
  };
}

/** Flammen je nach Schub skalieren (0 = aus). */
export function setFlames(ship: BuiltShip, throttle: number, time: number): void {
  const t = Math.max(0, Math.min(1, throttle));
  for (const f of ship.flames) {
    const flicker = 1 + Math.sin(time * 37 + f.position.x * 5) * 0.12;
    const s = t < 0.01 ? 0.001 : t * flicker;
    f.scale.y = s;
    f.position.y = (f.userData.baseY as number) - 2.2 * s * 0.5;
  }
}
