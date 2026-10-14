import { clear, el } from './dom';
import { STR } from './strings';
import type { SettingsManager } from '@/game/settings/SettingsManager';
import { AA_MODES, FPS_LIMITS, PRESET_LABELS, QUALITY_PRESETS, RESOLUTIONS, SHADOW_QUALITIES, type AntiAliasing, type FpsLimit, type GraphicsSettings, type ResolutionCap, type ShadowQuality } from '@/game/settings/Settings';
import { ACTION_LABELS, DEFAULT_BINDINGS, type GameAction } from '@/config/keybindings';
import type { Renderer } from '@/render/Renderer';
import type { GameLoop } from '@/core/GameLoop';

/** Einstellungen (Grafik, Leistung, Tastenbelegung als Übersicht). Änderungen gelten sofort. */
export class SettingsUi {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly status: HTMLElement;
  private open = false;
  private unsubscribe: (() => void) | null = null;
  private timer = 0;

  constructor(
    parent: HTMLElement,
    private readonly settings: SettingsManager,
    private readonly renderer: Renderer,
    private readonly loop: GameLoop,
    onClose: () => void,
  ) {
    this.body = el('div', { class: 'inv-body' });
    this.status = el('div', { class: 'goal' });
    this.root = el('div', { class: 'inv-ui settings-ui', style: 'display:none' }, el('div', { class: 'panel inv-panel settings-panel' }, el('div', { class: 'row inv-head' }, el('h2', { text: STR.settingsUi.title }), el('button', { class: 'small', text: STR.settingsUi.close, onClick: () => onClose() })), this.status, this.body));
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.root.style.display = 'flex';
    this.unsubscribe?.();
    this.unsubscribe = this.settings.onChange(() => this.render());
    this.render();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.renderStatus(), 500);
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.clearInterval(this.timer);
  }

  private renderStatus(): void {
    const { width, height } = this.renderer.size;
    const pr = this.renderer.effectivePixelRatio;
    this.status.textContent = `${STR.settingsUi.current}: ${PRESET_LABELS[this.settings.current.preset]} · ${width}×${height} (${STR.settingsUi.internal} ${Math.round(width * pr)}×${Math.round(height * pr)}) · ${this.loop.stats.fps.toFixed(0)} FPS · ${STR.settingsUi.apply}`;
  }

  private row(label: string, control: HTMLElement, extra?: HTMLElement): HTMLElement {
    return el('div', { class: 'char-row settings-row' }, el('span', { text: label }), control, extra ?? el('span'));
  }

  private select<T extends string | number>(options: readonly T[], labels: (v: T) => string, value: T, set: (v: T) => void): HTMLElement {
    const sel = el('select');
    for (const o of options) sel.append(el('option', { value: String(o), text: labels(o) }));
    sel.value = String(value);
    sel.addEventListener('change', () => set((typeof value === 'number' ? Number(sel.value) : sel.value) as T));
    return sel;
  }

  private slider(min: number, max: number, step: number, value: number, format: (v: number) => string, set: (v: number) => void): [HTMLElement, HTMLElement] {
    const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
    const num = el('span', { class: 'num', text: format(value) });
    input.addEventListener('input', () => (num.textContent = format(Number(input.value))));
    input.addEventListener('change', () => set(Number(input.value)));
    return [input, num];
  }

  private toggle(value: boolean, set: (v: boolean) => void): HTMLElement {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = value;
    cb.addEventListener('change', () => set(cb.checked));
    return cb;
  }

  render(): void {
    if (!this.open) return;
    const s: GraphicsSettings = this.settings.current;
    const S = STR.settingsUi;
    clear(this.body);
    this.renderStatus();
    const presets = el('div', { class: 'row wrap' });
    for (const p of QUALITY_PRESETS) presets.append(el('button', { class: `small ${s.preset === p ? 'primary' : ''}`, text: PRESET_LABELS[p], onClick: () => this.settings.setPreset(p) }));
    if (s.preset === 'custom') presets.append(el('span', { class: 'muted small', text: PRESET_LABELS.custom }));
    const [scale, scaleNum] = this.slider(50, 200, 5, Math.round(s.renderScale * 100), (v) => `${v} %`, (v) => this.settings.set({ renderScale: v / 100 }));
    const [veg, vegNum] = this.slider(25, 150, 5, Math.round(s.vegetationDensity * 100), (v) => `${v} %`, (v) => this.settings.set({ vegetationDensity: v / 100 }));
    const [view, viewNum] = this.slider(800, 3000, 100, s.viewDistance, (v) => `${v} m`, (v) => this.settings.set({ viewDistance: v }));
    const shadowLabel: Record<ShadowQuality, string> = { off: S.shadowOff, low: S.shadowLow, medium: S.shadowMedium, high: S.shadowHigh };
    const aaLabel = (v: AntiAliasing): string => (v === 'off' ? S.aaOff : `MSAA ${v.replace('msaa', '')}×`);
    this.body.append(
      this.row(S.preset, presets),
      el('h3', { text: 'Grafik' }),
      this.row(S.resolution, this.select<ResolutionCap>(RESOLUTIONS, (v) => (v === 'auto' ? S.resolutionAuto : v), s.resolution, (v) => this.settings.set({ resolution: v }))),
      this.row(S.renderScale, scale, scaleNum),
      this.row(S.pixelRatio, this.select<number>([1, 1.5, 2, 3], (v) => `${v}×`, s.maxPixelRatio, (v) => this.settings.set({ maxPixelRatio: v }))),
      this.row(S.shadows, this.select<ShadowQuality>(SHADOW_QUALITIES, (v) => shadowLabel[v], s.shadows, (v) => this.settings.set({ shadows: v }))),
      this.row(S.vegetation, veg, vegNum),
      this.row(S.viewDistance, view, viewNum),
      this.row(S.postprocessing, this.toggle(s.postprocessing, (v) => this.settings.set({ postprocessing: v }))),
      this.row(S.antialiasing, this.select<AntiAliasing>(AA_MODES, aaLabel, s.antialiasing, (v) => this.settings.set({ antialiasing: v }))),
      el('h3', { text: 'Leistung' }),
      this.row(S.fpsLimit, this.select<FpsLimit>(FPS_LIMITS, (v) => (v === 0 ? S.fpsUnlimited : `${v} FPS`), s.fpsLimit, (v) => this.settings.set({ fpsLimit: v }))),
      el('p', { class: 'muted small', text: S.vsyncHint }),
      this.row(S.adaptive, this.toggle(s.adaptiveQuality, (v) => this.settings.set({ adaptiveQuality: v }))),
      this.row(S.showDebug, this.toggle(s.showDebug, (v) => this.settings.set({ showDebug: v }))),
      el('div', { class: 'row wrap' }, el('button', { class: 'small', text: S.fullscreen, onClick: () => this.settings.toggleFullscreen() }), el('button', { class: 'small', text: S.reset, onClick: () => this.settings.setPreset('high') })),
      el('h3', { text: S.keys }),
      el('p', { class: 'muted small', text: S.keysHint }),
      this.keyTable(),
    );
  }

  private keyTable(): HTMLElement {
    const table = el('div', { class: 'key-grid' });
    for (const action of Object.keys(DEFAULT_BINDINGS) as GameAction[]) {
      table.append(el('span', { class: 'muted small', text: ACTION_LABELS[action] }), el('span', { class: 'small', text: DEFAULT_BINDINGS[action].map((k) => k.replace('Key', '').replace('Digit', '').replace('Arrow', '↑↓←→'.includes(k) ? k : k)).join(' / ') }));
    }
    return table;
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}
