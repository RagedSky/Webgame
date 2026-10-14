# Stellar Archive

Ein 3D-Entdecker-Spiel im Browser: Stranden, Raumschiff bauen, Treibstoff synthetisieren und ein Archiv mit
400–600 prozedural erzeugten Einträgen pro Sternsystem fotografisch füllen. Jeder Seed ist eine eigene, reproduzierbare Welt.

Three.js · TypeScript · Vite · Web Audio · IndexedDB · vollständig statisch, keine Serverpflicht, keine fremden Assets.

## Starten

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # Typecheck + Build → dist/
npm run preview    # dist/ lokal testen (http://localhost:4173)
npm test           # Generator-, Spielstand-, Einstellungs- und Balancing-Tests (Vitest)
npm run check      # Typecheck + Lint + Tests
```

Voraussetzungen: Node 20 oder neuer, ein Browser mit WebGL 2 (Chrome, Edge, Firefox, Safari 16+). Audio startet nach dem ersten
Klick oder Tastendruck (Browser-Richtlinie).

## Deployment

Der Build ist rein statisch und nutzt relative Pfade (`base: './'`), er läuft also in jedem Unterordner.

```bash
npm run build
# dist/ auf einen beliebigen statischen Host kopieren
```

- **GitHub Pages**: `dist/` in den `gh-pages`-Branch oder in `docs/` des Repos legen (z. B. `npx gh-pages -d dist`).
  Dank relativer Pfade ist kein `--base=/repo/` nötig.
- **Netlify / Vercel / Cloudflare Pages**: Build-Befehl `npm run build`, Ausgabeordner `dist`.
- **Eigener Server (nginx, Apache, S3 + CDN)**: `dist/` ausliefern; keine Rewrites nötig (keine Client-Routen).
  Empfohlen: `Cache-Control: immutable` für `dist/assets/*` (Dateinamen tragen Hashes) und kurze Cache-Zeit für `index.html`.
- **Offline / lokal ohne Server**: `index.html` direkt aus dem Dateisystem öffnen funktioniert wegen ES-Modulen nicht;
  `npm run preview` oder ein beliebiger statischer Server (`npx serve dist`) genügt.

Spielstände, Fotos und Einstellungen liegen in der IndexedDB des Browsers (pro Origin). Für den Umzug auf ein anderes Gerät
gibt es den Datei-Export (siehe unten).

## Spielablauf in Kürze

1. **Hauptmenü**: Seed eingeben oder „Zufälliges Universum“. „Neues Spiel“ wird zu „Weiterspielen“, sobald ein Spielstand
   für den Seed existiert. Vor dem ersten Spiel öffnet sich der Charakter-Editor.
2. **Tutorial**: zwölf sanfte Schritte in den ersten Minuten (Umsehen, Bewegen, Kamera, Foto, Archiv, Probe, Rohstoffe,
   Inventar, Bauen, Karte, Lander). F1 überspringt, in den Einstellungen abschaltbar oder neu startbar.
3. **Kernschleife**: Lebewesen, Pflanzen, Gesteine, Fossilien, Wetter und Mikroorganismen fotografieren und beproben, Hinweise
   (Spuren, Rufe, Gerüchte) verfolgen, das Archiv füllen. 80 % versiegeln das Archiv, der Rest ist für Komplettisten.
4. **Überleben und Basis**: Sauerstoff und Energie im Blick behalten, Rohstoffe abbauen, Werkbank, Unterkunft, Ladestation und
   Labor bauen, im Labor die Treibstoff-Formel des Systems finden.
5. **Schiff und Reise**: den beschädigten Lander in der Werft reparieren, betanken, starten; im Orbit andere Planeten anfliegen,
   Satelliten und Atmosphärensonden aussetzen, landen. Ruinen und Archiv-Meilensteine liefern Baupläne für bessere Teile.

## Steuerung

| Bereich | Tasten |
| --- | --- |
| Bewegung | Klick ins Bild übernimmt die Maus · WASD · Leertaste springen · Shift sprinten · Strg ducken · V Ego/Schulter · Esc Pause |
| Kamera | Q Foto-Modus · Mausrad Zoom · `,`/`.` Fokus · Rechtsklick Autofokus · R Blende · 1/2 Belichtung · F Filter · H Raster · C Selfie · Leertaste/Klick auslösen |
| Archiv und Proben | Tab Archiv (Einträge, Logbuch, Proben, Mikroskop) · F Probe nehmen / scannen |
| Rohstoffe und Basis | E halten sammeln · I Inventar/Fertigung · B Bau-Modus (1–4 Modul, R drehen, Klick platzieren, X entfernen) · E an Modulen öffnen |
| Schiff | E am Schiff: Werft, Betanken, Start · im Orbit Planet wählen, Fliegen, Landen, Satellit/Atmosphärensonde |
| Karte und Sonden | M Karte (Layer, Marker per Klick) · Rover über Inventar aussetzen, E steuern (WASD, Q Foto, F Probe, E/Esc zurück), X einpacken · Tiefseesonde am Ufer |
| Spielstände | F5 Schnellspeichern (Slot 1) · Pause → Spielstände · F1 Tutorial überspringen |
| Debug | F3 Overlay · T Zeitraffer (halten) · Y Wetter · G Flugmodus |

Alle Tasten außer Esc, F3 und F12 lassen sich in den Einstellungen umbelegen.

## HUD

Oben Mitte das aktuelle Ziel und der Kompass (Schiff ▲, Unterkunft ⌂, Rover ●), links die Tutorial-Karte, rechts Planet, Biom,
Uhrzeit, Wetter und Temperatur, unten Sauerstoff und Energie, Interaktionshinweis und Position.

## Speichern, Laden, Export

- **Autosave**: entprellt bei jeder Änderung, zusätzlich alle zwei Minuten, bei Pause, Szenenwechsel und wenn der Tab in den
  Hintergrund geht.
- **Slots**: fünf manuelle Slots (Pause → Spielstände oder Hauptmenü → Spielstände), F5 schreibt Slot 1. Laden ersetzt den
  laufenden Spielstand des Seeds; Fotos bleiben erhalten.
- **Export/Import**: JSON-Datei mit Seed, Charakter, Inventar, Basis, Schiff, Sonden, Karten, Archiv-Status, optional allen Fotos
  und den Einstellungen. Import prüft und migriert ältere Versionen.

## Einstellungen

Qualitäts-Presets Niedrig, Mittel, Hoch, Ultra oder eigene Werte für interne Auflösung (720p bis 4K), Render-Skalierung,
Pixeldichte, Schatten, Vegetationsdichte, Sichtweite, Postprocessing, Anti-Aliasing, FPS-Limit, Vollbild, adaptive Qualität
(Vorschlag bei dauerhaft niedriger Bildrate), Lautstärken (Gesamt, Effekte, Umgebung, Musik), Tutorial und Tastenbelegung.
Alles gilt sofort und wird gespeichert.

## Audio

Alle Klänge entstehen prozedural (Web Audio): Ambient je Biom, Tageszeit und Wetter, Kreaturenrufe aus dem Genom der Art,
Schritte je Untergrund, Kamera-Auslöser, UI-Klänge, Start- und Landegrollen sowie eine zurückhaltende Akkordfläche als
Musik-Platzhalter mit Stimmung je Szene.

## Projekt

- Architektur: `docs/ARCHITECTURE.md`
- Entscheidungen: `docs/DECISIONS.md`
- Balancing und Pacing-Modell (50–80 h bis 80 %): `docs/BALANCING.md`
- Arbeitskontext für Sessions: `CLAUDE.md`

Das frühere Spiel „Aetherfall: Dungeons“ liegt unverändert unter `legacy/aetherfall/`.
