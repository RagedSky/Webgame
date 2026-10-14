# Stellar Archive – Architektur

> Stand: Phase 0/1. Dieses Dokument ist die verbindliche Referenz für Ordnerstruktur, Modulgrenzen,
> Datenmodelle und Roadmap. Änderungen an Modulgrenzen werden hier **und** in `docs/DECISIONS.md` festgehalten.

## 1. Spiel in einem Satz

Stellar Archive ist ein 3D-Entdecker-Spiel im Browser: Du strandest auf einem Planeten in einem seed-basierten
Sternsystem, baust ein Raumschiff, synthetisierst Treibstoff und füllst ein Archiv mit 400–600 Einträgen
(Fauna, Flora, Zellen, Erze, Gesteine, Fossilien, Wetter, Varianten) durch **Fotografieren und Katalogisieren**.

## 2. Tech-Stack

| Bereich         | Wahl                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Build           | Vite 8, TypeScript 5.9 (strict), ESM, `npm run build` → statisches `dist/` |
| 3D              | Three.js 0.186 (WebGL2), `three/addons` für OrbitControls/CSS2D       |
| Postprocessing  | `postprocessing` (pmndrs): Bloom, SSAO, DoF, Tonemapping             |
| UI              | DOM/CSS-Overlay ohne Framework (HUD, Menüs, Katalog, Editor)          |
| Zufall          | Eigener PRNG (sfc32 + cyrb128-Hash), **kein `Math.random()`** (ESLint-Regel + Test) |
| Persistenz      | IndexedDB (Fotos als Blobs, Spielstand als JSON), Export/Import als Datei |
| Audio           | Web Audio API, prozedural, gekapselt in `src/audio`                   |
| Tests           | Vitest (Node-Umgebung) für Generatoren: Determinismus, Wertebereiche, Eintragsanzahl |

## 3. Ordnerstruktur

