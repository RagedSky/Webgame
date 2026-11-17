import { Bone, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector2, type Material, type Object3D } from 'three';
import type { CharacterConfig } from '@/game/character/Character';
import { clamp } from '@/math/utils';
import { textures } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';
import { arc, blob, crystal, lathe, prism, tube } from '../organic';
import { BONES, BONE_PARENTS, ZONE, buildBodyCage, buildBodyMesh, specFromConfig, type BodyCage } from './BodyCage';
import { roundedBox, subdivide, vertexNormals, type QuadMesh } from './QuadMesh';

export interface BuiltCharacter {
  group: Group;
  /** Körpergröße in m bis zum Helmscheitel. */
  height: number;
  /** Augenhöhe (Mitte des Visiers). */
  eyeHeight: number;
  /** Geh-/Idle-Animation: `dt` Sekunden, Geschwindigkeit m/s. */
  animate(dt: number, speed: number, grounded: boolean): void;
  dispose(): void;
}

/** Materialgruppen des Körpernetzes. */
const MAT = { FABRIC: 0, SHELL: 1, JOINT: 2, ACCENT: 3, VISOR: 4 } as const;
const ZONE_MATERIAL: Record<number, number> = {
  [ZONE.FABRIC]: MAT.FABRIC,
  [ZONE.FABRIC2]: MAT.FABRIC,
  [ZONE.SHELL]: MAT.SHELL,
  [ZONE.SHELL2]: MAT.SHELL,
  [ZONE.JOINT]: MAT.JOINT,
  [ZONE.ACCENT]: MAT.ACCENT,
  [ZONE.VISOR]: MAT.VISOR,
};

/**
 * Wandelt das unterteilte Quad-Netz in eine Geometrie mit Haut-Attributen. Punkte werden nur dort verdoppelt, wo sich
 * Zone oder UV an einer Kante ändern (Farb- und Texturnähte); Positionen und Normalen bleiben identisch, die Fläche ist
 * also überall geschlossen und glatt.
 */
