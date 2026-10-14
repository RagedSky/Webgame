/**
 * Laufzeit-Verwaltung der Einstellungen: hält den aktuellen Stand, wendet ihn auf Renderer, Loop, Audio,
 * Debug-Overlay und Tastenbelegung an, meldet Änderungen an Szenen und speichert in IndexedDB (global, nicht je Seed).
 */
import type { Renderer } from '@/render/Renderer';
import type { GameLoop } from '@/core/GameLoop';
import type { Input } from '@/core/Input';
import type { DebugOverlay } from '@/ui/DebugOverlay';
import type { GameAction } from '@/config/keybindings';
import { getDb } from '@/save/Db';
import { audio } from '@/audio/AudioManager';
import { AdaptiveMonitor, applyPreset, detectPreset, lowerPreset, MSAA_SAMPLES, RESOLUTION_HEIGHTS, sanitizeSettings, type GraphicsSettings, type QualityPreset } from './Settings';
import { defaultBindings, sanitizeBindings, withBinding, withDefaultBinding, type Bindings } from './Keybindings';

const KEY = 'settings';
const KEY_BINDINGS = 'keybindings';

export class SettingsManager {
  current: GraphicsSettings;
  bindings: Bindings = defaultBindings();
  readonly adaptive = new AdaptiveMonitor(60);
  private readonly listeners = new Set<(s: GraphicsSettings) => void>();
  private readonly bindingListeners = new Set<(b: Bindings) => void>();
  private saveTimer = 0;

  constructor(
    private readonly renderer: Renderer,
    private readonly loop: GameLoop,
    private readonly debug: DebugOverlay,
    private readonly input: Input,
  ) {
    this.current = sanitizeSettings(undefined);
    this.apply();
  }

  /** Gespeicherte Einstellungen und Tastenbelegung laden (asynchron; Standardwerte gelten bis dahin). */
  async load(): Promise<void> {
    const db = await getDb();
    const [saved, bindings] = await Promise.all([db.getValue<GraphicsSettings>(KEY), db.getValue<Bindings>(KEY_BINDINGS)]);
    if (saved) {
      this.current = sanitizeSettings(saved);
      this.apply();
      this.emit();
    }
    if (bindings) {
      this.bindings = sanitizeBindings(bindings);
      this.input.setBindings(this.bindings);
      for (const l of this.bindingListeners) l(this.bindings);
    }
  }

  onChange(fn: (s: GraphicsSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onBindingsChange(fn: (b: Bindings) => void): () => void {
    this.bindingListeners.add(fn);
    return () => this.bindingListeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l(this.current);
  }

  /** Teilwerte setzen; Preset wird neu erkannt, alles sofort angewendet und gespeichert. */
  set(partial: Partial<GraphicsSettings>): void {
    const next = sanitizeSettings({ ...this.current, ...partial });
    next.preset = detectPreset(next);
    this.current = next;
    this.apply();
    this.emit();
    this.scheduleSave();
  }

  setPreset(preset: Exclude<QualityPreset, 'custom'>): void {
    this.current = applyPreset(this.current, preset);
    this.adaptive.reset();
    this.apply();
    this.emit();
    this.scheduleSave();
  }

  /** Nächstniedrigeres Preset (für adaptive Qualität); null, wenn schon „Niedrig“. */
  lowerPreset(): Exclude<QualityPreset, 'custom'> | null {
    return lowerPreset(this.current.preset);
  }

  private apply(): void {
    const s = this.current;
    this.renderer.setQuality({ renderScale: s.renderScale, maxPixelRatio: s.maxPixelRatio, resolutionHeight: RESOLUTION_HEIGHTS[s.resolution], multisampling: MSAA_SAMPLES[s.antialiasing], postprocessing: s.postprocessing });
    this.loop.fpsLimit = s.fpsLimit;
    this.adaptive.targetFps = s.fpsLimit || 60;
    this.debug.setVisible(s.showDebug);
    audio.setVolumes({ master: s.volumeMaster, sfx: s.volumeSfx, ambient: s.volumeAmbient, music: s.volumeMusic });
  }

  // --- Tastenbelegung -------------------------------------------------------
  /** Taste als Primärbelegung einer Aktion setzen (Code aus KeyboardEvent.code). */
  setBinding(action: GameAction, code: string): void {
    this.bindings = withBinding(this.bindings, action, code);
    this.applyBindings();
  }

  resetBinding(action: GameAction): void {
    this.bindings = withDefaultBinding(this.bindings, action);
    this.applyBindings();
  }

  resetAllBindings(): void {
    this.bindings = defaultBindings();
    this.applyBindings();
  }

  private applyBindings(): void {
    this.input.setBindings(this.bindings);
    for (const l of this.bindingListeners) l(this.bindings);
    void getDb().then((db) => db.setValue(KEY_BINDINGS, this.bindings));
  }

  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.save(), 400);
  }

  async save(): Promise<void> {
    const db = await getDb();
    await db.setValue(KEY, this.current);
  }

  /** Vollbild umschalten (Browser-API). */
  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }
}
