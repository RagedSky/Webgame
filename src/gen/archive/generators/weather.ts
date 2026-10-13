/** Wetter- und Himmelsphänomene: Pool aus Planetenwetter, Monden, Sterntyp und Nachbarplaneten. */
import type { Planet, StarSystem, WeatherType } from '../../universe/types';
import { describeWeather } from '../descriptions';
import type { ArchiveEntry, Family, Rarity, SpawnConditions, SpecialCondition, TimeOfDay, WeatherGenome } from '../types';
import { entryId, familyId, nonCaveBiomes, rollRarity, type GenContext } from './common';

export interface WeatherPhenomenon {
  key: string;
  name: string;
  group: 'storm' | 'precipitation' | 'optical' | 'sky';
  weather: 'any' | WeatherType[];
  timeOfDay: TimeOfDay;
  special?: SpecialCondition;
  rarity?: Rarity;
  description: string;
  hue: number;
}

const GROUP_LABELS: Record<WeatherPhenomenon['group'], string> = {
  storm: 'Stürme',
  precipitation: 'Niederschläge',
  optical: 'Optische Phänomene',
  sky: 'Himmelsereignisse',
};

const BY_WEATHER: Partial<Record<WeatherType, Array<Omit<WeatherPhenomenon, 'key' | 'weather'>>>> = {
  clear: [
    { name: 'Sternklare Nacht', group: 'sky', timeOfDay: 'night', description: 'Ein wolkenloser Nachthimmel voller fremder Sternbilder.', hue: 230 },
    { name: 'Sonnenhalo', group: 'optical', timeOfDay: 'day', description: 'Ein Lichtring um die Sonne, gebrochen in hohen Eiskristallen.', hue: 50, rarity: 'uncommon' },
    { name: 'Grüner Blitz', group: 'optical', timeOfDay: 'dusk', description: 'Ein sekundenkurzes grünes Aufleuchten beim Untergang der Sonne.', hue: 120, rarity: 'rare' },
    { name: 'Lichtsäulen', group: 'optical', timeOfDay: 'dawn', description: 'Senkrechte Lichtbänder über dem Horizont.', hue: 40, rarity: 'uncommon' },
  ],
  overcast: [
    { name: 'Mammatuswolken', group: 'optical', timeOfDay: 'any', description: 'Beutelförmige Wolkenunterseiten nach schwerem Wetter.', hue: 220 },
    { name: 'Wolkenwalze', group: 'storm', timeOfDay: 'any', description: 'Eine lange, rollende Wolkenröhre entlang einer Front.', hue: 210, rarity: 'uncommon' },
    { name: 'Wolkenloch', group: 'optical', timeOfDay: 'day', description: 'Ein kreisrundes Loch in geschlossener Wolkendecke.', hue: 200, rarity: 'rare' },
  ],
  fog: [
    { name: 'Bodennebel', group: 'precipitation', timeOfDay: 'dawn', description: 'Dünne Nebelschwaden, die über dem Boden kriechen.', hue: 200 },
    { name: 'Nebelbogen', group: 'optical', timeOfDay: 'day', description: 'Ein farbloser Regenbogen aus feinsten Tropfen.', hue: 190, rarity: 'uncommon' },
    { name: 'Leuchtnebel', group: 'optical', timeOfDay: 'night', description: 'Nebel, der von Mikroorganismen oder Mineralstaub schwach leuchtet.', hue: 160, rarity: 'rare' },
  ],
  rain: [
    { name: 'Regenbogen', group: 'optical', timeOfDay: 'day', description: 'Klassischer Bogen aus gebrochenem Sonnenlicht.', hue: 0 },
    { name: 'Doppelregenbogen', group: 'optical', timeOfDay: 'day', description: 'Zwei konzentrische Bögen mit umgekehrter Farbfolge.', hue: 280, rarity: 'uncommon' },
    { name: 'Platzregen', group: 'precipitation', timeOfDay: 'any', description: 'Kurzer, heftiger Schauer mit großen Tropfen.', hue: 210 },
    { name: 'Nieselschleier', group: 'precipitation', timeOfDay: 'any', description: 'Feiner Sprühregen, der Landschaften in Schleier hüllt.', hue: 200 },
  ],
  thunderstorm: [
    { name: 'Kugelblitz', group: 'storm', timeOfDay: 'night', description: 'Eine schwebende, leuchtende Plasmakugel.', hue: 50, rarity: 'legendary' },
    { name: 'Wetterleuchten', group: 'storm', timeOfDay: 'night', description: 'Fernes Blitzen ohne Donner am Horizont.', hue: 260 },
    { name: 'Superzelle', group: 'storm', timeOfDay: 'any', description: 'Ein rotierendes Gewitter von gewaltigem Ausmaß.', hue: 230, rarity: 'rare' },
    { name: 'Elmsfeuer', group: 'optical', timeOfDay: 'night', description: 'Bläuliches Glimmen an Spitzen und Kanten.', hue: 220, rarity: 'rare' },
  ],
  storm: [
    { name: 'Sturmfront', group: 'storm', timeOfDay: 'any', description: 'Eine Wand aus Wolken und Wind.', hue: 215 },
    { name: 'Orkanböe', group: 'storm', timeOfDay: 'any', description: 'Böen, die Vegetation flach drücken.', hue: 210, rarity: 'uncommon' },
    { name: 'Windhose', group: 'storm', timeOfDay: 'day', description: 'Ein tanzender Wirbel aus Staub und Trümmern.', hue: 40, rarity: 'rare' },
  ],
  snow: [
    { name: 'Diamantstaub', group: 'optical', timeOfDay: 'day', description: 'Glitzernde Eisnadeln in klarer, kalter Luft.', hue: 200, rarity: 'uncommon' },
    { name: 'Schneebogen', group: 'optical', timeOfDay: 'day', description: 'Ein blasser Bogen aus gebrochenem Licht in Schneekristallen.', hue: 190, rarity: 'rare' },
    { name: 'Eisnebel', group: 'precipitation', timeOfDay: 'any', description: 'Schwebende Eiskristalle statt Tropfen.', hue: 195 },
  ],
  blizzard: [
    { name: 'Whiteout', group: 'storm', timeOfDay: 'any', description: 'Sicht null – Himmel und Boden verschmelzen.', hue: 200, rarity: 'uncommon' },
    { name: 'Schneewalze', group: 'storm', timeOfDay: 'any', description: 'Eine heranrollende Wand aus Schnee.', hue: 205, rarity: 'rare' },
  ],
  sandstorm: [
    { name: 'Sandwand', group: 'storm', timeOfDay: 'any', description: 'Eine kilometerhohe Mauer aus Staub.', hue: 35 },
    { name: 'Staubteufel', group: 'storm', timeOfDay: 'day', description: 'Kleine, kurzlebige Wirbel über heißem Boden.', hue: 40 },
    { name: 'Haboob', group: 'storm', timeOfDay: 'dusk', description: 'Ein dichter Staubsturm vor einer Gewitterfront.', hue: 30, rarity: 'rare' },
  ],
  ashfall: [
    { name: 'Ascheschleier', group: 'precipitation', timeOfDay: 'any', description: 'Feine Asche sinkt wie grauer Schnee.', hue: 30 },
    { name: 'Glutregen', group: 'precipitation', timeOfDay: 'night', description: 'Glühende Partikel regnen aus der Eruptionswolke.', hue: 20, rarity: 'rare' },
    { name: 'Vulkanblitz', group: 'storm', timeOfDay: 'night', description: 'Blitze in der Aschewolke eines Ausbruchs.', hue: 270, rarity: 'rare' },
  ],
  acid_rain: [
    { name: 'Säureschleier', group: 'precipitation', timeOfDay: 'any', description: 'Beißender Regen, der Metall anläuft.', hue: 80 },
    { name: 'Ätznebel-Regen', group: 'precipitation', timeOfDay: 'dawn', description: 'Nebel und Säureregen zugleich.', hue: 90, rarity: 'uncommon' },
  ],
  methane_rain: [
    { name: 'Methantropfen', group: 'precipitation', timeOfDay: 'any', description: 'Träge fallende Tropfen flüssigen Methans.', hue: 220 },
    { name: 'Kohlenwasserstoff-Dunst', group: 'precipitation', timeOfDay: 'dusk', description: 'Öliger Dunst, der im Abendlicht schillert.', hue: 250, rarity: 'uncommon' },
  ],
  heatwave: [
    { name: 'Fata Morgana', group: 'optical', timeOfDay: 'day', description: 'Spiegelungen ferner Landschaften über heißem Boden.', hue: 45, rarity: 'uncommon' },
    { name: 'Hitzeflimmern', group: 'optical', timeOfDay: 'day', description: 'Die Luft tanzt über glühendem Gestein.', hue: 40 },
    { name: 'Glutwind', group: 'storm', timeOfDay: 'any', description: 'Ein trockener Wind wie aus einem Ofen.', hue: 25 },
  ],
  radiation_storm: [
    { name: 'Strahlungsglühen', group: 'optical', timeOfDay: 'night', description: 'Die obere Atmosphäre leuchtet unter Teilchenbeschuss.', hue: 300, rarity: 'rare' },
    { name: 'Ionenschleier', group: 'optical', timeOfDay: 'any', description: 'Flirrende Schleier geladener Partikel.', hue: 280, rarity: 'uncommon' },
  ],
  aurora: [
    { name: 'Polarlicht-Vorhang', group: 'optical', timeOfDay: 'night', description: 'Wogende Lichtvorhänge am Nachthimmel.', hue: 140 },
    { name: 'Polarlicht-Krone', group: 'optical', timeOfDay: 'night', description: 'Strahlen, die senkrecht über dem Beobachter zusammenlaufen.', hue: 160, rarity: 'rare' },
    { name: 'Roter Aurora-Bogen', group: 'optical', timeOfDay: 'night', description: 'Ein seltenes, tiefrotes Polarlicht.', hue: 350, rarity: 'legendary' },
  ],
  crystal_hail: [
    { name: 'Kristallhagel-Schauer', group: 'precipitation', timeOfDay: 'any', description: 'Scharfkantige Kristalle prasseln vom Himmel.', hue: 270 },
    { name: 'Splitterregen', group: 'precipitation', timeOfDay: 'day', description: 'Im Licht funkelnde Kristallsplitter.', hue: 280, rarity: 'uncommon' },
  ],
  cloud_bands: [
    { name: 'Wolkenband-Wirbel', group: 'storm', timeOfDay: 'any', description: 'Gegenläufige Bänder zerren Wirbel in die Länge.', hue: 35 },
    { name: 'Großer Fleck', group: 'storm', timeOfDay: 'any', description: 'Ein jahrhundertealter Antizyklon.', hue: 15, rarity: 'rare' },
    { name: 'Bänderkreuzung', group: 'optical', timeOfDay: 'any', description: 'Wo zwei Strömungen aufeinandertreffen, entstehen Wolkenwirbel.', hue: 40 },
  ],
  lightning_storm: [
    { name: 'Blitzkaskade', group: 'storm', timeOfDay: 'any', description: 'Blitze, die kilometerweit durch Wolkenschichten springen.', hue: 230, rarity: 'uncommon' },
    { name: 'Ringblitz', group: 'storm', timeOfDay: 'any', description: 'Ein kreisförmiger Blitz um ein Sturmauge.', hue: 250, rarity: 'legendary' },
  ],
};

