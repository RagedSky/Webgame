/**
 * Kataloge: Sonnentypen, Planetentypen, Biome, Rohstoffe, Wetter, Gefahren.
 * Alles hier ist statisch; die Generatoren würfeln aus diesen Tabellen.
 */
import type { Category } from '../archive/types';
import type {
  BiomeKind,
  BiomePalette,
  Gas,
  Hazard,
  PlanetType,
  ResourceDef,
  ResourceId,
  StarType,
  WeatherType,
} from './types';

// ---------------------------------------------------------------------------
// Sterne
// ---------------------------------------------------------------------------

export interface StarTypeDef {
  type: StarType;
  label: string;
  color: string;
  lightColor: string;
  temperatureK: [number, number];
  luminosity: [number, number];
  mass: [number, number];
  radius: [number, number];
  /** Lebenszone in AU (wird mit sqrt(Leuchtkraft) skaliert). */
  habitableZone: [number, number];
  /** Kleinster Orbit in AU. */
  minOrbit: number;
  radiation: [number, number];
  /** Zusätzliche Gewichtung lebensfreundlicher Planetentypen. */
  lifeBias: number;
  /** Gewicht bei der Zufallswahl. */
  weight: number;
  /** Beschreibung für die Übersicht. */
  description: string;
}

export const STAR_TYPES: Record<StarType, StarTypeDef> = {
  yellow: {
    type: 'yellow',
    label: 'Gelbe Sonne',
    color: '#ffd978',
    lightColor: '#fff4dc',
    temperatureK: [5300, 6000],
    luminosity: [0.8, 1.3],
    mass: [0.9, 1.1],
    radius: [0.9, 1.15],
    habitableZone: [0.8, 1.6],
    minOrbit: 0.3,
    radiation: [0.05, 0.15],
    lifeBias: 1.4,
    weight: 45,
    description: 'Ausgewogen, viele lebensfreundliche Welten, moderate Distanzen. Einsteigerfreundlich.',
  },
  red_giant: {
    type: 'red_giant',
    label: 'Roter Riese',
    color: '#ff6a3d',
    lightColor: '#ffc2a0',
    temperatureK: [3300, 4200],
    luminosity: [8, 25],
    mass: [1.0, 1.6],
    radius: [12, 30],
    habitableZone: [3.5, 6.5],
    minOrbit: 0.9,
    radiation: [0.15, 0.3],
    lifeBias: 0.8,
    weight: 30,
    description: 'Lebenszone weit außen, innere Planeten sind Glutwüsten und Lavawelten. Große Distanzen, mehr Treibstoff.',
  },
  blue_dwarf: {
    type: 'blue_dwarf',
    label: 'Blauer Zwerg',
    color: '#8ec5ff',
    lightColor: '#d6e8ff',
    temperatureK: [9000, 14000],
    luminosity: [0.15, 0.35],
    mass: [0.4, 0.6],
    radius: [0.3, 0.5],
    habitableZone: [0.25, 0.6],
    minOrbit: 0.08,
    radiation: [0.65, 0.95],
    lifeBias: 0.9,
    weight: 25,
    description: 'Hohe Strahlung, Lebenszone nah an der Sonne, exotische Fauna, Strahlungszonen als Gefahr.',
  },
};

// ---------------------------------------------------------------------------
// Biome
// ---------------------------------------------------------------------------

export interface BiomeDef {
  kind: BiomeKind;
  name: string;
  humidity: number;
  altitude: [number, number];
  temperatureOffset: number;
  hasWater: boolean;
  isCave: boolean;
  palette: BiomePalette;
  /** Namenspräfixe für Arten aus diesem Biom. */
  prefixes: string[];
}

const biome = (
  kind: BiomeKind,
  name: string,
  humidity: number,
  altitude: [number, number],
  temperatureOffset: number,
  hasWater: boolean,
  palette: BiomePalette,
  prefixes: string[],
  isCave = false,
): BiomeDef => ({ kind, name, humidity, altitude, temperatureOffset, hasWater, isCave, palette, prefixes });

