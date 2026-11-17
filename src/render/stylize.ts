/**
 * Stilisierung in Richtung „leuchtende Sci-Fi-Welt“: kräftigere Paletten, Kantenlicht in Himmelsfarbe und
 * zusammensetzbare Shader-Patches (mehrere Systeme dürfen dasselbe Material erweitern: Wind, Welt-UVs, Kantenlicht).
 * Die Uniforms sind global geteilt und werden von der Planetenszene pro Frame gesetzt.
 */
import { Color, Vector3, type Material, type WebGLProgramParametersWithUniforms } from 'three';
import { clamp } from '@/math/utils';

export const stylize = {
  /** Farbe des Kantenlichts (Himmel/Dunst), linear. */
  rimColor: { value: new Color(0.5, 0.7, 1) },
  rimStrength: { value: 0.5 },
  /** Kameraposition für entfernungsabhängige Effekte (Gras-Ausblendung). */
  camPos: { value: new Vector3() },
  grassFar: { value: 70 },
};

const hslTmp = { h: 0, s: 0, l: 0 };

/** Sättigung/Helligkeit einer Farbe in place anheben (Paletten kräftiger machen). */
export function vivid(color: Color, saturation = 1.3, lightness = 1): Color {
  color.getHSL(hslTmp);
  return color.setHSL(hslTmp.h, clamp(hslTmp.s * saturation, 0, 1), clamp(hslTmp.l * lightness, 0, 1));
}

type Patch = (shader: WebGLProgramParametersWithUniforms) => void;
interface Patched {
  __patches?: Array<{ key: string; patch: Patch }>;
}

/** Hängt einen Shader-Patch an ein Material an; mehrere Patches werden nacheinander ausgeführt. */
export function addShaderPatch(material: Material, key: string, patch: Patch): void {
  const data = material.userData as Patched;
  const list = (data.__patches ??= []);
  if (list.some((p) => p.key === key)) return;
  list.push({ key, patch });
  material.onBeforeCompile = (shader) => {
    for (const p of list) p.patch(shader);
  };
  material.customProgramCacheKey = () => list.map((p) => p.key).join('|');
  material.needsUpdate = true;
}

/** Kantenlicht (Fresnel) in Himmelsfarbe – lässt Formen vor dem Dunst leuchten. `amount` skaliert je Material. */
export function addRim(material: Material, amount = 1): void {
  addShaderPatch(material, `rim-${amount.toFixed(2)}`, (shader) => {
    shader.uniforms.uRimColor = stylize.rimColor;
    shader.uniforms.uRimStrength = stylize.rimStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace(
        '#include <opaque_fragment>',
        `{
  float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
  outgoingLight += uRimColor * rimF * uRimStrength * ${amount.toFixed(2)};
}
#include <opaque_fragment>`,
      );
  });
}
