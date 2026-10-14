/**
 * Laufzeit-Verwaltung der Grafik-Einstellungen: hält den aktuellen Stand, wendet ihn auf Renderer, Loop und
 * Debug-Overlay an, meldet Änderungen an Szenen und speichert in IndexedDB (global, nicht je Seed).
 */
import type { Renderer } from '@/render/Renderer';
import type { GameLoop } from '@/core/GameLoop';
import type { DebugOverlay } from '@/ui/DebugOverlay';
import { getDb } from '@/save/Db';
import { AdaptiveMonitor, applyPreset, detectPreset, lowerPreset, MSAA_SAMPLES, RESOLUTION_HEIGHTS, sanitizeSettings, type GraphicsSettings, type QualityPreset } from './Settings';

const KEY = 'settings';

export class SettingsManager {
  current: GraphicsSettings;
  readonly adaptive = new AdaptiveMonitor(60);
  private readonly listeners = new Set<(s: GraphicsSettings) => void>();
  private saveTimer = 0;

  constructor(
    private readonly renderer: Renderer,
    private readonly loop: GameLoop,
    private readonly debug: DebugOverlay,
  ) {
    this.current = sanitizeSettings(undefined);
    this.apply();
  }

  /** Gespeicherte Einstellungen laden (asynchron; Standardwerte gelten bis dahin). */
  async load(): Promise<void> {
    const db = await getDb();
    const saved = await db.getValue<GraphicsSettings>(KEY);
    if (saved) {
      this.current = sanitizeSettings(saved);
      this.apply();
      this.emit();
    }
  }

  onChange(fn: (s: GraphicsSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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
