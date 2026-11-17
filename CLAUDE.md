# CLAUDE.md – Stellar Archive

3D-Entdecker-Spiel im Browser (Three.js + TypeScript + Vite). Kern: Fotografieren und Katalogisieren von 400–600
prozedural erzeugten Archiv-Einträgen pro seed-basiertem Sternsystem. Vollständige Beschreibung: `docs/ARCHITECTURE.md`.

## Befehle

| Befehl            | Zweck                                                   |
| ----------------- | ------------------------------------------------------- |
| `npm install`     | Abhängigkeiten                                          |
| `npm run dev`     | Dev-Server (http://localhost:5173)                      |
| `npm run build`   | Typecheck + Produktions-Build nach `dist/`              |
| `npm run preview` | gebauten `dist/`-Ordner lokal ausliefern                |
| `npm test`        | Vitest (Generator-Tests, Node-Umgebung)                 |
| `npm run lint`    | ESLint (inkl. Verbot von `Math.random`)                 |
| `npm run check`   | typecheck + lint + test                                 |

Im Spiel: **F3** Debug-Overlay, **Esc** Pause/zurück. Oberfläche: WASD, Maus, Leertaste, Shift, Strg, **V** Ansicht,
**Q** Foto-Modus (Rad Zoom, `,`/`.` Fokus, RMT Autofokus, R Blende, 1/2 Belichtung, F Filter, H Raster, C Selfie, Leertaste/Klick auslösen),
**Tab** Archiv (Logbuch, Proben, Mikroskop), **F** Probe/Scan, **E** halten sammeln / Modul öffnen, **I** Inventar/Fertigung,
**B** halten: Bau-Rad (Maus zum Modul ziehen, loslassen wählt; dann R drehen, Klick platzieren, X entfernen), **L** Taschenlampe, **E** am Schiff: Werft / Betanken / Start; im Orbit Planet wählen,
Fliegen, Landen, Satellit/Atmosphärensonde. **M** Karte (Layer, Marker per Klick). Rover: I aussetzen, **E** steuern (WASD, Q Foto,
F Probe, E/Esc zurück), **X** einpacken. Tiefseesonde über I am Ufer.
Einstellungen (Hauptmenü und Pause): Presets Niedrig–Ultra, Auflösung, Render-Skalierung, Schatten, Vegetation, Sichtweite,
Postprocessing, MSAA, FPS-Limit, Vollbild, adaptive Qualität, Lautstärken, Tutorial, Tastenbelegung (Umbelegung).
**F1** Tutorial überspringen, **F5** Schnellspeichern (Slot 1); Spielstände (5 Slots, Export/Import als JSON) im Hauptmenü und in
der Pause. Kompass im HUD (Schiff ▲, Unterkunft ⌂, Rover ●).
Debug auf der Oberfläche: **T** Zeitraffer (halten), **Y** Wetter wechseln, **G** Flugmodus.
Konsole: `__stellar.scenes.active.setTimeOfDay(0.5)` / `.forceWeather('rain', true)` / `.spawnNearby(8)` / `.takePhoto()` / `.archive` /
`.harvestNow()` / `.placeModule('workbench', x, z)` / `.playerState.inventory.add('ferrite', 20)` / `.debugLaunch()` in der Planetenszene.

## Konventionen

- TypeScript strict, ESM, Pfad-Alias `@/` → `src/`. Keine `any`.
- **Kein `Math.random()`** – nur `Random` aus `src/math/Random.ts`. Teilgeneratoren bekommen `rng.fork('label')`.
- `src/gen/**` und `src/math/**` sind reine Datenmodule: kein Three.js, kein DOM (müssen in Vitest/Node laufen).
- Jede Szene/UI-Komponente räumt in `dispose()` alles auf (Geometrien, Materialien, Texturen, DOM, Listener).
- Keine Allokationen im Render-Loop; Vektoren/Arrays vorab anlegen und wiederverwenden.
- UI-Texte Deutsch, zentral in `src/ui/strings.ts`. Spielwerte physikalisch (Kelvin, AU, km, g).
- Entscheidungen mit Tragweite in `docs/DECISIONS.md` eintragen (D-xxx). Balancing-Annahmen in `docs/BALANCING.md`.
- Gelände: neue Reliefformen als Schicht in `gen/terrain/Landforms.ts` mit Amplitude in Metern und plausiblem Verhältnis von Höhe zu Breite ergänzen und im Rezept des Bioms eintragen, kein Rauschen direkt in `TerrainModel`. Die Tests zu Hangneigung und Höhenband müssen grün bleiben.
- Charakter: Änderungen am Körper im Käfig (`BodyCage.ts`) über Ringe und Kantenschleifen vornehmen, keine Einzelteile aufsetzen. Das Netz muss geschlossen, einteilig und ein reines Quad-Netz bleiben (Tests in `BodyCage.test.ts`).
- Neue Formen aus `world/organic.ts` und `geometry.ts` (`blade`, `gradientColor`) bauen, nicht aus rohen Kugeln/Zylindern; Shader-Erweiterungen nur über `addShaderPatch`.
- Feste Objekte, die neu in die Welt kommen, melden einen Zylinder an `CollisionWorld` (Gruppe je Zelle bzw. System) und wieder ab; Objekte ab Kniehöhe werfen Schatten.
- Oberflächen: gemeinsame Bausteine aus `styles.css` (`.panel`, `button`, `h2`/`h3`, `.badge`, `.progress`) und Farben nur über `--accent`/`--hud-*`, keine festen Akzentfarben oder runden Ecken.
- HUD: Texte nur bei Änderung schreiben (`setText`), keine DOM-Neuaufbauten pro Frame; Farben über `--hud-accent`. Dialoge, die Klicks brauchen, müssen den Mauszeiger freigeben und in `uiOpen` zählen (siehe Foto-Auswertung).
- Vollflächige UI-Overlays ohne Klickfläche in die `#ui-root > …`-Liste in `styles.css` eintragen (sonst blockieren sie Canvas-Klicks).
- Commits: aussagekräftig, eine Phase/ein Feature pro Commit. Vor jedem Commit `npm run check` und `npm run build`.

## Phasen-Checkliste

- [x] **Phase 0 Setup:** Vite, TS, Three.js, ESLint, Vitest, Ordnerstruktur, CLAUDE.md, ARCHITECTURE.md, DECISIONS.md, GameLoop, Input, SceneManager, Debug-Overlay (FPS, Seed)
- [x] **Phase 1 Universum-Generator:** Seed/PRNG, Sonnentypen, 3–10 Planeten, Planetenwerte, Archiv-Generator (400–600 Einträge), Startplanet-Garantie, Treibstoff-Formel, Unit-Tests, 3D-Systemansicht + Daten-Dump
- [x] **Phase 2 Planetenoberfläche:** Chunk-Terrain, Biome, Himmel, Tag/Nacht, Wetter-Basis, Spieler-Controller, Wasser, Vegetation (Instancing)
- [x] **Phase 3 Kreaturen und Flora:** prozedurale Tiere/Pflanzen aus Familien, Verhalten (FSM), Spawn nach Bedingungen, Seltenheit
- [x] **Phase 4 Kamera und Katalog:** Foto-Modus, Bewertung, Archiv-UI, Fotospeicherung (IndexedDB), Hinweissystem, Mikroskop, Proben
- [x] **Phase 5 Überleben, Rohstoffe, Basis:** Sauerstoff/Energie, Sammeln, Crafting, Labor, Treibstoff-Synthese-Minispiel
- [x] **Phase 6 Schiffbau und Raumflug:** Baueditor, Upgrades, Start/Orbit/Landung, Treibstoffverbrauch
- [x] **Phase 7 Sonden, Satelliten, Karte:** Satellit, Rover, Spezialsonden, Karten-Layer, Hotspots, Fog of War
- [x] **Phase 8 Charaktererstellung:** Editor mit Live-Vorschau, Hintergründe/Boni, Presets
- [x] **Phase 9 Grafik und Einstellungen:** 720p–4K, Render-Skalierung, Presets, Postprocessing, adaptive Qualität
- [x] **Phase 10 Politur:** Tutorial, Audio, Speichern/Laden/Export, Tastenbelegung, Kompass, Balancing, Bugfixing, README

## Wichtige Dateien

- `src/main.ts` – Bootstrap
- `src/gen/index.ts` – `generateUniverse(seed)` (Einstieg in alle Generatoren)
- `src/gen/universe/System.ts` – Stern + Planeten + Startplanet + Treibstoff
- `src/gen/archive/ArchiveGenerator.ts` – Budget, Familien, Einträge
- `src/scenes/SystemViewScene.ts` – 3D-Debug-Ansicht des Systems
- `src/scenes/PlanetScene.ts` – Planetenoberfläche (verdrahtet world/*)
- `src/gen/terrain/TerrainModel.ts` – Höhenfeld/Biome (rein, testbar): Großrelief + `Landforms.ts` (Krater, Dünen, Vulkane, Canyons … als Rezept je Biom, ARCHITECTURE 4.16)
- `src/world/terrain/TerrainManager.ts` – Quadtree-LOD-Chunks
- `src/world/creatures/CreatureManager.ts` – Spawner, `CreatureBuilder.ts` – Genom → Mesh, `CreatureAI.ts` – Verhalten
- `src/world/flora/FloraBuilder.ts` – Genom → Pflanzen-Geometrie, `src/world/Vegetation.ts` – Zellen/Batches
- `src/gen/archive/conditions.ts` – Spawn-Bedingungen zur Laufzeit (rein)
- `src/game/PlayerState.ts` – Inventar, Überleben, Module, Labor-Stufe, Respawn (rein, IndexedDB `player:<seed>`)
- `src/game/crafting/recipes.ts` – Rezepte/Module, `fuel.ts` – Synthese; `src/game/survival/Survival.ts` – Sauerstoff/Energie
- `src/world/resources/ResourceNodeManager.ts` – Rohstoffknoten, `src/world/base/BaseModules.ts` – Basis-Module + Bau-Geist
- `src/ui/InventoryUi.ts` (Inventar/Werkbank), `src/ui/LabUi.ts` (Treibstoff-Synthese)
- `src/game/ship/{parts,ShipDesign,travel,blueprints}.ts` – Schiffsteile, Entwurf/Werte, Reisekosten, Baupläne (rein)
- `src/scenes/ShipEditorScene.ts` – Werft, `src/scenes/SpaceScene.ts` – Orbit/Transfer/Landung, `src/world/ship/*` – Schiffsmesh/-aktor
- `src/game/map/{MapGrid,hotspots}.ts` – Fog of War, Katalog-Lücken (rein); `src/ui/MapUi.ts` – Karte; `src/world/probes/*` – Rover, Bojen
- `src/game/character/{Character,backgrounds}.ts` – Charakter-Konfiguration, Share-Code, Presets, Hintergrund-Boni (rein);
  `src/world/character/{QuadMesh,BodyCage,CharacterBuilder}.ts` – Avatar als ein geschlossenes Quad-Netz (Käfig + Catmull-Clark,
  Skelett, Zonen; ARCHITECTURE 4.17); `src/scenes/CharacterScene.ts` + `src/ui/CharacterUi.ts` – Editor
- `src/game/settings/{Settings,SettingsManager,Keybindings}.ts` – Einstellungen (Presets, Lautstärken, adaptive Qualität, Tastenbelegung); `src/ui/SettingsUi.ts`
- `src/save/{SaveBundle,SaveManager}.ts` – Spielstand-Bundle (rein, Migration), Slots/Export/Import; `src/ui/SaveUi.ts`; `src/scenes/startGame.ts`
- `src/game/tutorial/Tutorial.ts` – Tutorial-Schritte (rein); `src/audio/{AudioManager,ambientMix}.ts` – prozedurales Audio
- `src/gen/archive/pacing.ts` – Spielzeit-Schätzung (Balancing-Test), `docs/BALANCING.md`
- `src/game/progress/ArchiveProgress.ts` – Fortschritt (rein), `src/game/photo/PhotoScoring.ts` – Bewertung (rein)
- `src/world/photo/PhotoMode.ts` – Foto-Modus, `src/ui/ArchiveUi.ts` – Enzyklopädie, `src/save/Db.ts` – IndexedDB
- `src/world/Collision.ts` – Kollisionswelt (Zylinder je Gruppe, Raster; rein): Bäume, Felsen, Knoten, Fundstücke, Module, Schiff, Rover
- `src/ui/theme.ts` – Akzentfarbe der gesamten Oberfläche (vom Anzug, gemerkt für Menüs)
- `src/ui/Hud.ts` + `src/ui/hud.css` – HUD (vier Ecken, Akzentfarbe vom Anzug), Foto-Sucher und Auswertungskarte (`PhotoUi.ts`), Benachrichtigungen (ARCHITECTURE 4.18)
- `src/render/{ProceduralTextures,Environment,stylize}.ts` – Detailtexturen-Bank, PMREM-Umgebungslicht, Stil (Kantenlicht, Paletten, Shader-Patches)
- `src/world/organic.ts` – organische Grundformen (Röhre, Klumpen, Rotationskörper, Prisma, Kristall) für Flora, Kreaturen, Knoten, Technik (ARCHITECTURE 4.13–4.15)
- `src/gen/terrain/PlanetStyle.ts` – Farbstil je Planet (Zweitfarben, Zonen, Grasspitzen, Signaturpflanzen; rein), über `model.style` erreichbar
- `src/world/Sky.ts` – Himmelskuppel (Wolken, Sonne, Sternenband), Himmelskörper mit eigenem Shader; `src/render/MoonTexture.ts` – Mondoberfläche (rein)
- `src/core/GameLoop.ts`, `src/core/SceneManager.ts`, `src/core/Input.ts`