/** Vollständiger Pool möglicher Phänomene eines Planeten (deterministisch, ohne rng). */
export function buildWeatherPool(planet: Planet, system: StarSystem): WeatherPhenomenon[] {
  const pool: WeatherPhenomenon[] = [];
  for (const w of planet.weather) {
    for (const ph of BY_WEATHER[w] ?? []) pool.push({ ...ph, key: `${w}:${ph.name}`, weather: [w] });
  }
  const hasAir = planet.atmosphere.pressure > 0.05;
  const skyWeather: 'any' | WeatherType[] = planet.weather.includes('clear') ? ['clear'] : 'any';
  if (planet.moons.length > 0) {
    pool.push({ key: 'sky:moonrise', name: `Aufgang von ${planet.moons[0]!.name}`, group: 'sky', weather: skyWeather, timeOfDay: 'night', description: 'Der größte Mond steigt über den Horizont.', hue: 50 });
    pool.push({ key: 'sky:eclipse', name: 'Finsternis', group: 'sky', weather: skyWeather, timeOfDay: 'day', special: 'eclipse', rarity: 'legendary', description: 'Ein Mond schiebt sich vor die Sonne.', hue: 30 });
  }
  if (planet.moons.length > 1) {
    pool.push({ key: 'sky:double_moon', name: 'Doppelmond', group: 'sky', weather: skyWeather, timeOfDay: 'night', rarity: 'uncommon', description: 'Zwei Monde stehen nebeneinander am Himmel.', hue: 60 });
  }
  if (hasAir) {
    pool.push({ key: 'sky:meteors', name: 'Meteorschauer', group: 'sky', weather: skyWeather, timeOfDay: 'night', rarity: 'uncommon', description: 'Dutzende Sternschnuppen pro Minute.', hue: 45 });
    pool.push({ key: 'sky:zodiacal', name: 'Zodiakallicht', group: 'sky', weather: skyWeather, timeOfDay: 'dawn', rarity: 'rare', description: 'Ein schwacher Lichtkegel entlang der Ekliptik.', hue: 55 });
  } else {
    pool.push({ key: 'sky:earthshine', name: 'Harter Sternenhimmel', group: 'sky', weather: 'any', timeOfDay: 'night', description: 'Ohne Atmosphäre funkeln die Sterne nicht – sie stechen.', hue: 230 });
  }
  if (system.star.type === 'blue_dwarf') {
    pool.push({ key: 'sky:flare', name: 'Flare-Ausbruch', group: 'sky', weather: skyWeather, timeOfDay: 'day', rarity: 'rare', description: 'Die Sonne schleudert eine Plasmazunge ins All.', hue: 210 });
  }
  if (system.star.type === 'red_giant') {
    pool.push({ key: 'sky:giant_sunset', name: 'Riesensonnenuntergang', group: 'sky', weather: skyWeather, timeOfDay: 'dusk', description: 'Die gewaltige rote Sonne füllt den halben Horizont.', hue: 10 });
  }
  if (system.planets.some((p) => p.type === 'gas_giant' && p.id !== planet.id)) {
    pool.push({ key: 'sky:giant_rise', name: 'Gasriesen-Aufgang', group: 'sky', weather: skyWeather, timeOfDay: 'night', rarity: 'uncommon', description: 'Ein gebänderter Riese steigt über den Horizont.', hue: 35 });
  }
  if (planet.axialTiltDeg > 3) {
    pool.push({ key: 'sky:solstice', name: 'Sonnenwend-Dämmerung', group: 'sky', weather: 'any', timeOfDay: 'dusk', special: 'solstice', rarity: 'rare', description: 'Das längste Zwielicht des Jahres.', hue: 25 });
  }
  return pool;
}

