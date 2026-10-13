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

Im Hauptmenü einen Seed eingeben oder „Zufälliges Universum“ wählen und „System anzeigen“ drücken.
**F3** blendet das Debug-Overlay ein.

Architektur: `docs/ARCHITECTURE.md` · Entscheidungen: `docs/DECISIONS.md` · Arbeitskontext: `CLAUDE.md`.

Das frühere Spiel „Aetherfall: Dungeons“ liegt unverändert unter `legacy/aetherfall/`.
