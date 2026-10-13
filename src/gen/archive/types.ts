/**
 * Datenmodell des Archivs: Kategorien, Familien, Einträge, Spawn-Bedingungen, Genome.
 * Reine Daten, serialisierbar als JSON.
 */
import type { WeatherType } from '../universe/types';

export type Category = 'fauna' | 'flora' | 'micro' | 'ore' | 'rock' | 'fossil' | 'weather' | 'variant';

export const CATEGORIES: Category[] = ['fauna', 'flora', 'micro', 'ore', 'rock', 'fossil', 'weather', 'variant'];

export const CATEGORY_LABELS: Record<Category, string> = {
  fauna: 'Fauna',
  flora: 'Flora',
  micro: 'Mikroorganismen und Zellen',
  ore: 'Erze und Minerale',
  rock: 'Gesteine und Kristalle',
  fossil: 'Fossilien und Ruinen',
  weather: 'Wetter- und Himmelsphänomene',
  variant: 'Varianten und Mutationen',
};

export const CATEGORY_SHORT: Record<Category, string> = {
  fauna: 'Fauna',
  flora: 'Flora',
  micro: 'Mikro',
  ore: 'Erze',
  rock: 'Gesteine',
  fossil: 'Fossilien',
  weather: 'Wetter',
  variant: 'Varianten',
};

export const CATEGORY_CODES: Record<Category, string> = {
  fauna: 'FAU',
  flora: 'FLO',
  micro: 'MIC',
  ore: 'ORE',
  rock: 'ROC',
  fossil: 'FOS',
  weather: 'WET',
  variant: 'VAR',
};

/** Anteile am Gesamtbudget (Richtwerte bei 500: 130/90/70/60/50/40/30/30). */
export const CATEGORY_SHARE: Record<Category, number> = {
  fauna: 26,
  flora: 18,
  micro: 14,
  ore: 12,
  rock: 10,
  fossil: 8,
  weather: 6,
  variant: 6,
};

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];
export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Häufig',
  uncommon: 'Ungewöhnlich',
  rare: 'Selten',
  legendary: 'Legendär',
};

export type TimeOfDay = 'any' | 'day' | 'night' | 'dawn' | 'dusk';
export const TIME_LABELS: Record<TimeOfDay, string> = {
  any: 'jederzeit',
  day: 'tagsüber',
  night: 'nachts',
  dawn: 'in der Morgendämmerung',
  dusk: 'in der Abenddämmerung',
};

/** Spezielle Bedingungen, die über Tageszeit/Wetter hinausgehen. */
export type SpecialCondition =
  | 'cave'
  | 'solstice'
  | 'underwater'
  | 'deep_sea'
  | 'atmosphere_probe'
  | 'orbit'
  | 'after_storm'
  | 'eclipse';

export const SPECIAL_LABELS: Record<SpecialCondition, string> = {
  cave: 'nur in Höhlen',
  solstice: 'nur zur Sonnenwende',
  underwater: 'nur unter Wasser',
  deep_sea: 'nur in der Tiefsee (Tiefseesonde)',
  atmosphere_probe: 'nur per Atmosphärensonde',
  orbit: 'nur aus dem Orbit',
  after_storm: 'nur direkt nach einem Sturm',
  eclipse: 'nur während einer Finsternis',
};

export interface SpawnConditions {
  timeOfDay: TimeOfDay;
  /** 'any' oder Liste erlaubter Wetterlagen (Teilmenge des Planeten-Wetters). */
  weather: 'any' | WeatherType[];
  /** Höhenband, normiert 0..1. */
  altitude: [number, number];
  /** Temperaturfenster in Kelvin (liegt im Bereich des Planeten). */
  temperature: [number, number];
  special?: SpecialCondition;
}

export type CaptureMethod = 'photo' | 'microscope' | 'sample';

export type HintKind =
  | 'tracks'
  | 'sounds'
  | 'droppings'
  | 'nest'
  | 'scent'
  | 'seeds'
  | 'glint'
  | 'magnetic_anomaly'
  | 'scanner_ping'
  | 'terrain_anomaly'
  | 'logbook_rumor'
  | 'sample_trace'
  | 'sky_watch';