```
/
├── index.html                 Vite-Einstieg (Canvas + UI-Root + Debug-Root)
├── package.json, vite.config.ts, tsconfig.json, eslint.config.js
├── CLAUDE.md                  Befehle, Konventionen, Phasen-Checkliste (Kontext für Sessions)
├── docs/
│   ├── ARCHITECTURE.md        dieses Dokument
│   └── DECISIONS.md           Entscheidungs-Log (ADR-Stil, kurz)
├── legacy/aetherfall/         altes Einzeldatei-Spiel (unverändert, nicht Teil des Builds)
├── public/                    statische Assets (aktuell leer – alles prozedural)
└── src/
    ├── main.ts                Bootstrap: Renderer, Loop, Input, SceneManager, erste Szene
    ├── config/                Konstanten, Balancing-Tabellen, Key-Bindings
    ├── core/                  Engine-Infrastruktur (ohne Spiellogik)
    │   ├── GameLoop.ts        rAF-Loop, Fixed-Step-Update (60 Hz) + Render, Zeitmessung
    │   ├── Input.ts           Tastatur/Maus/Gamepad → Aktionen, Pointer-Lock
    │   ├── Scene.ts           Interface GameScene (enter/exit/update/render/resize/dispose)
    │   ├── SceneManager.ts    Szenenwechsel, sauberes dispose() der alten Szene
    │   ├── EventBus.ts        typisierte Events
    │   └── Disposer.ts        sammelt Three.js-Ressourcen zum gebündelten dispose()
    ├── math/                  reine Mathematik, keine Three.js-Abhängigkeit
    │   ├── Random.ts          seedbarer PRNG (sfc32), fork(label) für Teilgeneratoren
    │   ├── Noise.ts           Simplex 2D/3D, fBm (seedbar)
    │   └── utils.ts           clamp, lerp, remap, smoothstep, largestRemainder …
    ├── gen/                   **reine, deterministische Generatoren** (kein DOM, kein Three.js)
    │   ├── universe/          Stern, Planeten, Biome, Rohstoffe, Treibstoff-Formel, System
    │   ├── archive/           Familien, Arten, Einträge, Namen, Beschreibungen, Budget
    │   └── index.ts           generateUniverse(seed) → StarSystem inkl. Archiv
    ├── game/                  GameState (Seed, System, Oberflächenzustand), progress/ArchiveProgress (Sterne, Fotos, Hinweise,
    │                          Proben, Logbuch, Abschluss), photo/PhotoScoring (Bewertung, rein), samples (Proben, Mikro-Zellen),
    │                          Inventory (Rohstoffe/Gegenstände), PlayerState (Inventar, Überleben, Module, Labor-Stufe, Respawn,
    │                          Schiff, Baupläne, Landeplätze), survival/Survival (Sauerstoff/Energie, rein), crafting/recipes +
    │                          crafting/fuel (Rezepte, Synthese), ship/parts + ship/ShipDesign + ship/travel + ship/blueprints
    │                          (Schiffsteile, Entwurf/Werte, Reisekosten, Baupläne – alles rein), playerStore (Laden/Speichern),
    │                          map/MapGrid (Fog of War je Planet, Base64) + map/hotspots (Katalog-Lücken, Sondenziele, Hinweistexte),
    │                          progressStore (gemeinsamer Archiv-Fortschritt für Planet und Orbit),
    │                          character/Character (Konfiguration, Begrenzung, Zufall, Share-Code, Presets), character/backgrounds
    │                          (Hintergründe mit Boni), character/presetStore (eigene Presets in IndexedDB)
    ├── save/                  Db.ts: IndexedDB (Fotos als JPEG+Thumb-Blob, Fortschritt je Seed, Schlüssel/Wert)
    ├── audio/                 AudioManager: prozedurale UI-Klänge (Auslöser, Erfolg, Hinweis)
    ├── render/                Renderer-Wrapper (DPR, Render-Skalierung), Composer-Fabrik, Starfield, PlanetTexture (prozedural)
    ├── scenes/                MainMenuScene, SystemViewScene (Debug), PlanetScene, ShipEditorScene (Werft), SpaceScene (Orbit/Flug),
    │                          CharacterScene (Charaktererstellung mit Studio-Bühne)
    ├── ui/                    DOM-Overlays: DebugOverlay, Toast, SystemPanel, Hud, PauseMenu, PhotoUi (Sucher + Ergebnis),
    │                          ArchiveUi (Enzyklopädie, Logbuch, Proben), MicroscopeView (2D-Zellen mit Fokus-Minispiel),
    │                          InventoryUi, LabUi, ShipUi, ShipEditorUi, MapUi (Canvas-Karte mit Layern, Fog of War, Markern)
    ├── world/                 Laufzeit-Welt (Three.js)
    │   ├── terrain/           TerrainChunk (Skirts, Vertexfarben, Geometrie-Pool), TerrainManager (Quadtree-LOD, Zeitbudget)
    │   ├── Sky.ts             Kuppel-Shader (Rayleigh/Mie vereinfacht, Wolken, Dämmerung), Sterne, Monde, Gasriese, Sonnen-/Hemisphärenlicht
    │   ├── DayCycle.ts        Tageszeit, Sonnenrichtung, Tageslicht-Faktor, Uhr
    │   ├── Atmosphere.ts      Himmelsfarben aus Atmosphärenzusammensetzung und Sternfarbe
    │   ├── Weather.ts         Wetter-Zustandsmaschine (seed-basiert), Parameter (Nebel, Wolken, Niederschlag, Wind, Blitze)
    │   ├── Precipitation.ts   Niederschlags-Partikel um die Kamera
    │   ├── Water.ts           Wasserfläche (Wellen, Fresnel, Glanz, Nebel)
    │   ├── Vegetation.ts      Zellen: generisches Gras/Steine (InstancedMesh) + Arten-Pflanzen je Material als BatchedMesh
    │   ├── VegetationAssets.ts Platzhalter-Geometrien + Materialien mit Wind-Shader (Instancing und Batching)
    │   ├── geometry.ts        Helfer: colorize, jitter, taperedQuad, mergeParts, hsl
    │   ├── flora/             FloraBuilder (Genom → Geometrie je Wuchsform), FloraAssets (Cache + Materialien)
    │   ├── creatures/         CreatureBuilder (Genom → geskinnte Geometrie + Knochen), Creature (Skelett, Animation, Bewegung),
    │   │                      CreatureAI (FSM, rein), CreatureManager (Spawner nach Bedingungen, Population)
    │   ├── props/             PropBuilder (Erze/Gesteine/Fossilien/Ruinen aus Genom), PropManager (Zellen, Raycast-Interaktion)
    │   ├── photo/PhotoMode.ts Kameraeinstellungen, DoF/Filter-Effekte, Motiverkennung und Bewertung beim Auslösen
    │   ├── resources/         ResourceNodeManager: abbaubare Knoten (Zellen 128 m, Vorlagen je Rohstoff, Restmenge, Respawn)
    │   ├── base/BaseModules.ts BaseManager: Modul-Meshes aus dem PlayerState, Geist-Vorschau, Platzierungsprüfung, Nähe-Abfragen
    │   ├── ship/ShipBuilder.ts Entwurf → Gruppe (Rumpf, Kanzel, Düsen + Flammen, Beine, Anbauten), Sockelmarker für die Werft
    │   ├── ship/ShipActor.ts  Lander auf der Oberfläche: Position, Schub/Licht, Start- und Landehöhe, Raycast-Auswahl
    │   ├── probes/Rover.ts    Ferngesteuerter Rover: Fahrphysik auf dem Terrain (Nick/Roll), Wasser-/Grenzsperre, Augpunkt
    │   ├── probes/Buoys.ts    Bojen der Tiefseesonden (wippen auf dem Wasser)
    │   ├── character/CharacterBuilder.ts  Konfiguration → Avatar aus Primitiven (Gelenke, Gesicht, Frisur, Anzug, Helm, Animation)
    │   └── HintSystem.ts      Spuren/Kot/Nester als Objekte, Geräusche/Gerüche als Meldung, Gerüchte über seltene Verwandte
    │   └── Player.ts          Ego-/Schulter-Controller, Terrain-Kollision, Schwimmen, Gravitation
    ├── assets/                AssetRegistry: Platzhalter-Geometrien/Materialien, später austauschbar
    ├── audio/                 AudioManager (Web Audio), prozedurale Sounds
    └── save/                  IndexedDB-Zugriff, Serialisierung, Migrationen, Export/Import
```

