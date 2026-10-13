import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Points, PointsMaterial, Vector3 } from 'three';
import { Random } from '@/math/Random';
import type { PrecipitationKind } from './Weather';

interface KindDef {
  color: string;
  size: number;
  speed: number;
  sway: number;
  opacity: number;
  additive: boolean;
}

const KINDS: Record<Exclude<PrecipitationKind, 'none'>, KindDef> = {
  rain: { color: '#9fc4ff', size: 0.09, speed: 18, sway: 0.4, opacity: 0.55, additive: true },
  snow: { color: '#ffffff', size: 0.16, speed: 1.6, sway: 1.2, opacity: 0.85, additive: false },
  ash: { color: '#6b6560', size: 0.14, speed: 1.2, sway: 0.8, opacity: 0.8, additive: false },
  acid: { color: '#b8ff5a', size: 0.09, speed: 16, sway: 0.4, opacity: 0.55, additive: true },
  crystal: { color: '#d8b8ff', size: 0.12, speed: 9, sway: 0.5, opacity: 0.8, additive: true },
  methane: { color: '#8aa0ff', size: 0.1, speed: 6, sway: 0.5, opacity: 0.6, additive: true },
  sand: { color: '#d9b56a', size: 0.12, speed: 0.6, sway: 6, opacity: 0.5, additive: false },
};

/** Weiche, runde Partikeltextur (radialer Verlauf), einmal pro Instanz erzeugt. */
function createParticleTexture(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/**
 * Niederschlag als Punktwolke um die Kamera (Box 60×36×60 m). Partikel werden pro Frame
 * auf der CPU bewegt; kein GC im Loop (feste Arrays).
 */
export class Precipitation {
  readonly points: Points;
  private readonly count: number;
  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly material: PointsMaterial;
  private readonly texture: CanvasTexture;
  private kind: PrecipitationKind = 'none';
  private readonly box = new Vector3(60, 36, 60);
  private intensity = 0;
  private wind = 0;
  private time = 0;

  constructor(count = 2400, seed = 'precip') {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.phases = new Float32Array(count);
    const rng = new Random(seed);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (rng.next() - 0.5) * this.box.x;
      this.positions[i * 3 + 1] = (rng.next() - 0.5) * this.box.y;
      this.positions[i * 3 + 2] = (rng.next() - 0.5) * this.box.z;
      this.phases[i] = rng.next() * Math.PI * 2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    this.texture = createParticleTexture();
    this.material = new PointsMaterial({ size: 0.1, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true, map: this.texture, alphaTest: 0.02 });
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 5;
  }

  setKind(kind: PrecipitationKind, intensity: number, wind: number): void {
    this.intensity = intensity;
    this.wind = wind;
    if (kind !== this.kind) {
      this.kind = kind;
      if (kind !== 'none') {
        const def = KINDS[kind];
        this.material.color = new Color(def.color);
        this.material.size = def.size;
        this.material.blending = def.additive ? AdditiveBlending : 1;
        this.material.needsUpdate = true;
      }
    }
    this.points.visible = kind !== 'none' && intensity > 0.02;
    if (kind !== 'none') this.material.opacity = KINDS[kind].opacity * Math.min(1, intensity);
  }

  update(dt: number, cameraPos: Vector3): void {
    if (!this.points.visible || this.kind === 'none') return;
    const def = KINDS[this.kind];
    this.time += dt;
    const pos = this.positions;
    const hx = this.box.x / 2;
    const hy = this.box.y / 2;
    const hz = this.box.z / 2;
    const fall = def.speed * dt;
    const drift = (this.wind * 4 + 0.5) * dt;
    const active = Math.floor(this.count * Math.min(1, this.intensity));
    for (let i = 0; i < active; i++) {
      const o = i * 3;
      const ph = this.phases[i] as number;
      pos[o] = (pos[o] as number) + drift + Math.sin(this.time * 1.3 + ph) * def.sway * dt;
      pos[o + 1] = (pos[o + 1] as number) - fall;
      pos[o + 2] = (pos[o + 2] as number) + Math.cos(this.time * 0.9 + ph) * def.sway * 0.5 * dt;
      if ((pos[o + 1] as number) < -hy) pos[o + 1] = hy;
      if ((pos[o] as number) > hx) pos[o] = -hx;
      if ((pos[o] as number) < -hx) pos[o] = hx;
      if ((pos[o + 2] as number) > hz) pos[o + 2] = -hz;
      if ((pos[o + 2] as number) < -hz) pos[o + 2] = hz;
    }
    // Inaktive Partikel aus dem Sichtfeld schieben
    for (let i = active; i < this.count; i++) pos[i * 3 + 1] = -1000;
    this.points.position.copy(cameraPos);
    (this.points.geometry.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.points.removeFromParent();
  }
}
