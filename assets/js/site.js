/* ============================== WEBSITE ====================================
   Seitenaufbau ohne Framework: Sprache, Navigation, Platzhalter aus SITE_CONFIG, Rechtsseiten (aus lang-legal.js),
   FAQ, Neuigkeiten, gezeichnete Platzhalter-Grafiken (SVG), Trailer, strukturierte Daten, Hinweise.
   Anmeldung (Clerk) und Zustimmungen: assets/js/auth.js.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.SITE_CONFIG || {}, esc = window.siteEsc, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));

  /* ---------- Pixel-Grafik: Emblem, Symbole, Szenen (alles prozedural, keine Bilddateien) ---------- */
  const Px = {
    // Ätherkristall über schwebender Insel – dasselbe Emblem wie im Spiel (BOOT.drawMark), Raster 32 × 32
    mark() {
      const r = [];
      const px = (x, y, w, h, c) => r.push(`<rect x="${+x.toFixed(2)}" y="${+y.toFixed(2)}" width="${w}" height="${h}" fill="${c}"/>`);
      for (let i = 0; i < 9; i++) px(6 + i * 1.2, 3 + i * 1.1, 2, 2, `rgba(150,215,255,${(0.08 + i * 0.07).toFixed(2)})`);
      const K = [[15, 9, '#ffffff'], [14, 10, '#d8f2ff'], [16, 10, '#9ad4ff'], [13, 11, '#bfe6ff'], [14, 11, '#ffffff'], [15, 11, '#9ad4ff'], [16, 11, '#5fa8ff'], [17, 11, '#3a78e0'],
        [13, 12, '#9ad4ff'], [14, 12, '#d8f2ff'], [15, 12, '#7cc4ff'], [16, 12, '#4a8cf0'], [17, 12, '#2a5fd0'], [14, 13, '#7cc4ff'], [15, 13, '#5fa8ff'], [16, 13, '#3a6fe0'],
        [14, 14, '#5fa8ff'], [15, 14, '#3a78e0'], [16, 14, '#2a4fb8'], [15, 15, '#2a5fd0'], [15, 16, '#1a3a90']];
      for (const [x, y, c] of K) px(x, y, 1, 1, c);
      for (let x = 8; x < 24; x++) px(x, 21, 1, 1, x % 3 ? '#6fbf3a' : '#8fd84c');
      for (let x = 9; x < 23; x++) px(x, 22, 1, 1, '#7a5230');
      for (let x = 10; x < 22; x++) px(x, 23, 1, 1, '#5e3b20');
      for (let x = 12; x < 20; x++) px(x, 24, 1, 1, '#4a2e18');
      for (let x = 14; x < 18; x++) px(x, 25, 1, 1, '#3a2412');
      px(15, 26, 2, 1, '#ff9a30'); px(15, 27, 1, 1, '#ffcf5a');
      for (const [x, y] of [[9, 7], [22, 6], [24, 14], [6, 16], [20, 18]]) px(x, y, 1, 1, 'rgba(255,230,160,.9)');
      return `<svg viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r.join('')}</svg>`;
    },
    PAL: { k: '#120c08', g: '#ffcf5a', o: '#ff9a30', b: '#7cc4ff', B: '#3a6fe0', w: '#f3e4c4', r: '#e0463a', n: '#6fbf3a', s: '#b59c78', d: '#7a5230', p: '#c062ff' },
    ICONS: {
      coop: ['..ww....bb..', '.wwww..bbbb.', '.wkwk..bkbk.', '.wwww..bbbb.', '..gg....rr..', '.gggg..rrrr.', 'gggggg.rrrrr', '.gggg..rrrr.', '.g..g..r..r.', '.g..g..r..r.'],
      story: ['............', 'g....g....g.', 'gg..ggg..gg.', 'ggggggggggg.', 'gggrgggbggg.', 'ggggggggggg.', '.ooooooooo..'],
      creator: ['...oooooo...', '..oooooooo..', '.oowwwwwwoo.', '.owkwwwwkwo.', '.owwwwwwwwo.', '.owwwrrwwwo.', '..wwwwwwww..', '...gggggg...', '..gggggggg..', '.gggggggggg.'],
      map: ['.....b......', '....bbb.....', '....bwb.....', '.....b......', '............', '..nnnnnnn...', '.nnnnnnnnn..', '..ddddddd...', '...ddddd....', '....ddd.....', '.....d......'],
      puzzle: ['.....gg.....', '..g..gg..g..', '..gggggggg..', '...gg..gg...', 'gggg....gggg', 'gggg....gggg', '...gg..gg...', '..gggggggg..', '..g..gg..g..', '.....gg.....'],
      lang: ['wwwwwww.....', 'wkkwkkw.....', 'wwwwwww.....', '.w..........', '....bbbbbbbb', '....bkkbkkbb', '....bbbbbbbb', '..........b.'],
      cloud: ['....wwww....', '..wwwwwwwww.', '.wwwwwbwwwww', 'wwwwwbbbwwww', 'wwwwbbbbbwww', 'wwwwwwbwwwww', 'wwwwwwbwwwww', '.wwwwwwwwww.'],
    },
    icon(name) {
      const rows = this.ICONS[name] || [], H = 12, top = Math.floor((H - rows.length) / 2), r = [];
      rows.forEach((row, y) => { for (let x = 0; x < 12; x++) { const c = this.PAL[row[x]]; if (c) r.push(`<rect x="${x}" y="${y + top}" width="1" height="1" fill="${c}"/>`); } });
      return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r.join('')}</svg>`;
    },
    // kleiner Zufallsgenerator mit festem Startwert (gleiche Bilder bei jedem Aufruf)
    rng(seed) { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; },
    stars(R, n, w, h, col) { let o = ''; for (let i = 0; i < n; i++) { const x = Math.floor(R() * w), y = Math.floor(R() * h), s = R() < 0.15 ? 2 : 1; o += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${col || '#fff'}" opacity="${(0.35 + R() * 0.6).toFixed(2)}"/>`; } return o; },
    // schwebende Voxel-Insel: Gras, Erdstufen nach unten schmaler
    island(x, y, w, opt) {
      const o = opt || {}, step = o.step || 4; let s = `<rect x="${x}" y="${y}" width="${w}" height="${step}" fill="${o.grass || '#6fbf3a'}"/><rect x="${x}" y="${y}" width="${w}" height="1" fill="#8fd84c"/>`;
      const cols = ['#7a5230', '#5e3b20', '#4a2e18', '#3a2412', '#2a190c'];
      let xx = x, ww = w;
      for (let i = 0; i < 5 && ww > step * 2; i++) { s += `<rect x="${xx}" y="${y + step * (i + 1)}" width="${ww}" height="${step}" fill="${cols[i]}"/>`; xx += step; ww -= step * 2; }
      return s;
    },
    tower(x, y, h, c) { return `<rect x="${x}" y="${y - h}" width="8" height="${h}" fill="${c || '#c9b28c'}"/><rect x="${x - 2}" y="${y - h - 4}" width="12" height="4" fill="#8a3d2a"/><rect x="${x + 2}" y="${y - h + 6}" width="3" height="4" fill="#ffcf5a"/>`; },
    hero(x, y, body, s) { const k = s || 2; return `<rect x="${x + k}" y="${y}" width="${k * 3}" height="${k * 3}" fill="#f0c8a0"/><rect x="${x + k}" y="${y}" width="${k * 3}" height="${k}" fill="#4a2e18"/><rect x="${x}" y="${y + k * 3}" width="${k * 5}" height="${k * 4}" fill="${body}"/><rect x="${x + k}" y="${y + k * 7}" width="${k}" height="${k * 3}" fill="#2e2015"/><rect x="${x + k * 3}" y="${y + k * 7}" width="${k}" height="${k * 3}" fill="#2e2015"/><rect x="${x + k * 5}" y="${y + k * 2}" width="${k}" height="${k * 6}" fill="#d8d8d8"/>`; },
    wrap(inner, bg) { return `<svg viewBox="0 0 320 180" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${bg || ''}${inner}</svg>`; },
    sky(id, a, b) { return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#${id})"/>`; },
    SCENES: {
      islands(P) {
        const R = P.rng('islands');
        return P.wrap(P.stars(R, 50, 320, 90) + '<rect x="236" y="34" width="22" height="22" fill="#ffb648" opacity=".9"/><rect x="232" y="38" width="30" height="14" fill="#ffb648" opacity=".35"/>' +
          P.island(20, 120, 70) + P.island(120, 96, 120, { step: 5 }) + P.tower(150, 96, 30) + P.tower(178, 96, 44, '#d8c39a') + P.tower(206, 96, 24) + P.island(258, 132, 48) +
          '<rect x="0" y="160" width="320" height="20" fill="#f3e4c4" opacity=".08"/><rect x="40" y="150" width="90" height="6" fill="#fff" opacity=".07"/>', P.sky('gIs', '#1b1030', '#c0603a'));
      },
      boss(P) {
        let s = '<rect x="0" y="120" width="320" height="60" fill="#1a1420"/>';
        for (let i = 0; i < 8; i++) s += `<rect x="${i * 40}" y="120" width="1" height="60" fill="#2e2440"/>`;
        s += '<rect x="80" y="128" width="150" height="34" fill="#e0463a" opacity=".28"/><rect x="80" y="128" width="150" height="2" fill="#ff5a46"/><rect x="80" y="160" width="150" height="2" fill="#ff5a46"/>';
        s += '<polygon points="160,18 196,60 186,124 134,124 124,60" fill="#3a6fe0"/><polygon points="160,18 176,60 160,124 134,124 124,60" fill="#7cc4ff"/><polygon points="160,18 168,52 152,52" fill="#ffffff"/>';
        s += '<rect x="98" y="60" width="28" height="12" fill="#5fa8ff"/><rect x="194" y="60" width="28" height="12" fill="#2a4fb8"/><rect x="152" y="70" width="16" height="8" fill="#ffcf5a"/>';
        s += P.hero(60, 140, '#8a5d12') + '<rect x="40" y="20" width="240" height="6" fill="#120c08"/><rect x="40" y="20" width="170" height="6" fill="#c062ff"/>';
        return P.wrap(s, P.sky('gBo', '#0b0a1a', '#2a1a40'));
      },
      map(P) {
        let s = '<rect x="8" y="8" width="304" height="164" fill="#2e2015"/><rect x="12" y="12" width="296" height="156" fill="#3d2a19"/>';
        const isl = [[40, 40, 60, 34, '#5a8f3a'], [130, 30, 70, 40, '#7a6a3a'], [230, 50, 56, 38, '#4a6a8a'], [70, 110, 64, 40, '#6a3a5a'], [180, 112, 80, 36, '#8a4a2a']];
        for (const [x, y, w, h, c] of isl) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="${c}" opacity=".6" stroke="#120c08" stroke-width="1"/>`;
        for (const [x1, y1, x2, y2] of [[100, 56, 130, 50], [200, 50, 230, 64], [100, 70, 100, 110], [134, 128, 180, 130]]) { const n = 6; for (let i = 0; i <= n; i++) s += `<rect x="${Math.round(x1 + (x2 - x1) * i / n)}" y="${Math.round(y1 + (y2 - y1) * i / n)}" width="3" height="3" fill="#ffcf5a" opacity=".7"/>`; }
        for (const [x, y] of [[66, 54], [160, 46], [254, 66], [100, 128], [216, 128]]) s += `<polygon points="${x},${y - 6} ${x + 5},${y} ${x},${y + 6} ${x - 5},${y}" fill="#7cc4ff"/><rect x="${x - 1}" y="${y - 1}" width="2" height="2" fill="#fff"/>`;
        s += '<rect x="226" y="104" width="86" height="64" fill="#0d0907" opacity=".72"/><rect x="214" y="116" width="20" height="40" fill="#0d0907" opacity=".5"/><polygon points="160,86 166,96 154,96" fill="#ffcf5a"/>';
        return P.wrap(s, '<rect width="320" height="180" fill="#1a110a"/>');
      },
      creator(P) {
        let s = '<rect x="80" y="140" width="100" height="10" fill="#4a3220"/><rect x="70" y="150" width="120" height="10" fill="#2e2015"/>' + P.hero(108, 58, '#3a6fe0', 8);
        const sw = ['#ffcf5a', '#e0463a', '#72d84c', '#4fa8ff', '#c062ff', '#f3e4c4'];
        sw.forEach((c, i) => { s += `<rect x="${222 + (i % 2) * 34}" y="${36 + Math.floor(i / 2) * 34}" width="26" height="26" fill="${c}"/><rect x="${222 + (i % 2) * 34}" y="${36 + Math.floor(i / 2) * 34}" width="26" height="26" fill="none" stroke="#120c08" stroke-width="2"/>`; });
        s += '<rect x="218" y="32" width="34" height="34" fill="none" stroke="#fff" stroke-width="2"/><rect x="214" y="146" width="80" height="12" fill="#8a5d12"/>';
        return P.wrap(s, P.sky('gCr', '#22170f', '#0d0907'));
      },
      coop(P) {
        let s = '<rect x="0" y="130" width="320" height="50" fill="#2a3a1a"/>';
        for (let i = 0; i < 3; i++) s += `<rect x="${130 + i * 26}" y="${96 + (i % 2) * 8}" width="18" height="16" fill="#5a2a6a"/><rect x="${133 + i * 26}" y="${100 + (i % 2) * 8}" width="3" height="3" fill="#ff5a46"/><rect x="${142 + i * 26}" y="${100 + (i % 2) * 8}" width="3" height="3" fill="#ff5a46"/>`;
        s += P.hero(70, 100, '#8a5d12', 3) + P.hero(240, 96, '#3a6fe0', 3) + P.hero(110, 140, '#72d84c', 3) + P.hero(200, 140, '#c062ff', 3);
        s += '<polygon points="160,60 166,72 154,72" fill="#ffcf5a"/><rect x="159" y="72" width="2" height="12" fill="#ffcf5a"/>';
        return P.wrap(s, P.sky('gCo', '#0d1a2a', '#3a5a3a'));
      },
      dungeon(P) {
        let s = '<polygon points="0,0 120,60 200,60 320,0 320,180 200,120 120,120 0,180" fill="#2e2a2a"/><rect x="120" y="60" width="80" height="60" fill="#0b0808"/>';
        for (let i = 0; i < 6; i++) s += `<rect x="${i * 20}" y="${10 + i * 10}" width="14" height="6" fill="#3d3636"/><rect x="${306 - i * 20}" y="${10 + i * 10}" width="14" height="6" fill="#3d3636"/>`;
        for (const x of [60, 254]) s += `<rect x="${x}" y="70" width="6" height="20" fill="#5e3b20"/><rect x="${x - 2}" y="60" width="10" height="10" fill="#ff9a30"/><rect x="${x}" y="56" width="6" height="6" fill="#ffcf5a"/><circle cx="${x + 3}" cy="66" r="26" fill="#ff9a30" opacity=".12"/>`;
        s += '<rect x="140" y="132" width="40" height="22" fill="#7a5230"/><rect x="140" y="132" width="40" height="6" fill="#a06c16"/><rect x="157" y="140" width="6" height="6" fill="#ffcf5a"/>';
        s += '<rect x="214" y="146" width="20" height="6" fill="#d8d8d8"/><rect x="230" y="138" width="8" height="8" fill="#e8e8e8"/><rect x="232" y="140" width="2" height="2" fill="#120c08"/>';
        return P.wrap(s, '<rect width="320" height="180" fill="#141010"/>');
      },
      trailer(P) {
        const R = P.rng('trailer'); let s = P.stars(R, 70, 320, 180, '#d8f2ff');
        s += '<circle cx="160" cy="80" r="56" fill="#c062ff" opacity=".18"/><circle cx="160" cy="80" r="36" fill="#7cc4ff" opacity=".22"/><polygon points="160,30 184,80 160,130 136,80" fill="#3a6fe0"/><polygon points="160,30 172,80 160,130 136,80" fill="#7cc4ff"/><polygon points="160,30 166,64 154,64" fill="#fff"/>';
        s += P.island(100, 140, 120, { step: 5 }) + P.hero(150, 112, '#8a5d12', 3);
        return P.wrap(s, P.sky('gTr', '#05030c', '#2a1440'));
      },
      hero(P) {
        const R = P.rng('hero'); let s = P.stars(R, 90, 320, 120, '#fff');
        s += '<g class="floatA">' + P.island(14, 118, 64) + '</g><g class="floatB">' + P.island(236, 96, 74, { step: 5 }) + P.tower(262, 96, 24) + '</g><g class="floatC">' + P.island(110, 150, 100, { step: 5 }) + '</g>';
        return P.wrap(s, P.sky('gHe', '#070512', '#3a1f2a'));
      },
    },
    scene(name) { const f = this.SCENES[name]; return f ? f(this) : ''; },
  };

  /* ---------- Hinweise (Toasts) ---------- */
  const Toast = {
    box: null,
    show(msg, kind, ms) {
      if (!this.box) { this.box = document.createElement('div'); this.box.className = 'toasts'; this.box.setAttribute('role', 'status'); this.box.setAttribute('aria-live', 'polite'); document.body.appendChild(this.box); }
      const el = document.createElement('div'); el.className = 'toast ' + (kind || 'info');
      const p = document.createElement('p'); p.textContent = msg;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toastX'; b.setAttribute('aria-label', t('toast.close')); b.textContent = '×'; b.onclick = () => el.remove();
      el.append(p, b); this.box.appendChild(el);
      setTimeout(() => el.remove(), ms || 7000);
    },
  };

  /* ---------- Seite ---------- */
  const Site = {
    Px, Toast,
    page: document.body ? document.body.dataset.page || '' : '',
    root() { return (document.body && document.body.dataset.root) || ''; },
    // Link ins Spiel: Sprache immer mitgeben; abgemeldet → Gastmodus (das Spiel überspringt dann seinen Login-Bildschirm)
    playUrl(guest) {
      const base = this.root() + String(C.GAME_PATH || 'play/').replace(/^\/+/, '');
      const q = new URLSearchParams({ lang: I18N.lang }); if (guest) q.set('start', 'guest');
      return base + '?' + q.toString();
    },
    guest: true,
    updatePlayLinks() { $$('[data-play]').forEach(a => { a.href = this.playUrl(a.dataset.play === 'guest' ? true : this.guest); }); },
    init() {
      I18N.init();
      this.checkKeys();
      $$('.logoMark').forEach(el => { el.innerHTML = Px.mark(); });
      $$('[data-icon]').forEach(el => { el.innerHTML = Px.icon(el.dataset.icon); });
      // Szenen (SVG) erst kurz vor dem Hereinscrollen zeichnen – spart Arbeit beim Laden; die Hero-Szene sofort
      const draw = el => { if (!el.dataset.drawn) { el.dataset.drawn = '1'; el.innerHTML = Px.scene(el.dataset.scene); } };
      const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { draw(e.target); io.unobserve(e.target); } }), { rootMargin: '600px 0px' }) : null;
      $$('[data-scene]').forEach(el => { if (!io || el.dataset.scene === 'hero') draw(el); else io.observe(el); });
      this.renderAll();
      this.bindLang(); this.bindNav();
      this.trailer(); this.gallery();
      this.updatePlayLinks();
      I18N.onChange(() => { this.renderAll(); this.updatePlayLinks(); });
      // Inhalte entstehen erst per JavaScript: Sprungziel (#abschnitt) danach ansteuern
      if (location.hash.length > 1) { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(() => el.scrollIntoView(), 0); }
      if (I18N.placeholders.size) console.warn('[Aetherfall] Platzhalter noch nicht ausgefüllt (assets/js/config.js):', Array.from(I18N.placeholders).join(', '));
      document.documentElement.classList.add('js');
    },
    renderAll() {
      I18N.apply(document);
      this.meta(); this.cfgFields(); this.legal(); this.faq(); this.news(); this.jsonLd(); this.langButtons(); this.mediaFooter(); this.mailLinks();
    },
    checkKeys() {
      const jwtRole = k => { const p = String(k).split('.'); if (p.length !== 3) return null; try { return JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))).role || null; } catch (e) { return null; } };
      if (/^sk_/.test(String(C.CLERK_PUBLISHABLE_KEY || '').trim())) { console.error('[Aetherfall] SITE_CONFIG enthält einen Clerk SECRET Key. Er wird ignoriert – sofort im Clerk-Dashboard austauschen!'); this.secretWarn = true; }
      const sk = String(C.SUPABASE_KEY || '').trim();
      if (/^sb_secret_/.test(sk) || jwtRole(sk) === 'service_role') { console.error('[Aetherfall] SITE_CONFIG enthält einen Supabase Secret-/Service-Role-Key. Er wird ignoriert – sofort im Supabase-Dashboard austauschen!'); this.secretWarn = true; }
    },
    meta() {
      const p = this.page; if (!p || !I18N.has('meta.' + p + '.title')) return;
      document.title = t('meta.' + p + '.title');
      const d = document.querySelector('meta[name="description"]'); if (d) d.setAttribute('content', t('meta.' + p + '.desc'));
      const ogl = document.querySelector('meta[property="og:locale"]'); if (ogl) ogl.setAttribute('content', I18N.LANGS[I18N.lang].og);
      // canonical und og:url zeigen auf die Adresse der angezeigten Sprache (Deutsch ohne Parameter, Englisch mit ?lang=en)
      for (const el of [document.querySelector('link[rel="canonical"]'), document.querySelector('meta[property="og:url"]')]) {
        if (!el) continue; const attr = el.tagName === 'LINK' ? 'href' : 'content';
        try { const u = new URL(el.getAttribute(attr)); u.search = I18N.lang === 'de' ? '' : '?lang=' + I18N.lang; el.setAttribute(attr, u.toString()); } catch (e) { /* ungültige Adresse im HTML */ }
      }
    },
    // mailto-Links der Kontaktseite (Betreff je Thema); ohne ausgefüllte Adresse deaktiviert
    mailLinks() {
      const mail = String(C.CONTACT_EMAIL || ''), ok = /^[^\s@\[\]]+@[^\s@\[\]]+$/.test(mail);
      $$('[data-mail]').forEach(a => {
        if (ok) { a.href = 'mailto:' + mail + '?subject=' + encodeURIComponent(t(a.dataset.mail)); a.removeAttribute('aria-disabled'); a.removeAttribute('tabindex'); }
        else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.title = t('ph.hint'); }
      });
    },
    cfgFields() {
      const V = I18N.cfg();
      $$('[data-cfg]').forEach(el => { el.innerHTML = I18N.val(V[el.dataset.cfg] || ''); });
      $$('[data-year]').forEach(el => { el.textContent = V.YEAR; });
    },
    bindLang() {
      $$('[data-setlang]').forEach(b => b.addEventListener('click', () => { I18N.set(b.dataset.setlang); }));
    },
    langButtons() {
      $$('[data-setlang]').forEach(b => { const on = b.dataset.setlang === I18N.lang; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', b.dataset.setlang.toUpperCase() + ' – ' + t('lang.' + b.dataset.setlang)); });
    },
    bindNav() {
      // „Zum Inhalt springen“ ohne Änderung der Adresse (#…), damit die Clerk-Formulare (Hash-Routing) nicht gestört werden
      $$('a.skip').forEach(a => a.addEventListener('click', e => { const m = $('#main'); if (!m) return; e.preventDefault(); m.setAttribute('tabindex', '-1'); m.focus(); m.scrollIntoView(); }));
      const btn = $('.navToggle'), nav = $('#siteNav'); if (!btn || !nav) return;
      const set = open => { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); nav.classList.toggle('open', open); btn.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menu')); };
      btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
      nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
    },
    // ---- Rechtsseiten: Abschnitte <präfix>.s<n>.h/.b aus lang-legal.js ----
    has(k) { return k in (I18N.dict[I18N.lang] || {}) || k in I18N.dict.de; },
    legal() {
      const host = $('[data-legal]'); if (!host) return;
      const P = host.dataset.legal, V = I18N.cfg(), parts = [], toc = [];
      if (this.has(P + '.intro') && I18N.raw(P + '.intro')) parts.push(`<div class="legalIntro">${I18N.html(P + '.intro')}</div>`);
      for (let n = 1; n < 80 && this.has(`${P}.s${n}.h`); n++) {
        const cond = this.has(`${P}.s${n}.if`) ? I18N.raw(`${P}.s${n}.if`) : null;
        if (cond && !String(V[cond] || '').trim()) continue;
        const h = t(`${P}.s${n}.h`);
        toc.push(`<li><a href="#s${n}">${esc(h)}</a></li>`);
        parts.push(`<section id="s${n}" class="legalSec" aria-labelledby="s${n}h"><h2 id="s${n}h">${esc(h)}</h2>${I18N.html(`${P}.s${n}.b`)}</section>`);
      }
      const tr = t('legal.translation');
      host.innerHTML = (tr ? `<p class="notice small" lang="en">${esc(tr)}</p>` : '') + parts.join('');
      I18N.conditions(host);
      const tocEl = $('[data-toc]');
      if (tocEl) { tocEl.hidden = toc.length < 4; tocEl.innerHTML = `<h2 class="tocTitle">${esc(t('legal.toc'))}</h2><ol>${toc.join('')}</ol>`; }
      const m = $('[data-legal-meta]');
      if (m) { const D = (C.LEGAL_DOCS || {})[m.dataset.legalMeta] || {}; m.textContent = t('legal.stand', { date: I18N.date(D.date), version: D.version || '' }); }
    },
    // ---- FAQ: faq.<n>.q / faq.<n>.a ----
    faq() {
      const host = $('[data-faq]'); if (!host) return;
      const open = new Set($$('[data-faq] details[open]').map(d => d.dataset.n));
      let h = '';
      for (let n = 1; n < 50 && this.has(`faq.${n}.q`); n++) h += `<details class="faqItem" data-n="${n}"${open.has(String(n)) ? ' open' : ''}><summary><span>${esc(t(`faq.${n}.q`))}</span></summary><div class="faqA">${I18N.html(`faq.${n}.a`)}</div></details>`;
      host.innerHTML = h;
    },
    // ---- Neuigkeiten aus assets/js/news.js ----
    newsAll: false,
    news() {
      const host = $('[data-news]'); if (!host) return;
      const list = (window.SITE_NEWS || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))), L = I18N.lang, show = this.newsAll ? list : list.slice(0, 5);
      host.innerHTML = '<ol class="newsList" id="newsList">' + show.map(n => { const x = n[L] || n.de || {}; return `<li><article class="newsItem"><time datetime="${esc(n.date)}">${esc(I18N.date(n.date))}</time>${n.tag ? `<span class="tag">${esc(n.tag)}</span>` : ''}<h3>${esc(x.title || '')}</h3><p>${esc(x.text || '')}</p></article></li>`; }).join('') + '</ol>';
      if (list.length > 5) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = t(this.newsAll ? 'news.less' : 'news.more');
        b.setAttribute('aria-expanded', this.newsAll ? 'true' : 'false'); b.setAttribute('aria-controls', 'newsList');
        b.onclick = () => { this.newsAll = !this.newsAll; this.news(); const nb = host.querySelector('button'); if (nb) nb.focus(); };
        host.appendChild(b);
      }
    },
    // ---- Galerie: eigene Screenshots (SITE_CONFIG.SCREENSHOTS) statt gezeichneter Platzhalter ----
    gallery() {
      const host = $('[data-gallery]'), shots = Array.isArray(C.SCREENSHOTS) ? C.SCREENSHOTS.filter(s => s && s.src) : [];
      if (!host || !shots.length) return;
      const render = () => {
        host.innerHTML = shots.map(s => { const alt = (s.alt && (s.alt[I18N.lang] || s.alt.de)) || ''; const cap = (s.caption && (s.caption[I18N.lang] || s.caption.de)) || alt; return `<figure class="shot"><img src="${esc(s.src)}" alt="${esc(alt)}" loading="lazy" decoding="async" width="${+s.width || 1280}" height="${+s.height || 720}"><figcaption>${esc(cap)}</figcaption></figure>`; }).join('');
      };
      render(); I18N.onChange(render);
    },
    // ---- Trailer: eigene Datei, externe Einbettung (erst nach Zustimmung) oder Platzhalter ----
    MEDIA_KEY: 'aetherfall_media_consent',
    trailer() {
      const host = $('[data-trailer]'); if (!host) return;
      if (C.TRAILER_URL) {
        const v = document.createElement('video'); v.controls = true; v.preload = 'none'; v.playsInline = true; v.className = 'trailerVideo';
        if (C.TRAILER_POSTER) v.poster = C.TRAILER_POSTER;
        v.setAttribute('data-i18n-attr', 'aria-label:trailer.videoLabel'); v.setAttribute('aria-label', t('trailer.videoLabel'));
        const s = document.createElement('source'); s.src = C.TRAILER_URL; s.type = /\.webm(\?|$)/i.test(C.TRAILER_URL) ? 'video/webm' : 'video/mp4'; v.appendChild(s);
        const p = document.createElement('p'); p.setAttribute('data-i18n', 'trailer.noVideo'); p.textContent = t('trailer.noVideo'); v.appendChild(p);
        host.innerHTML = ''; host.appendChild(v); return;
      }
      if (C.TRAILER_EMBED) { this.embedGate(host); return; }
    },
    mediaChoice() { const v = SiteStore.get(this.MEDIA_KEY); return v === 'granted' || v === 'denied' ? v : null; },
    embedGate(host) {
      let url; try { url = new URL(C.TRAILER_EMBED); if (url.protocol !== 'https:') throw new Error('https'); } catch (e) { console.error('[Aetherfall] TRAILER_EMBED ist keine gültige https-Adresse:', C.TRAILER_EMBED); return; }
      const load = () => {
        host.innerHTML = '';
        const f = document.createElement('iframe'); f.src = url.toString(); f.loading = 'lazy'; f.allow = 'fullscreen; picture-in-picture'; f.referrerPolicy = 'strict-origin-when-cross-origin';
        f.title = t('trailer.videoLabel'); f.className = 'trailerVideo'; host.appendChild(f);
      };
      if (this.mediaChoice() === 'granted') { load(); return; }
      const box = document.createElement('div'); box.className = 'mediaGate';
      box.innerHTML = `<h3>${esc(t('media.title'))}</h3><p>${I18N.html('media.text', { host: url.hostname })}</p><div class="ctaRow"><button type="button" class="btn gold" data-m="yes">${esc(t('media.accept'))}</button><button type="button" class="btn" data-m="no">${esc(t('media.decline'))}</button></div><p class="small" data-m-msg aria-live="polite"></p>`;
      const ov = host.querySelector('.trailerOverlay'); (ov || host).appendChild(box);
      if (this.mediaChoice() === 'denied') box.querySelector('[data-m-msg]').textContent = t('media.declined');
      box.querySelector('[data-m="yes"]').onclick = () => { SiteStore.set(this.MEDIA_KEY, 'granted'); load(); this.mediaFooter(); };
      box.querySelector('[data-m="no"]').onclick = () => { SiteStore.set(this.MEDIA_KEY, 'denied'); box.querySelector('[data-m-msg]').textContent = t('media.declined'); this.mediaFooter(); };
    },
    // Fußzeile: Auswahl für externe Medien zurücksetzen (nur sichtbar, wenn eine externe Einbettung konfiguriert ist)
    mediaFooter() {
      const el = $('[data-media-settings]'); if (!el) return;
      el.hidden = !C.TRAILER_EMBED;
      const b = el.querySelector('button'); if (!b || b.dataset.bound) return; b.dataset.bound = '1';
      b.onclick = () => { SiteStore.del(this.MEDIA_KEY); Toast.show(t('media.reset')); if ($('[data-trailer]')) location.reload(); };
    },
    // ---- Strukturierte Daten (schema.org) aus der Konfiguration ----
    jsonLd() {
      const el = document.getElementById('ld'); if (!el) return;
      const V = I18N.cfg(), base = String(C.SITE_URL || '').replace(/\/+$/, ''), isPh = s => /^\[.*\]$/.test(String(s).trim());
      const org = { '@type': 'Organization', '@id': base + '/#org', name: V.NAME && !isPh(V.NAME) ? V.NAME : 'Aetherfall: Dungeons', url: base + '/', logo: base + '/assets/img/icon-512.png' };
      if (V.EMAIL && !isPh(V.EMAIL)) org.email = V.EMAIL;
      const game = {
        '@type': 'VideoGame', '@id': base + '/#game', name: 'Aetherfall: Dungeons', url: base + '/', description: t('meta.index.desc'), image: base + '/assets/img/og-image.png',
        genre: ['Action RPG', 'Dungeon Crawler'], gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', inLanguage: ['de', 'en'],
        playMode: ['SinglePlayer', 'CoOp'], numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 4 },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', url: base + '/' + String(C.GAME_PATH || 'play/').replace(/^\/+/, '') },
        publisher: { '@id': base + '/#org' }, author: { '@id': base + '/#org' },
      };
      el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [game, org] });
    },
  };
  window.Site = Site;
  window.Toast = Toast;
  const start = () => { try { Site.init(); } catch (e) { console.error('[Aetherfall] Seitenaufbau fehlgeschlagen', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
