import { describe, expect, it } from 'vitest';
import { scoreSubject, starsForScore, type CameraSettings, type SubjectObservation } from './PhotoScoring';

const cam: CameraSettings = { focusDistance: 10, focusRange: 6, exposure: 1 };
const obs = (over: Partial<SubjectObservation> = {}): SubjectObservation => ({
  entryId: 'x',
  frameFill: 0.4,
  ndcX: 0,
  ndcY: 0,
  distance: 10,
  occlusion: 0,
  lighting: 1,
  motion: 0,
  ...over,
});

describe('PhotoScoring', () => {
  it('perfektes Foto bekommt 3 Sterne', () => {
    const s = scoreSubject(obs({ behavior: 'grazing' }), cam);
    expect(s.total).toBeGreaterThanOrEqual(90);
    expect(s.identified).toBe(true);
    expect(starsForScore(s.total)).toBe(3);
  });

  it('kleines, unscharfes, dunkles Motiv ist schlechter', () => {
    const good = scoreSubject(obs(), cam).total;
    expect(scoreSubject(obs({ frameFill: 0.08 }), cam).total).toBeLessThan(good);
    expect(scoreSubject(obs({ distance: 30 }), cam).total).toBeLessThan(good);
    expect(scoreSubject(obs({ lighting: 0.1 }), cam).total).toBeLessThan(good);
    expect(scoreSubject(obs({ ndcX: 0.9, ndcY: 0.8 }), cam).total).toBeLessThan(good);
    expect(scoreSubject(obs({ motion: 1 }), cam).total).toBeLessThan(good);
  });

  it('verdeckte oder winzige Motive werden nicht identifiziert', () => {
    expect(scoreSubject(obs({ occlusion: 0.8 }), cam).identified).toBe(false);
    expect(scoreSubject(obs({ frameFill: 0.02 }), cam).identified).toBe(false);
    expect(starsForScore(50, false)).toBe(0);
  });

  it('Toleranz hebt die Bewertung bei Grenzfällen', () => {
    const o = obs({ distance: 16, ndcX: 0.5, ndcY: 0.4 });
    expect(scoreSubject(o, cam, 0.8).total).toBeGreaterThan(scoreSubject(o, cam, 0).total);
  });

  it('Belichtung extrem → Abzug; Himmelsmotiv ignoriert Fokus', () => {
    expect(scoreSubject(obs(), { ...cam, exposure: 3 }).total).toBeLessThan(scoreSubject(obs(), cam).total);
    const sky = scoreSubject(obs({ distance: 1000, frameFill: 0.6 }), { ...cam, kind: 'sky' });
    expect(sky.total).toBeGreaterThan(60);
  });

  it('Sterne-Schwellen', () => {
    expect(starsForScore(10)).toBe(0);
    expect(starsForScore(25)).toBe(1);
    expect(starsForScore(60)).toBe(2);
    expect(starsForScore(85)).toBe(3);
  });
});
