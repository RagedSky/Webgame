/**
 * Fotobewertung (rein, testbar): Bildausschnitt, Komposition, Fokus, Beleuchtung, Sichtbarkeit, Verhalten.
 * Ergebnis 0–100 → Sterne 1–3. Ein Motiv gilt als identifiziert, wenn es groß genug, sichtbar und ≥ 25 Punkte hat.
 */
import { clamp, clamp01, smoothstep } from '@/math/utils';

export interface SubjectObservation {
  entryId: string;
  /** Anteil der Bildhöhe, den das Motiv einnimmt (0..1, kann >1 sein, wenn es den Rahmen sprengt). */
  frameFill: number;
  /** Mittelpunkt des Motivs in normierten Gerätekoordinaten (−1..1). */
  ndcX: number;
  ndcY: number;
  /** Entfernung Kamera → Motiv in Metern. */
  distance: number;
  /** Verdeckter Anteil 0..1 (Terrain, Wasser, Objekte). */
  occlusion: number;
  /** Beleuchtung 0..1 (Tageslicht, Sonnenstand, Nachtsicht). */
  lighting: number;
  /** Aktuell gezeigtes Verhalten (z. B. 'grazing'), leer wenn keins. */
  behavior?: string;
  /** Eigenbewegung 0..1 (Bewegungsunschärfe-Risiko). */
  motion: number;
}

export interface CameraSettings {
  /** Fokusentfernung in Metern. */
  focusDistance: number;
  /** Schärfebereich (Tiefe) in Metern – kleiner bei offener Blende. */
  focusRange: number;
  /** Belichtung (1 = neutral). */
  exposure: number;
  /** Motivkategorie: Wetter/Himmel wird anders bewertet. */
  kind?: 'subject' | 'sky';
}

export interface ScoreBreakdown {
  total: number;
  size: number;
  composition: number;
  focus: number;
  lighting: number;
  visibility: number;
  behaviorBonus: number;
  exposurePenalty: number;
  motionPenalty: number;
  identified: boolean;
  notes: string[];
}

export type Stars = 0 | 1 | 2 | 3;

export function starsForScore(score: number, identified = true): Stars {
  if (!identified || score < 25) return 0;
  if (score >= 85) return 3;
  if (score >= 60) return 2;
  return 1;
}

/** Abstand des Motivs zum nächsten Kompositionspunkt (Mitte oder Drittelpunkte). */
function compositionDistance(x: number, y: number): number {
  let best = Math.hypot(x, y);
  for (const px of [-0.33, 0.33]) for (const py of [-0.33, 0.33]) best = Math.min(best, Math.hypot(x - px, y - py));
  return best;
}

/**
 * Bewertet ein Motiv. `tolerance` (0..1) weitet Toleranzen (Fotograf-Hintergrund, Phase 8).
 */
export function scoreSubject(obs: SubjectObservation, cam: CameraSettings, tolerance = 0): ScoreBreakdown {
  const notes: string[] = [];
  const tol = clamp01(tolerance);

  // Bildausschnitt: ideal 20–70 % der Bildhöhe
  const fill = obs.frameFill;
  let size: number;
  if (fill < 0.05) size = 0;
  else if (fill < 0.2) size = 100 * smoothstep(0.05, 0.2, fill);
  else if (fill <= 0.7) size = 100;
  else size = 100 * (1 - smoothstep(0.7, 1.3, fill));
  if (fill < 0.12) notes.push('Motiv zu klein – näher heran oder zoomen.');
  if (fill > 1.0) notes.push('Motiv sprengt den Rahmen.');

  // Komposition
  const cd = compositionDistance(obs.ndcX, obs.ndcY);
  const composition = 100 * (1 - smoothstep(0.1 + tol * 0.1, 0.9, cd));
  if (cd > 0.6) notes.push('Motiv liegt am Bildrand.');

  // Fokus
  const range = cam.focusRange * (1 + tol);
  const d = Math.abs(obs.distance - cam.focusDistance);
  const focus = 100 * (1 - smoothstep(range * 0.5, range * 2.2, d));
  if (focus < 50) notes.push('Unscharf – Fokus anpassen.');

  // Beleuchtung
  const lighting = 30 + 70 * clamp01(obs.lighting);
  if (obs.lighting < 0.25) notes.push('Zu dunkel – Nachtsicht oder Tageslicht abwarten.');

  // Sichtbarkeit
  const visibility = 100 * (1 - clamp01(obs.occlusion));
  if (obs.occlusion > 0.3) notes.push('Teilweise verdeckt.');

  const behaviorBonus = obs.behavior ? 8 : 0;
  const exposurePenalty = Math.abs(Math.log2(clamp(cam.exposure, 0.1, 10))) > 0.7 ? 12 : 0;
  if (exposurePenalty) notes.push('Belichtung zu extrem.');
  const motionPenalty = Math.round(clamp01(obs.motion) * 18 * (1 - tol * 0.5));
  if (motionPenalty > 8) notes.push('Bewegungsunschärfe.');

  let total: number;
  if (cam.kind === 'sky') {
    // Himmelsphänomene: Bildanteil und Belichtung zählen, Fokus ist unendlich
    total = size * 0.55 + composition * 0.15 + lighting * 0.3 + behaviorBonus - exposurePenalty;
  } else {
    total = size * 0.3 + composition * 0.2 + focus * 0.2 + lighting * 0.15 + visibility * 0.15 + behaviorBonus - exposurePenalty - motionPenalty;
  }
  total = Math.round(clamp(total, 0, 100));
  const identified = fill >= 0.05 && obs.occlusion < 0.6 && total >= 25;
  return { total, size, composition, focus, lighting, visibility, behaviorBonus, exposurePenalty, motionPenalty, identified, notes };
}
