/** Deutsche Beschreibungstexte aus Merkmalen (Template-basiert, deterministisch über rng). */
import type { Random } from '@/math/Random';
import { WEATHER } from '../universe/catalog';
import type { Biome, Planet } from '../universe/types';
import { biomeNames } from './generators/common';
import type {
  BodyShape,
  Covering,
  Diet,
  FaunaFamilyTraits,
  FaunaGenome,
  FloraForm,
  FloraGenome,
  MicroGenome,
  MineralGenome,
  Rarity,
  SpawnConditions,
  Temperament,
} from './types';
import { RARITY_LABELS, SPECIAL_LABELS, TIME_LABELS } from './types';

export const DIET_LABELS: Record<Diet, string> = {
  herbivore: 'Pflanzenfresser',
  carnivore: 'Jäger',
  omnivore: 'Allesfresser',
  filter: 'Filtrierer',
  photovore: 'Lichtzehrer',
  mineralivore: 'Mineralfresser',
};

export const COVERING_LABELS: Record<Covering, string> = {
  scales: 'Schuppen',
  fur: 'dichtem Fell',
  chitin: 'Chitinpanzer',
  skin: 'glatter Haut',
  feathers: 'Federn',
  membrane: 'dünnen Membranen',
  crystal: 'kristallinen Platten',
  bioluminescent: 'leuchtender Haut',
};

export const BODY_LABELS: Record<BodyShape, string> = {
  slender: 'schlanker',
  bulky: 'massiger',
  serpentine: 'schlangenartiger',
  round: 'rundlicher',
  flat: 'flacher',
};

export const TEMPERAMENT_LABELS: Record<Temperament, string> = {
  shy: 'Scheu – flüchtet bei Lärm und schnellen Bewegungen.',
  neutral: 'Gleichgültig gegenüber Beobachtern, solange Abstand bleibt.',
  curious: 'Neugierig – nähert sich ruhigen Beobachtern von selbst.',
  aggressive: 'Reizbar – verteidigt sein Revier, Abstand halten.',
};

export const BEHAVIOR_LABELS: Record<string, string> = {
  grazing: 'Fressen',
  drinking: 'Trinken',
  sleeping: 'Schlafen',
  courting: 'Balzen',
  migrating: 'Wandern',
  playing: 'Spielen',
  dust_bathing: 'Staubbaden',
  hunting: 'Jagen',
  stalking: 'Anschleichen',
  feeding: 'Fressen',
  patrolling: 'Patrouillieren',
  schooling: 'Schwarmbildung',
  surfacing: 'Auftauchen',
  spawning: 'Laichen',
  soaring: 'Segelflug',
  diving: 'Sturzflug',
  nesting: 'Nestbau',
  roosting: 'Rasten',
  burrowing: 'Graben',
  basking: 'Sonnen',
  blooming: 'Blühen',
  fruiting: 'Fruchten',
  seeding: 'Aussamen',
  sporing: 'Sporenausstoß',
  glowing: 'Leuchten',
  closing_at_night: 'Nachtschluss',
  swaying: 'Wiegen im Wind',
  pollinating: 'Bestäubung',
  dividing: 'Zellteilung',
  swarming: 'Schwärmen',
  colonizing: 'Koloniebildung',
  pulsing: 'Pulsieren',
  molting: 'Häutung',
  singing: 'Gesang',
  display: 'Imponiergehabe',
};

export const FORM_LABELS: Record<FloraForm, string> = {
  tree: 'Baum',
  shrub: 'Strauch',
  grass: 'Gras',
  fungus: 'Pilz',
  aquatic: 'Wasserpflanze',
  succulent: 'Sukkulente',
  lichen: 'Flechte',
  vine: 'Ranke',
  crystal_plant: 'Kristallpflanze',
};

function weatherNames(spawn: SpawnConditions): string {
  if (spawn.weather === 'any') return '';
  return spawn.weather.map((w) => WEATHER[w].name).join(' oder ');
}

/** Satz zu den Fundbedingungen; leer bei „jederzeit, jedes Wetter“. */
export function spawnSentence(spawn: SpawnConditions, rarity: Rarity): string {
  const parts: string[] = [];
  if (spawn.timeOfDay !== 'any') parts.push(TIME_LABELS[spawn.timeOfDay]);
  const w = weatherNames(spawn);
  if (w) parts.push(`bei ${w}`);
  if (spawn.special) parts.push(SPECIAL_LABELS[spawn.special]);
  if (parts.length === 0) {
    return rarity === 'common' ? '' : 'Keine besonderen Bedingungen bekannt.';
  }
  const joined = parts.join(', ');
  if (rarity === 'legendary') return `Wird nur ${joined} gesichtet.`;
  if (rarity === 'rare') return `Zeigt sich nur ${joined}.`;
  return `Am ehesten ${joined} anzutreffen.`;
}

