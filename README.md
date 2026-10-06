# Voxelgruft – Die Splitter der Glutkrone

Ein Action-RPG im Voxel-Look mit offener Welt aus schwebenden Himmelsinseln – komplett in **einer einzigen Datei** (`index.html`).
HTML, CSS und JavaScript sind inline; Three.js (r128) wird per CDN von cdnjs geladen (Ersatz: jsDelivr). Keine Build-Tools, keine
externen Assets: Figuren, Gebäude, Icons, Porträts, Soundeffekte und die Musik werden prozedural per Code erzeugt.

## Starten

`index.html` im Browser öffnen (Internetverbindung für Three.js und die Pixel-Schriften nötig).

## Steuerung

| Taste | Aktion |
|---|---|
| W A S D | Bewegen |
| Maus | Zielrichtung |
| Linksklick (halten) | Nahkampf-Kombo der Waffe |
| ⇧ / C | Spezialangriff der Waffe |
| Rechtsklick / F | Fernkampfwaffe (Munition) |
| 1 2 3 4 | Zauber der Hotbar (Mana) |
| Leertaste | Ausweichrolle |
| Q / E / R | Artefakte |
| H | Heiltrank |
| E | Mit Personen sprechen / Wegsteine & Rätsel benutzen |
| I · K · J · M | Inventar · Zauber & Talente · Quest-Log · Weltkarte |
| T | Rätsel-Hinweis (mehrstufig) |
| ESC | Pause, Einstellungen |

Auf Touch-Geräten erscheinen ein virtueller Joystick, Aktions- und Zaubertasten (automatische Zielwahl).

## Inhalt

- **Charakter-Creator:** Geschlecht, Haut, je 8 Frisuren, Haar- und Augenfarbe, Gesicht, Bart, Narben & Tattoos, Kleidung und Farbe,
  Name, Zufallsknopf, drehbare Live-Vorschau. Klassen: Krieger, Magier, Waldläufer, Schurke. Aussehen später bei Schneiderin Nell änderbar.
- **Welt:** 9 Regionen (Ehbergten, Duskwood Thicket, Toxic Wastelands, Cinder Wastes, The Void Rift, Undead Caverns, Mount Aelen,
  Nightmaw's Den, The Astral Nexus), verbunden durch Brücken, freigeschaltet über die Geschichte, mit eigener Musik, eigenem Wetter
  und Tag-/Nachtzyklus. 12 Dungeons inklusive Void Arena (Wellen) und Finale im Central Nexus.
- **Kampf:** 13 Waffentypen (u. a. Zweihandschwert, Kriegshammer, Doppeldolche, Hellebarde, Armbrust, Kampfstab) mit eigenen Kombos,
  Animationen, Klängen und Spezialangriffen; 14 legendäre Unikate von Bossen und Quests.
- **Magie:** 16 Zauber in 4 Schulen (Feuer, Frost, Blitz & Arkan, Void & Schatten), Ränge, Runen-Mod-Slots, Talentbäume je Klasse,
  Element-Kombos (z. B. Frost + Blitz = Schockfrost, Gift + Feuer = Giftexplosion).
- **Quests:** 43 Quests – Hauptgeschichte (Prolog, sieben Akte, Finale) mit Wendung, Nebenquests, Kopfgelder, Sammel- und
  Eskortaufträge sowie tägliche Aufträge; Dialoge mit Porträts und Entscheidungen.
- **Rätsel:** 10 Rätseltypen (Feuerschalen, Runenplatten, Steinblöcke, Hebelfolge, Lichtspiegel, Elementarschloss, Runenmuster,
  Phasenpfad, Zahnradgetriebe, Zeitfalle), Hinweissystem, Geheimräume hinter rissigen Wänden.
- **Weltkarte (M):** Pixel-Art der Himmelsinseln mit Nebel des Krieges, Schlössern, Quest- und Spielermarkern, Tooltips und Schnellreise.
- **Speichern:** automatisch per `localStorage` (in try/catch; das Spiel läuft auch ohne Speicher). Spielstände der ersten Version
  werden beim neuen Spiel übernommen.
- **Technik:** Instancing mit gekachelten Batches und Frustum-Culling, Objekt-Pools, selektiver Bloom, weiche Schatten,
  Qualitätsstufen (mit automatischer Anpassung), Web-Audio-Musik je Region und Bosskampf.