### Modulgrenzen (Abhängigkeitsrichtung)

```
config ← math ← gen ← game ← (scenes, world, ui, save)
                 ↑
core, render ────┘   (core kennt weder gen noch ui; render kennt nur gen-Datentypen für Texturen)
```

Generator-Aufbau (`src/gen`):

```
gen/index.ts            generateUniverse(seed) = generateStarSystem + generateArchive
gen/universe/
  catalog.ts            Sonnentypen, Planetentypen (Gewichte, Caps), Biome, Rohstoffe, Wetter, Gefahren
  System.ts             Stern, Orbits (layoutOrbits: 1 Orbit garantiert in der Lebenszone), Planeten, Budget
  Planet.ts             Typwahl nach Gleichgewichtstemperatur, Atmosphäre, Biome, Rohstoffe, Wetter, Gefahren, Anforderungen
  Fuel.ts               Treibstoff-Formel + analyzeMix (Reinheit, Energiedichte, Stabilität)
gen/archive/
  budget.ts             Kategorie-Anteile → Planeten (Gewichte × Caps, Largest Remainder)
  names.ts              NameRegistry (Eindeutigkeit), Komposita, lateinische Epitheta
  spawn.ts              makeSpawn (nach Seltenheit) + isSpawnSatisfiable (Garantie)
  descriptions.ts       deutsche Beschreibungstexte aus Merkmalen
  generators/           fauna, flora, micro, minerals (ore/rock), fossils, weather, variants
  ArchiveGenerator.ts   Orchestrierung pro Planet, Varianten zuletzt, planet.entryBudget
```

- `gen/**` und `math/**` importieren **niemals** Three.js oder DOM. Dadurch laufen sie in Vitest (Node) und bleiben
  deterministisch testbar.
- `core/**` ist spielunabhängig (Loop, Input, Szenenverwaltung).
- `scenes/**` verdrahtet alles: holt Daten aus `gen`, baut Three.js-Objekte aus `world`/`assets`, zeigt `ui`.
- Jede Szene besitzt ihre Ressourcen und gibt sie in `dispose()` vollständig frei (`Disposer`).

## 4. Datenmodelle (Phase 1)

### 4.1 Sternsystem

```ts
StarSystem {
  seed: string; name: string; difficulty: number;
  star: Star;                     // type: 'yellow' | 'red_giant' | 'blue_dwarf', Farbe, Leuchtkraft, Lebenszone, Strahlung
  planets: Planet[];              // 3–10
  startPlanetId: string;          // garantiert lebensfreundlich + alle Start-Rohstoffe
  fuelFormula: FuelFormula;       // 2–3 Komponenten mit Verhältnissen, pro Seed anders
  entryBudget: number;            // 400–600
  entries: ArchiveEntry[];        // alle Archiv-Einträge des Systems
  families: Family[];             // Familien, auf die Einträge verweisen
}

Planet {
  id, name, index, type: PlanetType;   // rocky | ocean | desert | ice | jungle | volcanic | tundra | toxic | barren | gas_giant
  orbitRadius (AU), orbitPeriod (Tage), radiusKm, gravity (g),
  atmosphere { composition: Record<Gas, number>, pressure, density, breathable, toxic },
  temperature { mean, min, max } (Kelvin), dayLengthHours, axialTilt, moons: Moon[],
  biomes: Biome[], resources: ResourceDeposit[], weather: WeatherType[], hazards: Hazard[],
  biodiversity (0..1), terrainSeed, isStart, requirements { engineTier, shieldTier },
  entryBudget: Record<Category, number>  // wie viele Einträge hier liegen
}
```

### 4.2 Archiv

```ts
ArchiveEntry {
  id: 'p2-FAU-017'; category: Category; subcategory; familyId; name (DE, umbenennbar); latinName;
  planetId; biomeIds[]; rarity: 'common'|'uncommon'|'rare'|'legendary';
  description (generiert); spawn: SpawnConditions; behaviors[]; hints[]; captureMethod: 'photo'|'microscope'|'sample';
  genome: Genome;                 // Parameter für prozedurales Aussehen/Verhalten (Phase 3)
  baseEntryId?                    // bei Varianten
}
SpawnConditions { timeOfDay, weather: 'any' | WeatherType[], altitude: [0..1,0..1], temperature: [K,K], special? }
```

Kategorien und Budget-Anteile (bei 500): Fauna 130 · Flora 90 · Mikro 70 · Erze 60 · Gesteine 50 ·
Fossilien/Ruinen 40 · Wetter/Himmel 30 · Varianten 30. Verteilung auf Planeten nach Typ, Größe und Biodiversität
(mit Obergrenzen, z. B. keine Flora auf Gasriesen); der Startplanet erhält einen Bonus.

**Garantien (per Test belegt):** gleicher Seed ⇒ identisches System; 3–10 Planeten; 400–600 Einträge; keine doppelten IDs;
jeder Eintrag ist auf seinem Planeten auffindbar (Biom vorhanden, Wetter im Wetter-Set, Temperatur im Bereich);
Startplanet enthält alle Start- und Treibstoff-Rohstoffe; korrekte Mischung ergibt Stabilität/Energiedichte/Reinheit ≥ 0,9.

