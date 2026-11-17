/**
 * Käfig des Charakterkörpers (rein, ohne Three.js): ein einziges geschlossenes Quad-Netz für Rumpf, Beine, Arme,
 * Hände, Stiefel und Helm. Der Aufbau folgt der klassischen Topologie für Figuren:
 *
 * - Rumpf: Ringe mit 8 Punkten von der Hüfte bis zum Helm, oben mit einem Quad-Deckel geschlossen.
 * - Beine: der unterste Rumpfring teilt sich über einen Schrittpunkt in zwei Schleifen mit 6 Punkten („Hosenschnitt“).
 * - Arme: je zwei Seitenflächen des Brustkorbs bleiben offen, ihre Randschleife (6 Punkte) wird zum Arm ausgezogen.
 * - Rüstungsteile entstehen aus eng gesetzten Schleifen (Kragen, Gürtel, Schulterkappen, Knieschützer, Stulpen, Stiefel),
 *   der Daumen als Auszug einer Handfläche. Es gibt keine aufgesetzten oder sich durchdringenden Teile.
 *
 * Jede Fläche trägt eine Materialzone, jeder Punkt Knochengewichte. Die Unterteilung (`QuadMesh.subdivide`) macht daraus
 * das fertige Netz. Die Figur schaut nach +z, links ist +x, Ursprung zwischen den Füßen.
 */
import { clamp, lerp } from '@/math/utils';
import type { CharacterConfig, HelmetShape, SuitPattern, VisorStyle } from '@/game/character/Character';
import { orient, subdivide, type QuadMesh } from './QuadMesh';

