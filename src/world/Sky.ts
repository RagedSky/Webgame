import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  Points,
  PointsMaterial,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from 'three';
import { clamp, clamp01, lerp } from '@/math/utils';
import { Random } from '@/math/Random';
import type { Planet, StarSystem } from '@/gen/universe/types';
import { Disposer } from '@/core/Disposer';
import { createStarfield } from '@/render/Starfield';
import { createPlanetTexture } from '@/render/PlanetTexture';
import { createMoonTexture } from '@/render/MoonTexture';
import { vivid } from '@/render/stylize';
import { atmosphereLook, type AtmosphereLook } from './Atmosphere';
import type { DayCycle } from './DayCycle';
import type { WeatherParams } from './Weather';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform float uDensity;
uniform float uCloudiness;
uniform float uCloudBase;
uniform float uCirrus;
uniform vec2 uCloudOffset;
uniform float uFlash;
uniform float uDaylight;
uniform float uSunDim;
uniform vec2 uSunCos;
uniform float uSunSize;
uniform float uNight;
uniform float uStarRot;
uniform vec3 uBandN;
uniform vec3 uBandA;
uniform vec3 uBandB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise3(p); p *= 2.07; a *= 0.5; } return v; }
// Dichte der Haufenwolken: grobe Ballen plus feine Auflösung an den Rändern
float cumulus(vec2 p) { return fbm(p) * 0.74 + fbm(p * 3.1 + 7.3) * 0.26; }