export const BIOMES: Record<BiomeKind, BiomeDef> = {
  highlands: biome('highlands', 'Hochland', 0.4, [0.5, 0.85], -6, false, { ground: '#7d7463', accent: '#9a8f78', vegetation: '#6b8a4a' }, ['Hochland', 'Berg', 'Fels']),
  steppe: biome('steppe', 'Steppe', 0.3, [0.15, 0.45], 0, false, { ground: '#a89a5c', accent: '#c4b06a', vegetation: '#9aa64c' }, ['Steppen', 'Gras', 'Weiten']),
  scree: biome('scree', 'Geröllfelder', 0.2, [0.4, 0.8], -3, false, { ground: '#6f6a66', accent: '#8d8783', vegetation: '#5c6b44' }, ['Geröll', 'Stein', 'Schutt']),
  canyons: biome('canyons', 'Canyons', 0.2, [0.1, 0.6], 4, false, { ground: '#b2673f', accent: '#d08a55', vegetation: '#7a7a3c' }, ['Schlucht', 'Canyon', 'Rotfels']),
  coastal_plain: biome('coastal_plain', 'Küstenebene', 0.6, [0, 0.2], 1, true, { ground: '#8aa06a', accent: '#c8c08a', vegetation: '#5f9a4a' }, ['Küsten', 'Strand', 'Ufer']),
  mountains: biome('mountains', 'Bergland', 0.4, [0.7, 1], -12, false, { ground: '#6d6f72', accent: '#e6e9ee', vegetation: '#4e6a3f' }, ['Gipfel', 'Berg', 'Grat']),
  crystal_caverns: biome('crystal_caverns', 'Kristallhöhlen', 0.5, [0.2, 0.6], -2, false, { ground: '#4a4660', accent: '#9fb6ff', vegetation: '#5c6a8a' }, ['Höhlen', 'Kristall', 'Tiefen'], true),
  shallow_sea: biome('shallow_sea', 'Flachmeer', 1, [0, 0.1], 0, true, { ground: '#3a7c9c', accent: '#6fc2d8', vegetation: '#3f8f6a' }, ['Flachmeer', 'Lagunen', 'Seicht']),
  deep_sea: biome('deep_sea', 'Tiefsee', 1, [0, 0.05], -4, true, { ground: '#1c3a5e', accent: '#2a5a86', vegetation: '#24505a' }, ['Tiefsee', 'Abgrund', 'Nacht']),
  reef: biome('reef', 'Riff', 1, [0, 0.12], 1, true, { ground: '#d07a7a', accent: '#ffb27a', vegetation: '#4fb28f' }, ['Riff', 'Korallen', 'Bunt']),
  island_coast: biome('island_coast', 'Inselküste', 0.8, [0.05, 0.3], 0, true, { ground: '#c9bc84', accent: '#e9dba0', vegetation: '#4e9a52' }, ['Insel', 'Strand', 'Palmen']),
  archipelago: biome('archipelago', 'Archipel', 0.8, [0.05, 0.4], 0, true, { ground: '#8a8f5a', accent: '#b0b67a', vegetation: '#4a8a46' }, ['Archipel', 'Insel', 'Klippen']),
  kelp_forest: biome('kelp_forest', 'Kelpwald', 1, [0, 0.08], -1, true, { ground: '#2c5a4a', accent: '#5a8a5a', vegetation: '#3a7a3a' }, ['Kelp', 'Tang', 'Seegras']),
  dune_sea: biome('dune_sea', 'Dünenmeer', 0.05, [0.1, 0.4], 6, false, { ground: '#d9b56a', accent: '#f0d28a', vegetation: '#9a8a4a' }, ['Dünen', 'Sand', 'Wander']),
  salt_flat: biome('salt_flat', 'Salzpfanne', 0.02, [0, 0.15], 4, false, { ground: '#e6e2d6', accent: '#ffffff', vegetation: '#9a9a7a' }, ['Salz', 'Glanz', 'Weiß']),
  rock_desert: biome('rock_desert', 'Felswüste', 0.08, [0.2, 0.6], 5, false, { ground: '#a0704a', accent: '#c48f5e', vegetation: '#7a7a3a' }, ['Felswüsten', 'Glut', 'Stein']),
  oasis: biome('oasis', 'Oase', 0.7, [0.05, 0.25], -3, true, { ground: '#7a9a4a', accent: '#5fb0c0', vegetation: '#3f9a3a' }, ['Oasen', 'Quell', 'Schatten']),
  mesas: biome('mesas', 'Tafelberge', 0.1, [0.5, 0.9], 2, false, { ground: '#b06040', accent: '#d08060', vegetation: '#6a6a3a' }, ['Tafelberg', 'Plateau', 'Hoch']),
  glacier: biome('glacier', 'Gletscher', 0.3, [0.4, 0.9], -10, false, { ground: '#cfe6f5', accent: '#ffffff', vegetation: '#7a9aa0' }, ['Gletscher', 'Eis', 'Frost']),
  ice_plain: biome('ice_plain', 'Eisebene', 0.2, [0, 0.3], -4, false, { ground: '#e3f0fa', accent: '#bcd7ea', vegetation: '#8aa0a8' }, ['Eis', 'Schnee', 'Weiß']),
  frost_forest: biome('frost_forest', 'Frostwald', 0.5, [0.2, 0.55], -2, false, { ground: '#b7c7cf', accent: '#d8e6ec', vegetation: '#3f6a5a' }, ['Frost', 'Raureif', 'Nadel']),
  ice_caves: biome('ice_caves', 'Eishöhlen', 0.6, [0.1, 0.5], -1, true, { ground: '#8fb6d0', accent: '#cfe8ff', vegetation: '#5a8a8a' }, ['Höhlen', 'Eis', 'Tief'], true),
  snow_mountains: biome('snow_mountains', 'Schneegebirge', 0.4, [0.7, 1], -15, false, { ground: '#9aa5b0', accent: '#ffffff', vegetation: '#4a6a5a' }, ['Gipfel', 'Schnee', 'Sturm']),
  cloud_forest: biome('cloud_forest', 'Nebelwald', 0.95, [0.3, 0.7], -2, true, { ground: '#3f5a3a', accent: '#8ab08a', vegetation: '#2f8a3f' }, ['Nebel', 'Wolken', 'Moos']),
  swamp: biome('swamp', 'Sumpf', 1, [0, 0.15], 2, true, { ground: '#4a5a2a', accent: '#6a7a3a', vegetation: '#3f7a2f' }, ['Sumpf', 'Moor', 'Schlamm']),
  fern_forest: biome('fern_forest', 'Riesenfarnwald', 0.85, [0.1, 0.45], 0, true, { ground: '#3a4a2a', accent: '#5a7a3a', vegetation: '#2f9a3a' }, ['Farn', 'Wald', 'Schatten']),
  river_delta: biome('river_delta', 'Flussdelta', 0.9, [0, 0.12], 1, true, { ground: '#6a7a4a', accent: '#5fa0b0', vegetation: '#4a9a4a' }, ['Delta', 'Fluss', 'Schilf']),
  fungal_grove: biome('fungal_grove', 'Pilzhaine', 0.9, [0.1, 0.4], 1, true, { ground: '#5a4a5a', accent: '#b07ab0', vegetation: '#8a5a9a' }, ['Pilz', 'Sporen', 'Schirm']),
  lava_fields: biome('lava_fields', 'Lavafelder', 0.05, [0.1, 0.4], 40, false, { ground: '#2a2a2a', accent: '#ff5a1a', vegetation: '#5a3a2a' }, ['Lava', 'Glut', 'Feuer']),
  ash_desert: biome('ash_desert', 'Aschewüste', 0.05, [0.1, 0.5], 10, false, { ground: '#5a5650', accent: '#8a847a', vegetation: '#6a6a5a' }, ['Asche', 'Rauch', 'Grau']),
  sulfur_springs: biome('sulfur_springs', 'Schwefelquellen', 0.6, [0, 0.25], 15, true, { ground: '#c9b24a', accent: '#f0e060', vegetation: '#8a8a3a' }, ['Schwefel', 'Dampf', 'Quell']),
  obsidian_ridge: biome('obsidian_ridge', 'Obsidiangebirge', 0.1, [0.6, 1], 0, false, { ground: '#1a1a22', accent: '#3a3a4a', vegetation: '#3a4a3a' }, ['Obsidian', 'Glas', 'Schwarz']),
  basalt_plateau: biome('basalt_plateau', 'Basaltplateau', 0.15, [0.4, 0.75], 5, false, { ground: '#3a3a3a', accent: '#5a5a5a', vegetation: '#5a6a3a' }, ['Basalt', 'Plateau', 'Säulen']),
  lava_tubes: biome('lava_tubes', 'Lavaröhren', 0.3, [0.1, 0.5], 8, false, { ground: '#2a1a1a', accent: '#ff7a2a', vegetation: '#4a3a3a' }, ['Röhren', 'Höhlen', 'Glut'], true),
  tundra: biome('tundra', 'Tundra', 0.4, [0.1, 0.4], 0, true, { ground: '#8a9a7a', accent: '#b0b89a', vegetation: '#6a8a5a' }, ['Tundra', 'Moos', 'Weiten']),
  lichen_heath: biome('lichen_heath', 'Flechtenheide', 0.5, [0.2, 0.5], -1, false, { ground: '#9aa08a', accent: '#c0c0a0', vegetation: '#7a9a6a' }, ['Flechten', 'Heide', 'Grau']),
  permafrost_bog: biome('permafrost_bog', 'Permafrost-Moor', 0.9, [0, 0.15], -2, true, { ground: '#5a6a5a', accent: '#7a8a7a', vegetation: '#4a7a4a' }, ['Moor', 'Frost', 'Torf']),
  krummholz: biome('krummholz', 'Krummholz', 0.5, [0.4, 0.7], -4, false, { ground: '#6a7a5a', accent: '#8a9a6a', vegetation: '#3a6a4a' }, ['Krumm', 'Wind', 'Zwerg']),
  fjord_coast: biome('fjord_coast', 'Fjordküste', 0.7, [0, 0.5], -1, true, { ground: '#6a7a7a', accent: '#4a8aa0', vegetation: '#3f7a5a' }, ['Fjord', 'Klippen', 'Küsten']),
  acid_marsh: biome('acid_marsh', 'Säuremoor', 0.9, [0, 0.15], 3, true, { ground: '#6a7a2a', accent: '#b0e03a', vegetation: '#8aa02a' }, ['Säure', 'Gift', 'Ätz']),
  methane_lakes: biome('methane_lakes', 'Methanseen', 0.8, [0, 0.1], -2, true, { ground: '#4a4a6a', accent: '#6a7ab0', vegetation: '#5a6a8a' }, ['Methan', 'See', 'Schimmer']),
  crystal_fields: biome('crystal_fields', 'Kristallfelder', 0.2, [0.2, 0.6], 0, false, { ground: '#5a4a7a', accent: '#c08aff', vegetation: '#7a5aa0' }, ['Kristall', 'Splitter', 'Glanz']),
  slag_plain: biome('slag_plain', 'Schlackenebene', 0.1, [0.1, 0.4], 6, false, { ground: '#4a3a3a', accent: '#7a5a4a', vegetation: '#6a5a3a' }, ['Schlacken', 'Rost', 'Öd']),
  crater_plain: biome('crater_plain', 'Kraterebene', 0, [0.1, 0.4], 0, false, { ground: '#8a8a8a', accent: '#b0b0b0', vegetation: '#7a7a7a' }, ['Krater', 'Staub', 'Still']),
  regolith_desert: biome('regolith_desert', 'Regolithwüste', 0, [0, 0.3], 2, false, { ground: '#9a9080', accent: '#c0b8a8', vegetation: '#8a8a7a' }, ['Regolith', 'Staub', 'Grau']),
  rift_fields: biome('rift_fields', 'Rissfelder', 0, [0.2, 0.6], -2, false, { ground: '#6a6a70', accent: '#3a3a40', vegetation: '#6a6a6a' }, ['Riss', 'Spalt', 'Schatten']),
  basalt_desert: biome('basalt_desert', 'Basaltwüste', 0, [0.3, 0.8], 1, false, { ground: '#3a3a40', accent: '#5a5a60', vegetation: '#5a5a5a' }, ['Basalt', 'Schwarz', 'Öd']),
  upper_clouds: biome('upper_clouds', 'Obere Wolkendecke', 0.7, [0.7, 1], -20, false, { ground: '#e8d8b8', accent: '#fff0d0', vegetation: '#d0c0a0' }, ['Wolken', 'Höhen', 'Licht']),
  storm_band: biome('storm_band', 'Sturmband', 0.8, [0.4, 0.8], 0, false, { ground: '#b08a5a', accent: '#e0b070', vegetation: '#a08a6a' }, ['Sturm', 'Wirbel', 'Band']),
  ammonia_layer: biome('ammonia_layer', 'Ammoniakschicht', 0.9, [0.2, 0.5], 10, false, { ground: '#8a9ab0', accent: '#b0c0d8', vegetation: '#8a9aa8' }, ['Ammoniak', 'Dunst', 'Tiefen']),
  cloud_crowns: biome('cloud_crowns', 'Wolkenkronen', 0.6, [0.85, 1], -25, false, { ground: '#f0e0f0', accent: '#ffffff', vegetation: '#d8c8d8' }, ['Kronen', 'Gipfel', 'Schweb']),
};

