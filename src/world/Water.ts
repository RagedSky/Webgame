import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type Scene } from 'three';
import type { Planet } from '@/gen/universe/types';

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormal;
#include <fog_pars_vertex>
float wave(vec2 p, float t) {
  return sin(p.x * 0.08 + t * 1.1) * 0.22 + sin(p.y * 0.11 - t * 0.9) * 0.18 + sin((p.x + p.y) * 0.05 + t * 0.6) * 0.28 + sin(p.x * 0.31 - p.y * 0.27 + t * 1.9) * 0.05;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float t = uTime;
  float h = wave(wp.xz, t);
  float e = 0.6;
  float hx = wave(wp.xz + vec2(e, 0.0), t);
  float hz = wave(wp.xz + vec2(0.0, e), t);
  wp.y += h;
  vNormal = normalize(vec3(h - hx, e, h - hz));
  vWorldPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uWaterColor;
uniform vec3 uDeepColor;
uniform float uDaylight;
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormal;
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  // leichte Oberflächen-Textur
  float rip = sin(vWorldPos.x * 1.7 + uTime * 2.0) * sin(vWorldPos.z * 1.3 - uTime * 1.6) * 0.5 + 0.5;
  vec3 base = mix(uDeepColor, uWaterColor, 0.3 + rip * 0.2) * 0.55;
  vec3 col = mix(base * (0.12 + 0.88 * uDaylight), uSkyColor * 0.8, fres * 0.55);
  vec3 h = normalize(uSunDir + v);
  float spec = pow(max(dot(n, h), 0.0), 220.0) * clamp(uSunDir.y * 4.0, 0.0, 1.0);
  col += uSunColor * spec * 1.2;
  float alpha = 0.8 + fres * 0.18;
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`;

/** Wasserfläche auf Meereshöhe: folgt der Kamera (rasterbündig), einfache Wellen, Fresnel, Glanz, Nebel. */
export class Water {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  readonly level: number;

  constructor(scene: Scene, planet: Planet, level: number, size = 3600) {
    this.level = level;
    const geo = new PlaneGeometry(size, size, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const palette = planet.biomes.find((b) => b.hasWater)?.palette;
    const waterColor = new Color(planet.type === 'toxic' ? '#5a6a9a' : planet.type === 'ice' ? '#3a6a8a' : (palette?.ground ?? '#2f6f9a'));
    const deep = waterColor.clone().multiplyScalar(0.35);
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Color(1, 1, 1) },
          uSkyColor: { value: new Color(0.4, 0.6, 0.9) },
          uWaterColor: { value: waterColor },
          uDeepColor: { value: deep },
          uDaylight: { value: 1 },
        },
      ]),
    });
    this.mesh = new Mesh(geo, this.material);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(time: number, cameraPos: Vector3, sunDir: Vector3, sunColor: Color, skyColor: Color, daylight: number): void {
    const u = this.material.uniforms;
    u.uTime!.value = time;
    (u.uSunDir!.value as Vector3).copy(sunDir);
    (u.uSunColor!.value as Color).copy(sunColor);
    (u.uSkyColor!.value as Color).copy(skyColor);
    u.uDaylight!.value = daylight;
    const snap = 40;
    this.mesh.position.set(Math.round(cameraPos.x / snap) * snap, this.level, Math.round(cameraPos.z / snap) * snap);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
