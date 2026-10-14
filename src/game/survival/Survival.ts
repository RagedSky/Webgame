/**
 * Überlebensmodell (rein): Sauerstoff und Anzug-Energie 0..100. Entspannt: langsame Verbräuche, Aufladen in der
 * Nähe von Unterkunft/Ladestation, automatische Zellen, Zusammenbruch ohne Permadeath.
 */
import { clamp } from '@/math/utils';

export interface SurvivalEnv {
  dt: number;
  breathable: boolean;
  underwater: boolean;
  sprinting: boolean;
  temperatureC: number;
  radiation: boolean;
  /** In Reichweite einer Unterkunft/Ladestation. */
  recharging: boolean;
}

export interface SurvivalState {
  oxygen: number;
  energy: number;
}

export type SurvivalEvent = 'oxygen_low' | 'oxygen_critical' | 'energy_low' | 'energy_critical' | 'collapse' | 'recovered';

export const OXYGEN_SECONDS = 480;
export const BREATH_SECONDS = 60;
export const ENERGY_SECONDS = 900;
export const RECHARGE_SECONDS = 20;

export class Survival {
  oxygen = 100;
  energy = 100;
  private warnedO2 = 0;
  private warnedEnergy = 0;
  /** Aktueller Verbrauch (Anzeige): Einheiten pro Sekunde. */
  readonly rates = { oxygen: 0, energy: 0 };
  /** Lesbare Gefahren für das HUD. */
  readonly hazards: string[] = [];

  constructor(state?: SurvivalState) {
    if (state) {
      this.oxygen = clamp(state.oxygen, 0, 100);
      this.energy = clamp(state.energy, 0, 100);
    }
  }

  get collapsed(): boolean {
    return this.oxygen <= 0 || this.energy <= 0;
  }

  /** Aktualisiert Werte und liefert ausgelöste Ereignisse. */
  update(env: SurvivalEnv): SurvivalEvent[] {
    const events: SurvivalEvent[] = [];
    const dt = env.dt;
    this.hazards.length = 0;

    let o2Rate = 0;
    if (env.underwater) {
      o2Rate = 100 / BREATH_SECONDS;
      this.hazards.push('Unter Wasser');
    } else if (!env.breathable) {
      o2Rate = (100 / OXYGEN_SECONDS) * (env.sprinting ? 1.6 : 1);
      this.hazards.push('Nicht atembar');
    }
    let eRate = (100 / ENERGY_SECONDS) * (env.sprinting ? 1.6 : 1);
    if (env.temperatureC < 0) {
      eRate *= 1 + Math.min(2, -env.temperatureC / 40);
      this.hazards.push('Kälte');
    } else if (env.temperatureC > 40) {
      eRate *= 1 + Math.min(2, (env.temperatureC - 40) / 40);
      this.hazards.push('Hitze');
    }
    if (env.radiation) {
      eRate *= 1.5;
      this.hazards.push('Strahlung');
    }

    if (env.recharging) {
      this.oxygen = clamp(this.oxygen + (100 / RECHARGE_SECONDS) * dt, 0, 100);
      this.energy = clamp(this.energy + (100 / RECHARGE_SECONDS) * dt, 0, 100);
      o2Rate = 0;
      eRate = 0;
    } else {
      // An der Oberfläche in atembarer Luft erholt sich der Sauerstoff schnell
      if (env.breathable && !env.underwater) this.oxygen = clamp(this.oxygen + (100 / 10) * dt, 0, 100);
      this.oxygen = clamp(this.oxygen - o2Rate * dt, 0, 100);
      this.energy = clamp(this.energy - eRate * dt, 0, 100);
    }
    this.rates.oxygen = o2Rate;
    this.rates.energy = eRate;

    // Warnungen (einmal je Schwelle, zurückgesetzt beim Aufladen)
    if (this.oxygen > 30) this.warnedO2 = 0;
    if (this.oxygen <= 10 && this.warnedO2 < 2) {
      this.warnedO2 = 2;
      events.push('oxygen_critical');
    } else if (this.oxygen <= 25 && this.warnedO2 < 1) {
      this.warnedO2 = 1;
      events.push('oxygen_low');
    }
    if (this.energy > 30) this.warnedEnergy = 0;
    if (this.energy <= 10 && this.warnedEnergy < 2) {
      this.warnedEnergy = 2;
      events.push('energy_critical');
    } else if (this.energy <= 25 && this.warnedEnergy < 1) {
      this.warnedEnergy = 1;
      events.push('energy_low');
    }
    if (this.collapsed) events.push('collapse');
    return events;
  }

  /** Zelle einsetzen: +50 (begrenzt auf 100). */
  useOxygenCell(): void {
    this.oxygen = clamp(this.oxygen + 50, 0, 100);
  }

  useEnergyCell(): void {
    this.energy = clamp(this.energy + 50, 0, 100);
  }

  /** Nach dem Zusammenbruch: Werte zurücksetzen. */
  respawn(): void {
    this.oxygen = 60;
    this.energy = 60;
    this.warnedO2 = 0;
    this.warnedEnergy = 0;
  }

  toJSON(): SurvivalState {
    return { oxygen: this.oxygen, energy: this.energy };
  }
}
