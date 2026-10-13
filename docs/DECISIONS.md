# Entscheidungs-Log

Kurze ADR-Einträge: Kontext → Entscheidung → Konsequenz. Neueste unten anhängen.

## D-001 · Altes Spiel nach `legacy/aetherfall/` verschoben
**Kontext:** Das Repo enthielt „Aetherfall: Dungeons“ als Einzeldatei `index.html` im Root. Vite braucht `index.html` im Root als Einstieg.
**Entscheidung:** `git mv` nach `legacy/aetherfall/` (inkl. README und Supabase-SQL). Nichts gelöscht, Historie bleibt erhalten; der Ordner ist von Build und Lint ausgeschlossen.
**Konsequenz:** Stellar Archive lebt im Projektroot, wie im Auftrag beschrieben.

## D-002 · PRNG: sfc32 + cyrb128, `fork(label)` statt globaler Sequenz
**Kontext:** Determinismus pro Seed ist Design-Säule. Ein einziger PRNG-Strom würde bei jeder Änderung an einem Teilgenerator alle nachfolgenden Werte verschieben.
**Entscheidung:** `Random.fork('planet:3')` leitet aus Seed-String + Label einen neuen, unabhängigen Strom ab. Jeder Teilgenerator bekommt seinen eigenen Fork.
**Konsequenz:** Stabilere Seeds über Versionen hinweg; Tests prüfen Determinismus.

## D-003 · `Math.random()` per ESLint und Test verboten
**Entscheidung:** `no-restricted-properties` für `Math.random` in `src/**`, zusätzlich ein Test, der `src/gen` und `src/math` nach dem Aufruf durchsucht. Der Button „Zufälliges Universum“ nutzt `crypto.getRandomValues`.

## D-004 · Generatoren ohne Three.js/DOM
**Entscheidung:** `src/gen/**` und `src/math/**` importieren weder Three.js noch DOM-APIs. Vitest läuft in Node.
**Konsequenz:** Schnelle, deterministische Tests; die 3D-Darstellung ist eine reine „View“ über den Daten.

## D-005 · UI als DOM-Overlay, Texte direkt auf Deutsch
**Entscheidung:** Kein UI-Framework. Spieltexte liegen zentral in `src/ui/strings.ts` (Deutsch), damit eine spätere Übersetzung nur eine Tabelle braucht. Generierte Namen sind sprachneutral (pseudo-lateinischer Artname) plus deutscher Trivialname.

## D-006 · TypeScript-Strenge
**Entscheidung:** `strict`, `noUnusedLocals/Parameters`, `noImplicitReturns`, `noImplicitOverride`. `noUncheckedIndexedAccess` bewusst aus (zu viel Reibung im generatorlastigen Code; Zugriffe laufen über geprüfte Helfer wie `pick`).

## D-007 · TypeScript 5.9 statt 7
**Kontext:** TypeScript 7 (Go-Port) ist aktuell, `typescript-eslint` unterstützt aber nur `< 6.1`.
**Entscheidung:** TS 5.9.x bis die Toolchain nachzieht.

## D-008 · Archiv-Verteilung mit Gewichten und Obergrenzen
**Entscheidung:** Jede Kategorie wird mit Largest-Remainder-Rundung auf Planeten verteilt; Gewicht = Planetentyp-Eignung × (0,5 + Biodiversität) × Größenfaktor; Startplanet ×1,5. Obergrenzen (z. B. Flora auf Gasriesen = 0, Wetter ≤ verfügbare Phänomene) verhindern unmögliche Einträge; Überschuss wandert zu anderen Planeten.

## D-009 · Seltenheitsverteilung 50/30/15/5
**Entscheidung:** common 50 %, uncommon 30 %, rare 15 %, legendary 5 %. Damit sind ca. 80 % der Einträge ohne Spezialbedingungen erreichbar (Ziel „Archiv versiegelt“ bei 80 %), die letzten 20 % tragen Spezialbedingungen (Nacht, Wetter, Höhle, Sonnenwende).

## D-010 · Treibstoff-Formel als Analyse-Rätsel
**Entscheidung:** Formel = 1 Energieträger + 1 Oxidator + optional 1 Stabilisator (alle auf dem Startplaneten vorhanden), Anteile in Zehnteln. `analyzeMix()` liefert Reinheit (richtige Komponenten), Energiedichte (Anteil Energieträger/Oxidator) und Stabilität (Stabilisator-Anteil) als stetige Werte 0–1, sodass die Lösung logisch eingegrenzt werden kann.

