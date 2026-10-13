/**
 * Spiel-Loop mit festem Simulationsschritt und variablem Render.
 * - update(dt) wird mit konstantem dt aufgerufen (Akkumulator), max. `maxSubSteps` pro Frame (Spiral-of-Death-Schutz).
 * - render(alpha, frameDt) einmal pro Animation-Frame.
 * - Keine Allokationen im Loop.
 */
export interface LoopStats {
  fps: number;
  frameMs: number;
  updateMs: number;
  renderMs: number;
  frames: number;
}

export class GameLoop {
  readonly fixedDt: number;
  readonly maxSubSteps: number;
  readonly stats: LoopStats = { fps: 0, frameMs: 0, updateMs: 0, renderMs: 0, frames: 0 };

  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private fpsAccumTime = 0;
  private fpsAccumFrames = 0;
  private frameMsAccum = 0;
  /** Optionale FPS-Obergrenze (0 = aus). */
  fpsLimit = 0;
  private limitAccum = 0;

  private updateFn: (dt: number) => void = () => {};
  private renderFn: (alpha: number, frameDt: number) => void = () => {};

  constructor(fixedHz = 60, maxSubSteps = 5) {
    this.fixedDt = 1 / fixedHz;
    this.maxSubSteps = maxSubSteps;
  }

  setCallbacks(update: (dt: number) => void, render: (alpha: number, frameDt: number) => void): void {
    this.updateFn = update;
    this.renderFn = render;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let frameDt = (now - this.lastTime) / 1000;
    if (frameDt > 0.25) frameDt = 0.25; // Tab war inaktiv o. ä.
    if (frameDt < 0) frameDt = 0;

    if (this.fpsLimit > 0) {
      this.limitAccum += frameDt;
      if (this.limitAccum < 1 / this.fpsLimit) {
        this.lastTime = now;
        return;
      }
      frameDt = this.limitAccum;
      this.limitAccum = 0;
    }
    this.lastTime = now;

    const t0 = performance.now();
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSubSteps) {
      this.updateFn(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps === this.maxSubSteps) this.accumulator = 0;
    const t1 = performance.now();
    const alpha = this.accumulator / this.fixedDt;
    this.renderFn(alpha, frameDt);
    const t2 = performance.now();

    // Statistik (geglättet über ~0,5 s)
    const s = this.stats;
    s.frames++;
    s.updateMs = t1 - t0;
    s.renderMs = t2 - t1;
    this.fpsAccumTime += frameDt;
    this.fpsAccumFrames++;
    this.frameMsAccum += frameDt * 1000;
    if (this.fpsAccumTime >= 0.5) {
      s.fps = this.fpsAccumFrames / this.fpsAccumTime;
      s.frameMs = this.frameMsAccum / this.fpsAccumFrames;
      this.fpsAccumTime = 0;
      this.fpsAccumFrames = 0;
      this.frameMsAccum = 0;
    }
  };
}
