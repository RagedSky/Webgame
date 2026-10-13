import { Random } from '@/math/Random';
import { clamp01, lerp } from '@/math/utils';
import { WEATHER } from '@/gen/universe/catalog';
import type { Planet, WeatherType } from '@/gen/universe/types';

export type PrecipitationKind = 'none' | 'rain' | 'snow' | 'ash' | 'acid' | 'crystal' | 'methane' | 'sand';

export interface WeatherParams {
  /** Multiplikator der Nebeldichte (1 = klar). */
  fog: number;
  cloudiness: number;
  precipitation: PrecipitationKind;
  precipIntensity: number;
  wind: number;
  /** Abdunkelung des Sonnenlichts 0..1. */
  sunDim: number;
  lightning: boolean;
}

const PARAMS: Record<WeatherType, WeatherParams> = {
  clear: { fog: 1, cloudiness: 0.12, precipitation: 'none', precipIntensity: 0, wind: 0.25, sunDim: 0, lightning: false },
  overcast: { fog: 1.6, cloudiness: 0.85, precipitation: 'none', precipIntensity: 0, wind: 0.4, sunDim: 0.45, lightning: false },
  fog: { fog: 7, cloudiness: 0.6, precipitation: 'none', precipIntensity: 0, wind: 0.1, sunDim: 0.5, lightning: false },
  rain: { fog: 2.4, cloudiness: 0.9, precipitation: 'rain', precipIntensity: 0.8, wind: 0.55, sunDim: 0.55, lightning: false },
  thunderstorm: { fog: 2.8, cloudiness: 1, precipitation: 'rain', precipIntensity: 1, wind: 0.9, sunDim: 0.7, lightning: true },
  storm: { fog: 2, cloudiness: 0.95, precipitation: 'none', precipIntensity: 0, wind: 1, sunDim: 0.5, lightning: false },
  snow: { fog: 2.2, cloudiness: 0.8, precipitation: 'snow', precipIntensity: 0.7, wind: 0.3, sunDim: 0.4, lightning: false },
  blizzard: { fog: 6, cloudiness: 1, precipitation: 'snow', precipIntensity: 1, wind: 1, sunDim: 0.7, lightning: false },
  sandstorm: { fog: 6, cloudiness: 0.7, precipitation: 'sand', precipIntensity: 1, wind: 1, sunDim: 0.6, lightning: false },
  ashfall: { fog: 3.5, cloudiness: 0.9, precipitation: 'ash', precipIntensity: 0.8, wind: 0.4, sunDim: 0.6, lightning: false },
  acid_rain: { fog: 2.6, cloudiness: 0.9, precipitation: 'acid', precipIntensity: 0.8, wind: 0.5, sunDim: 0.55, lightning: false },
  methane_rain: { fog: 2.2, cloudiness: 0.85, precipitation: 'methane', precipIntensity: 0.6, wind: 0.3, sunDim: 0.5, lightning: false },
  heatwave: { fog: 1.3, cloudiness: 0.05, precipitation: 'none', precipIntensity: 0, wind: 0.5, sunDim: 0, lightning: false },
  radiation_storm: { fog: 1.4, cloudiness: 0.3, precipitation: 'none', precipIntensity: 0, wind: 0.6, sunDim: 0.1, lightning: true },
  aurora: { fog: 1, cloudiness: 0.1, precipitation: 'none', precipIntensity: 0, wind: 0.2, sunDim: 0, lightning: false },
  crystal_hail: { fog: 2, cloudiness: 0.8, precipitation: 'crystal', precipIntensity: 0.8, wind: 0.6, sunDim: 0.4, lightning: false },
  cloud_bands: { fog: 2, cloudiness: 1, precipitation: 'none', precipIntensity: 0, wind: 0.8, sunDim: 0.4, lightning: false },
  lightning_storm: { fog: 2.5, cloudiness: 1, precipitation: 'none', precipIntensity: 0, wind: 0.9, sunDim: 0.6, lightning: true },
};

const STORM_TYPES: WeatherType[] = ['storm', 'thunderstorm', 'blizzard', 'sandstorm', 'lightning_storm'];

