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
  /** Aktive Himmelsphänomene (fotografierbar). */
  phenomena?: string;
}

/** Spiel-HUD der Planetenoberfläche (Phase 2: Orientierung; Sauerstoff/Energie folgen in Phase 5). */
export class Hud {
  readonly root: HTMLElement;
  private readonly info: HTMLElement;
  private readonly status: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly sighting: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly survival: HTMLElement;
  private readonly o2Fill: HTMLElement;
  private readonly enFill: HTMLElement;
  private readonly survivalText: HTMLElement;
  private readonly harvest: HTMLElement;
  private readonly harvestFill: HTMLElement;
  private readonly palette: HTMLElement;
  private readonly fade: HTMLElement;
  private readonly goal: HTMLElement;

  constructor(parent: HTMLElement) {
    this.info = el('div', { class: 'hud-info' });
    this.status = el('div', { class: 'hud-status' });
    this.hint = el('div', { class: 'hud-hint' });
    this.crosshair = el('div', { class: 'crosshair' });
    this.sighting = el('div', { class: 'hud-sighting', style: 'display:none' });
    this.prompt = el('div', { class: 'hud-prompt', style: 'display:none' });
    this.o2Fill = el('div');
    this.enFill = el('div');
    this.survivalText = el('div', { class: 'small' });
    this.survival = el(
      'div',
      { class: 'hud-survival' },
      el('div', { class: 'bar' }, el('span', { text: 'O₂' }), el('div', { class: 'progress o2' }, this.o2Fill)),
      el('div', { class: 'bar' }, el('span', { text: '⚡' }), el('div', { class: 'progress en' }, this.enFill)),
      this.survivalText,
    );
    this.harvestFill = el('div');
    this.harvest = el('div', { class: 'hud-harvest', style: 'display:none' }, el('div', { class: 'progress' }, this.harvestFill));
    this.palette = el('div', { class: 'hud-palette', style: 'display:none' });
    this.fade = el('div', { class: 'hud-fade' });
    this.goal = el('div', { class: 'hud-goal' });
    this.root = el('div', { class: 'hud' }, this.info, this.status, this.crosshair, this.hint, this.sighting, this.prompt, this.survival, this.harvest, this.palette, this.goal, this.fade);
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

  /** Interaktionshinweis unten (z. B. „E: Probe entnehmen“). */
  setPrompt(text: string): void {
    this.prompt.textContent = text;
    this.prompt.style.display = text ? 'block' : 'none';
  }

  setSurvival(oxygen: number, energy: number, text: string, warn: boolean): void {
    this.o2Fill.style.width = `${Math.round(oxygen)}%`;
    this.enFill.style.width = `${Math.round(energy)}%`;
    this.survivalText.textContent = text;
    this.survival.classList.toggle('warn', warn);
  }

  setHarvest(progress: number | null): void {
    this.harvest.style.display = progress === null ? 'none' : 'block';
    if (progress !== null) this.harvestFill.style.width = `${Math.round(progress * 100)}%`;
  }

  /** Bau-Palette: Liste von Beschriftungen, ausgewählter Index. */
  setPalette(items: Array<{ label: string; affordable: boolean }> | null, selected: number, hint: string): void {
    this.palette.style.display = items ? 'flex' : 'none';
    this.palette.textContent = '';
    if (!items) return;
    items.forEach((it, i) => this.palette.append(el('span', { class: `pal ${i === selected ? 'sel' : ''} ${it.affordable ? '' : 'missing'}`, text: `${i + 1} ${it.label}` })));
    this.palette.append(el('span', { class: 'muted small', text: hint }));
  }

  setGoal(text: string): void {
    this.goal.textContent = text;
    this.goal.style.display = text ? 'block' : 'none';
  }

  setFade(alpha: number): void {
    this.fade.style.opacity = String(Math.max(0, Math.min(1, alpha)));
  }

  /** Im Foto-Modus Info- und Statuszeilen ausblenden (sauberer Sucher). */
  setPhotoMode(on: boolean): void {
    this.root.classList.toggle('photo', on);
  }

  setCrosshair(visible: boolean): void {
    this.crosshair.style.display = visible ? 'block' : 'none';
  }

  update(i: HudInfo): void {
    this.info.textContent = `${i.planet} · ${i.biome}\n${i.clock} (${i.timeOfDay}) · ${i.weather} · ${i.temperatureC.toFixed(0)} °C${i.phenomena ? `\n${i.phenomena}` : ''}`;
    const flags = [i.swimming ? 'Schwimmen' : '', i.fly ? 'Flugmodus' : '', i.nearEdge ? 'Kartenrand' : '', i.timeScale > 1 ? `Zeit ×${i.timeScale}` : ''].filter(Boolean).join(' · ');
    this.status.textContent = `Höhe ${i.altitude.toFixed(0)} m · Position ${i.x.toFixed(0)} / ${i.z.toFixed(0)}${flags ? ` · ${flags}` : ''}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
