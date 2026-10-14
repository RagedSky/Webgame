/**
 * Audio-Manager (Web Audio, vollständig prozedural, keine Dateien):
 * - Busse: Master → Effekte / Ambient / Musik mit eigenen Lautstärken
 * - Ambient-Schichten (Wind, Wasser, Regen, Nachtleben, Grundton, Lava) aus `ambientMix` mit weichen Übergängen
 * - Kreaturenrufe aus Körperwerten (Größe, Bedeckung, Fortbewegung) mit Entfernung und Stereo-Position
 * - Schritte je Untergrund, Kamera-Auslöser, UI-Klänge, Start-Grollen
 * - Musik-Platzhalter: langsam gleitende Akkordflächen je Stimmung (Menü, Tag, Nacht, Orbit)
 * Der AudioContext entsteht erst nach einer Nutzergeste (`unlock`). Zufall kommt aus dem seedbaren PRNG.
 */
import { Random } from '@/math/Random';
import { clamp } from '@/math/utils';
import type { AmbientMix, FootSurface } from './ambientMix';

export interface AudioVolumes {
  master: number;
  sfx: number;
  ambient: number;
  music: number;
}

export type MusicMood = 'menu' | 'day' | 'night' | 'space';
export type { FootSurface };

export interface CreatureVoice {
  lengthM: number;
  covering: string;
  locomotion: string;
  /** Entfernung in Metern. */
  distance: number;
  /** Stereo-Position −1..1 (links..rechts). */
  pan: number;
}

interface Layer {
  gain: GainNode;
  target: number;
}

