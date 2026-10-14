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
Mikroskop, **E** nimmt Proben (Wasser, Boden, Pflanzen, Gestein) oder scannt Fossilien. Fotos und Fortschritt liegen in
IndexedDB des Browsers. Debug: F3 Overlay, T Zeitraffer, Y Wetter, G Flugmodus.

Architektur: `docs/ARCHITECTURE.md` · Entscheidungen: `docs/DECISIONS.md` · Arbeitskontext: `CLAUDE.md`.

Das frühere Spiel „Aetherfall: Dungeons“ liegt unverändert unter `legacy/aetherfall/`.