export function altitudeHint(spawn: SpawnConditions): string {
  const [a, b] = spawn.altitude;
  if (a <= 0.05 && b >= 0.95) return '';
  if (b <= 0.35) return 'Bevorzugt tiefe Lagen.';
  if (a >= 0.6) return 'Bevorzugt hohe Lagen.';
  return 'Bevorzugt mittlere Höhenlagen.';
}

export function legsPhrase(genome: FaunaGenome): string {
  if (genome.locomotion === 'water') return genome.fins > 0 ? `${genome.fins} Flossen` : 'wellenförmiger Fortbewegung';
  if (genome.locomotion === 'air') return `${genome.wings} Flügeln`;
  if (genome.legs === 0) return 'beinlosem Körper';
  return `${genome.legs} Beinen`;
}

export function describeFauna(
  rng: Random,
  planet: Planet,
  biomes: Biome[],
  traits: FaunaFamilyTraits,
  genome: FaunaGenome,
  rarity: Rarity,
  spawn: SpawnConditions,
  behaviors: string[],
): string {
  const sizeWord = genome.lengthM < 0.3 ? 'Winziger' : genome.lengthM < 1 ? 'Kleiner' : genome.lengthM < 3 ? 'Mittelgroßer' : genome.lengthM < 7 ? 'Großer' : 'Gewaltiger';
  const habitat = genome.locomotion === 'water' ? 'Gewässer von ' : genome.locomotion === 'air' ? 'Luftraum über ' : '';
  const s1 = `${sizeWord}, ${BODY_LABELS[genome.bodyShape]} ${DIET_LABELS[traits.diet]} mit ${legsPhrase(genome)} und ${COVERING_LABELS[genome.covering]}. Lebensraum: ${habitat}${biomeNames(biomes)} auf ${planet.name}.`;
  const activity = {
    diurnal: 'Tagaktiv.',
    nocturnal: 'Nachtaktiv.',
    crepuscular: 'In der Dämmerung aktiv.',
    cathemeral: 'Ohne festen Rhythmus aktiv.',
  }[traits.activity];
  const s2 = `${activity} ${TEMPERAMENT_LABELS[traits.temperament]}`;
  const beh = behaviors.map((b) => BEHAVIOR_LABELS[b] ?? b);
  const s3 = beh.length ? `Beobachtbar beim ${beh.join(', ')}.` : '';
  const extras = genome.extras.length ? `Auffällig: ${genome.extras.join(', ')}.` : '';
  const s4 = spawnSentence(spawn, rarity);
  const s5 = rarity === 'legendary' ? rng.pick(['Nur wenige Sichtungen im Logbuch.', 'Gilt unter Archivaren als Trophäe.', 'Spuren deuten auf ein verborgenes Revier hin.']) : '';
  return [s1, s2, s3, extras, altitudeHint(spawn), s4, s5].filter(Boolean).join(' ');
}

export function describeFlora(
  rng: Random,
  planet: Planet,
  biomes: Biome[],
  genome: FloraGenome,
  rarity: Rarity,
  spawn: SpawnConditions,
  behaviors: string[],
): string {
  const h = genome.heightM;
  const sizeWord = h < 0.3 ? 'Bodennahe' : h < 2 ? 'Niedrige' : h < 10 ? 'Hohe' : 'Gewaltige';
  const s1 = `${sizeWord} ${FORM_LABELS[genome.form]}, verbreitet in ${biomeNames(biomes)} auf ${planet.name}.`;
  const bloom = genome.bloomTime === 'any' ? '' : `Blüht ${TIME_LABELS[genome.bloomTime]}.`;
  const glow = genome.glow > 0.4 ? 'Leuchtet im Dunkeln schwach.' : '';
  const beh = behaviors.map((b) => BEHAVIOR_LABELS[b] ?? b);
  const s3 = beh.length ? `Bonus-Fotos: ${beh.join(', ')}.` : '';
  const s4 = spawnSentence(spawn, rarity);
  const s5 = rarity === 'legendary' ? rng.pick(['Ein einzelnes Exemplar soll genügen, um das Archiv zu verzaubern.', 'Gärtner-Gerüchte sprechen von einer verborgenen Lichtung.']) : '';
  return [s1, bloom, glow, s3, altitudeHint(spawn), s4, s5].filter(Boolean).join(' ');
}

