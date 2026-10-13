/**
 * Vegetations- und Streugut-Dichten je Biom (Instanzen pro 64 m × 64 m bei Biodiversität 1,0).
 * Phase 2 nutzt Platzhalter-Pflanzen; Phase 3 ersetzt sie durch Arten aus dem Archiv.
 */
import type { BiomeKind } from '../universe/types';

export interface VegetationProfile {
  grass: number;
  shrub: number;
  tree: number;
  rock: number;
  /** Skalierung der Pflanzengrößen (1 = normal). */
  scale: number;
  /** Baumform: Nadel (Kegel) oder Laub (Kugel) oder exotisch (Pilz/Kristall). */
  treeStyle: 'conifer' | 'broadleaf' | 'fungus' | 'crystal' | 'palm';
}

const prof = (grass: number, shrub: number, tree: number, rock: number, scale = 1, treeStyle: VegetationProfile['treeStyle'] = 'broadleaf'): VegetationProfile => ({ grass, shrub, tree, rock, scale, treeStyle });

export const VEGETATION_PROFILES: Record<BiomeKind, VegetationProfile> = {
  highlands: prof(120, 20, 6, 14, 0.9, 'conifer'),
  steppe: prof(260, 14, 2, 4, 1, 'broadleaf'),
  scree: prof(30, 6, 1, 40, 0.8, 'conifer'),
  canyons: prof(40, 10, 2, 24, 0.9, 'broadleaf'),
  coastal_plain: prof(180, 18, 6, 6, 1, 'palm'),
  mountains: prof(40, 8, 4, 30, 0.8, 'conifer'),
  crystal_caverns: prof(10, 4, 0, 30, 0.8, 'crystal'),
  shallow_sea: prof(0, 0, 0, 2, 1, 'broadleaf'),
  deep_sea: prof(0, 0, 0, 0, 1, 'broadleaf'),
  reef: prof(0, 0, 0, 6, 1, 'broadleaf'),
  island_coast: prof(120, 16, 8, 6, 1, 'palm'),
  archipelago: prof(140, 18, 8, 8, 1, 'palm'),
  kelp_forest: prof(0, 0, 0, 2, 1, 'broadleaf'),
  dune_sea: prof(6, 2, 0, 2, 1, 'broadleaf'),
  salt_flat: prof(2, 1, 0, 4, 1, 'broadleaf'),
  rock_desert: prof(14, 6, 1, 26, 0.9, 'broadleaf'),
  oasis: prof(160, 22, 10, 4, 1.1, 'palm'),
  mesas: prof(24, 8, 1, 20, 0.9, 'broadleaf'),
  glacier: prof(0, 0, 0, 12, 1, 'conifer'),
  ice_plain: prof(6, 2, 0, 8, 0.8, 'conifer'),
  frost_forest: prof(60, 12, 12, 10, 0.9, 'conifer'),
  ice_caves: prof(4, 2, 0, 20, 0.8, 'crystal'),
  snow_mountains: prof(10, 4, 3, 24, 0.8, 'conifer'),
  cloud_forest: prof(200, 30, 18, 6, 1.2, 'broadleaf'),
  swamp: prof(220, 24, 8, 4, 1.1, 'broadleaf'),
  fern_forest: prof(240, 34, 16, 6, 1.3, 'broadleaf'),
  river_delta: prof(200, 20, 6, 4, 1, 'palm'),
  fungal_grove: prof(120, 30, 14, 8, 1.1, 'fungus'),
  lava_fields: prof(0, 0, 0, 30, 1, 'broadleaf'),
  ash_desert: prof(4, 2, 0, 18, 0.9, 'broadleaf'),
  sulfur_springs: prof(20, 6, 1, 16, 0.8, 'fungus'),
  obsidian_ridge: prof(4, 2, 0, 34, 0.9, 'crystal'),
  basalt_plateau: prof(16, 6, 1, 24, 0.9, 'broadleaf'),
  lava_tubes: prof(2, 2, 0, 20, 0.8, 'crystal'),
  tundra: prof(140, 16, 2, 10, 0.8, 'conifer'),
  lichen_heath: prof(160, 10, 1, 14, 0.7, 'conifer'),
  permafrost_bog: prof(160, 14, 3, 6, 0.9, 'conifer'),
  krummholz: prof(80, 30, 8, 12, 0.7, 'conifer'),
  fjord_coast: prof(90, 14, 8, 16, 0.9, 'conifer'),
  acid_marsh: prof(100, 18, 4, 6, 1, 'fungus'),
  methane_lakes: prof(20, 6, 1, 8, 0.9, 'crystal'),
  crystal_fields: prof(10, 8, 4, 20, 1, 'crystal'),
  slag_plain: prof(8, 4, 0, 22, 0.9, 'fungus'),
  crater_plain: prof(0, 0, 0, 24, 1, 'broadleaf'),
  regolith_desert: prof(0, 0, 0, 16, 1, 'broadleaf'),
  rift_fields: prof(0, 0, 0, 28, 1, 'broadleaf'),
  basalt_desert: prof(0, 0, 0, 30, 1, 'broadleaf'),
  upper_clouds: prof(0, 0, 0, 0, 1, 'broadleaf'),
  storm_band: prof(0, 0, 0, 0, 1, 'broadleaf'),
  ammonia_layer: prof(0, 0, 0, 0, 1, 'broadleaf'),
  cloud_crowns: prof(0, 0, 0, 0, 1, 'broadleaf'),
};