void main() {
  vec3 dir = normalize(vDir);
  float mu = dot(dir, uSunDir);
  float elev = uSunDir.y;
  float horizonMix = pow(1.0 - clamp(dir.y, 0.0, 1.0), 3.0);
  float daylight = uDaylight;

  vec3 sky = mix(uSky, uHorizon, horizonMix) * daylight;
  // Dämmerungsfarben um die Sonne, violetter Schimmer zum Zenit
  float dusk = (1.0 - smoothstep(0.0, 0.32, abs(elev))) * smoothstep(-0.3, 0.05, elev);
  vec3 duskCol = uSunColor * vec3(1.0, 0.45, 0.2);
  sky += duskCol * dusk * pow(max(mu, 0.0), 2.5) * horizonMix * 2.2;
  sky += duskCol * dusk * 0.25 * horizonMix;
  sky += vec3(0.42, 0.16, 0.5) * dusk * 0.16 * (1.0 - horizonMix) * (0.4 + 0.6 * max(mu, 0.0));
  // Mie-Glow
  float g = 0.8;
  float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  sky += uSunColor * phase * 0.0065 * daylight;
  sky *= uDensity;
  // Nachtgrund und Sternenband (dreht mit den Sternen)
  vec3 night = vec3(0.012, 0.016, 0.035) * uDensity + vec3(0.002, 0.002, 0.004);
  sky += night * (1.0 - daylight);
  if (uNight > 0.01) {
    float cs = cos(uStarRot); float sn = sin(uStarRot);
    vec3 sd = vec3(dir.x * cs - dir.z * sn, dir.y, dir.x * sn + dir.z * cs);
    float d = dot(sd, uBandN);
    float band = exp(-d * d * 26.0);
    float core = exp(-d * d * 130.0);
    float neb = fbm3(sd * 7.0 + 11.0) * 0.62 + fbm3(sd * 26.0 + 3.0) * 0.38;
    float dust = fbm3(sd * 11.0 - 4.0) * 0.7 + fbm3(sd * 31.0 + 8.0) * 0.3;
    float glow = band * (0.25 + 0.75 * smoothstep(0.3, 0.72, neb)) + core * 0.5;
    // dunkle Staubbahnen in der Mitte des Bands
    glow *= 1.0 - 0.85 * smoothstep(0.44, 0.6, dust) * exp(-d * d * 70.0);
    vec3 nebCol = mix(uBandA, uBandB, smoothstep(0.38, 0.62, fbm3(sd * 3.4 + 7.0)));
    nebCol = mix(nebCol, vec3(0.75, 0.8, 0.95), core * 0.6);
    sky += nebCol * glow * 0.11 * uNight * smoothstep(-0.08, 0.2, dir.y);
  }
  // Sonne: Scheibe mit Korona (auch bei dünner Atmosphäre sichtbar)
  float sunVis = smoothstep(-0.05, 0.02, elev) * (1.0 - uSunDim * 0.8);
  float disc = smoothstep(uSunCos.x, uSunCos.y, mu);
  float mup = max(mu, 0.0);
  float corona = pow(mup, 2600.0 / uSunSize) * 0.6 + pow(mup, 260.0) * 0.16 + pow(mup, 40.0) * 0.05;
  sky += uSunColor * (disc * 3.2 + corona * max(uDensity, 0.3)) * sunVis;
  vec3 clearSky = sky;
  // Wolken
  float amount = clamp(uCloudiness * 0.86 + uCloudBase * 0.3, 0.0, 1.0) * step(0.02, uCloudBase);
  if (dir.y > -0.02 && uDensity > 0.05) {
    vec3 lit = (vec3(0.8) + uSunColor * 0.17) * daylight;
    lit *= mix(1.0, 0.6, smoothstep(0.62, 1.0, uCloudiness));
    // nachts fahl vom Sternenlicht aufgehellt statt schwarz
    lit += (night * 4.5 + vec3(0.012, 0.014, 0.02)) * (1.0 - daylight);
    vec3 shade = mix(uSky, uHorizon, 0.4) * 0.6 * daylight + night * 2.4 + vec3(0.004, 0.005, 0.008) * (1.0 - daylight);
    lit += duskCol * dusk * (0.3 + 0.9 * mup * mup);
    shade += duskCol * dusk * 0.1 + vec3(0.2, 0.08, 0.26) * dusk * 0.25;
    // Federwolken: hohe, gestreckte Schleier
    if (uCirrus > 0.01) {
      vec2 c2 = dir.xz / (dir.y + 0.4) * 1.3 + uCloudOffset * 0.35 + 31.7;
      // Verwirbelung, damit keine geraden Streifen entstehen
      c2 += 0.9 * vec2(fbm(c2 * 0.6 + 2.0), fbm(c2 * 0.6 + 9.4));
      float ci = fbm(vec2(c2.x * 0.7 + c2.y * 0.3, c2.y * 1.9 - c2.x * 0.3));
      ci = smoothstep(0.52, 0.84, ci + 0.1 * fbm(c2 * 6.0)) * uCirrus * smoothstep(0.03, 0.3, dir.y) * min(1.0, uDensity * 1.5);
      sky = mix(sky, lit * 0.95 + shade * 0.1, ci * 0.42);
    }
    if (amount > 0.01) {
      vec2 base = dir.xz / (dir.y + 0.18) * 1.4;
      vec2 cp = base + uCloudOffset;
      float n = cumulus(cp);
      float th = mix(0.74, 0.2, amount);
      float cover = smoothstep(th, th + 0.055 + 0.13 * amount, n);
      cover *= smoothstep(0.0, 0.12, dir.y) * min(1.0, uDensity * 1.5);
      if (cover > 0.002) {
        // Selbstschatten: Dichte ein Stück in Richtung Sonne abtasten
        vec2 sunP = uSunDir.xz / (max(uSunDir.y, 0.0) + 0.18) * 1.4;
        vec2 toSun = sunP - base;
        toSun /= max(length(toSun), 1e-3);
        float n2 = cumulus(cp + toSun * 0.2);
        float thick = smoothstep(th, th + 0.42, n);
        float light = 1.0 - smoothstep(-0.07, 0.16, n2 - n + thick * 0.13);
        light = light * (1.0 - 0.45 * thick) + 0.1;
        vec3 cloud = mix(shade, lit, clamp(light, 0.0, 1.0));
        // Unterseite dunkler bei geschlossener Decke
        cloud = mix(cloud, shade * 0.85, thick * smoothstep(0.55, 1.0, uCloudiness) * 0.6);
        // leuchtende Ränder im Gegenlicht
        cloud += uSunColor * cover * (1.0 - cover) * 3.2 * pow(mup, 7.0) * sunVis * daylight;
        // Dunst: ferne Wolken verschmelzen mit dem Horizont
        cloud = mix(cloud, clearSky, horizonMix * 0.55);
        sky = mix(sky, cloud, cover);
      }
    }
  }
  sky += vec3(uFlash) * 0.9;
  gl_FragColor = vec4(sky, 1.0);
}
`;

const BODY_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/**
 * Himmelskörper: eigene Beleuchtung aus der Sonnenrichtung (Phasen, auch nachts sichtbar), Atmosphärensaum und
 * vormultipliziertes Alpha – der Tagdunst der Kuppel scheint additiv durch, Wolken verdecken den Körper.
 */
const BODY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
uniform sampler2D uMap;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uRim;
uniform vec3 uSkyCol;
uniform vec2 uSunCos;
uniform float uHaze;
uniform float uVis;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float lit = smoothstep(-0.12, 0.42, dot(n, uSunDir));
  vec3 col = texture2D(uMap, vUv).rgb * (uSunColor * lit * 1.05 + 0.028);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  col += uRim * pow(1.0 - nv, 2.2) * (0.12 + 0.88 * lit);
  float limb = smoothstep(0.0, 0.2, nv);
  float k = uVis * limb;
  // vor der Sonnenscheibe deckt der Körper voll (Finsternis), der Dunst davor bleibt
  float block = smoothstep(uSunCos.x, uSunCos.y, dot(-v, uSunDir)) * k;
  vec3 outCol = col * (1.0 - uHaze * 0.5) * k + uSkyCol * uHaze * block;
  gl_FragColor = vec4(outCol, mix((1.0 - uHaze) * k, 1.0, block));
}
`;

