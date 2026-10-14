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

## D-021 · Kreaturen als Single-Bone-Skinning statt Mesh-Gruppen
**Kontext:** Eine Kreatur aus 10–20 Einzelmeshes kostet ebenso viele Draw-Calls; 25 Kreaturen wären 400+ Draw-Calls.
**Entscheidung:** Alle Körperteile werden zu einer Geometrie mit `skinIndex`/`skinWeight` (je Vertex genau ein Knochen) verschmolzen und als
SkinnedMesh gezeichnet (ein Draw-Call). Die Animation dreht nur Knochen (CPU, keine Allokationen). Geometrie und Material werden je Art gecacht,
jedes Tier hat ein eigenes Skelett.

## D-022 · Arten-Flora per BatchedMesh je Zelle und Material
**Entscheidung:** Statt InstancedMesh je Art (hunderte Draw-Calls) werden alle Arten einer Zelle in einem BatchedMesh gezeichnet (Multi-Draw,
Farben pro Instanz). Generisches Gras und Steine bleiben InstancedMesh. Der Wind-Shader unterstützt beide Pfade (`USE_INSTANCING`/`USE_BATCHING`).

## D-023 · Spawn-Regeln für Kreaturen
**Entscheidung:** Spawn-Versuche alle 1,5 s in 45–170 m Entfernung, zu 65 % hinter dem Spieler. Kandidaten = Einträge des Bioms, deren
Bedingungen (Zeit, Wetter, Höhe, Temperatur ± Toleranz, Spezial) erfüllt sind; Gewicht = Seltenheit (1 / 0,45 / 0,16 / 0,05) geteilt durch
(1 + bereits vorhandene Exemplare). Gruppen: Schwärme 3–6, Herden 1–4, sonst 1–2. Population max. 26, Abbau ab 240 m.
Legendäre Spezialbedingungen (Sonnenwende, Finsternis, nach Sturm) werden geprüft; die Sonnenwende folgt in Phase 4 mit dem Kalender.

## D-024 · Dichte der Arten-Flora je Wuchsform normiert
**Kontext:** Ozeanwelten mit 100 Flora-Arten bekamen dreimal so viele Pflanzen wie Welten mit 30 Arten (1,2 Mio. Dreiecke).
**Entscheidung:** Je Wuchsform ist die Gesamtdichte konstant; Arten teilen sie proportional zu ihrem Seltenheitsgewicht.

## D-025 · Fotos als JPEG + Thumbnail in IndexedDB, PNG nur beim Export
**Kontext:** Hunderte Fotos in voller Auflösung als PNG würden schnell Gigabytes belegen.
**Entscheidung:** Archiv-Fotos werden als JPEG (Qualität 0,9) plus 480-px-Thumbnail gespeichert. Der PNG-Export des gerade geschossenen Fotos
nutzt das verlustfreie Canvas-Bild aus demselben Frame; ältere Fotos werden beim Export aus dem JPEG in PNG gewandelt.

## D-026 · Bewertung als gewichtete Summe mit Identifikationsschwelle
**Entscheidung:** 0–100 Punkte aus Ausschnitt, Komposition, Fokus, Licht, Sichtbarkeit (+8 Verhalten, −12 Belichtung, bis −18 Bewegung).
Identifiziert ab 25 Punkten, ≥ 5 % Bildhöhe und < 60 % Verdeckung; Sterne bei 25/60/85. Nebenmotive −15. Toleranz-Parameter für den
Fotograf-Hintergrund (Phase 8) weitet Fokus- und Kompositionsfenster.

## D-027 · Proben statt Labor in Phase 4
**Entscheidung:** Erze/Gesteine werden an Props beprobt und sofort im Archiv analysiert (Reinheit/Struktur/Spuren deterministisch aus dem
Proben-Seed). Mikroorganismen erfordern das Mikroskop mit Fokus-Minispiel. Phase 5 verlegt die Analyse in die Laborstation und erweitert sie
(Labor-Upgrades erhöhen Qualität).