// ---------------------------------------------------------------------------
// Rohstoffe
// ---------------------------------------------------------------------------

const res = (
  id: ResourceId,
  name: string,
  kind: ResourceDef['kind'],
  tier: ResourceDef['tier'],
  planetWeights: Partial<Record<PlanetType, number>>,
  description: string,
  fuelRole?: ResourceDef['fuelRole'],
): ResourceDef => ({ id, name, kind, tier, planetWeights, description, ...(fuelRole ? { fuelRole } : {}) });

const ALL_TERRESTRIAL: Partial<Record<PlanetType, number>> = {
  rocky: 1, ocean: 0.6, desert: 1, ice: 0.7, jungle: 0.7, volcanic: 1, tundra: 0.8, toxic: 0.8, barren: 1,
};

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  ferrite: res('ferrite', 'Ferrit-Erz', 'metal', 1, ALL_TERRESTRIAL, 'Eisenhaltiges Erz, Grundlage für Rumpf und Bauteile.'),
  cuprite: res('cuprite', 'Kupfererz', 'metal', 1, { rocky: 0.9, desert: 0.8, volcanic: 0.9, barren: 0.7, tundra: 0.5, jungle: 0.4, ice: 0.3, toxic: 0.6, ocean: 0.3 }, 'Leitfähiges Metall für Elektronik und Verkabelung.'),
  titanite: res('titanite', 'Titanit', 'metal', 2, { rocky: 0.6, volcanic: 0.8, barren: 0.7, desert: 0.5, ice: 0.3, tundra: 0.4, toxic: 0.4 }, 'Leichtes, hochfestes Metall für Triebwerke und Schilde.'),
  cobaltite: res('cobaltite', 'Kobaltit', 'metal', 2, { rocky: 0.5, volcanic: 0.7, barren: 0.6, toxic: 0.6, ice: 0.3, desert: 0.3, tundra: 0.3 }, 'Kobalt-Mineral; stabilisiert exotherme Reaktionen.', 'stabilizer'),
  aurum: res('aurum', 'Goldader', 'metal', 3, { rocky: 0.3, desert: 0.3, volcanic: 0.4, barren: 0.3, jungle: 0.2 }, 'Edelmetall für Hochleistungs-Elektronik.'),
  quartz: res('quartz', 'Quarzkristall', 'crystal', 1, { rocky: 1, desert: 1, volcanic: 0.6, barren: 0.8, ice: 0.6, tundra: 0.7, jungle: 0.6, ocean: 0.4, toxic: 0.7 }, 'Reiner Kristall für Sensoren und Optik.', 'stabilizer'),
  lumite: res('lumite', 'Lumit-Kristall', 'crystal', 2, { ice: 0.7, toxic: 0.9, rocky: 0.4, desert: 0.4, volcanic: 0.5, barren: 0.5 }, 'Schwach leuchtender Kristall, Energiespeicher-Medium.'),
  obsidian: res('obsidian', 'Obsidian', 'mineral', 1, { volcanic: 1, rocky: 0.3, barren: 0.4, desert: 0.2 }, 'Vulkanglas; scharfkantig, hitzebeständig.'),
  silica: res('silica', 'Silikatsand', 'mineral', 1, { desert: 1, rocky: 0.7, barren: 0.6, ocean: 0.5, tundra: 0.3, toxic: 0.4, volcanic: 0.3, ice: 0.2, jungle: 0.3 }, 'Feiner Sand für Glas und Keramik.'),
  sulfur: res('sulfur', 'Schwefel', 'mineral', 1, { volcanic: 1, toxic: 0.9, rocky: 0.4, desert: 0.4, barren: 0.3, jungle: 0.2, tundra: 0.2 }, 'Gelbes Mineral aus Vulkanquellen; brennbar.', 'energy'),
  carbon: res('carbon', 'Graphit', 'mineral', 1, { rocky: 0.6, jungle: 0.7, volcanic: 0.5, tundra: 0.5, desert: 0.4, barren: 0.4, toxic: 0.5, ocean: 0.3 }, 'Kohlenstoff; Brennstoff und Baustoff zugleich.', 'energy'),
  phosphor: res('phosphor', 'Phosphorit', 'mineral', 1, { jungle: 0.8, ocean: 0.7, rocky: 0.5, tundra: 0.5, desert: 0.4, toxic: 0.5, ice: 0.3 }, 'Phosphathaltiges Gestein; dämpft Reaktionen.', 'stabilizer'),
  uranite: res('uranite', 'Uranit', 'mineral', 3, { barren: 0.6, rocky: 0.4, volcanic: 0.5, desert: 0.4, toxic: 0.5 }, 'Radioaktives Erz; Reaktorbrennstoff mit Schutzbedarf.'),
  saltpeter: res('saltpeter', 'Salpeter', 'mineral', 1, { desert: 1, rocky: 0.7, tundra: 0.5, jungle: 0.5, ocean: 0.4, toxic: 0.4, barren: 0.3, ice: 0.3 }, 'Nitrat-Salz; kräftiger Oxidator.', 'oxidizer'),
  perchlorate: res('perchlorate', 'Perchlorat-Salz', 'mineral', 1, { desert: 0.9, barren: 0.8, rocky: 0.6, toxic: 0.6, ice: 0.5, tundra: 0.4, volcanic: 0.3 }, 'Sauerstoffreiches Salz; aggressiver Oxidator.', 'oxidizer'),
  peroxide_ice: res('peroxide_ice', 'Peroxid-Eis', 'mineral', 1, { ice: 1, tundra: 0.7, ocean: 0.4, rocky: 0.3, jungle: 0.3, toxic: 0.3 }, 'Gefrorene Peroxid-Lösung; gibt beim Erwärmen Sauerstoff frei.', 'oxidizer'),
  water: res('water', 'Wasser', 'liquid', 1, { ocean: 1, jungle: 1, rocky: 0.8, tundra: 0.8, desert: 0.3, ice: 0.6, toxic: 0.2, volcanic: 0.2 }, 'Flüssiges Wasser; Sauerstoff- und Wasserstoffquelle.'),
  ice: res('ice', 'Wassereis', 'mineral', 1, { ice: 1, tundra: 0.8, barren: 0.4, rocky: 0.3 }, 'Gefrorenes Wasser; schmelzbar.'),
  brine: res('brine', 'Sole', 'liquid', 1, { ocean: 0.8, desert: 0.5, toxic: 0.6, rocky: 0.3 }, 'Salzhaltige Lösung; Mineralquelle.'),
  hydrogen: res('hydrogen', 'Wasserstoff', 'gas', 1, { gas_giant: 1, ocean: 0.5, ice: 0.4, jungle: 0.3, rocky: 0.3, tundra: 0.3 }, 'Leichtestes Gas; energiereicher Brennstoff.', 'energy'),
  methane: res('methane', 'Methan', 'gas', 1, { toxic: 1, gas_giant: 0.8, ice: 0.5, jungle: 0.6, tundra: 0.5, ocean: 0.4, rocky: 0.3 }, 'Sumpf- und Eisgas; brennt sauber.', 'energy'),
  ammonia: res('ammonia', 'Ammoniak', 'gas', 1, { gas_giant: 0.9, ice: 0.6, toxic: 0.7, tundra: 0.4, jungle: 0.3, rocky: 0.2 }, 'Stickstoffwasserstoff; Brennstoff und Kühlmittel.', 'energy'),
  nitrogen: res('nitrogen', 'Stickstoff', 'gas', 1, { rocky: 0.6, ocean: 0.6, jungle: 0.6, tundra: 0.6, ice: 0.5, desert: 0.4, gas_giant: 0.4 }, 'Inertgas für Tanks und Schutzatmosphären.'),
  helium3: res('helium3', 'Helium-3', 'gas', 3, { gas_giant: 1, barren: 0.3 }, 'Seltenes Isotop; Brennstoff für Fusionstriebwerke.'),
  fiber: res('fiber', 'Pflanzenfaser', 'organic', 1, { jungle: 1, rocky: 0.7, ocean: 0.5, tundra: 0.6, desert: 0.3, ice: 0.2, toxic: 0.2 }, 'Zähe Fasern für Dichtungen, Seile und Verbundstoffe.'),
  resin: res('resin', 'Harz', 'organic', 1, { jungle: 1, rocky: 0.5, tundra: 0.5, desert: 0.2, ocean: 0.2, toxic: 0.3 }, 'Klebriges Pflanzenharz; brennbar und bindend.', 'energy'),
  spores: res('spores', 'Sporenstaub', 'organic', 2, { jungle: 0.8, toxic: 0.6, ocean: 0.3, tundra: 0.4, rocky: 0.3 }, 'Biologischer Feinstaub; Katalysator in Laboren.', 'stabilizer'),
};

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/** Rohstoffe, die der Startplanet garantiert hat (Schiffsstart). */
export const LAUNCH_RESOURCES: ResourceId[] = ['ferrite', 'quartz', 'water', 'fiber'];