### 4.3 Spielstand (ab Phase 4/10)

Der Spielstand ist je Seed in zwei IndexedDB-Datensätze geteilt: `progress` (Archiv-Fortschritt, `ArchiveProgress.toJSON()`) und
`kv['player:<seed>']` (`PlayerStateSnapshot { version, inventory, survival, modules, labLevel, respawn, goalStep }`). Beide haben
`migrate()`-Funktionen; Phase 10 bündelt sie mit Charakter, Schiff, Sonden, Karte und Einstellungen zu einem Export/Import.

### 4.4 Terrain-Modell (Phase 2)

`src/gen/terrain/TerrainModel.ts` (rein, testbar): quadratische Welt von 6–10 km Kantenlänge (abhängig vom Planetenradius),
maximale Höhe 400–760 m. Ein Regionsfeld (fBm mit Domain-Warping) wählt das Biom nach kumulierter Abdeckung; jedes Biom
trägt sein Höhenband (`altitude`) bei, Übergänge werden geblendet. Wasserspiegel = 0,1 · maxHeight, nur Biome mit `hasWater`
liegen darunter. `sample(x, z)` liefert Höhe, Biom, Nachbarbiom, Blendgewicht, Detail- und Höhenwert; `findSpawn()` einen
deterministischen, flachen Landeplatz. `VegetationProfiles.ts` definiert Dichten je Biom.

### 4.5 Kreaturen und Arten-Flora (Phase 3)

- `gen/archive/conditions.ts` (rein): `matchesSpawn(entry, ctx)` prüft Biom, Tageszeit, Wetter, Höhe, Temperatur und
  Spezialbedingung; `matchesPlacement` für statische Flora; `pointTemperature` schätzt die Temperatur am Ort.
- **Kreaturen**: `CreatureBuilder` erzeugt aus dem Fauna-Genom starre Körperteile (Rumpf, Hals, Kopf, Beine mit Hüfte/Knie,
  Flügel, Flossen, Schwanz, Extras), färbt Muster per Vertexfarben und hängt jedes Teil an einen Knochen (Single-Bone-Skinning,
  ein Draw-Call je Kreatur). `Creature` baut Skelett und SkinnedMesh, animiert prozedural (Gang, Flügelschlag, Schlängeln,
  Fressen, Schlafen) und bewegt sich je Fortbewegungsart (Land, Wasser, Luft). `CreatureAI` ist die Zustandsmaschine
  (Idle, Wandern, Fressen, Schlafen, Flüchten, Neugier, Imponieren) mit Bedrohungsmaß aus Entfernung, Lärm, Blick und Scheu.
  `CreatureManager` spawnt alle 1,5 s hinter dem Spieler Arten, deren Bedingungen gerade passen (Seltenheit gewichtet,
  Gruppen nach Verhalten, max. 26) und entfernt entfernte Tiere.
- **Flora-Arten**: `FloraBuilder` baut je Eintrag eine Geometrie (Baum, Strauch, Gras, Pilz, Wasserpflanze, Sukkulente,
  Flechte, Ranke, Kristallpflanze) aus dem Genom; `VegetationManager` platziert Arten nach Biom, Höhenband, Wasserregel und
  Seltenheit (Dichte je Wuchsform normiert) und zeichnet sie pro Zelle als BatchedMesh.

### 4.6 Kernschleife: Foto, Archiv, Proben (Phase 4)

- **Foto-Modus** (`Q`): Zeitlupe (×0,1), Spieler eingefroren, Umsehen bleibt. Einstellungen: Zoom (Rad), Fokus (`,`/`.`, Autofokus RMT),
  Blende (R: f/1.4–f/11 → Schärfebereich), Belichtung (1/2), Filter (F), Raster (H), Selfie (C). Effekte als zweiter EffectPass
  (DepthOfField, HueSaturation, BrightnessContrast, Sepia, Vignette), nur im Foto-Modus aktiv.
- **Auslösen**: `PhotoMode.evaluate()` sammelt Motive aus Quellen (Kreaturen, Flora-Arten, Fossil-Props, aktive Himmelsphänomene),
  projiziert sie, prüft Verdeckung per Raycast (Terrain, Props, Wasserlinie) und bewertet mit `PhotoScoring` (Ausschnitt 30 %,
  Komposition 20 %, Fokus 20 %, Licht 15 %, Sichtbarkeit 15 %, Verhaltensbonus, Abzüge für Belichtung/Bewegung). Hauptmotiv voll,
  bis zu zwei Nebenmotive mit −15. Das Canvas wird im selben Frame als JPEG (Archiv) und PNG (Export) gelesen; Thumbnail 480 px.
- **Fortschritt** (`ArchiveProgress`, rein): Sterne nur aufwärts, bestes Foto, Verhaltens-Slots, Hinweise, Proben, Logbuch,
  Abschluss je Planet/Kategorie, „versiegelt“ ab 80 %. Persistenz per IndexedDB (debounced 3 s, bei Pause/Verlassen sofort).
