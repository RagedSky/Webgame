import type { GameLoop } from '@/core/GameLoop';
import type { Renderer } from '@/render/Renderer';
import { el } from './dom';

/**
 * Debug-Overlay (F3): FPS, Frametime, Draw-Calls, Dreiecke, Szene, Seed und freie Zusatzwerte.
 * Aktualisiert sich alle 250 ms, um keine DOM-Last pro Frame zu erzeugen.
 */
export class DebugOverlay {
  readonly root: HTMLElement;
  private readonly lines = new Map<string, HTMLElement>();
  private visible: boolean;
  private accum = 0;
  private seed = '-';
  private sceneName = '-';
  private readonly extras = new Map<string, string>();
  private errorCount = 0;

  constructor(
    parent: HTMLElement,
    private readonly loop: GameLoop,
    private readonly renderer: Renderer,
    initiallyVisible: boolean,
  ) {
    this.visible = initiallyVisible;
    this.root = el('div', { class: 'debug-overlay', 'aria-hidden': 'true' });
    parent.append(this.root);
    for (const key of ['fps', 'frame', 'calls', 'tris', 'mem', 'res', 'scene', 'seed']) this.line(key);
    this.applyVisibility();
    window.addEventListener('error', (e) => this.reportError(e.message));
    window.addEventListener('unhandledrejection', (e) => this.reportError(String(e.reason)));
  }

  private line(key: string): HTMLElement {
    let node = this.lines.get(key);
    if (!node) {
      node = el('div', { class: 'debug-line' });
      this.root.append(node);
      this.lines.set(key, node);
    }
    return node;
  }

  setSeed(seed: string): void {
    this.seed = seed;
  }

  setScene(name: string): void {
    this.sceneName = name;
  }

  /** Freie Zusatzzeile (z. B. Chunks, Kreaturen). Leerer String entfernt die Zeile. */
  set(key: string, value: string): void {
    if (value === '') {
      this.extras.delete(key);
      this.lines.get(`x:${key}`)?.remove();
      this.lines.delete(`x:${key}`);
    } else {
      this.extras.set(key, value);
    }
  }

  reportError(message: string): void {
    this.errorCount++;
    const node = this.line('error');
    node.classList.add('debug-error');
    node.textContent = `Fehler (${this.errorCount}): ${message}`;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.applyVisibility();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private applyVisibility(): void {
    this.root.style.display = this.visible ? 'block' : 'none';
  }

  update(frameDt: number): void {
    if (!this.visible) return;
    this.accum += frameDt;
    if (this.accum < 0.25) return;
    this.accum = 0;
    const s = this.loop.stats;
    const info = this.renderer.info;
    const { width, height } = this.renderer.size;
    const pr = this.renderer.effectivePixelRatio;
    this.line('fps').textContent = `FPS ${s.fps.toFixed(0)}  (${s.frameMs.toFixed(1)} ms)`;
    this.line('frame').textContent = `Update ${s.updateMs.toFixed(2)} ms · Render ${s.renderMs.toFixed(2)} ms`;
    this.line('calls').textContent = `Draw-Calls ${info.render.calls} · Dreiecke ${info.render.triangles}`;
    this.line('mem').textContent = `Geometrien ${info.memory.geometries} · Texturen ${info.memory.textures}`;
    this.line('res').textContent = `Auflösung ${Math.round(width * pr)}×${Math.round(height * pr)} (Skalierung ${pr.toFixed(2)})`;
    this.line('scene').textContent = `Szene ${this.sceneName}`;
    this.line('seed').textContent = `Seed ${this.seed}`;
    for (const [k, v] of this.extras) this.line(`x:${k}`).textContent = `${k} ${v}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