export const HINT_LABELS: Record<HintKind, string> = {
  tracks: 'Fußspuren',
  sounds: 'Geräusche',
  droppings: 'Kot',
  nest: 'Nester',
  scent: 'Geruch',
  seeds: 'Samen',
  glint: 'Glitzern am Boden',
  magnetic_anomaly: 'Magnetische Anomalie',
  scanner_ping: 'Scanner-Signal',
  terrain_anomaly: 'Auffällige Geländeform',
  logbook_rumor: 'Logbuch-Gerücht',
  sample_trace: 'Spuren in Proben',
  sky_watch: 'Himmelsbeobachtung',
};

// ---------------------------------------------------------------------------
// Genome: Parameter für prozedurales Aussehen (Phase 3 rendert daraus)
// ---------------------------------------------------------------------------

export type FaunaLocomotion = 'land' | 'water' | 'air';
export type BodyShape = 'slender' | 'bulky' | 'serpentine' | 'round' | 'flat';
export type HeadType = 'beak' | 'snout' | 'dome' | 'crest' | 'mandible' | 'none';
export type TailType = 'none' | 'short' | 'long' | 'fin' | 'fan' | 'club';
export type Covering = 'scales' | 'fur' | 'chitin' | 'skin' | 'feathers' | 'membrane' | 'crystal' | 'bioluminescent';
export type Pattern = 'none' | 'stripes' | 'spots' | 'bands' | 'mottled' | 'gradient' | 'rings';
export type Diet = 'herbivore' | 'carnivore' | 'omnivore' | 'filter' | 'photovore' | 'mineralivore';
export type Activity = 'diurnal' | 'nocturnal' | 'crepuscular' | 'cathemeral';
export type Temperament = 'shy' | 'neutral' | 'curious' | 'aggressive';
export type SizeClass = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

export interface FaunaGenome {
  kind: 'fauna';
  locomotion: FaunaLocomotion;
  legs: number;
  wings: number;
  fins: number;
  bodyShape: BodyShape;
  headType: HeadType;
  tailType: TailType;
  covering: Covering;
  /** Körperlänge in Metern. */
  lengthM: number;
  hue: number;
  hue2: number;
  saturation: number;
  lightness: number;
  pattern: Pattern;
  patternScale: number;
  eyeCount: number;
  extras: string[];
  /** Geschwindigkeit relativ (0..1) und Scheu (0..1). */
  speed: number;
  shyness: number;
}

export type FloraForm = 'tree' | 'shrub' | 'grass' | 'fungus' | 'aquatic' | 'succulent' | 'lichen' | 'vine' | 'crystal_plant';
export type LeafShape = 'broad' | 'needle' | 'frond' | 'blade' | 'lobed' | 'none' | 'cap' | 'pad';

export interface FloraGenome {
  kind: 'flora';
  form: FloraForm;
  heightM: number;
  trunkHue: number;
  leafHue: number;
  flowerHue: number;
  leafShape: LeafShape;
  /** Verzweigungsgrad 0..1 und Dichte 0..1. */
  branching: number;
  density: number;
  glow: number;
  bloomTime: TimeOfDay;
}

export type MicroShape = 'coccus' | 'bacillus' | 'spiral' | 'star' | 'amoeboid' | 'diatom' | 'ciliate' | 'colony';
export type SampleSource = 'water' | 'soil' | 'plant' | 'rock' | 'ice' | 'air' | 'vent';

export interface MicroGenome {
  kind: 'micro';
  shape: MicroShape;
  sizeUm: number;
  hue: number;
  motility: 'flagella' | 'cilia' | 'none' | 'gliding';
  nucleusCount: number;
  membranePattern: Pattern;
  sampleSource: SampleSource;
}

export type MineralForm = 'vein' | 'nodule' | 'geode' | 'placer' | 'outcrop' | 'crystal_cluster' | 'boulder' | 'layer';

