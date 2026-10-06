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

## Steuerung (frei belegbar)

Einstellungen › Steuerung: Für jede Aktion gibt es eine Primär- und eine Sekundärbelegung (Taste oder Maustaste) und eine
Gamepad-Belegung. Doppelte Belegungen werden angezeigt und können getauscht oder abgebrochen werden. Dazu gibt es die
Voreinstellungen „WASD“ und „Pfeiltasten“, das Gamepad-Layout (Gamepad API, Standardbelegung) und „Auf Standard zurücksetzen“.
Tooltips, Hinweise, HUD und die Hilfe zeigen immer die aktuell belegten Tasten.

| Aktion | Standard | Gamepad |
|---|---|---|
| Bewegen | W A S D / Pfeiltasten | linker Stick |
| Zielen | Maus | rechter Stick (sonst automatische Zielwahl) |
| Angriff (Kombo) | Linksklick | RT |
| Spezialangriff | Umschalt / C | RB |
| Fernkampf | Rechtsklick / F | LT |
| Ausweichen | Leertaste | B |
| Zauber-Slots 1–4 | 1 2 3 4 | Steuerkreuz |
| Artefakte | Q E R | LB, X, RS |
| Heiltrank | H | Y |
| Interagieren | E | A |
| Inventar · Zauber & Talente · Quest-Log · Weltkarte | I · K · J · M | Back · – · – · LS (LB/RB wechseln die Menüs) |
| Rätsel-Hinweis | T | – |
| Navigationsanzeige ein/aus | N | – |
| Pause | Esc / P | Start |

Mit dem Gamepad lassen sich auch alle Menüs bedienen: Steuerkreuz bewegt den Fokus, A bestätigt, B geht zurück.
Esc öffnet immer das Pausemenü. Auf Touch-Geräten gibt es einen virtuellen Joystick und Aktionstasten.

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
- **Rätsel:** 10 Rätseltypen mit mehrstufigen Hinweisen und Geheimräumen.
- **Weltkarte (M):** zoombare Pixel-Art-Karte der Himmelsinseln mit Detailstufen, Nebel des Krieges, Filtern, Questmarkern und Waypoint-Schnellreise.