- **Proben** (`E`): Kontext im Fadenkreuz – Prop (Erz/Gestein → Probe, Fossil/Ruine → Scan 1★), Wasser, Pflanze, Boden. Analyse im
  Archiv (Tab → Proben): Mineralproben liefern Reinheit/Struktur/Spuren → Sterne; andere öffnen das Mikroskop (2D-Canvas) mit 1–4 Arten
  des Bioms in verschiedenen Tiefen; Fokus-Regler, scharfe Zelle fotografieren → Sterne nach Schärfe.
- **Hinweise**: alle 25–45 s ein Hinweis für eine unentdeckte Art des aktuellen Bioms (Spuren/Kot/Nest als Objekt in 10–32 m, Geräusch/
  Geruch als Meldung). Aufsammeln verrät Biom, Tageszeit, Wetter, Gattung und ein Merkmal. Neue Entdeckungen können Gerüchte über
  seltene Verwandte auslösen.

### 4.7 Überleben, Rohstoffe, Basis, Labor (Phase 5)

- **Überleben** (`Survival`, rein): Sauerstoff und Anzug-Energie 0–100. Sauerstoff sinkt nur in nicht atembarer Atmosphäre (8 min)
  oder unter Wasser (60 s) und erholt sich an atembarer Luft schnell; Energie sinkt immer langsam (15 min), schneller bei Sprint, Kälte,
  Hitze, Strahlung. In 5 m um Unterkunft/Ladestation laden beide in 20 s voll. Warnungen bei 25 % und 10 %; bei 10 % werden
  Sauerstoff-/Energiezellen (+50) automatisch eingesetzt. Bei 0: Zusammenbruch → Ausblenden, Rückkehr zur Unterkunft (sonst Landeplatz),
  10 % der Rohstoffe verloren, Werte auf 60. Kein Permadeath.
- **Rohstoffe**: `generateResourceNodes` (rein) platziert je 128-m-Zelle deterministisch Knoten aus den Vorkommen des Planeten
  (Biom-Bindung, nicht im Wasser, nicht zu steil); Vorlagen je Rohstoffart (Metallbrocken, Kristallcluster, Mineralknollen, Gasquellen,
  Faserbüschel, Harzstumpf, Sporenpolster). **E halten** (1,2 s) baut 2 Einheiten ab; erschöpfte Knoten kehren nach 10 min zurück.
  Wasser/Sole wird am Ufer gesammelt, Fasern/Harz/Sporen an Pflanzen (Pilz → Sporen, Baum → Harz, sonst Fasern; 5 min Nachwachsen).
- **Inventar/Fertigung** (`I`): Rohstoffe, Gegenstände, Treibstoff, Zielschritt. Feldfertigung von Hand: Werkbank, Unterkunft. An der
  Werkbank (`E` am Modul): Ladestation, Labor, Sauerstoff-/Energiezelle, Köder, Labor-Upgrade (max. 2, braucht Labor). Alle Rezepte
  verwenden nur die vier garantierten Startrohstoffe (Ferrit, Quarz, Wasser, Faser) – jeder Seed bleibt lösbar.
- **Bau-Modus** (`B`): Geist-Modul am Fadenkreuz (Terrain-Treffer ≤ 12 m, Raster 2 m), 1–4 Modultyp, R drehen, Klick platzieren
  (verbraucht den gefertigten Gegenstand), X entfernen (50 % der Kosten zurück). Prüfung: nicht im Wasser, Gefälle < 0,35, Abstand zu
  anderen Modulen. Module liegen im `PlayerState` je Planet; `BaseManager` spiegelt sie als Meshes (Körper + Leuchtteile).
- **Labor** (`E` am Labor): Treibstoff-Synthese als Forschungsaufgabe. 2–3 Rohstoffe mit Treibstoff-Rolle, 10 Anteile, „Analysieren“
  (kostet je 1 Einheit) liefert Reinheit/Energiedichte/Stabilität/Qualität der seed-spezifischen Formel (`analyzeMix`); Notizen der
  letzten Analysen. „Synthetisieren“ (1/2/5 Chargen) erzeugt `round(Chargen × 4 × Ausbeute × Qualität)` Treibstoff, unter 60 % Qualität
  verpufft die Mischung. Labor-Stufe 2 zeigt die Hinweise der Analyse, Stufe 3 Rollen-Hinweise („X reagiert nicht – anderer Oxidator“,
  „Es fehlt: Stabilisator“). Ziel: 20 Treibstoff für den ersten Start (Phase 6).
- **Köder**: an der Werkbank gefertigt, an der Spielerposition ausgelegt (60 s); Tiere in 40 m wechseln in den Zustand `lured` und
  nähern sich (Foto-Chance).
- **Zielanzeige**: `goalStep` (nur aufwärts) aus dem Zustand abgeleitet: Rohstoffe → Werkbank → Labor → Formel → 20 Treibstoff → bereit.

### 4.8 Schiffbau und Raumflug (Phase 6)

