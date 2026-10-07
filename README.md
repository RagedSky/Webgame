# Aetherfall: Dungeons

Ein Action-RPG im Voxel-Look mit offener Welt aus schwebenden Himmelsinseln – komplett in **einer einzigen Datei** (`index.html`).
HTML, CSS und JavaScript sind inline; Three.js (r128) wird per CDN geladen (cdnjs, Ersatz: jsDelivr). Figuren, Gebäude, Icons,
Porträts, Logo, Soundeffekte und Musik werden prozedural per Code erzeugt. Das Spiel ist vollständig **zweisprachig (Deutsch / English)**.

## Starten

`index.html` im Browser öffnen. Internet wird für Three.js und die Pixel-Schriften gebraucht.
Für Online-Konten (Clerk) muss die Datei über **http(s)** ausgeliefert werden (z. B. GitHub Pages, Netlify oder `npx serve`),
nicht als `file://`. Ohne Konfiguration läuft das Spiel im **Gastmodus** mit lokalem Speicher.

## Konfiguration (Online-Konten und Cloud-Spielstände)

Ganz oben in `index.html` steht der klar markierte Block `CONFIG`:

```js
const CONFIG = {
  clerkPublishableKey: '',      // pk_test_… / pk_live_…
  clerkJsUrl: '',               // optional: eigene Clerk-Script-URL
  clerkJsVersion: '5',          // Hauptversion von @clerk/clerk-js
  supabaseUrl: '',              // https://<projekt>.supabase.co
  supabaseKey: '',              // Publishable- oder Anon-Key
  autosaveSeconds: 60,          // Cloud-Autosave-Intervall
  saveSlots: 3,                 // Speicherslots (1–3)
};
```

**Nur öffentliche Schlüssel eintragen.** Secret Keys (`sk_…`), der Supabase-Service-Role- bzw. Secret-Key (`sb_secret_…`) und
Passwörter gehören nie in den Code. Das Spiel erkennt solche Schlüssel, ignoriert sie, gibt eine Fehlermeldung in der Konsole aus und
zeigt eine Warnung unter Einstellungen › Konto. Einen versehentlich veröffentlichten geheimen Schlüssel sofort im Dashboard austauschen.

### Einrichtung

1. **Clerk:** Anwendung anlegen, „E-Mail + Passwort“ (mit E-Mail-Code) und optional Google aktivieren. Die Domain, auf der das
   Spiel läuft, als erlaubte Origin bzw. Redirect-URL eintragen. Den *Publishable Key* in `CONFIG.clerkPublishableKey` eintragen.
   Das Clerk-Script wird über das offizielle CDN der Instanz geladen (`https://<frontend-api>/npm/@clerk/clerk-js@5/dist/clerk.browser.js`,
   Ersatz: jsDelivr).
2. **Clerk mit Supabase verbinden:** im Clerk-Dashboard „Connect with Supabase“ ausführen. Das setzt den Claim `role: authenticated`
   in den Session-Tokens.
3. **Supabase:** unter *Authentication › Third-Party Auth* Clerk als Anbieter hinzufügen. Danach im SQL-Editor
   [`supabase/schema.sql`](supabase/schema.sql) ausführen. Dasselbe SQL steht auch als nicht ausgeführter Codeblock am Ende von `index.html`.
   Es legt `profiles` und `savegames` an, mit Row Level Security: Nutzer lesen, schreiben und löschen nur ihre eigenen Zeilen
   (`user_id = auth.jwt()->>'sub'`).
   Die Spalte `profiles.is_admin` (Admin-Befehle der Konsole) kann nur der Datenbank-Besitzer setzen, nie der Spieler selbst.
4. Projekt-URL und *Publishable Key* (oder Anon Key) in `CONFIG.supabaseUrl` / `CONFIG.supabaseKey` eintragen.

Der Supabase-Client bekommt das Clerk-Session-Token als `accessToken`
(`createClient(url, key, { accessToken: async () => (await Clerk.session?.getToken()) ?? null })`).

### Konten, Speicherslots und Synchronisation

- **Login:** E-Mail/Passwort, Registrierung mit Bestätigungscode, Passwort zurücksetzen, Google (wenn in Clerk aktiviert),
  Zweitfaktor per E-Mail-Code oder App, Abmelden. Eine eigene, übersetzte Oberfläche nutzt die Clerk-API.
- **Gastmodus:** Spielen ohne Konto mit lokalem Speicher. Nach Registrierung oder Anmeldung bietet das Spiel an, die Gast-Spielstände
  ins Konto zu übernehmen.
- **3 Speicherslots** je Konto bzw. für den Gastmodus, mit Übersicht (Charakter, Stufe, Region, Spielzeit, Quests, Sync-Status).
- **Cloud-Autosave** alle `autosaveSeconds` Sekunden und sofort bei wichtigen Ereignissen (Quest abgeschlossen, Boss besiegt,
  Stufenaufstieg, Regionswechsel, Hauptmenü). Dazu „Jetzt speichern“ im Pausemenü.
- **Konflikte:** Wurde nur eine Seite verändert, gewinnt automatisch der neuere Stand. Wurde ein Slot auf diesem Gerät und in der
  Cloud unabhängig verändert, erscheint ein Auswahldialog: Stand dieses Geräts behalten, Cloud-Stand laden oder später entscheiden.
  Erkannt wird das über eine Revisionsnummer je Slot (optimistische Sperre).
- **Offline:** Alles wird zusätzlich lokal gespeichert (`localStorage` in try/catch). Ohne Verbindung spielt man weiter; ausstehende
  Stände werden beim Wiederverbinden hochgeladen. Ist der Anmeldedienst nicht erreichbar, kann man offline mit dem zuletzt
  angemeldeten Konto weiterspielen. Netzwerk- und Login-Fehler beenden das Spiel nie.
- **Profil:** Anzeigename, Sprache, Einstellungen und Tastenbelegung werden im Cloud-Profil gespeichert.

### Umbenennung und Migration

Das Spiel hieß früher „Voxelgruft“. Beim ersten Start werden die alten `localStorage`-Schlüssel automatisch übernommen:
`voxelgruft_save_v2` wird zu Gast-Slot 1, `voxelgruft_settings` und `voxelgruft_muted` zu `aetherfall_*`. Die alten Schlüssel
bleiben als Sicherung erhalten. Spielstände der ersten Version (`voxelgruft_save_v1`) werden wie bisher beim neuen Spiel angeboten.

## Sprachen

- Alle Texte laufen über das zentrale i18n-System: `I18N.add(lang, {…})` mit `t('schlüssel', { name })`.
  `{k:aktion}` im Text zeigt automatisch die aktuell belegte Taste.