## D-011 · Darstellungsradien in der Systemansicht logarithmisch
**Entscheidung:** Orbits werden mit `10 + 14·log2(1 + AU/0,25)` skaliert, Planetenradien mit `log`-Skala, damit Rote-Riesen-Systeme und Blaue-Zwerg-Systeme beide lesbar bleiben. Rein visuell, Spielwerte bleiben physikalisch (AU, km).

## D-012 · Temperatur-Untergrenze 40 K und engere Orbitabstände
**Kontext:** Bei Blauen Zwergen mit 10 Planeten lagen äußere Welten bei < 30 K und > 150 AU.
**Entscheidung:** Planetenmittel nie unter 40 K (Restwärme); Orbitverhältnis 1,35–1,8 statt 1,4–1,9. Gasriesen mindestens 90 K.

## D-013 · Treibstoff-Qualität als Produkt, Reinheit zählt fehlende Komponenten
**Entscheidung:** `quality = purity × energyDensity × stability` (statt geometrisches Mittel), `purity` wird mit dem Anteil gefundener Komponenten multipliziert. Dadurch ist „nur ein richtiger Stoff“ messbar schlecht (< 0,5), die korrekte Mischung exakt 1,0.

## D-014 · Namen: deutsche Komposita + pseudo-lateinischer Artname
**Entscheidung:** Trivialname = Präfix (Biom/Farbe/Größe/Aktivität/Merkmal) + Grundwort je Fortbewegung/Wuchsform (z. B. „Nebelschleicher“), wissenschaftlicher Name = Gattung (Silbenwort, pro Familie) + Epitheton. Beide systemweit eindeutig (NameRegistry, römische Suffixe als letzter Ausweg). Silbengenerator mit Blockliste für unglückliche Zeichenfolgen.

## D-015 · Renderer-Statistik über den ganzen Frame
**Entscheidung:** `renderer.info.autoReset = false`; der Loop setzt die Zähler einmal pro Frame zurück, damit Draw-Calls bei Postprocessing (mehrere Passes) korrekt im Debug-Overlay stehen.

## D-016 · Planetenoberfläche als begrenzte, flache Karte
**Kontext:** Vollständig kugelförmige Planeten (Cube-Sphere, Krümmung, Gravitationsrichtung) kosten viel Komplexität ohne
Mehrwert für das Fotografieren/Katalogisieren.
**Entscheidung:** Jeder Planet ist eine quadratische Karte von 6–10 km Kantenlänge (abhängig vom Radius), zentriert um den Landeplatz,
mit weicher Weltgrenze. Satellitenkarte und Fog of War (Phase 7) beziehen sich auf diese Fläche.

## D-017 · Quadtree-LOD mit konstanter Segmentzahl und Skirts
**Entscheidung:** Alle Terrain-Zellen haben 32 Segmente; die Zellgröße (64–1024 m) bestimmt das Detail. Skirts statt Index-Stitching
verstecken LOD-Risse. Alte Zellen werden erst entfernt, wenn alle überlappenden neuen Zellen gebaut sind (keine Löcher).
Geometrie-Pool, weil alle Zellen gleich groß sind.

## D-018 · Wasserstand und Biom-Höhenbänder
**Entscheidung:** Wasserspiegel = 0,1 · maxHeight, sobald ein Biom `hasWater` hat. Biome ohne Wasser werden auf ≥ 0,125 angehoben, damit
Wasser nur in Wasser-Biomen auftritt (Ozeane, Küsten, Sümpfe, Oasen). Die `altitude`-Bänder aus dem Katalog bestimmen die Höhenlage
und bleiben damit konsistent mit den Spawn-Bedingungen der Archiv-Einträge.

## D-019 · Tageslänge und Zeitraffer
**Entscheidung:** Ein 24-Stunden-Planetentag dauert 20 Echtzeit-Minuten (skaliert mit `dayLengthHours`, mindestens 4 Minuten).
Debug-Tasten: T (Zeitraffer ×60), Y (Wetter wechseln), G (Flugmodus), V (Ego/Schulter). Später per Einstellung konfigurierbar.

## D-020 · Vegetation als Platzhalter-Instancing in zwei Zellgrößen
**Entscheidung:** Nahe Zellen (64 m, Radius 200 m) tragen Gras, Büsche, Steine; ferne Zellen (256 m, Radius 620 m) Bäume. Platzierung
deterministisch aus Terrain-Seed + Zelle. Phase 3 ersetzt die Platzhalter-Geometrien durch Arten aus dem Archiv (gleiche Zellen-Logik).