const NOTE = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
/** Akkorde je Stimmung (MIDI-Nummern), jeweils drei Stimmen. */
const CHORDS: Record<MusicMood, number[][]> = {
  menu: [
    [45, 52, 60],
    [41, 48, 57],
    [43, 50, 59],
    [40, 47, 55],
  ],
  day: [
    [48, 55, 64],
    [45, 52, 60],
    [41, 48, 57],
    [43, 50, 62],
  ],
  night: [
    [38, 45, 53],
    [34, 41, 50],
    [36, 43, 51],
    [33, 40, 48],
  ],
  space: [
    [40, 47, 54],
    [37, 44, 52],
    [33, 40, 47],
    [35, 42, 49],
  ],
};
const CHORD_SECONDS = 14;
const MUSIC_LEVEL = 0.16;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private busSfx: GainNode | null = null;
  private busAmbient: GainNode | null = null;
  private busMusic: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly rng = new Random('audio');
  readonly volumes: AudioVolumes = { master: 0.8, sfx: 1, ambient: 0.8, music: 0.5 };

  // Ambient
  private layers: Record<keyof AmbientMix, Layer> | null = null;
  private pendingMix: AmbientMix | null = null;
  private insectsLevel = 0;
  private insectTimer = 2;

  // Musik
  private musicVoices: OscillatorNode[] = [];
  private musicGain: GainNode | null = null;
  private musicMood: MusicMood | null = null;
  private musicTimer = 0;
  private chordIndex = 0;

  // Kreaturen
  private activeCalls = 0;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.busSfx = ctx.createGain();
      this.busAmbient = ctx.createGain();
      this.busMusic = ctx.createGain();
      this.busSfx.connect(this.master);
      this.busAmbient.connect(this.master);
      this.busMusic.connect(this.master);
      this.applyVolumes();
    } catch {
      return null;
    }
    return this.ctx;
  }

  /** Nach einer Nutzergeste aufrufen, damit der Kontext startet (nachgeholte Ambient/Musik-Wünsche werden angewendet). */
  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.pendingMix) {
      const mix = this.pendingMix;
      this.pendingMix = null;
      this.setAmbient(mix);
    }
    if (this.musicMood && this.musicVoices.length === 0) this.startMusic(this.musicMood);
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setVolumes(v: Partial<AudioVolumes>): void {
    Object.assign(this.volumes, v);
    for (const k of Object.keys(this.volumes) as (keyof AudioVolumes)[]) this.volumes[k] = clamp(this.volumes[k], 0, 1);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const t = this.ctx?.currentTime ?? 0;
    const v = this.volumes;
    // Lautstärke-Kurve: wahrgenommen linear (quadratisch)
    this.master?.gain.setTargetAtTime(v.master * v.master, t, 0.05);
    this.busSfx?.gain.setTargetAtTime(v.sfx * v.sfx, t, 0.05);
    this.busAmbient?.gain.setTargetAtTime(v.ambient * v.ambient, t, 0.05);
    this.busMusic?.gain.setTargetAtTime(v.music * v.music, t, 0.05);
  }

  private noise(): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private loopNoise(): AudioBufferSourceNode {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    src.start();
    return src;
  }

  private lfo(freq: number, depth: number, target: AudioParam): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g).connect(target);
    osc.start();
  }

  private buildLayers(): Record<keyof AmbientMix, Layer> {
    const ctx = this.ctx as AudioContext;
    const bus = this.busAmbient as GainNode;
    const layer = (): Layer => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(bus);
      return { gain, target: 0 };
    };

    // Wind: tiefpassgefiltertes Rauschen, Filterfrequenz und Lautstärke schwanken langsam (Böen)
    const wind = layer();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    this.lfo(0.07, 220, windFilter.frequency);
    const gust = ctx.createGain();
    gust.gain.value = 0.7;
    this.lfo(0.11, 0.3, gust.gain);
    this.loopNoise().connect(windFilter).connect(gust).connect(wind.gain);

    // Wasser: Bandpass-Rauschen mit Wellenrhythmus
    const water = layer();
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = 'bandpass';
    waterFilter.frequency.value = 900;
    waterFilter.Q.value = 0.5;
    const wave = ctx.createGain();
    wave.gain.value = 0.55;
    this.lfo(0.33, 0.4, wave.gain);
    this.loopNoise().connect(waterFilter).connect(wave).connect(water.gain);

    // Regen: helles Rauschen
    const rain = layer();
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 2200;
    this.loopNoise().connect(rainFilter).connect(rain.gain);

    // Grundton: zwei leicht verstimmte Sinus (Planet/Höhle/Unterwasser)
    const drone = layer();
    for (const f of [48, 72.3]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(drone.gain);
      osc.start();
    }

    // Lava: sehr tiefes Rauschen, brodelnd
    const lava = layer();
    const lavaFilter = ctx.createBiquadFilter();
    lavaFilter.type = 'lowpass';
    lavaFilter.frequency.value = 140;
    const bubble = ctx.createGain();
    bubble.gain.value = 0.8;
    this.lfo(0.3, 0.5, bubble.gain);
    this.loopNoise().connect(lavaFilter).connect(bubble).connect(lava.gain);

    // Nachtleben wird aus `update` als einzelne Zirpen erzeugt, der Layer hält nur den Pegel.
    const insects = layer();
    return { wind, water, rain, insects, drone, lava };
  }

  /** Ziel-Pegel der Ambient-Schichten setzen (weiche Übergänge ~1 s). */
  setAmbient(mix: AmbientMix): void {
    if (!this.ctx || !this.busAmbient) {
      this.pendingMix = mix;
      return;
    }
    this.layers ??= this.buildLayers();
    const t = this.ctx.currentTime;
    const scale: Record<keyof AmbientMix, number> = { wind: 0.5, water: 0.4, rain: 0.35, insects: 1, drone: 0.25, lava: 0.45 };
    for (const key of Object.keys(this.layers) as (keyof AmbientMix)[]) {
      const l = this.layers[key];
      const v = mix[key] * scale[key];
      if (Math.abs(v - l.target) < 0.005) continue;
      l.target = v;
      l.gain.gain.setTargetAtTime(v, t, 0.9);
    }
    this.insectsLevel = mix.insects;
  }

  /** Ambient aus (Szenenwechsel). */
  clearAmbient(): void {
    this.pendingMix = null;
    this.insectsLevel = 0;
    if (!this.layers || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const l of Object.values(this.layers)) {
      l.target = 0;
      l.gain.gain.setTargetAtTime(0, t, 0.4);
    }
  }

  /** Zeit fortschreiben: Zirpen des Nachtlebens, Akkordwechsel der Musik. */
  update(dt: number): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.insectsLevel > 0.02 && this.layers) {
      this.insectTimer -= dt;
      if (this.insectTimer <= 0) {
        this.insectTimer = this.rng.float(0.3, 2.6) / (0.2 + this.insectsLevel);
        this.chirp(this.layers.insects.gain, this.insectsLevel);
      }
    }
    if (this.musicMood && this.musicVoices.length) {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = CHORD_SECONDS * this.rng.float(0.85, 1.2);
        this.nextChord();
      }
    }
  }

  private chirp(dest: AudioNode, level: number): void {
    const ctx = this.ctx as AudioContext;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = this.rng.float(2400, 4600);
    osc.frequency.value = f;
    this.lfo(this.rng.float(18, 40), f * 0.02, osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    const pulses = this.rng.int(2, 7);
    const step = this.rng.float(0.05, 0.09);
    const amp = 0.05 * (0.4 + level * 0.6);
    for (let k = 0; k < pulses; k++) {
      const t = t0 + k * step;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.012);
      g.gain.linearRampToValueAtTime(0.0001, t + step * 0.7);
    }
    const panner = this.pan(this.rng.float(-0.8, 0.8));
    osc.connect(g).connect(panner ?? dest);
    panner?.connect(dest);
    osc.start(t0);
    osc.stop(t0 + pulses * step + 0.05);
  }

  private pan(value: number): StereoPannerNode | null {
    const ctx = this.ctx as AudioContext;
    if (typeof ctx.createStereoPanner !== 'function') return null;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(value, -1, 1);
    return p;
  }

  /** Ruf einer Kreatur: Tonhöhe aus der Größe, Klangfarbe aus Bedeckung/Fortbewegung. */
  creatureCall(v: CreatureVoice): void {
    const ctx = this.ctx;
    if (!ctx || !this.busSfx || ctx.state !== 'running' || this.activeCalls >= 3) return;
    const att = 1 / (1 + Math.pow(v.distance / 18, 2));
    if (att < 0.02) return;
    this.activeCalls++;
    const t0 = ctx.currentTime;
    const base = clamp(1100 / (0.3 + v.lengthM), 80, 2200) * this.rng.float(0.85, 1.2);
    const type: OscillatorType = v.covering === 'chitin' ? 'square' : v.covering === 'fur' || v.covering === 'feathers' ? 'triangle' : v.covering === 'scales' ? 'sawtooth' : 'sine';
    const osc = ctx.createOscillator();
    osc.type = type;
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'square' ? 'bandpass' : 'lowpass';
    filter.frequency.value = type === 'square' ? base * 2 : Math.min(6000, base * 3.5);
    filter.Q.value = type === 'square' ? 2 : 0.8;
    if (v.locomotion === 'air') this.lfo(this.rng.float(5, 9), base * 0.03, osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    const notes = this.rng.int(2, 5);
    const ratios = [1, 1.25, 1.5, 0.8, 2, 0.67, 1.19];
    let t = t0;
    let f = base;
    osc.frequency.setValueAtTime(f, t0);
    const peak = 0.22 * att * (type === 'sine' ? 1.4 : 1);
    for (let n = 0; n < notes; n++) {
      const dur = this.rng.float(0.08, 0.32);
      g.gain.linearRampToValueAtTime(peak, t + 0.02);
      g.gain.linearRampToValueAtTime(peak * 0.5, t + dur);
      f = clamp(f * this.rng.pick(ratios), 60, 4000);
      osc.frequency.exponentialRampToValueAtTime(f, t + dur);
      t += dur + this.rng.float(0.02, 0.12);
    }
    g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
    const panner = this.pan(v.pan);
    osc.connect(filter).connect(g).connect(panner ?? this.busSfx);
    panner?.connect(this.busSfx);
    osc.onended = () => {
      this.activeCalls = Math.max(0, this.activeCalls - 1);
    };
    osc.start(t0);
    osc.stop(t + 0.15);
  }

  private burst(duration: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1, dest: AudioNode | null = this.busSfx): void {
    const ctx = this.ctx;
    if (!ctx || !dest) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(dest);
    src.start(t, this.rng.float(0, 1.5), duration + 0.05);
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain = 0.25, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.busSfx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g).connect(this.busSfx);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  /** Schritt auf einem Untergrund; `loudness` 0..1 (Sprint lauter, Ducken leiser). */
  footstep(surface: FootSurface, loudness = 0.6): void {
    if (!this.ready) return;
    const g = 0.14 * (0.4 + loudness * 0.6) * this.rng.float(0.85, 1.15);
    switch (surface) {
      case 'rock':
        this.burst(0.07, g, 'bandpass', 900 * this.rng.float(0.9, 1.1), 1.2);
        this.tone(170, 0.03, 'sine', g * 0.6);
        break;
      case 'sand':
        this.burst(0.12, g * 0.7, 'lowpass', 700, 0.7);
        break;
      case 'grass':
        this.burst(0.08, g * 0.8, 'bandpass', 1800, 0.9);
        break;
      case 'snow':
        this.burst(0.09, g * 0.9, 'lowpass', 520, 0.7);
        setTimeout(() => this.burst(0.06, g * 0.5, 'lowpass', 420, 0.7), 40);
        break;
      case 'water':
        this.burst(0.18, g * 1.1, 'bandpass', 1200, 0.6);
        this.tone(240, 0.08, 'sine', g * 0.3, 120);
        break;
      case 'metal':
        this.tone(320, 0.09, 'triangle', g * 0.7);
        this.burst(0.05, g * 0.6, 'highpass', 1500, 1);
        break;
    }
  }

  /** Kamera-Auslöser: kurzer Klick + mechanisches Rauschen. */
  shutter(): void {
    if (!this.ensure()) return;
    this.burst(0.06, 0.35, 'highpass', 1800);
    this.tone(1800, 0.04, 'square', 0.12, 900);
    setTimeout(() => this.burst(0.05, 0.25, 'highpass', 1800), 70);
  }

  /** Erfolg (neuer Eintrag / Sterne). */
  success(stars = 1): void {
    if (!this.ensure()) return;
    const base = 520;
    for (let i = 0; i < Math.max(1, stars); i++) {
      setTimeout(() => this.tone(base * Math.pow(1.26, i), 0.18, 'triangle', 0.18), i * 110);
    }
  }

  blip(): void {
    if (!this.ensure()) return;
    this.tone(880, 0.06, 'sine', 0.12);
  }

  hint(): void {
    if (!this.ensure()) return;
    this.tone(330, 0.25, 'sine', 0.14, 440);
  }

  /** Fehler/abgelehnte Aktion. */
  error(): void {
    if (!this.ensure()) return;
    this.tone(220, 0.12, 'square', 0.08, 160);
  }

  /** Tutorial-Schritt erledigt. */
  tick(): void {
    if (!this.ensure()) return;
    this.tone(1320, 0.07, 'sine', 0.1);
    setTimeout(() => this.tone(1760, 0.1, 'sine', 0.1), 70);
  }

  /** Tiefes Grollen (Triebwerk/Start): schwillt an und ab. */
  rumble(seconds: number, peak = 0.6): void {
    const ctx = this.ctx;
    if (!ctx || !this.busSfx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 90;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + seconds * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + seconds + 0.1);
  }

  /** Musik-Platzhalter starten oder Stimmung wechseln (null = aus). */
  setMusic(mood: MusicMood | null): void {
    if (mood === this.musicMood && (mood === null || this.musicVoices.length)) return;
    if (mood === null) {
      this.stopMusic();
      return;
    }
    if (this.musicVoices.length) {
      // Stimmung wechseln: gleiche Stimmen, neue Akkorde
      this.musicMood = mood;
      this.chordIndex = 0;
      this.nextChord();
      return;
    }
    this.musicMood = mood;
    this.startMusic(mood);
  }

  private startMusic(mood: MusicMood): void {
    const ctx = this.ctx;
    if (!ctx || !this.busMusic || ctx.state !== 'running') return;
    this.musicMood = mood;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    this.lfo(0.05, 300, filter.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(MUSIC_LEVEL, ctx.currentTime, 2.5);
    filter.connect(gain).connect(this.busMusic);
    this.musicGain = gain;
    const chord = CHORDS[mood][0] as number[];
    this.musicVoices = [];
    for (let i = 0; i < 3; i++) {
      for (const detune of [0, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = NOTE(chord[i] as number);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = i === 2 ? 0.22 : 0.3;
        osc.connect(g).connect(filter);
        osc.start();
        this.musicVoices.push(osc);
      }
    }
    this.chordIndex = 0;
    this.musicTimer = CHORD_SECONDS;
  }

  private nextChord(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicMood) return;
    const chords = CHORDS[this.musicMood];
    this.chordIndex = (this.chordIndex + 1) % chords.length;
    const chord = chords[this.chordIndex] as number[];
    const t = ctx.currentTime;
    this.musicVoices.forEach((osc, idx) => {
      const note = chord[Math.floor(idx / 2)] as number;
      osc.frequency.setTargetAtTime(NOTE(note), t, 1.6);
    });
  }

  stopMusic(): void {
    this.musicMood = null;
    const ctx = this.ctx;
    const voices = this.musicVoices;
    const gain = this.musicGain;
    this.musicVoices = [];
    this.musicGain = null;
    if (!ctx || !gain) return;
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 1.2);
    const stopAt = ctx.currentTime + 4;
    for (const v of voices) v.stop(stopAt);
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.busSfx = null;
    this.busAmbient = null;
    this.busMusic = null;
    this.layers = null;
    this.noiseBuffer = null;
  }
}

export const audio = new AudioManager();