- Die Inhalte (Quests, Dialoge, Gegenstände, Zauber, Regionen …) sind im Code auf Deutsch definiert. Englisch kommt aus
  Inhaltspaketen: `I18N.addContent('en', { 'QUESTS.m1.name': '…' })`.
- Beim ersten Start wird die Sprache aus `navigator.language` gewählt. Umschalten geht jederzeit im Startmenü, im Login und in
  den Einstellungen, ohne Neustart. Die Sprache wird lokal und im Cloud-Profil gespeichert.
- **Neue Sprache hinzufügen:** in `I18N.LANGS` eintragen, dann `I18N.add('xx', {…})` für die Oberfläche und
  `I18N.addContent('xx', {…})` für die Inhalte. Fehlende Einträge fallen auf Englisch und danach auf Deutsch zurück.

## Steuerung (frei belegbar, auch mit Tastenkombinationen)

Einstellungen › Steuerung: Für jede Aktion gibt es eine Primär- und eine Sekundärbelegung und eine Gamepad-Belegung.
Belegt werden können einzelne Tasten, Maustasten, Modifikatoren allein (z. B. Shift) und **Kombinationen** wie
„Shift + A“, „Strg + Leertaste“, „Alt + 1“ oder „Rechtsklick + E“ (am Gamepad z. B. „LB + A“). Bei der Aufnahme werden alle
gedrückten Tasten live angezeigt; gespeichert wird beim Loslassen, Esc bricht ab, Entf löscht.

- **Vorrang:** Die spezifischere Kombination gewinnt (Shift + A löst seine Aktion aus, A allein nicht). Bewegung wird nie
  blockiert – wer mit Shift sprintet, läuft mit A weiter nach links.
- **Konflikte:** Nur identische Belegungen gelten als Konflikt (tauschen oder abbrechen). Überschneidungen, die gleichzeitig
  wirken (z. B. Shift-Kombination und Sprinten), werden als Hinweis angezeigt.
- **Browser-Kürzel** wie Strg + W/T/N/R/L/…, F5, F11, F12, Alt + F4, Alt + ←/→ und Cmd/Windows-Kombinationen werden mit
  Begründung abgelehnt. `preventDefault` greift mit Strg/Alt/Meta nur bei genau belegten Kombinationen.
- **Tastaturlayouts:** Erkennung über `event.code`, Beschriftung über die Keyboard-API bzw. aus den tatsächlich gedrückten
  Tasten gelernt (QWERTZ, AZERTY, QWERTY).
- **Migration:** Belegungen der Vorversion bleiben erhalten; unveränderte alte Standards werden zu den neuen Standards.
- Spielgefühl in derselben Ansicht: Sprinten halten oder umschalten sowie der Block **Kamera** (siehe unten).
- **Migration:** Fehlen in einem gespeicherten Profil neue Aktionen (z. B. Kamera drehen), bekommen sie ihre Standardtaste nur,
  wenn diese nicht schon eigenständig belegt ist; eine Meldung nennt die neuen Tasten.

| Aktion | Standard | Gamepad |
|---|---|---|
| Bewegen | W A S D / Pfeiltasten | linker Stick |
| Springen (in der Luft erneut: Doppelsprung, an Wänden: Wandsprung – beide als Fähigkeit freizuschalten) | Leertaste | A (in Reichweite: Interagieren) |
| Sprinten (Ausdauer) | Shift | L3 (umschalten) |
| Zielen | Maus | rechter Stick im Kampf (sonst automatische Zielwahl) |
| Angriff (Kombo; im Sprint: Sturmangriff, in der Luft: Landungsschlag) | Linksklick | RT |
| Spezialangriff | C | RB |
| Fernkampf | Rechtsklick / F | LT |
| Ausweichrolle (im vollen Sprint: Rutschen; mit Luftstoß auch in der Luft) | V | B |
| Zauber-Slots 1–4 | 1 2 3 4 | Steuerkreuz |
| Artefakte | Q E R | LB, X, RS |
| Heiltrank | H | Y |
| Interagieren | E | A |
| Kamera schwenken | mittlere Maustaste halten + ziehen · Num 8/4/2/6 | rechter Stick (außerhalb des Kampfes) |
| Kamera zentrieren · Zoom | Num 5 / Z · Mausrad / + − | Stick loslassen |
| Kamera drehen / kippen | Strg + mittlere Maustaste ziehen · Num 7 / Num 9 bzw. , / . · Bild ↑ / Bild ↓ (Num 3 / Num 1) | frei belegbar |
| Ansicht zurücksetzen (Drehung, Neigung, Zoom) | Num 0 / Shift + Z | frei belegbar |
| Inventar · Zauber & Talente · Quest-Log · Weltkarte · Kodex | I · K · J · M · L | Back · – · – · – · Pausemenü (LB/RB wechseln die Menüs) |
| Rätsel-Hinweis | T | – |
| Navigationsanzeige ein/aus | N | – |
| Chat öffnen · Befehl eingeben | Enter · / (Num /) | frei belegbar |
| Pause | Esc / P | Start |

Mit dem Gamepad lassen sich auch alle Menüs bedienen: Steuerkreuz bewegt den Fokus, A bestätigt, B geht zurück.
Esc öffnet immer das Pausemenü. Auf Touch-Geräten gibt es einen virtuellen Joystick und Aktionstasten (inkl. SPRUNG und
SPRINT); zwei Finger schwenken die Kamera, auseinander/zusammen zoomt, Verdrehen der zwei Finger dreht die Kamera.

## Freie Kamera, HUD-Größe

- **Schwenken:** Umsehen, ohne die Figur zu bewegen – begrenzt auf 13 Kacheln um die Figur und die Welt; mit Maus (halten +
  ziehen), Tasten, rechtem Stick, zwei Fingern oder optional am Bildschirmrand.
- **Drehen und Kippen:** Strg + mittlere Maustaste ziehen (waagerecht dreht, senkrecht kippt), Tasten in 45°-Schritten oder
  stufenlos (≈ 90°/s), Drehgeste auf Touch. Neigung 36°–60° (Standard 44°). Drehung und Neigung werden gespeichert.
- **Steuerung dreht mit:** W/Stick „oben“ läuft immer vom Bildschirm weg, D nach rechts; Maus- und Stick-Zielen,
  Minimap (mit Nordmarke), Kompassleiste und Navigationspfeil (am Bildschirmrand verankert) folgen der Drehung.
