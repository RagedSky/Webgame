/**
 * Grafik-Einstellungen (rein): Presets Niedrig/Mittel/Hoch/Ultra, Begrenzung, Preset-Erkennung,
 * Umrechnungstabellen und der Monitor für adaptive Qualität.
 */
import { clamp } from '@/math/utils';

export const SETTINGS_VERSION = 2;
export const QUALITY_PRESETS = ['low', 'medium', 'high', 'ultra'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number] | 'custom';
export const RESOLUTIONS = ['auto', '720p', '1080p', '1440p', '2160p'] as const;
export type ResolutionCap = (typeof RESOLUTIONS)[number];
export const SHADOW_QUALITIES = ['off', 'low', 'medium', 'high'] as const;
export type ShadowQuality = (typeof SHADOW_QUALITIES)[number];
export const AA_MODES = ['off', 'msaa2', 'msaa4', 'msaa8'] as const;
export type AntiAliasing = (typeof AA_MODES)[number];
export const FPS_LIMITS = [0, 30, 60, 120] as const;
export type FpsLimit = (typeof FPS_LIMITS)[number];

export interface GraphicsSettings {
  version: number;
  preset: QualityPreset;
  /** Obergrenze der internen Render-Höhe ('auto' = Fenster × DPR). */
  resolution: ResolutionCap;
  /** Render-Skalierung 0,5–2,0 (Upscaling < 1, Supersampling > 1). */
  renderScale: number;
  /** Deckel für devicePixelRatio 1–3. */
  maxPixelRatio: number;
  shadows: ShadowQuality;
  /** Vegetationsdichte 0,25–1,5. */
  vegetationDensity: number;
  /** Sichtweite in Metern 800–3000. */
  viewDistance: number;
  postprocessing: boolean;
  antialiasing: AntiAliasing;
  fpsLimit: FpsLimit;
  adaptiveQuality: boolean;
  showDebug: boolean;
  /** Lautstärken 0..1. */
  volumeMaster: number;
  volumeSfx: number;
  volumeAmbient: number;
  volumeMusic: number;
  /** Tutorial auf neuen Spielständen anzeigen. */
  tutorial: boolean;
}

export type PresetValues = Pick<GraphicsSettings, 'renderScale' | 'maxPixelRatio' | 'shadows' | 'vegetationDensity' | 'viewDistance' | 'postprocessing' | 'antialiasing'>;

export const PRESET_VALUES: Record<Exclude<QualityPreset, 'custom'>, PresetValues> = {
  low: { renderScale: 0.75, maxPixelRatio: 1, shadows: 'off', vegetationDensity: 0.45, viewDistance: 1000, postprocessing: false, antialiasing: 'off' },
  medium: { renderScale: 1, maxPixelRatio: 1.5, shadows: 'low', vegetationDensity: 0.8, viewDistance: 1500, postprocessing: true, antialiasing: 'msaa2' },
  high: { renderScale: 1, maxPixelRatio: 2, shadows: 'medium', vegetationDensity: 1, viewDistance: 1800, postprocessing: true, antialiasing: 'msaa4' },
  ultra: { renderScale: 1.25, maxPixelRatio: 3, shadows: 'high', vegetationDensity: 1.4, viewDistance: 2600, postprocessing: true, antialiasing: 'msaa8' },
};

export const PRESET_LABELS: Record<QualityPreset, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', ultra: 'Ultra', custom: 'Benutzerdefiniert' };
export const RESOLUTION_HEIGHTS: Record<ResolutionCap, number | null> = { auto: null, '720p': 720, '1080p': 1080, '1440p': 1440, '2160p': 2160 };
export const SHADOW_MAP_SIZES: Record<ShadowQuality, number> = { off: 0, low: 1024, medium: 2048, high: 4096 };
export const MSAA_SAMPLES: Record<AntiAliasing, number> = { off: 0, msaa2: 2, msaa4: 4, msaa8: 8 };

