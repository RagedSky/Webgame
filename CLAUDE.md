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

Im Spiel: **F3** Debug-Overlay, **Esc** Pause/zurück. Oberfläche: WASD, Maus, Leertaste, Shift, Strg, **V** Ansicht.
Debug auf der Oberfläche: **T** Zeitraffer (halten), **Y** Wetter wechseln, **G** Flugmodus.
Konsole: `__stellar.scenes.active.setTimeOfDay(0.5)` / `.forceWeather('rain', true)` in der Planetenszene.

## Konventionen

- TypeScript strict, ESM, Pfad-Alias `@/` → `src/`. Keine `any`.
- **Kein `Math.random()`** – nur `Random` aus `src/math/Random.ts`. Teilgeneratoren bekommen `rng.fork('label')`.
- `src/gen/**` und `src/math/**` sind reine Datenmodule: kein Three.js, kein DOM (müssen in Vitest/Node laufen).
- Jede Szene/UI-Komponente räumt in `dispose()` alles auf (Geometrien, Materialien, Texturen, DOM, Listener).
- Keine Allokationen im Render-Loop; Vektoren/Arrays vorab anlegen und wiederverwenden.
- UI-Texte Deutsch, zentral in `src/ui/strings.ts`. Spielwerte physikalisch (Kelvin, AU, km, g).
- Entscheidungen mit Tragweite in `docs/DECISIONS.md` eintragen (D-xxx).
- Commits: aussagekräftig, eine Phase/ein Feature pro Commit. Vor jedem Commit `npm run check` und `npm run build`.

## Phasen-Checkliste

- [x] **Phase 0 Setup:** Vite, TS, Three.js, ESLint, Vitest, Ordnerstruktur, CLAUDE.md, ARCHITECTURE.md, DECISIONS.md, GameLoop, Input, SceneManager, Debug-Overlay (FPS, Seed)
- [x] **Phase 1 Universum-Generator:** Seed/PRNG, Sonnentypen, 3–10 Planeten, Planetenwerte, Archiv-Generator (400–600 Einträge), Startplanet-Garantie, Treibstoff-Formel, Unit-Tests, 3D-Systemansicht + Daten-Dump
- [x] **Phase 2 Planetenoberfläche:** Chunk-Terrain, Biome, Himmel, Tag/Nacht, Wetter-Basis, Spieler-Controller, Wasser, Vegetation (Instancing)
- [ ] **Phase 3 Kreaturen und Flora:** prozedurale Tiere/Pflanzen aus Familien, Verhalten (FSM), Spawn nach Bedingungen, Seltenheit
- [ ] **Phase 4 Kamera und Katalog:** Foto-Modus, Bewertung, Archiv-UI, Fotospeicherung (IndexedDB), Hinweissystem, Mikroskop, Proben
- [ ] **Phase 5 Überleben, Rohstoffe, Basis:** Sauerstoff/Energie, Sammeln, Crafting, Labor, Treibstoff-Synthese-Minispiel
- [ ] **Phase 6 Schiffbau und Raumflug:** Baueditor, Upgrades, Start/Orbit/Landung, Treibstoffverbrauch
- [ ] **Phase 7 Sonden, Satelliten, Karte:** Satellit, Rover, Spezialsonden, Karten-Layer, Hotspots, Fog of War
- [ ] **Phase 8 Charaktererstellung:** Editor mit Live-Vorschau, Hintergründe/Boni, Presets
- [ ] **Phase 9 Grafik und Einstellungen:** 720p–4K, Render-Skalierung, Presets, Postprocessing, adaptive Qualität
- [ ] **Phase 10 Politur:** Tutorial, Audio, Speichern/Laden/Export, Balancing, Bugfixing, README

## Wichtige Dateien

- `src/main.ts` – Bootstrap
- `src/gen/index.ts` – `generateUniverse(seed)` (Einstieg in alle Generatoren)
- `src/gen/universe/System.ts` – Stern + Planeten + Startplanet + Treibstoff
- `src/gen/archive/ArchiveGenerator.ts` – Budget, Familien, Einträge
- `src/scenes/SystemViewScene.ts` – 3D-Debug-Ansicht des Systems
- `src/scenes/PlanetScene.ts` – Planetenoberfläche (verdrahtet world/*)
- `src/gen/terrain/TerrainModel.ts` – Höhenfeld/Biome (rein, testbar)
- `src/world/terrain/TerrainManager.ts` – Quadtree-LOD-Chunks
- `src/core/GameLoop.ts`, `src/core/SceneManager.ts`, `src/core/Input.ts`
