import { describe, expect, it } from 'vitest';
import { AdaptiveMonitor, applyPreset, defaultSettings, detectPreset, lowerPreset, sanitizeSettings, PRESET_VALUES } from './Settings';

describe('GraphicsSettings', () => {
  it('Standard ist Preset „Hoch“, Presets werden erkannt, Abweichung ergibt „custom“', () => {
    const d = defaultSettings();
    expect(detectPreset(d)).toBe('high');
    const low = applyPreset(d, 'low');
    expect(low.preset).toBe('low');
    expect(low.shadows).toBe('off');
    const custom = { ...low, renderScale: 0.9 };
    expect(detectPreset(custom)).toBe('custom');
    expect(lowerPreset('high')).toBe('medium');
    expect(lowerPreset('low')).toBeNull();
    expect(lowerPreset('custom')).toBe('medium');
  });

  it('begrenzt und repariert ungültige Werte', () => {
    const s = sanitizeSettings({ renderScale: 9, maxPixelRatio: 0, shadows: 'extreme', viewDistance: 100, fpsLimit: 45, antialiasing: 'fxaa', postprocessing: 'ja' });
    expect(s.renderScale).toBe(2);
    expect(s.maxPixelRatio).toBe(1);
    expect(s.shadows).toBe(PRESET_VALUES.high.shadows);
    expect(s.viewDistance).toBe(800);
    expect(s.fpsLimit).toBe(0);
    expect(s.antialiasing).toBe('msaa4');
    expect(s.postprocessing).toBe(true);
    expect(s.preset).toBe('custom');
    expect(sanitizeSettings(undefined)).toEqual(defaultSettings());
  });

  it('AdaptiveMonitor meldet nach anhaltend niedrigen FPS einmal und kühlt ab', () => {
    const m = new AdaptiveMonitor(60, 4, 0.75, 30);
    let fired = 0;
    for (let i = 0; i < 30; i++) if (m.push(30, 0.25)) fired++;
    expect(fired).toBe(1);
    for (let i = 0; i < 100; i++) if (m.push(30, 0.25)) fired++;
    expect(fired).toBe(1);
    // Abkühlzeit 30 s: nach 25 s noch gesperrt, 5 s Rest + 4 s Fenster → zweiter Vorschlag nach ~9 s, dann wieder gesperrt
    for (let i = 0; i < 120; i++) if (m.push(30, 0.25)) fired++;
    expect(fired).toBe(2);
    const ok = new AdaptiveMonitor(60, 4);
    for (let i = 0; i < 100; i++) expect(ok.push(58, 0.25)).toBe(false);
  });
});