- **Sicht auf die Figur:** Dungeon-Wände auf der Kameraseite werden passend zur Drehung abgesenkt (wie bisher die
  vorderen Wände, samt Wanddeko, Fackeln und Schattenwurf). Was sonst zwischen Kamera und Figur steht – Wände, Bäume,
  Gebäude, Requisiten – wird in einem weichen Bereich um die Figur durchsichtig (abschaltbar).
- **Zoom:** Mausrad, + / −, Pinch; 70–145 %, sanft; „Standard-Zoom“ ist eine Einstellung, „Ansicht zurücksetzen“ kehrt
  zu ihm zurück.
- **Komfort:** „Kamera zentrieren“ fährt sanft zur Figur zurück; „Automatisch zentrieren“ holt die Kamera beim Loslassen
  und sobald man läuft zurück (abschaltbar). In Dialogen und Zwischensequenzen ist alles gesperrt; bei Bosskämpfen fährt
  die Kamera zurück, rahmt Boss und Figur ein und zoomt bis 140 % heraus.
- **Einstellungen › Steuerung › Kamera:** Automatisch zentrieren, Schwenk-Empfindlichkeit (40–250 %), horizontal/vertikal
  invertieren, Glättung (0–100 %), Bildschirmrand-Scrolling, Standard-Zoom, Drehen mit Tasten (45°-Schritte/stufenlos),
  verdeckende Objekte durchsichtig und „Kamera auf Standard zurücksetzen“ – lokal und im Cloud-Profil gespeichert.
- Ein einmaliges Tutorial erklärt die Kamera mit den aktuell belegten Tasten (Tastatur, Gamepad oder Touch); die Hilfe
  (Pausemenü) listet alle Kamera-Tasten.
- **HUD-Größe (Einstellungen › Anzeige):** 50–200 % mit Live-Vorschau und „Standard“-Knopf. Skaliert werden Leisten,
  Hotbar, Minikarte, Quest-Tracker, Kompass, Navigationsanzeige, Boss-Leiste, Schadenszahlen, Tooltips und Meldungen;
  alles bleibt an seinem Rand verankert, Vergrößerungen werden auf den verfügbaren Platz begrenzt (im Hochformat bricht
  die Hotbar in mehrere Reihen um).

## Sprinten, Springen, Parkour

Sprinten und Springen sind an vielen Stellen die bessere Wahl – im Kampf, bei Bossen, in Rätseln und beim Reisen.
Alle Aktionen laufen über die vorhandenen Tasten (frei belegbar, auch Kombinationen, Gamepad, Touch); Hinweise zeigen
immer die aktuell belegte Taste.

- **Sturmangriff:** Angriff im Sprint → Vorstoß mit ×1,9 Schaden, starkem Rückstoß und kurzer Betäubung (18 Ausdauer,
  kurze Erholung). **Rutschen:** Ausweichtaste im vollen Sprint – flache Hitbox, Bolzen auf Brusthöhe und hohe Laser
  verfehlen. **Landungsschlag:** Angriff in der Luft oder Landen auf Gegnern → Flächenschaden + Betäubung
  (Abklingzeit 3,5 s, 15 Ausdauer). Abklingzeiten neben dem Ausdauerring.
- **Reisen:** in sicheren Orten (Lager, Stadt) kostet Sprinten nichts, auf Wegen etwa die Hälfte, in der Wildnis voll.
- **Wahrnehmung:** Gegner sehen dich normal auf ~9 m, beim Sprinten weiter (Sprinten ist laut), von hinten schlechter.
  Wer sich absetzt und außer Sicht bleibt, wird verloren – das Rudel sucht („?“) am letzten Ort und kehrt dann heim.
- **Sprung-Ausweichen** (gelb telegrafiert, Symbol ⤒): Brute-Schockwelle, Tiefschuss der Schützen, Fegehieb, rollende
  Fässer; bei Bossen u. a. Schockwellen des Hohlen Wächters, Knochenfeger des Großen Skeletts, Kristallwellen und tiefe
  Laser von Xylar, Glutwellen des Aschenschmieds. **Sprint-Positionsspiel:** Wirbel des Urschlunds, Energiefelder von Xylar,
  Klemmtritt der Zwillingszofen (rechtzeitig wegsprinten bricht ihn), Sog-Zonen von Leerenkönig und Seraphiel, Lavaflut.
  Die Rolle bleibt das Mittel gegen Einzeltreffer.
- **Fähigkeiten:** Doppelsprung (Quest „Wurzeln des Übels“, Elwen), Wandsprung + Kante hochziehen (Quest „Gipfelsturm“,
  Hilde), Dornenspurt, Bebenlandung, Schattenhatz, Luftstoß, Leerenschritt (erste Siege über die neuen Bosse). Alte Regionen
  enthalten Wege, die erst damit erreichbar sind (Doppelsprung-Säulen und -Lücken, Wandsprung-Kamine mit Truhen); ohne
  Fähigkeit erklärt ein Hinweis, was fehlt und woher es kommt. Ein vierter Talentzweig „Bewegung“ je Klasse und neue
  Verzauberungen (Ausdauer, Schritt, Ansturm) verbessern Ausdauer, Sprinttempo, Erholung und Sprint-/Landungsschaden.
- **Höhenvorteil** in jeder Region: Aussichtsfelsen (decken einen großen Kartenbereich auf), Truhenfelsen, Fernkampffelsen
  (Nahkämpfer kommen nicht hinauf), Sprungabkürzungen und Geheimwege aus Geisterplatten.
- **Sprung-Rätsel** in allen Regionen: Luft-Druckplatten, Lasergänge (springen/rutschen/Takt), hohe Schalter, Fackellauf mit
  Zeitlimit und Fallenstreifen; dazu bestehende Sprungpassagen, Sprungschalter und Pflicht-Sprungräume in Dungeons.
- **Parkour in allen 9 Regionen** (Baumstämme, Förderbänder, Lavasteine, Eisschollen, Void-Brücken …) in den Stufen
  normal/schwer/meister (Meister ohne Sturz) mit Checkpoints und **Bestzeiten** (Kodex → Bestzeiten).
- **Zeitbasiertes:** Sprint-Kurier, Wettlauf gegen Fenna, Eskorte mit Zeitlimit, einstürzende Brücke, Zeitrune mit
  Zeit-Truhe, Fackel- und Fabrikrätsel, blinkende Laser (HUD-Zeitanzeige).
- **Karte & Navigation:** entdeckte Abkürzungen, Aussichtspunkte und Parkour-Starts mit eigenem Filter „Bewegung“; die
  Navigation schlägt eine entdeckte Sprungabkürzung als türkise Alternativroute vor.
