import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector2, Vector3, type Scene } from 'three';
import type { Planet } from '@/gen/universe/types';
import { SHORE_CELLS, SHORE_MIN, SHORE_RES, SHORE_SPAN, ShoreMap } from './water/ShoreMap';
import { SHORE_DEPTH, prepareWaves, seaState, shoreFactor, waveHeight, wavesGlsl } from './water/waves';

/** Gemeinsame Shader-Teile: Wassertiefe aus der Uferkarte (außerhalb des Fensters gilt das Wasser als tief). */
const SHORE_GLSL = /* glsl */ `
uniform sampler2D uShore;
uniform vec2 uShoreCenter;
uniform float uShoreHalf;
float shoreDepth(vec2 p) {
  float d = texture2D(uShore, p * ${(1 / (SHORE_CELLS * SHORE_RES)).toPrecision(8)}).r * ${SHORE_SPAN.toFixed(1)} + ${SHORE_MIN.toFixed(1)};
  vec2 q = abs(p - uShoreCenter);
  return mix(d, 16.0, smoothstep(uShoreHalf - 16.0, uShoreHalf - 3.0, max(q.x, q.y)));
}
`;

const vert = (waves: string): string => /* glsl */ `
uniform float uTime;
uniform float uSeaState;
varying vec3 vWorldPos;
#include <fog_pars_vertex>
${SHORE_GLSL}
${waves}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float dist = length(wp.xz - cameraPosition.xz);
  // Wellen laufen zum Ufer aus; in der Ferne ist das Netz zu grob für die Auslenkung (die Normalen bleiben)
  float shore = smoothstep(0.0, ${SHORE_DEPTH.toFixed(1)}, shoreDepth(wp.xz));
  float fade = 1.0 - smoothstep(70.0, 260.0, dist);
  wp.y += waveH(wp.xz, uTime) * uSeaState * shore * fade;
  vWorldPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const frag = (waves: string): string => /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSeaState;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uDaylight;
varying vec3 vWorldPos;
#include <fog_pars_fragment>
${SHORE_GLSL}
${waves}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Kräuselwellen: nur als Neigung der Oberfläche (vier kurze Wellen in verschiedene Richtungen)
vec2 ripple(vec2 p, float t) {
  vec2 s = vec2(0.0);
  s += vec2(0.92, 0.39) * cos(dot(p, vec2(0.92, 0.39)) * 2.6 - t * 2.9) * 0.050;
  s += vec2(-0.47, 0.88) * cos(dot(p, vec2(-0.47, 0.88)) * 4.1 - t * 3.7 + 1.3) * 0.042;
  s += vec2(0.31, -0.95) * cos(dot(p, vec2(0.31, -0.95)) * 6.7 - t * 4.8 + 2.9) * 0.034;
  s += vec2(-0.83, -0.56) * cos(dot(p, vec2(-0.83, -0.56)) * 10.3 - t * 6.1 + 0.7) * 0.026;
  return s;
}

void main() {
  vec2 p = vWorldPos.xz;
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 v = toCam / dist;
  float depth = shoreDepth(p);
  float shore = smoothstep(0.0, ${SHORE_DEPTH.toFixed(1)}, depth);

  // Oberflächenneigung: Dünung (analytisch, passt zur Auslenkung) plus Kräuselwellen, die mit der Entfernung verblassen
  vec3 hd = waveHD(p, uTime);
  // Wellen, die kleiner sind als ein Bildpunkt, würden flimmern: nach der Pixelgröße auf dem Wasser ausblenden
  float px = length(fwidth(p));
  vec2 slope = hd.yz * uSeaState * shore * mix(0.25, 1.0, 1.0 - smoothstep(0.8, 5.0, px));
  float fine = (1.0 - smoothstep(0.06, 0.3, px)) * (1.0 - smoothstep(18.0, 170.0, dist));
  slope += ripple(p, uTime) * (0.8 + 1.3 * uSeaState) * fine * (0.4 + 0.6 * shore);
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  bool below = !gl_FrontFacing;
  if (below) n = -n;

  float nv = max(dot(n, v), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  float light = 0.08 + 0.92 * uDaylight;

  // Spiegelung: Himmel vom Horizont zum Zenit, dazu der Sonnenpfad (scharfer Kern, breiter Schimmer)
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(r.y, 0.0, 1.0), 0.45));
  float sunUp = clamp(uSunDir.y * 5.0, 0.0, 1.0);
  float sd = max(dot(r, uSunDir), 0.0);
  vec3 sun = uSunColor * (pow(sd, 900.0) * 5.0 + pow(sd, 90.0) * 0.35) * sunUp;

  // Wasserkörper: flach klar und hell, mit der Tiefe dunkler; Kämme lassen Licht durchscheinen
  float deepness = 1.0 - exp(-max(depth, 0.0) * 0.32);
  vec3 body = mix(uShallow, uDeep, deepness) * light;
  // Wellenflanken zur Sonne hin heller, abgewandte dunkler: macht die Oberfläche auch ohne Spiegelung lesbar
  vec3 sunL = normalize(vec3(uSunDir.x, max(uSunDir.y, 0.25), uSunDir.z));
  body *= clamp(0.9 + 2.4 * (dot(n, sunL) - sunL.y), 0.55, 1.5);
  float crest = clamp(hd.x * uSeaState * shore * 0.9 + 0.5, 0.0, 1.0);
  body += uShallow * light * crest * crest * 0.22 * (0.4 + 0.6 * max(dot(v, -uSunDir) * 0.5 + 0.5, 0.0));

  vec3 col;
  float alpha;
  if (below) {
    // von unten: helle Fläche, zum Rand hin Totalreflexion in Wasserfarbe
    col = mix(mix(uShallow, sky, 0.6) * light * 1.3, uDeep * light, clamp(fres * 1.6, 0.0, 1.0));
    alpha = 0.88;
  } else {
    col = mix(body, sky, fres) + sun;
    // Durchsicht zum Grund: im Flachen fast klar, ab etwa drei Metern undurchsichtig; Spiegelungen decken immer
    alpha = mix(mix(0.2, 0.97, 1.0 - exp(-max(depth, 0.0) * 1.15)), 1.0, clamp(fres + dot(sun, vec3(0.3)), 0.0, 1.0));
  }

  // Schaum. Abstand zur Wasserlinie in Metern = Tiefe durch Gefälle des Grundes: so bleibt der Saum auch an
  // flachen Stränden schmal. Feine Körnung macht daraus Schlieren statt einer weißen Fläche.
  vec2 grad = vec2(shoreDepth(p + vec2(1.5, 0.0)) - shoreDepth(p - vec2(1.5, 0.0)), shoreDepth(p + vec2(0.0, 1.5)) - shoreDepth(p - vec2(0.0, 1.5))) / 3.0;
  float offshore = depth / max(length(grad), 0.04);
  vec2 drift = vec2(uTime * 0.16, -uTime * 0.12);
  float grain = vnoise(p * 2.3 + drift) * 0.45 + vnoise(p * 6.1 - drift * 1.7) * 0.35 + vnoise(p * 15.0 + drift * 2.6) * 0.2;
  // dünne Kante direkt am Ufer, dahinter ein bis zwei Bänder, die an Land laufen und sich auflösen
  float wash = 1.0 - smoothstep(0.3, 1.3, offshore);
  float band = smoothstep(0.55, 1.0, sin(offshore * 1.7 + uTime * 1.1 + grain * 3.0)) * (1.0 - smoothstep(1.2, 5.5, offshore));
  float edge = max(wash, band) * smoothstep(0.34, 0.62, grain + wash * 0.35);
  float caps = smoothstep(0.62, 0.95, crest) * smoothstep(0.7, 1.15, uSeaState) * smoothstep(0.46, 0.68, grain) * shore;
  float foam = below ? 0.0 : clamp(edge * 0.85 + caps, 0.0, 1.0) * (1.0 - smoothstep(0.0, 2.5, depth) * (1.0 - min(1.0, caps * 4.0)));
  col = mix(col, vec3(0.92, 0.96, 1.0) * (0.12 + 0.88 * uDaylight), foam);
  // weiche Wasserlinie: das Wasser läuft dünn aus, statt mit harter Kante am Strand zu enden; der Schaum liegt obenauf
  alpha = max(alpha * smoothstep(0.0, 0.2, depth), foam * 0.9 * smoothstep(-0.06, 0.02, depth));

  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`;