export function generateWeather(ctx: GenContext, count: number): { entries: ArchiveEntry[]; families: Family[] } {
  const { planet, system, names } = ctx;
  const entries: ArchiveEntry[] = [];
  const families: Family[] = [];
  if (count <= 0) return { entries, families };
  const pool = buildWeatherPool(planet, system);
  const chosen = ctx.rng.fork('pick').sample(pool, Math.min(count, pool.length));
  const byGroup = new Map<WeatherPhenomenon['group'], Family>();
  const biomes = nonCaveBiomes(planet).length ? nonCaveBiomes(planet) : planet.biomes;
  let entryNo = 1;
  let famNo = 1;

  for (const ph of chosen) {
    const rng = ctx.rng.fork(`ph:${ph.key}`);
    let fam = byGroup.get(ph.group);
    if (!fam) {
      fam = {
        id: familyId(planet, 'weather', famNo++),
        category: 'weather',
        subcategory: ph.group,
        planetId: planet.id,
        name: GROUP_LABELS[ph.group],
        description: `${GROUP_LABELS[ph.group]} auf ${planet.name}.`,
        traits: { kind: 'weather', group: ph.group },
        memberIds: [],
      };
      byGroup.set(ph.group, fam);
      families.push(fam);
    }
    const rarity = ph.rarity ?? rollRarity(rng, ctx.difficulty);
    const spawn: SpawnConditions = {
      timeOfDay: ph.timeOfDay,
      weather: ph.weather,
      altitude: [0, 1],
      temperature: [planet.temperature.min, planet.temperature.max],
      ...(ph.special ? { special: ph.special } : {}),
    };
    const genome: WeatherGenome = { kind: 'weather', phenomenon: ph.key, intensity: Math.round(rng.float(0.3, 1) * 100) / 100, hue: ph.hue };
    const id = entryId(planet, 'weather', entryNo++);
    entries.push({
      id,
      category: 'weather',
      subcategory: ph.group,
      familyId: fam.id,
      name: names.unique(() => ph.name),
      latinName: names.unique(() => `Phaenomenon ${ph.key.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 12)} ${planet.name.slice(0, 3)}`),
      planetId: planet.id,
      biomeIds: biomes.map((b) => b.id),
      rarity,
      description: describeWeather(planet, ph.description, rarity, spawn),
      spawn,
      behaviors: [],
      hints: ['sky_watch'],
      captureMethod: 'photo',
      genome,
    });
    fam.memberIds.push(id);
  }
  return { entries, families };
}
