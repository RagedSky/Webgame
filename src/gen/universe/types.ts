/**
 * Datenmodell des Sternsystems. Reine Daten, serialisierbar als JSON.
 * Physikalische Einheiten: Kelvin, AU, km, g (Erdbeschleunigung), bar, Stunden, Tage.
 */
import type { ArchiveEntry, Category, Family } from '../archive/types';

export type StarType = 'yellow' | 'red_giant' | 'blue_dwarf';

export type PlanetType =
  | 'rocky'
  | 'ocean'
  | 'desert'
  | 'ice'
  | 'jungle'
  | 'volcanic'
  | 'tundra'
  | 'toxic'
  | 'barren'
  | 'gas_giant';

export type Gas = 'N2' | 'O2' | 'CO2' | 'CH4' | 'NH3' | 'H2' | 'He' | 'SO2' | 'Ar' | 'H2O';

export type WeatherType =
  | 'clear'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'thunderstorm'
  | 'storm'
  | 'snow'
  | 'blizzard'
  | 'sandstorm'
  | 'ashfall'
  | 'acid_rain'
  | 'methane_rain'
  | 'heatwave'
  | 'radiation_storm'
  | 'aurora'
  | 'crystal_hail'
  | 'cloud_bands'
  | 'lightning_storm';

export type Hazard =
  | 'heat'
  | 'cold'
  | 'radiation'
  | 'storms'
  | 'acid'
  | 'toxic_atmosphere'
  | 'low_oxygen'
  | 'high_gravity'
  | 'lava'
  | 'crushing_pressure';

export type BiomeKind =
  // Fels
  | 'highlands' | 'steppe' | 'scree' | 'canyons' | 'coastal_plain' | 'mountains' | 'crystal_caverns'
  // Ozean
  | 'shallow_sea' | 'deep_sea' | 'reef' | 'island_coast' | 'archipelago' | 'kelp_forest'
  // Wüste
  | 'dune_sea' | 'salt_flat' | 'rock_desert' | 'oasis' | 'mesas'
  // Eis
  | 'glacier' | 'ice_plain' | 'frost_forest' | 'ice_caves' | 'snow_mountains'
  // Dschungel
  | 'cloud_forest' | 'swamp' | 'fern_forest' | 'river_delta' | 'fungal_grove'
  // Vulkan
  | 'lava_fields' | 'ash_desert' | 'sulfur_springs' | 'obsidian_ridge' | 'basalt_plateau' | 'lava_tubes'
  // Tundra
  | 'tundra' | 'lichen_heath' | 'permafrost_bog' | 'krummholz' | 'fjord_coast'
  // Toxisch
  | 'acid_marsh' | 'methane_lakes' | 'crystal_fields' | 'slag_plain'
  // Öde
  | 'crater_plain' | 'regolith_desert' | 'rift_fields' | 'basalt_desert'
  // Gasriese (Atmosphärenschichten)
  | 'upper_clouds' | 'storm_band' | 'ammonia_layer' | 'cloud_crowns';

export interface BiomePalette {
  ground: string;
  accent: string;
  vegetation: string;
}

export interface Biome {
  id: string;
  kind: BiomeKind;
  name: string;
  /** Anteil an der Oberfläche (summiert pro Planet auf 1). */
  coverage: number;
  /** Luftfeuchte 0..1. */
  humidity: number;
  /** Höhenband, normiert auf das Terrain des Planeten (0 = Meeresniveau/Tiefpunkt, 1 = höchster Punkt). */
  altitude: [number, number];
  /** Temperaturabweichung vom Planetenmittel in K. */
  temperatureOffset: number;
  hasWater: boolean;
  isCave: boolean;
  palette: BiomePalette;
}

export type ResourceKind = 'metal' | 'crystal' | 'mineral' | 'gas' | 'liquid' | 'organic';
export type FuelRole = 'energy' | 'oxidizer' | 'stabilizer';