- **Entwurf** (`ShipDesign`, rein): genau ein Rumpf (Stufe 1–3) mit Sockeln (oben: Kanzel, unten: 1–3 Triebwerke, Beinhalterungen,
  Seiten: Tank/Fracht/Scanner/Schild). `shipStats()` liefert Leermasse, Schub, Tank, Effizienz, Stufen (Triebwerk, Schild, Scanner),
  Beine und deren g-Auslegung. `validateDesign(design, g)` prüft Kanzel, Triebwerk, Tank, ≥ 3 Beine, Bein-Auslegung und
  Schub/Gewicht ≥ 1,1 (Masse = Leermasse + Treibstoff × 0,05 t). Rumpfwechsel behält Teile, für die ein freier Sockel gleicher Art
  existiert.
- **Startzustand:** der beschädigte Lander (Rumpf + Kanzel) steht auf einem flachen Landeplatz nahe dem Spawn des Startplaneten; der
  Spieler erwacht daneben. Triebwerk, Tank und Beine werden in der Werft gebaut (alle Teile kosten nur Startrohstoffe).
- **Werft** (`ShipEditorScene`, E am Schiff → „Werft öffnen“): 3D-Editor mit Orbit-Kamera, Teileliste links (Bauplan-/Rohstoffstatus),
  Live-Werte rechts, freie Sockel als pulsierende Marker (grün = passend zum gewählten Teil). Änderungen werden erst mit „Übernehmen“
  bezahlt (`costDelta`: Zugänge kosten, Abgänge werden voll erstattet). Zu viel Treibstoff beim Tankwechsel geht ins Inventar.
- **Treibstoff** (`travel.ts`): Start `⌈(2 + 0,25·g·Masse)/Effizienz⌉`, Landung `⌈(1 + 0,15·g·Masse)/Effizienz⌉`,
  Transfer `⌈1,5·ΔAU·Masse/15/Effizienz⌉`. Der Start erfordert Treibstoff für Start + Rückkehr auf denselben Planeten.
  Ein Test belegt, dass der Stufe-1-Lander auf jedem Startplaneten mit 20 Einheiten starten und landen kann.
- **Start** (`PlanetScene`): Countdown 3 s, Schub hoch, Aufstieg 6 s mit Außenkamera, Ausblenden → `SpaceScene`; Treibstoff abgezogen,
  Schiff im Orbit, `flights++`. **Orbit** (`SpaceScene`): stilisiertes System (feste Planetenpositionen), Lander beim aktuellen Planeten,
  Liste nach Distanz mit Transfer-/Landekosten, Stufen-Prüfung (`reachCheck`: Triebwerk-/Schildstufe des Planeten) und Landeprüfung
  (`landCheck`: keine Gasriesen, Beine, Schub/Gewicht). Transfer als animierte Bahn, Kamera folgt. **Landung**: Landekosten
  (wer sie nicht mehr hat, darf an Ort und Stelle kostenlos landen – nie stranden), `gameState.arrival = 'landing'` → `PlanetScene`
  spielt den Abstieg aus 160 m mit Außenkamera, setzt den Spieler neben dem Schiff ab und merkt sich den Landeplatz je Planet.
- **Baupläne** (`blueprints.ts`): Stufe-2/3-Teile sind gesperrt, bis ein Bauplan freigeschaltet ist. Quellen: jede zum ersten Mal
  gescannte Ruine (F) und Archiv-Meilensteine (10/20/30/40/50/60 %). Reihenfolge je Seed fest (Stufe 2 vor 3, erster Plan ist
  Triebwerk II oder Schild I). Ein Test belegt: jeder Startplanet hat Ruinen oder einen Stufe-1-Nachbarn.
- **Spielerzustand v2:** `ship { design, fuel, location (surface x/z/rot | orbit), flights }`, `blueprints`, `scannedRuins`,
  `milestonesClaimed`, `sites` (Landeplatz je Planet). Eine Instanz lebt in `gameState.player` (über `playerStore`), damit
  Szenenwechsel (Planet ↔ Werft ↔ Orbit) keinen Lese-/Schreib-Wettlauf mit IndexedDB haben. „Neues Spiel“ setzt beim gespeicherten
  Schiff fort (Orbit → Raumflug, sonst Planet des Schiffs).

### 4.9 Sonden, Satelliten und Karte (Phase 7)

- **Kartenraster** (`MapGrid`, rein): 96 × 96 Zellen über der quadratischen Planetenkarte (Kantenlänge aus `terrainSizeFor`).
  Stufe 0 unbekannt, 1 erkundet (Spieler 220 m, Rover 180 m, Tiefseesonde 280 m, Atmosphärensonde 1500 m), 2 vom Satelliten
  gescannt. Nie absteigend; Serialisierung als Base64 (9 KB je Planet) im `PlayerState` (v3: `maps`, `satellites`, `rovers`,
  `deepProbes`, `atmoProbes`).
- **Karte** (`MapUi`, M): Canvas 640 px. Höhenkarte (Grau, Wasser blau) aus dem Terrain-Modell (160 × 160 Abtastungen, einmal je
  Planet), Biomlayer in Biomfarben, Fog of War als weiche Zellmaske (unbekannt schwarz; mit Satellit nur abgedunkelt, weil die
  Höhenkarte bekannt ist). Layer: Biome, Rohstoffe (alle Knoten des Planeten, deterministisch aus `generateResourceNodes`),
  Lebenszeichen (Katalog-Lücken je Biom im 6×6-Block mit dem größten sichtbaren Biomanteil, „fehlen N“), Marker. Ohne Satellit mit
  Tiefenscanner zeigen Biome/Rohstoffe/Lebenszeichen nur erkundete Zellen. Icons: Spieler (Pfeil), Schiff, Module, Unterkunft,
  Rover, Sonden, Marker (Klick setzt/entfernt, Liste rechts zum Umbenennen). Seitenleiste: Erkundungsgrad, Satellit, Lücken je
  Biom (unbekannte Biome als „?“).
