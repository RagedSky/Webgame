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
Ladestation laden auf, bei 0 folgt ein Zusammenbruch mit Rückkehr zur Unterkunft (10 % Rohstoffverlust). Fotos, Fortschritt und
Spielerzustand liegen in IndexedDB des Browsers. Debug: F3 Overlay, T Zeitraffer, Y Wetter, G Flugmodus.

Architektur: `docs/ARCHITECTURE.md` · Entscheidungen: `docs/DECISIONS.md` · Arbeitskontext: `CLAUDE.md`.

Das frühere Spiel „Aetherfall: Dungeons“ liegt unverändert unter `legacy/aetherfall/`.
