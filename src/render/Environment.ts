/**
 * Umgebungslicht (IBL) aus einem prozeduralen Himmelsverlauf: eine kleine Kugel-Szene wird per PMREM vorgefiltert und als
 * `scene.environment` verwendet. Damit bekommen PBR-Materialien (Visier, Schuppen, Metall, Kristall) echte Reflexe statt
 * nur Richtungslicht. Die Planetenszene erneuert die Karte bei Tageszeit-/Wetterwechsel, Editor und Werft nutzen ein Studio.
 */
import { BackSide, Color, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';

export interface EnvLook {
  sky: Color;
  horizon: Color;
  ground: Color;
  sunDir: Vector3;
  sunColor: Color;
  /** Helligkeit der Sonnenscheibe im Umgebungslicht (0 = keine). */
  sunIntensity: number;
}

const VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = d.y >= 0.0 ? mix(uHorizon, uSky, smoothstep(0.0, 0.55, d.y)) : mix(uHorizon, uGround, smoothstep(0.0, 0.35, -d.y));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 300.0) * uSunIntensity + pow(s, 6.0) * uSunIntensity * 0.06);
  gl_FragColor = vec4(col, 1.0);
}`;

export class EnvironmentMap {
  private readonly pmrem: PMREMGenerator;
  private readonly scene = new Scene();
  private readonly material: ShaderMaterial;
  private readonly geometry = new SphereGeometry(10, 32, 16);
  private target: WebGLRenderTarget | null = null;

  constructor(renderer: WebGLRenderer) {
    this.pmrem = new PMREMGenerator(renderer);
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uSky: { value: new Color(0.3, 0.5, 0.9) },
        uHorizon: { value: new Color(0.7, 0.75, 0.8) },
        uGround: { value: new Color(0.2, 0.18, 0.15) },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color(1, 0.95, 0.85) },
        uSunIntensity: { value: 4 },
      },
    });
    this.scene.add(new Mesh(this.geometry, this.material));
  }

  /** Neue Umgebung rendern; die vorherige Karte wird freigegeben. */
  update(look: EnvLook): Texture {
    const u = this.material.uniforms;
    (u.uSky!.value as Color).copy(look.sky);
    (u.uHorizon!.value as Color).copy(look.horizon);
    (u.uGround!.value as Color).copy(look.ground);
    (u.uSunDir!.value as Vector3).copy(look.sunDir).normalize();
    (u.uSunColor!.value as Color).copy(look.sunColor);
    u.uSunIntensity!.value = look.sunIntensity;
    const next = this.pmrem.fromScene(this.scene, 0.04);
    this.target?.dispose();
    this.target = next;
    return next.texture;
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.material.dispose();
    this.geometry.dispose();
    this.pmrem.dispose();
  }
}

/** Neutrales Studio (kühler Himmel, warme Sonne von schräg oben) für Charakter-Editor und Werft. */
export function studioLook(): EnvLook {
  return { sky: new Color(0.35, 0.45, 0.7), horizon: new Color(0.55, 0.58, 0.66), ground: new Color(0.12, 0.11, 0.1), sunDir: new Vector3(2.5, 4, 3), sunColor: new Color(1, 0.93, 0.85), sunIntensity: 5 };
}