/**
 * Wetter-Zustandsmaschine: zieht deterministisch (Seed) die nächste Wetterlage aus dem Planeten-Set,
 * blendet Parameter über eine Übergangszeit und liefert Blitz-Impulse bei Gewittern.
 */
export class WeatherSystem {
  current: WeatherType;
  next: WeatherType;
  /** 0..1 Fortschritt des Übergangs current → next. */
  blend = 1;
  private timer: number;
  private readonly rng: Random;
  private readonly transitionSeconds = 25;
  private lightningTimer = 0;
  private flash = 0;
  private clock = 0;
  private stormEndedAt = -Infinity;
  private wasStorm = false;
  readonly params: WeatherParams = { ...PARAMS.clear };

  constructor(
    private readonly planet: Planet,
    seed: string,
  ) {
    this.rng = new Random(`weather:${seed}:${planet.id}`);
    this.current = planet.weather.includes('clear') ? 'clear' : (planet.weather[0] as WeatherType);
    this.next = this.current;
    this.timer = this.rng.float(240, 600);
    this.lightningTimer = 2;
    this.apply();
  }

  private pickNext(): WeatherType {
    const options = this.planet.weather.filter((w) => w !== this.current);
    if (options.length === 0) return this.current;
    return this.rng.weighted(options.map((w) => ({ item: w, weight: w === 'clear' ? 3 : WEATHER[w].hazardous ? 0.8 : 1.3 })));
  }

  /** Erzwingt eine Wetterlage (Debug/Test). */
  force(type: WeatherType): void {
    this.current = this.next;
    this.next = type;
    this.blend = 0;
    this.timer = this.rng.float(240, 600);
  }

  cycle(): WeatherType {
    const list = this.planet.weather;
    const idx = list.indexOf(this.next);
    const n = list[(idx + 1) % list.length] as WeatherType;
    this.force(n);
    return n;
  }

  update(dt: number): void {
    this.clock += dt;
    const stormNow = STORM_TYPES.includes(this.activeType);
    if (this.wasStorm && !stormNow) this.stormEndedAt = this.clock;
    this.wasStorm = stormNow;
    if (this.blend < 1) {
      this.blend = clamp01(this.blend + dt / this.transitionSeconds);
      if (this.blend >= 1) this.current = this.next;
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.next = this.pickNext();
        this.blend = this.next === this.current ? 1 : 0;
        this.timer = this.rng.float(240, 720);
      }
    }
    this.apply();

    // Blitze
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.params.lightning) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.flash = this.rng.float(0.6, 1);
        this.lightningTimer = this.rng.float(3, 14);
      }
    }
  }

  private apply(): void {
    const a = PARAMS[this.current];
    const b = PARAMS[this.next];
    const t = this.blend;
    const p = this.params;
    p.fog = lerp(a.fog, b.fog, t);
    p.cloudiness = lerp(a.cloudiness, b.cloudiness, t);
    p.wind = lerp(a.wind, b.wind, t);
    p.sunDim = lerp(a.sunDim, b.sunDim, t);
    // Niederschlag: Art vom „stärkeren“ Zustand, Intensität geblendet
    const ia = a.precipIntensity * (1 - t);
    const ib = b.precipIntensity * t;
    p.precipitation = ib >= ia ? b.precipitation : a.precipitation;
    p.precipIntensity = ia + ib;
    p.lightning = t < 0.5 ? a.lightning : b.lightning;
  }

  /** Aktueller Blitz-Impuls 0..1 (fällt schnell ab). */
  get lightningFlash(): number {
    return this.flash;
  }

  /** Kurz nach einem Sturm (3 Minuten) – Spawn-Bedingung „after_storm“. */
  get afterStorm(): boolean {
    return this.clock - this.stormEndedAt < 180;
  }

  get label(): string {
    const cur = WEATHER[this.current].name;
    if (this.blend < 1 && this.next !== this.current) return `${cur} → ${WEATHER[this.next].name}`;
    return cur;
  }

  get activeType(): WeatherType {
    return this.blend >= 0.5 ? this.next : this.current;
  }
}
