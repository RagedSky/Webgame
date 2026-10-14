/**
 * Minimaler Audio-Manager (Web Audio): prozedurale UI-Klänge (Auslöser, Bestätigung, Hinweis).
 * Der AudioContext wird erst nach einer Nutzergeste erzeugt. Ambient und Kreaturen folgen in Phase 10.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.6;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      return null;
    }
    return this.ctx;
  }

  /** Nach einer Nutzergeste aufrufen, damit der Kontext startet. */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain = 0.25, slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  private noise(duration: number, gain = 0.3): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      data[i] = ((seed / 4294967296) * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
  }

  /** Kamera-Auslöser: kurzer Klick + mechanisches Rauschen. */
  shutter(): void {
    this.noise(0.06, 0.35);
    this.tone(1800, 0.04, 'square', 0.12, 900);
    setTimeout(() => this.noise(0.05, 0.25), 70);
  }

  /** Erfolg (neuer Eintrag / Sterne). */
  success(stars = 1): void {
    const base = 520;
    for (let i = 0; i < Math.max(1, stars); i++) {
      setTimeout(() => this.tone(base * Math.pow(1.26, i), 0.18, 'triangle', 0.18), i * 110);
    }
  }

  blip(): void {
    this.tone(880, 0.06, 'sine', 0.12);
  }

  hint(): void {
    this.tone(330, 0.25, 'sine', 0.14, 440);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

export const audio = new AudioManager();