// ---------------------------------------------------------------------------
// Wetter und Gefahren
// ---------------------------------------------------------------------------

export interface WeatherDef {
  type: WeatherType;
  name: string;
  hazardous: boolean;
}

export const WEATHER: Record<WeatherType, WeatherDef> = {
  clear: { type: 'clear', name: 'Klar', hazardous: false },
  overcast: { type: 'overcast', name: 'Bewölkt', hazardous: false },
  fog: { type: 'fog', name: 'Nebel', hazardous: false },
  rain: { type: 'rain', name: 'Regen', hazardous: false },
  thunderstorm: { type: 'thunderstorm', name: 'Gewitter', hazardous: true },
  storm: { type: 'storm', name: 'Sturm', hazardous: true },
  snow: { type: 'snow', name: 'Schneefall', hazardous: false },
  blizzard: { type: 'blizzard', name: 'Blizzard', hazardous: true },
  sandstorm: { type: 'sandstorm', name: 'Sandsturm', hazardous: true },
  ashfall: { type: 'ashfall', name: 'Ascheregen', hazardous: true },
  acid_rain: { type: 'acid_rain', name: 'Säureregen', hazardous: true },
  methane_rain: { type: 'methane_rain', name: 'Methanregen', hazardous: true },
  heatwave: { type: 'heatwave', name: 'Hitzewelle', hazardous: true },
  radiation_storm: { type: 'radiation_storm', name: 'Strahlungssturm', hazardous: true },
  aurora: { type: 'aurora', name: 'Polarlicht', hazardous: false },
  crystal_hail: { type: 'crystal_hail', name: 'Kristallhagel', hazardous: true },
  cloud_bands: { type: 'cloud_bands', name: 'Wolkenbänder', hazardous: false },
  lightning_storm: { type: 'lightning_storm', name: 'Blitzsturm', hazardous: true },
};

