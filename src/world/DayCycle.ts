import { Vector3 } from 'three';
import { smoothstep } from '@/math/utils';
import type { Planet } from '@/gen/universe/types';
import type { TimeOfDay } from '@/gen/archive/types';

/**
 * Tag/Nacht-Zyklus eines Planeten. t ∈ [0,1): 0 = Mitternacht, 0,25 = Sonnenaufgang, 0,5 = Mittag.
 * Die Sonne läuft auf einem um `latitude` gekippten Kreis (Aufgang +x, Untergang −x).
 */
export class DayCycle {
  t: number;
  /** Vergangene Planetentage seit Spielstart (für Monde). */
  totalDays = 0;
  /** Echtzeit-Sekunden pro Planetentag. */
  readonly dayLengthSeconds: number;
  readonly latitude: number;
  readonly sunDir = new Vector3(0, 1, 0);
  /** Zeitraffer (1 = normal). */
  timeScale = 1;

  constructor(planet: Planet, secondsPerEarthDay = 1200, startT = 0.3) {
    this.dayLengthSeconds = Math.max(240, (planet.dayLengthHours / 24) * secondsPerEarthDay);
    this.latitude = ((22 + Math.min(40, planet.axialTiltDeg) * 0.5) * Math.PI) / 180;
    this.t = startT;
    this.updateSun();
  }

  advance(dt: number): void {
    const d = (dt * this.timeScale) / this.dayLengthSeconds;
    this.t = (this.t + d) % 1;
    this.totalDays += d;
    this.updateSun();
  }

  private updateSun(): void {
    const theta = this.t * Math.PI * 2;
    const cl = Math.cos(this.latitude);
    const sl = Math.sin(this.latitude);
    this.sunDir.set(Math.sin(theta), -Math.cos(theta) * cl, -Math.cos(theta) * sl).normalize();
  }

  /** Richtung eines Objekts, das denselben Kreis mit Phase `phase` (0..1) abläuft. */
  directionAtPhase(phase: number, out: Vector3): Vector3 {
    const theta = phase * Math.PI * 2;
    const cl = Math.cos(this.latitude);
    const sl = Math.sin(this.latitude);
    return out.set(Math.sin(theta), -Math.cos(theta) * cl, -Math.cos(theta) * sl).normalize();
  }

  get sunElevation(): number {
    return this.sunDir.y;
  }

  /** 0 (Nacht) … 1 (voller Tag). */
  get daylight(): number {
    return smoothstep(-0.12, 0.22, this.sunDir.y);
  }

  get timeOfDay(): Exclude<TimeOfDay, 'any'> {
    const e = this.sunDir.y;
    if (e > 0.14) return 'day';
    if (e < -0.14) return 'night';
    return this.t < 0.5 ? 'dawn' : 'dusk';
  }

  /** Uhrzeit als HH:MM (24 Planetenstunden). */
  get clock(): string {
    const h = this.t * 24;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}
