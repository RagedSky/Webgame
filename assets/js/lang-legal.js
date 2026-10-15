/* ============================== TEXTE: RECHTSSEITEN (de/en) ===============
   ENTWURF – ersetzt keine Rechtsberatung. Bitte vor der Veröffentlichung von einer Fachperson prüfen lassen.
   Aufbau je Seite: <präfix>.title, <präfix>.intro und Abschnitte <präfix>.s<n>.h (Überschrift) / .b (HTML) / .if (optional:
   Abschnitt nur zeigen, wenn dieser SITE_CONFIG-Wert gesetzt ist). Präfixe: imp (Impressum), priv (Datenschutz),
   tos (AGB), wd (Widerruf). Platzhalter wie {NAME}, {ADDRESS}, {EMAIL_LINK} kommen aus assets/js/config.js.
   Stand und Version jeder Seite: SITE_CONFIG.LEGAL_DOCS.
   ========================================================================== */
I18N.add('de', {
  /* ================================ IMPRESSUM ================================ */
  'imp.title': 'Impressum',
  'imp.intro': '',
  'imp.s1.h': 'Angaben gemäß § 5 DDG',
  'imp.s1.b': `<p>{NAME}<br>{ADDRESS}</p><p data-if="REGISTER">{REGISTER}</p>`,
  'imp.s2.h': 'Kontakt',
  'imp.s2.b': `<p>E-Mail: {EMAIL_LINK}<span data-if="PHONE"><br>Telefon: {PHONE}</span></p>`,
  'imp.s3.h': 'Umsatzsteuer-ID',
  'imp.s3.if': 'VAT_ID',
  'imp.s3.b': `<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {VAT_ID}</p>`,
  'imp.s4.h': 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
  'imp.s4.b': `<p>{RESPONSIBLE_BLOCK}</p>`,
  'imp.s5.h': 'Verbraucherstreitbeilegung',
  'imp.s5.b': `<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Verbraucherstreitbeilegungsgesetz).</p>`,
  'imp.s6.h': 'Haftung für Inhalte und Links',
  'imp.s6.b': `<p>Wir erstellen die Inhalte dieser Website mit Sorgfalt, können für Richtigkeit, Vollständigkeit und Aktualität aber keine Gewähr übernehmen. Als Diensteanbieter sind wir für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich. Für Inhalte externer Websites, auf die wir verlinken, sind ausschließlich deren Betreiber verantwortlich; zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Werden uns Rechtsverletzungen bekannt, entfernen wir die betreffenden Inhalte oder Links umgehend.</p>`,
  'imp.s7.h': 'Urheberrecht und verwendete Werke',
  'imp.s7.b': `<p>Spiel, Texte, Grafiken, Musik und Soundeffekte von Aetherfall: Dungeons sind urheberrechtlich geschützt. Grafiken, Figuren, Logo und Klänge werden prozedural per Programmcode erzeugt.</p>
<ul>
<li>Schriften „Press Start 2P“ und „VT323“ – SIL Open Font License 1.1, lokal eingebunden</li>
<li>three.js – MIT-Lizenz</li>
<li>supabase-js – MIT-Lizenz</li>
<li>Anmeldung über Clerk (Clerk, Inc.)</li>
</ul>`,

  /* ================================ DATENSCHUTZ ================================ */
  'priv.title': 'Datenschutzerklärung',
  'priv.intro': `<p>Wir nehmen den Schutz deiner Daten ernst und verarbeiten nur, was für das Spiel nötig ist. Hier erfährst du, welche Daten das sind, wofür wir sie nutzen, wie lange wir sie speichern und welche Rechte du hast.</p>`,
  'priv.s1.h': 'Verantwortlicher und Kontakt',
  'priv.s1.b': `<p>Verantwortlich für die Datenverarbeitung im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
<p>{NAME}<br>{ADDRESS}<br>E-Mail: {EMAIL_LINK}</p>
<p>Für alle Fragen zum Datenschutz erreichst du uns unter {PRIVACY_EMAIL_LINK}.</p>
<p data-if="DPO"><b>Datenschutzbeauftragte(r):</b> {DPO}</p>`,
  'priv.s2.h': 'Überblick',
  'priv.s2.b': `<ul>
<li>Du kannst Aetherfall: Dungeons <b>ohne Konto</b> spielen (Gastmodus). Deine Spielstände bleiben dann ausschließlich in deinem Browser.</li>
<li>Mit Konto speichern wir Kontodaten, Spielstände, Einstellungen und – wenn du ihn nutzt – Daten für den Mehrspieler-Modus.</li>
<li>Wir setzen <b>keine Tracker, keine Analyse-Werkzeuge und keine Werbung</b> ein und erstellen keine Profile über dich.</li>
<li>Schriften und Programmbibliotheken liefern wir selbst aus; es werden keine Inhalte von Google Fonts oder anderen Schrift-Diensten geladen.</li>
<li>Wir verwenden nur technisch notwendige Speicherungen auf deinem Gerät (Abschnitt 9). Ein Einwilligungsbanner ist deshalb nicht nötig.</li>
</ul>`,
  'priv.s3.h': 'Aufruf der Website und Server-Logfiles (Hosting)',
  'priv.s3.b': `<p>Die Website und das Spiel werden über <b>{HOSTING}</b> ausgeliefert. Beim Aufruf verarbeitet der Hoster automatisch technische Daten, die dein Browser übermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Referrer, Browser und Betriebssystem, übertragene Datenmenge und Statuscode.</p>
<p><b>Zweck:</b> Auslieferung der Seiten, Stabilität und Abwehr von Angriffen. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren, funktionsfähigen Angebot). <b>Speicherdauer:</b> {LOG_DAYS}, danach werden die Logfiles gelöscht oder anonymisiert, sofern sie nicht zur Aufklärung eines Sicherheitsvorfalls länger benötigt werden.</p>
<p>Mit dem Hoster besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Drittland: {HOSTING_THIRD_COUNTRY}.</p>`,
  'priv.s4.h': 'Spielen im Gastmodus',
  'priv.s4.b': `<p>Im Gastmodus speichert das Spiel Spielstände, Einstellungen und Tastenbelegung ausschließlich lokal im Speicher deines Browsers (localStorage). Diese Daten werden nicht an uns übertragen. Du kannst sie jederzeit im Spiel (Spielstände bzw. Einstellungen › Konto › „Lokale Daten löschen“) oder über die Website-Daten deines Browsers löschen.</p>
<p><b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Spiels) sowie § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderliche Speicherung).</p>`,
  'priv.s5.h': 'Benutzerkonto und Anmeldung (Clerk)',
  'priv.s5.b': `<p>Für Konten nutzen wir den Dienst <b>Clerk</b> (Clerk, Inc., USA) als Auftragsverarbeiter. Verarbeitet werden: E-Mail-Adresse, Passwort (nur als sicherer Hash bei Clerk; wir sehen es nie), Konto-ID, optional Benutzername sowie – bei Anmeldung über einen sozialen Anbieter wie Google – Name, Profilbild und die Kennung dieses Anbieters. Zur Sicherheit verarbeitet Clerk außerdem Sitzungsdaten, IP-Adresse und Browserkennung, etwa um verdächtige Anmeldungen zu erkennen.</p>
<p>Zum Schutz vor automatisierten Registrierungen kann Clerk den Dienst <b>Cloudflare Turnstile</b> (Cloudflare, Inc., USA) einbinden; dabei werden technische Merkmale deines Browsers an Cloudflare übermittelt.</p>
<p>Das Anmeldeskript von Clerk wird auf der Startseite nur geladen, wenn du dich anmeldest oder bereits angemeldet bist. Die Nutzungsstatistik („Telemetrie“) von Clerk ist abgeschaltet.</p>
<p><b>Zweck:</b> Registrierung, Anmeldung, Passwort-Zurücksetzen, Kontoverwaltung, Schutz vor Missbrauch. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag) und lit. f (Sicherheit). <b>Drittland:</b> Clerk und Cloudflare sitzen in den USA. Die Übermittlung stützt sich auf den Angemessenheitsbeschluss zum EU-U.S. Data Privacy Framework, soweit der Anbieter zertifiziert ist, und im Übrigen auf EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) im Vertrag zur Auftragsverarbeitung.</p>`,
  'priv.s6.h': 'Cloud-Spielstände und Profil (Supabase)',
  'priv.s6.b': `<p>Wenn du angemeldet spielst, speichern wir deine Spielstände (Charakter, Fortschritt, Quests, Karte, Inventar, Kurzübersicht), Einstellungen, Tastenbelegung, Spracheinstellung und deinen Anzeigenamen in einer Datenbank bei <b>Supabase</b> (Supabase, Inc.) als Auftragsverarbeiter. Die Zuordnung erfolgt über deine Clerk-Konto-ID; der Zugriff ist technisch auf deine eigenen Daten beschränkt (Row Level Security). Speicherort: {SUPABASE_REGION}.</p>
<p><b>Zweck:</b> Speichern und Synchronisieren deiner Spielstände zwischen Geräten. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b DSGVO. <b>Drittland:</b> Supabase ist ein US-Unternehmen; soweit Daten außerhalb der EU verarbeitet oder von dort aus zugegriffen werden kann, gelten EU-Standardvertragsklauseln im Vertrag zur Auftragsverarbeitung bzw. der Angemessenheitsbeschluss zum EU-U.S. Data Privacy Framework.</p>`,
  'priv.s7.h': 'Mehrspieler: Anzeigename, Lobbys, Chat, Freunde und Meldungen',
  'priv.s7.b': `<p>Im Mehrspieler-Modus verarbeiten wir über Supabase (Datenbank und Echtzeit-Kanäle):</p>
<ul>
<li><b>Anzeigename</b> mit vierstelliger Kennung (selbst gewählt, für Mitspieler sichtbar – bitte keinen echten Namen und keine E-Mail-Adresse verwenden) und den Zeitpunkt deiner letzten Aktivität (Online-Status für Freunde),</li>
<li><b>Lobbys</b>: Code, Einstellungen, Mitglieder mit Klasse und Stufe; während einer Sitzung zusätzlich Position, Aktionen und Spielzustand,</li>
<li><b>Chatnachrichten</b>, Pings und Emotes: Sie werden in Echtzeit an die Mitspieler der Lobby übermittelt und von uns <b>nicht dauerhaft gespeichert</b>,</li>
<li><b>Freundesliste und Einladungen</b>, <b>Blockierungen und Stummschaltungen</b>,</li>
<li><b>Meldungen</b> über andere Spieler: Grund, optionale Beschreibung, als Beleg die letzten Chatnachrichten der gemeldeten Person, Lobby-Code und die Zahl automatischer Verwarnungen.</li>
</ul>
<p><b>Zweck:</b> gemeinsames Spielen, Schutz der Mitspieler, Moderation. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b DSGVO; für Meldungen und Moderation Art. 6 Abs. 1 lit. f DSGVO (Schutz der Community). Lobbys werden spätestens nach 24 Stunden gelöscht, Einladungen nach einem Tag; Meldungen speichern wir, bis sie bearbeitet sind, höchstens sechs Monate.</p>`,
  'priv.s8.h': 'Kontaktaufnahme per E-Mail',
  'priv.s8.b': `<p>Wenn du uns schreibst, verarbeiten wir deine E-Mail-Adresse, deinen Namen (falls angegeben) und den Inhalt deiner Nachricht, um dein Anliegen zu beantworten. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b DSGVO (Anfragen zu deinem Konto) bzw. lit. f (sonstige Anfragen). Wir löschen die Nachrichten, wenn dein Anliegen erledigt ist, sofern keine gesetzlichen Aufbewahrungspflichten bestehen. Ein Kontaktformular gibt es bewusst nicht.</p>`,
  'priv.s9.h': 'Cookies und lokaler Speicher',
  'priv.s9.b': `<p>Wir verwenden ausschließlich <b>technisch notwendige</b> Speicherungen auf deinem Gerät (§ 25 Abs. 2 Nr. 2 TDDDG). Es gibt keine Cookies oder Speicherungen zu Analyse- oder Werbezwecken.</p>
<div class="tableWrap"><table>
<caption>Übersicht der Speicherungen</caption>
<thead><tr><th scope="col">Name</th><th scope="col">Art</th><th scope="col">Zweck</th><th scope="col">Dauer</th></tr></thead>
<tbody>
<tr><td><code>aetherfall_lang</code></td><td>localStorage (Website)</td><td>gewählte Sprache</td><td>bis zum Löschen</td></tr>
<tr><td><code>aetherfall_settings</code>, <code>aetherfall_muted</code></td><td>localStorage (Spiel)</td><td>Einstellungen, Sprache, Tastenbelegung, Gastmodus</td><td>bis zum Löschen</td></tr>
<tr><td><code>aetherfall_slot_…</code>, <code>aetherfall_backup_…</code></td><td>localStorage (Spiel)</td><td>Spielstände und Sicherungskopien auf deinem Gerät</td><td>bis zum Löschen</td></tr>
<tr><td><code>aetherfall_meta</code></td><td>localStorage (Spiel)</td><td>zuletzt angemeldetes Konto (ID, Name, E-Mail) für den Offline-Betrieb – nur auf deinem Gerät</td><td>bis zum Abmelden bzw. Löschen</td></tr>
<tr><td><code>aetherfall_pending_consent</code>, <code>aetherfall_consent_ok</code>, <code>af_mp_link</code></td><td>sessionStorage</td><td>Zustimmung während der Registrierung, bis sie gespeichert ist; Prüf-Ergebnis; Lobby-Link beim Neuladen</td><td>bis zum Schließen des Tabs</td></tr>
<tr><td><code>__session</code>, <code>__client_uat</code> (ggf. mit Endung), <code>__client</code></td><td>Cookies von Clerk</td><td>Anmeldung und Sitzung, Schutz vor Missbrauch</td><td>Sitzung bzw. bis zum Abmelden</td></tr>
<tr><td>Einträge mit <code>__clerk</code></td><td>localStorage (Clerk)</td><td>Zwischenspeicher der Anmeldeeinstellungen</td><td>bis zum Löschen</td></tr>
<tr data-if="MEDIA_HOST"><td><code>aetherfall_media_consent</code></td><td>localStorage (Website)</td><td>deine Wahl zum externen Video</td><td>bis zum Zurücksetzen</td></tr>
</tbody></table></div>
<p data-if="MEDIA_HOST"><b>Externes Video:</b> Der Trailer wird von {MEDIA_HOST} bereitgestellt und erst geladen, wenn du auf „Video laden“ klickst (Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG). Du kannst deine Wahl jederzeit über „Einstellungen für externe Medien“ in der Fußzeile widerrufen.</p>`,
  'priv.s10.h': 'Zustimmung bei der Registrierung',
  'priv.s10.b': `<p>Bei der Registrierung bestätigst du, die Nutzungsbedingungen zu akzeptieren, die Datenschutzerklärung gelesen zu haben und mindestens {MIN_AGE} Jahre alt zu sein. Als Nachweis speichern wir in der Tabelle <code>consents</code> bei Supabase: Konto-ID, Versionen der Nutzungsbedingungen und der Datenschutzerklärung, Version und Wortlaut des Zustimmungstextes, Sprache, Altersbestätigung, Quelle (Website oder Spiel) und den Zeitpunkt. Ändern sich die Texte, bitten wir dich erneut um Bestätigung. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b und f DSGVO (Vertragsschluss und Nachweis). Die Nachweise löschen wir zusammen mit deinem Konto.</p>`,
  'priv.s11.h': 'Empfänger und Auftragsverarbeiter',
  'priv.s11.b': `<div class="tableWrap"><table>
<caption>Dienstleister, die Daten in unserem Auftrag verarbeiten</caption>
<thead><tr><th scope="col">Dienst</th><th scope="col">Zweck</th><th scope="col">Sitz / Drittland</th><th scope="col">Grundlage</th></tr></thead>
<tbody>
<tr><td>{HOSTING}</td><td>Auslieferung der Website und des Spiels</td><td>{HOSTING_THIRD_COUNTRY}</td><td>Vertrag zur Auftragsverarbeitung</td></tr>
<tr><td>Clerk, Inc.</td><td>Konten und Anmeldung</td><td>USA</td><td>Auftragsverarbeitung, Data Privacy Framework bzw. Standardvertragsklauseln</td></tr>
<tr><td>Cloudflare, Inc. (über Clerk)</td><td>Schutz vor automatisierten Registrierungen</td><td>USA</td><td>Unterauftragsverarbeiter von Clerk</td></tr>
<tr><td>Supabase, Inc.</td><td>Datenbank, Echtzeit-Kanäle, Kontolöschung</td><td>{SUPABASE_REGION}; US-Unternehmen</td><td>Auftragsverarbeitung, Standardvertragsklauseln</td></tr>
</tbody></table></div>
<p>Eine Weitergabe an sonstige Dritte findet nur statt, wenn wir gesetzlich dazu verpflichtet sind (z. B. auf behördliche Anordnung).</p>`,
  'priv.s12.h': 'Speicherdauer und Löschung',
  'priv.s12.b': `<ul>
<li><b>Konto, Profil, Cloud-Spielstände, Zustimmungsnachweise:</b> bis du dein Konto löschst. Einzelne Spielstände kannst du jederzeit selbst löschen.</li>
<li><b>Mehrspieler-Daten:</b> Lobbys höchstens 24 Stunden, Einladungen einen Tag; Freundesliste und Blockierungen bis zum Entfernen bzw. zur Kontolöschung; Meldungen bis zur Bearbeitung, höchstens sechs Monate.</li>
<li><b>Server-Logfiles:</b> {LOG_DAYS}.</li>
<li><b>E-Mails:</b> bis dein Anliegen erledigt ist, außer es bestehen gesetzliche Aufbewahrungspflichten.</li>
</ul>
<p><b>Konto löschen:</b> Im Spiel unter Einstellungen › Konto › „Konto und Daten löschen“. Dabei werden dein Konto bei Clerk und alle zugehörigen Daten bei Supabase (Profil, Spielstände, Mehrspieler-Daten, Zustimmungsnachweise) endgültig entfernt. Alternativ genügt eine E-Mail an {PRIVACY_EMAIL_LINK} von der Adresse deines Kontos.</p>`,
  'priv.s13.h': 'Deine Rechte',
  'priv.s13.b': `<p>Du hast jederzeit das Recht auf</p>
<ul>
<li><b>Auskunft</b> über deine gespeicherten Daten (Art. 15 DSGVO),</li>
<li><b>Berichtigung</b> unrichtiger Daten (Art. 16 DSGVO),</li>
<li><b>Löschung</b> (Art. 17 DSGVO) und <b>Einschränkung der Verarbeitung</b> (Art. 18 DSGVO),</li>
<li><b>Datenübertragbarkeit</b> (Art. 20 DSGVO) – im Spiel unter Einstellungen › Konto › „Meine Daten exportieren“ als JSON-Datei,</li>
<li><b>Widerspruch</b> gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO),</li>
<li><b>Widerruf</b> einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
</ul>
<p>Wende dich dazu an {PRIVACY_EMAIL_LINK}. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel bei der für uns zuständigen Behörde: {AUTHORITY}.</p>`,
  'priv.s14.h': 'Kinder und Jugendliche',
  'priv.s14.b': `<p>Ein Konto darf erst ab {MIN_AGE} Jahren angelegt werden; das bestätigst du bei der Registrierung. Jüngere können ohne Konto im Gastmodus spielen – dabei verarbeiten wir keine Kontodaten. Erfahren wir, dass ein Konto entgegen dieser Regel angelegt wurde, löschen wir es. Eltern können sich dazu jederzeit an {PRIVACY_EMAIL_LINK} wenden.</p>`,
  'priv.s15.h': 'Datensicherheit',
  'priv.s15.b': `<p>Alle Verbindungen sind per TLS verschlüsselt. In der Datenbank sorgt Row Level Security dafür, dass jedes Konto nur seine eigenen Daten lesen und ändern kann. Im Browser stehen ausschließlich öffentliche Schlüssel; Geheimschlüssel werden nur serverseitig verwendet (z. B. für die Kontolöschung). Eine Content-Security-Policy beschränkt, welche Quellen geladen werden dürfen.</p>`,
  'priv.s16.h': 'Zahlungsabwicklung (derzeit nicht aktiv)',
  'priv.s16.b': `<p class="badge">Derzeit nicht aktiv</p>
<div class="inactive"><p>Aetherfall: Dungeons bietet derzeit keine kostenpflichtigen Inhalte an; es werden keine Zahlungsdaten verarbeitet. Sollten später kosmetische Gegenstände angeboten werden, ergänzen wir hier vor dem Start: den Zahlungsanbieter <mark class="ph">[ZAHLUNGSANBIETER, ANSCHRIFT]</mark>, die verarbeiteten Daten (z. B. Name, Zahlungsmittel, Transaktionsdaten), Zweck (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO), gesetzliche Aufbewahrung von Buchungsbelegen (Art. 6 Abs. 1 lit. c DSGVO, bis zu zehn Jahre), Drittlandübermittlung und Vertrag zur Auftragsverarbeitung bzw. eigene Verantwortlichkeit des Anbieters.</p></div>`,
  'priv.s17.h': 'Pflicht zur Bereitstellung, keine automatisierten Entscheidungen',
  'priv.s17.b': `<p>Du bist nicht verpflichtet, uns Daten bereitzustellen. Ohne Konto kannst du im Gastmodus spielen; Cloud-Spielstände und Mehrspieler-Modus setzen ein Konto voraus. Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt. Die automatische Plausibilitätsprüfung im Mehrspieler-Modus (Schutz vor Manipulation) kann Spieler aus einer Lobby entfernen, führt aber zu keiner Sperre des Kontos ohne menschliche Prüfung.</p>`,
  'priv.s18.h': 'Änderungen dieser Datenschutzerklärung',
  'priv.s18.b': `<p>Wir passen diese Datenschutzerklärung an, wenn sich das Spiel, die eingesetzten Dienste oder die Rechtslage ändern. Die aktuelle Version und ihr Datum stehen oben auf dieser Seite. Bei wesentlichen Änderungen bitten wir angemeldete Nutzer beim nächsten Besuch um Bestätigung.</p>`,

  /* ================================ AGB ================================ */
  'tos.title': 'Allgemeine Geschäfts- und Nutzungsbedingungen',
  'tos.intro': `<p>Diese Bedingungen regeln die Nutzung des Browser-Spiels „Aetherfall: Dungeons“ und dieser Website. Bitte lies sie aufmerksam – mit der Registrierung eines Kontos stimmst du ihnen zu.</p>`,
  'tos.s1.h': '§ 1 Anbieter und Geltungsbereich',
  'tos.s1.b': `<p>(1) Anbieter ist {NAME}, {ADDRESS} (im Folgenden „wir“). Kontakt: {EMAIL_LINK}.</p>
<p>(2) Diese Bedingungen gelten für alle Nutzer des Spiels und der Website, im Gastmodus wie mit Konto. Abweichende Bedingungen von Nutzern gelten nicht.</p>`,
  'tos.s2.h': '§ 2 Leistungen',
  'tos.s2.b': `<p>(1) Aetherfall: Dungeons ist ein kostenloses Action-Rollenspiel, das direkt im Browser läuft. Ein Anspruch auf bestimmte Inhalte, Funktionen oder deren Fortbestand besteht nicht; wir entwickeln das Spiel laufend weiter und können Inhalte ändern, erweitern oder entfernen.</p>
<p>(2) <b>Gastmodus:</b> Ohne Konto kannst du das Spiel vollständig im Einzelspieler-Modus spielen. Spielstände werden nur lokal in deinem Browser gespeichert; für ihren Erhalt bist du selbst verantwortlich.</p>
<p>(3) <b>Konto:</b> Mit einem Konto werden bis zu fünf Spielstände, ein automatischer Spielstand und deine Einstellungen in der Cloud gespeichert und zwischen Geräten synchronisiert. Außerdem kannst du den Mehrspieler-Modus (Koop für 2–4 Spieler), Freundeslisten und Einladungen nutzen.</p>
<p>(4) Die Nutzung ist derzeit vollständig kostenlos. Kostenpflichtige Inhalte gibt es nicht (siehe § 7).</p>`,
  'tos.s3.h': '§ 3 Registrierung und Konto',
  'tos.s3.b': `<p>(1) Ein Konto darf nur anlegen, wer mindestens {MIN_AGE} Jahre alt ist. Mit der Registrierung bestätigst du dein Alter, akzeptierst diese Bedingungen und bestätigst, die Datenschutzerklärung gelesen zu haben. Der Nutzungsvertrag kommt mit Abschluss der Registrierung zustande.</p>
<p>(2) Deine Angaben müssen zutreffen. Jedes Konto ist persönlich und nicht übertragbar. Halte deine Zugangsdaten geheim und informiere uns, wenn du einen Missbrauch vermutest.</p>
<p>(3) Du kannst dein Konto jederzeit ohne Angabe von Gründen löschen (im Spiel unter Einstellungen › Konto oder per E-Mail). Damit endet der Nutzungsvertrag.</p>
<p>(4) Den Text dieser Bedingungen speichern wir nicht gesondert für dich; die jeweils gültige Fassung kannst du auf dieser Seite jederzeit abrufen, speichern und ausdrucken.</p>`,
  'tos.s4.h': '§ 4 Verhaltensregeln',
  'tos.s4.b': `<p>(1) <b>Chat, Namen und Meldungen:</b> Untersagt sind Beleidigungen, Bedrohungen, Belästigung, Hassrede und Diskriminierung, sexuelle oder gewaltverherrlichende Inhalte, Spam und Werbung, das Veröffentlichen personenbezogener Daten anderer sowie Inhalte, die gegen Gesetze oder Rechte Dritter verstoßen. Das gilt auch für Anzeigenamen und Charakternamen. Missbräuchliche Meldungen sind ebenfalls untersagt.</p>
<p>(2) <b>Mehrspieler:</b> Verhalte dich fair gegenüber Mitspielern. Untersagt sind absichtliches Stören (z. B. Blockieren von Rätseln, Behindern beim Wiederbeleben), das Ausnutzen von Fehlern zum Nachteil anderer und das Weitergeben von Lobby-Codes an Personen, die eine private Lobby stören wollen.</p>
<p>(3) <b>Cheats und Manipulation:</b> Untersagt sind das Verändern des Spielcodes oder des Datenverkehrs, um sich oder anderen im Mehrspieler-Modus Vorteile zu verschaffen, der Einsatz von Bots oder Automatisierung, das Umgehen von Schutzmaßnahmen, Angriffe auf unsere Server oder die anderer Nutzer sowie jede Form der Überlastung. Die im Spiel vorgesehenen Befehle und Entwicklerwerkzeuge darfst du im Einzelspieler-Modus für deinen eigenen Spielstand nutzen; im Mehrspieler-Modus nur, wenn der Host sie für seine private Lobby erlaubt hat.</p>
<p>(4) Fehler und Sicherheitslücken meldest du bitte an {EMAIL_LINK}, statt sie auszunutzen. Danke!</p>`,
  'tos.s5.h': '§ 5 Moderation, Sperrung und Kündigung',
  'tos.s5.b': `<p>(1) Bei Verstößen gegen diese Bedingungen können wir – abhängig von Schwere und Wiederholung – Inhalte entfernen, verwarnen, den Zugang zum Mehrspieler-Modus vorübergehend oder dauerhaft sperren oder das Konto sperren bzw. kündigen. Wir berücksichtigen dabei die berechtigten Interessen aller Beteiligten.</p>
<p>(2) Die automatische Plausibilitätsprüfung im Mehrspieler-Modus kann Spieler bei offensichtlichen Manipulationen aus einer Lobby entfernen. Eine Sperre des Kontos erfolgt nur nach menschlicher Prüfung. Du wirst über eine Sperre per E-Mail informiert und kannst ihr unter {EMAIL_LINK} widersprechen.</p>
<p>(3) Wir können den Nutzungsvertrag ordentlich mit einer Frist von vier Wochen kündigen, etwa wenn wir das Spiel einstellen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Vor einer Einstellung des Spiels geben wir dir Gelegenheit, deine Daten zu exportieren.</p>`,
  'tos.s6.h': '§ 6 Rechte am Spiel und an Inhalten',
  'tos.s6.b': `<p>(1) Das Spiel, seine Texte, Grafiken, Musik und sein Programmcode sind urheberrechtlich geschützt. Du erhältst ein einfaches, nicht übertragbares, jederzeit widerrufliches Recht, das Spiel für private, nicht kommerzielle Zwecke zu nutzen.</p>
<p>(2) Für Inhalte, die du im Spiel erstellst (z. B. Anzeigenamen, Chatnachrichten), räumst du uns die Rechte ein, die nötig sind, um sie im Spiel anzuzeigen und an Mitspieler zu übertragen. Videos und Streams vom Spiel darfst du gern erstellen und veröffentlichen, auch mit Werbeeinnahmen, solange du nicht den Eindruck erweckst, offiziell für uns zu sprechen.</p>`,
  'tos.s7.h': '§ 7 Virtuelle Gegenstände und Kosmetik (Platzhalter – derzeit nicht aktiv)',
  'tos.s7.b': `<p class="badge">Derzeit nicht aktiv</p>
<div class="inactive"><p>Derzeit gibt es keine kostenpflichtigen Inhalte. Dieser Abschnitt ist für einen möglichen späteren Shop vorbereitet und wird erst mit dessen Einführung (und nach erneuter Zustimmung) wirksam:</p>
<p>(1) Wir können optionale kosmetische Gegenstände (z. B. Farben, Umhänge, Embleme) gegen Entgelt anbieten. Sie verschaffen keine spielerischen Vorteile.</p>
<p>(2) Mit dem Kauf erhältst du ein einfaches, nicht übertragbares Recht, den Gegenstand in deinem Konto zu nutzen. Virtuelle Gegenstände haben keinen Geldwert, können nicht in Geld zurückgetauscht, verkauft oder auf andere Konten übertragen werden.</p>
<p>(3) Preise, Zahlungsarten und Vertragsschluss: <mark class="ph">[PREISE INKL. UMSATZSTEUER, ZAHLUNGSANBIETER, ABLAUF DES VERTRAGSSCHLUSSES, BESTELLÜBERSICHT, BUTTON „ZAHLUNGSPFLICHTIG BESTELLEN“]</mark>.</p>
<p>(4) Es gilt die Widerrufsbelehrung für digitale Inhalte (siehe <a href="widerruf.html">Widerruf</a>). Bei Mängeln gelten die gesetzlichen Rechte für digitale Produkte (§§ 327 ff. BGB).</p>
<p>(5) Wird das Spiel eingestellt, informieren wir mindestens <mark class="ph">[FRIST, z. B. drei Monate]</mark> vorher; für innerhalb von <mark class="ph">[ZEITRAUM]</mark> vor der Ankündigung gekaufte Gegenstände erstatten wir das Entgelt anteilig.</p></div>`,
  'tos.s8.h': '§ 8 Verfügbarkeit und Spielstände',
  'tos.s8.b': `<p>(1) Wir bemühen uns um einen störungsfreien Betrieb, können aber keine ununterbrochene Verfügbarkeit zusagen. Wartungen, Updates, Störungen bei Dienstleistern oder höhere Gewalt können die Nutzung zeitweise einschränken.</p>
<p>(2) Wir sichern Cloud-Spielstände mit angemessenem Aufwand. Lokale Spielstände im Gastmodus liegen allein in deinem Browser und gehen verloren, wenn du die Website-Daten löschst. Nutze bei Bedarf die Export-Funktion unter Einstellungen › Konto.</p>`,
  'tos.s9.h': '§ 9 Haftung',
  'tos.s9.b': `<p>(1) Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit, für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz sowie im Umfang einer übernommenen Garantie.</p>
<p>(2) Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst (Kardinalpflichten); die Haftung ist dann auf den vertragstypischen, vorhersehbaren Schaden begrenzt.</p>
<p>(3) Da die Nutzung unentgeltlich ist, haften wir im Übrigen nur für Vorsatz und grobe Fahrlässigkeit (vgl. §§ 521, 599 BGB). Für den Verlust von Daten haften wir nur in dem Umfang, der bei üblicher Datensicherung entstanden wäre.</p>`,
  'tos.s10.h': '§ 10 Datenschutz',
  'tos.s10.b': `<p>Wie wir mit deinen Daten umgehen, erklärt die <a href="datenschutz.html">Datenschutzerklärung</a>.</p>`,
  'tos.s11.h': '§ 11 Änderungen dieser Bedingungen',
  'tos.s11.b': `<p>(1) Wir können diese Bedingungen mit Wirkung für die Zukunft ändern, wenn ein triftiger Grund besteht, etwa neue Funktionen, geänderte Rechtslage oder Rechtsprechung, und die Änderung für dich zumutbar ist. Wesentliche Vertragspflichten ändern wir nicht zu deinem Nachteil.</p>
<p>(2) Über Änderungen informieren wir dich mindestens zwei Wochen vor ihrem Inkrafttreten per E-Mail oder beim nächsten Anmelden. Die geänderten Bedingungen gelten erst, wenn du ihnen zustimmst. Stimmst du nicht zu, kannst du das Spiel weiter im Gastmodus nutzen; wir dürfen den Nutzungsvertrag dann mit einer Frist von vier Wochen kündigen.</p>`,
  'tos.s12.h': '§ 12 Schlussbestimmungen',
  'tos.s12.b': `<p>(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Bist du Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat der EU, bleibt der Schutz durch zwingende Vorschriften dieses Staates unberührt.</p>
<p>(2) Sind Nutzer Kaufleute, juristische Personen des öffentlichen Rechts oder öffentlich-rechtliche Sondervermögen, ist Gerichtsstand unser Sitz.</p>
<p>(3) Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
<p>(4) Sollte eine Bestimmung unwirksam sein, bleiben die übrigen Bestimmungen wirksam; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>`,

  /* ================================ WIDERRUF ================================ */
  'wd.title': 'Widerrufsbelehrung und Hinweise zu digitalen Inhalten',
  'wd.intro': `<div class="notice"><p><b>Derzeit bietet Aetherfall: Dungeons keine kostenpflichtigen Inhalte an.</b> Das Spiel ist kostenlos; ein Widerrufsrecht im Sinne der folgenden Belehrung entsteht deshalb im Moment nicht. Die Belehrung ist für einen möglichen späteren Shop vorbereitet und als <b>derzeit nicht aktiv</b> gekennzeichnet.</p></div>`,
  'wd.s1.h': 'Widerrufsbelehrung',
  'wd.s1.b': `<p class="badge">Derzeit nicht aktiv</p>
<div class="inactive">
<h3>Widerrufsrecht</h3>
<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
<p>Um dein Widerrufsrecht auszuüben, musst du uns ({NAME}, {ADDRESS}, E-Mail: {EMAIL_LINK}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
<p>Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.</p>
<h3>Folgen des Widerrufs</h3>
<p>Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.</p>
</div>`,
  'wd.s2.h': 'Vorzeitiges Erlöschen des Widerrufsrechts bei digitalen Inhalten',
  'wd.s2.b': `<p class="badge">Derzeit nicht aktiv</p>
<div class="inactive">
<p>Bei einem Vertrag über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten (z. B. kosmetische Gegenstände im Spiel) erlischt das Widerrufsrecht, wenn wir mit der Vertragserfüllung begonnen haben, nachdem du</p>
<ol>
<li>ausdrücklich zugestimmt hast, dass wir mit der Vertragserfüllung vor Ablauf der Widerrufsfrist beginnen,</li>
<li>deine Kenntnis davon bestätigt hast, dass du durch deine Zustimmung mit Beginn der Vertragserfüllung dein Widerrufsrecht verlierst, und</li>
<li>wir dir eine Bestätigung des Vertrags (auf einem dauerhaften Datenträger, z. B. per E-Mail) zur Verfügung gestellt haben (§ 356 Abs. 5 BGB).</li>
</ol>
<p>Vor dem Kauf fragen wir diese Zustimmung und Bestätigung ausdrücklich mit einer eigenen, nicht vorausgewählten Checkbox ab.</p>
</div>`,
  'wd.s3.h': 'Muster-Widerrufsformular',
  'wd.s3.b': `<p class="badge">Derzeit nicht aktiv</p>
<div class="inactive form">
<p>(Wenn du den Vertrag widerrufen willst, dann fülle bitte dieses Formular aus und sende es zurück.)</p>
<p>An {NAME}, {ADDRESS}, E-Mail: {EMAIL_LINK}:</p>
<p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*) / die Bereitstellung der folgenden digitalen Inhalte (*):</p>
<p class="line">________________________________________</p>
<p>Bestellt am (*) / erhalten am (*): ____________________</p>
<p>Name des/der Verbraucher(s): ____________________</p>
<p>Anschrift des/der Verbraucher(s): ____________________</p>
<p>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ____________________</p>
<p>Datum: ____________________</p>
<p><small>(*) Unzutreffendes streichen.</small></p>
</div>`,
  'wd.s4.h': 'Gewährleistung für digitale Produkte',
  'wd.s4.b': `<p>Für digitale Produkte gelten die gesetzlichen Rechte (§§ 327 ff. BGB). Kostenlose Inhalte stellen wir ohne Gewährleistung über das gesetzlich vorgeschriebene Maß hinaus bereit (siehe <a href="agb.html">Nutzungsbedingungen</a>, § 9).</p>`,
});