export const BONES = ['hips', 'spine', 'chest', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as const;
export type BoneName = (typeof BONES)[number];
/** Elternknochen je Knochen (−1 = Wurzel). */
export const BONE_PARENTS = [-1, 0, 1, 2, 2, 4, 5, 2, 7, 8, 0, 10, 11, 0, 13, 14] as const;

const B = { hips: 0, spine: 1, chest: 2, head: 3, upperArm: 4, forearm: 5, hand: 6, thigh: 10, shin: 11, foot: 12 } as const;
/** Knochenindex für eine Seite (+1 links, −1 rechts). */
const sideBone = (bone: number, side: number): number => (side > 0 ? bone : bone + 3);

/** Materialzonen: Stoff und Schale je in Primär- und Sekundärfarbe, Gelenkgummi, Leuchtband, Visier. */
export const ZONE = { FABRIC: 0, FABRIC2: 1, SHELL: 2, SHELL2: 3, JOINT: 4, ACCENT: 5, VISOR: 6 } as const;


export interface BodySpec {
  /** Regler 0..1. */
  height: number;
  build: number;
  shoulders: number;
  legLength: number;
  /** Stärke der Rüstungsteile 0..1. */
  armor: number;
  helmet: HelmetShape;
  visor: VisorStyle;
  pattern: SuitPattern;
}

export interface BodyCage {
  mesh: QuadMesh;
  /** Gelenkpositionen in Bindehaltung (Reihenfolge wie `BONES`). */
  joints: Array<[number, number, number]>;
  /** Nennhöhe bis zum Helmscheitel. */
  height: number;
  helmetCenter: [number, number, number];
  helmetRadius: number;
  /** Winkel der Arme zur Senkrechten in Bindehaltung (rad). */
  armAngle: number;
  /** Bezugspunkte für Anbauteile: Brust vorn, Rücken, Schulterbreite. */
  chestFront: [number, number, number];
  chestBack: [number, number, number];
  shoulderX: number;
}

type Part =
  | 'pelvis' | 'belt' | 'abdomen' | 'flank' | 'chestPlate' | 'backPlate' | 'yoke' | 'collar' | 'collarBand' | 'neck'
  | 'helmet' | 'visor' | 'hipJoint' | 'thigh' | 'thighLower' | 'kneePad' | 'shin' | 'boot' | 'bootBand' | 'sole'
  | 'shoulderJoint' | 'pauldron' | 'upperArm' | 'elbow' | 'forearm' | 'gauntlet' | 'gauntletBand' | 'glove';

const BASE_ZONE: Record<Part, number> = {
  pelvis: ZONE.FABRIC, belt: ZONE.SHELL2, abdomen: ZONE.FABRIC, flank: ZONE.FABRIC, chestPlate: ZONE.SHELL, backPlate: ZONE.SHELL, yoke: ZONE.SHELL,
  collar: ZONE.SHELL2, collarBand: ZONE.ACCENT, neck: ZONE.JOINT, helmet: ZONE.SHELL, visor: ZONE.VISOR, hipJoint: ZONE.FABRIC, thigh: ZONE.FABRIC,
  thighLower: ZONE.FABRIC, kneePad: ZONE.SHELL, shin: ZONE.FABRIC, boot: ZONE.SHELL2, bootBand: ZONE.ACCENT, sole: ZONE.JOINT, shoulderJoint: ZONE.JOINT, pauldron: ZONE.SHELL,
  upperArm: ZONE.FABRIC, elbow: ZONE.JOINT, forearm: ZONE.FABRIC, gauntlet: ZONE.SHELL2, gauntletBand: ZONE.ACCENT, glove: ZONE.FABRIC2,
};

/** Zone einer Fläche aus Körperteil und Muster; `stripe` markiert die Außenbahn von Rumpf und Gliedmaßen. */
function zoneFor(part: Part, pattern: SuitPattern, stripe: boolean): number {
  const base = BASE_ZONE[part];
  switch (pattern) {
    case 'panels':
      if (part === 'chestPlate' || part === 'backPlate' || part === 'pauldron' || part === 'kneePad' || part === 'yoke') return ZONE.SHELL2;
      break;
    case 'split':
      if (part === 'pelvis' || part === 'hipJoint' || part === 'thigh' || part === 'thighLower' || part === 'shin' || part === 'forearm') return ZONE.FABRIC2;
      break;
    case 'bands':
      if (part === 'thighLower' || part === 'forearm' || part === 'abdomen') return ZONE.FABRIC2;
      break;
    case 'stripes':
      if (stripe && base === ZONE.FABRIC) return ZONE.FABRIC2;
      break;
    default:
      break;
  }
  return base;
}

type Weights = Array<[number, number]>;

/** Ausgleich für das Schrumpfen grober Ringe bei der Unterteilung (Achteck, Sechseck). */
const K8 = 1.09;
const K6 = 1.17;
/** UV-Einheiten je Meter (eine Kachel der Detailtextur ≈ 18 cm). */
const UV = 12;
/** Bezugsumfänge der Ketten in Metern (für eine gleichmäßige Texturdichte). */
const TORSO_SPAN = 0.9;
const LEG_SPAN = 0.46;
const ARM_SPAN = 0.32;

class CageBuilder {
  readonly mesh: QuadMesh = { positions: [], faces: [], zones: [], uvs: [], weights: [], bones: BONES.length };

  vertex(x: number, y: number, z: number, weights: Weights): number {
    const m = this.mesh;
    m.positions.push(x, y, z);
    const row = new Array<number>(BONES.length).fill(0);
    let sum = 0;
    for (const [, w] of weights) sum += w;
    for (const [bone, w] of weights) row[bone] = (row[bone] as number) + w / sum;
    for (const w of row) m.weights.push(w);
    return m.positions.length / 3 - 1;
  }

  point(i: number): [number, number, number] {
    const p = this.mesh.positions;
    return [p[i * 3] as number, p[i * 3 + 1] as number, p[i * 3 + 2] as number];
  }

  quad(a: number, b: number, c: number, d: number, zone: number, u0 = 0, v0 = 0, u1 = 1, v1 = 1): void {
    const m = this.mesh;
    m.faces.push(a, b, c, d);
    m.zones.push(zone);
    m.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  }

  /** Laufende v-Koordinate je Ring (Schlüssel: erster Punkt), damit benachbarte Bänder nahtlos anschließen. */
  private readonly ringV = new Map<number, number>();

  /**
   * Flächenband zwischen zwei gleich langen Ringen; `zone(k)` je Segment, `skip` lässt Öffnungen frei.
   * `span` ist der Bezugsumfang der Kette in Metern: u läuft je Ring von 0 bis `span`, v summiert die Bandhöhen.
   * Innerhalb einer Kette (Rumpf, Bein, Arm) entsteht so nur eine einzige Texturnaht entlang einer Kante.
   */
  loft(a: number[], b: number[], span: number, zone: (k: number) => number, skip?: (k: number) => boolean): void {
    const n = a.length;
    let rise = 0;
    for (let k = 0; k < n; k++) {
      const p = this.point(a[k] as number);
      const r = this.point(b[k] as number);
      rise += Math.hypot(r[0] - p[0], r[1] - p[1], r[2] - p[2]) / n;
    }
    const v0 = this.ringV.get(a[0] as number) ?? 0;
    const v1 = v0 + rise * UV;
    if (!this.ringV.has(b[0] as number)) this.ringV.set(b[0] as number, v1);
    for (let k = 0; k < n; k++) {
      if (skip?.(k)) continue;
      const k1 = (k + 1) % n;
      this.quad(a[k] as number, a[k1] as number, b[k1] as number, b[k] as number, zone(k), (k / n) * span * UV, v0, ((k + 1) / n) * span * UV, v1);
    }
  }
}

/** Baut den Körperkäfig aus den Reglern. */
export function buildBodyCage(spec: BodySpec): BodyCage {
  const cb = new CageBuilder();
  const build = clamp(spec.build, 0, 1);
  const armor = clamp(spec.armor, 0, 1);
  const pattern = spec.pattern;
  const zone = (part: Part, stripe = false): number => zoneFor(part, pattern, stripe);

  // --- Maße -------------------------------------------------------------------------------------------------------
  const H = 1.62 + clamp(spec.height, 0, 1) * 0.3;
  const hr = 0.138 + (1 - build) * 0.006;
  const helmetY = H - hr;
  const neckTop = helmetY - hr * 0.86;
  const collarY = neckTop - 0.05;
  const shoulderY = collarY - 0.05;
  const hipY = H * (0.455 + clamp(spec.legLength, 0, 1) * 0.06);
  const crotchY = hipY - 0.08;
  const ankleY = 0.095;
  const kneeY = ankleY + (hipY - ankleY) * 0.5;
  const bootTop = ankleY + (kneeY - ankleY) * 0.46;
  const waistY = hipY + (shoulderY - hipY) * 0.3;
  const ribsY = hipY + (shoulderY - hipY) * 0.58;

  const sx = 0.15 + clamp(spec.shoulders, 0, 1) * 0.048 + build * 0.022;
  const ra = 0.064 + build * 0.012 + armor * 0.004;
  const chestF = 0.122 + build * 0.036 + armor * 0.014;
  const chestB = 0.108 + build * 0.03 + armor * 0.008;
  const waistW = 0.106 + build * 0.054;
  const waistF = 0.104 + build * 0.046;
  const waistB = 0.094 + build * 0.036;
  const hipW = 0.146 + build * 0.04;
  const hipF = 0.11 + build * 0.036;
  const hipB = 0.118 + build * 0.036;
  const hx = 0.086 + build * 0.018;
  const thighR = 0.078 + build * 0.02;
  const kneeR = 0.057 + build * 0.012;
  const calfR = 0.06 + build * 0.013;
  const ankleR = 0.046 + build * 0.008;
  const upperR = 0.048 + build * 0.012;
  const elbowR = 0.042 + build * 0.009;
  const foreR = 0.043 + build * 0.009;
  const wristR = 0.034 + build * 0.005;
  const armAngle = 0.6;
  const armLen = H * 0.325;
  const upperLen = armLen * 0.48;

  // --- Arme: Ringe um die Armachse; der erste Ring ist zugleich der Rand der Armöffnung im Brustkorb --------------
  const sinA = Math.sin(armAngle);
  const cosA = Math.cos(armAngle);
  const ARM_PHI = [-30, -90, -150, 150, 90, 30].map((d) => (d * Math.PI) / 180);
  const armRing = (side: number, t: number, ru: number, rv: number, weights: Weights): number[] =>
    ARM_PHI.map((phi) => {
      const cu = Math.cos(phi) * ru * K6;
      const sv = Math.sin(phi) * rv * K6;
      return cb.vertex(side * (sx + sinA * t + cosA * sv), shoulderY - cosA * t + sinA * sv, cu, weights);
    });
  const armHole = [1, -1].map((side) => armRing(side, 0, ra * 0.98, ra * 0.98, [[B.chest, 0.65], [sideBone(B.upperArm, side), 0.35]]));
  const holeL = armHole[0] as number[];
  const holeR = armHole[1] as number[];

  // --- Rumpf --------------------------------------------------------------------------------------------------------
  const DIAG = 0.82;
  const torsoRing = (y: number, w: number, front: number, back: number, weights: Weights, diag = DIAG): number[] => {
    const pts: Array<[number, number]> = [
      [0, front], [w * diag, front * diag], [w, 0], [w * diag, -back * diag], [0, -back], [-w * diag, -back * diag], [-w, 0], [-w * diag, front * diag],
    ];
    return pts.map(([x, z]) => cb.vertex(x * K8, y, z * K8, weights));
  };
  const belt = 1.07 + armor * 0.04;
  const rings: number[][] = [];
  rings.push(torsoRing(crotchY + 0.05, hipW * 0.95, hipF * 0.95, hipB * 0.95, [[B.hips, 1]]));
  rings.push(torsoRing(hipY + 0.03, hipW, hipF, hipB, [[B.hips, 1]]));
  rings.push(torsoRing(waistY - 0.05, lerp(hipW, waistW, 0.75), lerp(hipF, waistF, 0.75), lerp(hipB, waistB, 0.75), [[B.hips, 0.6], [B.spine, 0.4]]));
  rings.push(torsoRing(waistY - 0.032, waistW * belt, waistF * belt, waistB * belt, [[B.hips, 0.5], [B.spine, 0.5]]));
  rings.push(torsoRing(waistY + 0.022, waistW * belt, waistF * belt, waistB * belt, [[B.hips, 0.35], [B.spine, 0.65]]));
  rings.push(torsoRing(waistY + 0.04, waistW, waistF, waistB, [[B.spine, 1]]));
  rings.push(torsoRing(ribsY, lerp(waistW, sx - ra * 0.5, 0.62), lerp(waistF, chestF, 0.7), lerp(waistB, chestB, 0.7), [[B.spine, 0.5], [B.chest, 0.5]]));
  // Achsel- und Schulterring: Mittelpunkte vorn/hinten frei, Seitenpunkte gehören zur Armöffnung
  const centre = (y: number, z: number): number => cb.vertex(0, y, z * K8, [[B.chest, 1]]);
  const armpitY = shoulderY - ra * 0.8;
  const shoulderTopY = shoulderY + ra * 0.6;
  rings.push([centre(armpitY, chestF), holeL[0] as number, holeL[1] as number, holeL[2] as number, centre(armpitY, -chestB), holeR[2] as number, holeR[1] as number, holeR[0] as number]);
  rings.push([centre(shoulderTopY, chestF * 0.78), holeL[5] as number, holeL[4] as number, holeL[3] as number, centre(shoulderTopY, -chestB * 0.82), holeR[3] as number, holeR[4] as number, holeR[5] as number]);
  const collarR = 0.078 + build * 0.008;
  rings.push(torsoRing(collarY, collarR * 1.08, collarR, collarR, [[B.chest, 1]], 0.74));
  rings.push(torsoRing(collarY + 0.014, collarR * 1.24, collarR * 1.2, collarR * 1.2, [[B.chest, 1]], 0.74));
  rings.push(torsoRing(collarY + 0.029, collarR * 1.24, collarR * 1.2, collarR * 1.2, [[B.chest, 0.8], [B.head, 0.2]], 0.74));
  rings.push(torsoRing(neckTop, collarR * 0.92, collarR * 0.9, collarR * 0.9, [[B.chest, 0.5], [B.head, 0.5]], 0.74));

  // Bahnen: 0/7 vorn, 3/4 hinten, 1/6 vordere Flanke (Streifen), 2/5 hintere Flanke
  const torsoParts: Part[] = ['pelvis', 'pelvis', 'pelvis', 'belt', 'abdomen', 'abdomen', 'chestPlate', 'chestPlate', 'yoke', 'collar', 'collarBand', 'collar'];
  for (let i = 0; i < rings.length - 1; i++) {
    const part = torsoParts[i] as Part;
    const chest = i === 6 || i === 7;
    cb.loft(
      rings[i] as number[],
      rings[i + 1] as number[],
      TORSO_SPAN,
      (k) => {
        if (chest) return k === 0 || k === 7 ? zone('chestPlate') : k === 3 || k === 4 ? zone('backPlate') : zone('flank', k === 1 || k === 6);
        return zone(part, k === 1 || k === 6);
      },
      i === 7 ? (k) => k === 1 || k === 2 || k === 5 || k === 6 : undefined,
    );
  }

  // --- Helm ----------------------------------------------------------------------------------------------------------
  const shape = spec.helmet;
  const hxr = hr * (shape === 'wide' ? 1.14 : shape === 'tall' ? 0.96 : shape === 'angular' ? 1.05 : 1);
  const hyr = hr * (shape === 'wide' ? 0.93 : shape === 'tall' ? 1.13 : shape === 'angular' ? 0.98 : 1);
  const hzr = hr * (shape === 'wide' ? 1.04 : shape === 'angular' ? 1.06 : 1);
  const helmetDiag = shape === 'angular' ? 0.9 : 0.74;
  const helmetZ = 0.012;
  const LATS = [-64, -36, -9, 20, 46, 68].map((d) => (d * Math.PI) / 180);
  const helmetRings = LATS.map((lat) => {
    const c = Math.cos(lat);
    // Gesichtsseite etwas voller als der Hinterkopf
    const ring = torsoRing(helmetY + Math.sin(lat) * hyr * 1.04, hxr * c, hzr * c * 1.05, hzr * c * 0.98, [[B.head, 1]], helmetDiag);
    for (const i of ring) cb.mesh.positions[i * 3 + 2] = (cb.mesh.positions[i * 3 + 2] as number) + helmetZ;
    return ring;
  });
  const visorCols = spec.visor === 'panorama' || spec.visor === 'band' ? [6, 7, 0, 1] : [7, 0];
  const visorRows = spec.visor === 'panorama' || spec.visor === 'window' ? [1, 2] : [2];
  cb.loft(rings[rings.length - 1] as number[], helmetRings[0] as number[], TORSO_SPAN, () => zone('neck'));
  for (let i = 0; i < helmetRings.length - 1; i++) {
    cb.loft(helmetRings[i] as number[], helmetRings[i + 1] as number[], TORSO_SPAN, (k) => (visorRows.includes(i) && visorCols.includes(k) ? zone('visor') : zone('helmet')));
  }
  // Deckel: vier Vierecke um den Scheitelpunkt
  const top = helmetRings[helmetRings.length - 1] as number[];
  const crown = cb.vertex(0, helmetY + hyr * 1.06, helmetZ, [[B.head, 1]]);
  for (let k = 0; k < 8; k += 2) cb.quad(top[k] as number, top[k + 1] as number, top[(k + 2) % 8] as number, crown, zone('helmet'), k * 0.1, 0, k * 0.1 + 0.2, 0.2);

  // --- Beine: der Hüftring teilt sich über den Schrittpunkt in zwei Schleifen ---------------------------------------
  const hipRing = rings[0] as number[];
  const crotch = cb.vertex(0, crotchY, 0, [[B.hips, 1]]);
  const LEG_THETA = [-30, 30, 90, 150, 210, 270].map((d) => (d * Math.PI) / 180);
  for (const side of [1, -1]) {
    const thigh = sideBone(B.thigh, side);
    const shin = sideBone(B.shin, side);
    const foot = sideBone(B.foot, side);
    const legRing = (y: number, rx: number, rz: number, cz: number, weights: Weights): number[] =>
      LEG_THETA.map((th) => cb.vertex(side * Math.max(0.014, hx + Math.sin(th) * rx * K6), y, cz + Math.cos(th) * rz * K6, weights));
    const loop = side > 0 ? [hipRing[0], hipRing[1], hipRing[2], hipRing[3], hipRing[4], crotch] : [hipRing[0], hipRing[7], hipRing[6], hipRing[5], hipRing[4], crotch];
    const pad = 1.16 + armor * 0.22;
    const cuff = 1.34 + armor * 0.16;
    const legRings: Array<[number[], Part]> = [
      [loop as number[], 'hipJoint'],
      [legRing(crotchY - 0.04, thighR * 1.06, thighR * 1.08, 0, [[thigh, 0.75], [B.hips, 0.25]]), 'thigh'],
      [legRing(lerp(crotchY, kneeY, 0.52), thighR * 0.9, thighR * 0.94, 0.006, [[thigh, 1]]), 'thighLower'],
      [legRing(kneeY + 0.085, kneeR * 1.04, kneeR * 1.04, 0.004, [[thigh, 1]]), 'thighLower'],
      [legRing(kneeY + 0.06, kneeR * pad, kneeR * pad, 0.008, [[thigh, 0.8], [shin, 0.2]]), 'kneePad'],
      [legRing(kneeY - 0.05, kneeR * pad, kneeR * pad, 0.008, [[thigh, 0.3], [shin, 0.7]]), 'shin'],
      [legRing(kneeY - 0.078, calfR, calfR, 0, [[shin, 1]]), 'shin'],
      [legRing(kneeY - 0.17, calfR * 1.06, calfR * 1.16, -0.016, [[shin, 1]]), 'shin'],
      [legRing(bootTop + 0.024, ankleR * 1.1, ankleR * 1.12, -0.006, [[shin, 1]]), 'boot'],
      [legRing(bootTop + 0.006, ankleR * cuff, ankleR * cuff, -0.002, [[shin, 1]]), 'bootBand'],
      [legRing(bootTop - 0.012, ankleR * cuff, ankleR * cuff, -0.002, [[shin, 1]]), 'boot'],
      [legRing(bootTop - 0.034, ankleR * (cuff - 0.06), ankleR * (cuff - 0.06), 0, [[shin, 1]]), 'boot'],
      [legRing(ankleY + 0.012, ankleR * 1.3, ankleR * 1.4, 0.008, [[shin, 0.5], [foot, 0.5]]), 'boot'],
      [legRing(0.06, 0.052, 0.118, 0.055, [[foot, 1]]), 'boot'],
      [legRing(0.022, 0.056, 0.128, 0.058, [[foot, 1]]), 'sole'],
      [legRing(0, 0.052, 0.12, 0.058, [[foot, 1]]), 'sole'],
    ];
    for (let i = 0; i < legRings.length - 1; i++) {
      const [a, part] = legRings[i] as [number[], Part];
      // Außenbahn (zwischen 30° und 90°) trägt den Streifen
      cb.loft(a, (legRings[i + 1] as [number[], Part])[0], LEG_SPAN, (k) => zone(part, k === 1));
    }
    const sole = (legRings[legRings.length - 1] as [number[], Part])[0];
    cb.quad(sole[0] as number, sole[1] as number, sole[2] as number, sole[3] as number, zone('sole'), 0, 0, 0.3, 0.6);
    cb.quad(sole[3] as number, sole[4] as number, sole[5] as number, sole[0] as number, zone('sole'), 0.3, 0, 0.6, 0.6);
  }

  // --- Arme und Hände ------------------------------------------------------------------------------------------------
  for (const side of [1, -1]) {
    const upper = sideBone(B.upperArm, side);
    const fore = sideBone(B.forearm, side);
    const hand = sideBone(B.hand, side);
    const cap = ra * (1.06 + armor * 0.2);
    const cuff = 1.26 + armor * 0.16;
    const round = (t: number, r: number, weights: Weights): number[] => armRing(side, t, r, r, weights);
    const armRings: Array<[number[], Part]> = [
      [side > 0 ? holeL : holeR, 'shoulderJoint'],
      [round(0.026, ra * 0.99, [[upper, 0.7], [B.chest, 0.3]]), 'pauldron'],
      [round(0.04, cap, [[upper, 0.85], [B.chest, 0.15]]), 'pauldron'],
      [round(0.096, cap * 0.98, [[upper, 1]]), 'pauldron'],
      [round(0.118, upperR * 1.06, [[upper, 1]]), 'upperArm'],
      [round(upperLen * 0.64, upperR, [[upper, 1]]), 'upperArm'],
      [round(upperLen - 0.036, elbowR * 1.05, [[upper, 0.8], [fore, 0.2]]), 'elbow'],
      [round(upperLen + 0.036, elbowR * 1.05, [[upper, 0.2], [fore, 0.8]]), 'forearm'],
      [round(upperLen + 0.08, foreR, [[fore, 1]]), 'forearm'],
      [round(armLen - 0.104, foreR, [[fore, 1]]), 'gauntlet'],
      [round(armLen - 0.088, foreR * cuff, [[fore, 1]]), 'gauntletBand'],
      [round(armLen - 0.07, foreR * cuff, [[fore, 1]]), 'gauntlet'],
      [round(armLen - 0.022, wristR * 1.42, [[fore, 1]]), 'gauntlet'],
      [round(armLen, wristR * 1.12, [[fore, 0.5], [hand, 0.5]]), 'glove'],
      // Hand: breit in Laufrichtung, schmal quer dazu (Handfläche zeigt zum Körper)
      [armRing(side, armLen + 0.045, 0.048, 0.026, [[hand, 1]]), 'glove'],
      [armRing(side, armLen + 0.1, 0.042, 0.022, [[hand, 1]]), 'glove'],
      [armRing(side, armLen + 0.122, 0.026, 0.014, [[hand, 1]]), 'glove'],
    ];
    for (let i = 0; i < armRings.length - 1; i++) {
      const [a, part] = armRings[i] as [number[], Part];
      // Außenbahn (zwischen 90° und 30°) trägt den Streifen; an der Handfläche bleibt Platz für den Daumen
      cb.loft(a, (armRings[i + 1] as [number[], Part])[0], ARM_SPAN, (k) => zone(part, k === 4), i === 14 ? (k) => k === 5 : undefined);
    }
    const tip = (armRings[armRings.length - 1] as [number[], Part])[0];
    cb.quad(tip[0] as number, tip[1] as number, tip[2] as number, tip[3] as number, zone('glove'), 0, 0, 0.2, 0.2);
    cb.quad(tip[3] as number, tip[4] as number, tip[5] as number, tip[0] as number, zone('glove'), 0.2, 0, 0.4, 0.2);
    // Daumen: Auszug der vorderen Handfläche
    const palm = (armRings[14] as [number[], Part])[0];
    const fingers = (armRings[15] as [number[], Part])[0];
    const base = [palm[5] as number, palm[0] as number, fingers[0] as number, fingers[5] as number];
    const mid: [number, number, number] = [0, 0, 0];
    for (const i of base) {
      const p = cb.point(i);
      mid[0] += p[0] / 4;
      mid[1] += p[1] / 4;
      mid[2] += p[2] / 4;
    }
    const thumb = base.map((i) => {
      const p = cb.point(i);
      return cb.vertex(lerp(mid[0], p[0], 0.62) + side * sinA * 0.012, lerp(mid[1], p[1], 0.62) - cosA * 0.012, lerp(mid[2], p[2], 0.62) + 0.036, [[hand, 1]]);
    });
    for (let k = 0; k < 4; k++) cb.quad(base[k] as number, base[(k + 1) % 4] as number, thumb[(k + 1) % 4] as number, thumb[k] as number, zone('glove'), k * 0.1, 0, k * 0.1 + 0.1, 0.2);
    cb.quad(thumb[0] as number, thumb[1] as number, thumb[2] as number, thumb[3] as number, zone('glove'), 0, 0, 0.1, 0.1);
  }

  orient(cb.mesh);

  // --- Gelenke -------------------------------------------------------------------------------------------------------
  const arm = (side: number, t: number): [number, number, number] => [side * (sx + sinA * t), shoulderY - cosA * t, 0];
  const joints: Array<[number, number, number]> = [
    [0, hipY, 0],
    [0, waistY, 0],
    [0, ribsY + 0.04, 0],
    [0, neckTop, 0],
    arm(1, 0), arm(1, upperLen), arm(1, armLen),
    arm(-1, 0), arm(-1, upperLen), arm(-1, armLen),
    [hx, hipY, 0], [hx, kneeY, 0.004], [hx, ankleY, 0],
    [-hx, hipY, 0], [-hx, kneeY, 0.004], [-hx, ankleY, 0],
  ];
  return {
    mesh: cb.mesh,
    joints,
    height: H,
    helmetCenter: [0, helmetY, helmetZ],
    helmetRadius: hr,
    armAngle,
    chestFront: [0, (armpitY + shoulderTopY) / 2 - 0.01, chestF],
    chestBack: [0, (armpitY + shoulderTopY) / 2 - 0.03, -chestB],
    shoulderX: sx,
  };
}

/** Käfig-Parameter aus der Charakter-Konfiguration. */
export function specFromConfig(cfg: CharacterConfig): BodySpec {
  return { height: cfg.body.height, build: cfg.body.build, shoulders: cfg.body.shoulders, legLength: cfg.body.legLength, armor: cfg.suit.armor, helmet: cfg.helmet.shape, visor: cfg.helmet.visor, pattern: cfg.suit.pattern };
}

/**
 * Fertiges Körpernetz: Käfig plus `levels` Stufen Unterteilung (2 Stufen ≈ 8 500 Vierecke). Auf dem feinen Netz werden
 * die Zonen nachgezeichnet: ein schmaler Rahmen um das Visier und dunkle Fugen, wo Stoff an eine Schale grenzt. Beides
 * ist reine Flächenzuordnung entlang der Kantenschleifen, die Geometrie bleibt unverändert.
 */
export function buildBodyMesh(cage: BodyCage, levels = 2): QuadMesh {
  let mesh = cage.mesh;
  for (let i = 0; i < levels; i++) mesh = subdivide(mesh);
  if (levels >= 2) outlineZones(mesh);
  return mesh;
}

function outlineZones(mesh: QuadMesh): void {
  const vertexCount = mesh.positions.length / 3;
  const touchesVisor = new Uint8Array(vertexCount);
  const touchesShell = new Uint8Array(vertexCount);
  const faceCount = mesh.faces.length / 4;
  for (let f = 0; f < faceCount; f++) {
    const z = mesh.zones[f] as number;
    if (z !== ZONE.VISOR && z !== ZONE.SHELL && z !== ZONE.SHELL2) continue;
    for (let k = 0; k < 4; k++) {
      const v = mesh.faces[f * 4 + k] as number;
      if (z === ZONE.VISOR) touchesVisor[v] = 1;
      else touchesShell[v] = 1;
    }
  }
  const next = mesh.zones.slice();
  for (let f = 0; f < faceCount; f++) {
    const z = mesh.zones[f] as number;
    let visor = false;
    let shell = false;
    for (let k = 0; k < 4; k++) {
      const v = mesh.faces[f * 4 + k] as number;
      if (touchesVisor[v]) visor = true;
      if (touchesShell[v]) shell = true;
    }
    if (visor && z !== ZONE.VISOR) next[f] = ZONE.SHELL2;
    else if (shell && (z === ZONE.FABRIC || z === ZONE.FABRIC2)) next[f] = ZONE.JOINT;
  }
  mesh.zones = next;
}
