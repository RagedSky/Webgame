import { Color } from 'three';
import { clamp, clamp01 } from '@/math/utils';
import { vivid } from '@/render/stylize';
import type { Planet, Star } from '@/gen/universe/types';

export interface AtmosphereLook {
  /** Zenitfarbe bei Tag (linear). */
  sky: Color;
  /** Horizontfarbe bei Tag (linear). */
  horizon: Color;
  /** Streudichte 0..1,4 (0 = kein Himmel, nur Sterne). */
  density: number;
  /** Farbe der Sonne/des Lichts. */
  sun: Color;
}

/** Leitet Himmelsfarben aus Atmosphärenzusammensetzung und Sternfarbe ab. */
export function atmosphereLook(planet: Planet, star: Star): AtmosphereLook {
  const c = planet.atmosphere.composition;
  const sky = new Color(0.28, 0.5, 0.95);
  const horizon = new Color(0.75, 0.82, 0.95);
  const mix = (target: Color, targetHorizon: Color, amount: number): void => {
    sky.lerp(target, clamp01(amount));
    horizon.lerp(targetHorizon, clamp01(amount));
  };
  mix(new Color(0.78, 0.55, 0.32), new Color(0.95, 0.75, 0.5), ((c.CO2 ?? 0) - 0.1) * 1.4);
  mix(new Color(0.3, 0.62, 0.58), new Color(0.6, 0.85, 0.75), (c.CH4 ?? 0) * 2.2);
  mix(new Color(0.85, 0.7, 0.3), new Color(0.98, 0.85, 0.5), (c.SO2 ?? 0) * 3);
  mix(new Color(0.55, 0.6, 0.72), new Color(0.8, 0.82, 0.88), (c.NH3 ?? 0) * 2.5);
  const starLight = new Color(star.lightColor);
  sky.multiply(starLight);
  horizon.multiply(starLight);
  // Stilisierung: gesättigter Zenit, farbiger Dunst am Horizont
  vivid(sky, 1.35, 0.9);
  const hz = { h: 0, s: 0, l: 0 };
  horizon.getHSL(hz);
  horizon.setHSL(hz.h, Math.max(Math.min(1, hz.s * 1.7), 0.5), Math.min(hz.l, 0.76));
  const density = clamp(planet.atmosphere.density, 0, 1.4);
  const sun = new Color(star.lightColor);
  return { sky, horizon, density, sun };
}
