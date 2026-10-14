import { BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector2, type BufferGeometry } from 'three';
import type { CharacterConfig } from '@/game/character/Character';
import { clamp } from '@/math/utils';
import { textures } from '@/render/ProceduralTextures';

export interface BuiltCharacter {
  group: Group;
  /** Körpergröße in m (Scheitel ohne Haar). */
  height: number;
  eyeHeight: number;
  setHelmet(on: boolean): void;
  /** Geh-/Idle-Animation: `dt` Sekunden, Geschwindigkeit m/s. */
  animate(dt: number, speed: number, grounded: boolean): void;
  dispose(): void;
}

/** Hautfarbe aus Ton (hell→dunkel) und Farbstich (rosa→gelb/oliv). */
export function skinColor(tone: number, hue: number): Color {
  const t = clamp(tone, 0, 1);
  const h = 0.045 + (clamp(hue, 0, 1) - 0.5) * 0.04;
  const l = 0.78 - t * 0.6;
  const s = 0.45 + t * 0.2;
  return new Color().setHSL(h, s, l);
}

/**
 * Parametrischer Charakter aus Primitiven: Beine, Torso, Arme, Kopf mit Gesicht, Frisur, Bart, Anzugmuster,
 * Abzeichen und Helm. Ursprung = Füße. Gelenke sind Gruppen, damit die Geh-Animation Gliedmaßen schwenkt.
 * Materialien sind physikalisch (Sheen für Stoff/Haut, Clearcoat für Hartteile, reflektierendes Visier) mit
 * prozeduralen Detailtexturen (Gewebe, Panels, Poren, Strähnen).
 */
