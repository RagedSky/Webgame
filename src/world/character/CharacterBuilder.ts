import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector2, type BufferGeometry } from 'three';
import type { CharacterConfig } from '@/game/character/Character';
import { clamp } from '@/math/utils';
import { textures } from '@/render/ProceduralTextures';
import { addRim } from '@/render/stylize';
import { arc, blob, lathe, tube } from '../organic';

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
 * Parametrischer Charakter im Exo-Anzug: organisch geformte Gliedmaßen (Röhren), Rüstungsplatten an Brust, Rücken,
 * Schultern, Unterarmen und Schienbeinen, Versorgungsrucksack, Kopf mit Gesicht und Frisur sowie ein geschlossener
 * Helm mit Visier (ersetzt bei aktivem Helm den sichtbaren Kopf). Ursprung = Füße. Hüfte, Knie, Schulter und
 * Ellbogen sind Gelenkgruppen für die Geh-Animation. Materialien sind physikalisch mit prozeduralen Detailtexturen.
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
  const metalTex = textures.get('metal');
  const primary = new Color(cfg.suit.primary);
  const secondary = new Color(cfg.suit.secondary);
  const hairColor = new Color(cfg.hair.color);
  const mats = {
    skin: new MeshPhysicalMaterial({ color: skin, map: skinTex.map, normalMap: skinTex.normalMap, normalScale: new Vector2(0.35, 0.35), roughnessMap: skinTex.roughnessMap, roughness: 0.6, sheen: 0.35, sheenColor: skin.clone().offsetHSL(0, 0.1, 0.15), sheenRoughness: 0.85 }),
    lips: new MeshPhysicalMaterial({ color: lipColor, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    lids: new MeshPhysicalMaterial({ color: lidColor, normalMap: skinTex.normalMap, normalScale: new Vector2(0.3, 0.3), roughness: 0.6 }),
    /** Anzugstoff in der Primärfarbe. */
    primary: new MeshPhysicalMaterial({ color: primary, map: suitTex.map, normalMap: suitTex.normalMap, normalScale: new Vector2(0.7, 0.7), roughnessMap: suitTex.roughnessMap, roughness: 0.65, metalness: 0.05, sheen: 0.5, sheenColor: primary.clone().offsetHSL(0, 0, 0.2), sheenRoughness: 0.6 }),
    /** Hartschalen (Rüstung) in der Sekundärfarbe. */
    secondary: new MeshPhysicalMaterial({ color: secondary, map: chitinTex.map, normalMap: chitinTex.normalMap, normalScale: new Vector2(0.35, 0.35), roughness: 0.38, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    /** Helmschale in der Primärfarbe, lackiert. */
    shell: new MeshPhysicalMaterial({ color: primary.clone().offsetHSL(0, 0.04, 0.04), normalMap: metalTex.normalMap, normalScale: new Vector2(0.25, 0.25), roughness: 0.32, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.12 }),
    fabric: new MeshPhysicalMaterial({ color: secondary.clone().offsetHSL(0, -0.1, -0.08), map: fabricTex.map, normalMap: fabricTex.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: fabricTex.roughnessMap, roughness: 0.8, sheen: 0.4, sheenColor: secondary, sheenRoughness: 0.7 }),
    accent: new MeshPhysicalMaterial({ color: cfg.suit.accent, emissive: cfg.suit.accent, emissiveIntensity: 0.9, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    hair: new MeshPhysicalMaterial({ color: hairColor, map: hairTex.map, normalMap: hairTex.normalMap, normalScale: new Vector2(0.9, 0.9), roughnessMap: hairTex.roughnessMap, roughness: 0.55, sheen: 0.7, sheenColor: hairColor.clone().offsetHSL(0, 0, 0.25), sheenRoughness: 0.5 }),
    eye: new MeshPhysicalMaterial({ color: cfg.face.eyeColor, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    eyeWhite: new MeshPhysicalMaterial({ color: 0xf4f2ee, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    pupil: new MeshPhysicalMaterial({ color: 0x08090c, roughness: 0.1, clearcoat: 1 }),
    dark: new MeshPhysicalMaterial({ color: 0x1b1d22, map: chitinTex.map, normalMap: chitinTex.normalMap, normalScale: new Vector2(0.4, 0.4), roughness: 0.55, metalness: 0.2, clearcoat: 0.4 }),
    metal: new MeshPhysicalMaterial({ color: 0x9aa3ad, map: metalTex.map, normalMap: metalTex.normalMap, normalScale: new Vector2(0.4, 0.4), roughness: 0.35, metalness: 0.9 }),
    /** Dunkles, spiegelndes Visier mit leichtem Schimmer in der Akzentfarbe. */
    visor: new MeshPhysicalMaterial({ color: 0x0a0f1c, emissive: cfg.suit.accent, emissiveIntensity: 0.12, roughness: 0.06, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2 }),
    glow: new MeshPhysicalMaterial({ color: cfg.face.eyeColor, emissive: cfg.face.eyeColor, emissiveIntensity: 1.2 }),
  };
  for (const m of [mats.primary, mats.secondary, mats.shell, mats.fabric, mats.dark, mats.metal, mats.visor, mats.skin, mats.hair]) addRim(m, 0.6);

  // Proportionen: etwas größerer Kopf, breite Schultern, kräftige Unterarme und Stiefel
  const H = 1.55 + cfg.body.height * 0.35;
  const legLen = H * (0.44 + cfg.body.legLength * 0.08);
  const torsoH = H * 0.3;
  const torsoW = 0.3 + cfg.body.build * 0.16;
  const shoulderW = torsoW + 0.12 + cfg.body.shoulders * 0.14;
  const hr = 0.116 + (1 - cfg.body.build * 0.3) * 0.012;
  const armR = 0.048 + cfg.body.build * 0.03;
  const armLen = H * 0.31;
  const thighLen = legLen * 0.5;
  const shinLen = legLen * 0.5;
  /** Abflachung des Rumpfs in der Tiefe. */
  const DEPTH = 0.74;

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

  // ---------------------------------------------------------------------------
  // Beine: Oberschenkel (Stoff) mit Platte, Kniegelenk, Schienbein und Stiefel (Hartschale)
  const legs: Group[] = [];
  const knees: Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new Group();
    hip.position.set(side * torsoW * 0.27, legLen, 0);
    addMesh(
      tube(
        [
          { x: 0, y: armR * 0.6, z: 0, r: armR * 1.45 },
          { x: 0, y: -thighLen * 0.45, z: armR * 0.12, r: armR * 1.55 },
          { x: 0, y: -thighLen, z: 0, r: armR * 1.15 },
        ],
        12,
      ),
      mats.primary,
      hip,
    );
    // Oberschenkelplatte vorn/außen
    const thighPlate = lathe(
      [
        [armR * 1.5, -thighLen * 0.82],
        [armR * 1.72, -thighLen * 0.55],
        [armR * 1.74, -thighLen * 0.3],
        [armR * 1.56, -thighLen * 0.08],
      ],
      10,
      -1.0 + side * 0.22,
      2.0,
    );
    addMesh(thighPlate, mats.shell, hip);

    const knee = new Group();
    knee.position.set(0, -thighLen, 0);
    hip.add(knee);
    const kneeCap = blob(armR * 1.3, `knee${side}`, 0.08, 1.2, 1.05, 10, 8);
    const kc = addMesh(kneeCap, mats.secondary, knee, 0, 0, armR * 0.45);
    kc.scale.set(1, 1.15, 0.85);
    addMesh(
      tube(
        [
          { x: 0, y: armR * 0.3, z: 0, r: armR * 1.12 },
          { x: 0, y: -shinLen * 0.4, z: -armR * 0.15, r: armR * 1.28 },
          { x: 0, y: -shinLen * 0.7, z: 0, r: armR * 1.2 },
        ],
        12,
      ),
      mats.primary,
      knee,
    );
    // Stiefelschaft und Schienbeinschutz
    const shaft = lathe(
      [
        [armR * 1.3, -shinLen * 0.5],
        [armR * 1.62, -shinLen * 0.56],
        [armR * 1.56, -shinLen * 0.8],
        [armR * 1.7, -shinLen + armR * 1.5],
        [armR * 1.5, -shinLen + armR * 0.5],
      ],
      14,
    );
    addMesh(shaft, mats.secondary, knee);
    const shin = lathe(
      [
        [armR * 1.64, -shinLen * 0.78],
        [armR * 1.74, -shinLen * 0.5],
        [armR * 1.5, -shinLen * 0.14],
      ],
      8,
      -0.8,
      1.6,
    );
    addMesh(shin, mats.shell, knee);
    const foot = blob(armR * 1.75, `foot${side}`, 0.06, 1.1, 0.62, 10, 8);
    const fm = addMesh(foot, mats.secondary, knee, 0, -shinLen + armR * 1.05, armR * 1.25);
    fm.scale.set(1, 1, 1.7);
    const sole = blob(armR * 1.9, `sole${side}`, 0.03, 1, 0.16, 10, 6);
    const sm = addMesh(sole, mats.dark, knee, 0, -shinLen + armR * 0.32, armR * 1.2);
    sm.scale.set(1, 1, 1.75);
    const bootLight = addMesh(new BoxGeometry(armR * 0.5, armR * 0.5, armR * 0.2), mats.accent, knee, 0, -shinLen + armR * 2.4, armR * 1.68);
    bootLight.castShadow = false;
    rig.add(hip);
    legs.push(hip);
    knees.push(knee);
  }

  // ---------------------------------------------------------------------------
  // Rumpf: tailliertes Profil mit Brust- und Rückenplatte, Gürtel, Versorgungsrucksack
  const torso = new Group();
  torso.position.y = legLen;
  const body = lathe(
    [
      [torsoW * 0.3, -torsoH * 0.08],
      [torsoW * 0.46, 0],
      [torsoW * 0.43, torsoH * 0.2],
      [torsoW * 0.5, torsoH * 0.48],
      [torsoW * 0.56, torsoH * 0.72],
      [torsoW * 0.5, torsoH * 0.92],
      [hr * 0.6, torsoH * 1.02],
    ],
    20,
  );
  addMesh(body, mats.primary, torso).scale.set(1, 1, DEPTH);
  const chest = lathe(
    [
      [torsoW * 0.53, torsoH * 0.42],
      [torsoW * 0.615, torsoH * 0.6],
      [torsoW * 0.62, torsoH * 0.8],
      [torsoW * 0.53, torsoH * 0.95],
    ],
    12,
    -1.08,
    2.16,
  );
  addMesh(chest, mats.shell, torso).scale.set(1, 1, DEPTH);
  const back = lathe(
    [
      [torsoW * 0.5, torsoH * 0.3],
      [torsoW * 0.6, torsoH * 0.55],
      [torsoW * 0.6, torsoH * 0.82],
      [torsoW * 0.52, torsoH * 0.95],
    ],
    10,
    Math.PI - 0.95,
    1.9,
  );
  addMesh(back, mats.shell, torso).scale.set(1, 1, DEPTH);
  // Bauchsegmente (flexibler Bereich)
  for (const y of [0.24, 0.33]) {
    const seg = new TorusGeometry(torsoW * 0.46, 0.012, 6, 24);
    const sm = addMesh(seg, mats.dark, torso, 0, torsoH * y, 0);
    sm.rotation.x = Math.PI / 2;
    sm.scale.set(1, DEPTH, 1);
  }
  const belt = new TorusGeometry(torsoW * 0.47, 0.028, 8, 24);
  const beltMesh = addMesh(belt, mats.dark, torso, 0, torsoH * 0.1, 0);
  beltMesh.rotation.x = Math.PI / 2;
  beltMesh.scale.set(1, DEPTH, 1);
  addMesh(new BoxGeometry(0.055, 0.04, 0.016), mats.metal, torso, 0, torsoH * 0.1, torsoW * 0.47 * DEPTH + 0.012);
  for (const side of [-1, 1]) {
    const pouch = blob(0.045, `pouch${side}`, 0.08, 1.2, 1.1, 8, 6);
    addMesh(pouch, mats.fabric, torso, side * torsoW * 0.42, torsoH * 0.07, torsoW * 0.16).scale.set(0.7, 1, 0.9);
  }
  const plateZ = torsoW * 0.62 * DEPTH;
  // Brustlampe (Statusanzeige)
  const lamp = addMesh(new CylinderGeometry(0.016, 0.016, 0.012, 12), mats.accent, torso, -torsoW * 0.2, torsoH * 0.8, plateZ - 0.012);
  lamp.rotation.x = Math.PI / 2;
  lamp.castShadow = false;

  // Rucksack: Hauptkörper, zwei Kanister, Leuchtstreifen, Antenne
  const packZ = -torsoW * 0.6 * DEPTH - 0.055;
  const pack = blob(torsoW * 0.36, 'pack', 0.05, 1.1, 1.3, 12, 10);
  addMesh(pack, mats.secondary, torso, 0, torsoH * 0.6, packZ).scale.set(1.08, 1, 0.52);
  const packTop = blob(torsoW * 0.22, 'packtop', 0.05, 1.1, 0.8, 10, 8);
  addMesh(packTop, mats.shell, torso, 0, torsoH * 0.98, packZ + 0.01).scale.set(1.2, 1, 0.6);
  for (const side of [-1, 1]) {
    const cx = side * torsoW * 0.36;
    addMesh(
      tube(
        [
          { x: cx, y: torsoH * 0.22, z: packZ - 0.02, r: 0.034 },
          { x: cx, y: torsoH * 0.55, z: packZ - 0.03, r: 0.038 },
          { x: cx, y: torsoH * 0.86, z: packZ - 0.02, r: 0.034 },
        ],
        10,
      ),
      mats.metal,
      torso,
    );
    const strap = addMesh(new BoxGeometry(0.036, torsoH * 0.5, 0.012), mats.dark, torso, side * torsoW * 0.3, torsoH * 0.7, plateZ * 0.9);
    strap.rotation.x = -0.1;
    const strip = addMesh(new BoxGeometry(0.012, torsoH * 0.34, 0.01), mats.accent, torso, side * torsoW * 0.16, torsoH * 0.6, packZ - torsoW * 0.19);
    strip.castShadow = false;
  }
  addMesh(tube(arc([torsoW * 0.26, torsoH * 0.98, packZ], [torsoW * 0.3, torsoH * 1.5, packZ - 0.02], [0.01, 0, 0], 0.008, 0.005, 4), 5), mats.dark, torso);
  const antTip = addMesh(new SphereGeometry(0.014, 8, 6), mats.accent, torso, torsoW * 0.3, torsoH * 1.5, packZ - 0.02);
  antTip.castShadow = false;

  // Muster
  if (cfg.suit.pattern === 'stripes') {
    for (const y of [0.42, 0.52]) {
      const ring = new TorusGeometry(torsoW * 0.51, 0.014, 6, 24);
      const m = addMesh(ring, mats.accent, torso, 0, torsoH * y, 0);
      m.rotation.x = Math.PI / 2;
      m.scale.set(1, DEPTH, 1);
      m.castShadow = false;
    }
  } else if (cfg.suit.pattern === 'chevron') {
    for (const side of [-1, 1]) {
      const bar = new BoxGeometry(torsoW * 0.3, 0.03, 0.012);
      const m = addMesh(bar, mats.accent, torso, side * torsoW * 0.14, torsoH * 0.66, plateZ);
      m.rotation.z = side * 0.6;
      m.castShadow = false;
    }
  } else if (cfg.suit.pattern === 'panels') {
    for (const side of [-1, 1]) {
      const pad = blob(0.07, `panel${side}`, 0.05, 1.2, 0.5, 8, 6);
      addMesh(pad, mats.shell, torso, side * torsoW * 0.26, torsoH * 0.56, plateZ * 0.93).scale.set(1.1, 1.4, 0.5);
    }
  } else if (cfg.suit.pattern === 'hex') {
    for (let i = 0; i < 3; i++) {
      const plate = new CylinderGeometry(0.03, 0.03, 0.01, 6);
      const m = addMesh(plate, mats.accent, torso, (i - 1) * 0.065, torsoH * (0.6 + (i % 2) * 0.08), plateZ);
      m.rotation.x = Math.PI / 2;
      m.castShadow = false;
    }
  }
  // Abzeichen (linke Brust)
  const bx = torsoW * 0.2;
  const by = torsoH * 0.8;
  const bz = plateZ - 0.008;
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

  // ---------------------------------------------------------------------------
  // Arme: Schulterpanzer, Oberarm (Stoff), Ellbogengelenk, Unterarmschiene, Handschuh
  const arms: Group[] = [];
  const elbows: Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * shoulderW * 0.5, legLen + torsoH * 0.9, 0);
    const pauldron = lathe(
      [
        [armR * 1.95, -armR * 1.0],
        [armR * 2.1, -armR * 0.2],
        [armR * 1.7, armR * 0.75],
        [armR * 0.85, armR * 1.3],
        [0, armR * 1.45],
      ],
      12,
    );
    const pm = addMesh(pauldron, mats.shell, shoulder, side * armR * 0.25, armR * 0.1, 0);
    // Zierkante am Schulterpanzer
    const trim = new TorusGeometry(armR * 2.02, 0.012, 6, 20);
    const tm = addMesh(trim, mats.secondary, shoulder, side * armR * 0.38, -armR * 0.72, 0);
    tm.rotation.x = Math.PI / 2;
    tm.rotation.y = side * -0.4;
    tm.scale.set(1, 1.05, 1);
    pm.rotation.z = side * -0.4;
    pm.scale.set(1, 1, 1.05);
    addMesh(
      tube(
        [
          { x: 0, y: armR * 0.4, z: 0, r: armR * 1.2 },
          { x: 0, y: -armLen * 0.25, z: 0, r: armR * 1.28 },
          { x: 0, y: -armLen * 0.5, z: 0, r: armR * 1.0 },
        ],
        10,
      ),
      mats.fabric,
      shoulder,
    );
    const elbow = new Group();
    elbow.position.set(0, -armLen * 0.5, 0);
    shoulder.add(elbow);
    addMesh(blob(armR * 1.12, `elbow${side}`, 0.06, 1.2, 1, 8, 6), mats.dark, elbow, 0, 0, -armR * 0.15);
    // Unterarmschiene: zum Handgelenk hin kräftiger
    addMesh(
      tube(
        [
          { x: 0, y: armR * 0.2, z: 0, r: armR * 1.0 },
          { x: 0, y: -armLen * 0.2, z: armR * 0.1, r: armR * 1.42 },
          { x: 0, y: -armLen * 0.4, z: armR * 0.15, r: armR * 1.3 },
          { x: 0, y: -armLen * 0.44, z: armR * 0.15, r: armR * 1.05 },
        ],
        12,
      ),
      mats.secondary,
      elbow,
    );
    const wrist = new TorusGeometry(armR * 1.18, 0.011, 6, 16);
    const wm = addMesh(wrist, mats.accent, elbow, 0, -armLen * 0.4, armR * 0.15);
    wm.rotation.x = Math.PI / 2;
    wm.castShadow = false;
    const hand = blob(armR * 1.3, `hand${side}`, 0.06, 1.2, 1.2, 10, 8);
    addMesh(hand, mats.dark, elbow, 0, -armLen * 0.52, armR * 0.25).scale.set(0.88, 1, 0.72);
    const thumb = blob(armR * 0.5, `thumb${side}`, 0.05, 1.2, 1.4, 6, 5);
    addMesh(thumb, mats.dark, elbow, -side * armR * 0.95, -armLen * 0.5, armR * 0.55);
    shoulder.rotation.z = side * 0.1;
    elbow.rotation.x = -0.18;
    rig.add(shoulder);
    arms.push(shoulder);
    elbows.push(elbow);
  }

  // ---------------------------------------------------------------------------
  // Kopf: Gesicht und Frisur (ohne Helm sichtbar) und geschlossener Helm
  const head = new Group();
  const neckY = legLen + torsoH + 0.03;
  head.position.y = neckY + hr;
  const face = new Group();
  head.add(face);
  const neck = new CylinderGeometry(hr * 0.45, hr * 0.5, 0.09, 12);
  const neckMesh = addMesh(neck, mats.skin, torso, 0, torsoH + 0.02, 0);
  const skull = new SphereGeometry(hr, 28, 20);
  const skullMesh = addMesh(skull, mats.skin, face, 0, 0, 0);
  skullMesh.scale.set(1, 1.02 + cfg.face.jaw * 0.1, 0.95);
  const jaw = new SphereGeometry(hr * 0.78, 20, 14);
  const jawMesh = addMesh(jaw, mats.skin, face, 0, -hr * 0.45, hr * 0.08);
  jawMesh.scale.set(0.9 + cfg.face.jaw * 0.25, 0.75 + cfg.face.jaw * 0.3, 0.9);
  for (const side of [-1, 1]) {
    const ear = new SphereGeometry(hr * 0.22, 10, 8);
    const m = addMesh(ear, mats.skin, face, side * hr * 0.98, hr * 0.02, hr * 0.05);
    m.scale.set(0.45, 1, 0.7);
  }
  // Augen mit Lidern, Pupillen und Brauen
  const eyeR = 0.014 + cfg.face.eyeSize * 0.012;
  const eyeX = hr * (0.3 + cfg.face.eyeSpacing * 0.3);
  for (const side of [-1, 1]) {
    const white = new SphereGeometry(eyeR, 12, 10);
    addMesh(white, mats.eyeWhite, face, side * eyeX, hr * 0.12, hr * 0.86);
    const iris = new SphereGeometry(eyeR * 0.55, 10, 8);
    const irisMesh = addMesh(iris, cfg.face.markings === 'glow' ? mats.glow : mats.eye, face, side * eyeX, hr * 0.12, hr * 0.86 + eyeR * 0.82);
    irisMesh.scale.set(1, 1, 0.6);
    const pupil = new SphereGeometry(eyeR * 0.26, 8, 6);
    const pupilMesh = addMesh(pupil, mats.pupil, face, side * eyeX, hr * 0.12, hr * 0.86 + eyeR * 1.05);
    pupilMesh.scale.set(1, 1, 0.5);
    const lid = new SphereGeometry(eyeR * 1.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const lidMesh = addMesh(lid, mats.lids, face, side * eyeX, hr * 0.12 + eyeR * 0.1, hr * 0.86);
    lidMesh.rotation.x = -0.35;
    const brow = tube(arc([-eyeR * 1.2, 0, 0], [eyeR * 1.2, 0, 0], [0, eyeR * 0.25, 0], 0.006, 0.005, 3), 5);
    const b = addMesh(brow, mats.hair, face, side * eyeX, hr * 0.12 + eyeR * 1.6, hr * 0.9);
    b.rotation.z = side * -0.18;
  }
  // Nase, Mund
  const nose = blob(hr * 0.13, 'nose', 0.04, 1, 1, 8, 6);
  const noseMesh = addMesh(nose, mats.skin, face, 0, -hr * 0.08, hr * (0.98 + cfg.face.nose * 0.12));
  noseMesh.scale.set(0.9, 1.3, 0.9 + cfg.face.nose * 1.4);
  addMesh(tube(arc([-hr * 0.21, 0, 0], [hr * 0.21, 0, 0], [0, hr * 0.02, hr * 0.03], 0.0045, 0.0045, 4), 5), mats.lips, face, 0, -hr * 0.43, hr * 0.86);
  addMesh(tube(arc([-hr * 0.18, 0, 0], [hr * 0.18, 0, 0], [0, -hr * 0.03, hr * 0.03], 0.006, 0.006, 4), 5), mats.lips, face, 0, -hr * 0.5, hr * 0.85);
  // Markierungen
  if (cfg.face.markings === 'freckles') {
    for (let i = 0; i < 8; i++) {
      const dot = new SphereGeometry(0.004, 5, 4);
      const side = i % 2 ? 1 : -1;
      addMesh(dot, mats.dark, face, side * hr * (0.3 + (i % 4) * 0.08), -hr * (0.12 + (i % 3) * 0.08), hr * 0.9);
    }
  } else if (cfg.face.markings === 'scar') {
    const scar = new BoxGeometry(0.006, hr * 0.5, 0.006);
    const m = addMesh(scar, mats.lips, face, hr * 0.45, 0, hr * 0.84);
    m.rotation.z = 0.3;
  } else if (cfg.face.markings === 'glow') {
    for (const side of [-1, 1]) {
      const vein = new BoxGeometry(0.006, hr * 0.7, 0.006);
      const m = addMesh(vein, mats.glow, face, side * hr * 0.6, -hr * 0.1, hr * 0.75);
      m.rotation.z = side * 0.4;
    }
  }
  // Frisur
  const style = cfg.hair.style;
  if (style !== 'bald') {
    const capPhi = style === 'buzz' ? Math.PI * 0.42 : Math.PI * 0.55;
    const cap = new SphereGeometry(hr * (style === 'buzz' ? 1.02 : 1.08), 24, 16, 0, Math.PI * 2, 0, capPhi);
    const capMesh = addMesh(cap, mats.hair, face, 0, hr * 0.02, -hr * 0.04);
    capMesh.scale.set(1, 1, 0.98);
    if (style === 'long') {
      const back = new CylinderGeometry(hr * 0.95, hr * 0.75, hr * 2.4, 18, 1, true);
      addMesh(back, mats.hair, face, 0, -hr * 0.9, -hr * 0.35);
    } else if (style === 'bob') {
      // vorn offen (Gesicht frei), Seiten und Hinterkopf bedeckt
      const skirt = new CylinderGeometry(hr * 1.1, hr * 1.05, hr * 1.3, 20, 1, true, Math.PI * 0.3, Math.PI * 1.4);
      addMesh(skirt, mats.hair, face, 0, -hr * 0.3, -hr * 0.05);
    } else if (style === 'bun') {
      addMesh(blob(hr * 0.42, 'bun', 0.08, 1.3, 1, 10, 8), mats.hair, face, 0, hr * 0.7, -hr * 0.75);
    } else if (style === 'ponytail') {
      addMesh(tube(arc([0, hr * 0.5, -hr * 0.9], [0, -hr * 1.3, -hr * 1.35], [0, 0, -hr * 0.35], hr * 0.3, hr * 0.1, 5), 8), mats.hair, face);
    } else if (style === 'mohawk') {
      addMesh(tube(arc([0, hr * 0.75, hr * 0.75], [0, hr * 0.55, -hr * 0.95], [0, hr * 0.75, 0], hr * 0.14, hr * 0.12, 6), 6), mats.hair, face).scale.set(0.7, 1, 1);
    }
  }
  // Bart
  if (cfg.hair.beard === 'stubble') {
    const st = new SphereGeometry(hr * 0.8, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    const m = addMesh(st, mats.dark, face, 0, -hr * 0.42, hr * 0.1);
    m.scale.set(0.95, 0.8, 0.95);
    m.material = new MeshPhysicalMaterial({ color: cfg.hair.color, transparent: true, opacity: 0.45, roughness: 1, normalMap: hairTex.normalMap, normalScale: new Vector2(0.6, 0.6) });
    (mats as Record<string, MeshPhysicalMaterial>).stubble = m.material as MeshPhysicalMaterial;
  } else if (cfg.hair.beard === 'full') {
    const beard = new SphereGeometry(hr * 0.86, 16, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    const m = addMesh(beard, mats.hair, face, 0, -hr * 0.4, hr * 0.12);
    m.scale.set(1, 1.1, 1);
  } else if (cfg.hair.beard === 'goatee') {
    const m = addMesh(blob(hr * 0.3, 'goatee', 0.08, 1.3, 1.1, 8, 6), mats.hair, face, 0, -hr * 0.78, hr * 0.62);
    m.scale.set(0.9, 1, 0.7);
  }

  // Helm: Schale, Visier, Rahmen, Seitenmodule, Atemeinheit, Kamm, Lampen, Schläuche
  const helmet = new Group();
  head.add(helmet);
  const HZ = hr * 0.06;
  const shell = lathe(
    [
      [hr * 0.9, -hr * 1.14],
      [hr * 1.26, -hr * 0.92],
      [hr * 1.5, -hr * 0.36],
      [hr * 1.56, hr * 0.24],
      [hr * 1.42, hr * 0.86],
      [hr * 1.02, hr * 1.36],
      [hr * 0.5, hr * 1.57],
      [0, hr * 1.62],
    ],
    36,
  );
  addMesh(shell, mats.shell, helmet, 0, 0, HZ).scale.set(1, 1, 1.07);
  // Visier: 14 Segmente à 10° – die Kanten liegen deckungsgleich auf der Teilung der Schale (keine Zackenränder)
  const VISOR_HALF = (Math.PI / 18) * 7;
  const visor = lathe(
    [
      [hr * 1.33, -hr * 0.78],
      [hr * 1.56, -hr * 0.36],
      [hr * 1.62, hr * 0.22],
      [hr * 1.51, hr * 0.74],
      [hr * 1.33, hr * 1.0],
    ],
    14,
    -VISOR_HALF,
    VISOR_HALF * 2,
  );
  const visorMesh = addMesh(visor, mats.visor, helmet, 0, 0, HZ);
  visorMesh.scale.set(1, 1, 1.075);
  visorMesh.castShadow = false;
  // Rahmen ober- und unterhalb des Visiers
  const frameTop = lathe(
    [
      [hr * 1.3, hr * 0.92],
      [hr * 1.42, hr * 1.03],
      [hr * 1.27, hr * 1.16],
    ],
    16,
    -VISOR_HALF - Math.PI / 18,
    VISOR_HALF * 2 + Math.PI / 9,
  );
  addMesh(frameTop, mats.secondary, helmet, 0, 0, HZ).scale.set(1, 1, 1.08);
  const frameBottom = lathe(
    [
      [hr * 1.2, -hr * 0.94],
      [hr * 1.38, -hr * 0.83],
      [hr * 1.36, -hr * 0.7],
    ],
    16,
    -VISOR_HALF - Math.PI / 18,
    VISOR_HALF * 2 + Math.PI / 9,
  );
  // Seitliche Rahmenholme decken die senkrechten Visierkanten ab
  for (const side of [-1, 1]) {
    const a = side * VISOR_HALF;
    const post = tube(
      [
        { x: Math.sin(a) * hr * 1.31, y: -hr * 0.84, z: Math.cos(a) * hr * 1.31 * 1.075, r: hr * 0.07 },
        { x: Math.sin(a) * hr * 1.58, y: -hr * 0.36, z: Math.cos(a) * hr * 1.58 * 1.075, r: hr * 0.07 },
        { x: Math.sin(a) * hr * 1.64, y: hr * 0.22, z: Math.cos(a) * hr * 1.64 * 1.075, r: hr * 0.07 },
        { x: Math.sin(a) * hr * 1.53, y: hr * 0.74, z: Math.cos(a) * hr * 1.53 * 1.075, r: hr * 0.07 },
        { x: Math.sin(a) * hr * 1.33, y: hr * 1.04, z: Math.cos(a) * hr * 1.33 * 1.075, r: hr * 0.07 },
      ],
      6,
    );
    addMesh(post, mats.secondary, helmet, 0, 0, HZ);
  }
  addMesh(frameBottom, mats.secondary, helmet, 0, 0, HZ).scale.set(1, 1, 1.08);
  // Seitenmodule (Funk/Filter) mit Leuchtpunkt
  for (const side of [-1, 1]) {
    const pod = lathe(
      [
        [hr * 0.44, 0],
        [hr * 0.48, hr * 0.1],
        [hr * 0.36, hr * 0.24],
        [0, hr * 0.27],
      ],
      12,
    );
    const pm = addMesh(pod, mats.secondary, helmet, side * hr * 1.47, -hr * 0.08, HZ);
    pm.rotation.z = side * -Math.PI / 2;
    const dot = addMesh(new SphereGeometry(hr * 0.09, 8, 6), mats.accent, helmet, side * hr * 1.75, -hr * 0.08, HZ);
    dot.castShadow = false;
    // Stirnlampen
    const lampPod = addMesh(new SphereGeometry(hr * 0.11, 8, 6), mats.accent, helmet, side * hr * 0.98, hr * 1.08, HZ + hr * 0.92);
    lampPod.castShadow = false;
    // Schläuche zum Rucksack
    addMesh(tube(arc([side * hr * 0.95, -hr * 0.95, -hr * 0.55], [side * hr * 0.75, -hr * 2.0, -hr * 1.75], [side * hr * 0.25, 0, -hr * 0.45], hr * 0.085, hr * 0.085, 6), 6), mats.dark, helmet);
  }
  // Atemeinheit am Kinn
  const chin = blob(hr * 0.5, 'chin', 0.05, 1.1, 0.56, 10, 8);
  addMesh(chin, mats.secondary, helmet, 0, -hr * 0.98, HZ + hr * 1.02).scale.set(1.25, 1, 0.8);
  for (const side of [-1, 1]) {
    const intake = new CylinderGeometry(hr * 0.09, hr * 0.09, hr * 0.12, 10);
    const im = addMesh(intake, mats.dark, helmet, side * hr * 0.3, -hr * 1.0, HZ + hr * 1.38);
    im.rotation.x = Math.PI / 2;
  }
  // Kamm über den Scheitel und Antenne
  addMesh(tube(arc([0, hr * 1.12, HZ + hr * 1.12], [0, hr * 0.9, HZ - hr * 1.38], [0, hr * 0.62, 0], hr * 0.1, hr * 0.1, 7), 6), mats.secondary, helmet).scale.set(1.5, 1, 1);
  addMesh(tube(arc([hr * 1.45, hr * 0.1, HZ - hr * 0.2], [hr * 1.6, hr * 1.9, HZ - hr * 0.35], [hr * 0.08, 0, 0], hr * 0.04, hr * 0.025, 4), 5), mats.dark, helmet);
  const helmTip = addMesh(new SphereGeometry(hr * 0.07, 8, 6), mats.accent, helmet, hr * 1.6, hr * 1.9, HZ - hr * 0.35);
  helmTip.castShadow = false;
  // Halsring (Helmdichtung)
  const collar = new TorusGeometry(hr * 0.95, 0.034, 10, 24);
  const collarMesh = addMesh(collar, mats.secondary, torso, 0, torsoH + 0.03, 0);
  collarMesh.rotation.x = Math.PI / 2;
  rig.add(head);

  let phase = 0;
  const built: BuiltCharacter = {
    group,
    height: neckY + hr * 2,
    eyeHeight: neckY + hr * 1.12,
    setHelmet(on: boolean) {
      helmet.visible = on;
      collarMesh.visible = on;
      face.visible = !on;
      neckMesh.visible = !on;
    },
    animate(dt: number, speed: number, grounded: boolean) {
      const walk = clamp(speed / 4.5, 0, 1.6);
      phase += dt * (2.5 + speed * 1.7);
      const amp = grounded ? walk * 0.65 : 0.25;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      for (let i = 0; i < 2; i++) {
        const dir = i === 0 ? 1 : -1;
        (legs[i] as Group).rotation.x = dir * s * amp;
        // Knie beugt, während das Bein nach hinten schwingt und wieder vorgeholt wird
        (knees[i] as Group).rotation.x = Math.max(0, dir * c) * amp * 1.15 + (grounded ? 0 : 0.35);
        (arms[i] as Group).rotation.x = -dir * s * amp * 0.7;
        (elbows[i] as Group).rotation.x = -0.18 - Math.max(0, -dir * s) * amp * 0.7 - walk * 0.12;
      }
      const idle = Math.sin(phase * 0.35) * 0.02;
      torso.scale.set(1, 1 + idle, 1);
      torso.rotation.y = s * amp * 0.08;
      torso.rotation.x = walk * 0.05;
      head.rotation.y = -s * amp * 0.05;
      rig.position.y = grounded ? Math.abs(c) * 0.025 * walk : 0;
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
