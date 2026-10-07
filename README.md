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
- Spielgefühl in derselben Ansicht: Sprinten halten oder umschalten, Kamera automatisch zentrieren, Schwenk-Empfindlichkeit, Kamera-Zoom.

| Aktion | Standard | Gamepad |
|---|---|---|
| Bewegen | W A S D / Pfeiltasten | linker Stick |
| Springen (in der Luft erneut: Doppelsprung ab Stufe 6) | Leertaste | A (in Reichweite: Interagieren) |
| Sprinten (Ausdauer) | Shift | L3 (umschalten) |
| Zielen | Maus | rechter Stick im Kampf (sonst automatische Zielwahl) |
| Angriff (Kombo) | Linksklick | RT |
| Spezialangriff | C | RB |
| Fernkampf | Rechtsklick / F | LT |
| Ausweichrolle | V | B |
| Zauber-Slots 1–4 | 1 2 3 4 | Steuerkreuz |
| Artefakte | Q E R | LB, X, RS |
| Heiltrank | H | Y |
| Interagieren | E | A |
| Kamera schwenken | mittlere Maustaste halten + ziehen · Num 8/4/2/6 | rechter Stick (außerhalb des Kampfes) |
| Kamera zentrieren · Zoom | Num 5 / Z · Mausrad / + − | Stick loslassen |
| Inventar · Zauber & Talente · Quest-Log · Weltkarte | I · K · J · M | Back · – · – · – (LB/RB wechseln die Menüs) |
| Rätsel-Hinweis | T | – |
| Navigationsanzeige ein/aus | N | – |
| Pause | Esc / P | Start |

Mit dem Gamepad lassen sich auch alle Menüs bedienen: Steuerkreuz bewegt den Fokus, A bestätigt, B geht zurück.
Esc öffnet immer das Pausemenü. Auf Touch-Geräten gibt es einen virtuellen Joystick und Aktionstasten (inkl. SPRUNG und
SPRINT); zwei Finger schwenken die Kamera, auseinander/zusammen zoomt.

## Kamera, HUD-Größe

- **Kamera-Schwenk:** Umsehen, ohne die Figur zu bewegen – begrenzt auf 13 Kacheln um die Figur und die Welt. Beim
  Loslassen fährt die Kamera sanft zurück (abschaltbar), im Kampf und bei Bosskämpfen immer; in Dialogen und
  Zwischensequenzen ist der Schwenk gesperrt. Zoom 70–145 %, wird gespeichert.
- **HUD-Größe (Einstellungen › Anzeige):** 50–200 % mit Live-Vorschau und „Standard“-Knopf. Skaliert werden Leisten,
  Hotbar, Minikarte, Quest-Tracker, Kompass, Navigationsanzeige, Boss-Leiste, Schadenszahlen, Tooltips und Meldungen;
  alles bleibt an seinem Rand verankert, Vergrößerungen werden auf den verfügbaren Platz begrenzt (im Hochformat bricht
  die Hotbar in mehrere Reihen um).

## Springen, Sprinten, Sprungpassagen

- Sprung mit sichtbarer Höhe (Schatten bleibt am Boden), kurzer Luftkontrolle und Doppelsprung ab Stufe 6. Sprinten
  (+45 % Tempo) verbraucht Ausdauer, ein Ring neben der Figur erscheint nur bei Bedarf. Die Rolle bricht den Sprint ab,
  ein Sprung aus dem Sprint reicht weiter.
- Über Gruben, Lava, Gift, Leere und Abgründe kommt man nur im Sprung; wer hineinfällt, verliert kurz Leben (Lava/Gift mehr)
  und erscheint am letzten sicheren Punkt.
- **Jede Region** hat zwei optionale Passagen: Baumstämme über Wasser, Trittsteine über Lava/Gift, Void-Brücken (verschwinden
  im Takt), bröckelnde Steine, bewegliche und schwebende Plattformen – zu Inseln mit Schatztruhen; auf der zweiten Insel
  öffnet sich die Truhe erst, wenn man drei schwebende **Sprungschalter** im Sprung berührt.
- **Jeder Dungeon** (außer der Arena) hat einen Pflicht-Sprungraum: ein Abgrund mit Plattformketten von allen Türen zu
  einer Mittelinsel mit überspringbaren Hindernissen.
- Bodenangriffe (Druckwellen, Stachelfallen, Feuer-/Säureflächen) lassen sich überspringen; Geschosse fliegen unter einem
  hohen Sprung hindurch. Navigationsanzeige und Weltkarte kennen die Sprungpassagen.

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

## Einstellungen

Tabs **Allgemein** (Sprache, Weltstufe, Tipps & Tutorials) · **Steuerung** · **Grafik** · **Audio** · **Anzeige**
(Navigationshilfen, Quest-Tracker, Minikarte) · **Konto**. Alle Einstellungen werden lokal gespeichert und – wenn man
angemeldet ist – im Supabase-Profil (`profiles.settings`, `keybindings`, `language`) und beim Start geladen.

## Inhalt

- **Charakter-Creator:** Geschlecht, Haut, je 8 Frisuren, Haar- und Augenfarbe, Gesicht, Bart, Narben & Tattoos, Kleidung und Farbe,
  Name, Zufallsknopf, drehbare Live-Vorschau. Klassen: Krieger, Magier, Waldläufer, Schurke.
- **Welt:** 9 Regionen über Brücken verbunden, 12 Dungeons inklusive Void Arena, Tag-/Nachtzyklus, Wetter und Musik je Region.
- **Kampf und Magie:** 13 Waffentypen mit eigenen Kombos und Spezialangriffen, 14 legendäre Unikate, 16 Zauber in 4 Schulen,
  Talentbäume, Runen, Element-Kombos.
- **Quests:** 43 Quests mit Hauptgeschichte (Prolog, sieben Akte, Finale), Nebenquests, Kopfgeldern, Sammel-, Eskort- und
  Tagesaufträgen; Dialoge mit Porträts und Entscheidungen.
- **Rätsel:** 10 Rätseltypen mit mehrstufigen Hinweisen und Geheimräumen, darunter 18 Zahnradgetriebe in 7 Varianten.
- **Weltkarte (M):** zoombare Pixel-Art-Karte der Himmelsinseln mit Detailstufen, Nebel des Krieges, Filtern, Questmarkern und Waypoint-Schnellreise.
