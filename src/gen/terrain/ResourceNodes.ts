/**
 * Abbaubare Rohstoffknoten (rein, testbar): deterministische Platzierung je Zelle aus den Vorkommen des Planeten.
 * Gase erscheinen als Quellen, Metalle/Kristalle/Minerale als Brocken, Fasern als Büschel; Wasser wird an Gewässern gesammelt.
 */
import { Random } from '@/math/Random';
import { RESOURCES } from '../universe/catalog';
import type { Planet, ResourceId } from '../universe/types';
import type { TerrainModel, TerrainSample } from './TerrainModel';

export interface ResourceNode {
  id: string;
  resourceId: ResourceId;
  x: number;
  y: number;
  z: number;
  amount: number;
}

export const NODE_CELL = 128;

const tmp: TerrainSample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };

/** Rohstoffe, die als Knoten in der Welt erscheinen (Wasser/Sole werden an Gewässern gesammelt). */
export function isNodeResource(id: ResourceId): boolean {
  const kind = RESOURCES[id].kind;
  return kind !== 'liquid';
}

export function generateResourceNodes(model: TerrainModel, planet: Planet, ix: number, iz: number): ResourceNode[] {
  const rng = new Random(`nodes:${planet.terrainSeed}:${ix}:${iz}`);
  const out: ResourceNode[] = [];
  const x0 = ix * NODE_CELL;
  const z0 = iz * NODE_CELL;
  for (const dep of planet.resources) {
    if (!isNodeResource(dep.resourceId)) continue;
    const kind = RESOURCES[dep.resourceId].kind;
    const base = kind === 'organic' ? 2.2 : kind === 'gas' ? 0.8 : 1.6;
    const expected = dep.abundance * base;
    let count = Math.floor(expected);
    if (rng.next() < expected - count) count++;
    for (let c = 0; c < count; c++) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const x = x0 + rng.next() * NODE_CELL;
        const z = z0 + rng.next() * NODE_CELL;
        const s = model.sample(x, z, tmp);
        const biome = planet.biomes[s.blend > 0.5 ? s.biome2 : s.biome]!;
        if (!dep.biomeIds.includes(biome.id)) continue;
        if (model.hasWater && s.height < model.seaLevel + 0.3) continue;
        if (model.slopeAt(x, z, 1) > 0.7) continue;
        out.push({ id: `${dep.resourceId}@${ix}:${iz}:${c}`, resourceId: dep.resourceId, x, y: s.height, z, amount: rng.int(4, 9) });
        break;
      }
    }
  }
  return out;
}
