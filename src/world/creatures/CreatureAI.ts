/**
 * Verhaltens-Zustandsmaschine einer Kreatur (rein, ohne Three.js): Idle, Wandern, Fressen, Schlafen,
 * Flüchten, Neugier, Imponieren. Reagiert auf Entfernung, Lärm und Sichtlinie des Spielers.
 */
import { clamp01 } from '@/math/utils';
import type { Activity, Diet, FaunaLocomotion, Temperament, TimeOfDay } from '@/gen/archive/types';

export type CreatureState = 'idle' | 'wander' | 'feed' | 'sleep' | 'flee' | 'curious' | 'display' | 'lured';

export const STATE_LABELS: Record<CreatureState, string> = {
  idle: 'ruht',
  wander: 'wandert',
  feed: 'frisst',
  sleep: 'schläft',
  flee: 'flüchtet',
  curious: 'neugierig',
  display: 'imponiert',
  lured: 'angelockt',
};

export interface AIProfile {
  temperament: Temperament;
  shyness: number;
  activity: Activity;
  locomotion: FaunaLocomotion;
  diet: Diet;
  behaviors: string[];
}

export interface AIInput {
  dt: number;
  distToPlayer: number;
  /** Richtung zum Spieler als Winkel (rad, Welt-XZ). */
  angleToPlayer: number;
  /** 0 (still) … 1 (sprintend). */
  playerNoise: number;
  /** Spieler sieht die Kreatur direkt an (Sichtlinie). */
  playerFacing: boolean;
  timeOfDay: Exclude<TimeOfDay, 'any'>;
  /** Richtung zurück zum Ankerpunkt und Entfernung dazu (Leine). */
  angleToHome: number;
  distToHome: number;
  /** Nächster Köder (optional). */
  lureAngle?: number;
  lureDist?: number;
}

const FEED_BEHAVIORS = new Set(['grazing', 'feeding', 'hunting', 'stalking', 'drinking', 'burrowing']);
const DISPLAY_BEHAVIORS = new Set(['courting', 'display', 'singing', 'playing', 'dust_bathing', 'basking', 'nesting']);

export class CreatureAI {
  state: CreatureState = 'idle';
  /** Gewünschte Blickrichtung (rad) und Geschwindigkeit 0..1. */
  heading: number;
  targetSpeed = 0;
  /** Wachsamkeit 0..1, klingt ab. */
  wary = 0;
  /** Aktuell gezeigtes Verhalten (für Foto-Bonus), z. B. 'grazing'. */
  behavior = '';
  private timer = 0;
  private readonly feedPool: string[];
  private readonly displayPool: string[];
  private readonly rng: () => number;

  constructor(
    readonly profile: AIProfile,
    rng: () => number,
    initialHeading = 0,
  ) {
    this.rng = rng;
    this.heading = initialHeading;
    this.feedPool = profile.behaviors.filter((b) => FEED_BEHAVIORS.has(b));
    this.displayPool = profile.behaviors.filter((b) => DISPLAY_BEHAVIORS.has(b));
    this.enter('idle');
  }

  get alertRadius(): number {
    const base = 10 + 38 * this.profile.shyness;
    return this.profile.temperament === 'aggressive' ? base * 0.5 : base;
  }

  private isRestTime(t: Exclude<TimeOfDay, 'any'>): boolean {
    switch (this.profile.activity) {
      case 'diurnal':
        return t === 'night';
      case 'nocturnal':
        return t === 'day';
      case 'crepuscular':
        return t === 'day' || t === 'night';
      case 'cathemeral':
        return false;
    }
  }

  private enter(state: CreatureState, input?: AIInput): void {
    this.state = state;
    this.behavior = '';
    const r = this.rng;
    switch (state) {
      case 'idle':
        this.timer = 1.5 + r() * 4;
        this.targetSpeed = 0;
        break;
      case 'wander':
        this.timer = 3 + r() * 6;
        this.targetSpeed = 0.3 + r() * 0.15;
        this.heading += (r() - 0.5) * 2.4;
        this.behavior = this.profile.behaviors.includes('migrating') ? 'migrating' : this.profile.behaviors.includes('patrolling') ? 'patrolling' : '';
        break;
      case 'feed':
        this.timer = 4 + r() * 8;
        this.targetSpeed = 0;
        this.behavior = this.feedPool.length ? (this.feedPool[Math.floor(r() * this.feedPool.length)] as string) : 'feeding';
        break;
      case 'sleep':
        this.timer = 20 + r() * 40;
        this.targetSpeed = 0;
        this.behavior = 'sleeping';
        break;
      case 'flee':
        this.timer = 3 + r() * 4;
        this.targetSpeed = 1;
        if (input) this.heading = input.angleToPlayer + Math.PI + (r() - 0.5) * 0.8;
        this.wary = 1;
        break;
      case 'curious':
        this.timer = 4 + r() * 5;
        this.targetSpeed = 0.25;
        if (input) this.heading = input.angleToPlayer;
        break;
      case 'display':
        this.timer = 3 + r() * 4;
        this.targetSpeed = 0;
        this.behavior = this.displayPool.length ? (this.displayPool[Math.floor(r() * this.displayPool.length)] as string) : 'display';
        if (input) this.heading = input.angleToPlayer;
        break;
      case 'lured':
        this.timer = 20 + r() * 20;
        this.targetSpeed = 0.35;
        this.behavior = this.feedPool.length ? (this.feedPool[0] as string) : 'feeding';
        if (input?.lureAngle !== undefined) this.heading = input.lureAngle;
        break;
    }
  }