export function buildCharacter(cfg: CharacterConfig): BuiltCharacter {
  const geos: BufferGeometry[] = [];
  const g = (geo: BufferGeometry): BufferGeometry => {
    geos.push(geo);
    return geo;
  };
  const skin = skinColor(cfg.face.skinTone, cfg.face.skinHue);
  const lipColor = skin.clone().offsetHSL(-0.02, 0.15, -0.12);
  const lidColor = skin.clone().offsetHSL(0, 0.05, -0.05);
  const suitTex = textures.get('suit');
  const fabricTex = textures.get('fabric');
  const skinTex = textures.get('skin');
  const hairTex = textures.get('hair');
  const chitinTex = textures.get('chitin');
  const primary = new Color(cfg.suit.primary);
  const secondary = new Color(cfg.suit.secondary);
  const hairColor = new Color(cfg.hair.color);
  const mats = {
    skin: new MeshPhysicalMaterial({ color: skin, map: skinTex.map, normalMap: skinTex.normalMap, normalScale: new Vector2(0.35, 0.35), roughnessMap: skinTex.roughnessMap, roughness: 0.6, sheen: 0.35, sheenColor: skin.clone().offsetHSL(0, 0.1, 0.15), sheenRoughness: 0.85 }),
    lips: new MeshPhysicalMaterial({ color: lipColor, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    lids: new MeshPhysicalMaterial({ color: lidColor, normalMap: skinTex.normalMap, normalScale: new Vector2(0.3, 0.3), roughness: 0.6 }),
    primary: new MeshPhysicalMaterial({ color: primary, map: suitTex.map, normalMap: suitTex.normalMap, normalScale: new Vector2(0.7, 0.7), roughnessMap: suitTex.roughnessMap, roughness: 0.65, metalness: 0.05, sheen: 0.5, sheenColor: primary.clone().offsetHSL(0, 0, 0.2), sheenRoughness: 0.6 }),
    secondary: new MeshPhysicalMaterial({ color: secondary, map: chitinTex.map, normalMap: chitinTex.normalMap, normalScale: new Vector2(0.45, 0.45), roughness: 0.4, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    fabric: new MeshPhysicalMaterial({ color: secondary.clone().offsetHSL(0, -0.1, -0.08), map: fabricTex.map, normalMap: fabricTex.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: fabricTex.roughnessMap, roughness: 0.8, sheen: 0.4, sheenColor: secondary, sheenRoughness: 0.7 }),
    accent: new MeshPhysicalMaterial({ color: cfg.suit.accent, emissive: cfg.suit.accent, emissiveIntensity: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    hair: new MeshPhysicalMaterial({ color: hairColor, map: hairTex.map, normalMap: hairTex.normalMap, normalScale: new Vector2(0.9, 0.9), roughnessMap: hairTex.roughnessMap, roughness: 0.55, sheen: 0.7, sheenColor: hairColor.clone().offsetHSL(0, 0, 0.25), sheenRoughness: 0.5 }),
    eye: new MeshPhysicalMaterial({ color: cfg.face.eyeColor, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    eyeWhite: new MeshPhysicalMaterial({ color: 0xf4f2ee, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    pupil: new MeshPhysicalMaterial({ color: 0x08090c, roughness: 0.1, clearcoat: 1 }),
    dark: new MeshPhysicalMaterial({ color: 0x1b1d22, map: chitinTex.map, normalMap: chitinTex.normalMap, normalScale: new Vector2(0.4, 0.4), roughness: 0.55, metalness: 0.2, clearcoat: 0.4 }),
    metal: new MeshPhysicalMaterial({ color: 0x9aa3ad, map: textures.get('metal').map, normalMap: textures.get('metal').normalMap, normalScale: new Vector2(0.4, 0.4), roughness: 0.35, metalness: 0.9 }),
    visor: new MeshPhysicalMaterial({ color: 0xb8dcff, transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false }),
    glow: new MeshPhysicalMaterial({ color: cfg.face.eyeColor, emissive: cfg.face.eyeColor, emissiveIntensity: 1.2 }),
  };

  const H = 1.55 + cfg.body.height * 0.35;
  const legLen = H * (0.44 + cfg.body.legLength * 0.08);
  const torsoH = H * 0.3;
  const torsoW = 0.3 + cfg.body.build * 0.16;
  const shoulderW = torsoW + 0.1 + cfg.body.shoulders * 0.14;
  const hr = 0.108 + (1 - cfg.body.build * 0.3) * 0.012;
  const armR = 0.045 + cfg.body.build * 0.03;
  const armLen = H * 0.3;

  const group = new Group();
  // Blickrichtung des Spielers ist −z: das Rig ist um 180° gedreht, das Gesicht liegt im Rig auf +z
  const rig = new Group();
  rig.rotation.y = Math.PI;
  group.add(rig);
  const addMesh = (geo: BufferGeometry, mat: MeshPhysicalMaterial, parent: Group, x = 0, y = 0, z = 0): Mesh => {
    const m = new Mesh(g(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // Beine mit Knieschonern und Stiefeln
  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new Group();
    hip.position.set(side * torsoW * 0.28, legLen, 0);
    const thigh = new CapsuleGeometry(armR * 1.25, legLen * 0.5, 6, 12);
    addMesh(thigh, mats.primary, hip, 0, -legLen * 0.3, 0);
    const shin = new CapsuleGeometry(armR * 1.05, legLen * 0.42, 6, 12);
    addMesh(shin, mats.primary, hip, 0, -legLen * 0.75, 0.01);
    const knee = new SphereGeometry(armR * 1.3, 12, 8, 0, Math.PI, 0, Math.PI);
    const kneeMesh = addMesh(knee, mats.secondary, hip, 0, -legLen * 0.52, 0.02);
    kneeMesh.rotation.y = -Math.PI / 2;
    kneeMesh.scale.set(1, 1.3, 1);
    const boot = new BoxGeometry(armR * 2.6, 0.12, armR * 2.2 + 0.1);
    addMesh(boot, mats.secondary, hip, 0, -legLen + 0.06, 0.03);
    const sole = new BoxGeometry(armR * 2.7, 0.025, armR * 2.3 + 0.11);
    addMesh(sole, mats.dark, hip, 0, -legLen + 0.012, 0.03);
    const cuff = new TorusGeometry(armR * 1.2, 0.012, 6, 16);
    const cuffMesh = addMesh(cuff, mats.dark, hip, 0, -legLen + 0.14, 0.01);
    cuffMesh.rotation.x = Math.PI / 2;
    rig.add(hip);
    legs.push(hip);
  }

  // Torso
  const torso = new Group();
  torso.position.y = legLen;
  const body = new CapsuleGeometry(torsoW * 0.5, torsoH * 0.55, 6, 18);
  const bodyMesh = addMesh(body, mats.primary, torso, 0, torsoH * 0.5, 0);
  bodyMesh.scale.set(1, 1, 0.72);
  // Brustplatte (leicht abgesetzt, Hartschale)
  const chest = new SphereGeometry(torsoW * 0.5 + 0.008, 18, 12, Math.PI * 0.55, Math.PI * 0.9, Math.PI * 0.25, Math.PI * 0.3);
  const chestMesh = addMesh(chest, mats.secondary, torso, 0, torsoH * 0.62, 0);
  chestMesh.scale.set(1, 1.1, 0.72);
  const belt = new TorusGeometry(torsoW * 0.5 + 0.01, 0.025, 8, 24);
  const beltMesh = addMesh(belt, mats.dark, torso, 0, torsoH * 0.12, 0);
  beltMesh.rotation.x = Math.PI / 2;
  beltMesh.scale.set(1, 0.72, 1);
  const buckle = new BoxGeometry(0.05, 0.035, 0.014);
  addMesh(buckle, mats.metal, torso, 0, torsoH * 0.12, torsoW * 0.37);
  // Brustlampe
  const lamp = new CylinderGeometry(0.012, 0.012, 0.01, 10);
  const lampMesh = addMesh(lamp, mats.accent, torso, -torsoW * 0.2, torsoH * 0.78, torsoW * 0.37);
  lampMesh.rotation.x = Math.PI / 2;
  // Rucksack mit Tanks
  const pack = new BoxGeometry(torsoW * 0.7, torsoH * 0.6, 0.09);
  addMesh(pack, mats.fabric, torso, 0, torsoH * 0.52, -torsoW * 0.36);
  for (const side of [-1, 1]) {
    const tank = new CylinderGeometry(0.03, 0.03, torsoH * 0.5, 12);
    addMesh(tank, mats.metal, torso, side * torsoW * 0.18, torsoH * 0.5, -torsoW * 0.36 - 0.07);
    const cap = new SphereGeometry(0.03, 10, 8);
    addMesh(cap, mats.metal, torso, side * torsoW * 0.18, torsoH * 0.75, -torsoW * 0.36 - 0.07);
    const strap = new BoxGeometry(0.035, torsoH * 0.55, 0.012);
    addMesh(strap, mats.dark, torso, side * torsoW * 0.26, torsoH * 0.6, torsoW * 0.33);
  }
  const packLight = new BoxGeometry(torsoW * 0.4, 0.01, 0.008);
  addMesh(packLight, mats.accent, torso, 0, torsoH * 0.3, -torsoW * 0.36 - 0.05);
  // Muster
  if (cfg.suit.pattern === 'stripes') {
    for (const y of [0.42, 0.62]) {
      const ring = new TorusGeometry(torsoW * 0.5 + 0.008, 0.016, 6, 24);
      const m = addMesh(ring, mats.secondary, torso, 0, torsoH * y, 0);
      m.rotation.x = Math.PI / 2;
      m.scale.set(1, 0.72, 1);
    }
  } else if (cfg.suit.pattern === 'chevron') {
    for (const side of [-1, 1]) {
      const bar = new BoxGeometry(torsoW * 0.3, 0.03, 0.012);
      const m = addMesh(bar, mats.accent, torso, side * torsoW * 0.14, torsoH * 0.7, torsoW * 0.36);
      m.rotation.z = side * 0.6;
    }
  } else if (cfg.suit.pattern === 'panels') {
    for (const side of [-1, 1]) {
      const pad = new BoxGeometry(0.11, 0.07, 0.16);
      addMesh(pad, mats.secondary, torso, side * (shoulderW * 0.5 - 0.01), torsoH * 0.95, 0);
    }
  } else if (cfg.suit.pattern === 'hex') {
    for (let i = 0; i < 3; i++) {
      const plate = new CylinderGeometry(0.03, 0.03, 0.01, 6);
      const m = addMesh(plate, mats.accent, torso, (i - 1) * 0.065, torsoH * (0.62 + (i % 2) * 0.08), torsoW * 0.36);
      m.rotation.x = Math.PI / 2;
    }
  }
  // Abzeichen (linke Brust)
  const bx = torsoW * 0.2;
  const by = torsoH * 0.78;
  const bz = torsoW * 0.36;
  if (cfg.suit.badge === 'archive') {
    const disc = new CylinderGeometry(0.03, 0.03, 0.01, 16);
    const m = addMesh(disc, mats.accent, torso, bx, by, bz);
    m.rotation.x = Math.PI / 2;
    const ring = new TorusGeometry(0.018, 0.005, 6, 16);
    addMesh(ring, mats.dark, torso, bx, by, bz + 0.006);
  } else if (cfg.suit.badge === 'star') {
    for (let i = 0; i < 5; i++) {
      const bar = new BoxGeometry(0.012, 0.05, 0.01);
      const m = addMesh(bar, mats.accent, torso, bx, by, bz);
      m.rotation.z = (i / 5) * Math.PI;
    }
  } else if (cfg.suit.badge === 'leaf') {
    const leaf = new SphereGeometry(0.03, 10, 6);
    const m = addMesh(leaf, mats.accent, torso, bx, by, bz);
    m.scale.set(0.6, 1, 0.3);
    m.rotation.z = 0.5;
  } else if (cfg.suit.badge === 'crystal') {
    const oct = new OctahedronGeometry(0.03, 0);
    const m = addMesh(oct, mats.accent, torso, bx, by, bz);
    m.scale.set(0.6, 1, 0.4);
  }
  rig.add(torso);

  // Arme mit Schulterkappen, Ellbogenschonern und Handschuhen
  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * shoulderW * 0.5, legLen + torsoH * 0.92, 0);
    const cap = new SphereGeometry(armR * 1.45, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    addMesh(cap, mats.secondary, shoulder, 0, 0.01, 0);
    const upper = new CapsuleGeometry(armR, armLen * 0.45, 6, 12);
    addMesh(upper, mats.fabric, shoulder, 0, -armLen * 0.28, 0);
    const elbow = new SphereGeometry(armR * 1.1, 10, 8);
    addMesh(elbow, mats.dark, shoulder, 0, -armLen * 0.5, -0.005);
    const lower = new CapsuleGeometry(armR * 0.9, armLen * 0.4, 6, 12);
    addMesh(lower, mats.primary, shoulder, 0, -armLen * 0.7, 0.01);
    const cuff = new TorusGeometry(armR * 1.05, 0.012, 6, 16);
    const cuffMesh = addMesh(cuff, mats.dark, shoulder, 0, -armLen * 0.9, 0.015);
    cuffMesh.rotation.x = Math.PI / 2;
    const hand = new SphereGeometry(armR * 1.1, 10, 8);
    const handMesh = addMesh(hand, mats.fabric, shoulder, 0, -armLen * 0.98, 0.02);
    handMesh.scale.set(0.85, 1.15, 0.7);
    shoulder.rotation.z = side * 0.08;
    rig.add(shoulder);
    arms.push(shoulder);
  }

  // Kopf
  const head = new Group();
  const neckY = legLen + torsoH + 0.03;
  head.position.y = neckY + hr;
  const neck = new CylinderGeometry(hr * 0.45, hr * 0.5, 0.08, 12);
  addMesh(neck, mats.skin, torso, 0, torsoH + 0.01, 0);
  const skull = new SphereGeometry(hr, 28, 20);
  const skullMesh = addMesh(skull, mats.skin, head, 0, 0, 0);
  skullMesh.scale.set(1, 1.02 + cfg.face.jaw * 0.1, 0.95);
  const jaw = new SphereGeometry(hr * 0.78, 20, 14);
  const jawMesh = addMesh(jaw, mats.skin, head, 0, -hr * 0.45, hr * 0.08);
  jawMesh.scale.set(0.9 + cfg.face.jaw * 0.25, 0.75 + cfg.face.jaw * 0.3, 0.9);
  // Ohren
  for (const side of [-1, 1]) {
    const ear = new SphereGeometry(hr * 0.22, 10, 8);
    const m = addMesh(ear, mats.skin, head, side * hr * 0.98, hr * 0.02, hr * 0.05);
    m.scale.set(0.45, 1, 0.7);
  }
  // Augen mit Lidern, Pupillen und Brauen
  const eyeR = 0.014 + cfg.face.eyeSize * 0.012;
  const eyeX = hr * (0.3 + cfg.face.eyeSpacing * 0.3);
  for (const side of [-1, 1]) {
    const white = new SphereGeometry(eyeR, 12, 10);
    addMesh(white, mats.eyeWhite, head, side * eyeX, hr * 0.12, hr * 0.86);
    const iris = new SphereGeometry(eyeR * 0.55, 10, 8);
    const irisMesh = addMesh(iris, cfg.face.markings === 'glow' ? mats.glow : mats.eye, head, side * eyeX, hr * 0.12, hr * 0.86 + eyeR * 0.82);
    irisMesh.scale.set(1, 1, 0.6);
    const pupil = new SphereGeometry(eyeR * 0.26, 8, 6);
    const pupilMesh = addMesh(pupil, mats.pupil, head, side * eyeX, hr * 0.12, hr * 0.86 + eyeR * 1.05);
    pupilMesh.scale.set(1, 1, 0.5);
    const lid = new SphereGeometry(eyeR * 1.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const lidMesh = addMesh(lid, mats.lids, head, side * eyeX, hr * 0.12 + eyeR * 0.1, hr * 0.86);
    lidMesh.rotation.x = -0.35;
    const brow = new CapsuleGeometry(0.006, eyeR * 2.2, 4, 8);
    const b = addMesh(brow, mats.hair, head, side * eyeX, hr * 0.12 + eyeR * 1.6, hr * 0.9);
    b.rotation.z = Math.PI / 2 + side * -0.18;
  }
  // Nase, Mund
  const nose = new ConeGeometry(hr * 0.13, hr * (0.25 + cfg.face.nose * 0.35), 10);
  const noseMesh = addMesh(nose, mats.skin, head, 0, -hr * 0.1, hr * 0.95);
  noseMesh.rotation.x = Math.PI / 2;
  const noseTip = new SphereGeometry(hr * 0.1, 10, 8);
  addMesh(noseTip, mats.skin, head, 0, -hr * 0.14, hr * (1.0 + cfg.face.nose * 0.3));
  const upperLip = new CapsuleGeometry(0.0045, hr * 0.42, 4, 8);
  const ul = addMesh(upperLip, mats.lips, head, 0, -hr * 0.43, hr * 0.86);
  ul.rotation.z = Math.PI / 2;
  const lowerLip = new CapsuleGeometry(0.006, hr * 0.36, 4, 8);
  const ll = addMesh(lowerLip, mats.lips, head, 0, -hr * 0.5, hr * 0.85);
  ll.rotation.z = Math.PI / 2;
  // Markierungen
  if (cfg.face.markings === 'freckles') {
    for (let i = 0; i < 8; i++) {
      const dot = new SphereGeometry(0.004, 5, 4);
      const side = i % 2 ? 1 : -1;
      addMesh(dot, mats.dark, head, side * hr * (0.3 + (i % 4) * 0.08), -hr * (0.12 + (i % 3) * 0.08), hr * 0.9);
    }
  } else if (cfg.face.markings === 'scar') {
    const scar = new BoxGeometry(0.006, hr * 0.5, 0.006);
    const m = addMesh(scar, mats.lips, head, hr * 0.45, 0, hr * 0.84);
    m.rotation.z = 0.3;
  } else if (cfg.face.markings === 'glow') {
    for (const side of [-1, 1]) {
      const vein = new BoxGeometry(0.006, hr * 0.7, 0.006);
      const m = addMesh(vein, mats.glow, head, side * hr * 0.6, -hr * 0.1, hr * 0.75);
      m.rotation.z = side * 0.4;
    }
  }
  // Frisur
  const style = cfg.hair.style;
  if (style !== 'bald') {
    const capPhi = style === 'buzz' ? Math.PI * 0.42 : Math.PI * 0.55;
    const cap = new SphereGeometry(hr * (style === 'buzz' ? 1.02 : 1.08), 24, 16, 0, Math.PI * 2, 0, capPhi);
    const capMesh = addMesh(cap, mats.hair, head, 0, hr * 0.02, -hr * 0.04);
    capMesh.scale.set(1, 1, 0.98);
    if (style === 'long') {
      const back = new CylinderGeometry(hr * 0.95, hr * 0.75, hr * 2.4, 18, 1, true);
      addMesh(back, mats.hair, head, 0, -hr * 0.9, -hr * 0.35);
    } else if (style === 'bob') {
      // vorn offen (Gesicht frei), Seiten und Hinterkopf bedeckt
      const skirt = new CylinderGeometry(hr * 1.1, hr * 1.05, hr * 1.3, 20, 1, true, Math.PI * 0.3, Math.PI * 1.4);
      addMesh(skirt, mats.hair, head, 0, -hr * 0.3, -hr * 0.05);
    } else if (style === 'bun') {
      const bun = new SphereGeometry(hr * 0.42, 12, 10);
      addMesh(bun, mats.hair, head, 0, hr * 0.7, -hr * 0.75);
    } else if (style === 'ponytail') {
      const tail = new CylinderGeometry(hr * 0.3, hr * 0.15, hr * 2.0, 12);
      const m = addMesh(tail, mats.hair, head, 0, -hr * 0.5, -hr * 1.1);
      m.rotation.x = -0.35;
    } else if (style === 'mohawk') {
      const crest = new BoxGeometry(hr * 0.25, hr * 0.6, hr * 1.5);
      addMesh(crest, mats.hair, head, 0, hr * 1.05, -hr * 0.1);
    }
  }
  // Bart
  if (cfg.hair.beard === 'stubble') {
    const st = new SphereGeometry(hr * 0.8, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    const m = addMesh(st, mats.dark, head, 0, -hr * 0.42, hr * 0.1);
    m.scale.set(0.95, 0.8, 0.95);
    m.material = new MeshPhysicalMaterial({ color: cfg.hair.color, transparent: true, opacity: 0.45, roughness: 1, normalMap: hairTex.normalMap, normalScale: new Vector2(0.6, 0.6) });
    (mats as Record<string, MeshPhysicalMaterial>).stubble = m.material as MeshPhysicalMaterial;
  } else if (cfg.hair.beard === 'full') {
    const beard = new SphereGeometry(hr * 0.86, 16, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    const m = addMesh(beard, mats.hair, head, 0, -hr * 0.4, hr * 0.12);
    m.scale.set(1, 1.1, 1);
  } else if (cfg.hair.beard === 'goatee') {
    const gt = new SphereGeometry(hr * 0.3, 12, 10);
    const m = addMesh(gt, mats.hair, head, 0, -hr * 0.78, hr * 0.62);
    m.scale.set(0.9, 1.1, 0.7);
  }
  // Helm (Visier + Kragen)
  const helmetGeo = new SphereGeometry(hr * 1.5, 28, 20);
  const helmet = addMesh(helmetGeo, mats.visor, head, 0, hr * 0.05, 0);
  helmet.castShadow = false;
  const collar = new TorusGeometry(hr * 0.9, 0.035, 10, 24);
  const collarMesh = addMesh(collar, mats.secondary, torso, 0, torsoH + 0.02, 0);
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.visible = false;
  rig.add(head);

  let phase = 0;
  const built: BuiltCharacter = {
    group,
    height: neckY + hr * 2,
    eyeHeight: neckY + hr * 1.12,
    setHelmet(on: boolean) {
      helmet.visible = on;
      collarMesh.visible = on;
    },
    animate(dt: number, speed: number, grounded: boolean) {
      const walk = clamp(speed / 4.5, 0, 1.6);
      phase += dt * (2.5 + speed * 1.7);
      const amp = grounded ? walk * 0.65 : 0.25;
      const s = Math.sin(phase);
      legs[0]!.rotation.x = s * amp;
      legs[1]!.rotation.x = -s * amp;
      arms[0]!.rotation.x = -s * amp * 0.7;
      arms[1]!.rotation.x = s * amp * 0.7;
      const idle = Math.sin(phase * 0.35) * 0.02;
      torso.scale.set(1, 1 + idle, 1);
      torso.rotation.y = s * amp * 0.08;
      head.rotation.y = -s * amp * 0.05;
    },
    dispose() {
      for (const geo of geos) geo.dispose();
      for (const m of Object.values(mats)) m.dispose();
      group.removeFromParent();
    },
  };
  built.setHelmet(cfg.suit.helmet === 'on');
  return built;
}
