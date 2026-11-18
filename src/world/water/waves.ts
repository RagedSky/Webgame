/**
 * Wellenmodell des Wassers (rein, ohne Three.js). Dieselben Zahlen speisen den Shader (`wavesGlsl`) und die
 * Schwimmphysik (`waveHeight`), damit der Spieler genau auf der Fläche treibt, die er sieht.
 *
 * Fünf gerichtete Wellen mit Tiefwasser-Dispersion (ω = √(g·k)): lange Wellen laufen schneller als kurze, auf
 * Welten mit geringer Schwerkraft rollt die See langsamer. Die Kämme sind spitzer als die Täler (Potenz auf der
 * Sinuskurve), wie bei echter Dünung.
 */
export interface Wave {
  /** Wellenlänge in Metern. */
  length: number;
  /** Amplitude in Metern bei Seegang 1. */
  amplitude: number;
  /** Laufrichtung relativ zum Wind in Grad. */
  angle: number;
  phase: number;
}

export const WAVES: readonly Wave[] = [
  { length: 46, amplitude: 0.34, angle: 0, phase: 0.0 },
  { length: 29, amplitude: 0.24, angle: 28, phase: 1.7 },
  { length: 18.5, amplitude: 0.15, angle: -35, phase: 4.1 },
  { length: 11, amplitude: 0.085, angle: 62, phase: 2.6 },
  { length: 6.4, amplitude: 0.045, angle: -78, phase: 5.3 },
];

/** Kammschärfe: 1 = Sinus, größer = spitzere Kämme und flachere Täler. */
export const CREST = 1.45;
/** Wassertiefe in Metern, ab der die Wellen ihre volle Höhe haben (zum Ufer hin laufen sie aus). */
export const SHORE_DEPTH = 5;

const TAU = Math.PI * 2;

interface Prepared {
  kx: number;
  kz: number;
  omega: number;
  amplitude: number;
  phase: number;
}

/** Wellenzahlen und Kreisfrequenzen für eine Schwerkraft (m/s²) und Windrichtung (rad). */
export function prepareWaves(gravity: number, windAngle = 0.6): Prepared[] {
  return WAVES.map((w) => {
    const k = TAU / w.length;
    const a = windAngle + (w.angle * Math.PI) / 180;
    return { kx: Math.cos(a) * k, kz: Math.sin(a) * k, omega: Math.sqrt(Math.max(0.5, gravity) * k), amplitude: w.amplitude, phase: w.phase };
  });
}

/** Seegang 0,3..1,25 aus der Windstärke 0..1 (Flaute bis Sturm). */
export function seaState(wind: number): number {
  return 0.3 + 0.95 * Math.min(1, Math.max(0, wind));
}

/** Anteil 0..1 der Wellenhöhe bei gegebener Wassertiefe (am Ufer 0). */
export function shoreFactor(depth: number): number {
  const t = Math.min(1, Math.max(0, depth / SHORE_DEPTH));
  return t * t * (3 - 2 * t);
}

/** Höhe der Wasseroberfläche über dem Ruhespiegel in Metern (ohne Uferdämpfung). */
export function waveHeight(waves: readonly Prepared[], x: number, z: number, time: number, state: number): number {
  let h = 0;
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i] as Prepared;
    const s = 0.5 + 0.5 * Math.sin(w.kx * x + w.kz * z - w.omega * time + w.phase);
    h += w.amplitude * (2 * Math.pow(s, CREST) - 1);
  }
  return h * state;
}

/** Größte mögliche Auslenkung in Metern bei Seegang 1. */
export function maxWaveHeight(): number {
  return WAVES.reduce((sum, w) => sum + w.amplitude, 0);
}

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : n.toPrecision(7));

/**
 * GLSL für dieselben Wellen: `float waveH(vec2 p, float t)` (Höhe bei Seegang 1) und
 * `vec3 waveHD(vec2 p, float t)` (Höhe, Ableitung nach x, Ableitung nach z).
 */
export function wavesGlsl(gravity: number, windAngle = 0.6): string {
  const waves = prepareWaves(gravity, windAngle);
  const height = waves.map((w) => `  { float s = 0.5 + 0.5 * sin(dot(p, vec2(${f(w.kx)}, ${f(w.kz)})) - t * ${f(w.omega)} + ${f(w.phase)}); h += ${f(w.amplitude)} * (2.0 * pow(s, ${f(CREST)}) - 1.0); }`).join('\n');
  const deriv = waves
    .map(
      (w) => `  { float a = dot(p, vec2(${f(w.kx)}, ${f(w.kz)})) - t * ${f(w.omega)} + ${f(w.phase)};
    float s = 0.5 + 0.5 * sin(a);
    float d = ${f(w.amplitude * CREST)} * pow(max(s, 0.0001), ${f(CREST - 1)}) * cos(a);
    r.x += ${f(w.amplitude)} * (2.0 * pow(s, ${f(CREST)}) - 1.0);
    r.yz += d * vec2(${f(w.kx)}, ${f(w.kz)}); }`,
    )
    .join('\n');
  return `float waveH(vec2 p, float t) {
  float h = 0.0;
${height}
  return h;
}
vec3 waveHD(vec2 p, float t) {
  vec3 r = vec3(0.0);
${deriv}
  return r;
}`;
}