I18N.add('en', {
  /* ================================ LEGAL NOTICE ================================ */
  'imp.title': 'Legal notice (Impressum)',
  'imp.intro': '',
  'imp.s1.h': 'Information pursuant to § 5 DDG (German Digital Services Act)',
  'imp.s1.b': `<p>{NAME}<br>{ADDRESS}</p><p data-if="REGISTER">{REGISTER}</p>`,
  'imp.s2.h': 'Contact',
  'imp.s2.b': `<p>Email: {EMAIL_LINK}<span data-if="PHONE"><br>Phone: {PHONE}</span></p>`,
  'imp.s3.h': 'VAT ID',
  'imp.s3.if': 'VAT_ID',
  'imp.s3.b': `<p>VAT identification number pursuant to § 27a of the German VAT Act: {VAT_ID}</p>`,
  'imp.s4.h': 'Responsible for content pursuant to § 18 (2) MStV',
  'imp.s4.b': `<p>{RESPONSIBLE_BLOCK}</p>`,
  'imp.s5.h': 'Consumer dispute resolution',
  'imp.s5.b': `<p>We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board (§ 36 of the German Consumer Dispute Resolution Act).</p>`,
  'imp.s6.h': 'Liability for content and links',
  'imp.s6.b': `<p>We create the content of this website with care but cannot guarantee that it is correct, complete and up to date. As a service provider we are responsible for our own content under general law. The operators of external websites we link to are solely responsible for their content; no legal violations were apparent at the time of linking. If we become aware of any infringement, we will remove the content or link immediately.</p>`,
  'imp.s7.h': 'Copyright and third-party works',
  'imp.s7.b': `<p>The game, texts, graphics, music and sound effects of Aetherfall: Dungeons are protected by copyright. Graphics, characters, logo and sounds are generated procedurally by program code.</p>
<ul>
<li>Fonts “Press Start 2P” and “VT323” – SIL Open Font License 1.1, served locally</li>
<li>three.js – MIT licence</li>
<li>supabase-js – MIT licence</li>
<li>Sign-in via Clerk (Clerk, Inc.)</li>
</ul>`,

  /* ================================ PRIVACY ================================ */
  'priv.title': 'Privacy policy',
  'priv.intro': `<p>We take the protection of your data seriously and only process what the game needs. Here you can find out which data that is, what we use it for, how long we keep it and which rights you have.</p>`,
  'priv.s1.h': 'Controller and contact',
  'priv.s1.b': `<p>The controller within the meaning of the General Data Protection Regulation (GDPR) is:</p>
<p>{NAME}<br>{ADDRESS}<br>Email: {EMAIL_LINK}</p>
<p>For any questions about data protection, contact us at {PRIVACY_EMAIL_LINK}.</p>
<p data-if="DPO"><b>Data protection officer:</b> {DPO}</p>`,
  'priv.s2.h': 'Overview',
  'priv.s2.b': `<ul>
<li>You can play Aetherfall: Dungeons <b>without an account</b> (guest mode). Your saves then stay exclusively in your browser.</li>
<li>With an account, we store account data, saves, settings and – if you use it – data for multiplayer.</li>
<li>We use <b>no trackers, no analytics tools and no advertising</b> and do not build profiles about you.</li>
<li>We serve fonts and program libraries ourselves; nothing is loaded from Google Fonts or other font services.</li>
<li>We only use technically necessary storage on your device (section 9). A consent banner is therefore not required.</li>
</ul>`,
  'priv.s3.h': 'Visiting the website and server log files (hosting)',
  'priv.s3.b': `<p>The website and the game are delivered via <b>{HOSTING}</b>. When you visit, the host automatically processes technical data sent by your browser: IP address, date and time, requested address, referrer, browser and operating system, amount of data transferred and status code.</p>
<p><b>Purpose:</b> delivering the pages, stability and defence against attacks. <b>Legal basis:</b> Art. 6(1)(f) GDPR (legitimate interest in a secure, working service). <b>Retention:</b> {LOG_DAYS}; afterwards the log files are deleted or anonymised unless they are needed longer to investigate a security incident.</p>
<p>We have a data processing agreement with the host (Art. 28 GDPR). Third country: {HOSTING_THIRD_COUNTRY}.</p>`,
  'priv.s4.h': 'Playing in guest mode',
  'priv.s4.b': `<p>In guest mode, the game stores saves, settings and key bindings exclusively in your browser’s local storage (localStorage). This data is not transmitted to us. You can delete it at any time in the game (save slots or Settings › Account › “Delete local data”) or via your browser’s site data.</p>
<p><b>Legal basis:</b> Art. 6(1)(b) GDPR (providing the game) and § 25(2) no. 2 TDDDG (strictly necessary storage).</p>`,
  'priv.s5.h': 'User account and sign-in (Clerk)',
  'priv.s5.b': `<p>For accounts we use the service <b>Clerk</b> (Clerk, Inc., USA) as a processor. Processed are: email address, password (only as a secure hash at Clerk; we never see it), account ID, optionally a username and – when signing in via a social provider such as Google – name, profile picture and that provider’s identifier. For security, Clerk also processes session data, IP address and browser identifier, for example to detect suspicious sign-ins.</p>
<p>To protect against automated sign-ups, Clerk may embed <b>Cloudflare Turnstile</b> (Cloudflare, Inc., USA); this transmits technical characteristics of your browser to Cloudflare.</p>
<p>On the home page, Clerk’s sign-in script is only loaded when you sign in or are already signed in. Clerk’s usage statistics (“telemetry”) are switched off.</p>
<p><b>Purpose:</b> registration, sign-in, password reset, account management, protection against abuse. <b>Legal basis:</b> Art. 6(1)(b) GDPR (contract of use) and (f) (security). <b>Third country:</b> Clerk and Cloudflare are based in the USA. Transfers rely on the adequacy decision for the EU-U.S. Data Privacy Framework where the provider is certified, and otherwise on EU standard contractual clauses (Art. 46(2)(c) GDPR) in the data processing agreement.</p>`,
  'priv.s6.h': 'Cloud saves and profile (Supabase)',
  'priv.s6.b': `<p>When you play signed in, we store your saves (character, progress, quests, map, inventory, summary), settings, key bindings, language and display name in a database at <b>Supabase</b> (Supabase, Inc.) as a processor. Data is linked via your Clerk account ID; access is technically limited to your own data (row level security). Storage location: {SUPABASE_REGION}.</p>
<p><b>Purpose:</b> storing and syncing your saves between devices. <b>Legal basis:</b> Art. 6(1)(b) GDPR. <b>Third country:</b> Supabase is a US company; where data is processed or can be accessed from outside the EU, EU standard contractual clauses in the data processing agreement or the adequacy decision for the EU-U.S. Data Privacy Framework apply.</p>`,
  'priv.s7.h': 'Multiplayer: display name, lobbies, chat, friends and reports',
  'priv.s7.b': `<p>In multiplayer we process the following via Supabase (database and real-time channels):</p>
<ul>
<li><b>Display name</b> with a four-character tag (chosen by you, visible to other players – please do not use your real name or email address) and the time of your last activity (online status for friends),</li>
<li><b>Lobbies</b>: code, settings, members with class and level; during a session also position, actions and game state,</li>
<li><b>Chat messages</b>, pings and emotes: they are transmitted in real time to the players in the lobby and are <b>not stored permanently</b> by us,</li>
<li><b>Friends list and invitations</b>, <b>blocks and mutes</b>,</li>
<li><b>Reports</b> about other players: reason, optional description and, as evidence, the reported player’s latest chat messages, the lobby code and the number of automatic warnings.</li>
</ul>
<p><b>Purpose:</b> playing together, protecting players, moderation. <b>Legal basis:</b> Art. 6(1)(b) GDPR; for reports and moderation Art. 6(1)(f) GDPR (protecting the community). Lobbies are deleted after 24 hours at the latest, invitations after one day; we keep reports until they have been handled, for at most six months.</p>`,
  'priv.s8.h': 'Contacting us by email',
  'priv.s8.b': `<p>When you write to us, we process your email address, your name (if given) and the content of your message to answer your request. <b>Legal basis:</b> Art. 6(1)(b) GDPR (requests about your account) or (f) (other requests). We delete messages once your request has been settled unless statutory retention obligations apply. There is deliberately no contact form.</p>`,
  'priv.s9.h': 'Cookies and local storage',
  'priv.s9.b': `<p>We only use <b>technically necessary</b> storage on your device (§ 25(2) no. 2 TDDDG). There are no cookies or storage for analytics or advertising.</p>
<div class="tableWrap"><table>
<caption>Overview of stored items</caption>
<thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Purpose</th><th scope="col">Duration</th></tr></thead>
<tbody>
<tr><td><code>aetherfall_lang</code></td><td>localStorage (website)</td><td>chosen language</td><td>until deleted</td></tr>
<tr><td><code>aetherfall_settings</code>, <code>aetherfall_muted</code></td><td>localStorage (game)</td><td>settings, language, key bindings, guest mode</td><td>until deleted</td></tr>
<tr><td><code>aetherfall_slot_…</code>, <code>aetherfall_backup_…</code></td><td>localStorage (game)</td><td>saves and backup copies on your device</td><td>until deleted</td></tr>
<tr><td><code>aetherfall_meta</code></td><td>localStorage (game)</td><td>last signed-in account (ID, name, email) for offline use – on your device only</td><td>until sign-out or deletion</td></tr>
<tr><td><code>aetherfall_pending_consent</code>, <code>aetherfall_consent_ok</code>, <code>af_mp_link</code></td><td>sessionStorage</td><td>consent during sign-up until it is stored; check result; lobby link on reload</td><td>until the tab is closed</td></tr>
<tr><td><code>__session</code>, <code>__client_uat</code> (possibly with suffix), <code>__client</code></td><td>Clerk cookies</td><td>sign-in and session, abuse protection</td><td>session or until sign-out</td></tr>
<tr><td>Entries starting with <code>__clerk</code></td><td>localStorage (Clerk)</td><td>cache of sign-in settings</td><td>until deleted</td></tr>
<tr data-if="MEDIA_HOST"><td><code>aetherfall_media_consent</code></td><td>localStorage (website)</td><td>your choice regarding the external video</td><td>until reset</td></tr>
</tbody></table></div>
<p data-if="MEDIA_HOST"><b>External video:</b> The trailer is provided by {MEDIA_HOST} and is only loaded when you click “Load video” (consent under Art. 6(1)(a) GDPR and § 25(1) TDDDG). You can withdraw your choice at any time via “External media settings” in the footer.</p>`,
  'priv.s10.h': 'Consent during sign-up',
  'priv.s10.b': `<p>When signing up, you confirm that you accept the terms of use, have read the privacy policy and are at least {MIN_AGE} years old. As proof we store in the <code>consents</code> table at Supabase: account ID, versions of the terms of use and of the privacy policy, version and wording of the consent text, language, age confirmation, source (website or game) and the time. If the texts change, we ask you to confirm again. <b>Legal basis:</b> Art. 6(1)(b) and (f) GDPR (conclusion of the contract and proof). We delete these records together with your account.</p>`,
  'priv.s11.h': 'Recipients and processors',
  'priv.s11.b': `<div class="tableWrap"><table>
<caption>Service providers processing data on our behalf</caption>
<thead><tr><th scope="col">Service</th><th scope="col">Purpose</th><th scope="col">Location / third country</th><th scope="col">Basis</th></tr></thead>
<tbody>
<tr><td>{HOSTING}</td><td>delivery of the website and the game</td><td>{HOSTING_THIRD_COUNTRY}</td><td>data processing agreement</td></tr>
<tr><td>Clerk, Inc.</td><td>accounts and sign-in</td><td>USA</td><td>processing agreement, Data Privacy Framework or standard contractual clauses</td></tr>
<tr><td>Cloudflare, Inc. (via Clerk)</td><td>protection against automated sign-ups</td><td>USA</td><td>sub-processor of Clerk</td></tr>
<tr><td>Supabase, Inc.</td><td>database, real-time channels, account deletion</td><td>{SUPABASE_REGION}; US company</td><td>processing agreement, standard contractual clauses</td></tr>
</tbody></table></div>
<p>Data is only passed on to other third parties if we are legally obliged to do so (e.g. by order of an authority).</p>`,
  'priv.s12.h': 'Retention and deletion',
  'priv.s12.b': `<ul>
<li><b>Account, profile, cloud saves, consent records:</b> until you delete your account. You can delete individual saves yourself at any time.</li>
<li><b>Multiplayer data:</b> lobbies at most 24 hours, invitations one day; friends list and blocks until removed or until account deletion; reports until handled, at most six months.</li>
<li><b>Server log files:</b> {LOG_DAYS}.</li>
<li><b>Emails:</b> until your request has been settled unless statutory retention obligations apply.</li>
</ul>
<p><b>Deleting your account:</b> In the game under Settings › Account › “Delete account and data”. This permanently removes your Clerk account and all related data at Supabase (profile, saves, multiplayer data, consent records). Alternatively, an email to {PRIVACY_EMAIL_LINK} from your account’s address is sufficient.</p>`,
  'priv.s13.h': 'Your rights',
  'priv.s13.b': `<p>You have the right at any time to</p>
<ul>
<li><b>access</b> your stored data (Art. 15 GDPR),</li>
<li><b>rectification</b> of incorrect data (Art. 16 GDPR),</li>
<li><b>erasure</b> (Art. 17 GDPR) and <b>restriction of processing</b> (Art. 18 GDPR),</li>
<li><b>data portability</b> (Art. 20 GDPR) – in the game under Settings › Account › “Export my data” as a JSON file,</li>
<li><b>object</b> to processing based on legitimate interests (Art. 21 GDPR),</li>
<li><b>withdraw</b> consent with effect for the future (Art. 7(3) GDPR).</li>
</ul>
<p>Contact {PRIVACY_EMAIL_LINK} for this. You can also lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), for example the authority responsible for us: {AUTHORITY}.</p>`,
  'priv.s14.h': 'Children and young people',
  'priv.s14.b': `<p>An account may only be created from the age of {MIN_AGE}; you confirm this when signing up. Younger players can play without an account in guest mode – we process no account data then. If we learn that an account was created against this rule, we will delete it. Parents can contact {PRIVACY_EMAIL_LINK} at any time.</p>`,
  'priv.s15.h': 'Data security',
  'priv.s15.b': `<p>All connections are encrypted with TLS. In the database, row level security ensures that each account can only read and change its own data. Only public keys are present in the browser; secret keys are only used on the server (e.g. for account deletion). A content security policy restricts which sources may be loaded.</p>`,
  'priv.s16.h': 'Payment processing (currently inactive)',
  'priv.s16.b': `<p class="badge">Currently inactive</p>
<div class="inactive"><p>Aetherfall: Dungeons currently offers no paid content; no payment data is processed. Should cosmetic items be offered later, we will add the following here before launch: the payment provider <mark class="ph">[PAYMENT PROVIDER, ADDRESS]</mark>, the data processed (e.g. name, payment method, transaction data), purpose (performance of the contract, Art. 6(1)(b) GDPR), statutory retention of accounting records (Art. 6(1)(c) GDPR, up to ten years), third-country transfers and the processing agreement or the provider’s own responsibility.</p></div>`,
  'priv.s17.h': 'Obligation to provide data, no automated decisions',
  'priv.s17.b': `<p>You are not obliged to provide us with data. Without an account you can play in guest mode; cloud saves and multiplayer require an account. There is no automated decision-making including profiling within the meaning of Art. 22 GDPR. The automatic plausibility check in multiplayer (protection against manipulation) may remove players from a lobby but never leads to an account suspension without human review.</p>`,
  'priv.s18.h': 'Changes to this privacy policy',
  'priv.s18.b': `<p>We update this privacy policy when the game, the services used or the legal situation change. The current version and its date are shown at the top of this page. In case of material changes, we ask signed-in users to confirm on their next visit.</p>`,

  /* ================================ TERMS ================================ */
  'tos.title': 'General terms and conditions of use',
  'tos.intro': `<p>These terms govern the use of the browser game “Aetherfall: Dungeons” and this website. Please read them carefully – by registering an account you agree to them.</p>`,
  'tos.s1.h': '§ 1 Provider and scope',
  'tos.s1.b': `<p>(1) The provider is {NAME}, {ADDRESS} (“we”). Contact: {EMAIL_LINK}.</p>
<p>(2) These terms apply to all users of the game and the website, in guest mode and with an account. Deviating terms of users do not apply.</p>`,
  'tos.s2.h': '§ 2 Services',
  'tos.s2.b': `<p>(1) Aetherfall: Dungeons is a free action role-playing game that runs directly in the browser. There is no entitlement to specific content, features or their continued existence; we develop the game continuously and may change, extend or remove content.</p>
<p>(2) <b>Guest mode:</b> Without an account you can play the full single-player game. Saves are stored only locally in your browser; you are responsible for keeping them.</p>
<p>(3) <b>Account:</b> With an account, up to five saves, an automatic save and your settings are stored in the cloud and synced between devices. You can also use multiplayer (co-op for 2–4 players), friends lists and invitations.</p>
<p>(4) Use is currently completely free of charge. There is no paid content (see § 7).</p>`,
  'tos.s3.h': '§ 3 Registration and account',
  'tos.s3.b': `<p>(1) Only persons aged at least {MIN_AGE} may create an account. By registering, you confirm your age, accept these terms and confirm that you have read the privacy policy. The contract of use is concluded when registration is completed.</p>
<p>(2) Your details must be accurate. Each account is personal and not transferable. Keep your credentials secret and let us know if you suspect misuse.</p>
<p>(3) You can delete your account at any time without giving reasons (in the game under Settings › Account or by email). This ends the contract of use.</p>
<p>(4) We do not store the text of these terms separately for you; you can view, save and print the current version on this page at any time.</p>`,
  'tos.s4.h': '§ 4 Rules of conduct',
  'tos.s4.b': `<p>(1) <b>Chat, names and reports:</b> Prohibited are insults, threats, harassment, hate speech and discrimination, sexual content or content glorifying violence, spam and advertising, publishing other people’s personal data and content that violates laws or third-party rights. This also applies to display names and character names. Abusive reports are prohibited as well.</p>
<p>(2) <b>Multiplayer:</b> Treat other players fairly. Prohibited are deliberate disruption (e.g. blocking puzzles, obstructing revives), exploiting bugs to the detriment of others and passing on lobby codes to people who want to disrupt a private lobby.</p>
<p>(3) <b>Cheats and manipulation:</b> Prohibited are modifying the game code or network traffic to gain advantages for yourself or others in multiplayer, using bots or automation, circumventing protective measures, attacks on our servers or those of other users and any form of overloading. You may use the commands and developer tools provided in the game in single-player for your own save; in multiplayer only if the host has allowed them for their private lobby.</p>
<p>(4) Please report bugs and security vulnerabilities to {EMAIL_LINK} instead of exploiting them. Thank you!</p>`,
  'tos.s5.h': '§ 5 Moderation, suspension and termination',
  'tos.s5.b': `<p>(1) In case of violations of these terms we may – depending on severity and repetition – remove content, issue warnings, suspend access to multiplayer temporarily or permanently, or suspend or terminate the account. We take the legitimate interests of everyone involved into account.</p>
<p>(2) The automatic plausibility check in multiplayer may remove players from a lobby in case of obvious manipulation. An account is only suspended after human review. You will be informed of a suspension by email and can object at {EMAIL_LINK}.</p>
<p>(3) We may terminate the contract of use with four weeks’ notice, for example if we discontinue the game. The right to terminate for good cause remains unaffected. Before discontinuing the game, we will give you the opportunity to export your data.</p>`,
  'tos.s6.h': '§ 6 Rights to the game and content',
  'tos.s6.b': `<p>(1) The game, its texts, graphics, music and program code are protected by copyright. You receive a simple, non-transferable right, revocable at any time, to use the game for private, non-commercial purposes.</p>
<p>(2) For content you create in the game (e.g. display names, chat messages), you grant us the rights necessary to display it in the game and transmit it to other players. You are welcome to create and publish videos and streams of the game, including with ad revenue, as long as you do not give the impression of speaking for us officially.</p>`,
  'tos.s7.h': '§ 7 Virtual items and cosmetics (placeholder – currently inactive)',
  'tos.s7.b': `<p class="badge">Currently inactive</p>
<div class="inactive"><p>There is currently no paid content. This section is prepared for a possible future shop and only takes effect when it is introduced (and after renewed consent):</p>
<p>(1) We may offer optional cosmetic items (e.g. colours, capes, emblems) for a fee. They do not provide gameplay advantages.</p>
<p>(2) With a purchase you receive a simple, non-transferable right to use the item in your account. Virtual items have no monetary value and cannot be exchanged for money, sold or transferred to other accounts.</p>
<p>(3) Prices, payment methods and conclusion of contract: <mark class="ph">[PRICES INCL. VAT, PAYMENT PROVIDER, ORDER PROCESS, ORDER SUMMARY, “ORDER WITH OBLIGATION TO PAY” BUTTON]</mark>.</p>
<p>(4) The withdrawal policy for digital content applies (see <a href="widerruf.html">Withdrawal</a>). In case of defects, the statutory rights for digital products apply (§§ 327 et seq. BGB).</p>
<p>(5) If the game is discontinued, we will give at least <mark class="ph">[NOTICE PERIOD, e.g. three months]</mark> notice; for items purchased within <mark class="ph">[PERIOD]</mark> before the announcement we will refund the price pro rata.</p></div>`,
  'tos.s8.h': '§ 8 Availability and saves',
  'tos.s8.b': `<p>(1) We strive for smooth operation but cannot promise uninterrupted availability. Maintenance, updates, outages at service providers or force majeure may temporarily restrict use.</p>
<p>(2) We back up cloud saves with reasonable effort. Local saves in guest mode exist only in your browser and are lost if you delete the site data. Use the export function under Settings › Account if needed.</p>`,
  'tos.s9.h': '§ 9 Liability',
  'tos.s9.b': `<p>(1) We are liable without limitation for intent and gross negligence, for damage resulting from injury to life, body or health, under the German Product Liability Act and to the extent of any guarantee given.</p>
<p>(2) In case of slight negligence, we are only liable for breach of essential contractual obligations whose fulfilment makes the proper performance of the contract possible in the first place and on whose observance you may regularly rely (cardinal obligations); liability is then limited to the typical, foreseeable damage.</p>
<p>(3) As use is free of charge, we are otherwise only liable for intent and gross negligence (cf. §§ 521, 599 BGB). For loss of data we are only liable to the extent that would have occurred with customary data backups.</p>`,
  'tos.s10.h': '§ 10 Data protection',
  'tos.s10.b': `<p>How we handle your data is explained in the <a href="datenschutz.html">privacy policy</a>.</p>`,
  'tos.s11.h': '§ 11 Changes to these terms',
  'tos.s11.b': `<p>(1) We may change these terms with effect for the future if there is a valid reason, such as new features or changes in law or case law, and the change is reasonable for you. We will not change essential contractual obligations to your disadvantage.</p>
<p>(2) We will inform you of changes at least two weeks before they take effect by email or when you next sign in. The changed terms only apply once you agree to them. If you do not agree, you can continue to use the game in guest mode; we may then terminate the contract of use with four weeks’ notice.</p>`,
  'tos.s12.h': '§ 12 Final provisions',
  'tos.s12.b': `<p>(1) The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods. If you are a consumer habitually resident in another EU member state, the protection afforded by the mandatory provisions of that state remains unaffected.</p>
<p>(2) If users are merchants, legal entities under public law or special funds under public law, the place of jurisdiction is our registered office.</p>
<p>(3) We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.</p>
<p>(4) Should any provision be invalid, the remaining provisions remain valid; the statutory provisions take the place of the invalid provision.</p>`,

  /* ================================ WITHDRAWAL ================================ */
  'wd.title': 'Right of withdrawal and notes on digital content',
  'wd.intro': `<div class="notice"><p><b>Aetherfall: Dungeons currently offers no paid content.</b> The game is free of charge, so no right of withdrawal within the meaning of the following policy arises at the moment. The policy is prepared for a possible future shop and marked as <b>currently inactive</b>.</p></div>`,
  'wd.s1.h': 'Withdrawal policy',
  'wd.s1.b': `<p class="badge">Currently inactive</p>
<div class="inactive">
<h3>Right of withdrawal</h3>
<p>You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day the contract is concluded.</p>
<p>To exercise your right of withdrawal, you must inform us ({NAME}, {ADDRESS}, email: {EMAIL_LINK}) of your decision to withdraw from this contract by means of a clear statement (e.g. a letter sent by post or an email). You may use the attached model withdrawal form, but this is not obligatory.</p>
<p>To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired.</p>
<h3>Effects of withdrawal</h3>
<p>If you withdraw from this contract, we shall reimburse to you all payments received from you without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.</p>
</div>`,
  'wd.s2.h': 'Early expiry of the right of withdrawal for digital content',
  'wd.s2.b': `<p class="badge">Currently inactive</p>
<div class="inactive">
<p>For a contract for the supply of digital content not on a tangible medium (e.g. cosmetic items in the game), the right of withdrawal expires once we have begun performance after you</p>
<ol>
<li>have expressly consented to us beginning performance before the end of the withdrawal period,</li>
<li>have acknowledged that by giving this consent you lose your right of withdrawal once performance has begun, and</li>
<li>we have provided you with a confirmation of the contract (on a durable medium, e.g. by email) (§ 356(5) BGB).</li>
</ol>
<p>Before any purchase we ask for this consent and acknowledgement explicitly with a separate checkbox that is not pre-ticked.</p>
</div>`,
  'wd.s3.h': 'Model withdrawal form',
  'wd.s3.b': `<p class="badge">Currently inactive</p>
<div class="inactive form">
<p>(Complete and return this form only if you wish to withdraw from the contract.)</p>
<p>To {NAME}, {ADDRESS}, email: {EMAIL_LINK}:</p>
<p>I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*) / for the provision of the following service (*) / for the supply of the following digital content (*):</p>
<p class="line">________________________________________</p>
<p>Ordered on (*) / received on (*): ____________________</p>
<p>Name of consumer(s): ____________________</p>
<p>Address of consumer(s): ____________________</p>
<p>Signature of consumer(s) (only if this form is notified on paper): ____________________</p>
<p>Date: ____________________</p>
<p><small>(*) Delete as appropriate.</small></p>
</div>`,
  'wd.s4.h': 'Warranty for digital products',
  'wd.s4.b': `<p>The statutory rights apply to digital products (§§ 327 et seq. BGB). We provide free content without warranty beyond what is required by law (see <a href="agb.html">terms of use</a>, § 9).</p>`,
});
