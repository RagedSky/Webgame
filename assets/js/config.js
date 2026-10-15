/* ==========================================================================
   KONFIGURATION (CONFIG) · Website „Aetherfall: Dungeons“
   --------------------------------------------------------------------------
   Alle Angaben, die du anpassen musst, stehen NUR hier. Sie werden beim Laden
   automatisch in die Landing Page, die Anmeldung und alle Rechtsseiten
   (Impressum, Datenschutz, AGB, Widerruf, Kontakt) eingesetzt.

   Werte in [ECKIGEN KLAMMERN] sind Platzhalter: Sie werden auf der Seite
   gelb markiert und in der Browser-Konsole als Warnung gemeldet, bis du sie
   ersetzt. Ein leerer Wert ('') blendet die zugehörige Angabe aus.

   SICHERHEIT: Hier stehen AUSSCHLIESSLICH öffentliche Schlüssel
     · Clerk Publishable Key          (pk_test_… oder pk_live_…)
     · Supabase-Projekt-URL           (https://<projekt>.supabase.co)
     · Supabase Publishable/Anon Key  (sb_publishable_… oder anon-JWT)
   NIEMALS Secret Keys (sk_…), den Supabase-Service-Role-/Secret-Key
   (sb_secret_…) oder Passwörter eintragen – sie wären für jeden sichtbar.
   Die Website erkennt solche Schlüssel, ignoriert sie und meldet einen Fehler.

   Texte, die sich je Sprache unterscheiden, können als { de: '…', en: '…' }
   angegeben werden (fehlt „en“, gilt der deutsche Wert).

   Das Spiel (play/index.html) hat einen eigenen CONFIG-Block. Dort müssen
   dieselben Clerk-/Supabase-Schlüssel stehen (gemeinsame Anmeldung) und
   legalTerms, legalPrivacy, consentTextVersion und minAge zu den Werten unten
   passen (siehe README.md › Landing Page).
   ========================================================================== */