/** Netz mit dichter Mitte (≈ 1 m) und grobem Rand: genug Punkte für die Wellen nahe der Kamera, wenige in der Ferne. */
function waterGrid(radius: number, segments: number): BufferGeometry {
  const n = segments + 1;
  const pos = new Float32Array(n * n * 3);
  const axis = (k: number): number => {
    const u = (k / segments) * 2 - 1;
    const a = Math.abs(u);
    return Math.sign(u) * radius * (0.045 * a + 0.955 * a ** 5);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 3;
      pos[o] = axis(i);
      pos[o + 1] = 0;
      pos[o + 2] = axis(j);
    }
  }
  const index = new Uint32Array(segments * segments * 6);
  let k = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index[k++] = a;
      index[k++] = c;
      index[k++] = b;
      index[k++] = b;
      index[k++] = c;
      index[k++] = d;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(index, 1));
  return geo;
}

/**
 * Wasserfläche auf Meereshöhe. Die Dünung kommt aus `water/waves.ts` (dieselben Wellen tragen den Schwimmer),
 * die Uferkarte (`water/ShoreMap.ts`) liefert die Wassertiefe für Farbe, Durchsicht, Schaum und auslaufende Wellen.
 * Der Seegang folgt dem Wind des Wetters.
 */
export class Water {
  readonly mesh: Mesh;
  readonly level: number;
  private readonly material: ShaderMaterial;
  /** Farbe des Wasserkörpers (für den Dunst unter Wasser). */
  readonly bodyColor = new Color();
  private readonly shore: ShoreMap;
  private readonly waves: ReturnType<typeof prepareWaves>;
  private time = 0;
  private state = seaState(0.25);

