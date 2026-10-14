# Stellar Archive

Ein 3D-Entdecker-Spiel im Browser: Stranden, Raumschiff bauen, Treibstoff synthetisieren und ein Archiv mit
400–600 prozedural erzeugten Einträgen pro Sternsystem fotografisch füllen.

Three.js · TypeScript · Vite · vollständig statisch, keine Serverpflicht.

## Starten

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # Typecheck + Build → dist/
npm run preview    # dist/ lokal testen
npm test           # Generator-Tests
```

Im Hauptmenü einen Seed eingeben oder „Zufälliges Universum“ wählen. „Neues Spiel“ landet auf dem Startplaneten,
„System anzeigen“ öffnet die 3D-Übersicht des Sternsystems (dort „Hier landen“ für jeden Planeten mit Oberfläche).

Steuerung auf der Oberfläche: Klick übernimmt die Maus, WASD bewegen, Leertaste springen, Shift sprinten, Strg ducken,
V Ego/Schulter, Esc Pause. **Q** öffnet den Foto-Modus (Mausrad Zoom, `,`/`.` Fokus, Rechtsklick Autofokus, R Blende,
1/2 Belichtung, F Filter, H Raster, C Selfie, Leertaste/Klick auslösen). **Tab** öffnet das Archiv mit Logbuch, Proben und
Mikroskop, **F** nimmt Proben (Wasser, Boden, Pflanzen, Gestein) oder scannt Fossilien.

Überleben und Basis: **E halten** baut Rohstoffknoten ab (Brocken, Kristalle, Quellen, Büschel), sammelt Wasser am Ufer und
Fasern/Harz/Sporen an Pflanzen. **I** öffnet Inventar und Feldfertigung (Werkbank, Unterkunft), **B** den Bau-Modus
(1–4 Modul, R drehen, Klick platzieren, X entfernen). **E** an der Werkbank fertigt Ladestation, Labor, Zellen, Köder und
Labor-Upgrades; **E** am Labor öffnet die Treibstoff-Synthese (Mischung aus 2–3 Rohstoffen mit Treibstoff-Rolle analysieren und
synthetisieren, Ziel 20 Treibstoff). Sauerstoff sinkt in nicht atembarer Luft und unter Wasser, Energie langsam immer; Unterkunft und
Ladestation laden auf, bei 0 folgt ein Zusammenbruch mit Rückkehr zur Unterkunft (10 % Rohstoffverlust).

Schiff und Raumflug: Der beschädigte Lander steht nahe dem Landeplatz. **E** am Schiff öffnet das Schiffspanel mit Werten,
Betanken, Werft und Start. In der Werft (3D-Editor) wählst du ein Teil und klickst einen passenden Sockel an: Triebwerk, Tank und
drei Landebeine machen den Lander startklar; bessere Teile (Stufe 2/3) brauchen Baupläne aus gescannten Ruinen und
Archiv-Meilensteinen. Der Start braucht Treibstoff für Start und Rückkehr. Im Orbit zeigt die Liste alle Planeten mit
Transfer- und Landekosten sowie den nötigen Triebwerks- und Schildstufen; „Fliegen“ wechselt den Orbit, „Landen“ spielt die
Landesequenz.

Karte und Sonden: **M** öffnet die Karte des Planeten mit Fog of War, die sich durch Erkunden füllt. Ein an der Werkbank gebauter
Orbital-Satellit (im Orbit aussetzen) liefert die Höhenkarte, mit Tiefenscanner am Schiff auch Biom-, Rohstoff- und
Lebenszeichen-Layer, die Katalog-Lücken je Biom zeigen („fehlen 7“). Klick setzt Marker. Der Rover wird über das Inventar
ausgesetzt und mit **E** ferngesteuert (WASD, Fotos mit Q, Proben mit F, Reichweite 900 m), **X** packt ihn ein. Die Tiefseesonde
kartiert am Ufer ein Gewässer und liefert Hinweise und eine Tiefenprobe, die Atmosphärensonde erfasst aus dem Orbit die
Phänomene eines Gasriesen.

Charakter: Vor dem ersten Spiel eines Seeds öffnet sich der Charakter-Editor mit Live-3D-Vorschau (Körper, Gesicht, Haare,
Anzug mit Farben, Mustern und Abzeichen, Helm). Der Hintergrund bringt einen kleinen Spielstil-Bonus: Biologe (mehr Hinweise,
weitere Sichtungen), Geologin (bessere Scans und Analysen, mehr Abbau), Ingenieur (günstiger und schneller bauen), Fotografin
(großzügigere Bewertung, Infrarot- und Noir-Filter). Presets, Zufall mit Sperren, Share-Code und JSON-Export sind eingebaut;
„Charakter“ im Hauptmenü bearbeitet ihn später. Der Avatar ist in der Schulterperspektive (V) und im Selfie-Modus (C) sichtbar.
Fotos, Fortschritt und Spielerzustand liegen in IndexedDB des Browsers; „Neues Spiel“ setzt beim gespeicherten Schiff fort.
Debug: F3 Overlay, T Zeitraffer, Y Wetter, G Flugmodus.

Architektur: `docs/ARCHITECTURE.md` · Entscheidungen: `docs/DECISIONS.md` · Arbeitskontext: `CLAUDE.md`.

Das frühere Spiel „Aetherfall: Dungeons“ liegt unverändert unter `legacy/aetherfall/`.