- **Satellit** (Werkbank-Gegenstand, im Orbit aussetzen): Stufe = max(1, Scanner-Stufe des Schiffs). Stufe 1 deckt die Höhenkarte
  des ganzen Planeten auf (Zellstufe 2), Stufe 2 schaltet Biom-, Rohstoff- und Lebenszeichen-Layer frei. Ein höherwertiger
  Satellit ersetzt den alten. In der Orbit-Ansicht umkreist ein kleiner Marker den Planeten; die Liste zeigt Kartenstand je Planet.
- **Rover** (`Rover`, Werkbank-Gegenstand): mit I aussetzen, E am Rover steuern (WASD, Maus-Kamera als Verfolger, Signalreichweite
  900 m zum Spieler), E/Esc zurück, X einpacken. Fährt Gefälle bis 45°, stoppt an Wasser und Weltgrenze; deckt die Karte um sich auf.
  Fotos im Rover-Modus nutzen den Augpunkt am Mast und zählen mit −20 % (Rover-Kamera); F nimmt Boden-/Pflanzen-/Wasserproben
  am Rover. Der Spieler bleibt eingefroren, Überleben läuft weiter (Rover sinnvoll von Unterkunft/Schiff aus steuern). Position
  wird alle 2 s und beim Verlassen gespeichert.
- **Tiefseesonde** (Werkbank, am Ufer aussetzen, bis 40 m zum Wasser): Boje, deckt 280 m auf, Hinweise (Biom, Tageszeit, Wetter,
  ohne Namen) für bis zu 4 unentdeckte Wasserarten, Wasserprobe für das Mikroskop.
- **Atmosphärensonde** (Werkbank, im Orbit eines Gasriesen starten): erfasst alle Wetterphänomene des Gasriesen mit 1★
  (Analysequalität 0,5), Hinweise für Schwebewesen/Varianten/Mikroben, Luftprobe für das Mikroskop. Damit sind Gasriesen-Einträge
  erstmals erreichbar (Landung bleibt unmöglich). Erreichbarkeit nach Stufen (Triebwerk 2, Schild 1) gilt weiterhin.
- **Gemeinsamer Fortschritt:** `gameState.progress` hält den `ArchiveProgress` je Seed (`progressStore`), damit die Orbit-Szene
  Entdeckungen und Proben der Atmosphärensonde verbuchen kann.

### 4.10 Charaktererstellung und Hintergründe (Phase 8)

- **Konfiguration** (`CharacterConfig`, rein, Version 1): Name, Körper (Größe, Statur, Schultern, Beinlänge), Gesicht (Kiefer,
  Augengröße/-abstand, Nase, Hautton/-stich, Augenfarbe, Markierungen), Haare (8 Frisuren, Farbe, 4 Bärte), Anzug (Primär/Sekundär/
  Akzent, 5 Muster, 5 Abzeichen, Helm-Modus), Hintergrund. `sanitizeCharacter()` begrenzt alle Regler auf 0..1, prüft Farben und
  Enums und dient als Migration (unbekannte Felder fallen weg). Zufall ist seedbar (`randomCharacter(rng, base, locks)`), Gruppen
  lassen sich sperren. **Share-Code** `SA1.<base36>.<name>` (unter 110 Zeichen) kodiert alle Werte (Regler mit 1/1295 Auflösung),
  JSON-Export/-Import ergänzt ihn. Sechs mitgelieferte Presets, eigene Presets in IndexedDB (`character-presets`).
- **Hintergründe** (`backgrounds.ts`): Biologe (Hinweise ×1,7, Sichtungsweite +35 %), Geologin (Scan-Qualität +0,25,
  Analyse +0,2, +1 Einheit je Abbau), Ingenieur (Rezepte und Schiffsteile −20 %, Sammeltempo +35 %), Fotografin (Bewertungstoleranz
  0,35, Filter Infrarot/Noir). Die Boni sind ein `BackgroundBonus`-Objekt, das die Planetenszene an HintSystem, Foto-Modus,
  Analyse, Abbau und Kosten reicht (`effectiveCost` in InventoryUi/ShipEditor).
- **Avatar** (`CharacterBuilder`, Three.js): Gelenkgruppen für Hüften, Schultern und Kopf; Gliedmaßen als Kapseln, Gesicht aus
  Kugeln/Kegel, Frisur je Stil, Bart, Anzugmuster als Ringe/Panels/Platten, Abzeichen auf der Brust, Helm als Visierkugel. Die
  Geh-Animation schwenkt Gliedmaßen phasengesteuert nach Geschwindigkeit, Idle-Atmung über die Torso-Skalierung. Der Spieler
  (`Player.setCharacter`) ersetzt damit die Platzhalterkapsel; Augenhöhe folgt der Körpergröße, Helm bei nicht atembarer Atmosphäre
  (Modus „auto“) oder nach Wahl. Sichtbar in Schulterperspektive (V) und Selfie-Modus (C).