export function defaultSettings(): GraphicsSettings {
  return { version: SETTINGS_VERSION, preset: 'high', ...PRESET_VALUES.high, fpsLimit: 0, adaptiveQuality: true, showDebug: false, resolution: 'auto', volumeMaster: 0.8, volumeSfx: 1, volumeAmbient: 0.8, volumeMusic: 0.5, tutorial: true };
}

function pick<T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(v) ? (v as T) : fallback;
}

export function sanitizeSettings(input: unknown): GraphicsSettings {
  const d = defaultSettings();
  const s = (input ?? {}) as Partial<GraphicsSettings>;
  const num = (v: unknown, min: number, max: number, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fb);
  const out: GraphicsSettings = {
    version: SETTINGS_VERSION,
    preset: pick(s.preset, [...QUALITY_PRESETS, 'custom'] as const, d.preset),
    resolution: pick(s.resolution, RESOLUTIONS, d.resolution),
    renderScale: num(s.renderScale, 0.5, 2, d.renderScale),
    maxPixelRatio: num(s.maxPixelRatio, 1, 3, d.maxPixelRatio),
    shadows: pick(s.shadows, SHADOW_QUALITIES, d.shadows),
    vegetationDensity: num(s.vegetationDensity, 0.25, 1.5, d.vegetationDensity),
    viewDistance: num(s.viewDistance, 800, 3000, d.viewDistance),
    postprocessing: typeof s.postprocessing === 'boolean' ? s.postprocessing : d.postprocessing,
    antialiasing: pick(s.antialiasing, AA_MODES, d.antialiasing),
    fpsLimit: pick(s.fpsLimit, FPS_LIMITS, d.fpsLimit),
    adaptiveQuality: typeof s.adaptiveQuality === 'boolean' ? s.adaptiveQuality : d.adaptiveQuality,
    showDebug: typeof s.showDebug === 'boolean' ? s.showDebug : d.showDebug,
    volumeMaster: num(s.volumeMaster, 0, 1, d.volumeMaster),
    volumeSfx: num(s.volumeSfx, 0, 1, d.volumeSfx),
    volumeAmbient: num(s.volumeAmbient, 0, 1, d.volumeAmbient),
    volumeMusic: num(s.volumeMusic, 0, 1, d.volumeMusic),
    tutorial: typeof s.tutorial === 'boolean' ? s.tutorial : d.tutorial,
  };
  out.preset = detectPreset(out);
  return out;
}

/** Preset, dessen Werte exakt vorliegen, sonst 'custom'. */
export function detectPreset(s: GraphicsSettings): QualityPreset {
  for (const p of QUALITY_PRESETS) {
    const v = PRESET_VALUES[p];
    if ((Object.keys(v) as (keyof PresetValues)[]).every((k) => v[k] === s[k])) return p;
  }
  return 'custom';
}

export function applyPreset(s: GraphicsSettings, preset: Exclude<QualityPreset, 'custom'>): GraphicsSettings {
  return { ...s, ...PRESET_VALUES[preset], preset };
}

export function lowerPreset(p: QualityPreset): Exclude<QualityPreset, 'custom'> | null {
  const order = QUALITY_PRESETS;
  const i = p === 'custom' ? order.indexOf('medium') + 1 : order.indexOf(p);
  return i > 0 ? order[i - 1]! : null;
}

/**
 * Adaptive Qualität: meldet, wenn die FPS über `windowSeconds` dauerhaft unter `threshold × target` liegen.
 * Danach Abkühlzeit, damit nicht ständig gefragt wird.
 */
export class AdaptiveMonitor {
  private low = 0;
  private cooldown = 0;

  constructor(
    public targetFps = 60,
    public windowSeconds = 8,
    public threshold = 0.75,
    public cooldownSeconds = 120,
  ) {}

  /** Liefert true genau dann, wenn ein Vorschlag fällig ist. */
  push(fps: number, dt: number): boolean {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      return false;
    }
    if (fps > 0 && fps < this.targetFps * this.threshold) this.low += dt;
    else this.low = Math.max(0, this.low - dt * 2);
    if (this.low >= this.windowSeconds) {
      this.low = 0;
      this.cooldown = this.cooldownSeconds;
      return true;
    }
    return false;
  }

  reset(): void {
    this.low = 0;
  }
}
