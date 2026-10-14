import { BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, type BufferGeometry } from 'three';
import type { CharacterConfig } from '@/game/character/Character';
import { clamp } from '@/math/utils';

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
 */
export function buildCharacter(cfg: CharacterConfig): BuiltCharacter {
  const geos: BufferGeometry[] = [];
  const g = (geo: BufferGeometry): BufferGeometry => {
    geos.push(geo);
    return geo;
  };
  const mats = {
    skin: new MeshStandardMaterial({ color: skinColor(cfg.face.skinTone, cfg.face.skinHue), roughness: 0.75 }),
    primary: new MeshStandardMaterial({ color: cfg.suit.primary, roughness: 0.55, metalness: 0.15 }),
    secondary: new MeshStandardMaterial({ color: cfg.suit.secondary, roughness: 0.7, metalness: 0.2 }),
    accent: new MeshStandardMaterial({ color: cfg.suit.accent, emissive: cfg.suit.accent, emissiveIntensity: 0.35, roughness: 0.4 }),
    hair: new MeshStandardMaterial({ color: cfg.hair.color, roughness: 0.85 }),
    eye: new MeshStandardMaterial({ color: cfg.face.eyeColor, roughness: 0.2 }),
    eyeWhite: new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }),
    dark: new MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.8 }),
    visor: new MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    glow: new MeshStandardMaterial({ color: cfg.face.eyeColor, emissive: cfg.face.eyeColor, emissiveIntensity: 1.2 }),
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
  const addMesh = (geo: BufferGeometry, mat: MeshStandardMaterial, parent: Group, x = 0, y = 0, z = 0): Mesh => {
    const m = new Mesh(g(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // Beine
  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new Group();
    hip.position.set(side * torsoW * 0.28, legLen, 0);
    const thigh = new CapsuleGeometry(armR * 1.25, legLen * 0.5, 4, 8);
    addMesh(thigh, mats.primary, hip, 0, -legLen * 0.3, 0);
    const shin = new CapsuleGeometry(armR * 1.05, legLen * 0.42, 4, 8);
    addMesh(shin, mats.primary, hip, 0, -legLen * 0.75, 0.01);
    const boot = new BoxGeometry(armR * 2.6, 0.12, armR * 2.2 + 0.1);
    addMesh(boot, mats.secondary, hip, 0, -legLen + 0.06, 0.03);
    rig.add(hip);
    legs.push(hip);
  }

  // Torso
  const torso = new Group();
  torso.position.y = legLen;
  const body = new CapsuleGeometry(torsoW * 0.5, torsoH * 0.55, 4, 12);
  const bodyMesh = addMesh(body, mats.primary, torso, 0, torsoH * 0.5, 0);
  bodyMesh.scale.set(1, 1, 0.72);
  const belt = new TorusGeometry(torsoW * 0.5 + 0.01, 0.025, 6, 20);
  const beltMesh = addMesh(belt, mats.secondary, torso, 0, torsoH * 0.12, 0);
  beltMesh.rotation.x = Math.PI / 2;
  beltMesh.scale.set(1, 0.72, 1);
  // Muster
  if (cfg.suit.pattern === 'stripes') {
    for (const y of [0.42, 0.62]) {
      const ring = new TorusGeometry(torsoW * 0.5 + 0.008, 0.016, 6, 20);
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

  // Arme
  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * shoulderW * 0.5, legLen + torsoH * 0.92, 0);
    const upper = new CapsuleGeometry(armR, armLen * 0.45, 4, 8);
    addMesh(upper, mats.secondary, shoulder, 0, -armLen * 0.28, 0);
    const lower = new CapsuleGeometry(armR * 0.9, armLen * 0.4, 4, 8);
    addMesh(lower, mats.primary, shoulder, 0, -armLen * 0.7, 0.01);
    const hand = new SphereGeometry(armR * 1.1, 8, 6);
    addMesh(hand, mats.skin, shoulder, 0, -armLen * 0.98, 0.02);
    shoulder.rotation.z = side * 0.08;
    rig.add(shoulder);
    arms.push(shoulder);
  }

  // Kopf
  const head = new Group();
  const neckY = legLen + torsoH + 0.03;
  head.position.y = neckY + hr;
  const neck = new CylinderGeometry(hr * 0.45, hr * 0.5, 0.08, 10);
  addMesh(neck, mats.skin, torso, 0, torsoH + 0.01, 0);
  const skull = new SphereGeometry(hr, 20, 14);
  const skullMesh = addMesh(skull, mats.skin, head, 0, 0, 0);
  skullMesh.scale.set(1, 1.02 + cfg.face.jaw * 0.1, 0.95);
  const jaw = new SphereGeometry(hr * 0.78, 14, 10);
  const jawMesh = addMesh(jaw, mats.skin, head, 0, -hr * 0.45, hr * 0.08);
  jawMesh.scale.set(0.9 + cfg.face.jaw * 0.25, 0.75 + cfg.face.jaw * 0.3, 0.9);
  // Augen
  const eyeR = 0.014 + cfg.face.eyeSize * 0.012;
  const eyeX = hr * (0.3 + cfg.face.eyeSpacing * 0.3);
  for (const side of [-1, 1]) {
    const white = new SphereGeometry(eyeR, 10, 8);
    addMesh(white, mats.eyeWhite, head, side * eyeX, hr * 0.12, hr * 0.86);
    const iris = new SphereGeometry(eyeR * 0.55, 8, 6);
    addMesh(iris, cfg.face.markings === 'glow' ? mats.glow : mats.eye, head, side * eyeX, hr * 0.12, hr * 0.86 + eyeR * 0.6);
    const brow = new BoxGeometry(eyeR * 2.4, 0.008, 0.012);
    const b = addMesh(brow, mats.hair, head, side * eyeX, hr * 0.12 + eyeR * 1.5, hr * 0.9);
    b.rotation.z = side * -0.15;
  }
  // Nase, Mund
  const nose = new ConeGeometry(hr * 0.13, hr * (0.25 + cfg.face.nose * 0.35), 8);
  const noseMesh = addMesh(nose, mats.skin, head, 0, -hr * 0.1, hr * 0.95);
  noseMesh.rotation.x = Math.PI / 2;
  const mouth = new BoxGeometry(hr * 0.5, 0.008, 0.01);
  addMesh(mouth, mats.dark, head, 0, -hr * 0.45, hr * 0.84);
  // Markierungen
  if (cfg.face.markings === 'freckles') {
    for (let i = 0; i < 8; i++) {
      const dot = new SphereGeometry(0.004, 5, 4);
      const side = i % 2 ? 1 : -1;
      addMesh(dot, mats.dark, head, side * hr * (0.3 + (i % 4) * 0.08), -hr * (0.12 + (i % 3) * 0.08), hr * 0.9);
    }
  } else if (cfg.face.markings === 'scar') {
    const scar = new BoxGeometry(0.006, hr * 0.5, 0.006);
    const m = addMesh(scar, mats.dark, head, hr * 0.45, 0, hr * 0.84);
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
    const cap = new SphereGeometry(hr * (style === 'buzz' ? 1.02 : 1.08), 18, 12, 0, Math.PI * 2, 0, capPhi);
    const capMesh = addMesh(cap, mats.hair, head, 0, hr * 0.02, -hr * 0.04);
    capMesh.scale.set(1, 1, 0.98);
    if (style === 'long') {
      const back = new CylinderGeometry(hr * 0.95, hr * 0.75, hr * 2.4, 14, 1, true);
      addMesh(back, mats.hair, head, 0, -hr * 0.9, -hr * 0.35);
    } else if (style === 'bob') {
      // vorn offen (Gesicht frei), Seiten und Hinterkopf bedeckt
      const skirt = new CylinderGeometry(hr * 1.1, hr * 1.05, hr * 1.3, 16, 1, true, Math.PI * 0.3, Math.PI * 1.4);
      addMesh(skirt, mats.hair, head, 0, -hr * 0.3, -hr * 0.05);
    } else if (style === 'bun') {
      const bun = new SphereGeometry(hr * 0.42, 10, 8);
      addMesh(bun, mats.hair, head, 0, hr * 0.7, -hr * 0.75);
    } else if (style === 'ponytail') {
      const tail = new CylinderGeometry(hr * 0.3, hr * 0.15, hr * 2.0, 10);
      const m = addMesh(tail, mats.hair, head, 0, -hr * 0.5, -hr * 1.1);
      m.rotation.x = -0.35;
    } else if (style === 'mohawk') {
      const crest = new BoxGeometry(hr * 0.25, hr * 0.6, hr * 1.5);
      addMesh(crest, mats.hair, head, 0, hr * 1.05, -hr * 0.1);
    }
  }
  // Bart
  if (cfg.hair.beard === 'stubble') {
    const st = new SphereGeometry(hr * 0.8, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    const m = addMesh(st, mats.dark, head, 0, -hr * 0.42, hr * 0.1);
    m.scale.set(0.95, 0.8, 0.95);
    m.material = new MeshStandardMaterial({ color: cfg.hair.color, transparent: true, opacity: 0.45, roughness: 1 });
    (mats as Record<string, MeshStandardMaterial>).stubble = m.material as MeshStandardMaterial;
  } else if (cfg.hair.beard === 'full') {
    const beard = new SphereGeometry(hr * 0.86, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    const m = addMesh(beard, mats.hair, head, 0, -hr * 0.4, hr * 0.12);
    m.scale.set(1, 1.1, 1);
  } else if (cfg.hair.beard === 'goatee') {
    const gt = new SphereGeometry(hr * 0.3, 10, 8);
    const m = addMesh(gt, mats.hair, head, 0, -hr * 0.78, hr * 0.62);
    m.scale.set(0.9, 1.1, 0.7);
  }
  // Helm (Visier + Kragen)
  const helmetGeo = new SphereGeometry(hr * 1.5, 20, 14);
  const helmet = addMesh(helmetGeo, mats.visor, head, 0, hr * 0.05, 0);
  helmet.castShadow = false;
  const collar = new TorusGeometry(hr * 0.9, 0.035, 8, 20);
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