- **Szene** (`CharacterScene`): Studio-Licht (Key/Fill/Rim), Boden, Sterne, Orbit-Kamera mit Drehteller und Schnellansichten
  (Gesicht/Ganzkörper), Live-Neuaufbau bei jeder Änderung. Vor dem ersten Spiel eines Seeds öffnet „Neues Spiel“ den Editor
  (`character === null` im `PlayerState` v4); „Charakter“ im Hauptmenü bearbeitet ihn später (Boni greifen beim nächsten
  Planetenbesuch).

## 5. Laufzeit-Architektur

- **GameLoop**: `requestAnimationFrame`, Akkumulator mit festem Update-Schritt (1/60 s, max. 5 Schritte/Frame), Render pro Frame,
  FPS/Frametime-Statistik. Keine Allokationen im Loop.
- **SceneManager**: genau eine aktive Szene. `switchTo()` ruft `exit()` + `dispose()` der alten Szene, dann `enter()` der neuen.
- **Renderer**: `WebGLRenderer` auf `#game-canvas`, Render-Skalierung (50–200 %) × `devicePixelRatio` (gedeckelt), Resize-Handling,
  `renderer.info` für Debug. Composer (postprocessing) wird pro Szene erzeugt. Achtung: `autoRenderToScreen` gibt nur dem zuletzt
  hinzugefügten Pass `renderToScreen`; optionale Pässe (Foto-Modus) schalten das Flag beim Deaktivieren auf den Vorgänger um, sonst
  bleibt die Leinwand außerhalb des Modus schwarz.
- **UI**: `#ui-root` (Spiel-UI) und `#debug-root` (Debug-Overlay, F3). Jede UI-Komponente besitzt ihr DOM und räumt es auf.
- **Input**: Aktionen statt Tasten (`move_forward`, `interact`, `camera`, `catalog`, `map` …), Bindings in `config/keybindings.ts`.
  Mehrere Aktionen dürfen dieselbe Taste belegen, wenn sie in unterschiedlichen Modi gelten (F: Filter im Foto-Modus, Probe sonst;
  R: Blende bzw. Drehen; 1–4: Belichtung bzw. Modulwahl).
- **PlanetScene**: Ladebildschirm → Terrain in Zeitscheiben → Vegetation → HUD. Pointer-Lock per Klick; Esc/Lock-Verlust öffnet das
  Pausemenü. Zustand (Position, Tageszeit) wird in `GameState.surface` gesichert, damit Systemansicht ↔ Planet nahtlos wechseln.
- **Terrain-LOD**: Quadtree mit Zellen 64–1024 m, 32 Segmente je Zelle, Skirts gegen Risse, Aufbau nach Entfernung mit Zeitbudget,
  alte Zellen bleiben bis die Nachfolger fertig sind. Geometrien werden gepoolt (gleiche Vertexzahl).

## 6. Roadmap / Phasen

| Phase | Inhalt | Status |
| ----- | ------ | ------ |
| 0 | Setup, Loop, Input, SceneManager, Debug-Overlay, Docs | ✅ |
| 1 | Universum-Generator (Stern, Planeten, Archiv-Einträge, Startplanet, Treibstoff) + Tests + 3D-Debug-Ansicht | ✅ |
| 2 | Planetenoberfläche: Chunk-Terrain, Biome, Himmel, Tag/Nacht, Wetter-Basis, Spieler, Wasser, Vegetation | ✅ |
| 3 | Kreaturen und Flora: prozedurale Körper, Verhalten, Spawn nach Bedingungen, Seltenheit | ✅ |
| 4 | Kamera und Katalog (Kernschleife): Foto-Modus, Bewertung, Archiv-UI, Fotospeicherung, Hinweise, Mikroskop | ✅ |
| 5 | Überleben, Rohstoffe, Basis, Labor, Treibstoff-Synthese | ✅ |
| 6 | Schiffbau und Raumflug: Werft, Teile/Stufen, Baupläne, Start/Orbit/Landung, Treibstoffverbrauch | ✅ |
| 7 | Sonden, Satelliten, Karte: Fog of War, Layer, Hotspots/Lücken, Marker, Rover, Tiefsee- und Atmosphärensonde | ✅ |
| 8 | Charaktererstellung: Editor mit Live-Vorschau, Hintergründe mit Boni, Presets, Share-Code, Avatar im Spiel | ✅ |
| 9 | Grafik und Einstellungen, adaptive Qualität | ⬜ |
| 10 | Politur: Tutorial, Audio, Speichern/Laden, Balancing, README | ⬜ |

## 7. Performance-Leitlinien

Instancing für Vegetation/Kleinzeug, LOD, Frustum-Culling, Chunk-Terrain, Object-Pooling, keine Allokationen im Render-Loop,
`dispose()` für alle GPU-Ressourcen beim Szenen-/Planetenwechsel. Ziel: 60 FPS bei „Mittel“/1080p auf integrierter GPU.