## D-028 · Unbekannte Einträge sind sichtbar, aber nummeriert
**Entscheidung:** Das Archiv zeigt alle Einträge als Platzhalter („Unbekannt · Erze #3“) mit Planet und Kategorie, damit die Lücken spürbar sind;
Biome, Bedingungen und Seltenheit werden erst durch Hinweise oder Entdeckung sichtbar.

## D-029 · Überleben entspannt: Sauerstoff situativ, Energie als sanfter Takt
**Kontext:** Die Säule „Entdecken und Fotografieren“ soll nicht von Überlebensdruck erstickt werden.
**Entscheidung:** Sauerstoff sinkt nur in nicht atembarer Atmosphäre (8 min) oder unter Wasser (60 s) und erholt sich an Luft binnen
10 s; Energie sinkt immer, aber langsam (15 min, Sprint/Kälte/Hitze/Strahlung beschleunigen). Zellen werden bei 10 % automatisch
eingesetzt. Zusammenbruch kostet 10 % der Rohstoffe und versetzt zur Unterkunft – kein Permadeath, kein Verlust von Archiv oder Fotos.

## D-030 · Alle Rezepte nur aus garantierten Startrohstoffen
**Kontext:** Der Startplanet garantiert Ferrit, Quarz, Wasser und Faser (`LAUNCH_RESOURCES`); andere Rohstoffe sind seedabhängig.
**Entscheidung:** Werkbank, Unterkunft, Ladestation, Labor, Zellen, Köder und Labor-Upgrades kosten ausschließlich diese vier
Rohstoffe. Ein Test prüft, dass `recipeResourceIds()` eine Teilmenge der garantierten Rohstoffe ist. Treibstoff-Komponenten sind
dagegen bewusst seedabhängig (≥ 2 Rollen sind auf dem Startplaneten garantiert, D-010).

## D-031 · Rohstoffknoten statt Abbau an Archiv-Props
**Kontext:** Erz-/Gestein-Props sind Archiv-Einträge (Proben → Sterne); Abbau würde die Katalog-Objekte verbrauchen.
**Entscheidung:** Rohstoffe erscheinen als eigene Knoten je 128-m-Zelle (deterministisch aus Vorkommen × Biom), mit Restmenge und
Respawn nach 10 Minuten; Proben an Archiv-Props bleiben unberührt. Flüssigkeiten werden am Ufer, organische Stoffe an Pflanzen
gesammelt. Treffererkennung: Raycast plus Kegel-Fallback, damit dünne Kristalle, Büschel und Tischplatten zuverlässig anvisierbar sind.

## D-032 · Spielerzustand getrennt vom Archiv-Fortschritt
**Entscheidung:** `PlayerState` (Inventar, Überleben, Module, Labor-Stufe, Respawn, Zielschritt) wird als `kv['player:<seed>']`
gespeichert, `ArchiveProgress` weiterhin unter `progress`. Beide haben eigene Versionen und Migrationen; der Export in Phase 10 fasst
sie zusammen. Vorteil: Archiv-Snapshots bleiben klein und unabhängig vom Basisbau; Tests der reinen Module brauchen kein Three.js.

## D-033 · Treibstoff-Synthese als Analyse-Schleife mit Labor-Stufen
**Kontext:** Die Formel ist je Seed geheim (D-010); der Spieler soll sie erforschen, nicht raten.
**Entscheidung:** Testmischungen kosten 1 Einheit je Komponente und liefern Reinheit (richtige Komponenten), Energiedichte und
Stabilität (Verhältnis). Stufe 1 zeigt nur Zahlen, Stufe 2 die Hinweise aus `analyzeMix`, Stufe 3 Rollen-Hinweise (welche Komponente
nicht reagiert, welche Rolle fehlt). Synthese unter 60 % Qualität verpufft (Rohstoffe weg), darüber Ausbeute 4 × Chargen × Stufe ×
Qualität. Rohstoffe mit Treibstoff-Rolle sind im Inventar markiert – die Suche nach der Formel bleibt Teil des Entdeckens.

## D-034 · Ein Rumpf mit Sockeln statt freiem Baukasten
**Kontext:** Ein freier Snap-Editor mit beliebigen Verbindungen braucht Kollisions- und Stabilitätsprüfung und verleitet zu unspielbaren
Konstruktionen.
**Entscheidung:** Der Entwurf hat genau einen Rumpf; dessen Stufe bestimmt die Sockel (oben Kanzel, unten Triebwerke, Beinhalterungen,
seitliche Anbauten). Jede Teileart passt an genau eine Sockelart. Rumpfwechsel übernimmt Teile, für die ein freier Sockel gleicher Art
existiert. Live-Werte und Validierung bleiben reine Funktionen (`ShipDesign.ts`), der 3D-Editor zeigt nur Sockel und Teile.

## D-035 · Baupläne aus Ruinen und Meilensteinen in fester Seed-Reihenfolge
**Kontext:** Höhere Stufen sollen durch Erkunden freigeschaltet werden, nicht durch Rohstoffmengen allein.
**Entscheidung:** Stufe-2/3-Teile brauchen Baupläne. Jede erstmals gescannte Ruine und jeder Archiv-Meilenstein (10–60 %) schaltet den
nächsten Plan der seed-festen Reihenfolge frei (Stufe 2 vor 3, zuerst Triebwerk II oder Schild I). So bleibt der Fortschritt planbar und
Rückkehr mit besserem Schiff lohnt sich. Test: jeder Startplanet hat Ruinen oder einen Stufe-1-Nachbarn.

## D-036 · Treibstoffmodell mit Start, Transfer und Landung; nie stranden
**Entscheidung:** Kosten hängen von Masse, Schwerkraft, Distanz (AU) und Triebwerkseffizienz ab (Formeln in `travel.ts`). Ein Start
verlangt Treibstoff für Start plus Rückkehr auf denselben Planeten. Wer im Orbit die Landekosten nicht mehr aufbringt, darf an Ort und
Stelle kostenlos landen – ein Softlock im Orbit ist ausgeschlossen. Stufe-1-Lander + 20 Treibstoff reichen auf jedem Startplaneten
(Test).

## D-037 · Ein PlayerState für alle Szenen
**Kontext:** Planet → Werft → Planet → Orbit wechselt Szenen schnell; Laden aus IndexedDB in jeder Szene lief dem asynchronen Speichern
der vorigen Szene davon (veralteter Zustand).
**Entscheidung:** `gameState.player` hält genau eine `PlayerState`-Instanz je Seed (`ensurePlayerState`); Szenen abonnieren Änderungen
und melden sich in `dispose()` ab. IndexedDB bleibt die Persistenz (debounced, bei Szenenwechsel sofort).

## D-038 · Start und Landung als kurze Außenkamera-Sequenzen
**Entscheidung:** Start: 3 s Countdown, 6 s Aufstieg, Ausblenden; Landung: 6,5 s Abstieg aus 160 m mit Einblenden. Die Kamera umkreist
das Schiff außen (kein Cockpit-Interieur in Phase 6). Spieler ist eingefroren, Überleben pausiert, Esc deaktiviert. Danach steht der
Spieler neben dem Schiff. Der Orbit ist stilisiert (feste Planetenpositionen, Transfer als Bogen), keine Orbitalmechanik.

## D-039 · Fog of War als 96×96-Zellraster mit drei Stufen
**Kontext:** Die Karte soll sich nur durch Erkundung und Scans füllen, der Spielstand aber klein bleiben.
**Entscheidung:** Je Planet ein `Uint8Array` mit 9216 Zellen (62–104 m Kante), Stufen 0/1/2 (unbekannt/erkundet/gescannt), nie
absteigend, Base64 im Spielstand. Spieler, Rover und Sonden decken Kreise auf; der Satellit setzt alles auf Stufe 2. Die Höhenkarte
selbst wird aus dem Terrain-Modell gerendert (keine zweite Datenquelle) und nur durch das Raster maskiert.

## D-040 · Karten-Layer an Satellit und Scanner-Stufe gebunden
**Entscheidung:** Ohne Satellit zeigt die Karte nur erkundete Zellen; Satellit Stufe 1 (ohne Scanner-Teil) liefert die Höhenkarte,
Stufe 2 (Tiefenscanner am Schiff beim Aussetzen) Biome, Rohstoffe und Lebenszeichen für den ganzen Planeten. So lohnt sich das
Scanner-Teil aus Phase 6, und die Karte bleibt ein Fortschrittsziel statt einer Komplettlösung.

## D-041 · Lebenszeichen = Katalog-Lücken je Biom
**Kontext:** Hotspots sollen zum Fotografieren leiten, ohne Positionen einzelner Tiere zu verraten (die spawnen dynamisch).
**Entscheidung:** Je Biom wird die Zahl unentdeckter Einträge gezählt und im Kartenblock (6×6) mit dem größten sichtbaren
Biomanteil als Kreis mit „fehlen N“ angezeigt (Schwerpunkte fielen in der Kartenmitte zusammen); die Seitenleiste listet alle Biome (unbekannte als „?“). Das ist ehrlich zur Spawn-Logik (Biom als Hauptbedingung)
und motiviert zielgerichtete Erkundung.

## D-042 · Rover als Fernsteuerung des bestehenden Foto-/Proben-Systems
**Entscheidung:** Der Rover ist ein eigener Fahrkörper, aber Kamera (Foto-Modus vom Mast, −20 % Bewertung) und Interaktion (F)
nutzen dieselben Routinen wie der Spieler mit anderem Augpunkt. Signalreichweite 900 m, kein Sauerstoffverbrauch des Rovers; der
Spieler bleibt eingefroren und sollte an Unterkunft oder Schiff stehen. Rover-Fotos können so Gefahrenzonen abdecken, ohne die
Kernschleife zu doppeln.
