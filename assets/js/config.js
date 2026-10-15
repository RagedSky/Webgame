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

   Das Spiel (play/index.html) hat einen eigenen CONFIG-Block. Dort müssen
   dieselben Clerk-/Supabase-Schlüssel stehen (gemeinsame Anmeldung) und
   legalTerms, legalPrivacy, minAge und contactEmail zu den Werten unten
   passen (siehe README.md › Landing Page).
   ========================================================================== */
window.SITE_CONFIG = {
  // ---- Domain und Pfade ------------------------------------------------------
  SITE_URL: 'https://aetherfall.example',      // öffentliche Adresse ohne „/“ am Ende (auch in sitemap.xml, robots.txt und <head> der HTML-Dateien ersetzen)
  GAME_PATH: 'play/',                           // Spiel relativ zur Website-Wurzel (gleiche Domain → gemeinsame Clerk-Sitzung)

  // ---- Anmeldung (Clerk) und Datenbank (Supabase) – nur öffentliche Schlüssel ----
  CLERK_PUBLISHABLE_KEY: 'pk_test_bGVhcm5pbmctc2VydmFsLTYzMTkuY2xlcmsuYWNjb3VudHMuZGV2JA',
  CLERK_JS_VERSION: '5',                        // Hauptversion von @clerk/clerk-js (wie im Spiel)
  SUPABASE_URL: 'https://omnviivimjbjgdoblewn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_8B3JGbczUmMcBidmGTc5TA_oTRRnS7X',

  // ---- Kontakt ---------------------------------------------------------------
  CONTACT_EMAIL: '[E-MAIL]',                    // allgemeine Kontaktadresse (Impressum, Kontakt, Datenschutz)

  // ---- Registrierung ---------------------------------------------------------
  MIN_AGE: 16,                                  // Mindestalter für ein Konto (Bestätigung bei der Registrierung)
  CONSENT_TEXT_VERSION: '1',                    // Version des Zustimmungstextes (Checkbox) – erhöhen, wenn sich der Wortlaut ändert

  // ---- Angaben für Impressum und Datenschutzerklärung ------------------------
  LEGAL: {
    NAME: '[NAME]',                             // Vor- und Nachname bzw. Firma (bei Firmen mit Rechtsform und Vertretungsberechtigten)
    ADDRESS: '[ANSCHRIFT]',                     // ladungsfähige Anschrift; Zeilen mit \n trennen, z. B. 'Musterstraße 1\n12345 Musterstadt\nDeutschland'
    PHONE: '',                                  // optional, z. B. '+49 …'
    VAT_ID: '[UST-ID, falls vorhanden]',        // Umsatzsteuer-Identifikationsnummer nach § 27a UStG – '' wenn keine vorhanden
    REGISTER: '',                               // optional: Handelsregister, Registergericht, Registernummer
    RESPONSIBLE: '',                            // Verantwortlich nach § 18 Abs. 2 MStV – '' = NAME und ADDRESS
    PRIVACY_EMAIL: '',                          // eigene Adresse für Datenschutzanfragen – '' = CONTACT_EMAIL
    DPO: '',                                    // Datenschutzbeauftragte(r), falls benannt – '' blendet den Abschnitt aus
    AUTHORITY: '[ZUSTÄNDIGE DATENSCHUTZ-AUFSICHTSBEHÖRDE]', // Aufsichtsbehörde deines (Bundes-)Landes, mit Anschrift/Website
    HOSTING: '[HOSTING-ANBIETER MIT ANSCHRIFT]', // wer die Website ausliefert (z. B. Netlify, Cloudflare, IONOS …)
    HOSTING_THIRD_COUNTRY: '[JA/NEIN – DRITTLAND DES HOSTERS, z. B. USA (EU-US Data Privacy Framework)]',
    LOG_DAYS: '[SPEICHERDAUER DER LOGFILES, z. B. 14 Tage]', // Speicherdauer der Server-Logfiles beim Hoster
    SUPABASE_REGION: '[SUPABASE-REGION, z. B. EU (Frankfurt)]', // Region deines Supabase-Projekts (Dashboard › Project Settings)
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

  // ---- Medien (optional) -----------------------------------------------------
  // Ohne Einträge zeigt die Seite gezeichnete Platzhalter. Nur eigene Dateien verwenden (z. B. 'assets/media/trailer.mp4');
  // externe Einbettungen (YouTube & Co.) brauchen eine Einwilligung – dafür TRAILER_EMBED setzen (Zwei-Klick-Lösung).
  TRAILER_URL: '',                              // eigene Videodatei (MP4/WebM), wird erst beim Abspielen geladen
  TRAILER_POSTER: '',                           // Vorschaubild zum Video (optional)
  TRAILER_EMBED: '',                            // externe Einbettung, z. B. 'https://www.youtube-nocookie.com/embed/<ID>' (lädt erst nach Zustimmung; CSP frame-src ergänzen)
  SCREENSHOTS: [],                              // z. B. [{ src: 'assets/media/shot1.webp', alt: { de: 'Kampf …', en: 'Battle …' } }]
};
