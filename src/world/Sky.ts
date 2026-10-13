import type {
  PerspectiveCamera} from 'three';
import {
  BackSide,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Points,
  type PointsMaterial,
  type Scene,
} from 'three';
import { clamp01, lerp } from '@/math/utils';
import type { Planet, StarSystem } from '@/gen/universe/types';
import { Disposer } from '@/core/Disposer';
import { createStarfield } from '@/render/Starfield';
import { createPlanetTexture } from '@/render/PlanetTexture';
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
uniform vec2 uCloudOffset;
uniform float uFlash;
uniform float uDaylight;
uniform float uSunDim;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }

void main() {
  vec3 dir = normalize(vDir);
  float mu = dot(dir, uSunDir);
  float elev = uSunDir.y;
  float horizonMix = pow(1.0 - clamp(dir.y, 0.0, 1.0), 3.0);
  float daylight = uDaylight;

  vec3 sky = mix(uSky, uHorizon, horizonMix) * daylight;
  // Dämmerungsfarben um die Sonne
  float dusk = (1.0 - smoothstep(0.0, 0.32, abs(elev))) * smoothstep(-0.3, 0.05, elev);
  vec3 duskCol = uSunColor * vec3(1.0, 0.45, 0.2);
  sky += duskCol * dusk * pow(max(mu, 0.0), 2.5) * horizonMix * 2.2;
  sky += duskCol * dusk * 0.25 * horizonMix;
  // Mie-Glow
  float g = 0.86;
  float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  sky += uSunColor * phase * 0.015 * daylight;
  sky *= uDensity;
  // Sonnenscheibe (auch bei dünner Atmosphäre sichtbar)
  float disc = smoothstep(0.9994, 0.9999, mu);
  sky += uSunColor * disc * 4.0 * smoothstep(-0.03, 0.01, elev) * (1.0 - uSunDim * 0.8);
  // Nachtgrund
  vec3 night = vec3(0.012, 0.016, 0.035) * uDensity + vec3(0.002, 0.002, 0.004);
  sky += night * (1.0 - daylight);
  // Wolken
  if (uCloudiness > 0.01 && dir.y > -0.02) {
    vec2 cp = dir.xz / (dir.y + 0.18) * 1.4 + uCloudOffset;
    float n = fbm(cp) * 0.7 + fbm(cp * 3.1 + 7.3) * 0.3;
    float cover = smoothstep(1.0 - uCloudiness * 0.9, 1.0 - uCloudiness * 0.9 + 0.32, n);
    cover *= smoothstep(0.0, 0.14, dir.y) * uDensity;
    vec3 lit = (uHorizon * 0.9 + uSunColor * 0.5) * daylight;
    vec3 shade = uSky * 0.35 * daylight + night * 2.0;
    float thick = smoothstep(0.3, 1.0, n);
    vec3 cloud = mix(lit, shade, thick * (0.5 + 0.5 * uCloudiness));
    cloud += duskCol * dusk * 0.6 * max(mu, 0.0);
    sky = mix(sky, cloud, cover);
  }
  sky += vec3(uFlash) * 0.9;
  gl_FragColor = vec4(sky, 1.0);
}
`;

/**
 * Himmel: Kuppel-Shader (vereinfachte Rayleigh/Mie-Optik, Wolken, Dämmerung), Sterne, Monde,
 * optional Gasriese am Himmel, Sonnenlicht (mit Schatten) und Hemisphärenlicht.
 * `update()` berechnet außerdem Nebelfarbe und Lichtstärken aus Tageszeit und Wetter.
 */
export class Sky {
  readonly group = new Group();
  readonly sun: DirectionalLight;
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
  private readonly moons: Array<{ mesh: Mesh; period: number; phase: number }> = [];
  private readonly giant: Mesh | null = null;
  private readonly tmpDir = new Vector3();
  private cloudOffset = { x: 0, y: 0 };
  readonly radius: number;

  constructor(scene: Scene, system: StarSystem, planet: Planet, radius = 1500) {
    this.radius = radius;
    this.look = atmosphereLook(planet, system.star);
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
          uCloudOffset: { value: { x: 0, y: 0 } },
          uFlash: { value: 0 },
          uDaylight: { value: 1 },
          uSunDim: { value: 0 },
        },
      }),
    );
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

    planet.moons.forEach((moon, i) => {
      const r = 14 + Math.log2(1 + moon.radiusKm / 300) * 9;
      const mg = this.disposer.add(new SphereGeometry(r, 24, 16));
      const mm = this.disposer.add(new MeshStandardMaterial({ color: moon.color, roughness: 1, fog: false }));
      const mesh = new Mesh(mg, mm);
      mesh.renderOrder = -8;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.moons.push({ mesh, period: Math.max(0.6, moon.orbitPeriodDays), phase: (i * 0.37 + 0.2) % 1 });
    });

    const giant = planet.type !== 'gas_giant' ? system.planets.find((p) => p.type === 'gas_giant') : undefined;
    if (giant) {
      const gr = 190;
      const gg = this.disposer.add(new SphereGeometry(gr, 32, 24));
      const tex = this.disposer.add(createPlanetTexture(giant));
      const gm = this.disposer.add(new MeshStandardMaterial({ map: tex, roughness: 1, fog: false }));
      const mesh = new Mesh(gg, gm);
      mesh.renderOrder = -8;
      mesh.frustumCulled = false;
      const dir = new Vector3(Math.cos(1.1), Math.sin(0.55), Math.sin(1.1)).normalize();
      mesh.position.copy(dir.multiplyScalar(radius * 0.92));
      mesh.rotation.z = 0.4;
      this.group.add(mesh);
      this.giant = mesh;
    }

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

  /** Nebel-/Horizontfarbe (linear) für die aktuelle Tageszeit – kleine CPU-Kopie des Shaders. */
  private computeFogColor(daylight: number, elev: number, weather: WeatherParams, out: Color): Color {
    out.copy(this.look.horizon).multiplyScalar(daylight * this.look.density);
    const dusk = (1 - clamp01(Math.abs(elev) / 0.32)) * clamp01((elev + 0.3) / 0.35);
    out.r += this.look.sun.r * 0.35 * dusk * this.look.density;
    out.g += this.look.sun.g * 0.16 * dusk * this.look.density;
    out.b += this.look.sun.b * 0.08 * dusk * this.look.density;
    out.lerp(new Color(0.55, 0.58, 0.62).multiplyScalar(daylight * this.look.density + 0.02), clamp01((weather.fog - 1) / 6) * 0.8);
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
    (u.uCloudOffset!.value as { x: number; y: number }).x = this.cloudOffset.x;
    (u.uCloudOffset!.value as { x: number; y: number }).y = this.cloudOffset.y;

    // Sterne: nachts und bei dünner Atmosphäre
    const starMat = this.stars.material as PointsMaterial;
    starMat.opacity = clamp01(1 - daylight * Math.min(1, this.look.density * 1.1)) * (1 - weather.cloudiness * 0.85);
    this.stars.rotation.y = cycle.t * Math.PI * 2 * 0.1;

    // Monde (+ Finsternis-Erkennung)
    this.eclipse = false;
    for (const m of this.moons) {
      const phase = (m.phase + cycle.totalDays / m.period) % 1;
      cycle.directionAtPhase(phase, this.tmpDir);
      m.mesh.position.copy(this.tmpDir).multiplyScalar(this.radius * 0.93);
      m.mesh.visible = this.tmpDir.y > -0.1;
      if (cycle.sunElevation > 0 && this.tmpDir.dot(cycle.sunDir) > 0.9993) this.eclipse = true;
    }
    if (this.giant) this.giant.rotation.y += dt * 0.01;

    // Licht
    const sunStrength = clamp01((cycle.sunElevation + 0.05) / 0.4) * (1 - weather.sunDim * 0.85);
    this.sun.intensity = 0.15 + 2.6 * sunStrength;
    const warm = clamp01(1 - Math.abs(cycle.sunElevation) / 0.3);
    this.sun.color.copy(this.look.sun).lerp(new Color(1, 0.5, 0.25), warm * 0.6 * clamp01(cycle.sunElevation + 0.3));
    this.sun.position.copy(playerPos).addScaledVector(cycle.sunDir, 300);
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();
    this.sun.visible = cycle.sunElevation > -0.2;
    this.hemi.intensity = lerp(0.1, 1.25, daylight) * (1 - weather.sunDim * 0.25) + flash * 2;
    this.hemi.color.copy(this.look.sky).lerp(new Color(0.8, 0.85, 0.95), 0.35).multiplyScalar(0.6 + 0.4 * daylight);
    this.zenithColor.copy(this.look.sky).multiplyScalar(daylight * this.look.density + 0.02);

    this.computeFogColor(daylight, cycle.sunElevation, weather, this.fogColor);
  }

  dispose(): void {
    this.disposer.dispose();
  }
}
