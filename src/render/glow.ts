/**
 * Leuchten bei Nacht, in zwei Teilen:
 *
 * 1. `addGlow`: Das Material leuchtet in seiner eigenen Farbe statt in einer festen Einheitsfarbe. Eine Maske aus den
 *    Vertexfarben bestimmt, welche Teile leuchten (helle Blüten und Spitzen, nicht der Stamm), nachts kräftig, am Tag
 *    nur schwach. So bleiben Form und Zeichnung erhalten, statt in einer flachen hellen Fläche zu verschwinden.
 * 2. `glowField` + `addGlowLight`: Leuchtende Objekte melden sich als Lichtquelle an. Die nächsten Quellen beleuchten
 *    Boden, Gras und Pflanzen in ihrer Farbe (Lichtfleck), ohne echte Punktlichter und ohne Kosten am Tag.
 *
 * Die Uniforms sind global geteilt und werden von der Planetenszene pro Frame gesetzt.
 */
import { Color, Matrix4, Vector3, Vector4, type Camera, type Material } from 'three';
import { addShaderPatch } from './stylize';

/** Höchstzahl gleichzeitig wirkender Lichtquellen (fest im Shader). */
export const GLOW_MAX = 6;
/** Quellen jenseits dieser Entfernung zur Kamera wirken nicht. */
const GLOW_RANGE = 48;

export const glow = {
  /** 0 = Tag, 1 = Nacht. */
  night: { value: 0 },
  time: { value: 0 },
  /** xyz: Position im Kameraraum, w: Reichweite in Metern. */
  lightPos: { value: Array.from({ length: GLOW_MAX }, () => new Vector4(0, 0, 0, 1)) },
  lightColor: { value: Array.from({ length: GLOW_MAX }, () => new Color(0, 0, 0)) },
  lightCount: { value: 0 },
};

export interface GlowOptions {
  /** Stärke bei Nacht (1 ≈ volle Eigenfarbe). */
  amount?: number;
  /** Anteil, der auch am Tag bleibt. */
  day?: number;
  /** Helligkeitsbereich der Vertexfarbe, ab dem ein Teil leuchtet (nur ohne `tint`). */
  lo?: number;
  hi?: number;
  /** Leuchtfarbe: nur Teile mit ähnlicher Vertexfarbe leuchten, plus `floor` als Grundleuchten des ganzen Körpers. */
  tint?: Color;
  floor?: number;
}

/** Eigenleuchten aus der Vertexfarbe (ersetzt die feste `emissive`-Farbe des Materials). */
export function addGlow(material: Material, options: GlowOptions = {}): void {
  const amount = options.amount ?? 1.1;
  const day = options.day ?? 0.22;
  const lo = options.lo ?? 0.5;
  const hi = options.hi ?? 0.9;
  const tint = options.tint;
  const floor = options.floor ?? 0.12;
  const f = (n: number): string => n.toFixed(3);
  const key = tint ? `glow-t-${tint.getHexString()}-${f(amount)}-${f(day)}-${f(floor)}` : `glow-${f(amount)}-${f(day)}-${f(lo)}-${f(hi)}`;
  const mask = tint
    ? `float gMask = ${f(floor)} + ${f(1 - floor)} * smoothstep(0.93, 0.995, dot(gc / max(length(gc), 0.001), normalize(vec3(${f(tint.r)}, ${f(tint.g)}, ${f(tint.b)}))));
  vec3 gCol = vec3(${f(tint.r)}, ${f(tint.g)}, ${f(tint.b)});`
    : `float gMask = smoothstep(${f(lo)}, ${f(hi)}, gMax);
  vec3 gCol = gc / max(gMax, 0.001);`;
  addShaderPatch(material, key, (shader) => {
    shader.uniforms.uGlowNight = glow.night;
    shader.uniforms.uGlowTime = glow.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGlowPhase;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_BATCHING
  vGlowPhase = dot(batchingMatrix[3].xz, vec2(0.37, 0.61));
#elif defined( USE_INSTANCING )
  vGlowPhase = dot(instanceMatrix[3].xz, vec2(0.37, 0.61));
#else
  vGlowPhase = dot(modelMatrix[3].xz, vec2(0.37, 0.61));
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlowNight;\nuniform float uGlowTime;\nvarying float vGlowPhase;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_COLOR
{
  vec3 gc = vColor.rgb;
  float gMax = max(gc.r, max(gc.g, gc.b));
  ${mask}
  float gPulse = 0.9 + 0.1 * sin(uGlowTime * 1.4 + vGlowPhase);
  totalEmissiveRadiance = gCol * (gMask * gPulse * ${f(amount)} * mix(${f(day)}, 1.0, uGlowNight));
}
#endif`,
      );
  });
}

/** Material empfängt das Licht der nächsten Leuchtquellen (Lichtfleck am Boden, auf Gras und Pflanzen). */
export function addGlowLight(material: Material): void {
  addShaderPatch(material, 'glow-light', (shader) => {
    shader.uniforms.uGlowPos = glow.lightPos;
    shader.uniforms.uGlowCol = glow.lightColor;
    shader.uniforms.uGlowCount = glow.lightCount;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uGlowPos[${GLOW_MAX}];\nuniform vec3 uGlowCol[${GLOW_MAX}];\nuniform int uGlowCount;`)
      .replace(
        '#include <opaque_fragment>',
        `if (uGlowCount > 0) {
  vec3 gP = -vViewPosition;
  vec3 gSum = vec3(0.0);
  for (int gi = 0; gi < ${GLOW_MAX}; gi++) {
    if (gi >= uGlowCount) break;
    vec3 gL = uGlowPos[gi].xyz - gP;
    float gD2 = dot(gL, gL);
    float gR = uGlowPos[gi].w;
    float gA = max(0.0, 1.0 - gD2 / (gR * gR));
    // halbes Lambert: auch abgewandte Halme bekommen etwas Licht
    float gN = 0.55 + 0.45 * dot(normal, gL * inversesqrt(gD2 + 0.0001));
    gSum += uGlowCol[gi] * (gA * gA * gN);
  }
  // überwiegend in der Farbe der Oberfläche, ein kleiner Teil in der Farbe des Lichts selbst
  outgoingLight += (diffuseColor.rgb * 0.85 + 0.05) * gSum;
}
#include <opaque_fragment>`,
      );
  });
}

