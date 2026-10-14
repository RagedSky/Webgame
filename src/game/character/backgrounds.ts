/**
 * Hintergründe mit Spielstil-Boni (rein). Alle Boni sind kleine, lesbare Faktoren – kein Pflichtweg.
 */
import type { BackgroundId } from './Character';

export interface BackgroundBonus {
  /** Hinweise kommen x-mal so oft (HintSystem). */
  hintRate: number;
  /** Sichtungs-Reichweite im HUD (Faktor). */
  sightingRange: number;
  /** Zusatzqualität beim Scan von Fossilien/Ruinen (0..1). */
  scanQuality: number;
  /** Zusatzqualität bei der Mineralanalyse (0..1). */
  analysisQuality: number;
  /** Zusätzliche Einheiten je Abbau. */
  harvestBonus: number;
  /** Faktor auf Rezept- und Schiffsteilkosten (aufgerundet, min. 1). */
  costFactor: number;
  /** Sammel-/Bautempo (Faktor auf die Haltezeit). */
  harvestSpeed: number;
  /** Toleranz der Fotobewertung 0..1. */
  photoTolerance: number;
  /** Zusätzliche Kamerafilter (Infrarot, Noir). */
  extraFilters: boolean;
}

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  description: string;
  bonusText: string;
  bonus: BackgroundBonus;
}

export const NEUTRAL_BONUS: BackgroundBonus = { hintRate: 1, sightingRange: 1, scanQuality: 0, analysisQuality: 0, harvestBonus: 0, costFactor: 1, harvestSpeed: 1, photoTolerance: 0, extraFilters: false };

export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: 'biologist',
    name: 'Biologe',
    description: 'Liest Spuren und Verhalten. Hinweise auf Tiere kommen häufiger, Sichtungen werden weiter entfernt erkannt.',
    bonusText: 'Hinweise ×1,7 · Sichtungsweite +35 %',
    bonus: { ...NEUTRAL_BONUS, hintRate: 1.7, sightingRange: 1.35 },
  },
  {
    id: 'geologist',
    name: 'Geologin',
    description: 'Erkennt Erze und Gesteine auf einen Blick. Scans und Analysen liefern bessere Bewertungen, Abbau bringt mehr.',
    bonusText: 'Scan-Qualität +0,25 · Analyse +0,2 · +1 Einheit je Abbau',
    bonus: { ...NEUTRAL_BONUS, scanQuality: 0.25, analysisQuality: 0.2, harvestBonus: 1 },
  },
  {
    id: 'engineer',
    name: 'Ingenieur',
    description: 'Baut günstiger und schneller: Rezepte und Schiffsteile kosten weniger, Sammeln und Bauen gehen zügiger.',
    bonusText: 'Kosten −20 % · Sammeltempo +35 %',
    bonus: { ...NEUTRAL_BONUS, costFactor: 0.8, harvestSpeed: 1.35 },
  },
  {
    id: 'photographer',
    name: 'Fotografin',
    description: 'Mehr Kameraoptionen und ein geübter Blick: Fokus und Komposition werden großzügiger bewertet, Infrarot- und Noir-Filter verfügbar.',
    bonusText: 'Bewertungstoleranz +35 % · Filter Infrarot/Noir',
    bonus: { ...NEUTRAL_BONUS, photoTolerance: 0.35, extraFilters: true },
  },
];

export const BACKGROUND_BY_ID: Record<BackgroundId, BackgroundDef> = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b])) as Record<BackgroundId, BackgroundDef>;

export function bonusesFor(id: BackgroundId | null | undefined): BackgroundBonus {
  return id ? BACKGROUND_BY_ID[id].bonus : NEUTRAL_BONUS;
}

/** Kosten mit Faktor skalieren (aufgerundet, mindestens 1 je Rohstoff). */
export function scaleCost<T extends Record<string, number | undefined>>(cost: T, factor: number): T {
  if (factor === 1) return cost;
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(cost)) if (n !== undefined) out[id] = Math.max(1, Math.ceil(n * factor - 1e-9));
  return out as T;
}