export function describeMicro(planet: Planet, biomes: Biome[], genome: MicroGenome, rarity: Rarity, spawn: SpawnConditions): string {
  const source = {
    water: 'Wasserproben',
    soil: 'Bodenproben',
    plant: 'Pflanzenproben',
    rock: 'Gesteinsproben',
    ice: 'Eisproben',
    air: 'Luftfiltern',
    vent: 'Proben aus heißen Quellen',
  }[genome.sampleSource];
  const shape = {
    coccus: 'kugelförmig',
    bacillus: 'stäbchenförmig',
    spiral: 'spiralig',
    star: 'sternförmig',
    amoeboid: 'formwandelnd',
    diatom: 'mit kieseliger Schale',
    ciliate: 'bewimpert',
    colony: 'koloniebildend',
  }[genome.shape];
  const motility = { flagella: 'mit Geißeln', cilia: 'mit Wimpern', none: 'unbeweglich', gliding: 'gleitend' }[genome.motility];
  const s1 = `Mikroorganismus, ${shape}, ${motility}, etwa ${genome.sizeUm.toFixed(genome.sizeUm < 10 ? 1 : 0)} µm. Nachweisbar in ${source} aus ${biomeNames(biomes)} auf ${planet.name}.`;
  const s2 = spawnSentence(spawn, rarity);
  return [s1, s2].filter(Boolean).join(' ');
}

export function describeMineral(
  planet: Planet,
  biomes: Biome[],
  genome: MineralGenome,
  rarity: Rarity,
  spawn: SpawnConditions,
  kindLabel: string,
): string {
  const form = {
    vein: 'in Adern',
    nodule: 'als Knollen',
    geode: 'in Geoden',
    placer: 'als Seifenablagerung',
    outcrop: 'als offener Aufschluss',
    crystal_cluster: 'in Kristallbüscheln',
    boulder: 'als Findling',
    layer: 'in Schichten',
  }[genome.form];
  const luster = { dull: 'matt', metallic: 'metallisch glänzend', glassy: 'glasig', pearly: 'perlmuttartig', adamantine: 'diamantartig funkelnd' }[genome.luster];
  const s1 = `${kindLabel}, ${luster}, tritt ${form} in ${biomeNames(biomes)} auf ${planet.name} auf.`;
  const extra = [genome.magnetic ? 'Leicht magnetisch.' : '', genome.glow > 0.4 ? 'Fluoresziert unter UV-Licht.' : ''].filter(Boolean).join(' ');
  const s2 = 'Probe entnehmen und im Labor analysieren.';
  return [s1, extra, altitudeHint(spawn), s2, spawnSentence(spawn, rarity)].filter(Boolean).join(' ');
}

export function describeFossil(planet: Planet, biomes: Biome[], isRuin: boolean, sizeM: number, rarity: Rarity, spawn: SpawnConditions): string {
  const s1 = isRuin
    ? `Überrest einer unbekannten Zivilisation, etwa ${sizeM.toFixed(1)} m, gefunden in ${biomeNames(biomes)} auf ${planet.name}.`
    : `Versteinerte Spur vergangenen Lebens, etwa ${sizeM.toFixed(sizeM < 1 ? 2 : 1)} m, eingebettet in ${biomeNames(biomes)} auf ${planet.name}.`;
  const s2 = isRuin ? 'Fotografieren und mit dem Scanner dokumentieren.' : 'Freilegen, fotografieren und datieren.';
  return [s1, s2, altitudeHint(spawn), spawnSentence(spawn, rarity)].filter(Boolean).join(' ');
}

export function describeWeather(planet: Planet, phenomenonDescription: string, rarity: Rarity, spawn: SpawnConditions): string {
  return [`${phenomenonDescription} Beobachtet auf ${planet.name}.`, spawnSentence(spawn, rarity), `Seltenheit: ${RARITY_LABELS[rarity]}.`]
    .filter(Boolean)
    .join(' ');
}

export function describeVariant(baseName: string, variantLabel: string, rarity: Rarity, spawn: SpawnConditions): string {
  return [`${variantLabel} von ${baseName}.`, spawnSentence(spawn, rarity)].filter(Boolean).join(' ');
}