- **Gegner** flankieren, Fernkämpfer bleiben hinter den Nahkämpfern, sie weichen sichtbaren Flächenangriffen aus, springen
  über Hindernisse und nutzen Sprint-Schübe; alles fair telegrafiert.
- Neue Quests (Kurier, Wettlauf, Parkour-Meister, Landungsschlag-Siege, Abhängen, Aussicht, Eskorte, Tagesauftrag) und
  16 Bewegungs-Erfolge.

## Ausrüstung: Aufwertungsstufe, Obergrenze, Aufstieg

Jede Waffe und jedes Item steigt beim Schmied Stufe um Stufe. Die Obergrenze hängt von der Seltenheit ab (Gewöhnlich +3,
Selten +5, Episch +7, Legendär +9, Unikat +10) und vom Spielerlevel (Stufe/3 + 3). Ist sie erreicht, zeigt der Tooltip
„Max. Stufe“ und der Knopf erklärt, was fehlt. **Aufstieg** (bis zu 3×, je +2) kostet Aufstiegssplitter, die Bosse und
Wächter fallen lassen. Tooltips, Inventar und Schmied zeigen Stufe, Obergrenze und eine Vorschau der nächsten Stufe.
Alte Gegenstände werden beim Laden passend eingestuft (keine Stufe geht verloren).

## Zahnrad-Rätsel

18 Zahnradgetriebe, mindestens zwei in jeder Region (11 optional in der Oberwelt, 7 in Dungeons). Regeln: klein + groß
nebeneinander greifen, zwei große verklemmen, zwei kleine berühren sich nicht; diagonal greifen nur zwei große. Jeder
Kontakt kehrt die Drehrichtung um, ein Ring mit widersprüchlichen Richtungen blockiert.

- **Varianten:** Kette (Antrieb → Ziel), Drehrichtung (Ring über dem Ziel), Übersetzung (langsam/normal/schnell), fehlende
  Zahnräder (in der Umgebung einsammeln), Kupplungshebel + Druckplatte (kehrt die Richtung um), Zeitlimit (Kurbel drehen,
  dann rechtzeitig zum Hebel laufen) und mehrstufige Getriebe. Höhere Stufen bringen größere Raster und festgerostete Räder.
- **Regionsthemen:** Messing, Rost (Dampf, Funken), Moosstein, Lava, Kristall, Eis, Void (schwebende Räder) und Astral.
- **Belohnungen:** Truhen, Türen (zweimal vor dem Boss), Abkürzungsportale, Geheimkammern und der Geheimraum im Kristallschlund.
- Drei Hinweisstufen je Variante (T), gelöste Rätsel bleiben gespeichert; Marker auf Welt- und Minikarte (Filter „Rätsel“).

## Weltkarte (M)

- **Zoomen und Verschieben:** Mausrad, Pinch-Geste oder die Knöpfe + / −; Karte ziehen oder Bewegungstasten / linker Stick.
  Weiche Kamerafahrt, „⌖“ zentriert auf die Spielfigur, „▣“ zeigt die ganze Welt.
- **Detailstufen:** weit = Regionen mit Namen, Inselgrenzen und Fortschritt (Quests, Waypoints, Bosse); mittel = Orte, Wege,
  Dungeons, Lager und Waypoints; nah = Quests mit Name und Kurzbeschreibung, Gegnerstufen, Truhen, Rätselorte, Händler und
  Schmiede sowie entdeckte Geheimnisse.
- **Pixel-Art:** Jede Insel wird einmal prozedural als Offscreen-Canvas gezeichnet (Gebäude, Bäume, Berge, Lava, Wasser,
  Brücken, Wege, Klippen); pro Bild werden nur sichtbare Inseln und Symbole gezeichnet. Beschriftungen mit Kontur weichen
  einander aus.
- **Nebel des Krieges:** wolkig, mit weichen Rändern; er lichtet sich Stück für Stück dort, wo man schon war.
- **Filter** (Quests, Waypoints, Dungeons, Händler, Rätsel) und eine **ausklappbare Legende**; Filter werden gespeichert.
- **Questmarker:** Hauptquest gold (Stern), Nebenquest blau, „?“ = Abgabe, pulsierend; ein gestrichelter Kreis markiert ein
  ungefähres Zielgebiet. Tooltip mit Name, Ziel, Belohnung, empfohlener Stufe und Entfernung. Klick → verfolgen / Fokus.
  Ein Klick auf eine Quest im Quest-Log springt auf der Karte zum Ziel.
- **Gesperrte Orte** erklären im Tooltip, was fehlt (Quest, Stufe, Story-Fortschritt).

### Entdeckt-Status (dauerhaft gespeichert)

Was man entdeckt hat, steht im Spielstand in einer eigenen Struktur `discovered` (mit Versionsfeld `v`):
besuchte **Regionen**, entdeckte **Orte** (Lager, Stadt, Portalhügel …), aktivierte **Waypoints**, entdeckte **Dungeons** und
der aufgedeckte **Nebel** je Region (eine Bitmaske, 1 Bit je Kartenfeld). Das Startgebiet Ehbergten mit Lager, Stadt und
Portalhügel ist ab Spielbeginn entdeckt.

- **Speichern:** Jede Speicherung nimmt den gerade aufgedeckten Nebel mit; neue Entdeckungen werden nach kurzer Pause
  gespeichert (1,5 s Ruhe, spätestens nach 6 s, ein neuer Ort nach 0,4 s), außerdem beim Schließen, Neuladen oder Verbergen
  der Seite. Fehlgeschlagene Speicherversuche erscheinen mit Hinweis in der Konsole und unter `/debug log`.
- **Laden:** Nebel und Orte gehören fest zu dem Spielstand, aus dem sie geladen wurden – Titelbildschirm, Slot-Wechsel oder
  ein neuer Charakter können sie nicht überschreiben. Geschrieben wird immer in denselben Slot (Gast bzw. Konto), aus dem
  gelesen wurde.
- **Cloud:** Beim Abgleich gewinnt wie bisher der neuere Stand; entdeckte Bereiche beider Seiten werden dabei aber vereinigt –
  auch nach Offline-Spielen oder wenn ein Cloud-Stand gar keine Entdeckungen enthält. Ein bewusstes Zurücksetzen
  (`/lock map`, `/lock waypoints`, neuer Spielstand) bekommt eine neue „Generation“ und wird durch eine Vereinigung nicht aufgehoben.
