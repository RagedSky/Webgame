import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import { Random } from '@/math/Random';
import type { Disposer } from '@/core/Disposer';

/** Deterministisches Sternenfeld als Points-Wolke (Hintergrund für Menü und Systemansicht). */
export function createStarfield(disposer: Disposer, seed: string, count = 2500, radius: [number, number] = [60, 200]): Points {
  const rng = new Random(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tmp = new Color();
  for (let i = 0; i < count; i++) {
    const r = radius[0] + rng.next() * (radius[1] - radius[0]);
    const theta = rng.next() * Math.PI * 2;
    const phi = Math.acos(2 * rng.next() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    tmp.setHSL(rng.float(0.55, 0.68), rng.float(0.1, 0.5), rng.float(0.55, 0.95));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  const geo = disposer.add(new BufferGeometry());
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const mat = disposer.add(
    new PointsMaterial({ size: 1.4, vertexColors: true, sizeAttenuation: true, blending: AdditiveBlending, depthWrite: false }),
  );
  return new Points(geo, mat);
}