export interface MineralGenome {
  kind: 'mineral';
  form: MineralForm;
  hue: number;
  saturation: number;
  luster: 'dull' | 'metallic' | 'glassy' | 'pearly' | 'adamantine';
  sizeM: number;
  glow: number;
  magnetic: boolean;
  /** Verknüpfter Rohstoff (bei Erzen). */
  resourceId?: string;
}

export type FossilKind = 'shell' | 'bone' | 'imprint' | 'amber' | 'petrified_wood' | 'trace' | 'egg';
export type RuinKind = 'monolith' | 'wall' | 'statue' | 'machine' | 'glyph_stone' | 'wreck' | 'beacon';

export interface FossilGenome {
  kind: 'fossil';
  fossilKind?: FossilKind;
  ruinKind?: RuinKind;
  sizeM: number;
  hue: number;
  erosion: number;
}

export interface WeatherGenome {
  kind: 'weather';
  phenomenon: string;
  intensity: number;
  hue: number;
}

export type Genome = FaunaGenome | FloraGenome | MicroGenome | MineralGenome | FossilGenome | WeatherGenome;

// ---------------------------------------------------------------------------
// Familien und Einträge
// ---------------------------------------------------------------------------

export interface FaunaFamilyTraits {
  kind: 'fauna';
  locomotion: FaunaLocomotion;
  legs: number;
  wings: number;
  fins: number;
  bodyShape: BodyShape;
  headType: HeadType;
  tailType: TailType;
  covering: Covering;
  diet: Diet;
  sizeClass: SizeClass;
  activity: Activity;
  temperament: Temperament;
  behaviorPool: string[];
  hintPool: HintKind[];
  nounPool: string[];
}

export interface FloraFamilyTraits {
  kind: 'flora';
  form: FloraForm;
  leafShape: LeafShape;
  heightRange: [number, number];
  nounPool: string[];
}

export interface MicroFamilyTraits {
  kind: 'micro';
  shape: MicroShape;
  motility: MicroGenome['motility'];
  sampleSource: SampleSource;
  nounPool: string[];
}

export interface MineralFamilyTraits {
  kind: 'mineral';
  group: string;
  forms: MineralForm[];
  nounPool: string[];
}

export interface FossilFamilyTraits {
  kind: 'fossil';
  group: 'fossil' | 'ruin';
  nounPool: string[];
}

export interface WeatherFamilyTraits {
  kind: 'weather';
  group: string;
}

export type FamilyTraits =
  | FaunaFamilyTraits
  | FloraFamilyTraits
  | MicroFamilyTraits
  | MineralFamilyTraits
  | FossilFamilyTraits
  | WeatherFamilyTraits;

export interface Family {
  id: string;
  category: Category;
  subcategory: string;
  planetId: string;
  /** Gattungsname (pseudo-lateinisch). */
  name: string;
  /** Kurzbeschreibung gemeinsamer Merkmale. */
  description: string;
  traits: FamilyTraits;
  memberIds: string[];
}

export interface ArchiveEntry {
  id: string;
  category: Category;
  subcategory: string;
  familyId: string;
  /** Deutscher Trivialname (vom Spieler umbenennbar). */
  name: string;
  /** Wissenschaftlicher Name (Gattung + Epitheton). */
  latinName: string;
  planetId: string;
  biomeIds: string[];
  rarity: Rarity;
  description: string;
  spawn: SpawnConditions;
  /** Verhaltensweisen mit Bonus-Foto-Slots (Fauna/Flora/Mikro). */
  behaviors: string[];
  hints: HintKind[];
  captureMethod: CaptureMethod;
  genome: Genome;
  /** Bei Varianten: Basis-Eintrag. */
  baseEntryId?: string;
  variantKind?: string;
}

/** Fortschritt pro Eintrag (Spielstand, Phase 4). */
export interface EntryProgress {
  entryId: string;
  stars: 0 | 1 | 2 | 3;
  bestPhotoId?: string;
  behaviorsPhotographed: string[];
  customName?: string;
  discoveredAt?: number;
}