export function bodyGeometry(mesh: QuadMesh, primary: Color, secondary: Color): BufferGeometry {
  const normals = vertexNormals(mesh);
  const bones = mesh.bones;
  const vertexCount = mesh.positions.length / 3;
  // je Punkt die vier stärksten Knochen
  const skinIndex = new Uint16Array(vertexCount * 4);
  const skinWeight = new Float32Array(vertexCount * 4);
  for (let v = 0; v < vertexCount; v++) {
    const picked: number[] = [];
    for (let slot = 0; slot < 4; slot++) {
      let best = -1;
      let bestW = 0;
      for (let b = 0; b < bones; b++) {
        const w = mesh.weights[v * bones + b] as number;
        if (w > bestW && !picked.includes(b)) {
          best = b;
          bestW = w;
        }
      }
      if (best < 0) break;
      picked.push(best);
      skinIndex[v * 4 + slot] = best;
      skinWeight[v * 4 + slot] = bestW;
    }
    const sum = (skinWeight[v * 4] as number) + (skinWeight[v * 4 + 1] as number) + (skinWeight[v * 4 + 2] as number) + (skinWeight[v * 4 + 3] as number) || 1;
    for (let slot = 0; slot < 4; slot++) skinWeight[v * 4 + slot] = (skinWeight[v * 4 + slot] as number) / sum;
  }
  // Lackierte Schalen wirken heller als der Stoff in derselben Farbe: die Teile heben sich auch einfarbig voneinander ab
  const shellPrimary = primary.clone().lerp(WHITE, 0.14);
  const fabricPrimary = primary.clone().multiplyScalar(0.9);
  const zoneColor = (zone: number): Color => (zone === ZONE.FABRIC ? fabricPrimary : zone === ZONE.SHELL ? shellPrimary : zone === ZONE.FABRIC2 || zone === ZONE.SHELL2 ? secondary : WHITE);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const lookup = new Map<string, number>();
  const indices: number[][] = [[], [], [], [], []];
  const corner = (f: number, k: number): number => {
    const v = mesh.faces[f * 4 + k] as number;
    const zone = mesh.zones[f] as number;
    const u = mesh.uvs[f * 8 + k * 2] as number;
    const w = mesh.uvs[f * 8 + k * 2 + 1] as number;
    const key = `${v}:${zone}:${Math.round(u * 2048)}:${Math.round(w * 2048)}`;
    let id = lookup.get(key);
    if (id === undefined) {
      id = pos.length / 3;
      lookup.set(key, id);
      pos.push(mesh.positions[v * 3] as number, mesh.positions[v * 3 + 1] as number, mesh.positions[v * 3 + 2] as number);
      nor.push(normals[v * 3] as number, normals[v * 3 + 1] as number, normals[v * 3 + 2] as number);
      uv.push(u, w);
      const c = zoneColor(zone);
      col.push(c.r, c.g, c.b);
      for (let s = 0; s < 4; s++) {
        si.push(skinIndex[v * 4 + s] as number);
        sw.push(skinWeight[v * 4 + s] as number);
      }
    }
    return id;
  };
  for (let f = 0; f < mesh.faces.length / 4; f++) {
    const list = indices[ZONE_MATERIAL[mesh.zones[f] as number] as number] as number[];
    const a = corner(f, 0);
    const b = corner(f, 1);
    const c = corner(f, 2);
    const d = corner(f, 3);
    list.push(a, b, c, a, c, d);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
  const all: number[] = [];
  indices.forEach((list, material) => {
    if (list.length === 0) return;
    geo.addGroup(all.length, list.length, material);
    for (const i of list) all.push(i);
  });
  geo.setIndex(all);
  geo.computeBoundingSphere();
  return geo;
}

const WHITE = new Color(1, 1, 1);

/** Starres Technikteil aus einem Quad-Käfig: zweimal unterteilt, glatte Normalen. */
function partGeometry(cage: QuadMesh): BufferGeometry {
  const mesh = subdivide(subdivide(cage));
  const index: number[] = [];
  for (let f = 0; f < mesh.faces.length; f += 4) {
    const a = mesh.faces[f] as number;
    const b = mesh.faces[f + 1] as number;
    const c = mesh.faces[f + 2] as number;
    const d = mesh.faces[f + 3] as number;
    index.push(a, b, c, a, c, d);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(mesh.positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(vertexNormals(mesh), 3));
  geo.setIndex(index);
  return geo;
}

/**
 * Parametrischer Charakter im geschlossenen Exo-Anzug. Der Körper samt Helm ist ein einziges, geschlossenes Quad-Netz
 * (Käfig aus `BodyCage`, zwei Stufen Catmull-Clark) mit Skelett und weichen Gelenken; Farben und Materialien liegen als
 * Zonen auf den Flächen. Nur Rucksack, Helmaufsatz, Ohrkapseln und Abzeichen sind starre Anbauteile an Knochen.
 * Ursprung = Füße, Blickrichtung −z (die Figur wird nach dem Bau gedreht).
 */
export function buildCharacter(cfg: CharacterConfig): BuiltCharacter {
  const cage = buildBodyCage(specFromConfig(cfg));
  const primary = new Color(cfg.suit.primary);
  const secondary = new Color(cfg.suit.secondary);
  const accent = new Color(cfg.suit.accent);
  const tint = new Color(cfg.helmet.visorTint);
  const fabricTex = textures.get('fabric');
  const finish = cfg.suit.finish;
  const gloss = finish === 'gloss' ? 1 : finish === 'satin' ? 0.5 : 0;
  const mats = {
    fabric: new MeshPhysicalMaterial({ vertexColors: true, map: fabricTex.map, normalMap: fabricTex.normalMap, normalScale: new Vector2(0.55, 0.55), roughnessMap: fabricTex.roughnessMap, roughness: 0.78, metalness: 0.02, sheen: 0.5, sheenColor: new Color(0.85, 0.85, 0.85), sheenRoughness: 0.55 }),
    shell: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5 - gloss * 0.3, metalness: 0.2 + gloss * 0.1, clearcoat: 0.25 + gloss * 0.75, clearcoatRoughness: 0.42 - gloss * 0.36 }),
    joint: new MeshPhysicalMaterial({ color: 0x16191f, normalMap: fabricTex.normalMap, normalScale: new Vector2(0.9, 0.9), roughness: 0.85, metalness: 0.05 }),
    accent: new MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.1, roughness: 0.35 }),
    visor: new MeshPhysicalMaterial({ color: tint.clone().multiplyScalar(0.55), metalness: 0.9, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.4, emissive: tint, emissiveIntensity: 0.07 }),
    /** Anbauteile: Schale in Sekundär- und Primärfarbe. */
    partDark: new MeshPhysicalMaterial({ color: secondary, roughness: 0.5 - gloss * 0.25, metalness: 0.3, clearcoat: 0.25 + gloss * 0.6, clearcoatRoughness: 0.35 }),
    partLight: new MeshPhysicalMaterial({ color: primary, roughness: 0.5 - gloss * 0.28, metalness: 0.22, clearcoat: 0.2 + gloss * 0.8, clearcoatRoughness: 0.4 - gloss * 0.3 }),
    metal: new MeshPhysicalMaterial({ color: 0x8a9099, roughness: 0.35, metalness: 0.9 }),
  };
  for (const m of [mats.fabric, mats.shell, mats.partDark, mats.partLight]) addRim(m, 0.6);
  addRim(mats.joint, 0.3);

  const geos: BufferGeometry[] = [];
  const geometry = bodyGeometry(buildBodyMesh(cage), primary, secondary);
  geos.push(geometry);
  const bodyMaterials: Material[] = [mats.fabric, mats.shell, mats.joint, mats.accent, mats.visor];
  const body = new SkinnedMesh(geometry, bodyMaterials);
  body.castShadow = true;
  body.receiveShadow = true;
  // die Hüllkugel der Bindehaltung gilt nicht für bewegte Gliedmaßen
  body.frustumCulled = false;

  // Skelett in Bindehaltung
  const bones: Bone[] = BONES.map((name) => {
    const bone = new Bone();
    bone.name = name;
    return bone;
  });
  bones.forEach((bone, i) => {
    const parent = BONE_PARENTS[i] as number;
    const j = cage.joints[i] as [number, number, number];
    if (parent < 0) bone.position.set(j[0], j[1], j[2]);
    else {
      const p = cage.joints[parent] as [number, number, number];
      bone.position.set(j[0] - p[0], j[1] - p[1], j[2] - p[2]);
      (bones[parent] as Bone).add(bone);
    }
  });
  const root = bones[0] as Bone;
  body.add(root);
  const skeleton = new Skeleton(bones);
  body.bind(skeleton);

  addGear(cfg, cage, bones, mats, geos);

  // Die Figur ist nach +z modelliert; im Spiel zeigt „vorn“ nach −z
  const rig = new Group();
  rig.rotation.y = Math.PI;
  rig.add(body);
  const group = new Group();
  group.add(rig);

  const bone = (name: (typeof BONES)[number]): Bone => bones[BONES.indexOf(name)] as Bone;
  const hips = bone('hips');
  const spine = bone('spine');
  const chest = bone('chest');
  const head = bone('head');
  const limbs = [
    { side: 1, upperArm: bone('upperArmL'), forearm: bone('forearmL'), hand: bone('handL'), thigh: bone('thighL'), shin: bone('shinL'), foot: bone('footL') },
    { side: -1, upperArm: bone('upperArmR'), forearm: bone('forearmR'), hand: bone('handR'), thigh: bone('thighR'), shin: bone('shinR'), foot: bone('footR') },
  ];
  const hipsY = hips.position.y;
  /** Arme hängen in Ruhe fast senkrecht; die Bindehaltung (A-Pose) schont die Schultern beim Verformen. */
  const hang = cage.armAngle - 0.17;

  let phase = 0;
  const built: BuiltCharacter = {
    group,
    height: cage.height,
    eyeHeight: cage.helmetCenter[1] + 0.005,
    animate(dt: number, speed: number, grounded: boolean) {
      const walk = clamp(speed / 4.5, 0, 1.6);
      phase += dt * (2.5 + speed * 1.7);
      const amp = grounded ? walk * 0.65 : 0.25;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      const breath = Math.sin(phase * 0.35);
      for (const limb of limbs) {
        const dir = limb.side;
        limb.thigh.rotation.x = dir * s * amp;
        // Knie beugt, während das Bein nach hinten schwingt und wieder vorgeholt wird
        const knee = Math.max(0, dir * c) * amp * 1.15 + (grounded ? 0 : 0.35);
        limb.shin.rotation.x = knee;
        // Fuß gleicht Ober- und Unterschenkel teilweise aus, damit die Sohle nicht kippt
        limb.foot.rotation.x = -(dir * s * amp + knee) * 0.35;
        limb.upperArm.rotation.set(-dir * s * amp * 0.7, 0, -dir * (hang - (grounded ? 0 : 0.25)) + dir * breath * 0.012);
        limb.forearm.rotation.x = -0.2 - Math.max(0, -dir * s) * amp * 0.7 - walk * 0.12;
        limb.hand.rotation.x = -0.08;
      }
      spine.rotation.x = walk * 0.04;
      chest.rotation.y = s * amp * 0.09;
      chest.rotation.x = walk * 0.02 + breath * 0.006;
      head.rotation.y = -s * amp * 0.06;
      hips.rotation.y = -s * amp * 0.05;
      hips.position.y = hipsY + (grounded ? Math.abs(c) * 0.025 * walk : 0);
    },
    dispose() {
      for (const geo of geos) geo.dispose();
      for (const m of Object.values(mats)) m.dispose();
      skeleton.dispose();
      group.removeFromParent();
    },
  };
  built.animate(0, 0, true);
  return built;
}

