/* ============================== ANMELDUNG (Clerk) & ZUSTIMMUNG ============
   · Clerk wird über das offizielle CDN der eigenen Clerk-Instanz geladen (Frontend-API aus dem Publishable Key).
     Auf normalen Seiten nur, wenn bereits eine Sitzung besteht (Cookie __client_uat) oder eine Zustimmung aussteht;
     auf anmelden.html / registrieren.html immer. So entstehen beim bloßen Besuch keine Verbindungen zu Clerk.
   · Komponenten: SignIn (inkl. Passwort-Reset), SignUp, UserButton (Konto verwalten, Abmelden), UserProfile.
   · Registrierung nur nach Pflicht-Zustimmung (Nutzungsbedingungen + Datenschutz, Mindestalter). Die Zustimmung wird
     mit Zeitstempel und Textversion in der Supabase-Tabelle „consents“ gespeichert (REST, Clerk-Token, RLS: nur eigene Zeilen).
   · Ändert sich die Version von AGB oder Datenschutzerklärung (SITE_CONFIG.LEGAL_DOCS), wird erneut gefragt.
   · Im Frontend stehen nur der Publishable Key und der Supabase Publishable/Anon Key – nie Secret Keys.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.SITE_CONFIG || {}, $ = s => document.querySelector(s), esc = window.siteEsc;
  const K_PENDING = 'aetherfall_pending_consent', K_OK = 'aetherfall_consent_ok', K_LATER = 'aetherfall_consent_later';
  const root = () => (document.body && document.body.dataset.root) || '';
  const pageUrl = p => new URL(root() + p, location.href).href;
  const timeout = (p, ms, what) => Promise.race([p, new Promise((res, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);

  /* ---------------- Zustimmung (consents) ---------------- */
  const Consent = {
    versions() {
      const D = C.LEGAL_DOCS || {};
      return { terms: String((D.agb && D.agb.version) || '1.0'), privacy: String((D.datenschutz && D.datenschutz.version) || '1.0'), text: String(C.CONSENT_TEXT_VERSION || '1') };
    },
    text() { return t('consent.termsPlain') + ' ' + t('consent.age'); },
    current(r) { const v = this.versions(); return !!r && String(r.terms_version) === v.terms && String(r.privacy_version) === v.privacy; },
    create(source) {
      const v = this.versions();
      const p = { terms_version: v.terms, privacy_version: v.privacy, text_version: v.text, consent_text: this.text().slice(0, 1000), lang: I18N.lang,
        age_confirmed: true, min_age: +C.MIN_AGE || 16, client_at: new Date().toISOString(), source: source || 'landing' };
      SiteStore.sset(K_PENDING, JSON.stringify(p)); return p;
    },
    pendingRaw() { return SiteStore.sget(K_PENDING); },
    pending() { try { const p = JSON.parse(this.pendingRaw() || 'null'); return p && this.current(p) && p.age_confirmed === true ? p : null; } catch (e) { console.warn('[Aetherfall] Zustimmung im Zwischenspeicher unlesbar', e); return null; } },
    clearPending() { SiteStore.sdel(K_PENDING); },
    configured() {
      const u = String(C.SUPABASE_URL || '').trim(), k = String(C.SUPABASE_KEY || '').trim();
      return /^https:\/\/[^\s/]+/.test(u) && !!k && !Site.secretWarn;
    },
    async api(path, opt) {
      const tok = SiteAuth.clerk && SiteAuth.clerk.session ? await SiteAuth.clerk.session.getToken() : null;
      if (!tok) throw new Error('no-session');
      const o = opt || {}, url = String(C.SUPABASE_URL).replace(/\/+$/, '') + '/rest/v1/' + path;
      const res = await fetch(url, { method: o.method || 'GET', headers: Object.assign({ apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + tok, Accept: 'application/json' }, o.body ? { 'Content-Type': 'application/json', Prefer: 'return=minimal' } : {}), body: o.body ? JSON.stringify(o.body) : undefined });
      if (!res.ok) {
        let info = {}; try { info = await res.json(); } catch (e) { /* kein JSON */ }
        const err = new Error(`Supabase ${res.status} ${info.code || ''} ${info.message || ''}`.trim()); err.status = res.status; err.code = info.code; throw err;
      }
      return res.status === 204 || res.status === 201 ? null : res.json();
    },
    async latest() {
      const rows = await this.api('consents?select=terms_version,privacy_version,accepted_at&order=accepted_at.desc&limit=1');
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    },
    async insert(p, kind) { await this.api('consents', { method: 'POST', body: Object.assign({}, p, { kind: kind || 'signup' }) }); },
    okKey(u) { const v = this.versions(); return u.id + '|' + v.terms + '|' + v.privacy; },
    // Nach jeder Anmeldung: liegt eine aktuelle Zustimmung vor? Sonst ausstehende speichern oder erneut fragen.
    running: false,
    async run(u) {
      if (!u || !this.configured() || this.running) return;
      this.running = true;
      try { await this.check(u); } finally { this.running = false; }
    },
    async check(u) {
      if (SiteStore.sget(K_OK) === this.okKey(u)) { this.clearPending(); return; }
      const pend = this.pending();
      try {
        const last = await this.latest();
        if (this.current(last)) { SiteStore.sset(K_OK, this.okKey(u)); this.clearPending(); return; }
        if (pend) { await this.insert(pend, 'signup'); SiteStore.sset(K_OK, this.okKey(u)); this.clearPending(); return; }
        // Rückfall: bei der Registrierung in Clerk mitgegebene Zustimmung (unsafeMetadata), falls der Tab gewechselt wurde
        const m = u.unsafeMetadata && u.unsafeMetadata.consent;
        if (m && String(m.terms) === this.versions().terms && String(m.privacy) === this.versions().privacy && m.age === true) {
          await this.insert({ terms_version: String(m.terms), privacy_version: String(m.privacy), text_version: String(m.text || this.versions().text), consent_text: String(m.consentText || this.text()).slice(0, 1000),
            lang: I18N.LANGS[m.lang] ? m.lang : I18N.lang, age_confirmed: true, min_age: +m.minAge || +C.MIN_AGE || 16, client_at: m.at || null, source: 'landing' }, 'signup');
          SiteStore.sset(K_OK, this.okKey(u)); return;
        }
        if (SiteStore.sget(K_LATER) === u.id) return;
        this.dialog(!!last);
      } catch (e) {
        if (e && e.message === 'no-session') return;
        if (e && (e.code === 'PGRST205' || e.code === '42P01')) console.warn('[Aetherfall] Tabelle „consents“ fehlt – supabase/consents.sql im Supabase-SQL-Editor ausführen.', e);
        else console.warn('[Aetherfall] Zustimmung konnte nicht geprüft/gespeichert werden:', e);
        if (pend) Toast.show(t('consent.saveFail'), 'warn');
      }
    },
    // Dialog für erneute Zustimmung (geänderte Version oder fehlender Nachweis)
    dialog(updated) {
      if ($('#consentDlg')) return;
      const d = document.createElement('dialog'); d.id = 'consentDlg'; d.className = 'dlg'; d.setAttribute('aria-labelledby', 'cdT'); d.setAttribute('aria-describedby', 'cdD');
      d.innerHTML = `<div class="dlgBox panel"><h2 id="cdT">${esc(t('reconsent.title'))}</h2><p id="cdD">${esc(t(updated ? 'reconsent.textNew' : 'reconsent.textMissing'))}</p>
<p class="small">${esc(t('consent.versions'))}</p>
<div class="check"><input type="checkbox" id="rcTerms"><label for="rcTerms">${I18N.html('consent.terms')}</label></div>
<div class="check"><input type="checkbox" id="rcAge"><label for="rcAge">${esc(t('consent.age'))}</label></div>
<p class="formErr" id="rcErr" role="alert"></p>
<div class="ctaRow"><button type="button" class="btn gold" data-a="accept">${esc(t('reconsent.accept'))}</button><button type="button" class="btn" data-a="later">${esc(t('reconsent.later'))}</button><button type="button" class="btn red" data-a="signout">${esc(t('reconsent.signOut'))}</button></div></div>`;
      document.body.appendChild(d);
      const err = d.querySelector('#rcErr'), u = SiteAuth.user;
      const close = () => { try { d.close(); } catch (e) { /* schon zu */ } d.remove(); };
      const later = () => { if (u) SiteStore.sset(K_LATER, u.id); close(); Toast.show(t('reconsent.laterNote')); };
      d.addEventListener('cancel', e => { e.preventDefault(); later(); });
      d.querySelector('[data-a="later"]').onclick = later;
      d.querySelector('[data-a="signout"]').onclick = () => { close(); SiteAuth.signOut(); };
      d.querySelector('[data-a="accept"]').onclick = async () => {
        const a = d.querySelector('#rcTerms'), b = d.querySelector('#rcAge');
        a.setAttribute('aria-invalid', a.checked ? 'false' : 'true'); b.setAttribute('aria-invalid', b.checked ? 'false' : 'true');
        if (!a.checked) { err.textContent = t('consent.errTerms'); a.focus(); return; }
        if (!b.checked) { err.textContent = t('consent.errAge'); b.focus(); return; }
        err.textContent = ''; const btn = d.querySelector('[data-a="accept"]'); btn.disabled = true;
        try {
          const p = this.create('landing'); await this.insert(p, 'reconsent'); this.clearPending();
          if (u) SiteStore.sset(K_OK, this.okKey(u));
          close(); Toast.show(t('consent.saved'), 'ok');
        } catch (e) { console.warn('[Aetherfall] Zustimmung nicht gespeichert:', e); err.textContent = t('consent.saveFail'); btn.disabled = false; }
      };
      try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
      d.querySelector('#rcTerms').focus();
    },
  };

  /* ---------------- Clerk ---------------- */
  const SiteAuth = {
    state: 'idle', clerk: null, user: null, loadP: null, mounted: {}, ubNode: null,
    key() {
      if (Site.secretWarn) return null;
      const k = String(C.CLERK_PUBLISHABLE_KEY || '').trim();
      return /^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(k) ? k : null;
    },
    fapi() { try { const f = atob(this.key().split('_')[2]).replace(/\$$/, ''); return /^[a-z0-9.-]+$/i.test(f) ? f : null; } catch (e) { return null; } },
    scriptUrl() { const v = String(C.CLERK_JS_VERSION || '5').replace(/[^0-9.]/g, '') || '5'; return `https://${this.fapi()}/npm/@clerk/clerk-js@${v}/dist/clerk.browser.js`; },
    // Hinweis auf eine bestehende Sitzung: Clerk setzt __client_uat (ggf. mit Endung) auf einen Zeitstempel ≠ 0
    hint() { try { return /(?:^|;\s*)__client_uat(?:_[^=;]*)?=(?!0(?:;|$))[^;]+/.test(document.cookie); } catch (e) { return false; } },
    authPage() { return Site.page === 'signin' || Site.page === 'signup'; },
    needed() { return this.authPage() || this.hint() || !!Consent.pendingRaw(); },
    script(src, attrs) {
      return new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = src; s.async = true;
        for (const k in attrs || {}) s.setAttribute(k, attrs[k]);
        s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('load ' + src)); };
        document.head.appendChild(s);
      });
    },
    loadDe() { return window.CLERK_DE_DE ? Promise.resolve() : this.script(root() + 'assets/js/clerk-de.js').catch(e => console.warn('[Aetherfall] Deutsche Clerk-Texte nicht geladen', e)); },
    localization() {
      const L = I18N.lang === 'de' && window.CLERK_DE_DE ? JSON.parse(JSON.stringify(window.CLERK_DE_DE)) : {};
      const o = I18N.lang === 'de'
        ? { signIn: { start: { title: 'Bei Aetherfall anmelden', subtitle: 'Willkommen zurück! Melde dich an, um weiterzuspielen.' } }, signUp: { start: { title: 'Konto erstellen', subtitle: 'Kostenlos – für Cloud-Spielstände und Koop.' } } }
        : { signIn: { start: { title: 'Sign in to Aetherfall', subtitle: 'Welcome back! Sign in to continue playing.' } }, signUp: { start: { title: 'Create your account', subtitle: 'Free – for cloud saves and co-op.' } } };
      const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object') a[k] = merge(a[k] && typeof a[k] === 'object' ? a[k] : {}, b[k]); else a[k] = b[k]; } return a; };
      return merge(L, o);
    },
    appearance() {
      return {
        variables: {
          colorPrimary: '#c98a1e', colorPrimaryForeground: '#140c04', colorBackground: '#22170f', colorForeground: '#f3e4c4', colorMutedForeground: '#d2bc96',
          colorMuted: '#2e2015', colorInput: '#140d08', colorInputForeground: '#f3e4c4', colorBorder: '#6e4c2c', colorRing: '#7cc4ff', colorDanger: '#ff8a7a',
          colorSuccess: '#72d84c', colorWarning: '#ffcf5a', colorNeutral: '#f3e4c4', colorShadow: '#000000', colorModalBackdrop: 'rgba(5,3,2,0.82)',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '1rem', borderRadius: '2px',
        },
        elements: { rootBox: 'afClerkRoot', cardBox: 'afClerkCard', formButtonPrimary: 'afClerkPrimary', footerActionLink: 'afClerkLink', userButtonAvatarBox: 'afClerkAvatar' },
      };
    },
    options() {
      return { appearance: this.appearance(), localization: this.localization(), telemetry: false,
        signInUrl: pageUrl('anmelden.html'), signUpUrl: pageUrl('registrieren.html'),
        signInFallbackRedirectUrl: pageUrl('index.html'), signUpFallbackRedirectUrl: pageUrl('index.html'), afterSignOutUrl: pageUrl('index.html') };
    },
    load() {
      if (this.loadP) return this.loadP;
      this.loadP = (async () => {
        if (I18N.lang === 'de') await this.loadDe();
        if (!window.Clerk) await timeout(this.script(this.scriptUrl(), { 'data-clerk-publishable-key': this.key(), crossorigin: 'anonymous' }), 20000, 'clerk-js');
        let clerk = window.Clerk; if (!clerk) throw new Error('clerk-js fehlt');
        if (typeof clerk === 'function') clerk = new clerk(this.key());
        if (!clerk.loaded) await timeout(clerk.load(this.options()), 20000, 'Clerk.load');
        return clerk;
      })();
      this.loadP.catch(() => { this.loadP = null; });
      return this.loadP;
    },
    start() {
      if (!this.key()) { this.state = 'off'; this.render(); return; }
      if (location.protocol === 'file:') { this.state = 'file'; this.render(); return; }
      if (!this.needed()) { this.state = 'idle'; this.render(); return; }
      this.state = 'loading'; this.render();
      this.load().then(clerk => {
        this.clerk = clerk; this.state = 'ready';
        this.setUser(clerk.user, true);
        clerk.addListener(r => this.setUser(r && r.user)); // meldet sich sofort mit dem aktuellen Stand – gleicher Nutzer → nur neu zeichnen
      }).catch(e => { console.error('[Aetherfall] Anmeldedienst nicht verfügbar:', e); this.state = 'error'; this.render(); });
    },
    // Anmeldestatus übernehmen; bei einem Wechsel Spiel-Links anpassen und die Zustimmung prüfen
    setUser(u, force) {
      const prev = this.user ? this.user.id : null, now = u ? u.id : null;
      this.user = u || null;
      if (!force && prev === now) { this.render(); return; }
      Site.guest = !u; Site.updatePlayLinks();
      this.render();
      if (u) Consent.run(u);
    },
    name(u) {
      if (!u) return '';
      const mail = u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : '';
      return u.username || u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || (mail ? mail.split('@')[0] : '') || t('auth.player');
    },
    avatar(u, cls) {
      const n = this.name(u), wrap = document.createElement('span'); wrap.className = 'avatar ' + (cls || '');
      const ini = document.createElement('span'); ini.className = 'avatarIni'; ini.textContent = (n[0] || '?').toUpperCase(); ini.setAttribute('aria-hidden', 'true');
      if (u && u.imageUrl) {
        const img = document.createElement('img'); img.src = u.imageUrl; img.alt = t('auth.avatarAlt', { name: n }); img.width = 32; img.height = 32; img.referrerPolicy = 'no-referrer'; img.decoding = 'async';
        img.addEventListener('error', () => { img.remove(); wrap.appendChild(ini); });
        wrap.appendChild(img);
      } else wrap.appendChild(ini);
      return wrap;
    },
    async signOut() {
      try { if (this.clerk) await this.clerk.signOut({ redirectUrl: pageUrl('index.html') }); }
      catch (e) { console.error('[Aetherfall] Abmelden fehlgeschlagen', e); Toast.show(t('auth.error'), 'err'); }
    },
    manage() { try { if (this.clerk) this.clerk.openUserProfile(); } catch (e) { console.error(e); } },
    retry() { this.loadP = null; this.state = 'idle'; this.start(); },
    /* ---------- Darstellung ---------- */
    render() { try { this.renderHeader(); this.renderHero(); this.renderSignIn(); this.renderSignUp(); } catch (e) { console.error('[Aetherfall] Anzeige der Anmeldung fehlgeschlagen', e); } },
    renderHeader() {
      const slot = $('#authSlot'); if (!slot) return;
      const u = this.user;
      if (u && this.clerk) {
        if (!slot.querySelector('.userBox')) {
          slot.innerHTML = '';
          const box = document.createElement('div'); box.className = 'userBox';
          if (!this.ubNode) { this.ubNode = document.createElement('div'); this.ubNode.className = 'userBtn'; }
          const nm = document.createElement('span'); nm.className = 'userName'; nm.dataset.userName = '1';
          const go = document.createElement('a'); go.className = 'btn small gold'; go.dataset.play = ''; go.dataset.i18n = 'auth.continue';
          box.append(this.ubNode, nm, go); slot.appendChild(box);
          if (!this.mounted.ub) { try { this.clerk.mountUserButton(this.ubNode, { userProfileMode: 'modal' }); this.mounted.ub = true; } catch (e) { console.error('[Aetherfall] UserButton', e); } }
        }
        slot.querySelector('.userName').textContent = this.name(u);
        slot.querySelector('[data-play]').textContent = t('auth.continue');
        Site.updatePlayLinks();
        return;
      }
      if (this.mounted.ub && this.clerk) { try { this.clerk.unmountUserButton(this.ubNode); } catch (e) { console.warn(e); } this.mounted.ub = false; }
      if (this.state === 'loading' && !this.authPage()) {
        slot.innerHTML = `<span class="authChip" aria-busy="true"><span class="spin" aria-hidden="true"></span><span class="srOnly">${esc(t('auth.checking'))}</span></span>`;
        return;
      }
      slot.innerHTML = `<a class="btn small" href="${esc(root())}anmelden.html">${esc(t('auth.signIn'))}</a>`;
    },
    renderHero() {
      const out = $('#heroOut'), inn = $('#heroIn'); if (!out || !inn) return;
      const u = this.user;
      out.hidden = !!u; inn.hidden = !u;
      if (!u) return;
      const av = inn.querySelector('[data-user-avatar]'); if (av) { av.innerHTML = ''; av.appendChild(this.avatar(u, 'big')); }
      const w = inn.querySelector('[data-user-welcome]'); if (w) w.textContent = t('auth.welcome', { name: this.name(u) });
      inn.querySelectorAll('[data-signout]').forEach(b => { b.onclick = () => this.signOut(); });
      inn.querySelectorAll('[data-manage]').forEach(b => { b.onclick = () => this.manage(); });
    },
    status(el, key, kind, extra) {
      if (!el) return;
      el.className = 'authStatus ' + (kind || '');
      el.setAttribute('aria-busy', kind === 'busy' ? 'true' : 'false');
      el.innerHTML = (kind === 'busy' ? '<span class="spin" aria-hidden="true"></span>' : '') + `<span>${esc(t(key))}</span>`;
      if (extra) el.appendChild(extra);
    },
    // Gemeinsame Zustände der Anmelde- und Registrierseite. Liefert true, wenn Clerk bereit ist.
    pageState(st) {
      if (this.state === 'off') { this.status(st, Site.secretWarn ? 'auth.secretKey' : 'auth.notConfigured', 'warn'); return false; }
      if (this.state === 'file') { this.status(st, 'auth.fileProtocol', 'warn'); return false; }
      if (this.state === 'error') { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = t('auth.retry'); b.onclick = () => this.retry(); this.status(st, 'auth.error', 'err', b); return false; }
      if (this.state !== 'ready') { this.status(st, 'auth.loading', 'busy'); return false; }
      st.className = 'authStatus'; st.innerHTML = ''; st.setAttribute('aria-busy', 'false');
      return true;
    },
    signedInBox(box) {
      if (!box) return; const u = this.user;
      box.hidden = !u; if (!u) return;
      const a = box.querySelector('[data-user-avatar]'); if (a) { a.innerHTML = ''; a.appendChild(this.avatar(u)); }
      const n = box.querySelector('[data-user-text]'); if (n) n.textContent = t('signin.already', { name: this.name(u) });
      box.querySelectorAll('[data-signout]').forEach(b => { b.onclick = () => this.signOut(); });
      box.querySelectorAll('[data-manage]').forEach(b => { b.onclick = () => this.manage(); });
    },
    renderSignIn() {
      if (Site.page !== 'signin') return;
      const st = $('#authStatus'), mount = $('#clerkMount'), box = $('#authSignedIn');
      if (!this.pageState(st)) { if (box) box.hidden = true; return; }
      this.signedInBox(box);
      if (this.user) { this.unmount('signIn', mount); return; }
      if (!this.mounted.signIn) {
        try {
          this.clerk.mountSignIn(mount, { routing: 'hash', signUpUrl: pageUrl('registrieren.html'), fallbackRedirectUrl: pageUrl('index.html'), transferable: false });
          this.mounted.signIn = true;
        } catch (e) { console.error('[Aetherfall] SignIn', e); this.state = 'error'; this.renderSignIn(); }
      }
    },
    renderSignUp() {
      if (Site.page !== 'signup') return;
      const st = $('#authStatus'), mount = $('#clerkMount'), box = $('#authSignedIn'), form = $('#consentForm'), done = $('#consentDone');
      const given = !!Consent.pending(), abox = $('#authBox');
      if (abox) abox.hidden = !given && !this.user && this.state !== 'error' && this.state !== 'off' && this.state !== 'file';
      if (this.user) { if (form) form.hidden = true; if (done) done.hidden = true; }
      else { if (form) form.hidden = given; if (done) { done.hidden = !given; const p = done.querySelector('[data-consent-text]'); if (p) p.textContent = t('consent.given'); } }
      if (!given && !this.user && this.state !== 'error' && this.state !== 'off' && this.state !== 'file') { this.unmount('signUp', mount); st.className = 'authStatus'; st.innerHTML = ''; if (box) box.hidden = true; return; }
      if (!this.pageState(st)) { if (box) box.hidden = true; return; }
      this.signedInBox(box);
      if (this.user) { this.unmount('signUp', mount); return; }
      if (!this.mounted.signUp) {
        const p = Consent.pending();
        try {
          this.clerk.mountSignUp(mount, { routing: 'hash', signInUrl: pageUrl('anmelden.html'), fallbackRedirectUrl: pageUrl('index.html'),
            unsafeMetadata: { consent: { terms: p.terms_version, privacy: p.privacy_version, text: p.text_version, consentText: p.consent_text, age: true, minAge: p.min_age, lang: p.lang, at: p.client_at } } });
          this.mounted.signUp = true;
        } catch (e) { console.error('[Aetherfall] SignUp', e); this.state = 'error'; this.renderSignUp(); }
      }
    },
    unmount(which, node) {
      if (!this.mounted[which] || !this.clerk || !node) return;
      try { this.clerk[which === 'signIn' ? 'unmountSignIn' : 'unmountSignUp'](node); } catch (e) { console.warn(e); }
      this.mounted[which] = false; node.innerHTML = '';
    },
    // Pflicht-Zustimmung vor der Registrierung
    bindConsent() {
      const form = $('#consentForm'); if (!form) return;
      const a = $('#cTerms'), b = $('#cAge'), err = $('#consentErr');
      form.addEventListener('submit', e => {
        e.preventDefault();
        a.setAttribute('aria-invalid', a.checked ? 'false' : 'true'); b.setAttribute('aria-invalid', b.checked ? 'false' : 'true');
        if (!a.checked) { err.textContent = t('consent.errTerms'); a.focus(); return; }
        if (!b.checked) { err.textContent = t('consent.errAge'); b.focus(); return; }
        err.textContent = '';
        Consent.create('landing');
        this.render();
        const m = $('#clerkMount'); if (m) { m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: true }); }
        if (this.state === 'idle') this.start();
      });
      [a, b].forEach(x => x.addEventListener('change', () => { if (x.checked) { x.setAttribute('aria-invalid', 'false'); if (a.checked && b.checked) err.textContent = ''; } }));
      const ch = document.querySelector('[data-consent-change]');
      if (ch) ch.addEventListener('click', () => { Consent.clearPending(); a.checked = false; b.checked = false; this.render(); a.focus(); });
    },
    relocalize() {
      if (!this.clerk || !this.clerk.__unstable__updateProps) return;
      const go = () => { try { this.clerk.__unstable__updateProps({ options: { localization: this.localization() } }); } catch (e) { console.warn('[Aetherfall] Clerk-Sprache nicht umgestellt', e); } };
      if (I18N.lang === 'de' && !window.CLERK_DE_DE) this.loadDe().then(go); else go();
    },
    init() {
      this.bindConsent();
      I18N.onChange(() => { this.render(); this.relocalize(); });
      this.start();
    },
  };
  window.SiteAuth = SiteAuth;
  window.SiteConsent = Consent;
  const go = () => { try { SiteAuth.init(); } catch (e) { console.error('[Aetherfall] Anmeldung nicht gestartet', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