  /** Bedrohungsgrad 0..1 aus Entfernung, Lärm, Blick und Wachsamkeit. */
  threat(input: AIInput): number {
    const near = clamp01(1 - input.distToPlayer / this.alertRadius);
    const noise = 0.35 + input.playerNoise * 0.9 + (input.playerFacing ? 0.2 : 0);
    const temperamentFactor = this.profile.temperament === 'shy' ? 1.2 : this.profile.temperament === 'curious' ? 0.5 : this.profile.temperament === 'aggressive' ? 0.3 : 0.85;
    return clamp01(near * noise * temperamentFactor * (0.5 + this.profile.shyness) + this.wary * 0.25 * near);
  }

  update(input: AIInput): void {
    const dt = input.dt;
    this.timer -= dt;
    this.wary = Math.max(0, this.wary - dt * 0.08);
    const threat = this.threat(input);

    // Flucht hat Vorrang (außer bereits auf der Flucht oder aggressiv und nah)
    if (this.state !== 'flee' && threat > 0.38) {
      if (this.profile.temperament === 'aggressive' && input.distToPlayer < 12) {
        if (this.state !== 'display') this.enter('display', input);
      } else {
        this.enter('flee', input);
      }
      return;
    }

    // Köder: ruhige Tiere laufen hin und fressen dort
    if (input.lureDist !== undefined && input.lureAngle !== undefined && input.lureDist < 40 && this.state !== 'flee' && this.state !== 'lured' && this.state !== 'sleep') {
      this.enter('lured', input);
      return;
    }

    switch (this.state) {
      case 'lured':
        if (input.lureDist === undefined || input.lureDist > 45) this.enter('idle');
        else if (input.lureDist < 2.5) this.targetSpeed = 0;
        else {
          this.targetSpeed = 0.35;
          if (input.lureAngle !== undefined) this.heading = input.lureAngle;
        }
        if (this.timer < 0) this.enter('idle');
        break;
      case 'flee':
        if (input.distToPlayer > this.alertRadius * 1.6 && this.timer < 0) this.enter('idle');
        else if (this.timer < -6) this.enter('idle');
        break;
      case 'curious':
        if (input.distToPlayer < 5) this.targetSpeed = 0;
        else {
          this.targetSpeed = 0.25;
          this.heading = input.angleToPlayer;
        }
        if (this.timer < 0) this.enter('idle');
        break;
      case 'sleep':
        if (this.timer < 0 || !this.isRestTime(input.timeOfDay)) this.enter('idle');
        break;
      case 'display':
        if (this.timer < 0) this.enter('idle');
        break;
      case 'wander':
        // Leine: zurück zum Ankerpunkt
        if (input.distToHome > 90) this.heading = input.angleToHome;
        if (this.timer < 0) this.enter(this.rng() < 0.5 ? 'idle' : 'feed');
        break;
      case 'feed':
        if (this.timer < 0) this.enter(this.rng() < 0.6 ? 'wander' : 'idle');
        break;
      case 'idle':
        if (this.timer < 0) {
          const r = this.rng();
          if (this.isRestTime(input.timeOfDay) && r < 0.5) this.enter('sleep');
          else if (this.profile.temperament === 'curious' && input.distToPlayer < 28 && input.playerNoise < 0.4 && r < 0.6) this.enter('curious', input);
          else if (this.displayPool.length && r < 0.12) this.enter('display', input);
          else if (this.feedPool.length && r < 0.5) this.enter('feed');
          else this.enter('wander');
        }
        break;
    }
  }

  /** Animationsname für die aktuelle Lage. */
  get animation(): 'idle' | 'walk' | 'run' | 'feed' | 'sleep' | 'display' {
    switch (this.state) {
      case 'flee':
        return 'run';
      case 'wander':
      case 'curious':
      case 'lured':
        return this.targetSpeed > 0 ? 'walk' : 'feed';
      case 'feed':
        return 'feed';
      case 'sleep':
        return 'sleep';
      case 'display':
        return 'display';
      default:
        return 'idle';
    }
  }
}