type GearMaterials = { partDark: Material; partLight: Material; accent: Material; metal: Material; joint: Material };

/** Starre Anbauteile: Ohrkapseln, Helmaufsatz, Rucksack mit Schlauch, Abzeichen. Jedes Teil hängt an einem Knochen. */
function addGear(cfg: CharacterConfig, cage: BodyCage, bones: Bone[], mats: GearMaterials, geos: BufferGeometry[]): void {
  const attach = (boneName: (typeof BONES)[number], geo: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh => {
    const index = BONES.indexOf(boneName);
    const joint = cage.joints[index] as [number, number, number];
    geos.push(geo);
    const mesh = new Mesh(geo, material);
    mesh.position.set(x - joint[0], y - joint[1], z - joint[2]);
    mesh.castShadow = true;
    (bones[index] as Object3D).add(mesh);
    return mesh;
  };
  const [, hy, hz] = cage.helmetCenter;
  const hr = cage.helmetRadius;
  const wide = cfg.helmet.shape === 'wide' ? 1.12 : cfg.helmet.shape === 'tall' ? 0.95 : cfg.helmet.shape === 'angular' ? 1.03 : 1;
  const tall = cfg.helmet.shape === 'tall' ? 1.12 : cfg.helmet.shape === 'wide' ? 0.94 : 1;

  // Ohrkapseln: flache Scheiben an den Helmseiten mit Leuchtpunkt
  for (const side of [1, -1]) {
    const pod = lathe([[0.001, -0.012], [0.03, -0.012], [0.036, -0.004], [0.034, 0.006], [0.02, 0.012], [0.001, 0.012]], 14);
    pod.rotateZ((-side * Math.PI) / 2);
    attach('head', pod, mats.partDark, side * hr * wide * 0.96, hy - hr * 0.08, hz - 0.01);
    attach('head', blob(0.009, `ear${side}`, 0, 1, 1, 8, 6), mats.accent, side * (hr * wide * 0.96 + 0.011), hy - hr * 0.08, hz - 0.01);
  }

  // Helmaufsatz
  const crest = cfg.helmet.crest;
  if (crest === 'fin') {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = -0.25 + (i / 8) * 2.1;
      const r = hr * 1.03;
      pts.push({ x: 0, y: hy + Math.cos(a) * r * tall, z: hz + Math.sin(-a) * r + 0.0, r: 0.006 + Math.sin((i / 8) * Math.PI) * 0.012 });
    }
    const fin = tube(pts, 8);
    fin.scale(0.55, 1, 1);
    attach('head', fin, mats.partDark, 0, 0, 0);
  } else if (crest === 'antenna') {
    const baseX = hr * wide * 0.99;
    attach('head', tube(arc([0, 0, 0], [0.012, 0.19, -0.02], [0.004, 0, -0.004], 0.0045, 0.002, 5), 6), mats.metal, baseX, hy + 0.01, hz - 0.03);
    attach('head', blob(0.008, 'antTip', 0, 1, 1, 8, 6), mats.accent, baseX + 0.012, hy + 0.2, hz - 0.05);
  } else if (crest === 'lamps') {
    for (const side of [1, -1]) {
      const lamp = lathe([[0.001, -0.016], [0.015, -0.016], [0.019, -0.004], [0.019, 0.012], [0.001, 0.012]], 12);
      lamp.rotateX(Math.PI / 2 - 0.35);
      attach('head', lamp, mats.partDark, side * hr * wide * 0.5, hy + hr * tall * 0.66, hz + hr * 0.62);
      const lens = lathe([[0.001, 0], [0.014, 0], [0.01, 0.005], [0.001, 0.007]], 12);
      lens.rotateX(Math.PI / 2 - 0.35);
      attach('head', lens, mats.accent, side * hr * wide * 0.5, hy + hr * tall * 0.66 - 0.004, hz + hr * 0.62 + 0.012);
    }
  }

  // Rucksack
  const [, by, bz] = cage.chestBack;
  const pack = cfg.gear.pack;
  if (pack === 'compact') {
    // nach unten leicht verjüngter Kasten mit Leuchtleiste
    const taper = (x: number, y: number, z: number): [number, number, number] => [x * (0.88 + (y / 0.3 + 0.5) * 0.16), y, z * (0.9 + (y / 0.3 + 0.5) * 0.14)];
    attach('chest', partGeometry(roundedBox(0.24, 0.3, 0.115, 0.028, taper)), mats.partDark, 0, by - 0.035, bz - 0.05);
    attach('chest', partGeometry(roundedBox(0.03, 0.16, 0.02, 0.008)), mats.accent, 0, by - 0.03, bz - 0.106);
    attach('chest', partGeometry(roundedBox(0.17, 0.035, 0.03, 0.01)), mats.partLight, 0, by + 0.085, bz - 0.1);
  } else if (pack === 'tanks') {
    for (const side of [1, -1]) {
      attach('chest', lathe([[0.001, -0.16], [0.03, -0.155], [0.046, -0.13], [0.046, 0.12], [0.032, 0.15], [0.014, 0.16], [0.001, 0.162]], 14), mats.partLight, side * 0.062, by - 0.04, bz - 0.055);
      attach('chest', lathe([[0.048, -0.012], [0.05, -0.012], [0.05, 0.012], [0.048, 0.012]], 14), mats.accent, side * 0.062, by + 0.03, bz - 0.055);
    }
    attach('chest', partGeometry(roundedBox(0.2, 0.16, 0.07, 0.022)), mats.partDark, 0, by - 0.02, bz - 0.03);
  } else if (pack === 'explorer') {
    const taper = (x: number, y: number, z: number): [number, number, number] => [x * (0.9 + (y / 0.4 + 0.5) * 0.12), y, z * (0.85 + (y / 0.4 + 0.5) * 0.2)];
    attach('chest', partGeometry(roundedBox(0.29, 0.4, 0.15, 0.034, taper)), mats.partDark, 0, by - 0.06, bz - 0.065);
    attach('chest', partGeometry(roundedBox(0.2, 0.11, 0.03, 0.012)), mats.partLight, 0, by - 0.13, bz - 0.14);
    attach('chest', partGeometry(roundedBox(0.03, 0.12, 0.02, 0.008)), mats.accent, 0, by + 0.03, bz - 0.14);
    const roll = lathe([[0.001, -0.13], [0.04, -0.13], [0.046, -0.11], [0.046, 0.11], [0.04, 0.13], [0.001, 0.13]], 14);
    roll.rotateZ(Math.PI / 2);
    attach('chest', roll, mats.partLight, 0, by + 0.185, bz - 0.06);
    attach('chest', lathe([[0.001, -0.07], [0.03, -0.07], [0.034, -0.055], [0.034, 0.055], [0.02, 0.07], [0.001, 0.072]], 12), mats.metal, 0.17, by - 0.1, bz - 0.04);
    attach('chest', tube(arc([0, 0, 0], [-0.01, 0.3, -0.02], [0, 0, -0.01], 0.004, 0.002, 5), 6), mats.metal, -0.13, by + 0.08, bz - 0.06);
    attach('chest', blob(0.009, 'packTip', 0, 1, 1, 8, 6), mats.accent, -0.14, by + 0.385, bz - 0.08);
  }
  if (pack !== 'none') {
    // Versorgungsschlauch vom Rucksack zum Helm
    for (const side of [1, -1]) {
      attach('chest', tube(arc([side * 0.07, by + 0.07, bz - 0.05], [side * hr * 0.55, hy - hr * 0.72, hz - hr * 0.62], [side * 0.03, 0.02, -0.035], 0.011, 0.009, 7), 8), mats.joint, 0, 0, 0);
    }
  }

  // Abzeichen auf der Brust
  const badge = cfg.suit.badge;
  if (badge !== 'none') {
    const [, cy, cz] = cage.chestFront;
    const bx = cage.shoulderX * 0.42;
    const plate = lathe([[0.001, 0], [0.026, 0], [0.028, 0.003], [0.024, 0.007], [0.001, 0.008]], 16);
    plate.rotateX(Math.PI / 2);
    attach('chest', plate, mats.partDark, bx, cy, cz - 0.004);
    let sign: BufferGeometry;
    if (badge === 'archive') sign = lathe([[0.011, 0], [0.018, 0], [0.018, 0.004], [0.011, 0.004]], 14);
    else if (badge === 'star') sign = prism([[0.001, 0], [0.017, 0], [0.012, 0.005], [0.001, 0.006]], 5, -Math.PI / 2);
    else if (badge === 'leaf') {
      sign = blob(0.014, 'leaf', 0, 1, 1, 10, 6);
      sign.scale(0.6, 0.25, 1.2);
    } else sign = crystal(0.008, 0.03, 0.4, 6);
    if (badge === 'crystal') sign.translate(0, -0.015, 0);
    else if (badge === 'leaf') sign.rotateX(Math.PI / 2);
    else sign.rotateX(Math.PI / 2);
    attach('chest', sign, mats.accent, bx, cy, cz + 0.004);
  }
}