- **Alte Spielstände** (auch aus der Zeit vor der Umbenennung) werden übernommen: Was dort entdeckt war, bleibt entdeckt.
  Fehlt der Entdeckt-Status oder ist er kaputt, wird er einmalig aus dem Fortschritt abgeleitet (besuchte Regionen,
  aktivierte Waypoints, angenommene/abgeschlossene Quests, besiegte Bosse, aktuelle Position).

### Waypoints (Schnellreise)

- 19 Waypoints, auf der Karte immer sichtbar und nie verdeckt: aktiviert (leuchtend, anklickbar), unentdeckt (grau mit „?“,
  nur in bereits besuchten Regionen) und „du bist hier“ (eigenes Symbol).
- Klick öffnet ein Panel mit Name, Region, Entfernung und **„Hierhin reisen“** (mit Ladeübergang; nicht im Kampf oder in Dungeons).
- In der Welt: Lichtsäule und Partikel; Hinweis „[Taste] Waypoint aktivieren“ (folgt der Tastenbelegung). Beim Entdecken
  Effekt und Meldung „Waypoint entdeckt: …“.
- Seitenleiste mit allen Waypoints nach Region; beim ersten Öffnen erklärt ein Tutorial die Karte, danach über „?“.

## Navigation im HUD

Alle Hilfen sind anfangs eingeschaltet und unter **Einstellungen › Anzeige** einzeln schaltbar (lokal und im Cloud-Profil
gespeichert): Navigationspfeil (am Bildschirmrand mit Questname und Entfernung bzw. Marker über dem Ziel), Wegführungslinie
(leuchtende Spur auf dem Boden entlang des kürzesten Wegs), Kompassleiste (mit Quest-, Waypoint- und Dungeon-Markern),
Entfernungsanzeige, Quest-Tracker und Minikarte. Mit **N** schaltet man die Navigation schnell ein und aus. Liegt das Ziel
in einer anderen Region, führt alles zum nächsten passenden Ausgang; im Dungeon zum Ausgang. In Dialogen und
Zwischensequenzen wird die Anzeige ausgeblendet, im Kampf durchsichtiger. Es können bis zu vier Quests verfolgt werden,
davon höchstens eine Hauptquest; die erste ist der Fokus der Navigation (Klick im Tracker setzt den Fokus).

## Chat & Befehlskonsole