export const HAZARD_LABELS: Record<Hazard, string> = {
  heat: 'Hitze',
  cold: 'Kälte',
  radiation: 'Strahlung',
  storms: 'Stürme',
  acid: 'Säure',
  toxic_atmosphere: 'Giftige Atmosphäre',
  low_oxygen: 'Sauerstoffmangel',
  high_gravity: 'Hohe Schwerkraft',
  lava: 'Lava',
  crushing_pressure: 'Extremer Druck',
};

export const GAS_LABELS: Record<Gas, string> = {
  N2: 'Stickstoff',
  O2: 'Sauerstoff',
  CO2: 'Kohlendioxid',
  CH4: 'Methan',
  NH3: 'Ammoniak',
  H2: 'Wasserstoff',
  He: 'Helium',
  SO2: 'Schwefeldioxid',
  Ar: 'Argon',
  H2O: 'Wasserdampf',
};

export const TOXIC_GASES: Gas[] = ['CO2', 'CH4', 'NH3', 'SO2', 'H2'];

// ---------------------------------------------------------------------------
// Planetentypen
// ---------------------------------------------------------------------------

export interface PlanetTypeDef {
  type: PlanetType;
  label: string;
  color: string;
  gasGiant: boolean;
  /** Ideale Gleichgewichtstemperatur und Toleranz (K) für die Typwahl. */
  idealTemp: number;
  tempSpread: number;
  /** Grundgewicht bei der Typwahl. */
  baseWeight: number;
  lifeFriendly: boolean;
  radiusKm: [number, number];
  /** Dichte relativ zur Erde (bestimmt Gravitation). */
  density: [number, number];
  pressure: [number, number];
  gases: Array<{ gas: Gas; weight: number }>;
  greenhouse: number;
  biomes: BiomeKind[];
  biomeCount: [number, number];
  weather: Array<{ type: WeatherType; weight: number }>;
  weatherCount: [number, number];
  hazards: Array<{ hazard: Hazard; chance: number }>;
  biodiversity: [number, number];
  /** Eignung je Archiv-Kategorie (Verteilungsgewicht). */
  categoryWeights: Record<Category, number>;
  /** Obergrenzen je Kategorie (fehlend = unbegrenzt). */
  categoryCaps: Partial<Record<Category, number>>;
  description: string;
}

