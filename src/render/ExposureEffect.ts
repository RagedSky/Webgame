import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}
`;

/**
 * Belichtung als Nachbearbeitungseffekt (linearer Faktor, 1 = unverändert). Die Belichtung des Renderers
 * (`toneMappingExposure`) wirkt nur beim direkten Zeichnen auf den Bildschirm, nicht in der Effektkette.
 */
export class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', FRAGMENT, { uniforms: new Map([['exposure', new Uniform(1)]]) });
  }

  get exposure(): number {
    return (this.uniforms.get('exposure') as Uniform<number>).value;
  }

  set exposure(value: number) {
    (this.uniforms.get('exposure') as Uniform<number>).value = value;
  }
}
