# Aetherfall: Dungeons

Ein Action-RPG im Voxel-Look mit offener Welt aus schwebenden Himmelsinseln. Das Repository enthält zwei Teile:

- **Website** (Landing Page, online unter https://aetherfallroe.com/dungeons/) im Wurzelverzeichnis des Repositorys: Startseite, Anmeldung/Registrierung (Clerk), Impressum, Datenschutz, AGB,
  Widerruf, Kontakt, 404 – statisches HTML/CSS/JS ohne Build-Schritt, Deutsch und Englisch. Details: [Landing Page](#landing-page-website).
- **Spiel** in [`play/index.html`](play/index.html) – weiterhin **eine einzige Datei**: HTML, CSS und JavaScript inline; Three.js (r128) und
  supabase-js liegen lokal in `play/vendor/` (Ersatz: CDN), die Pixel-Schriften in `assets/fonts/`. Figuren, Gebäude, Icons, Porträts,
  Logo, Soundeffekte und Musik werden prozedural per Code erzeugt. Das Spiel ist vollständig **zweisprachig (Deutsch / English)**.

## Starten

Die Website über **http(s)** ausliefern, z. B. im Repository-Ordner `npx serve .` oder `python3 -m http.server 8080`, dann
`http://localhost:8080/` (Website) bzw. `http://localhost:8080/play/` (Spiel) öffnen (Seiten und Spiel nutzen relative Pfade; nur die
404-Seite erwartet den Ordner `/dungeons/`). Für Online-Konten (Clerk) ist http(s) Pflicht,
`file://` geht nicht. Ohne Konfiguration läuft das Spiel im **Gastmodus** mit lokalem Speicher.

## Landing Page (Website)

Adresse: **https://aetherfallroe.com/dungeons/** – Startseite mit Anmeldung und allen Rechtsseiten, von dort ins Spiel unter
`/dungeons/play/` (gleiche Domain, damit Website und Spiel dieselbe Clerk-Sitzung nutzen). Auf `aetherfallroe.com/` selbst liegt
*Aetherfall: Realm of Embers*; die Website bleibt vollständig im Ordner `dungeons/`. Statisches HTML/CSS/JavaScript ohne Framework und
ohne Build-Schritt – jeder einfache Webspace reicht (gehostet bei iFastNet, Apache).

### Ordnerstruktur

```
dungeons/                      Ordner auf dem Webspace (public_html/dungeons/ = https://aetherfallroe.com/dungeons/)
├── index.html                 Startseite (Hero, Features, Galerie, Trailer, Story, FAQ, Neuigkeiten)
├── anmelden.html              Anmeldung (Clerk SignIn inkl. „Passwort vergessen“)
├── registrieren.html          Registrierung (Pflicht-Zustimmung + Clerk SignUp)
├── impressum.html             Impressum            ┐
├── datenschutz.html           Datenschutzerklärung │ Entwürfe, Texte in assets/js/lang-legal.js
├── agb.html                   Nutzungsbedingungen  │ (Deutsch + Englisch)
├── widerruf.html              Widerrufsbelehrung   ┘
├── kontakt.html               Kontakt (E-Mail, Themen mit Betreff, Postanschrift – bewusst ohne Formular)
├── 404.html                   Fehlerseite (absolute Pfade /dungeons/…, da unter beliebigen Adressen ausgeliefert)
├── favicon.ico  sitemap.xml  site.webmanifest
├── robots.txt                 nur Vorlage – Suchmaschinen lesen robots.txt ausschließlich im Hauptverzeichnis der Domain
├── .htaccess                  Apache: Fehlerseite, HTTPS, /play → /play/, Sicherheits-Header/CSP, Caching
├── assets/
│   ├── css/site.css           Gestaltung (Tokens in :root, responsiv, Fokus, reduzierte Bewegung, Druck)
│   ├── fonts/                 Press Start 2P + VT323 (woff2, OFL), fonts.css – lokal, auch vom Spiel genutzt
│   ├── img/                   favicon.svg, og-image.png (1200×630), apple-touch-icon.png, icon-192/512.png
│   ├── media/                 trailer.mp4 (1280×720, 64 s), trailer-poster.webp, trailer-en.vtt (englische Untertitel),
│   │                          shot-*.webp (Galerie, je 1280 px + 640 px; Karte und Creator je Sprache)
│   └── js/
│       ├── config.js          ZENTRALE KONFIGURATION (SITE_CONFIG)
│       ├── i18n.js            Sprachsystem (t('schluessel'), Sprachwahl, Speicherung)
│       ├── lang-site.js       Texte Website/Oberfläche (de/en)
│       ├── lang-legal.js      Rechtstexte (de/en)
│       ├── news.js            Neuigkeiten/Changelog (neuen Eintrag oben einfügen)
│       ├── site.js            Seitenaufbau, Navigation, Platzhalter, Grafiken, FAQ, News, Galerie, Trailer, strukturierte Daten
│       ├── auth.js            Clerk laden, Anmelde-/Registrierseite, Zustimmung (Tabelle consents)
│       └── clerk-de.js        deutsche Texte der Clerk-Komponenten (@clerk/localizations, MIT)
├── play/
│   ├── index.html             das Spiel (eine Datei)
│   └── vendor/                three.min.js (r128, MIT), supabase.js (supabase-js 2, MIT)
└── supabase/
    ├── schema.sql             Spielstände/Profile (bestehend)
    ├── migrate_save_slots.sql Migration 3 → 5 Slots (bestehend)
    ├── multiplayer.sql        Mehrspieler (bestehend)
    ├── consents.sql           NEU: Zustimmungsnachweise
    ├── account.sql            NEU: Kontolöschung (nur service_role) + Aufbewahrung von Meldungen
    └── functions/delete-account/index.ts   NEU: Edge Function „Konto und Daten löschen“
```

### Zentrale Konfiguration (`assets/js/config.js`)

Alle anpassbaren Werte stehen nur hier und werden automatisch in Startseite, Anmeldung und alle Rechtsseiten eingesetzt:
`SITE_URL`, `GAME_PATH`, `CLERK_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `CONTACT_EMAIL`, `MIN_AGE` (Standard 16),
`CONSENT_TEXT_VERSION`, die Angaben unter `LEGAL` (Betreiber, Anschrift, USt-ID, Hoster, Aufsichtsbehörde …), `LEGAL_DOCS`
(Version und Datum je Rechtstext) sowie die Medien `TRAILER_URL`, `TRAILER_POSTER`, `TRAILER_SUBTITLES`, `TRAILER_EMBED`, `SCREENSHOTS`.
Werte in `[ECKIGEN KLAMMERN]` sind Platzhalter – auch als Teil eines Werts, z. B. `'[VOR- UND NACHNAME] – RagedSky'`: Sie
werden auf der Seite gelb markiert und in der Konsole als Warnung gemeldet. Ein leerer Wert blendet die Angabe aus (z. B. keine USt-ID).
Texte, die je Sprache verschieden sind, als `{ de: '…', en: '…' }` angeben.

**Nur öffentliche Schlüssel** (Clerk Publishable Key, Supabase-URL und Publishable/Anon Key). Secret Keys (`sk_…`), Service-Role- oder
`sb_secret_…`-Schlüssel erkennt die Website, ignoriert sie und meldet einen Fehler in der Konsole.

### Sprachen

Wie im Spiel: Schlüssel und `t('schluessel')` in `assets/js/lang-site.js` und `lang-legal.js`, jeweils Deutsch und Englisch.
Beim ersten Besuch entscheidet die Browsersprache (`navigator.languages`), danach die gespeicherte Wahl (Umschalter in Kopf- und
Fußzeile). Gespeichert wird in `localStorage` (`aetherfall_lang`; gibt es schon Spieleinstellungen, auch in
`aetherfall_settings.lang` – derselbe Schlüssel wie im Spiel). Links ins Spiel tragen `?lang=de|en`, das Spiel übernimmt die Sprache.
Englische Fassung jeder Seite: `?lang=en` (so auch in `hreflang` und `sitemap.xml`). Suchmaschinen sehen immer die Sprache der Adresse.
Neue Sprache: Eintrag in `I18N.LANGS` (`i18n.js`) und `I18N.add('xx', {…})` in beiden Textdateien.

Der deutsche Text im HTML ist nur der Rückfall ohne JavaScript; maßgeblich sind die Textdateien. Die Rechtstexte werden vollständig
aus `lang-legal.js` aufgebaut (Abschnitte `präfix.s<n>.h/.b`, Inhaltsverzeichnis automatisch).

### Medien

- **Trailer:** eigene Datei `assets/media/trailer.mp4` (H.264/AAC, „faststart“ – startet sofort, ohne die ganzen 21 MB zu laden;
  geladen wird erst beim Abspielen). Die Texttafeln im Video sind deutsch; auf der englischen Seite sind englische Untertitel
  (`trailer-en.vtt`) automatisch eingeschaltet, auf der deutschen über das Untertitel-Menü des Players wählbar.
- **Galerie:** sechs echte Bilder aus dem Spiel bzw. Trailer (`SCREENSHOTS`: großes Bild `src`, Vorschau `thumb`, Alternativtext und
  Bildunterschrift je Sprache; Weltkarte und Charakter-Creator zeigen die Spieloberfläche in der jeweiligen Sprache). Ein Klick öffnet
  die Großansicht (`<dialog>`: Pfeiltasten blättern, Esc schließt, Fokus kehrt zurück); ohne JavaScript öffnet der Link das Bild.
  Neue Bilder: WebP mit 1280×720 und 640×360 nach `assets/media/` legen und in `SCREENSHOTS` eintragen. `[]` blendet die Galerie aus,
  `TRAILER_URL: ''` zeigt wieder den gezeichneten Platzhalter.
- **Externes Video:** Für YouTube & Co. `TRAILER_EMBED` setzen (statt `TRAILER_URL`): Es erscheint eine Zwei-Klick-Lösung
  mit gleichwertigen Knöpfen „Video laden“ / „Nicht laden“; erst nach Zustimmung wird der Anbieter kontaktiert, widerrufbar über
  „Einstellungen für externe Medien“ in der Fußzeile. Dann zusätzlich die Domain in der CSP (`frame-src`) ergänzen.

### Anmeldung mit Clerk

- **Komponenten:** `anmelden.html` bindet Clerk **SignIn** ein (inkl. Passwort-Reset, Zweitfaktor, soziale Logins, falls aktiviert),
  `registrieren.html` Clerk **SignUp**, die Kopfzeile den **UserButton** (Konto verwalten, Abmelden). Gestaltung über `appearance`
  (Farben/Schrift der Seite), deutsche Texte über `clerk-de.js`. Hash-Routing (`#/…`), daher keine Server-Regeln nötig.
- **Angemeldet:** Kopfzeile und Hero zeigen Anzeigename, Avatar und „Weiterspielen“ statt „Anmelden“. Der Gast-Einstieg bleibt
  immer möglich („Jetzt spielen“ = Gastmodus, auch wenn Clerk nicht erreichbar ist).
- **Datensparsam:** Auf normalen Seiten lädt Clerk nur, wenn bereits eine Sitzung besteht (Cookie `__client_uat`) oder eine Zustimmung
  aussteht. Telemetrie ist abgeschaltet. Ladezustände und übersetzte Fehlermeldungen; Fehler beim Anmeldedienst führen nie zum Absturz.
- **Registrierung:** Erst eine nicht vorausgewählte Pflicht-Checkbox „Ich akzeptiere die Nutzungsbedingungen und habe die
  Datenschutzerklärung gelesen“ (mit Links) und die Altersbestätigung (`MIN_AGE`, Standard 16) – dann erscheint das Clerk-Formular.
  Die Zustimmung wird mit Zeitstempel (Serverzeit), Textversion, Wortlaut, Versionen von AGB und Datenschutzerklärung, Sprache und Quelle
  in der Supabase-Tabelle **`consents`** gespeichert (REST mit dem Clerk-Token, RLS über `auth.jwt()->>'sub'`). Zusätzlich liegt sie
  als `unsafeMetadata.consent` am Clerk-Nutzer (Rückfall, falls der Tab gewechselt wurde).
- **Soziale Logins** auf der Anmeldeseite legen keine Konten an (`transferable: false`): neue Konten entstehen nur über die
  Registrierung mit Zustimmung.
- **Erneute Zustimmung:** Erhöhst du in `LEGAL_DOCS` die Version von `agb` oder `datenschutz`, fragen Website und Spiel angemeldete
  Nutzer beim nächsten Besuch erneut (Dialog mit beiden Checkboxen; „Später“ oder „Abmelden“ möglich). Dasselbe gilt für Konten ohne
  Nachweis (z. B. vor der Website angelegt).
- **Im Spiel:** Das Spiel erkennt die gemeinsame Sitzung und überspringt seinen eigenen Login-Bildschirm. Wer sich im Spiel
  registriert, muss dieselben Checkboxen bestätigen; der Nachweis landet ebenfalls in `consents` (Quelle `game`).

#### Clerk-Dashboard

1. **User & Authentication › Email, phone, username:** E-Mail-Adresse als Kennung, Verifizierung per **E-Mail-Code**;
   **Password** aktivieren (Passwort-Reset per E-Mail-Code ist dann automatisch dabei).
2. **SSO connections** (optional): z. B. Google; für die Produktion eigene OAuth-Zugangsdaten hinterlegen.
3. **Paths** (Komponenten-Pfade der Instanz): Sign-in-URL `https://aetherfallroe.com/dungeons/anmelden.html`, Sign-up-URL
   `https://aetherfallroe.com/dungeons/registrieren.html`, nach dem Abmelden `https://aetherfallroe.com/dungeons/`. (Die Website setzt
   diese Werte zusätzlich selbst, das Dashboard wird für E-Mail-Links und das Account Portal gebraucht.)
4. **Domains:** Produktionsinstanz für `aetherfallroe.com` anlegen und die angezeigten DNS-Einträge bei iFastNet setzen
   (cPanel › *Zone Editor*: CNAME `clerk` → Frontend-API, dazu `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey` – genaue
   Ziele zeigt das Clerk-Dashboard). Website und Spiel laufen auf derselben Domain; `https://www.aetherfallroe.com` ggf. als erlaubte
   Origin ergänzen. Die Entwicklungsinstanz (`pk_test_…`) funktioniert ohne DNS auch auf `localhost`.
5. **Integrations › Supabase** („Connect with Supabase“): setzt `role: authenticated` im Session-Token.
6. **Attack protection › Bot protection** kann aktiv bleiben (Cloudflare Turnstile, in der CSP freigegeben).
7. **Kontolöschung durch Nutzer im Clerk-Dialog ausschalten** (Einstellung „Allow users to delete their accounts“ / „Delete account“
   unter *User & Authentication*; Bezeichnung je nach Dashboard-Version) – sonst würde nur das Clerk-Konto ohne die Supabase-Daten
   gelöscht. Gelöscht wird über das Spiel (Edge Function, siehe unten).
8. Die Clerk-Option „Require express consent to legal documents“ **nicht** zusätzlich einschalten (sonst doppelte Checkbox; die
   Zustimmung läuft über die eigene Pflicht-Checkbox und `consents`).
9. Für den Livebetrieb den `pk_live_…`-Schlüssel in **beiden** Konfigurationen eintragen (`assets/js/config.js` und `play/index.html`).

### Supabase

Im SQL-Editor in dieser Reihenfolge ausführen (alle Skripte idempotent):

1. [`supabase/schema.sql`](supabase/schema.sql) – Profile und Spielstände (falls noch nicht geschehen)
2. [`supabase/multiplayer.sql`](supabase/multiplayer.sql) – optional, für den Mehrspieler
3. [`supabase/consents.sql`](supabase/consents.sql) – Tabelle `consents` mit RLS: Nutzer lesen und fügen nur **eigene** Zeilen ein
   (`auth.jwt()->>'sub' = user_id`), kein Ändern/Löschen; Serverzeit wird per Trigger erzwungen.
4. [`supabase/account.sql`](supabase/account.sql) – `af_delete_user_data(p_user)` (löscht alle Daten eines Kontos in einer
   Transaktion; nur `service_role`) und `af_cleanup_reports()` (Meldungen höchstens 180 Tage; mit pg_cron täglich).

Weiterhin: *Authentication › Sign In / Providers › Third-Party Auth* → Clerk eintragen. Für den Mehrspieler *Realtime › Settings*
„Allow public access“ ausschalten.

#### Edge Function „delete-account“ (Konto und Daten löschen)

[`supabase/functions/delete-account/index.ts`](supabase/functions/delete-account/index.ts) prüft das Clerk-Session-Token (Signatur über
die JWKS der Clerk-Instanz, Aussteller, Ablauf, Herkunft), verlangt `{ "confirm": "DELETE" }`, löscht mit dem **Service-Role-Key
serverseitig** alle Daten in Supabase (`af_delete_user_data`) und danach den Nutzer über die Clerk Backend API. Es stehen keine
Secrets im Code – alles kommt aus Umgebungsvariablen:

```bash
supabase functions deploy delete-account --no-verify-jwt     # Clerk-Token wird in der Funktion selbst geprüft
supabase secrets set CLERK_SECRET_KEY=sk_live_…              # Clerk Dashboard › API Keys (nur hier, nie im Frontend)
supabase secrets set CLERK_ISSUER=https://clerk.aetherfallroe.com    # Frontend-API-URL (Entwicklung: https://<name>.clerk.accounts.dev)
supabase secrets set ALLOWED_ORIGINS=https://aetherfallroe.com,https://www.aetherfallroe.com
# SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase in Edge Functions automatisch bereit.
```

Ist die Funktion nicht erreichbar, zeigt das Spiel einen Kontaktweg (Kontaktseite, E-Mail mit Konto-ID).

### Rechtliches im Spiel (minimale, markierte Änderungen)

Alle Änderungen am Spiel sind mit `LANDING-ANBINDUNG` markiert; die Logik steckt in einem eigenen Abschnitt (`SiteLink`). Im Einzelnen:

| Stelle | Änderung |
|---|---|
| `<head>` | Google Fonts → `../assets/fonts/fonts.css` (lokal); `CONFIG` um `siteUrl`, `legalTerms`, `legalPrivacy`, `consentTextVersion`, `minAge`, `deleteFunction` ergänzt |
| Sprachstart | `?lang=de|en` hat Vorrang (auch für den Ladebildschirm) und wird dauerhaft übernommen |
| Bibliotheken | `vendor/three.min.js` und `vendor/supabase.js` zuerst, CDNs nur als Ersatz |
| `Game.initOnline` | bei bestehender Clerk-Sitzung kein eigener Login-Bildschirm (Codeblock unten) |
| `Auth.init` | `Clerk.load({ telemetry: false })` – keine Clerk-Telemetrie |
| Registrierung im Spiel | Pflicht-Checkboxen Nutzungsbedingungen/Datenschutz + Mindestalter |
| Hauptmenü | Links Impressum · Datenschutz · AGB · Widerruf · Kontakt (neuer Tab, Sprache wird mitgegeben) |
| Einstellungen › Konto | „Meine Daten exportieren“ (JSON), „Konto und Daten löschen“ (angemeldet) bzw. „Lokale Daten löschen“ (Gast), Rechtslinks |
| Texte | neue Schlüssel `site.*`, `auth.err.af_consent/af_age` (de/en) über das bestehende i18n |

```js
// === LANDING-ANBINDUNG: Bei bestehender Clerk-Sitzung (z. B. von der Website) keinen Login-Bildschirm zeigen ===
const shared = SiteLink.sessionHint();            // Cookie __client_uat ≠ 0 → angemeldet
if (needLogin && !shared) LoginUI.open(() => this.showTitleMenu());
…
else if (needLogin && shared) LoginUI.open(() => this.showTitleMenu()); // Sitzung inzwischen abgelaufen
```

„Jetzt spielen“ auf der Website öffnet `play/?lang=…&start=guest` (Gastmodus ohne Login-Bildschirm), „Weiterspielen“ `play/?lang=…`.
Die Parameter werden nach dem Start aus der Adresse entfernt; personenbezogene Daten stehen nie in einer URL.

**Export** (`aetherfall-daten-JJJJ-MM-TT.json`): Konto (ID, E-Mail, Name), Einstellungen, lokale Spielstände und Sicherungen dieses
Kontos, angemeldet zusätzlich Cloud-Profil, Cloud-Spielstände, Zustimmungsnachweise, Freunde und Blockierungen.
**Löschen:** Erklärung, was gelöscht wird, „Erst exportieren“, Bestätigung durch Eintippen von `LÖSCHEN`/`DELETE`, dann Edge Function,
lokale Kopien des Kontos entfernen, abmelden (ohne erneuten Cloud-Abgleich).

### Hosting

**iFastNet (Premium, cPanel, Apache)** – die Website liegt im Ordner `public_html/dungeons/`:

1. Hochladen (cPanel › *Dateimanager* oder FTP): `index.html`, `anmelden.html`, `registrieren.html`, `impressum.html`,
   `datenschutz.html`, `agb.html`, `widerruf.html`, `kontakt.html`, `404.html`, `favicon.ico`, `sitemap.xml`, `site.webmanifest`,
   `.htaccess` sowie die Ordner `assets/` und `play/` nach `public_html/dungeons/`. **Nicht** hochladen: `supabase/`, `README.md`,
   `.git` (die `.htaccess` sperrt sie zusätzlich). Dateien mit Punkt (`.htaccess`) im Dateimanager über *Einstellungen › Versteckte
   Dateien anzeigen* sichtbar machen.
2. **HTTPS** (bei iFastNet bereits aktiv) ist Pflicht für Clerk. Die `.htaccess` leitet auf HTTPS um und setzt HSTS ohne
   `includeSubDomains` – HSTS gilt trotzdem für den ganzen Host `aetherfallroe.com`, also auch für die Hauptseite.
3. **robots.txt:** Suchmaschinen lesen nur `https://aetherfallroe.com/robots.txt` (Hauptseite). Dort die Zeile
   `Sitemap: https://aetherfallroe.com/dungeons/sitemap.xml` ergänzen; die Datei `dungeons/robots.txt` ist nur die Vorlage.
4. **Server-Logs** (für die Datenschutzerklärung, `LEGAL.LOG_DAYS`): cPanel › *Metriken › Raw Access* – „Archive logs in your home
   directory“ ausschalten bzw. „Remove the previous month's archived logs“ einschalten. Wie lange iFastNet selbst Logs aufbewahrt und
   ob ein Vertrag zur Auftragsverarbeitung (AV-Vertrag) möglich ist, beim iFastNet-Support erfragen (`LEGAL.HOSTING_DPA`).
5. **Prüfen:** `https://aetherfallroe.com/dungeons/` lädt, `…/dungeons/gibtsnicht` zeigt die 404-Seite, `…/dungeons/play` leitet auf
   `…/dungeons/play/` um, in den Entwicklertools (Netzwerk › Antwort-Header) stehen `Content-Security-Policy` und `X-Frame-Options`.

**Sicherheits-Header** (`.htaccess`): CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS. Erlaubte Fremdquellen: Clerk (`*.clerk.accounts.dev`,
`clerk.aetherfallroe.com`, `img.clerk.com`), Cloudflare Turnstile (`challenges.cloudflare.com`, Bot-Schutz von Clerk), Supabase
(`*.supabase.co`, für das Spiel auch `wss://`). Die Header-CSP erlaubt, was das Spiel braucht (inline-Skripte der Einzeldatei); die
Website-Seiten verschärfen sie per `<meta http-equiv="Content-Security-Policy">` (keine inline-Skripte). Eigene Supabase-Domain oder
externe Videos → CSP ergänzen (Header und `<meta>`).

**Anderer Ort oder anderer Hoster:** Die Adresse steht in `assets/js/config.js` (`SITE_URL`), in den `<head>`-Bereichen der HTML-Dateien
(canonical, hreflang, Open Graph), in `sitemap.xml`, `robots.txt`, in der `.htaccess` (`/dungeons/`) und in `404.html` (absolute Pfade).
Ersetzen z. B. mit `grep -rlI --exclude-dir=.git 'aetherfallroe\.com/dungeons' . | xargs sed -i 's#aetherfallroe\.com/dungeons#neue-domain.de#g'`
und danach `/dungeons/` in `.htaccess` und `404.html` anpassen. nginx: `error_page 404 /dungeons/404.html;`, die Header aus der
`.htaccess` per `add_header … always;`. Netlify/Cloudflare Pages: die Header als `_headers`-Datei anlegen.

### Datenschutz-Technik

Keine Tracker, keine Analyse, keine Werbung, keine Einwilligungs-Banner nötig: Schriften, Three.js und supabase-js liegen lokal; ohne
Anmeldung lädt die Website nichts von Dritten und setzt keine Cookies. Gespeichert werden nur technisch notwendige Einträge
(`aetherfall_lang`, Spiel-Einstellungen/-Spielstände, während der Registrierung `aetherfall_pending_consent` im sessionStorage,
Clerk-Sitzungscookies) – alle aufgelistet in der Datenschutzerklärung, Abschnitt 9. Speicherzugriffe laufen in try/catch mit Warnung
in der Konsole.

### Platzhalter, die du ausfüllen musst

| Wo | Platzhalter |
|---|---|
| `assets/js/config.js` | **offen:** `LEGAL.NAME` `[VOR- UND NACHNAME] – RagedSky` (Betreiber als Einzelunternehmen), `LEGAL.VAT_ID` `[UST-ID]`, `LEGAL.HOSTING_DPA` (AV-Vertrag mit iFastNet), `LEGAL.LOG_DAYS` (Log-Speicherdauer bei iFastNet); **nach der Gründung der UG:** `NAME` mit Rechtsform („i. G.“ bis zur Eintragung), `REPRESENTED` (Geschäftsführung), nach der Eintragung `REGISTER`; **ausgefüllt:** `SITE_URL`, `CONTACT_EMAIL`, `ADDRESS` (c/o-Anschrift in Duisburg), `PRIVACY_EMAIL`, `AUTHORITY` (LDI NRW), `HOSTING` (iFastNet), `HOSTING_THIRD_COUNTRY` (UK, Angemessenheitsbeschluss), `SUPABASE_REGION` (EU, Irland); `LEGAL_DOCS` (Version/Datum) |
| `assets/js/config.js` und `play/index.html` (`CONFIG`) | nach der Umstellung auf Clerk-Produktion `pk_live_…` in **beiden** Dateien; `legalTerms`, `legalPrivacy`, `minAge` im Spiel passend zu `config.js` |
| Datenschutz Abschnitt 16, AGB § 7 (als inaktiv markiert) | `[ZAHLUNGSANBIETER …]`, `[PREISE …]`, Fristen – erst bei Einführung eines Shops |
| Supabase Secrets | `CLERK_SECRET_KEY`, `CLERK_ISSUER`, `ALLOWED_ORIGINS` (nur serverseitig) |

Die Rechtstexte sind **Entwürfe und ersetzen keine Rechtsberatung** (Hinweis als HTML-Kommentar in jeder Rechtsseite); bitte vor
der Veröffentlichung prüfen lassen.

### Tests

Ende-zu-Ende in Deutsch und Englisch (Playwright, echter HTTP-Server unter `/dungeons/` mit den Headern der `.htaccess`, Clerk-Testattrappe, PostgREST-Nachbildung gegen
eine lokale Postgres-Datenbank mit den Skripten aus `supabase/`): Startseite, Links, Fußzeile, Rechtsseiten mit eingetragenen Daten,
SEO, Registrierung mit Pflicht-Checkbox und Speicherung in `consents`, Anmelden/Abmelden/Passwort-Reset, erneute Zustimmung, Spielstart
als Gast und angemeldet (Sitzung und Sprache übernommen), Rechtslinks/Export/Löschen im Spiel, mobile Breiten 320/390 px, Tastatur,
reduzierte Bewegung, axe-core (WCAG 2.1 AA inkl. Kontrast), keine Konsolenfehler, keine Anfragen an Dritte ohne Anmeldung.
SQL (RLS, Rechte, Löschfunktion) und die Edge Function (Signatur, Aussteller, Herkunft, Bestätigung, Löschung, Clerk-Fehler) sind
separat getestet. Dazu Galerie (Bilder je Sprache, Großansicht mit Tastatur), Trailer (Teilabruf, Untertitel), Adressen unter
`/dungeons/`, Header/Weiterleitung/Sperren der `.htaccess` sowie die echte `config.js` mit ihren markierten offenen Angaben.
Lighthouse (mobil, lokaler Server mit gzip): Startseite (de/en) und Datenschutz je 100 / 100 / 100 / 100 (Leistung,
Barrierefreiheit, Best Practices, SEO); Anmelde- und Registrierseite sind bewusst `noindex`.

## Konfiguration (Online-Konten und Cloud-Spielstände)

Ganz oben in `play/index.html` steht der klar markierte Block `CONFIG` (die Website hat ihren eigenen, siehe [Landing Page](#landing-page-website)):

```js
const CONFIG = {
  clerkPublishableKey: '',      // pk_test_… / pk_live_…
  clerkJsUrl: '',               // optional: eigene Clerk-Script-URL
  clerkJsVersion: '5',          // Hauptversion von @clerk/clerk-js
  supabaseUrl: '',              // https://<projekt>.supabase.co
  supabaseKey: '',              // Publishable- oder Anon-Key
  autosaveSeconds: 60,          // Cloud-Autosave-Intervall
  saveSlots: 5,                 // manuelle Speicherslots (Supabase-Check-Constraint passend setzen)
  // === LANDING-ANBINDUNG === (müssen zu assets/js/config.js passen)
  siteUrl: '../',               // Website relativ zum Spiel ('' = keine Rechtslinks)
  legalTerms: '1.0',            // = LEGAL_DOCS.agb.version
  legalPrivacy: '1.0',          // = LEGAL_DOCS.datenschutz.version
  consentTextVersion: '1',      // = CONSENT_TEXT_VERSION
  minAge: 16,                   // = MIN_AGE
  deleteFunction: 'delete-account', // Supabase Edge Function für die Kontolöschung
};
```

**Nur öffentliche Schlüssel eintragen.** Secret Keys (`sk_…`), der Supabase-Service-Role- bzw. Secret-Key (`sb_secret_…`) und
Passwörter gehören nie in den Code. Das Spiel erkennt solche Schlüssel, ignoriert sie, gibt eine Fehlermeldung in der Konsole aus und
zeigt eine Warnung unter Einstellungen › Konto. Einen versehentlich veröffentlichten geheimen Schlüssel sofort im Dashboard austauschen.

### Einrichtung

1. **Clerk:** Anwendung anlegen, „E-Mail + Passwort“ (mit E-Mail-Code) und optional Google aktivieren. Die Domain, auf der das
   Spiel läuft, als erlaubte Origin bzw. Redirect-URL eintragen. Den *Publishable Key* in `CONFIG.clerkPublishableKey` eintragen.
   Das Clerk-Script wird über das offizielle CDN der Instanz geladen (`https://<frontend-api>/npm/@clerk/clerk-js@5/dist/clerk.browser.js`,
   Ersatz: jsDelivr). Weitere Dashboard-Einstellungen für Website und Spiel: [Landing Page › Clerk](#clerk-dashboard).
2. **Clerk mit Supabase verbinden:** im Clerk-Dashboard „Connect with Supabase“ ausführen. Das setzt den Claim `role: authenticated`
   in den Session-Tokens.
3. **Supabase:** unter *Authentication › Third-Party Auth* Clerk als Anbieter hinzufügen. Danach im SQL-Editor
   [`supabase/schema.sql`](supabase/schema.sql) ausführen (neues Projekt). Ein bestehendes Projekt mit 3 Slots stellt
   [`supabase/migrate_save_slots.sql`](supabase/migrate_save_slots.sql) auf 5 Slots um: idempotent, ohne Datenverlust, in einer
   Transaktion (Slot-Bereich 1–5, Unique `(user_id, slot)`, Spalte `deleted_at` als Löschmarker, vollständige RLS-Policies).
   Beide Skripte stehen auch als nicht ausgeführte Codeblöcke am Ende von `play/index.html`.
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
- **5 Speicherslots** je Konto bzw. für den Gastmodus (Anzahl nur über `CONFIG.saveSlots`) plus eine **automatische Sicherung**
  als eigene Karte (rollende Kopie des zuletzt automatisch gespeicherten Stands mit Herkunfts-Slot).
- **Spielstand-Menü** im Hauptmenü und im Pausemenü. Jede Karte zeigt:
  - Slotnummer, Porträt und Name
  - Klasse, Stufe, Region, Schwierigkeit
  - Story-Fortschritt in %, Spielzeit, letzte Speicherung
  - Cheats-Kennzeichen und Sync-Status (lokal, synchron, Upload ausstehend, nur in der Cloud, Fehler)

  Aktionen je Slot: Laden, Hier speichern bzw. Überschreiben, Kopieren, Umbenennen, Sicherungen, Löschen. Bedienbar mit Maus,
  Touch, Tastatur (Enter/Esc, Strg+Z) und Gamepad (A/B). Das Menü skaliert mit der HUD-Größe und passt ins Hochformat.
- **Überschreiben** eines belegten Slots: Vergleich „Aktuell im Slot“ ↔ „Neuer Stand“ (Charakter, Stufe, Region, Spielzeit).
  - Vorher wird der alte Stand automatisch gesichert (Menü › Sicherungen oder `/restore`).
  - Der neue Stand gewinnt auch in der Cloud, ohne Konfliktdialog.
  - Wird der gerade gespielte Slot überschrieben, geht es mit dem neuen Stand weiter.
- **Löschen** mit Slot-Details und Sicherheitsabfrage: Knopf gedrückt halten (Maus, Touch, Enter/Leertaste, Gamepad A).
  - 10 Sekunden lang lässt sich das Löschen rückgängig machen, danach ist es endgültig.
  - Angemeldet bleibt ein Löschmarker, bis die Cloud das Löschen bestätigt hat. So kehrt der Slot weder nach F5 noch nach
    Ab-/Anmelden oder Offline-Phasen als „Geisterstand“ zurück.
  - Wer den gerade gespielten Slot löscht, kehrt ohne Speichern ins Hauptmenü zurück.
- **Fehler** erscheinen in der Sprache des Spielers: Netzwerk, fehlende Berechtigung, Slot von der Tabelle noch nicht erlaubt,
  Speicher voll. Der Stand bleibt dabei unverändert. Ein Vorgang gilt erst als abgeschlossen, wenn das Schreiben bestätigt ist.
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
  `/restore` (die letzten 3 je Slot, lokal); `/backup` sichert von Hand, `/backup list [slot]` zeigt die Sicherungen eines Slots (1–5), `/restore [n]` stellt wieder her. Vor jedem
  Überschreiben im Spielstand-Menü wird ebenfalls gesichert.
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

## Darstellung und Fehlerschutz

- **Titelbildschirm:** Hinter dem Menü dreht die Kamera eine Runde über Lager und Stadt Ehbergten (Boden, Gebäude,
  Bäume, Licht, Wetter, NPCs). Die Kulisse gehört zu keinem Spielstand; ihr Nebel des Krieges wird nie gespeichert.
- **Jede Phase einzeln geschützt:** Eingabe, Spielablauf, Himmel, Effekte, Wetter, Licht, Kamera, HUD und das Zeichnen
  laufen getrennt. Ein Fehler in einer Phase hält die anderen nicht an. Er erscheint in der Konsole
  (`[Aetherfall · Darstellung] Ebene „…“` mit Zustand, Region und Anzahl) und im Debug-Log (`/debug log`). Scheitert
  die Nachbearbeitung (Bloom) dreimal, wird die Szene direkt gezeichnet.
- **Szenen-Wächter:** Nach jedem Szenenwechsel und danach jede Sekunde prüft das Spiel Zeichenfläche, Kamera
  (keine NaN-Werte, Schwenk-Offset), Welt in der Szene, Nebel und ob Welt-Meshes im Sichtfeld liegen.
  - Ist etwas falsch, setzt es Kamera und Szene zurück.
  - Wird die Welt trotzdem leer gezeichnet, baut es die Szene neu auf (Titel oder Region).
  - Jede Reparatur steht im Debug-Log.
- **Nebel und Kameraabstand:** Auch im Hochformat, ganz herausgezoomt und bei Nebelwetter verschwindet die Umgebung der
  Figur nie ganz im Nebel.

## Mehrspieler (Koop für 2–4 Spieler)

Im Hauptmenü öffnet **Mehrspieler** den Koop-Modus. Er braucht ein Konto (Clerk) und die Supabase-Verbindung; der Einzelspieler
bleibt vollständig offline und ohne Anmeldung spielbar. Die Mehrspieler-Module werden erst beim ersten Öffnen des Menüs eingehängt –
vorher läuft der Einzelspieler exakt wie bisher (kein zusätzlicher Netzverkehr, keine zusätzlichen Hüllen im Spieltakt).

### Einrichtung in Supabase

1. Voraussetzung: [`supabase/schema.sql`](supabase/schema.sql) ist eingespielt, Clerk ist unter *Authentication › Third-Party Auth*
   als Anbieter eingetragen (wie bei den Cloud-Spielständen).
2. [`supabase/multiplayer.sql`](supabase/multiplayer.sql) im SQL-Editor ausführen (idempotent, ändert keine Spielstände; steht auch als
   nicht ausgeführter Codeblock am Ende von `play/index.html`). Es legt an: `lobbies`, `lobby_members`, `friends`, `player_blocks`,
   `lobby_invites`, `player_reports`, die Spalten `profiles.mp_name/mp_tag/last_seen`, alle Datenbankfunktionen `mp_*`
   (SECURITY DEFINER, prüfen `auth.jwt()->>'sub'`), Row-Level-Security-Policies und die **Realtime-Authorization**-Policies auf
   `realtime.messages` (nur Mitglieder einer Lobby dürfen auf dem privaten Kanal `lobby:<uuid>` senden und empfangen – Broadcast und Presence).
3. **Realtime** muss für das Projekt aktiv sein (Standard). Unter *Realtime › Settings* die Option **„Allow public access“ ausschalten**,
   damit nur private Kanäle mit Autorisierung möglich sind (das Spiel nutzt ausschließlich private Kanäle).
4. Optional **pg_cron** aktivieren (*Database › Extensions*) und das Skript erneut ausführen: dann räumt `mp_cleanup()` alle 15 Minuten
   abgelaufene Lobbys auf. Ohne pg_cron räumt jedes Erstellen einer Lobby auf.
5. Meldungen (`player_reports`) lesen nur Konten mit `profiles.is_admin = true` (Tabelleneditor oder SQL); Spieler können sie nur anlegen.

Im Frontend stehen weiterhin nur der Clerk Publishable Key und Supabase-URL + Publishable/Anon Key (`CONFIG`). Kontingent: Supabase
Realtime begrenzt Nachrichten pro Sekunde (Free-Plan ca. 100). Jeder Teilnehmer sendet gebündelt 5–12 Nachrichten pro Sekunde
(bei 4 Spielern automatisch höchstens 7); bei Ablehnungen drosselt das Spiel selbst. Für viele gleichzeitige Gruppen „Niedrig“ wählen
oder einen größeren Plan nutzen.

### Lobby, Freunde, Einladungen

- **Lobby erstellen:** Sichtbarkeit (privat/öffentlich), 2–4 Spieler, Schwierigkeit (Story/Normal/Schwer), optionales Passwort
  (bcrypt in der Datenbank), Beute (eigene Beute / Reihum / Bedarf & Gier), Friendly Fire, Wiederbeleben, Stufenband (Sidekick oder
  nur Warnung) und – nur privat – „Cheats erlauben“. Beitrittscode mit 8 gut lesbaren Zeichen (`ABCD-EFGH`, ohne 0/O/1/I) und
  **Einladungslink** (`…?lobby=CODE`); Codes laufen ab und verlängern sich nur, solange die Lobby aktiv ist (höchstens 24 h).
- **Beitreten** per Code, per Link, per **Schnellbeitritt** (öffentliche Lobbys mit gleicher Spielversion: Host, Region, Story-Fortschritt,
  Spielerzahl, Sprache, Passwort-Symbol) oder über eine **Einladung** eines Freundes.
- **Lobby-Raum:** Vorschau aller Charaktere (Porträt, Klasse, Stufe, Stufenwarnung), Bereit-Status, Lobby-Chat, Host kann entfernen
  (Kick, dauerhaft für diese Lobby) und die Lobby sperren. Start, sobald alle bereit sind. Spieler können während der Sitzung dazukommen.
- **Freunde:** per `Name#Kennung` hinzufügen, Anfragen annehmen/ablehnen, Online-Status, Einladen, Entfernen, Sperrliste mit „Freigeben“.
  Blockierte können nicht einladen, nicht flüstern und nicht handeln. Mitspieler sehen nur Anzeigename#Kennung, Klasse, Stufe und
  Aussehen – nie E-Mail-Adressen oder Konto-IDs (im Netz trägt jeder eine zufällige Sitzungs-ID). Der Mehrspieler-Name ist ein eigener
  Wert (Standard: Name des Charakters), nicht der Kontoname.

### Spielstände

Die **Welt gehört dem Host** (Story, Quests, Rätsel, Bossstatus, Weltstufe – aus seinem Slot). Jeder bringt seinen **eigenen Charakter**
aus einem seiner Slots mit und behält Stufe, Erfahrung, Ausrüstung, Beute und Bossbelohnungen im eigenen Slot. Entdecktes (Regionen,
Dungeons) wird ergänzt, nie überschrieben; Regionen, die nur der Host freigeschaltet hat, sind in der Sitzung betretbar, nach der
Sitzung kehrt man an den letzten eigenen Ort zurück. Gespeichert wird beim Verlassen, nach wichtigen Ereignissen (Bosse, Handel,
Würfeln) und alle 45 s; schlägt das Speichern fehl, erscheint eine Warnung. **Spielstände aus Mehrspielersitzungen sind für künftige
Ranglisten nicht verifiziert** (`flags.mp_unverified`, `mp.unverified`); genutzte Cheats setzen `cheats_used`.

### Gemeinsam spielen

- **Gegner und Bosse** simuliert der Host. Aggro aus Schaden, Nähe, Klasse (Krieger zieht mehr) und Spott (Krieger-Spezialangriff).
  Skalierung nicht linear aus einer zentralen Tabelle (`BAL.mp` in `b_util_data.js`): Leben normaler Gegner ×1 / 1,55 / 2,0 / 2,4,
  Bosse ×1 / 1,7 / 2,3 / 2,85, Bossschaden bis ×1,1, mehr Beschwörungen und dichtere Geschossringe; dazu der Schwierigkeitsfaktor der
  Lobby. Ändert sich die Spielerzahl, passen sich lebende Gegner an.
- **Telegrafen, Laser, Felder, Wellen und Sonderangriffe** sehen alle; Flächenangriffe (z. B. Trap Kick, Shattered Reality) treffen
  jeden Spieler im Bereich. Ausweichen per Rolle/Sprung wird gegen die eigene Position zum Trefferzeitpunkt geprüft (Lag-Kompensation).
- **Am Boden statt Game Over:** Mitspieler beleben durch Halten der Interagieren-Taste (3 s, Fortschrittsbalken bei beiden) wieder;
  nach 30 s oder ohne Wiederbeleben erscheint man am Wegstein. **Fallen alle, wird der Kampf zurückgesetzt.**
- **Beute:** eigene Beute (Standard, keine Duplikate – jeder würfelt für sich), Reihum oder Bedarf & Gier (Würfelfenster bei allen).
  Bossbelohnungen erhält jeder.
- **Koop-Rätsel** (je Zone eine Koop-Prüfung, nur zu zweit lösbar, jeder bekommt eine eigene Truhe): Zwillingshebel, Druckplatte & Tor,
  Zahnradkette, Spiegelrelais, Staffellauf (Parkour), Waage. Alle bisherigen Rätsel bleiben allein lösbar; löst sie jemand, gilt das für die Gruppe.
- **Gruppenbuffs** (Schild und Heilung wirken auf Mitspieler in der Nähe, Spott des Kriegers), **Element-Kombos über Spieler hinweg**
  (Frost des einen + Blitz des anderen), **Friendly Fire** als Option, unterscheidbare Schadenszahlen (eigene / Mitspieler).
- **Quests:** gemeinsamer Fortschritt (Sammeln, Eskorte, Abschluss beim Host zählt für alle). **Story:** der Host entscheidet, alle
  sehen Szene und Wahl; Überspringen nur, wenn alle zustimmen.
- **Reisen:** Clients folgen dem Host; eigene Reisewünsche gehen als Anfrage an ihn. **Gruppen-Schnellreise** zu einem Mitspieler
  (Wegstein in seiner Nähe, Abklingzeit 60 s). Mitspieler auf Karte, Minimap und Kompass, Pings auch auf der Karte.
- **Handel** mit beidseitiger Bestätigung (Prüfsumme über beide Angebote, erst erhalten, dann abgeben, sofort speichern).

### Chat, Pings, Befehle

Kanäle: Gruppe, Lobby, Flüstern (`/w Name text`), System. Kein globaler Chat. Texte anderer Spieler werden immer als Text angezeigt
(nie als HTML), gekürzt (200 Zeichen), gedrosselt (5 je 5 s) und auf Wunsch gefiltert. `/party`, `/mute`, `/block`, `/report`
(Grund + Notiz, speichert die letzten Chatzeilen in `player_reports`). **Pings** (Taste **5**, Gamepad **L3+D↑**) und
**Schnellnachrichten** (Taste **6**, Gamepad **L3+D↓**): kurz tippen für „Hierhin“ bzw. halten und Richtung wählen; auf Touch eigene
Knöpfe mit antippbarem Auswahlkreis. Beide Tasten sind unter Einstellungen › Steuerung frei belegbar (auch Kombinationen).

Testwerkzeuge (nur Entwicklermodus/Admin, gelten nicht als Cheat): `/mp status`, `/mp simulate <0–3>` (Offline-Sitzung mit
Bot-Mitspielern), `/mp lag <ms>`, `/mp loss <prozent>`, `/mp kick <name>`, `/mp host`, `/mp coop <variante>`. `/debug net` (für alle,
auch in Sitzungen) blendet das Netzwerk-Overlay ein (Rolle, Pakete/s, KB/s, offene/wiederholte Nachrichten, Ping je Spieler).

Einstellungen › **Mehrspieler**: Anzeigename, bevorzugte Sichtbarkeit, Ping-Anzeige, Namensschilder, Lebensbalken über Mitspielern
(skaliert mit der HUD-Größe), Chat-Filter, Sprach-Hinweise (aus), Netzwerk-Qualität (5 / 8 / 12 Takte pro Sekunde), Debug-Overlay.
Beim ersten Öffnen erklärt eine kurze Einführung Host-Welt, eigene Charaktere, Cheats und Verifizierung.

### Technik und Sicherheit

- **Transport:** Supabase Realtime, ein privater Kanal je Lobby (`lobby:<uuid>`), Broadcast für gebündelte Spielnachrichten,
  Presence für Anwesenheit/Bereit-Status. Protokollversion `MP_PROTO` und Spielversion werden beim Beitritt geprüft (Datenbank und Kanal).
- **Host-autoritativ** für Gegner, Bosse, Beute-Würfe, Rätsel und Begegnungen; Clients simulieren die eigene Figur (Client-Side
  Prediction) und schicken Zustand (5–12 Hz) und Trefferansprüche. Snapshots als Deltas mit Schlüsselbildern alle 2 s und
  Interessenbereich; Interpolation mit kurzer Extrapolation (max. 0,25 s).
- **Zuverlässige Nachrichten** mit Sequenznummern, Bestätigungen, Wiederholung, Reihenfolge je Absender, Untergrenze je Empfänger
  (keine Lücken für spät Beigetretene) und Verbindungskennung (Wiederverbinden setzt sauber neu auf, offene Nachrichten werden neu gesendet).
  Token-Eimer gegen Ratenlimits.
- **Ausfälle:** Wiederverbinden mit Spielstand (90 s Fenster), Host-Migration an den am längsten anwesenden Mitspieler (nach kurzer
  Schonfrist), sauberes Ende ohne Kandidaten. Fehler werden abgefangen (Debug-Log), das Spiel stürzt nicht ab.
- **Anti-Cheat:** Cheats und Admin-Befehle sind in Sitzungen gesperrt (Ausnahme: private Lobby, vom Host erlaubt – sichtbarer Hinweis,
  Flag `cheats_used`). Der Host prüft Bewegung (Geschwindigkeit, gekennzeichnete Teleports höchstens 8/min auf begehbare Felder),
  Reichweite, Schaden je Treffer und je Sekunde (abhängig von der Stufe), Trefferrate, Zustände und Kombos; Verstöße bauen sich ab,
  nach 8 wird der Spieler entfernt. Clients prüfen Kill-Rate und Bossbelohnungen, Gegenstände aus Handel/Würfeln werden bereinigt
  und auf eine plausible Stufe begrenzt.
- **Grenzen:** Ohne eigenen Spieleserver ist das Modell nicht manipulationssicher – ein veränderter Client kann seinen eigenen
  Spielstand fälschen, ein veränderter Host die Welt seiner Gruppe. Deshalb gelten Mehrspieler-Stände als nicht verifiziert. Die
  Prüfungen (`MPSec`) sind so geschrieben, dass sie später eine Supabase Edge Function als Schiedsrichter übernehmen kann.

## Einstellungen

Tabs **Allgemein** (Sprache, Weltstufe, Tipps & Tutorials) · **Steuerung** · **Grafik** · **Audio** · **Anzeige**
(Navigationshilfen, Quest-Tracker, Minikarte) · **Konto** (Anmeldung, Slots, Chat & Entwickler, Konsole, Befehlsprotokoll) · **Mehrspieler**. Alle Einstellungen werden lokal gespeichert und – wenn man
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