window.SITE_CONFIG = {
  // ---- Domain und Pfade ------------------------------------------------------
  SITE_URL: 'https://aetherfallroe.com/dungeons', // öffentliche Adresse der Website ohne „/“ am Ende (auch in sitemap.xml, robots.txt und <head> der HTML-Dateien)
  GAME_PATH: 'play/',                           // Spiel relativ zur Website (→ https://aetherfallroe.com/dungeons/play/, gleiche Domain → gemeinsame Clerk-Sitzung)

  // ---- Anmeldung (Clerk) und Datenbank (Supabase) – nur öffentliche Schlüssel ----
  CLERK_PUBLISHABLE_KEY: 'pk_test_bGVhcm5pbmctc2VydmFsLTYzMTkuY2xlcmsuYWNjb3VudHMuZGV2JA', // nach der Umstellung auf Produktion: pk_live_…
  CLERK_JS_VERSION: '5',                        // Hauptversion von @clerk/clerk-js (wie im Spiel)
  SUPABASE_URL: 'https://omnviivimjbjgdoblewn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_8B3JGbczUmMcBidmGTc5TA_oTRRnS7X',

  // ---- Kontakt ---------------------------------------------------------------
  CONTACT_EMAIL: 'info@aetherfallroe.com',      // allgemeine Kontaktadresse (Impressum, Kontakt, AGB)

  // ---- Registrierung ---------------------------------------------------------
  MIN_AGE: 16,                                  // Mindestalter für ein Konto (Bestätigung bei der Registrierung)
  CONSENT_TEXT_VERSION: '1',                    // Version des Zustimmungstextes (Checkbox) – erhöhen, wenn sich der Wortlaut ändert

  // ---- Angaben für Impressum und Datenschutzerklärung ------------------------
  LEGAL: {
    // Firma mit Rechtsform. „i. G.“ (in Gründung) entfernen, sobald die UG im Handelsregister eingetragen ist.
    NAME: 'RagedSky UG (haftungsbeschränkt) i. G.',
    // ladungsfähige Anschrift (kein Postfach); Zeilen mit \n trennen
    ADDRESS: { de: '[STRASSE UND HAUSNUMMER]\n47051 Duisburg\nDeutschland', en: '[STRASSE UND HAUSNUMMER]\n47051 Duisburg\nGermany' },
    REPRESENTED: '[VOR- UND NACHNAME DER GESCHÄFTSFÜHRUNG]', // vertretungsberechtigte Person(en) der UG (Geschäftsführer/in)
    PHONE: '',                                  // optional, z. B. '+49 …'
    VAT_ID: '',                                 // Umsatzsteuer-Identifikationsnummer nach § 27a UStG, sobald vorhanden
    // nach der Eintragung, z. B. { de: 'Registergericht: Amtsgericht Duisburg, HRB 12345', en: 'Register court: Amtsgericht Duisburg, HRB 12345' }
    REGISTER: '',
    RESPONSIBLE: '',                            // Verantwortlich nach § 18 Abs. 2 MStV (natürliche Person) – '' = REPRESENTED mit ADDRESS
    PRIVACY_EMAIL: 'aetherfa@aetherfallroe.com', // Adresse für Datenschutzanfragen – '' = CONTACT_EMAIL
    DPO: '',                                    // Datenschutzbeauftragte(r), falls benannt – '' blendet den Abschnitt aus
    AUTHORITY: {
      de: 'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf, www.ldi.nrw.de',
      en: 'State Commissioner for Data Protection and Freedom of Information of North Rhine-Westphalia (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf, Germany, www.ldi.nrw.de',
    },
    HOSTING: { de: 'iFastNet Ltd., Newcastle upon Tyne, Vereinigtes Königreich', en: 'iFastNet Ltd., Newcastle upon Tyne, United Kingdom' },
    // Grundlage der Zusammenarbeit mit dem Hoster. Erst eintragen, wenn der Vertrag zur Auftragsverarbeitung (AV-Vertrag) vorliegt, z. B.
    // { de: 'Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO)', en: 'data processing agreement (Art. 28 GDPR)' }
    HOSTING_DPA: { de: '[AV-VERTRAG MIT IFASTNET – BITTE ANFRAGEN]', en: '[AV-VERTRAG MIT IFASTNET – BITTE ANFRAGEN]' },
    HOSTING_THIRD_COUNTRY: {
      de: 'Vereinigtes Königreich – Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO)',
      en: 'United Kingdom – adequacy decision of the European Commission (Art. 45 GDPR)',
    },
    LOG_DAYS: { de: '[SPEICHERDAUER BEI IFASTNET ERFRAGEN, z. B. höchstens 30 Tage]', en: '[SPEICHERDAUER BEI IFASTNET ERFRAGEN, z. B. höchstens 30 Tage]' },
    SUPABASE_REGION: { de: 'EU (Irland, AWS eu-west-1)', en: 'EU (Ireland, AWS eu-west-1)' },
  },

  // ---- Stand der Rechtstexte -------------------------------------------------
  // Bei inhaltlichen Änderungen Version und Datum erhöhen. Ändert sich die Version von
  // agb oder datenschutz, fragen Website und Spiel angemeldete Nutzer erneut nach der Zustimmung.
  LEGAL_DOCS: {
    impressum:   { version: '1.0', date: '2026-10-15' },
    datenschutz: { version: '1.0', date: '2026-10-15' },
    agb:         { version: '1.0', date: '2026-10-15' },
    widerruf:    { version: '1.0', date: '2026-10-15' },
  },

  // ---- Medien ----------------------------------------------------------------
  // Nur eigene Dateien verwenden (liegen in assets/media/). Externe Einbettungen (YouTube & Co.) brauchen eine
  // Einwilligung – dafür TRAILER_EMBED statt TRAILER_URL setzen (Zwei-Klick-Lösung, CSP frame-src ergänzen).
  TRAILER_URL: 'assets/media/trailer.mp4',      // eigene Videodatei (MP4/WebM), wird erst beim Abspielen geladen; '' = Platzhalter
  TRAILER_POSTER: 'assets/media/trailer-poster.webp', // Vorschaubild zum Video
  TRAILER_SUBTITLES: { en: 'assets/media/trailer-en.vtt' }, // Untertitel (WebVTT) je Sprache; auf der englischen Seite automatisch an
  TRAILER_EMBED: '',                            // externe Einbettung, z. B. 'https://www.youtube-nocookie.com/embed/<ID>' (lädt erst nach Zustimmung)
  // Galerie: src = großes Bild (öffnet sich beim Anklicken), thumb = Vorschaubild (optional), width/height = Seitenverhältnis.
  // src und thumb dürfen je Sprache verschieden sein ({ de, en }), z. B. bei Bildern mit Spieltexten. [] blendet die Galerie aus.
  SCREENSHOTS: [
    { src: 'assets/media/shot-town.webp', thumb: 'assets/media/shot-town-640.webp', width: 1280, height: 720,
      alt: { de: 'Spielszene: Marktstand, Brunnen und Häuser mit roten und grünen Dächern in der Stadt Ehbergten, schräg von oben', en: 'In-game scene: market stall, well and houses with red and green roofs in the town of Ehbergten, seen from above' },
      caption: { de: 'Ehbergten, die Stadt auf der Himmelsinsel', en: 'Ehbergten, the town on the sky isle' } },
    { src: 'assets/media/shot-combat.webp', thumb: 'assets/media/shot-combat-640.webp', width: 1280, height: 720,
      alt: { de: 'Kampf im Duskwood Thicket: Ein Flächenangriff mit leuchtendem goldenem Ring trifft mehrere Gegner, unten die Aktionsleiste mit Zaubern', en: 'Combat in Duskwood Thicket: an area attack with a glowing golden ring hits several enemies, with the spell action bar below' },
      caption: { de: 'Kämpfe mit Kombos, Zaubern und Flächenangriffen', en: 'Fight with combos, spells and area attacks' } },
    { src: 'assets/media/shot-xylar.webp', thumb: 'assets/media/shot-xylar-640.webp', width: 1280, height: 720,
      alt: { de: 'Bosskampf auf dem Kristallgipfel: Xylar, der Kristallkoloss, aus blauen und violetten Kristallen, darüber seine Lebensleiste', en: 'Boss fight on the Crystal Summit: Xylar the Crystal Colossus, made of blue and violet crystals, with its health bar above' },
      caption: { de: 'Bosskampf gegen Xylar, den Kristallkoloss', en: 'Boss fight against Xylar the Crystal Colossus' } },
    { src: 'assets/media/shot-seraphiel.webp', thumb: 'assets/media/shot-seraphiel-640.webp', width: 1280, height: 720,
      alt: { de: 'Endkampf im Herz des Nexus: Seraphiel, die verderbte Architektin, lässt Blitze auf den Helden niedergehen', en: 'Final battle in the Heart of the Nexus: Seraphiel, the Corrupted Architect, calls down lightning on the hero' },
      caption: { de: 'Seraphiel, die verderbte Architektin', en: 'Seraphiel, the Corrupted Architect' } },
    { src: { de: 'assets/media/shot-map-de.webp', en: 'assets/media/shot-map-en.webp' }, thumb: { de: 'assets/media/shot-map-de-640.webp', en: 'assets/media/shot-map-en-640.webp' }, width: 1280, height: 720,
      alt: { de: 'Weltkarte der Himmelsinseln: neun Regionen, durch Brücken verbunden, mit leuchtenden Wegsteinen und Stufenangaben', en: 'World map of the Sky Isles: nine regions linked by bridges, with glowing waystones and level ranges' },
      caption: { de: 'Weltkarte mit Wegsteinen und Questmarkern', en: 'World map with waystones and quest markers' } },
    { src: { de: 'assets/media/shot-creator-de.webp', en: 'assets/media/shot-creator-en.webp' }, thumb: { de: 'assets/media/shot-creator-de-640.webp', en: 'assets/media/shot-creator-en-640.webp' }, width: 1280, height: 720,
      alt: { de: 'Charaktererstellung: Heldin mit Schwert auf einem beleuchteten Podest, rechts Auswahl von Klasse, Haut-, Haar- und Augenfarbe', en: 'Character creation: a heroine with a sword on a lit pedestal, with class, skin, hair and eye colour options on the right' },
      caption: { de: 'Charakter-Creator mit Live-Vorschau', en: 'Character creator with live preview' } },
  ],
};
