import { ACESFilmicToneMapping, SRGBColorSpace, WebGLRenderer, type Camera, type Scene } from 'three';
import { EffectComposer, RenderPass } from 'postprocessing';
import { clamp } from '@/math/utils';

/**
 * Wrapper um den WebGLRenderer:
 * - Render-Skalierung (0,5–2,0) × devicePixelRatio (gedeckelt)
 * - Resize-Handling über ResizeObserver
 * - Composer-Fabrik für Postprocessing (pro Szene)
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly size = { width: 1, height: 1 };
  private _renderScale = 1;
  private _maxPixelRatio = 2;
  private readonly observer: ResizeObserver;
  private readonly resizeListeners = new Set<(w: number, h: number) => void>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = new WebGLRenderer({
      canvas,
      antialias: false, // AA kommt aus dem Composer (MSAA/SMAA), spart bei Postprocessing einen Pass
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.setClearColor(0x05070d, 1);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement ?? document.body);
    this.resize();
  }

  get renderScale(): number {
    return this._renderScale;
  }

  set renderScale(v: number) {
    this._renderScale = clamp(v, 0.5, 2);
    this.resize();
  }

  get maxPixelRatio(): number {
    return this._maxPixelRatio;
  }

  set maxPixelRatio(v: number) {
    this._maxPixelRatio = clamp(v, 0.5, 4);
    this.resize();
  }

  /** Effektiver Pixel-Faktor (DPR × Render-Skalierung). */
  get effectivePixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this._maxPixelRatio) * this._renderScale;
  }

  onResize(listener: (w: number, h: number) => void): () => void {
    this.resizeListeners.add(listener);
    return () => this.resizeListeners.delete(listener);
  }

  resize(): void {
    const parent = this.canvas.parentElement ?? document.body;
    const width = Math.max(1, parent.clientWidth || window.innerWidth);
    const height = Math.max(1, parent.clientHeight || window.innerHeight);
    this.size.width = width;
    this.size.height = height;
    this.gl.setPixelRatio(this.effectivePixelRatio);
    this.gl.setSize(width, height, false);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    for (const l of this.resizeListeners) l(width, height);
  }

  /** Erzeugt einen Composer mit RenderPass; Szenen hängen eigene Effekte an. */
  createComposer(scene: Scene, camera: Camera, multisampling = 4): EffectComposer {
    const composer = new EffectComposer(this.gl, { multisampling });
    composer.addPass(new RenderPass(scene, camera));
    return composer;
  }

  get info(): WebGLRenderer['info'] {
    return this.gl.info;
  }

  dispose(): void {
    this.observer.disconnect();
    this.resizeListeners.clear();
    this.gl.dispose();
  }
}