const ptype = (def: PlanetTypeDef): PlanetTypeDef => def;

export const PLANET_TYPES: Record<PlanetType, PlanetTypeDef> = {
  rocky: ptype({
    type: 'rocky', label: 'Felsplanet', color: '#9a8f78', gasGiant: false,
    idealTemp: 285, tempSpread: 45, baseWeight: 1.2, lifeFriendly: true,
    radiusKm: [3000, 8000], density: [0.85, 1.15], pressure: [0.4, 1.8],
    gases: [{ gas: 'N2', weight: 70 }, { gas: 'O2', weight: 20 }, { gas: 'Ar', weight: 2 }, { gas: 'CO2', weight: 5 }, { gas: 'H2O', weight: 3 }],
    greenhouse: 14,
    biomes: ['highlands', 'steppe', 'scree', 'canyons', 'coastal_plain', 'mountains', 'crystal_caverns'], biomeCount: [4, 6],
    weather: [{ type: 'clear', weight: 5 }, { type: 'overcast', weight: 3 }, { type: 'rain', weight: 3 }, { type: 'fog', weight: 2 }, { type: 'thunderstorm', weight: 2 }, { type: 'storm', weight: 1 }, { type: 'aurora', weight: 1 }],
    weatherCount: [4, 6],
    hazards: [{ hazard: 'storms', chance: 0.3 }],
    biodiversity: [0.45, 0.8],
    categoryWeights: { fauna: 0.8, flora: 0.8, micro: 0.7, ore: 1, rock: 1, fossil: 0.9, weather: 0.8, variant: 0.8 },
    categoryCaps: {},
    description: 'Gemäßigte Felswelt mit Hochländern, Steppen und Küsten.',
  }),
  ocean: ptype({
    type: 'ocean', label: 'Ozeanwelt', color: '#3a7c9c', gasGiant: false,
    idealTemp: 290, tempSpread: 30, baseWeight: 1.0, lifeFriendly: true,
    radiusKm: [4000, 9000], density: [0.8, 1.05], pressure: [0.8, 2.5],
    gases: [{ gas: 'N2', weight: 68 }, { gas: 'O2', weight: 22 }, { gas: 'H2O', weight: 6 }, { gas: 'CO2', weight: 3 }, { gas: 'Ar', weight: 1 }],
    greenhouse: 18,
    biomes: ['shallow_sea', 'deep_sea', 'reef', 'island_coast', 'archipelago', 'kelp_forest'], biomeCount: [4, 6],
    weather: [{ type: 'clear', weight: 4 }, { type: 'overcast', weight: 4 }, { type: 'rain', weight: 5 }, { type: 'fog', weight: 3 }, { type: 'thunderstorm', weight: 3 }, { type: 'storm', weight: 2 }],
    weatherCount: [4, 6],
    hazards: [{ hazard: 'storms', chance: 0.5 }],
    biodiversity: [0.6, 0.95],
    categoryWeights: { fauna: 1, flora: 0.7, micro: 1.1, ore: 0.4, rock: 0.5, fossil: 0.7, weather: 1, variant: 0.9 },
    categoryCaps: {},
    description: 'Wasserwelt mit Riffen, Archipelen und dunkler Tiefsee.',
  }),
  desert: ptype({
    type: 'desert', label: 'Wüstenplanet', color: '#d9b56a', gasGiant: false,
    idealTemp: 330, tempSpread: 45, baseWeight: 1.0, lifeFriendly: true,
    radiusKm: [2800, 7500], density: [0.9, 1.15], pressure: [0.2, 1.2],
    gases: [{ gas: 'N2', weight: 60 }, { gas: 'O2', weight: 15 }, { gas: 'CO2', weight: 18 }, { gas: 'Ar', weight: 5 }, { gas: 'SO2', weight: 2 }],
    greenhouse: 10,
    biomes: ['dune_sea', 'salt_flat', 'rock_desert', 'oasis', 'mesas', 'canyons', 'crystal_caverns'], biomeCount: [3, 5],
    weather: [{ type: 'clear', weight: 6 }, { type: 'sandstorm', weight: 4 }, { type: 'heatwave', weight: 3 }, { type: 'overcast', weight: 1 }, { type: 'thunderstorm', weight: 1 }, { type: 'fog', weight: 1 }],
    weatherCount: [3, 5],
    hazards: [{ hazard: 'heat', chance: 0.7 }, { hazard: 'storms', chance: 0.4 }],
    biodiversity: [0.3, 0.6],
    categoryWeights: { fauna: 0.6, flora: 0.5, micro: 0.5, ore: 0.9, rock: 1, fossil: 1, weather: 0.8, variant: 0.6 },
    categoryCaps: {},
    description: 'Heiße Dünen, Salzpfannen und versteckte Oasen.',
  }),
  ice: ptype({
    type: 'ice', label: 'Eiswelt', color: '#cfe6f5', gasGiant: false,
    idealTemp: 150, tempSpread: 90, baseWeight: 1.2, lifeFriendly: false,
    radiusKm: [2500, 7000], density: [0.7, 1.0], pressure: [0.05, 0.9],
    gases: [{ gas: 'N2', weight: 70 }, { gas: 'CH4', weight: 10 }, { gas: 'Ar', weight: 8 }, { gas: 'O2', weight: 8 }, { gas: 'CO2', weight: 4 }],
    greenhouse: 4,
    biomes: ['glacier', 'ice_plain', 'frost_forest', 'ice_caves', 'snow_mountains'], biomeCount: [3, 5],
    weather: [{ type: 'clear', weight: 4 }, { type: 'snow', weight: 5 }, { type: 'blizzard', weight: 3 }, { type: 'fog', weight: 2 }, { type: 'aurora', weight: 3 }, { type: 'crystal_hail', weight: 1 }],
    weatherCount: [3, 5],
    hazards: [{ hazard: 'cold', chance: 0.95 }, { hazard: 'storms', chance: 0.3 }],
    biodiversity: [0.15, 0.45],
    categoryWeights: { fauna: 0.4, flora: 0.3, micro: 0.6, ore: 0.6, rock: 0.8, fossil: 0.5, weather: 0.9, variant: 0.4 },
    categoryCaps: {},
    description: 'Gletscher, Eisebenen und leuchtende Eishöhlen.',
  }),
  jungle: ptype({
    type: 'jungle', label: 'Dschungelwelt', color: '#2f8a3f', gasGiant: false,
    idealTemp: 300, tempSpread: 25, baseWeight: 0.9, lifeFriendly: true,
    radiusKm: [4000, 8500], density: [0.85, 1.1], pressure: [0.9, 2.2],
    gases: [{ gas: 'N2', weight: 64 }, { gas: 'O2', weight: 24 }, { gas: 'H2O', weight: 7 }, { gas: 'CO2', weight: 4 }, { gas: 'CH4', weight: 1 }],
    greenhouse: 20,
    biomes: ['cloud_forest', 'swamp', 'fern_forest', 'river_delta', 'fungal_grove', 'coastal_plain'], biomeCount: [4, 6],
    weather: [{ type: 'rain', weight: 6 }, { type: 'fog', weight: 4 }, { type: 'overcast', weight: 3 }, { type: 'thunderstorm', weight: 3 }, { type: 'clear', weight: 3 }, { type: 'storm', weight: 1 }],
    weatherCount: [4, 6],
    hazards: [{ hazard: 'storms', chance: 0.3 }],
    biodiversity: [0.8, 1],
    categoryWeights: { fauna: 1.2, flora: 1.3, micro: 1, ore: 0.5, rock: 0.5, fossil: 0.7, weather: 0.7, variant: 1.1 },
    categoryCaps: {},
    description: 'Dichte Nebelwälder, Sümpfe und Pilzhaine voller Leben.',
  }),
  volcanic: ptype({
    type: 'volcanic', label: 'Vulkanwelt', color: '#ff5a1a', gasGiant: false,
    idealTemp: 480, tempSpread: 120, baseWeight: 1.0, lifeFriendly: false,
    radiusKm: [2800, 7500], density: [1.0, 1.25], pressure: [0.3, 4],
    gases: [{ gas: 'CO2', weight: 50 }, { gas: 'SO2', weight: 20 }, { gas: 'N2', weight: 20 }, { gas: 'H2O', weight: 6 }, { gas: 'Ar', weight: 4 }],
    greenhouse: 40,
    biomes: ['lava_fields', 'ash_desert', 'sulfur_springs', 'obsidian_ridge', 'basalt_plateau', 'lava_tubes'], biomeCount: [3, 5],
    weather: [{ type: 'ashfall', weight: 5 }, { type: 'clear', weight: 3 }, { type: 'heatwave', weight: 3 }, { type: 'thunderstorm', weight: 2 }, { type: 'acid_rain', weight: 2 }, { type: 'storm', weight: 1 }],
    weatherCount: [3, 5],
    hazards: [{ hazard: 'heat', chance: 1 }, { hazard: 'lava', chance: 0.8 }, { hazard: 'toxic_atmosphere', chance: 0.6 }],
    biodiversity: [0.1, 0.4],
    categoryWeights: { fauna: 0.3, flora: 0.25, micro: 0.6, ore: 1.2, rock: 1.2, fossil: 0.4, weather: 1, variant: 0.3 },
    categoryCaps: {},
    description: 'Lavafelder, Aschewüsten und Schwefelquellen; reich an Erzen.',
  }),
  tundra: ptype({
    type: 'tundra', label: 'Tundrawelt', color: '#8a9a7a', gasGiant: false,
    idealTemp: 255, tempSpread: 30, baseWeight: 0.9, lifeFriendly: true,
    radiusKm: [3000, 7500], density: [0.85, 1.1], pressure: [0.5, 1.5],
    gases: [{ gas: 'N2', weight: 72 }, { gas: 'O2', weight: 19 }, { gas: 'Ar', weight: 4 }, { gas: 'CO2', weight: 3 }, { gas: 'CH4', weight: 2 }],
    greenhouse: 10,
    biomes: ['tundra', 'lichen_heath', 'permafrost_bog', 'krummholz', 'fjord_coast', 'frost_forest'], biomeCount: [3, 5],
    weather: [{ type: 'clear', weight: 4 }, { type: 'snow', weight: 4 }, { type: 'fog', weight: 3 }, { type: 'overcast', weight: 3 }, { type: 'blizzard', weight: 2 }, { type: 'aurora', weight: 3 }, { type: 'rain', weight: 1 }],
    weatherCount: [4, 6],
    hazards: [{ hazard: 'cold', chance: 0.7 }],
    biodiversity: [0.35, 0.65],
    categoryWeights: { fauna: 0.7, flora: 0.6, micro: 0.6, ore: 0.7, rock: 0.8, fossil: 0.8, weather: 0.9, variant: 0.6 },
    categoryCaps: {},
    description: 'Weite Tundren, Flechtenheiden und Fjorde unter Polarlichtern.',
  }),
  toxic: ptype({
    type: 'toxic', label: 'Giftwelt', color: '#b0e03a', gasGiant: false,
    idealTemp: 340, tempSpread: 80, baseWeight: 0.7, lifeFriendly: false,
    radiusKm: [3000, 8000], density: [0.9, 1.2], pressure: [1.5, 8],
    gases: [{ gas: 'CO2', weight: 35 }, { gas: 'CH4', weight: 25 }, { gas: 'NH3', weight: 15 }, { gas: 'SO2', weight: 10 }, { gas: 'N2', weight: 15 }],
    greenhouse: 45,
    biomes: ['acid_marsh', 'methane_lakes', 'crystal_fields', 'slag_plain', 'canyons'], biomeCount: [3, 5],
    weather: [{ type: 'acid_rain', weight: 5 }, { type: 'fog', weight: 4 }, { type: 'methane_rain', weight: 3 }, { type: 'overcast', weight: 3 }, { type: 'thunderstorm', weight: 2 }, { type: 'crystal_hail', weight: 1 }],
    weatherCount: [3, 5],
    hazards: [{ hazard: 'toxic_atmosphere', chance: 1 }, { hazard: 'acid', chance: 0.8 }, { hazard: 'crushing_pressure', chance: 0.3 }],
    biodiversity: [0.2, 0.55],
    categoryWeights: { fauna: 0.5, flora: 0.5, micro: 0.9, ore: 0.8, rock: 0.8, fossil: 0.4, weather: 0.9, variant: 0.5 },
    categoryCaps: {},
    description: 'Säuremoore, Methanseen und giftige, drückende Atmosphäre.',
  }),
  barren: ptype({
    type: 'barren', label: 'Ödwelt', color: '#8a8a8a', gasGiant: false,
    idealTemp: 260, tempSpread: 160, baseWeight: 0.45, lifeFriendly: false,
    radiusKm: [1800, 5500], density: [0.75, 1.1], pressure: [0, 0.02],
    gases: [{ gas: 'Ar', weight: 50 }, { gas: 'He', weight: 20 }, { gas: 'N2', weight: 20 }, { gas: 'CO2', weight: 10 }],
    greenhouse: 0,
    biomes: ['crater_plain', 'regolith_desert', 'rift_fields', 'basalt_desert'], biomeCount: [2, 4],
    weather: [{ type: 'clear', weight: 10 }],
    weatherCount: [1, 1],
    hazards: [{ hazard: 'low_oxygen', chance: 1 }, { hazard: 'radiation', chance: 0.6 }],
    biodiversity: [0, 0.12],
    categoryWeights: { fauna: 0.08, flora: 0.05, micro: 0.4, ore: 1.1, rock: 1.1, fossil: 0.5, weather: 0.4, variant: 0.1 },
    categoryCaps: { fauna: 4, flora: 2, micro: 8, variant: 2 },
    description: 'Luftlose Kraterlandschaft; Erze liegen offen zutage.',
  }),
  gas_giant: ptype({
    type: 'gas_giant', label: 'Gasriese', color: '#d8b070', gasGiant: true,
    idealTemp: 150, tempSpread: 250, baseWeight: 1, lifeFriendly: false,
    radiusKm: [22000, 70000], density: [0.2, 0.35], pressure: [50, 500],
    gases: [{ gas: 'H2', weight: 75 }, { gas: 'He', weight: 20 }, { gas: 'CH4', weight: 3 }, { gas: 'NH3', weight: 2 }],
    greenhouse: 0,
    biomes: ['upper_clouds', 'storm_band', 'ammonia_layer', 'cloud_crowns'], biomeCount: [2, 4],
    weather: [{ type: 'cloud_bands', weight: 6 }, { type: 'lightning_storm', weight: 4 }, { type: 'storm', weight: 4 }, { type: 'clear', weight: 2 }, { type: 'aurora', weight: 2 }],
    weatherCount: [3, 5],
    hazards: [{ hazard: 'crushing_pressure', chance: 1 }, { hazard: 'storms', chance: 1 }, { hazard: 'high_gravity', chance: 0.7 }],
    biodiversity: [0.05, 0.3],
    categoryWeights: { fauna: 0.15, flora: 0, micro: 0.5, ore: 0, rock: 0, fossil: 0, weather: 1.6, variant: 0.15 },
    categoryCaps: { fauna: 8, flora: 0, micro: 10, ore: 0, rock: 0, fossil: 0, variant: 3 },
    description: 'Wolkenbänder und ewige Stürme; nur mit Atmosphärensonde erforschbar.',
  }),
};

export const PLANET_TYPE_IDS = Object.keys(PLANET_TYPES) as PlanetType[];
export const LIFE_FRIENDLY_TYPES: PlanetType[] = PLANET_TYPE_IDS.filter((t) => PLANET_TYPES[t].lifeFriendly);
