/* ============================== I18N (Website) ============================
   Zentrales Sprachsystem wie im Spiel: Schlüssel → Text, t('schluessel', { wert }).
   Texte: assets/js/lang-site.js (Seiten, Oberfläche) und assets/js/lang-legal.js (Rechtstexte), je Deutsch und Englisch.
   Sprachwahl: ?lang=de|en → gespeicherte Wahl → Browsersprache (navigator.languages) → Englisch.
   Gespeichert wird die Wahl in localStorage „aetherfall_lang“ und – falls das Spiel schon Einstellungen angelegt hat –
   in dessen „aetherfall_settings“.lang. Links ins Spiel tragen zusätzlich ?lang=…, damit das Spiel in derselben Sprache startet.
   Platzhalter in Texten: {NAME}, {EMAIL} … kommen aus SITE_CONFIG (assets/js/config.js), {x} aus den Aufruf-Werten.
   Im DOM: data-i18n="key" (Text), data-i18n-html="key" (HTML aus dem eigenen Wörterbuch), data-i18n-attr="aria-label:key;title:key2".
   ========================================================================== */
(function () {
  'use strict';
  const STORE_SITE = 'aetherfall_lang', STORE_GAME = 'aetherfall_settings';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isPh = v => typeof v === 'string' && /^\[.*\]$/s.test(v.trim());
  // Speicherzugriffe: nie werfen, Fehler aber protokollieren
  const Store = {
    get(k) { try { return window.localStorage ? localStorage.getItem(k) : null; } catch (e) { console.warn('[Aetherfall] localStorage nicht lesbar:', k, e); return null; } },
    set(k, v) { try { if (window.localStorage) localStorage.setItem(k, v); return true; } catch (e) { console.warn('[Aetherfall] localStorage nicht beschreibbar:', k, e); return false; } },
    del(k) { try { if (window.localStorage) localStorage.removeItem(k); } catch (e) { console.warn('[Aetherfall] localStorage:', k, e); } },
    sget(k) { try { return window.sessionStorage ? sessionStorage.getItem(k) : null; } catch (e) { console.warn('[Aetherfall] sessionStorage nicht lesbar:', k, e); return null; } },
    sset(k, v) { try { if (window.sessionStorage) sessionStorage.setItem(k, v); return true; } catch (e) { console.warn('[Aetherfall] sessionStorage nicht beschreibbar:', k, e); return false; } },
    sdel(k) { try { if (window.sessionStorage) sessionStorage.removeItem(k); } catch (e) { console.warn('[Aetherfall] sessionStorage:', k, e); } },
  };

  const I18N = {
    LANGS: { de: { name: 'Deutsch', short: 'DE', locale: 'de-DE', og: 'de_DE' }, en: { name: 'English', short: 'EN', locale: 'en-GB', og: 'en_GB' } },
    lang: 'de', dict: { de: {}, en: {} }, listeners: [], missing: new Set(), placeholders: new Set(),
    add(lang, obj) { this.dict[lang] = Object.assign(this.dict[lang] || {}, obj); },
    has(key) { return key in this.dict[this.lang] || key in this.dict.de; },
    raw(key) {
      const d = this.dict[this.lang] || {};
      if (key in d) return d[key];
      this.miss(key);
      return key in this.dict.de ? this.dict.de[key] : key in this.dict.en ? this.dict.en[key] : key;
    },
    miss(key) {
      if (this.missing.has(this.lang + ':' + key)) return;
      this.missing.add(this.lang + ':' + key);
      console.warn(`[Aetherfall] Text fehlt (${this.lang}): ${key}`);
    },
    // Werte aus der Konfiguration, die in allen Texten als {NAME} usw. verfügbar sind
    cfg() {
      const C = window.SITE_CONFIG || {}, L = C.LEGAL || {}, D = C.LEGAL_DOCS || {};
      const email = C.CONTACT_EMAIL || '';
      const v = {
        NAME: L.NAME || '', ADDRESS: L.ADDRESS || '', PHONE: L.PHONE || '', VAT_ID: L.VAT_ID || '', REGISTER: L.REGISTER || '',
        RESPONSIBLE: L.RESPONSIBLE || '', DPO: L.DPO || '', AUTHORITY: L.AUTHORITY || '', HOSTING: L.HOSTING || '',
        HOSTING_THIRD_COUNTRY: L.HOSTING_THIRD_COUNTRY || '', LOG_DAYS: L.LOG_DAYS || '', SUPABASE_REGION: L.SUPABASE_REGION || '',
        EMAIL: email, PRIVACY_EMAIL: L.PRIVACY_EMAIL || email, MIN_AGE: String(C.MIN_AGE || 16),
        SITE_URL: C.SITE_URL || '', SITE: String(C.SITE_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''), YEAR: String(new Date().getFullYear()),
        MEDIA_HOST: (() => { try { return C.TRAILER_EMBED ? new URL(C.TRAILER_EMBED).hostname : ''; } catch (e) { return ''; } })(),
      };
      for (const k in D) { v['V_' + k.toUpperCase()] = D[k].version || ''; v['D_' + k.toUpperCase()] = this.date(D[k].date); }
      return v;
    },
    // Text-Fassung: Platzhalter ersetzen, Zeilenumbrüche in Adressen → „, “
    t(key, vars) {
      const s = this.raw(key), V = Object.assign(this.cfg(), vars || {});
      return String(s).replace(/\{([A-Za-z0-9_]+)\}/g, (m, k) => {
        if (!(k in V)) return m;
        const val = String(V[k]); if (isPh(val)) this.placeholders.add(val);
        return val.replace(/\s*\n\s*/g, ', ');
      });
    },
    // HTML-Fassung (nur für Texte aus dem eigenen Wörterbuch): Werte werden maskiert, Platzhalter markiert
    html(key, vars) {
      const s = this.raw(key), V = Object.assign(this.cfg(), vars || {});
      const email = V.EMAIL, pmail = V.PRIVACY_EMAIL;
      const link = m => isPh(m) || !m ? this.mark(m) : `<a href="mailto:${esc(m)}">${esc(m)}</a>`;
      V.EMAIL_LINK = { html: link(email) }; V.PRIVACY_EMAIL_LINK = { html: link(pmail) };
      V.RESPONSIBLE_BLOCK = { html: V.RESPONSIBLE ? this.val(V.RESPONSIBLE) : this.val(V.NAME) + '<br>' + this.val(V.ADDRESS) };
      return String(s).replace(/\{([A-Za-z0-9_]+)\}/g, (m, k) => {
        if (!(k in V)) return m;
        const val = V[k];
        return val && typeof val === 'object' && 'html' in val ? val.html : this.val(val);
      });
    },
    val(v) { const s = String(v == null ? '' : v); return isPh(s) ? this.mark(s) : esc(s).replace(/\n/g, '<br>'); },
    mark(s) { this.placeholders.add(s); return `<mark class="ph" title="${esc(this.t('ph.hint'))}">${esc(s)}</mark>`; },
    date(iso) {
      if (!iso) return '';
      const d = new Date(String(iso) + (String(iso).length <= 10 ? 'T12:00:00' : ''));
      if (isNaN(d)) return String(iso);
      try { return d.toLocaleDateString(this.LANGS[this.lang].locale, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return String(iso); }
    },
    // ---- Sprachwahl ----
    detect() {
      const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
      for (const l of list) { const c = String(l || '').slice(0, 2).toLowerCase(); if (this.LANGS[c]) return c; }
      return 'en';
    },
    stored() {
      const g = Store.get(STORE_GAME);
      if (g) { try { const l = JSON.parse(g).lang; if (this.LANGS[l]) return l; } catch (e) { console.warn('[Aetherfall] Spiel-Einstellungen nicht lesbar', e); } }
      const s = Store.get(STORE_SITE);
      return this.LANGS[s] ? s : null;
    },
    urlLang() { try { const l = new URLSearchParams(location.search).get('lang'); return this.LANGS[l] ? l : null; } catch (e) { return null; } },
    // Crawler (Suchmaschinen, Vorschau-Dienste, Lighthouse) sehen immer die Sprache ihrer Adresse: ohne ?lang= Deutsch, mit ?lang=en Englisch.
    // So passen Inhalt, canonical und hreflang zusammen; Menschen bekommen beim ersten Besuch ihre Browsersprache.
    bot() { try { return /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview|validator/i.test(navigator.userAgent || ''); } catch (e) { return false; } },
    init() {
      const u = this.urlLang();
      this.lang = u || (this.bot() ? 'de' : this.stored() || this.detect());
      if (u && !this.bot()) this.persist(u);
      document.documentElement.lang = this.lang;
      return this.lang;
    },
    persist(l) {
      Store.set(STORE_SITE, l);
      // Einstellungen des Spiels nur anpassen, wenn es sie schon gibt (sonst legt das Spiel beim ersten Start eigene Standardwerte an)
      const g = Store.get(STORE_GAME);
      if (g) { try { const o = JSON.parse(g); if (o && typeof o === 'object' && o.lang !== l) { o.lang = l; Store.set(STORE_GAME, JSON.stringify(o)); } } catch (e) { console.warn('[Aetherfall] Spiel-Einstellungen nicht anpassbar', e); } }
    },
    set(l) {
      if (!this.LANGS[l] || l === this.lang) return;
      this.lang = l; this.persist(l); document.documentElement.lang = l;
      // ?lang= in der Adresse mitziehen (Neuladen behält die Wahl)
      try { const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.set('lang', l); history.replaceState(history.state, '', u.toString()); } } catch (e) { console.warn('[Aetherfall] Adresse nicht anpassbar', e); }
      this.apply(document);
      for (const fn of this.listeners) { try { fn(l); } catch (e) { console.error(e); } }
    },
    onChange(fn) { this.listeners.push(fn); },
    // ---- DOM ----
    apply(root) {
      const R = root || document;
      R.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      R.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = this.html(el.dataset.i18nHtml); this.conditions(el); });
      R.querySelectorAll('[data-i18n-attr]').forEach(el => {
        for (const part of el.dataset.i18nAttr.split(';')) { const [a, k] = part.split(':').map(s => s && s.trim()); if (a && k) el.setAttribute(a, this.t(k)); }
      });
    },
    // data-if="VAT_ID": Element nur zeigen, wenn der Wert gesetzt ist; data-ifnot: nur wenn leer
    conditions(el) {
      const V = this.cfg();
      el.querySelectorAll('[data-if],[data-ifnot]').forEach(n => {
        const k = n.dataset.if || n.dataset.ifnot, on = !!String(V[k] || '').trim();
        if (n.hasAttribute('data-if') ? !on : on) n.remove();
      });
    },
  };
  window.I18N = I18N;
  window.t = (k, v) => I18N.t(k, v);
  window.SiteStore = Store;
  window.siteEsc = esc;
})();
