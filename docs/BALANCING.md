# Balancing – Stellar Archive

Ziel laut Design: **50 bis 80 Stunden** Spielzeit bis zur Archiv-Versiegelung (80 % der Einträge), die letzten 20 %
sind Komplettisten-Inhalt. Dieses Dokument beschreibt die Stellschrauben und das Pacing-Modell, mit dem die Zielvorgabe
im Test abgesichert ist (`src/gen/archive/pacing.ts`, `pacing.test.ts`).

## 1. Pacing-Modell

Das Modell schätzt je Eintrag die Minuten, bis ein Spieler ihn findet und mit mindestens einem Stern erfasst, und
addiert Reise- und Aufbau-Overhead. Der Spieler erfasst zuerst die leichten Einträge; gezählt werden die günstigsten
80 %.

| Stellschraube | Wert | Begründung |
| --- | --- | --- |
| Basis-Minuten je Kategorie | Fauna 7 · Flora 3,5 · Mikro 5 · Erz 3 · Gestein 3 · Fossil 4,5 · Wetter 9 · Variante 9 | Tiere müssen gefunden und angepirscht werden, Pflanzen/Gestein stehen herum, Wetter braucht Wartezeit |
| Seltenheits-Faktor | gewöhnlich 1 · ungewöhnlich 1,7 · selten 3,2 · legendär 6,5 | Spawn-Gewichte 1 / 0,45 / 0,16 / 0,05, abgemildert durch Hinweise, Gerüchte, Köder und Rover |
| Bedingungs-Faktor | Tageszeit ×1,4 · Wetter ×1,7 · Sonderbedingung ×1,3 | Ein Planetentag dauert 20 min Echtzeit, Wetter wechselt alle paar Minuten |
| Overhead | Lander/Basis/erster Treibstoff 120 min · je weiterem Planeten 60 min · je Biom 10 min | Werkbank, Labor, Formel finden, Reparatur, Start; Transfer, Landung, Basis; Biom suchen |

Ergebnis für acht Beispiel-Seeds (Stand Phase 10): **55–77 h bis 80 %**, 130–190 h bis 100 %. Reise/Aufbau macht
10–25 % aus, der Rest sind Einträge. Der Test schlägt an, wenn ein Seed unter 50 h oder über 80 h fällt.

## 2. Generator-Knöpfe (bestimmen die Modell-Eingaben)

- **Eintragsbudget** 400–600 je System (`gen/archive/budget.ts`, Kategorie-Anteile `CATEGORY_SHARE`).
- **Seltenheitsmix** ≈ 42 % gewöhnlich, 33 % ungewöhnlich, 19 % selten, 6 % legendär (je Generator in `gen/archive/generators/*`).
- **Bedingungen**: ≈ 35 % der Einträge sind tageszeitgebunden, ≈ 27 % wettergebunden, ≈ 8 % haben Sonderbedingungen.
- **Planetenzahl** 3–10, davon 1–4 Gasriesen (nur Atmosphärensonde); der Startplanet trägt 40–55 % der Einträge.
- **Spawn-Gewichte** `RARITY_SPAWN_WEIGHT` in `gen/archive/conditions.ts`.

## 3. Laufzeit-Knöpfe (Spielgefühl)

| Bereich | Wert | Datei |
| --- | --- | --- |
| Tag/Nacht | 1200 s je Planetentag, Zeitraffer T ×60 | `world/DayCycle.ts` |
| Sauerstoff/Energie | Verbrauch je Atmosphäre, Laden an Unterkunft/Ladestation/Schiff, Zusammenbruch = 10 % Rohstoffverlust | `game/survival/Survival.ts` |
| Rohstoffknoten | 2 Einheiten je Abbau (+Geologin-Bonus), Erholung nach Erschöpfung | `world/resources/ResourceNodeManager.ts` |
| Rezepte | Werkbank 6 Ferrit + 3 Quarz, Labor 12/8/4, Zieltreibstoff 20 | `game/crafting/recipes.ts` |
| Treibstoff-Synthese | Qualität ≥ 60 % nötig, Ausbeute nach Labor-Stufe | `game/crafting/fuel.ts` |
| Reisekosten | Start/Transfer/Landung aus Masse, Schub, Gravitation, Distanz | `game/ship/travel.ts` |
| Hinweise | alle 25–45 s ein Hinweis (Biologe ×1,7), max. 3 Objekte gleichzeitig | `world/HintSystem.ts` |
| Foto-Bewertung | Schärfe, Bildfüllung, Komposition, Belichtung, Verhalten; 3 Sterne ab 85 | `game/photo/PhotoScoring.ts` |
| Hintergrund-Boni | max. ±35 % | `game/character/backgrounds.ts` |

## 4. Verfahren bei Änderungen

1. `npm test` – das Pacing-Modell meldet, wenn ein Seed aus dem Band fällt.
2. Bei neuen Kategorien oder Mechaniken die Basis-Minuten im Modell begründet anpassen (nicht nur den Test grün machen).
3. Größere Eingriffe in `docs/DECISIONS.md` festhalten.
