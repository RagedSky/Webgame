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
    ├── game/                  GameState: Seed, memoisiertes Sternsystem, später Spielstand
    ├── render/                Renderer-Wrapper (DPR, Render-Skalierung), Composer-Fabrik, Starfield, PlanetTexture (prozedural)
    ├── scenes/                konkrete Szenen: MainMenuScene, SystemViewScene (Debug), später PlanetScene, ShipEditorScene …
    ├── ui/                    DOM-Overlays: DebugOverlay, Toast, SystemPanel (Übersicht/Planeten/Archiv/Dump), später HUD/Katalog/Karte
    ├── world/                 Laufzeit-Welt (Three.js)
    │   ├── terrain/           TerrainChunk (Skirts, Vertexfarben, Geometrie-Pool), TerrainManager (Quadtree-LOD, Zeitbudget)
    │   ├── Sky.ts             Kuppel-Shader (Rayleigh/Mie vereinfacht, Wolken, Dämmerung), Sterne, Monde, Gasriese, Sonnen-/Hemisphärenlicht
    │   ├── DayCycle.ts        Tageszeit, Sonnenrichtung, Tageslicht-Faktor, Uhr
    │   ├── Atmosphere.ts      Himmelsfarben aus Atmosphärenzusammensetzung und Sternfarbe
    │   ├── Weather.ts         Wetter-Zustandsmaschine (seed-basiert), Parameter (Nebel, Wolken, Niederschlag, Wind, Blitze)
    │   ├── Precipitation.ts   Niederschlags-Partikel um die Kamera
    │   ├── Water.ts           Wasserfläche (Wellen, Fresnel, Glanz, Nebel)
    │   ├── Vegetation.ts      Instancing-Zellen (nah: Gras/Büsche/Steine, fern: Bäume)
    │   ├── VegetationAssets.ts Platzhalter-Geometrien + Materialien mit Wind-Shader
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

`SaveGame { version, seed, character, inventory, base, ship, probes, mapProgress, archiveProgress, settings, photos (IndexedDB-Refs) }`
mit `migrate(from, to)`.

### 4.4 Terrain-Modell (Phase 2)

`src/gen/terrain/TerrainModel.ts` (rein, testbar): quadratische Welt von 6–10 km Kantenlänge (abhängig vom Planetenradius),
maximale Höhe 400–760 m. Ein Regionsfeld (fBm mit Domain-Warping) wählt das Biom nach kumulierter Abdeckung; jedes Biom
trägt sein Höhenband (`altitude`) bei, Übergänge werden geblendet. Wasserspiegel = 0,1 · maxHeight, nur Biome mit `hasWater`
liegen darunter. `sample(x, z)` liefert Höhe, Biom, Nachbarbiom, Blendgewicht, Detail- und Höhenwert; `findSpawn()` einen
deterministischen, flachen Landeplatz. `VegetationProfiles.ts` definiert Dichten je Biom.

## 5. Laufzeit-Architektur

- **GameLoop**: `requestAnimationFrame`, Akkumulator mit festem Update-Schritt (1/60 s, max. 5 Schritte/Frame), Render pro Frame,
  FPS/Frametime-Statistik. Keine Allokationen im Loop.
- **SceneManager**: genau eine aktive Szene. `switchTo()` ruft `exit()` + `dispose()` der alten Szene, dann `enter()` der neuen.
- **Renderer**: `WebGLRenderer` auf `#game-canvas`, Render-Skalierung (50–200 %) × `devicePixelRatio` (gedeckelt), Resize-Handling,
  `renderer.info` für Debug. Composer (postprocessing) wird pro Szene erzeugt.
- **UI**: `#ui-root` (Spiel-UI) und `#debug-root` (Debug-Overlay, F3). Jede UI-Komponente besitzt ihr DOM und räumt es auf.
- **Input**: Aktionen statt Tasten (`move_forward`, `interact`, `camera`, `catalog`, `map` …), Bindings in `config/keybindings.ts`.
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
| 3 | Kreaturen und Flora: prozedurale Körper, Verhalten, Spawn nach Bedingungen, Seltenheit | ⬜ |
| 4 | Kamera und Katalog (Kernschleife): Foto-Modus, Bewertung, Archiv-UI, Fotospeicherung, Hinweise, Mikroskop | ⬜ |
| 5 | Überleben, Rohstoffe, Basis, Labor, Treibstoff-Synthese | ⬜ |
| 6 | Schiffbau und Raumflug | ⬜ |
| 7 | Sonden, Satelliten, Karte | ⬜ |
| 8 | Charaktererstellung | ⬜ |
| 9 | Grafik und Einstellungen, adaptive Qualität | ⬜ |
| 10 | Politur: Tutorial, Audio, Speichern/Laden, Balancing, README | ⬜ |

## 7. Performance-Leitlinien

Instancing für Vegetation/Kleinzeug, LOD, Frustum-Culling, Chunk-Terrain, Object-Pooling, keine Allokationen im Render-Loop,
`dispose()` für alle GPU-Ressourcen beim Szenen-/Planetenwechsel. Ziel: 60 FPS bei „Mittel“/1080p auf integrierter GPU.
