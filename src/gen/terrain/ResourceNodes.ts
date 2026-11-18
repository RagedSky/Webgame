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
/** Grundrohstoffe für Werkbank und Schiff: häufiger als der Rest und nicht an bestimmte Biome gebunden. */
export const COMMON_RESOURCES: ReadonlySet<ResourceId> = new Set<ResourceId>(['ferrite', 'quartz']);
export const COMMON_FACTOR = 2.2;
export const COMMON_MIN_ABUNDANCE = 0.6;
/** Garantierte Knoten um den Landeplatz: Art → Anzahl, im Ring von 12 bis 48 m. */
export const STARTER_NODES: ReadonlyArray<readonly [ResourceId, number]> = [
  ['ferrite', 4],
  ['quartz', 3],
];
export const STARTER_RING: readonly [number, number] = [12, 48];

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
    const common = COMMON_RESOURCES.has(dep.resourceId);
    // Grundrohstoffe haben eine Mindesthäufigkeit: auch auf kargen Welten liegt im Mittel mehr als ein Knoten je Zelle
    const expected = (common ? Math.max(dep.abundance, COMMON_MIN_ABUNDANCE) * COMMON_FACTOR : dep.abundance) * base;
    let count = Math.floor(expected);
    if (rng.next() < expected - count) count++;
    for (let c = 0; c < count; c++) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const x = x0 + rng.next() * NODE_CELL;
        const z = z0 + rng.next() * NODE_CELL;
        const s = model.sample(x, z, tmp);
        const biome = planet.biomes[s.blend > 0.5 ? s.biome2 : s.biome]!;
        // Grundrohstoffe kommen auch außerhalb ihrer Stammbiome vor, dort halb so oft
        if (!dep.biomeIds.includes(biome.id) && !(common && rng.next() < 0.5)) continue;
        if (model.hasWater && s.height < model.seaLevel + 0.3) continue;
        if (model.slopeAt(x, z, 1) > 0.7) continue;
        out.push({ id: `${dep.resourceId}@${ix}:${iz}:${c}`, resourceId: dep.resourceId, x, y: s.height, z, amount: rng.int(4, 9) });
        break;
      }
    }
  }
  return out;
}

/**
 * Garantierte Grundrohstoffe rund um den Landeplatz, damit die ersten Bauten ohne lange Suche möglich sind.
 * Nur Arten, die der Planet auch als Vorkommen führt. Deterministisch aus dem Gelände-Seed.
 */
export function generateStarterNodes(model: TerrainModel, planet: Planet, spawn: { x: number; z: number }): ResourceNode[] {
  const rng = new Random(`nodes:start:${planet.terrainSeed}`);
  const out: ResourceNode[] = [];
  for (const [resourceId, count] of STARTER_NODES) {
    if (!planet.resources.some((d) => d.resourceId === resourceId)) continue;
    for (let c = 0; c < count; c++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const a = rng.float(0, Math.PI * 2);
        const r = rng.float(STARTER_RING[0], STARTER_RING[1]);
        const x = spawn.x + Math.cos(a) * r;
        const z = spawn.z + Math.sin(a) * r;
        const h = model.heightAt(x, z);
        if (model.hasWater && h < model.seaLevel + 0.3) continue;
        if (model.slopeAt(x, z, 1) > 0.6) continue;
        // nicht direkt neben einen anderen Startknoten
        if (out.some((n) => Math.hypot(n.x - x, n.z - z) < 5)) continue;
        out.push({ id: `${resourceId}@start:${c}`, resourceId, x, y: h, z, amount: 8 });
        break;
      }
    }
  }
  return out;
}