export type ResourceId =
  | 'ferrite'
  | 'cuprite'
  | 'titanite'
  | 'cobaltite'
  | 'aurum'
  | 'quartz'
  | 'lumite'
  | 'obsidian'
  | 'silica'
  | 'sulfur'
  | 'carbon'
  | 'phosphor'
  | 'uranite'
  | 'saltpeter'
  | 'perchlorate'
  | 'peroxide_ice'
  | 'water'
  | 'ice'
  | 'brine'
  | 'hydrogen'
  | 'methane'
  | 'ammonia'
  | 'nitrogen'
  | 'helium3'
  | 'fiber'
  | 'resin'
  | 'spores';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  kind: ResourceKind;
  tier: 1 | 2 | 3;
  fuelRole?: FuelRole;
  /** Eignung pro Planetentyp (0 = kommt nicht vor). */
  planetWeights: Partial<Record<PlanetType, number>>;
  /** Kurzbeschreibung für UI/Scanner. */
  description: string;
}

export interface ResourceDeposit {
  resourceId: ResourceId;
  /** Häufigkeit 0..1. */
  abundance: number;
  /** Biome, in denen das Vorkommen auftritt. */
  biomeIds: string[];
}

export interface Moon {
  id: string;
  name: string;
  radiusKm: number;
  orbitRadiusKm: number;
  orbitPeriodDays: number;
  color: string;
}

export interface Atmosphere {
  /** Anteile 0..1, summieren auf 1 (bei pressure 0 leer). */
  composition: Partial<Record<Gas, number>>;
  /** Druck in bar (0 = keine Atmosphäre). */
  pressure: number;
  /** Relative Dichte für Himmel/Streuung (0..2). */
  density: number;
  breathable: boolean;
  toxic: boolean;
}

export interface PlanetRequirements {
  engineTier: 1 | 2 | 3;
  shieldTier: 0 | 1 | 2;
}

export interface Planet {
  id: string;
  name: string;
  index: number;
  type: PlanetType;
  typeLabel: string;
  orbitRadiusAu: number;
  orbitPeriodDays: number;
  radiusKm: number;
  gravity: number;
  atmosphere: Atmosphere;
  temperature: { mean: number; min: number; max: number };
  dayLengthHours: number;
  axialTiltDeg: number;
  moons: Moon[];
  biomes: Biome[];
  resources: ResourceDeposit[];
  weather: WeatherType[];
  hazards: Hazard[];
  /** 0..1, steuert Dichte und Vielfalt des Lebens. */
  biodiversity: number;
  /** Seed für Terrain/Noise auf der Oberfläche. */
  terrainSeed: string;
  /** Vorschlag für Darstellung (Debug-Ansicht, Karte). */
  color: string;
  isStart: boolean;
  requirements: PlanetRequirements;
  /** Wie viele Archiv-Einträge pro Kategorie auf diesem Planeten liegen (wird vom Archiv-Generator gesetzt). */
  entryBudget: Record<Category, number>;
}

export interface Star {
  type: StarType;
  label: string;
  name: string;
  /** Farbe des Sterns (hex) und des Lichts auf Planeten. */
  color: string;
  lightColor: string;
  temperatureK: number;
  /** Leuchtkraft relativ zur Sonne. */
  luminosity: number;
  /** Masse relativ zur Sonne (für Umlaufzeiten). */
  mass: number;
  /** Radius relativ zur Sonne. */
  radius: number;
  habitableZoneAu: [number, number];
  /** Strahlungsniveau 0..1. */
  radiation: number;
}

export interface FuelComponent {
  resourceId: ResourceId;
  role: FuelRole;
  /** Anteil in Zehnteln; alle Komponenten summieren auf 10. */
  parts: number;
}

export interface FuelFormula {
  name: string;
  components: FuelComponent[];
  totalParts: 10;
  /** Energie pro Einheit (für Reichweitenberechnung, Phase 6). */
  energyPerUnit: number;
}

export interface StarSystem {
  seed: string;
  name: string;
  difficulty: number;
  star: Star;
  planets: Planet[];
  startPlanetId: string;
  fuelFormula: FuelFormula;
  /** Gesamtbudget an Archiv-Einträgen (400–600). */
  entryBudget: number;
  entries: ArchiveEntry[];
  families: Family[];
  /** Zufallsseed-Version des Generators (für Migrationen). */
  generatorVersion: number;
}
