import { el } from './dom';

export interface HudInfo {
  planet: string;
  biome: string;
  clock: string;
  timeOfDay: string;
  weather: string;
  temperatureC: number;
  altitude: number;
  x: number;
  z: number;
  swimming: boolean;
  nearEdge: boolean;
  fly: boolean;
  timeScale: number;
}

/** Spiel-HUD der Planetenoberfläche (Phase 2: Orientierung; Sauerstoff/Energie folgen in Phase 5). */
export class Hud {
  readonly root: HTMLElement;
  private readonly info: HTMLElement;
  private readonly status: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly sighting: HTMLElement;

  constructor(parent: HTMLElement) {
    this.info = el('div', { class: 'hud-info' });
    this.status = el('div', { class: 'hud-status' });
    this.hint = el('div', { class: 'hud-hint' });
    this.crosshair = el('div', { class: 'crosshair' });
    this.sighting = el('div', { class: 'hud-sighting', style: 'display:none' });
    this.root = el('div', { class: 'hud' }, this.info, this.status, this.crosshair, this.hint, this.sighting);
    parent.append(this.root);
  }

  setHint(text: string): void {
    this.hint.textContent = text;
    this.hint.style.display = text ? 'block' : 'none';
  }

  /** Zeile unter dem Fadenkreuz: „Sichtung: Art · Seltenheit · Verhalten“. */
  setSighting(text: string): void {
    this.sighting.textContent = text;
    this.sighting.style.display = text ? 'block' : 'none';
  }

  setCrosshair(visible: boolean): void {
    this.crosshair.style.display = visible ? 'block' : 'none';
  }

  update(i: HudInfo): void {
    this.info.textContent = `${i.planet} · ${i.biome}\n${i.clock} (${i.timeOfDay}) · ${i.weather} · ${i.temperatureC.toFixed(0)} °C`;
    const flags = [i.swimming ? 'Schwimmen' : '', i.fly ? 'Flugmodus' : '', i.nearEdge ? 'Kartenrand' : '', i.timeScale > 1 ? `Zeit ×${i.timeScale}` : ''].filter(Boolean).join(' · ');
    this.status.textContent = `Höhe ${i.altitude.toFixed(0)} m · Position ${i.x.toFixed(0)} / ${i.z.toFixed(0)}${flags ? ` · ${flags}` : ''}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