  constructor(scene: Scene, planet: Planet, level: number, heightAt: (x: number, z: number) => number, radius = 1800) {
    this.level = level;
    const gravity = 9.81 * planet.gravity;
    this.waves = prepareWaves(gravity);
    const glsl = wavesGlsl(gravity);
    this.shore = new ShoreMap(heightAt, level);
    const palette = planet.biomes.find((b) => b.hasWater)?.palette;
    const tint = new Color(planet.type === 'toxic' ? '#5a6a9a' : planet.type === 'ice' ? '#3a6a8a' : (palette?.ground ?? '#2f6f9a'));
    const hsl = { h: 0, s: 0, l: 0 };
    tint.getHSL(hsl);
    // Wasser schluckt Rot: der Farbton des Planeten wird zum Blaugrün gezogen (giftige Meere behalten ihre Farbe).
    // Flach: hell und türkis, tief: dunkel und blauer.
    const pull = planet.type === 'toxic' ? 0.15 : 0.7;
    const hue = (h: number, target: number): number => {
      const d = ((target - h + 1.5) % 1) - 0.5;
      return (h + d * pull + 1) % 1;
    };
    const shallow = new Color().setHSL(hue(hsl.h, 0.48), Math.min(0.8, hsl.s * 0.6 + 0.3), 0.46);
    const deep = new Color().setHSL(hue(hsl.h, 0.58), Math.min(0.9, hsl.s * 0.6 + 0.4), 0.11);
    this.bodyColor.copy(shallow).lerp(deep, 0.5);
    this.material = new ShaderMaterial({
      vertexShader: vert(glsl),
      fragmentShader: frag(glsl),
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSeaState: { value: this.state },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Color(1, 1, 1) },
          uZenith: { value: new Color(0.25, 0.45, 0.85) },
          uHorizon: { value: new Color(0.6, 0.75, 0.9) },
          uShallow: { value: shallow },
          uDeep: { value: deep },
          uDaylight: { value: 1 },
          uShore: { value: null },
          uShoreCenter: { value: new Vector2() },
          uShoreHalf: { value: this.shore.half },
        },
      ]),
    });
    // die Textur wird beim Zusammenführen der Uniforms kopiert: danach die echte einsetzen
    this.material.uniforms.uShore!.value = this.shore.texture;
    this.mesh = new Mesh(waterGrid(radius, 176), this.material);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Aktueller Seegang (0,3 Flaute … 1,25 Sturm). */
  get seaState(): number {
    return this.state;
  }

  /**
   * Höhe der Wasseroberfläche an einem Ort. `ground` ist die Geländehöhe dort (für die Uferdämpfung).
   * Entspricht der gezeichneten Fläche nahe der Kamera.
   */
  surfaceAt(x: number, z: number, ground: number): number {
    return this.level + waveHeight(this.waves, x, z, this.time, this.state) * shoreFactor(this.level - ground);
  }

  /** `wind` 0..1 aus dem Wetter; der Seegang folgt ihm träge (eine aufgewühlte See beruhigt sich langsam). */
  update(time: number, cameraPos: Vector3, sunDir: Vector3, sunColor: Color, zenith: Color, horizon: Color, daylight: number, wind: number): void {
    const dt = Math.min(0.5, Math.max(0, time - this.time));
    this.time = time;
    this.state += (seaState(wind) - this.state) * (1 - Math.exp(-dt * 0.12));
    this.shore.update(cameraPos.x, cameraPos.z);
    const u = this.material.uniforms;
    u.uTime!.value = time;
    u.uSeaState!.value = this.state;
    (u.uSunDir!.value as Vector3).copy(sunDir);
    (u.uSunColor!.value as Color).copy(sunColor);
    (u.uZenith!.value as Color).copy(zenith);
    (u.uHorizon!.value as Color).copy(horizon);
    u.uDaylight!.value = daylight;
    (u.uShoreCenter!.value as Vector2).set(this.shore.centerX, this.shore.centerZ);
    this.mesh.position.set(cameraPos.x, this.level, cameraPos.z);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.shore.dispose();
    this.mesh.removeFromParent();
  }
}