Unten links im HUD liegt ein Chatfenster. **Enter** öffnet es, **/** öffnet es mit vorangestelltem Schrägstrich
(beides unter Einstellungen › Steuerung frei belegbar, auch als Kombination), **Esc** schließt es. Solange der Chat offen ist,
ruht die Spielsteuerung. Auf Touch-Geräten öffnet der Knopf 💬 oben rechts den Chat; das Eingabefeld rückt dann nach oben,
damit die Bildschirmtastatur es nicht verdeckt.

- **Verlauf:** bis zu 200 Zeilen mit Scrollen, farbigen Meldungstypen (System, Fehler, Erfolg, Hinweis, Flüstern, Emote) und
  optionalen Zeitstempeln. Nachrichten sind höchstens 200 Zeichen lang; mehr als 5 Nachrichten in 5 Sekunden werden gebremst.
- **Eingabe:** ↑/↓ blättert durch die letzten 50 Eingaben (gespeichert), **Tab** vervollständigt Befehle, Gegenstände, Orte,
  Regionen, Dungeons, Bosse, Quests, Rätsel und Spielernamen; darüber erscheint eine Vorschlagsliste mit Syntax.
- **Einblenden:** Ohne Aktivität blendet der Chat nach 9 Sekunden aus (abschaltbar). Größe (S/M/L), Deckkraft, Auto-Ausblenden,
  Zeitstempel und Chat an/aus stehen unter **Einstellungen › Konto › Chat & Entwickler**. Der Chat skaliert mit dem HUD-Regler.
- **Nachrichten ohne /** erscheinen lokal mit dem Charakternamen. Ein Mehrspieler-Kanal über Supabase Realtime ist vorbereitet
  (`ChatNet`, Broadcast-Kanal `aetherfall-chat`), aber aus: Er wird nur mit `CONFIG.chatRealtime: true` und Anmeldung aktiv.

### Befehle

Befehle beginnen mit `/`, Groß-/Kleinschreibung ist egal, Argumente mit Leerzeichen stehen in Anführungszeichen
(`/tp "Asche-Steppe"`). Gegenstände, Orte und Quests gehen als ID oder als deutscher bzw. englischer Name. Zahlen dürfen
`50k`, `1m` oder Tausenderpunkte enthalten. Bei Tippfehlern schlägt das Spiel den nächsten Befehl vor („Meintest du /give?“),
falsche Argumente werden mit Syntax und Beispiel erklärt. Mehrere Befehle in einer Zeile trennt `;` (höchstens 10).

**Für alle:** `/help [befehl]` · `/clear` · `/pos` (`/coords`) · `/stats` · `/time` · `/ping` · `/lang de|en` · `/save` · `/sync` ·
`/bind [aktion]` · `/quests` · `/track <quest>` · `/whisper <name> <text>` · `/me <text>` · `/history [n]` · `/alias` ·
`/cheats [status]` · `/confirm` · `/cancel`

**Nur Admin** – Gegenstände und Währung: `/give <gegenstand> [anzahl] [stufe] [seltenheit]` (`/give help` listet alle Kategorien),
`/giveall <kategorie>`, `/gems` bzw. `/gold [+|-|=] <menge>` (das Spiel kennt nur Edelsteine ◆), `/currency <art> <menge>`,
`/take <gegenstand> [anzahl|alle]`, `/clearinv`, `/repair`, `/upgrade <slot> [stufen] [force]`, `/enchant <slot> <modifikator> [stufe]`.

**Nur Admin** – Charakter: `/level`, `/xp`, `/skillpoints`, `/respec [all|talents|attrs]`, `/heal`, `/mana`, `/stamina`,
`/god`, `/infmana`, `/infstamina`, `/onehit` (jeweils `[on|off]`), `/speed`, `/jumpheight` (0,25–4), `/damage` (0,1–100),
`/noclip`, `/unstuck`, `/appearance`.

**Nur Admin** – Freischalten: `/unlock <all|map|waypoints|quests|spells|weapons|recipes|regions|puzzles|achievements|skills|cosmetics>`,
`/lock <kategorie>`, `/reveal [hier|region|alles]`, `/waypoints unlock|list`, `/discover <ort>`.

**Nur Admin** – Welt: `/tp <wegstein|ort|region|dungeon|boss|x y>`, `/home [region]`, `/time set <morgen|mittag|abend|nacht|HH:MM>`,
`/weather <wetter>`, `/timescale <0–60>`, `/spawn <gegner> [anzahl 1–30] [stufe]`, `/killall [radius] [bosse]`,
`/boss spawn|reset|skip <boss>`, `/chest [seltenheit] [stufe]`, `/loot [radius]`.

**Nur Admin** – Quests, Rätsel, System: `/quest start|complete|reset|list|completeall`, `/puzzle solve|reset|list`,
`/flag set|get|del|list`, `/difficulty <0–2>`, `/savereset`, `/backup [list]`, `/restore [n]`, `/undo`, `/seed [set <zahl>]`,
`/debug <fps|trefferzonen|ki|pfade|koordinaten|aus|protokoll>`, `/cheats on|off`.

Befehle nutzen die Systeme des Spiels: Quest-Belohnungen, Stufenaufstiege, Benachrichtigungen, Karten-Haken und
Waypoint-Effekte laufen genauso wie beim normalen Spielen.

### Rechte und Entwicklermodus

- **Angemeldet:** Admin-Befehle gibt es nur, wenn in Supabase `profiles.is_admin = true` steht. Spieler können die Spalte selbst
  nicht setzen (Trigger und Spaltenrechte, siehe [`supabase/schema.sql`](supabase/schema.sql)); vergeben wird sie im
  SQL-Editor: `update public.profiles set is_admin = true where user_id = 'user_…';`. Offline gilt der zuletzt bekannte Status.
- **Gast / lokal:** Einstellungen › Konto › Chat & Entwickler › **Entwicklermodus** (Standard aus) schaltet die Admin-Befehle für
  lokale Spielstände frei; im Chat erscheint ein Hinweis.
- Ohne Rechte: „Dafür brauchst du Admin-Rechte.“ Abgelehnte Versuche stehen ebenfalls im Protokoll.
- Befehle wirken ausschließlich im Client auf den eigenen Spielstand. Im Code stehen keine geheimen Schlüssel.

### Sicherheitsnetze

- **Cheat-Kennzeichen:** Sobald ein Admin-Befehl etwas verändert, bekommt der Spielstand `cheats_used` – sichtbar als Abzeichen
  „Cheats“ in der Slot-Übersicht. `/cheats off` schaltet alle Cheats und Admin-Befehle für die Sitzung ab, das Kennzeichen bleibt.
- **Rückfragen** bei allem, was etwas entfernt, senkt, zurücksetzt oder überschreibt, und bei großen Eingriffen:
  `/unlock all`, `/lock`, `/clearinv`, `/giveall`, `/give` über 10 Stück, `/take`, Senken von Edelsteinen/Währungen,
  `/level`, `/xp`, `/skillpoints` und `/upgrade`, Entfernen/Senken/Verdrängen einer Verzauberung, `/respec`,
  `/quest reset`, Neustart einer erledigten Quest, `/quest completeall`, `/boss reset`, `/boss skip`, `/puzzle reset`,
  Überschreiben/Löschen eines Flags, `/killall` mit Bossen, `/seed set`, `/noclip`, `/restore`, `/undo`.
  Bestätigt wird mit den Knöpfen im Chat oder `/confirm` bzw. `/cancel`; eine Rückfrage verfällt nach 45 Sekunden oder
  sobald ein anderer Spielstand geladen ist. `/savereset` und `/lock all` fragen zweimal.
- **Automatische Sicherung** vor `/unlock all`, `/lock`, `/savereset`, `/clearinv`, `/giveall`, `/quest completeall` und
  `/restore` (die letzten 3 je Slot, lokal); `/backup` sichert von Hand, `/restore [n]` stellt wieder her.
  `/undo` macht die letzten 5 Admin-Befehle rückgängig, die den Spielstand geändert haben (nur im selben Spielstand).
- **Grenzen:** Stufe 1–100, Gegenstandsstufe bis 120, höchstens 50 Stück je `/give`, Edelsteine bis 9.999.999, 30 Gegner je
  `/spawn` (150 gleichzeitig), Faktoren wie oben. Ungültige Eingaben ergeben eine Fehlermeldung, nie einen Absturz.
- **Protokoll:** Jeder Admin-Befehl wird mit Zeit und Ergebnis protokolliert (letzte 80, `/history`); Protokoll und Kurzbefehle
  liegen lokal und im Cloud-Profil.
- **Kurzbefehle:** `/alias heilen /heal; /mana` legt einen Makro-Befehl an (höchstens 30 Stück, 300 Zeichen, 3 Ebenen tief).

## Bosse der Stufen 40–100

Zehn neue Bosse mit eigenen **Boss-Arenen** an neuen Orten (inklusive Vulkhar, dem Aschenschmied der Cinder Wastes). Bestehende Dungeons und Bosse bleiben unverändert. Die
Stufenobergrenze liegt jetzt bei **100** (Gegenstandsstufe bis 120).

| # | Boss | Arena (Region, Nachbarort) | Stufe | Stärke | Kern-Mechanik |
|---|---|---|---|---|---|
| 1 | Dornfang-Alpha | Dornenhain (Duskwood, Forgotten Forest) | 40 | 1 | Astwurf alle 2 s, Astsalve (16 Geschosse) |
| 2 | Der Hohle Wächter | Die Hohlfelder (Duskwood, Hollow Fields) | 47 | 2 | Sprungschlag mit 1-s-Zone, fester Körper |
| 3 | Die Zwillingszofen | Verborgener Salon (Ehbergten, Ornate Mansion) – geheim | 52 | 3 | versetzte Würfe, Klemmtritt (5 Tritte) nur solange beide leben |
| 4 | Der Urschlund | Schlund der Nacht (Nightmaw's Den, The Den) | 57 | 4 | Biss alle 1,3 s, Wirbelverfolgung (höchstens 3 Treffer) |
| 5 | Das Große Skelett | Der Knochenthron (Undead Caverns, Grand Cemetery) | 65 | 5 | Totenruf: 3 Knochendiener; Arkan und Flächenschaden wirken stark |
| 5b | Vulkhar, der Aschenschmied | Seelenesse (Cinder Wastes, Volcano of Lost Souls) | 69 | 6 | Glutwellen (springen), Lavaflut (zur kühlen Insel sprinten), Lanzenfächer; Feuer kaum wirksam, Frost stark |
| 6 | Parasitäres Phantom | Parasitenherz (Toxic Wastelands, Parasitic Expanse) | 73 | 7 | Kontaktschaden, Flächenhieb, 10 Elite-Geister, Splittersturm; Gift heilt es |
| 7 | Xylar, der Kristallkoloss | Kristallgipfel (Mount Aelen, Shattered Peaks) | 81 | 8 | Splittersalve, Kernlaser mit Energiefeldern (8 s) |
| 8 | Der Leerenerwachte König | Thron der Leere (Void Rift, Hideout) – Wellenarena | 89 | 6 | Leerenblitz, Teleportschlag (4 Hiebe); erscheint nach der letzten Welle |
| 9 | Seraphiel, die verderbte Architektin | Herz des Nexus (Astral Nexus, Central Nexus) | 100 | 9 | ruht bis zum ersten Treffer; Teleport-Lanze, Leerenrisse, Zerbrochene Realität |

- **Stufe und Skalierung:** Jeder Boss hat eine Basisstufe auf der Spielkurve (40 → 100). Ist der Spieler höher, wächst der
  Boss auf dessen Stufe mit (Leben und Schaden), dazu die Weltstufe (+10/+20 Stufen, höchstens 100). Leben = angestrebte
  Kampfdauer × Referenz-Schaden des Spielers auf dieser Stufe (ca. 1–2 min früh bis ca. 5 min bei Seraphiel); Schaden:
  Faktor 1,0 ≈ 12 % der Lebenspunkte eines passend ausgerüsteten Spielers. Seraphiel passt Leben und Schaden zusätzlich
  laufend an Stufe und Ausrüstungswert an (der Lebensanteil bleibt dabei erhalten).
- **Telegrafie:** Jeder Angriff hat eine rote Zone, Linie oder Aufladung und lässt sich per Rolle oder Laufen vermeiden.
  Seraphiels zielsuchende Lanzen verpuffen, wenn man im Trefferfenster rollt.
- **Wut bei 30 %:** Aura, Farbwechsel, Brüllen, Meldung „Raserei“, kürzere Abklingzeiten. Die Lebensleiste zeigt Name,
  Titel, Phase, eine Markierung bei 30 % und Statussymbole (Brennen, Gift, Frost …).
- **Resistenzen:** Betäubung höchstens 0,7 s (danach 5 s Schutz), Frost höchstens 1 s (Xylar 0,5 s), Wurzeln höchstens 1 s,
  Rückstoß auf ein Viertel, keine Sofort-Tötung (`/onehit` mit „auch Bosse“ wirkt mit höchstens 25 % je Treffer).
  Elemente: Das Spiel kennt die Schulen Feuer, Frost, „Blitz & Arkan“ und Leere – „Blitz“ und „Heilig“ aus der
  Vorgabe laufen über „Blitz & Arkan“.
- **Arenen:** Vorraum → Kampf- bzw. Rätselraum → Vorraum mit **Checkpoint** (heilt voll) → Bossraum. Beim Betreten
  schließen sich die Türen. Ein Tod setzt den Kampf zurück; „Am Checkpoint erneut versuchen“ beginnt im Vorraum, der
  Boss startet mit vollem Leben. Im Thron der Leere zählt das Erscheinen des Königs als Checkpoint (Wellen übersprungen).
- **Freischaltung:** über den Story-Fortschritt (Akte von Buch II, siehe unten) und die Stufenempfehlung (Bossstufe − 6, mindestens 40). Der Schlund der Nacht öffnet sich über die Questkette „Spuren im Staub“ →
  „Das Heulen der Tiefe“ (Brann). Der Verborgene Salon bleibt unsichtbar, bis Lady Vespera besiegt ist; drinnen öffnet
  ein Hebelrätsel den Weg. Das Herz des Nexus hält „acht Siegel“ – die acht übrigen neuen Bosse (ohne die optionalen Zwillingszofen).
  Gesperrte Eingänge und die Weltkarte nennen den Grund.
- **Belohnungen:** garantierte Beute je Stärkestufe (Seltenheit), Erfahrung, Edelsteine, Aufstiegssplitter und
  Questfortschritt. Unikate: Zofenschwur (Zwillingszofen; Treffer nach einer Rolle +60 %), Kolossspalter (Xylar; jeder
  3. Treffer Kristallblitz), Leerenkrone (König; +15 % Schaden gegen Bosse, −10 % Schaden von Bossen), Lanze der
  Architektin (Seraphiel; Arkan stärker). Die Zwillingszofen tragen zusätzlich einen Geheimnis-Eintrag ein.
- **Bossstatus und Revanche:** Siege werden gespeichert (auch in der Cloud) und auf der Weltkarte abgehakt. Wer eine
  Arena eines besiegten Bosses betritt, wählt **„Boss erneut bekämpfen“**: Normal oder Rang 1–5 (je Rang +30 % Leben,
  +12 % Schaden, mehr Beute und Erfahrung; der nächste Rang wird durch einen Sieg frei).
- **Story:** Orin bleibt der vorletzte Kampf. Nach seinem Fall gibt es keinen Abspann mehr, sondern Weltstufen und das
  neue Kapitel „Das schlafende Auge“ (acht Siegel brechen) → „Die verderbte Architektin“. Seraphiel hat eigene Musik
  in zwei Phasen, Zwischensequenzen beim Erwachen und beim Tod; danach folgen Epilog und Abspann.
- **Befehle:** `/boss spawn|skip|reset` und `/tp boss` kennen die neuen Bosse (`/boss reset` setzt auch den Revanche-Rang zurück).

## Story: Buch II, Kodex und Erfolge

- **Buch I** bleibt die Geschichte um Orin. Jeder alte Boss hinterlässt ein Fragment aus dem **Logbuch der Architektin**;
  im Versteck der Void Rift (Quest „Das verdächtige Versteck“) fallen zum ersten Mal ihr Zeichen und ihr Name –
  Orin war ihr Werkzeug.
- **Buch II** (nach Orins Fall): acht Akte, je ein Akt pro Region, jeder mit drei Quests, Dialogen mit Auswahl (die Wahl
  wirkt später nach), Boss-Intro beim ersten Erscheinen, Outro nach dem Sieg und Lore-Fundstücken in der Region. Die
  Arenen öffnen sich über den Story-Fortschritt (vorheriger Akt) und die Stufenempfehlung (Bossstufe − 6).
  Rollen: Dornfang-Alpha (Dornensamen der Architektin), der Hohle Wächter (ausgehöhlter Feldwächter Hollbrand),
  der Urschlund (Mutter aller Schlünde, von der alten Wacht versiegelt – Schloss auf der Karte bis zum Wachtschlüssel),
  das Große Skelett Aldemar (erster Friedhofswächter, Meister von Mortheus), Vulkhar der Aschenschmied (schmiedet ihre
  Lanzen; Wendepunkt von Buch II mit Kael), das Parasitäre Phantom (ihr „Gärtner“, Quelle der Brut), Xylar (aus
  Kronensplittern gewachsen, von Sylvaras Gesang gebannt), Varos der Leerenerwachte König (Gründer der Void Arena,
  seine Krone öffnet das Nexus-Herz) und Seraphiel selbst. Acht Siegel müssen brechen.
- **Geheimstory der Zwillingszofen** (optional, Ornate Mansion): Briefe sammeln, Glockenrätsel lösen, Salon betreten;
  danach erscheint Matthis in Ehbergten, und das Wissen der Zofen hilft im Finale.
- **Weltfolgen** nach jedem Bosssieg: andere NPC-Zeilen, ruhigeres Wetter und Musik, weniger Rudel, ein Wegstein an der
  Arena, thematische Händlerware, eine Nachspiel-Nebenquest, Kodex-Eintrag und Erfolge.
- **Belohnungen:** je Boss ein Unikat oder eine Bewegungsfähigkeit (neu: Wächtereid, Essenglut, Symbiontenmantel).
- **Kodex** (Taste L, Pausemenü, HUD-Knopf): Lore, Bosse (Status, Revanche-Rang), Erfolge, Bestzeiten, Fähigkeiten.
  Karte: Filter „Bosse“ und „Lore“; Tracker und Questbuch zeigen „Akt n · i/n“ und den Bossstatus.
- Farbige Namen (Gegenstände, Quests, NPCs, Bosse, Orte) laufen über ein zentrales Rich-Text-System – sie erscheinen nie
  als Rohtext.

## Balancing und Anti-Grind

- **Zentrale Tabelle `BAL`** (Ende von `b_util_data.js` in den Quellen): alle Kurven, Faktoren und Obergrenzen, kommentiert.
- **Spielerstärke:** abnehmender Ertrag für Attribute; Krit-Chance und -Schaden, Lebensraub (auch pro Sekunde, gegen
  Bosse halbiert), Abklingzeitverkürzung, Tempo, Ausweichen und Rüstung (weiche Kurve) mit weichen und harten Grenzen;
  prozentuale Schadensboni aus Talenten, Verzauberungen und Unikaten bilden einen gemeinsamen, gedeckelten Pool.
- **Ausbau-Obergrenze** zusätzlich an den Story-Fortschritt gekoppelt (Bosse aus Buch I und II), bestehende Stufen bleiben.
- **Tränke:** 3 Ladungen (+1 mit Lioras Rezept), auffüllen an sicheren Orten, Wegsteinen, Checkpoints und beim
  Dungeon-Eingang; im Bosskampf längere Abklingzeit. Ladungen am Trank-Slot.
- **Anti-Grind:** Erfahrung, Edelsteine und Beute sinken mit dem Stufenabstand (ab +3 deutlich, ab +7 fast nichts);
  Regions-Ermüdung; geleerte Rudel bleiben 10 Minuten leer; Tagesaufträge, Arena und Boss-Revanchen mit abnehmendem
  Ertrag pro Tag. Eine Stunde Grinden in einer frühen Region bringt etwa 1–2 Stufen.
- **Stufenbänder:** Gegner folgen der Spielerstufe teilweise innerhalb ihres Regions-/Dungeonbands; neue Bosse werden bei
  Überstufe deutlich kürzer (≈0,6× bei +5), ihr Schaden bleibt spürbar. Weltstufen skalieren Gegner und Belohnung
  stärker als den Spieler.
- **Zielwerte (gleiche Stufe):** normaler Gegner ~2–3 s, Brute ~6–8 s, ein normaler Treffer ~7–8 % der Lebenspunkte;
  alte Bosse ~1–2 Minuten, neue Bosse ~1:20 bis 5:00 (Seraphiel). Quests sind die wichtigste Erfahrungsquelle; wer schon
  über dem nächsten Story-Meilenstein liegt, bekommt weniger Quest-Erfahrung.
- **Alte Spielstände** behalten Stufe, Gegenstände und Fortschritt; einmalig wird angeboten, Talente und Attribute kostenlos
  neu zu verteilen (auch später über den Charakterbildschirm oder `/rebalance`).
- **Admin:** `/balance report [klasse] [stufe]`, `/balance boss [id]`, `/balance grind [region] [minuten] [stufe]`,
  `/balance story` – Tabellen in Deutsch und Englisch. `/god`, `/onehit`, `/damage`, `/level` bleiben unveränderte Cheats.

## Einstellungen

Tabs **Allgemein** (Sprache, Weltstufe, Tipps & Tutorials) · **Steuerung** · **Grafik** · **Audio** · **Anzeige**
(Navigationshilfen, Quest-Tracker, Minikarte) · **Konto** (Anmeldung, Slots, Chat & Entwickler, Konsole, Befehlsprotokoll). Alle Einstellungen werden lokal gespeichert und – wenn man
angemeldet ist – im Supabase-Profil (`profiles.settings`, `keybindings`, `language`) und beim Start geladen.

## Inhalt

- **Charakter-Creator:** Geschlecht, Haut, je 8 Frisuren, Haar- und Augenfarbe, Gesicht, Bart, Narben & Tattoos, Kleidung und Farbe,
  Name, Zufallsknopf, drehbare Live-Vorschau. Klassen: Krieger, Magier, Waldläufer, Schurke.
- **Welt:** 9 Regionen über Brücken verbunden, 12 Dungeons inklusive Void Arena und 10 Boss-Arenen, Tag-/Nachtzyklus, Wetter und Musik je Region.
- **Kampf und Magie:** 13 Waffentypen mit eigenen Kombos und Spezialangriffen, 21 legendäre Unikate, 16 Zauber in 4 Schulen,
  Talentbäume (je Klasse drei Kampfzweige + Bewegung), Runen, Element-Kombos.
- **Quests:** 89 Quests mit Hauptgeschichte (Buch I: Prolog, sieben Akte, Finale gegen Orin; Buch II: acht Akte und Finale gegen Seraphiel), Nebenquests, Kopfgeldern, Sammel-, Eskort- und
  Tagesaufträgen; Dialoge mit Porträts und Entscheidungen.
- **Rätsel:** 10 Rätseltypen mit mehrstufigen Hinweisen und Geheimräumen, darunter 18 Zahnradgetriebe in 7 Varianten.
- **Kodex (L):** 67 Lore-/Boss-Einträge, 28 Erfolge, 29 Bestzeiten (Parkour, Wettläufe), 10 Fähigkeiten.
- **Weltkarte (M):** zoombare Pixel-Art-Karte der Himmelsinseln mit Detailstufen, Nebel des Krieges, Filtern, Questmarkern und Waypoint-Schnellreise.