const RING_VERT = /* glsl */ `
varying vec3 vW;
varying vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const RING_FRAG = /* glsl */ `
precision highp float;
varying vec3 vW;
varying vec2 vUv;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCenter;
uniform float uPlanetR;
uniform float uLight;
uniform float uSeed;
uniform float uHaze;
uniform float uVis;
float h1(float x) { return fract(sin(x * 127.1 + uSeed) * 43758.5453); }
float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main() {
  float t = vUv.x;
  float bands = n1(t * 9.0) * 0.55 + n1(t * 33.0) * 0.45;
  float gap = smoothstep(0.16, 0.3, n1(t * 5.0 + 3.0));
  float edge = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t);
  float dens = (0.3 + 0.7 * bands) * gap * edge * 0.9;
  // Schatten des Planeten auf dem Ring
  vec3 rel = vW - uCenter;
  float along = dot(rel, uSunDir);
  float off = length(rel - uSunDir * along);
  float shadow = along < 0.0 ? smoothstep(uPlanetR * 0.9, uPlanetR * 1.04, off) : 1.0;
  vec3 col = mix(uColA, uColB, n1(t * 14.0 + 7.0)) * uSunColor * uLight * (0.12 + 0.88 * shadow);
  gl_FragColor = vec4(col * dens * (1.0 - uHaze * 0.5) * uVis, dens * (1.0 - uHaze) * uVis);
}
`;

/** Flacher Ring in der XZ-Ebene; uv.x läuft von innen (0) nach außen (1). */
function ringGeometry(inner: number, outer: number, segments = 72): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * inner, 0, s * inner, c * outer, 0, s * outer);
    uv.push(0, i / segments, 1, i / segments);
    if (i < segments) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Ein Körper am Himmel (Mond, Gasriese, Nachbarplanet). */
interface SkyBody {
  /** Wurzelobjekt, das positioniert wird. */
  root: Group | Mesh;
  material: ShaderMaterial;
  /** Zusätzliche Materialien mit uHaze/uVis/uSunDir (Ring). */
  extra: ShaderMaterial | null;
  radius: number;
  /** Feste Richtung (Gasriese) oder null für umlaufende Körper. */
  fixedDir: Vector3 | null;
  /** Umlauf: eigene Periode in Planetentagen (Monde) oder 0 = folgt der Tagesdrehung mit `phase` Abstand zur Sonne. */
  period: number;
  phase: number;
  /** Auslenkung aus der Bahnebene. */
  lift: number;
  isMoon: boolean;
}

/**
 * Himmel: Kuppel-Shader (vereinfachte Rayleigh/Mie-Optik, plastische Haufen- und Federwolken, Dämmerung,
 * Sonne mit Korona, nächtliches Sternenband), zwei Sternschichten, texturierte Monde mit Phasen, optional
 * Gasriese mit Ring und Nachbarplaneten, Sonnenlicht (mit Schatten) und Hemisphärenlicht.
 * `update()` berechnet außerdem Nebelfarbe und Lichtstärken aus Tageszeit und Wetter.
 */
export class Sky {
  readonly group = new Group();
  readonly sun: DirectionalLight;
  private shadowSize: number;
  readonly hemi: HemisphereLight;
  readonly fogColor = new Color();
  /** Zenitfarbe für Reflexionen (linear, tageszeitabhängig). */
  readonly zenithColor = new Color();
  /** Ein Mond steht vor der Sonne. */
  eclipse = false;
  readonly look: AtmosphereLook;
  private readonly disposer = new Disposer();
  private readonly material: ShaderMaterial;
  private readonly stars: Points;
  private readonly brightStars: Points;
  private readonly bandStars: Points;
  private readonly bodies: SkyBody[] = [];
  private readonly tmpDir = new Vector3();
  private readonly tmpColor = new Color();
  private readonly warmColor = new Color(1, 0.5, 0.25);
  private readonly paleColor = new Color(0.8, 0.85, 0.95);
  private readonly greyColor = new Color(0.55, 0.58, 0.62);
  private readonly ringCenter = new Vector3();
  private readonly ringNormal = new Vector3(0, 1, 0);
  private cloudOffset = { x: 0, y: 0 };
  readonly radius: number;

  constructor(scene: Scene, system: StarSystem, planet: Planet, radius = 1500) {
    this.radius = radius;
    this.look = atmosphereLook(planet, system.star);
    const rng = new Random(`sky:${planet.terrainSeed}`);
    // Scheinbare Sonnengröße aus Sternradius und Bahnabstand (stilisiert vergrößert)
    const sunSize = clamp(Math.sqrt(system.star.radius / Math.max(0.05, planet.orbitRadiusAu)), 0.7, 2);
    const sunAngle = 0.026 * sunSize;
    // Wolkencharakter des Planeten: feuchte, dichte Atmosphären tragen mehr Wolken
    const humidity = planet.biomes.reduce((sum, b) => sum + b.humidity * b.coverage, 0);
    const cloudBase = planet.atmosphere.density < 0.12 ? 0 : clamp(0.25 + humidity * 0.7 + rng.float(-0.1, 0.15), 0.15, 1);
    const cirrus = planet.atmosphere.density < 0.12 ? 0 : rng.float(0.25, 0.9);
    const bandN = new Vector3(rng.float(-1, 1), rng.float(0.15, 0.7), rng.float(-1, 1)).normalize();
    const bandHue = rng.next();
    const bandA = new Color().setHSL(bandHue, 0.45, 0.62);
    const bandB = new Color().setHSL((bandHue + rng.float(0.12, 0.3)) % 1, 0.55, 0.58);
    const geo = this.disposer.add(new SphereGeometry(radius, 48, 32));
    this.material = this.disposer.add(
      new ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: this.look.sun.clone() },
          uSky: { value: this.look.sky.clone() },
          uHorizon: { value: this.look.horizon.clone() },
          uDensity: { value: this.look.density },
          uCloudiness: { value: 0.2 },
          uCloudBase: { value: cloudBase },
          uCirrus: { value: cirrus },
          uCloudOffset: { value: new Vector2(rng.float(0, 40), rng.float(0, 40)) },
          uFlash: { value: 0 },
          uDaylight: { value: 1 },
          uSunDim: { value: 0 },
          uSunCos: { value: new Vector2(Math.cos(sunAngle * 1.1), Math.cos(sunAngle * 0.9)) },
          uSunSize: { value: sunSize },
          uNight: { value: 0 },
          uStarRot: { value: 0 },
          uBandN: { value: bandN },
          uBandA: { value: bandA },
          uBandB: { value: bandB },
        },
      }),
    );
    this.cloudOffset.x = (this.material.uniforms.uCloudOffset!.value as Vector2).x;
    this.cloudOffset.y = (this.material.uniforms.uCloudOffset!.value as Vector2).y;
    const dome = new Mesh(geo, this.material);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    this.stars = createStarfield(this.disposer, `sky:${planet.id}`, 3500, [radius * 0.9, radius * 0.95]);
    (this.stars.material as PointsMaterial).size = 2.2;
    (this.stars.material as PointsMaterial).transparent = true;
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
    // wenige helle, farbige Sterne als Blickfang
    this.brightStars = createStarfield(this.disposer, `sky-bright:${planet.id}`, 220, [radius * 0.9, radius * 0.95], [0.02, 1.02], [0.35, 0.9]);
    (this.brightStars.material as PointsMaterial).size = 5.2;
    (this.brightStars.material as PointsMaterial).transparent = true;
    this.brightStars.renderOrder = -9;
    this.brightStars.frustumCulled = false;
    this.group.add(this.brightStars);

    // dichter Sternstaub entlang des Sternenbands
    this.bandStars = this.createBandStars(rng.fork('band'), bandN, radius * 0.94);
    this.group.add(this.bandStars);

    const sunColor = this.look.sun;
    const bodyMaterial = (map: Texture, rim: Color): ShaderMaterial =>
      this.disposer.add(
        new ShaderMaterial({
          vertexShader: BODY_VERT,
          fragmentShader: BODY_FRAG,
          transparent: true,
          premultipliedAlpha: true,
          fog: false,
          uniforms: {
            uMap: { value: map },
            uSunDir: { value: new Vector3(0, 1, 0) },
            uSunColor: { value: sunColor },
            uRim: { value: rim },
            uSkyCol: { value: this.zenithColor },
            uSunCos: { value: new Vector2(Math.cos(sunAngle * 3), Math.cos(sunAngle * 1.3)) },
            uHaze: { value: 0 },
            uVis: { value: 1 },
          },
        }),
      );
    const addBody = (root: Group | Mesh, mesh: Mesh, body: Omit<SkyBody, 'root'>): void => {
      mesh.renderOrder = -8;
      mesh.frustumCulled = false;
      this.group.add(root);
      this.bodies.push({ root, ...body });
    };

    // Monde: groß, mit Kratern und Phasen
    planet.moons.forEach((moon, i) => {
      const r = (14 + Math.log2(1 + moon.radiusKm / 300) * 9) * 3;
      const mg = this.disposer.add(new SphereGeometry(r, 40, 28));
      const tex = this.disposer.add(createMoonTexture(moon));
      const rim = new Color(moon.color).multiplyScalar(0.12);
      const material = bodyMaterial(tex, rim);
      const mesh = new Mesh(mg, material);
      mesh.rotation.set(rng.float(-0.4, 0.4), rng.float(0, 6.28), rng.float(-0.4, 0.4));
      addBody(mesh, mesh, { material, extra: null, radius: r, fixedDir: null, period: Math.max(0.6, moon.orbitPeriodDays), phase: (i * 0.37 + 0.56) % 1, lift: 0, isMoon: true });
    });

    // Gasriese als Landmarke, oft mit Ring
    const giant = planet.type !== 'gas_giant' ? system.planets.find((p) => p.type === 'gas_giant') : undefined;
    if (giant) {
      const gr = 250;
      const gg = this.disposer.add(new SphereGeometry(gr, 48, 32));
      const tex = this.disposer.add(createPlanetTexture(giant, 512, 256));
      const rim = vivid(new Color(giant.color), 1.2, 1.25).multiplyScalar(0.3);
      const material = bodyMaterial(tex, rim);
      const mesh = new Mesh(gg, material);
      const root = new Group();
      root.add(mesh);
      root.rotation.set(rng.float(-0.25, 0.25), 0, rng.float(0.25, 0.55));
      let ring: ShaderMaterial | null = null;
      if (rng.next() < 0.7) {
        const colA = vivid(new Color(giant.biomes[0]?.palette.accent ?? giant.color), 0.9, 1.25);
        const colB = vivid(new Color(giant.biomes[giant.biomes.length - 1]?.palette.ground ?? giant.color), 0.8, 1.1);
        ring = this.disposer.add(
          new ShaderMaterial({
            vertexShader: RING_VERT,
            fragmentShader: RING_FRAG,
            transparent: true,
            premultipliedAlpha: true,
            depthWrite: false,
            side: DoubleSide,
            fog: false,
            uniforms: {
              uColA: { value: colA },
              uColB: { value: colB },
              uSunDir: { value: new Vector3(0, 1, 0) },
              uSunColor: { value: sunColor },
              uCenter: { value: this.ringCenter },
              uPlanetR: { value: gr },
              uLight: { value: 1 },
              uSeed: { value: rng.float(0, 50) },
              uHaze: { value: 0 },
              uVis: { value: 1 },
            },
          }),
        );
        const ringMesh = new Mesh(this.disposer.add(ringGeometry(gr * rng.float(1.3, 1.5), gr * rng.float(2, 2.45))), ring);
        ringMesh.renderOrder = -7;
        ringMesh.frustumCulled = false;
        root.add(ringMesh);
        root.updateMatrixWorld(true);
        this.ringNormal.set(0, 1, 0).applyQuaternion(root.quaternion).normalize();
      }
      const dir = new Vector3(Math.cos(1.1), Math.sin(0.55), Math.sin(1.1)).normalize();
      addBody(root, mesh, { material, extra: ring, radius: gr * (ring ? 2.4 : 1), fixedDir: dir, period: 0, phase: 0, lift: 0, isMoon: false });
    }

    // Nachbarplaneten: wandern mit der Tagesdrehung, innere stehen nahe der Sonne
    const neighbours = system.planets
      .filter((p) => p.id !== planet.id && p.id !== giant?.id)
      .sort((a, b) => Math.abs(a.index - planet.index) - Math.abs(b.index - planet.index))
      .slice(0, 2);
    neighbours.forEach((p, i) => {
      const inner = p.orbitRadiusAu < planet.orbitRadiusAu;
      const r = clamp(20 + Math.log2(1 + p.radiusKm / 2000) * 9, 22, 48) * (i === 0 ? 1 : 0.75);
      const pg = this.disposer.add(new SphereGeometry(r, 28, 20));
      const tex = this.disposer.add(createPlanetTexture(p, 128, 64));
      const rim = vivid(new Color(p.color), 1.2, 1.3).multiplyScalar(p.atmosphere.density > 0.1 ? 0.35 : 0.08);
      const material = bodyMaterial(tex, rim);
      const mesh = new Mesh(pg, material);
      mesh.rotation.set(rng.float(-0.5, 0.5), rng.float(0, 6.28), rng.float(-0.5, 0.5));
      const side = rng.next() < 0.5 ? -1 : 1;
      const phase = inner ? side * rng.float(0.07, 0.13) : side * rng.float(0.2, 0.42);
      addBody(mesh, mesh, { material, extra: null, radius: r, fixedDir: null, period: 0, phase, lift: rng.float(-0.12, 0.2), isMoon: false });
    });

    this.sun = new DirectionalLight(this.look.sun, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -90;
    cam.right = 90;
    cam.top = 90;
    cam.bottom = -90;
    cam.near = 1;
    cam.far = 600;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.shadowSize = 2048;
    scene.add(this.sun);
    scene.add(this.sun.target);
    const groundTint = new Color(planet.biomes[0]?.palette.ground ?? '#3a3327').multiplyScalar(0.6);
    this.hemi = new HemisphereLight(this.look.sky, groundTint, 0.6);
    scene.add(this.hemi);
    scene.add(this.group);
    this.disposer.addFn(() => {
      this.sun.dispose();
      this.sun.removeFromParent();
      this.sun.target.removeFromParent();
      this.hemi.removeFromParent();
    });
    this.disposer.addObject3D(this.group);
  }

  private createBandStars(rng: Random, normal: Vector3, r: number): Points {
    const count = 2600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    // Orthonormalbasis der Bandebene
    const a = new Vector3(1, 0, 0);
    if (Math.abs(normal.x) > 0.8) a.set(0, 0, 1);
    a.addScaledVector(normal, -a.dot(normal)).normalize();
    const b = new Vector3().crossVectors(normal, a);
    const p = new Vector3();
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const ang = rng.next() * Math.PI * 2;
      const off = rng.gaussian(0, 0.11);
      p.copy(a).multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)).addScaledVector(normal, off).normalize().multiplyScalar(r);
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      c.setHSL(rng.float(0.5, 0.72), rng.float(0.05, 0.4), rng.float(0.35, 0.8));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = this.disposer.add(new BufferGeometry());
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    const mat = this.disposer.add(new PointsMaterial({ size: 1.5, vertexColors: true, sizeAttenuation: true, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    const points = new Points(geo, mat);
    points.renderOrder = -9;
    points.frustumCulled = false;
    return points;
  }

  /** Nebel-/Horizontfarbe (linear) für die aktuelle Tageszeit – kleine CPU-Kopie des Shaders. */
  private computeFogColor(daylight: number, elev: number, weather: WeatherParams, out: Color): Color {
    out.copy(this.look.horizon).multiplyScalar(daylight * this.look.density);
    const dusk = (1 - clamp01(Math.abs(elev) / 0.32)) * clamp01((elev + 0.3) / 0.35);
    out.r += this.look.sun.r * 0.35 * dusk * this.look.density;
    out.g += this.look.sun.g * 0.16 * dusk * this.look.density;
    out.b += this.look.sun.b * 0.08 * dusk * this.look.density;
    this.tmpColor.copy(this.greyColor).multiplyScalar(daylight * this.look.density + 0.02);
    out.lerp(this.tmpColor, clamp01((weather.fog - 1) / 6) * 0.8);
    out.r += 0.012 * (1 - daylight);
    out.g += 0.016 * (1 - daylight);
    out.b += 0.035 * (1 - daylight);
    return out;
  }

  update(cycle: DayCycle, weather: WeatherParams, flash: number, camera: PerspectiveCamera, dt: number, playerPos: Vector3): void {
    this.group.position.copy(camera.position);
    const u = this.material.uniforms;
    (u.uSunDir!.value as Vector3).copy(cycle.sunDir);
    const daylight = cycle.daylight;
    u.uDaylight!.value = daylight;
    u.uCloudiness!.value = weather.cloudiness;
    u.uFlash!.value = flash;
    u.uSunDim!.value = weather.sunDim;
    this.cloudOffset.x += dt * 0.004 * (0.5 + weather.wind);
    this.cloudOffset.y += dt * 0.0015 * (0.5 + weather.wind);
    (u.uCloudOffset!.value as Vector2).set(this.cloudOffset.x, this.cloudOffset.y);

    // Sterne und Sternenband: nachts und bei dünner Atmosphäre
    const night = clamp01(1 - daylight * Math.min(1, this.look.density * 1.1));
    const starRot = cycle.t * Math.PI * 2 * 0.1;
    const starOpacity = night * (1 - weather.cloudiness * 0.85);
    (this.stars.material as PointsMaterial).opacity = starOpacity;
    (this.brightStars.material as PointsMaterial).opacity = Math.min(1, starOpacity * 1.2);
    (this.bandStars.material as PointsMaterial).opacity = starOpacity;
    this.stars.rotation.y = starRot;
    this.brightStars.rotation.y = starRot;
    this.bandStars.rotation.y = starRot;
    u.uNight!.value = night;
    u.uStarRot!.value = starRot;

    // Himmelskörper: Position, Dunst und Wolkenverdeckung (+ Finsternis-Erkennung)
    this.eclipse = false;
    const hazeBase = daylight * Math.min(1, this.look.density) * 0.86;
    const cloudVis = 1 - clamp01((weather.cloudiness - 0.35) / 0.6) * 0.94;
    for (const b of this.bodies) {
      const dir = this.tmpDir;
      if (b.fixedDir) dir.copy(b.fixedDir);
      else if (b.period > 0) cycle.directionAtPhase((b.phase + cycle.totalDays / b.period) % 1, dir);
      else {
        cycle.directionAtPhase(cycle.t + b.phase, dir);
        dir.y += b.lift;
        dir.normalize();
      }
      b.root.position.copy(dir).multiplyScalar(this.radius * 0.93);
      b.root.visible = dir.y > -0.06 - b.radius / this.radius;
      if (b.isMoon && cycle.sunElevation > 0 && dir.dot(cycle.sunDir) > 0.9993) this.eclipse = true;
      if (!b.root.visible) continue;
      // Richtung Horizont nimmt der Dunst zu
      const low = Math.pow(1 - clamp01(dir.y), 6) * Math.min(1, this.look.density) * 0.55;
      const haze = Math.min(0.97, hazeBase + (1 - hazeBase) * low);
      const bu = b.material.uniforms;
      (bu.uSunDir!.value as Vector3).copy(cycle.sunDir);
      bu.uHaze!.value = haze;
      bu.uVis!.value = cloudVis;
      if (b.extra) {
        const ru = b.extra.uniforms;
        (ru.uSunDir!.value as Vector3).copy(cycle.sunDir);
        ru.uHaze!.value = haze;
        ru.uVis!.value = cloudVis;
        ru.uLight!.value = 0.4 + 0.6 * Math.abs(this.ringNormal.dot(cycle.sunDir));
        this.ringCenter.copy(camera.position).add(b.root.position);
      }
      if (b.fixedDir) (b.root.children[0] as Mesh).rotation.y += dt * 0.01;
    }

    // Licht
    const sunStrength = clamp01((cycle.sunElevation + 0.05) / 0.4) * (1 - weather.sunDim * 0.85);
    this.sun.intensity = 0.15 + 2.6 * sunStrength;
    const warm = clamp01(1 - Math.abs(cycle.sunElevation) / 0.3);
    this.sun.color.copy(this.look.sun).lerp(this.warmColor, warm * 0.6 * clamp01(cycle.sunElevation + 0.3));
    this.sun.position.copy(playerPos).addScaledVector(cycle.sunDir, 300);
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();
    this.sun.visible = cycle.sunElevation > -0.2;
    this.hemi.intensity = lerp(0.1, 1.25, daylight) * (1 - weather.sunDim * 0.25) + flash * 2;
    this.hemi.color.copy(this.look.sky).lerp(this.paleColor, 0.35).multiplyScalar(0.6 + 0.4 * daylight);
    this.zenithColor.copy(this.look.sky).multiplyScalar(daylight * this.look.density + 0.02);

    this.computeFogColor(daylight, cycle.sunElevation, weather, this.fogColor);
  }

  /** Schattenkarte neu anlegen (0 = Schatten aus). */
  setShadowQuality(size: number): void {
    if (size === this.shadowSize) return;
    this.shadowSize = size;
    this.sun.castShadow = size > 0;
    if (size > 0) this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  dispose(): void {
    this.disposer.dispose();
  }
}
