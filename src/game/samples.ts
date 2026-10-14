/**
 * Proben (rein, testbar): Erzeugung, enthaltene Mikroorganismen (deterministisch aus Proben-Seed),
 * Mineralanalyse-Werte.
 */
import { Random } from '@/math/Random';
import type { Biome, Planet } from '@/gen/universe/types';
import type { ArchiveEntry, MicroGenome, SampleSource } from '@/gen/archive/types';
import { RARITY_SPAWN_WEIGHT } from '@/gen/archive/conditions';
import type { Sample } from './progress/ArchiveProgress';

export const SAMPLE_SOURCE_LABELS: Record<SampleSource, string> = {
  water: 'Wasserprobe',
  soil: 'Bodenprobe',
  plant: 'Pflanzenprobe',
  rock: 'Gesteinsprobe',
  ice: 'Eisprobe',
  air: 'Luftprobe',
  vent: 'Quellprobe',
};

export interface MicroCell {
  entry: ArchiveEntry;
  genome: MicroGenome;
  /** Tiefe im Präparat 0..1 (Fokus-Minispiel). */
  depth: number;
  x: number;
  y: number;
  /** Darstellungsgröße in Pixeln bei 720 px Breite. */
  size: number;
  phase: number;
}

export function createSample(source: SampleSource, planet: Planet, biome: Biome, at: number, counter: number, entry?: ArchiveEntry): Sample {
  const label = entry ? `${SAMPLE_SOURCE_LABELS[source]}: ${entry.name}` : `${SAMPLE_SOURCE_LABELS[source]} (${biome.name})`;
  return {
    id: `s-${planet.id}-${counter}-${at.toFixed(0)}`,
    source,
    planetId: planet.id,
    biomeId: biome.id,
    seed: `${planet.terrainSeed}:${source}:${biome.id}:${counter}`,
    takenAt: at,
    analyzed: false,
    label,
    ...(entry ? { entryId: entry.id } : {}),
  };
}

/** Mikroorganismen in einer Probe: 1–4 Arten des Bioms mit passender Probenquelle, Seltenheit gewichtet. */
export function microCellsForSample(sample: Sample, entries: ArchiveEntry[]): MicroCell[] {
  const rng = new Random(`cells:${sample.seed}`);
  const candidates = entries.filter((e) => {
    if (e.planetId !== sample.planetId || e.genome.kind !== 'micro') return false;
    const g = e.genome;
    if (g.sampleSource !== sample.source) return false;
    return e.biomeIds.includes(sample.biomeId);
  });
  if (candidates.length === 0) return [];
  const count = Math.min(candidates.length, rng.int(1, 4));
  const pool = candidates.map((e) => ({ item: e, weight: RARITY_SPAWN_WEIGHT[e.rarity] }));
  const chosen: ArchiveEntry[] = [];
  while (chosen.length < count && pool.length) {
    const e = rng.weighted(pool);
    chosen.push(e);
    pool.splice(
      pool.findIndex((p) => p.item === e),
      1,
    );
  }
  return chosen.map((entry, i) => {
    const g = entry.genome as MicroGenome;
    const size = 18 + Math.log2(1 + g.sizeUm) * 9;
    return {
      entry,
      genome: g,
      depth: rng.float(0.1, 0.9),
      x: 0.15 + ((i + rng.float(0.1, 0.6)) / count) * 0.7,
      y: rng.float(0.2, 0.8),
      size,
      phase: rng.float(0, Math.PI * 2),
    };
  });
}

export interface MineralAnalysis {
  purity: number;
  structure: number;
  trace: number;
  quality: number;
  notes: string[];
}

/** Analyse einer Mineralprobe: deterministische Werte, Qualität 0..1 → Sterne. */
export function analyzeMineralSample(sample: Sample): MineralAnalysis {
  const rng = new Random(`analysis:${sample.seed}`);
  const purity = rng.float(0.35, 1);
  const structure = rng.float(0.3, 1);
  const trace = rng.float(0, 1);
  const quality = purity * 0.55 + structure * 0.35 + (trace > 0.7 ? 0.1 : 0);
  const notes = [
    purity > 0.8 ? 'Sehr reine Probe.' : purity > 0.55 ? 'Mittlere Reinheit.' : 'Stark verunreinigt – bessere Fundstelle suchen.',
    structure > 0.75 ? 'Kristallstruktur vollständig erhalten.' : 'Struktur teilweise gestört.',
    trace > 0.7 ? 'Seltene Spurenelemente nachgewiesen.' : '',
  ].filter(Boolean);
  return { purity, structure, trace, quality: Math.min(1, quality), notes };
}
