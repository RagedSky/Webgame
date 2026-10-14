import type { Object3D} from 'three';
import { AdditiveBlending, BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three';
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

const UP = new Vector3(0, 1, 0);
const TIER_COLORS = [new Color(0x8c96a3), new Color(0x7fb2d9), new Color(0xd9a86b)];

/** Gemeinsame Materialien (einmal je Besitzer anlegen, in dispose() freigeben). */
export class ShipMaterials {
  readonly hull = new MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.45, metalness: 0.6 });
  readonly dark = new MeshStandardMaterial({ color: 0x2c3138, roughness: 0.7, metalness: 0.4 });
  readonly glass = new MeshStandardMaterial({ color: 0x5ec8ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75, emissive: 0x1b4a66, emissiveIntensity: 0.4 });
  readonly tiers = TIER_COLORS.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.5 }));
  readonly flame = new MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
  readonly flameCore = new MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  readonly socketFree = new MeshBasicMaterial({ color: 0x5ee39a, transparent: true, opacity: 0.75 });
  readonly socketOther = new MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.25 });
  readonly socketHover = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  readonly ghost = new MeshStandardMaterial({ color: 0x5ee39a, transparent: true, opacity: 0.4, depthWrite: false });

  dispose(): void {
    for (const m of [this.hull, this.dark, this.glass, ...this.tiers, this.flame, this.flameCore, this.socketFree, this.socketOther, this.socketHover, this.ghost]) m.dispose();
  }
}

function tierMat(mats: ShipMaterials, tier: number): MeshStandardMaterial {
  return mats.tiers[Math.max(0, Math.min(2, tier - 1))] as MeshStandardMaterial;
}

function strut(from: Vector3, to: Vector3, radius: number, material: MeshStandardMaterial, geos: BufferGeometry[]): Mesh {
  const dir = new Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new CylinderGeometry(radius, radius, len, 8);
  geos.push(geo);
  const mesh = new Mesh(geo, material);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, dir.normalize()));
  return mesh;
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
  const hullGeo = new CylinderGeometry(R * 0.92, R, H, 20);
  geos.push(hullGeo);
  const hullMesh = new Mesh(hullGeo, mats.hull);
  hullMesh.position.y = H / 2;
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
  const plate = new CylinderGeometry(R, R * 1.05, 0.18, 20);
  geos.push(plate);
  const bottomPlate = new Mesh(plate, mats.dark);
  bottomPlate.position.y = 0.09;
  base.add(bottomPlate);
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
    switch (def.type) {
      case 'cockpit': {
        const dome = new SphereGeometry(R * 0.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        geos.push(dome);
        const d = new Mesh(dome, mats.glass);
        obj.add(d);
        const ring = new CylinderGeometry(R * 0.86, R * 0.92, 0.25, 20);
        geos.push(ring);
        const rm = new Mesh(ring, tm);
        rm.position.y = -0.1;
        obj.add(rm);
        obj.position.set(s.x, s.y, s.z);
        break;
      }
      case 'engine': {
        const nozzle = new CylinderGeometry(0.28 + def.tier * 0.04, 0.5 + def.tier * 0.08, 0.9, 14, 1, true);
        geos.push(nozzle);
        const n = new Mesh(nozzle, mats.dark);
        n.position.y = -0.45;
        obj.add(n);
        const throat = new CylinderGeometry(0.3 + def.tier * 0.04, 0.3 + def.tier * 0.04, 0.3, 12);
        geos.push(throat);
        const t = new Mesh(throat, tm);
        t.position.y = -0.05;
        obj.add(t);
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
        const out = new Vector3(Math.cos(s.angle), 0, Math.sin(s.angle));
        const from = new Vector3(s.x, s.y + 0.4, s.z);
        const foot = new Vector3().copy(out).multiplyScalar(R + 0.9 + def.tier * 0.15).setY(-HULL_BASE_Y);
        const upper = strut(from, foot, 0.07 + def.tier * 0.02, tm, geos);
        obj.add(upper);
        const brace = strut(new Vector3(s.x, s.y + 1.3, s.z), new Vector3().copy(foot).addScaledVector(out, -0.4).setY(-HULL_BASE_Y * 0.55), 0.045, mats.dark, geos);
        obj.add(brace);
        const padGeo = new CylinderGeometry(0.32 + def.tier * 0.08, 0.38 + def.tier * 0.08, 0.1, 10);
        geos.push(padGeo);
        const pad = new Mesh(padGeo, mats.dark);
        pad.position.copy(foot).setY(-HULL_BASE_Y + 0.05);
        obj.add(pad);
        break;
      }
      case 'tank': {
        const len = 1.1 + def.tier * 0.5;
        const rad = 0.3 + def.tier * 0.08;
        const tg = new CylinderGeometry(rad, rad, len, 12);
        geos.push(tg);
        const t = new Mesh(tg, tm);
        t.position.set(s.x + Math.cos(s.angle) * (rad + 0.05), s.y, s.z + Math.sin(s.angle) * (rad + 0.05));
        obj.add(t);
        const cap = new SphereGeometry(rad, 12, 8);
        geos.push(cap);
        for (const dy of [-len / 2, len / 2]) {
          const c = new Mesh(cap, mats.hull);
          c.position.copy(t.position).setY(s.y + dy);
          obj.add(c);
        }
        break;
      }
      case 'cargo': {
        const w = 0.8 + def.tier * 0.2;
        const bg = new BoxGeometry(w, 0.9 + def.tier * 0.3, w);
        geos.push(bg);
        const b = new Mesh(bg, mats.dark);
        b.position.set(s.x + Math.cos(s.angle) * (w / 2 + 0.05), s.y, s.z + Math.sin(s.angle) * (w / 2 + 0.05));
        b.rotation.y = -s.angle;
        obj.add(b);
        const stripe = new BoxGeometry(w + 0.02, 0.12, w + 0.02);
        geos.push(stripe);
        const st = new Mesh(stripe, tm);
        st.position.copy(b.position);
        st.rotation.y = -s.angle;
        obj.add(st);
        break;
      }
      case 'scanner': {
        const arm = strut(new Vector3(s.x, s.y, s.z), new Vector3(s.x + Math.cos(s.angle) * 0.7, s.y + 0.5, s.z + Math.sin(s.angle) * 0.7), 0.05, mats.dark, geos);
        obj.add(arm);
        const dish = new SphereGeometry(0.45 + def.tier * 0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3);
        geos.push(dish);
        const d = new Mesh(dish, tm);
        d.position.set(s.x + Math.cos(s.angle) * 0.75, s.y + 0.55, s.z + Math.sin(s.angle) * 0.75);
        d.rotation.z = -0.9;
        d.rotation.y = -s.angle;
        obj.add(d);
        break;
      }
      case 'shield': {
        const ring = new TorusGeometry(0.45 + def.tier * 0.12, 0.07, 8, 20);
        geos.push(ring);
        const r = new Mesh(ring, tm);
        r.position.set(s.x + Math.cos(s.angle) * 0.35, s.y, s.z + Math.sin(s.angle) * 0.35);
        r.rotation.y = -s.angle + Math.PI / 2;
        obj.add(r);
        const coreGeo = new SphereGeometry(0.2, 10, 8);
        geos.push(coreGeo);
        const c = new Mesh(coreGeo, mats.glass);
        c.position.copy(r.position);
        obj.add(c);
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