/** Eine Lichtquelle: Ort, Reichweite und Farbe (die Stärke steckt in der Farbe). Darf sich bewegen (Kreaturen). */
export interface GlowSource {
  x: number;
  y: number;
  z: number;
  radius: number;
  r: number;
  g: number;
  b: number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Verzeichnis der Leuchtquellen, gruppenweise an- und abgemeldet (wie die Kollisionswelt). Pro Frame werden die
 * nächsten `GLOW_MAX` Quellen in die Shader-Uniforms geschrieben. Quellen blenden zur Auswahlgrenze hin aus, damit
 * beim Wechsel der Auswahl kein Licht springt.
 */
export class GlowField {
  private readonly groups = new Map<string, GlowSource[]>();
  private readonly picked: Array<GlowSource | null> = new Array<GlowSource | null>(GLOW_MAX + 1).fill(null);
  private readonly pickedDist = new Float64Array(GLOW_MAX + 1);
  private pickedCount = 0;
  private cutoff = GLOW_RANGE;
  private tick = 0;
  private readonly view = new Matrix4();
  private readonly tmp = new Vector3();

  get size(): number {
    let n = 0;
    for (const g of this.groups.values()) n += g.length;
    return n;
  }

  /** Ersetzt die Quellen einer Gruppe (leere Liste = Gruppe entfernen). */
  set(group: string, sources: GlowSource[]): void {
    if (sources.length === 0) this.groups.delete(group);
    else this.groups.set(group, sources);
    this.tick = 0;
  }

  remove(group: string): void {
    if (this.groups.delete(group)) this.tick = 0;
  }

  clear(): void {
    this.groups.clear();
    this.pickedCount = 0;
    this.picked.fill(null);
    glow.lightCount.value = 0;
  }

  /** Wählt die nächsten Quellen (bis `GLOW_MAX`) und merkt die Entfernung der ersten nicht mehr gewählten als Grenze. */
  pick(x: number, y: number, z: number): number {
    const picked = this.picked;
    const dist = this.pickedDist;
    let n = 0;
    for (const list of this.groups.values()) {
      for (let k = 0; k < list.length; k++) {
        const s = list[k] as GlowSource;
        const d = Math.hypot(s.x - x, s.y - y, s.z - z);
        if (d > GLOW_RANGE) continue;
        if (n === GLOW_MAX + 1 && d >= (dist[GLOW_MAX] as number)) continue;
        // sortiert einfügen (kleines festes Feld)
        let i = n < GLOW_MAX + 1 ? n++ : GLOW_MAX;
        while (i > 0 && (dist[i - 1] as number) > d) {
          dist[i] = dist[i - 1] as number;
          picked[i] = picked[i - 1] as GlowSource | null;
          i--;
        }
        dist[i] = d;
        picked[i] = s;
      }
    }
    this.cutoff = n > GLOW_MAX ? (dist[GLOW_MAX] as number) : GLOW_RANGE;
    this.pickedCount = Math.min(n, GLOW_MAX);
    for (let i = n; i <= GLOW_MAX; i++) picked[i] = null;
    return this.pickedCount;
  }

  /** Stärke 0..1 einer Quelle in Entfernung `d` zur Kamera (blendet zur Auswahlgrenze aus). */
  fade(d: number): number {
    return 1 - smooth(this.cutoff * 0.72, this.cutoff, d);
  }

  /** Schreibt die Uniforms für diesen Frame. `night` 0..1 skaliert die Stärke; am Tag kostet der Shader nichts. */
  update(camera: Camera, night: number): void {
    if (night < 0.03 || this.groups.size === 0) {
      glow.lightCount.value = 0;
      return;
    }
    const cp = camera.position;
    if (this.tick++ % 4 === 0) this.pick(cp.x, cp.y, cp.z);
    camera.updateMatrixWorld();
    this.view.copy(camera.matrixWorld).invert();
    const pos = glow.lightPos.value;
    const col = glow.lightColor.value;
    for (let i = 0; i < this.pickedCount; i++) {
      const s = this.picked[i] as GlowSource;
      const k = night * this.fade(Math.hypot(s.x - cp.x, s.y - cp.y, s.z - cp.z));
      this.tmp.set(s.x, s.y, s.z).applyMatrix4(this.view);
      (pos[i] as Vector4).set(this.tmp.x, this.tmp.y, this.tmp.z, s.radius);
      (col[i] as Color).setRGB(s.r * k, s.g * k, s.b * k);
    }
    glow.lightCount.value = this.pickedCount;
  }
}

/** Leuchtquellen der aktiven Planetenszene. */
export const glowField = new GlowField();

/** Baut eine Quelle aus Farbe und Stärke. */
export function glowSource(x: number, y: number, z: number, radius: number, color: Color, intensity: number): GlowSource {
  return { x, y, z, radius, r: color.r * intensity, g: color.g * intensity, b: color.b * intensity };
}
