# Voxelgruft – Die Splitter der Glutkrone

Ein Action-Dungeon-Crawler mit RPG-Elementen im Voxel-Look – komplett in **einer einzigen Datei** (`index.html`).
HTML, CSS und JavaScript sind inline; Three.js (r128) wird per CDN von cdnjs geladen. Keine Build-Tools, keine externen Assets:
alle Modelle, Icons, Sounds und die Musik werden prozedural erzeugt.

## Starten

`index.html` im Browser öffnen (Internetverbindung für Three.js und die Pixel-Schriften nötig).

## Steuerung

| Taste | Aktion |
|---|---|
| W A S D | Bewegen |
| Maus | Zielrichtung |
| Linksklick (halten) | Nahkampf, 3er-Kombo |
| Rechtsklick / F | Bogen (Munition) |
| Leertaste | Ausweichrolle (kurz unverwundbar) |
| Q / E / R | Artefakte |
| H | Heiltrank |
| I | Inventar & Attribute |
| M | Karte |
| ESC | Pause |
| E (im Lager) | Mit Händlerin, Schmied oder Kartentisch interagieren |

Auf Touch-Geräten erscheinen ein virtueller Joystick und Aktionstasten (automatische Zielwahl).

## Inhalt

- **Lager:** Händlerin Mira (Ausrüstung, Glückstruhe, Köcher), Schmied Brom (Aufwerten bis +5, Neu verzaubern, Zerlegen), Kartentisch (Missionswahl), Übungspuppe.
- **3 Biome:** Moosruinen, Kristallschlund, Glutkessel – prozedural generiert aus Kampf-, Schatz-, Fallen-, Rätsel-, Mini-Boss- und Bossräumen.
- **Gegner:** Moderling (Nahkampf), Splitterschütze (Fernkampf), Zündling (explodiert), Klotzhauer (Brute), Runenweber (Beschwörer), Krabbler – alle mit sichtbar telegrafierten Angriffen; Elite-Varianten.
- **Bosse:** je Biom ein Mini-Boss (2 Phasen) und ein Endboss mit 3 Phasen und eigenen Mechaniken.
- **RPG:** Stufen & Attribute (Stärke, Leben, Tempo, Glück), Beute in 4 Seltenheiten, Verzauberungen, Edelsteine als Währung,
  Schwierigkeitsstufen Abenteuer → Heroisch → Albtraum.
- **Speichern:** automatisch per `localStorage` (läuft auch ohne Speicher weiter).
