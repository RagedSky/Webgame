import { clear, el, fmt, fmtInt } from './dom';
import { showToast } from './toast';
import { STR } from './strings';
import type { Planet, StarSystem } from '@/gen/universe/types';
import { GAS_LABELS, HAZARD_LABELS, PLANET_TYPES, RESOURCES, STAR_TYPES, WEATHER } from '@/gen/universe/catalog';
import { FUEL_ROLE_LABELS } from '@/gen/universe/Fuel';
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_SHORT, HINT_LABELS, RARITIES, RARITY_LABELS, SPECIAL_LABELS, TIME_LABELS, type ArchiveEntry, type Category, type Rarity } from '@/gen/archive/types';
import { BEHAVIOR_LABELS } from '@/gen/archive/descriptions';
import { kelvinToCelsius } from '@/math/utils';

export interface SystemPanelCallbacks {
  onSelectPlanet: (planet: Planet | null) => void;
  onFocusPlanet: (planet: Planet) => void;
  onLandPlanet: (planet: Planet) => void;
}

type Tab = 'overview' | 'planets' | 'archive' | 'dump';

const PAGE_SIZE = 120;

/** Seitliches Datenpanel der Systemansicht (reines DOM). */
export class SystemPanel {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'overview';
  private selected: Planet | null = null;
  private filter = { planet: '', category: '', rarity: '', search: '', limit: PAGE_SIZE };

  constructor(
    parent: HTMLElement,
    private readonly system: StarSystem,
    private readonly cb: SystemPanelCallbacks,
  ) {
    const tabs = el('div', { class: 'tabs' });
    const defs: Array<[Tab, string]> = [
      ['overview', STR.systemView.overview],
      ['planets', STR.systemView.planets],
      ['archive', STR.systemView.archive],
      ['dump', STR.systemView.dataDump],
    ];
    for (const [id, label] of defs) {
      const b = el('button', { text: label, onClick: () => this.setTab(id) });
      this.tabButtons.set(id, b);
      tabs.append(b);
    }
    const collapse = el('button', { class: 'collapse', text: '»', title: 'Panel ein-/ausblenden' });
    collapse.addEventListener('click', () => {
      const collapsed = this.root.classList.toggle('collapsed');
      collapse.textContent = collapsed ? '«' : '»';
    });
    tabs.append(collapse);
    this.body = el('div', { class: 'tab-body' });
    this.root = el('div', { class: 'panel system-panel' }, tabs, this.body);
    parent.append(this.root);
    this.setTab('overview');
  }

  copySeed(): void {
    void navigator.clipboard?.writeText(this.system.seed).then(
      () => showToast(STR.copied),
      () => showToast(this.system.seed),
    );
  }

  showPlanet(planet: Planet | null): void {
    this.selected = planet;
    this.root.classList.remove('collapsed');
    this.setTab('planets');
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    for (const [id, b] of this.tabButtons) b.classList.toggle('active', id === tab);
    this.renderBody();
  }

  private renderBody(): void {
    clear(this.body);
    switch (this.tab) {
      case 'overview':
        this.body.append(this.renderOverview());
        break;
      case 'planets':
        this.body.append(this.renderPlanets());
        break;
      case 'archive':
        this.body.append(this.renderArchive());
        break;
      case 'dump':
        this.body.append(this.renderDump());
        break;
    }
    this.body.scrollTop = 0;
  }

  // ---------------------------------------------------------------------------
  private kv(pairs: Array<[string, string]>): HTMLElement {
    const dl = el('dl', { class: 'kv' });
    for (const [k, v] of pairs) dl.append(el('dt', { text: k }), el('dd', { text: v }));
    return dl;
  }

  private renderOverview(): HTMLElement {
    const s = this.system;
    const star = s.star;
    const def = STAR_TYPES[star.type];
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    const rar = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
    for (const e of s.entries) {
      counts[e.category]++;
      rar[e.rarity]++;
    }
    const start = s.planets.find((p) => p.id === s.startPlanetId)!;
    const fuel = s.fuelFormula;

    const catTable = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Kategorie' }), el('th', { class: 'num', text: 'Einträge' }), el('th', { class: 'num', text: 'Anteil' }))));
    const tbody = el('tbody');
    for (const c of CATEGORIES) {
      tbody.append(el('tr', {}, el('td', { text: CATEGORY_LABELS[c] }), el('td', { class: 'num', text: String(counts[c]) }), el('td', { class: 'num', text: `${((counts[c] / s.entries.length) * 100).toFixed(0)} %` })));
    }
    catTable.append(tbody);

    const planetTable = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Planet' }), el('th', { text: 'Typ' }), el('th', { class: 'num', text: 'AU' }), el('th', { class: 'num', text: 'Einträge' }))));
    const pb = el('tbody');
    for (const p of s.planets) {
      const n = Object.values(p.entryBudget).reduce((a, b) => a + b, 0);
      const row = el('tr', { style: 'cursor:pointer' }, el('td', { text: (p.isStart ? '★ ' : '') + p.name }), el('td', { text: p.typeLabel }), el('td', { class: 'num', text: p.orbitRadiusAu.toFixed(2) }), el('td', { class: 'num', text: String(n) }));
      row.addEventListener('click', () => {
        this.selected = p;
        this.cb.onSelectPlanet(p);
        this.setTab('planets');
      });
      pb.append(row);
    }
    planetTable.append(pb);

    return el(
      'div',
      {},
      el('h3', { text: `${s.name}` }),
      this.kv([
        ['Seed', s.seed],
        ['Stern', `${star.label} (${def.description})`],
        ['Temperatur', `${fmtInt(star.temperatureK)} K`],
        ['Leuchtkraft', `${fmt(star.luminosity, 2)} L☉`],
        ['Masse / Radius', `${fmt(star.mass, 2)} M☉ / ${fmt(star.radius, 2)} R☉`],
        ['Lebenszone', `${fmt(star.habitableZoneAu[0], 2)} – ${fmt(star.habitableZoneAu[1], 2)} AU`],
        ['Strahlung', `${Math.round(star.radiation * 100)} %`],
        ['Planeten', String(s.planets.length)],
        ['Startplanet', `${start.name} (${start.typeLabel})`],
        ['Schwierigkeit', String(s.difficulty)],
      ]),
      el('h3', { text: STR.systemView.fuel }),
      this.kv([
        ['Name', fuel.name],
        ...fuel.components.map((c): [string, string] => [FUEL_ROLE_LABELS[c.role], `${RESOURCES[c.resourceId].name} · ${c.parts}/10`]),
        ['Energie/Einheit', String(fuel.energyPerUnit)],
      ]),
      el('h3', { text: `Archiv: ${s.entries.length} Einträge (Budget ${s.entryBudget})` }),
      catTable,
      el('p', { class: 'muted', text: RARITIES.map((r) => `${RARITY_LABELS[r]}: ${rar[r]}`).join(' · ') }),
      el('h3', { text: 'Planeten' }),
      planetTable,
    );
  }

  // ---------------------------------------------------------------------------
  private renderPlanets(): HTMLElement {
    const list = el('div', { class: 'planet-list' });
    for (const p of this.system.planets) {
      const n = Object.values(p.entryBudget).reduce((a, b) => a + b, 0);
      const b = el(
        'button',
        { class: this.selected === p ? 'selected' : '' },
        el('span', { class: 'swatch', style: `background:${p.color}` }),
        `${p.isStart ? '★ ' : ''}${p.name} · ${p.typeLabel} · ${p.orbitRadiusAu.toFixed(2)} AU · ${n} Einträge`,
      );
      b.addEventListener('click', () => {
        this.selected = p;
        this.cb.onSelectPlanet(p);
        this.renderBody();
      });
      list.append(b);
    }
    const wrap = el('div', {}, list);
    if (this.selected) wrap.append(this.renderPlanetDetail(this.selected));
    else wrap.append(el('p', { class: 'muted', text: STR.systemView.selectPlanet }));
    return wrap;
  }

  private renderPlanetDetail(p: Planet): HTMLElement {
    const atmo = p.atmosphere;
    const comp = Object.entries(atmo.composition)
      .sort((a, b) => b[1] - a[1])
      .map(([g, f]) => `${GAS_LABELS[g as keyof typeof GAS_LABELS]} ${(f * 100).toFixed(f < 0.01 ? 1 : 0)} %`)
      .join(', ');
    const biomeTable = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Biom' }), el('th', { class: 'num', text: 'Anteil' }), el('th', { text: 'Höhe' }), el('th', { text: 'Merkmale' }))));
    const bt = el('tbody');
    for (const b of p.biomes) {
      bt.append(el('tr', {}, el('td', { text: b.name }), el('td', { class: 'num', text: `${Math.round(b.coverage * 100)} %` }), el('td', { text: `${b.altitude[0].toFixed(1)}–${b.altitude[1].toFixed(1)}` }), el('td', { text: [b.hasWater ? 'Wasser' : '', b.isCave ? 'Höhle' : '', `Feuchte ${Math.round(b.humidity * 100)} %`].filter(Boolean).join(', ') })));
    }
    biomeTable.append(bt);
    const resTable = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Rohstoff' }), el('th', { class: 'num', text: 'Häufigkeit' }), el('th', { text: 'Rolle' }))));
    const rt = el('tbody');
    for (const r of p.resources) {
      const def = RESOURCES[r.resourceId];
      rt.append(el('tr', {}, el('td', { text: def.name }), el('td', { class: 'num', text: `${Math.round(r.abundance * 100)} %` }), el('td', { text: def.fuelRole ? FUEL_ROLE_LABELS[def.fuelRole] : def.kind })));
    }
    resTable.append(rt);
    const budget = CATEGORIES.map((c) => `${CATEGORY_SHORT[c]} ${p.entryBudget[c]}`).join(' · ');

    const focusBtn = el('button', { class: 'small', text: 'Kamera fokussieren', onClick: () => this.cb.onFocusPlanet(p) });
    const landBtn = el('button', {
      class: 'small primary',
      text: STR.planet.land,
      title: p.type === 'gas_giant' ? STR.planet.noSurface : `Auf ${p.name} landen`,
      disabled: p.type === 'gas_giant',
      onClick: () => this.cb.onLandPlanet(p),
    });
    const archiveBtn = el('button', {
      class: 'small',
      text: 'Einträge zeigen',
      onClick: () => {
        this.filter.planet = p.id;
        this.filter.limit = PAGE_SIZE;
        this.setTab('archive');
      },
    });

    return el(
      'div',
      {},
      el('h3', { text: `${p.isStart ? '★ ' : ''}${p.name} – ${p.typeLabel}` }),
      el('div', { class: 'row' }, landBtn, focusBtn, archiveBtn),
      el('p', { class: 'muted', text: PLANET_TYPES[p.type].description }),
      this.kv([
        ['Orbit', `${p.orbitRadiusAu.toFixed(2)} AU · Jahr ${fmtInt(p.orbitPeriodDays)} Tage`],
        ['Radius / Gravitation', `${fmtInt(p.radiusKm)} km · ${p.gravity.toFixed(2)} g`],
        ['Temperatur', `Ø ${kelvinToCelsius(p.temperature.mean).toFixed(0)} °C (${kelvinToCelsius(p.temperature.min).toFixed(0)} … ${kelvinToCelsius(p.temperature.max).toFixed(0)} °C)`],
        ['Atmosphäre', atmo.pressure > 0 ? `${atmo.pressure.toFixed(2)} bar · ${atmo.breathable ? 'atembar' : atmo.toxic ? 'giftig' : 'nicht atembar'}` : 'keine'],
        ['Zusammensetzung', comp || '–'],
        ['Tag / Achsneigung', `${p.dayLengthHours.toFixed(1)} h · ${p.axialTiltDeg.toFixed(0)}°`],
        ['Monde', p.moons.length ? p.moons.map((m) => `${m.name} (${fmtInt(m.radiusKm)} km)`).join(', ') : 'keine'],
        ['Wetter', p.weather.map((w) => WEATHER[w].name).join(', ')],
        ['Gefahren', p.hazards.length ? p.hazards.map((h) => HAZARD_LABELS[h]).join(', ') : 'keine'],
        ['Biodiversität', `${Math.round(p.biodiversity * 100)} %`],
        ['Anforderung', `Triebwerk Stufe ${p.requirements.engineTier} · Schild Stufe ${p.requirements.shieldTier}`],
        ['Terrain-Seed', p.terrainSeed],
        ['Archiv', budget],
      ]),
      el('h3', { text: 'Biome' }),
      biomeTable,
      el('h3', { text: 'Rohstoffe' }),
      resTable,
    );
  }

  // ---------------------------------------------------------------------------
  private renderArchive(): HTMLElement {
    const f = this.filter;
    const planetSel = el('select');
    planetSel.append(el('option', { value: '', text: STR.systemView.allPlanets }));
    for (const p of this.system.planets) planetSel.append(el('option', { value: p.id, text: `${p.isStart ? '★ ' : ''}${p.name}` }));
    planetSel.value = f.planet;
    const catSel = el('select');
    catSel.append(el('option', { value: '', text: STR.systemView.allCategories }));
    for (const c of CATEGORIES) catSel.append(el('option', { value: c, text: CATEGORY_LABELS[c] }));
    catSel.value = f.category;
    const rarSel = el('select');
    rarSel.append(el('option', { value: '', text: STR.systemView.allRarities }));
    for (const r of RARITIES) rarSel.append(el('option', { value: r, text: RARITY_LABELS[r] }));
    rarSel.value = f.rarity;
    const search = el('input', { type: 'text', placeholder: STR.systemView.search, value: f.search });
    const apply = (): void => {
      f.planet = planetSel.value;
      f.category = catSel.value;
      f.rarity = rarSel.value;
      f.search = search.value.trim().toLowerCase();
      f.limit = PAGE_SIZE;
      this.renderBody();
      search.focus();
    };
    planetSel.addEventListener('change', apply);
    catSel.addEventListener('change', apply);
    rarSel.addEventListener('change', apply);
    search.addEventListener('input', apply);

    const entries = this.system.entries.filter(
      (e) =>
        (!f.planet || e.planetId === f.planet) &&
        (!f.category || e.category === f.category) &&
        (!f.rarity || e.rarity === f.rarity) &&
        (!f.search || e.name.toLowerCase().includes(f.search) || e.latinName.toLowerCase().includes(f.search) || e.description.toLowerCase().includes(f.search)),
    );
    const list = el('div', { class: 'entry-list' });
    const planetsById = new Map(this.system.planets.map((p) => [p.id, p]));
    for (const e of entries.slice(0, f.limit)) list.append(this.renderEntry(e, planetsById.get(e.planetId)));
    if (entries.length === 0) list.append(el('p', { class: 'muted', text: STR.systemView.noEntries }));
    const more =
      entries.length > f.limit
        ? el('button', {
            class: 'small',
            text: `Weitere ${Math.min(PAGE_SIZE, entries.length - f.limit)} anzeigen`,
            onClick: () => {
              f.limit += PAGE_SIZE;
              this.renderBody();
            },
          })
        : null;

    return el(
      'div',
      {},
      el('div', { class: 'entry-filters' }, planetSel, catSel, rarSel, search),
      el('p', { class: 'muted', text: STR.systemView.showing(Math.min(f.limit, entries.length), entries.length) }),
      list,
      more,
    );
  }

  private renderEntry(e: ArchiveEntry, planet: Planet | undefined): HTMLElement {
    const biomes = planet ? e.biomeIds.map((id) => planet.biomes.find((b) => b.id === id)?.name ?? id).join(', ') : '';
    const cond = [
      TIME_LABELS[e.spawn.timeOfDay] !== 'jederzeit' ? TIME_LABELS[e.spawn.timeOfDay] : '',
      e.spawn.weather === 'any' ? '' : e.spawn.weather.map((w) => WEATHER[w].name).join('/'),
      e.spawn.special ? SPECIAL_LABELS[e.spawn.special] : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const beh = e.behaviors.map((b) => BEHAVIOR_LABELS[b] ?? b).join(', ');
    const hints = e.hints.map((h) => HINT_LABELS[h]).join(', ');
    const fam = this.system.families.find((f) => f.id === e.familyId);
    return el(
      'div',
      { class: 'entry-item' },
      el('div', {}, el('span', { class: 'name', text: e.name }), el('span', { class: 'latin', text: e.latinName })),
      el(
        'div',
        { class: 'meta' },
        el('span', { class: `badge rarity-${e.rarity}`, text: RARITY_LABELS[e.rarity] }),
        el('span', { class: 'badge cat', text: `${CATEGORY_LABELS[e.category]} · ${e.subcategory}` }),
        el('span', { class: 'badge cat', text: e.captureMethod === 'photo' ? 'Foto' : e.captureMethod === 'microscope' ? 'Mikroskop' : 'Probe' }),
        `${e.id} · ${planet?.name ?? e.planetId} · ${biomes}${fam ? ` · Familie ${fam.name}` : ''}`,
      ),
      el('div', { class: 'desc', text: e.description }),
      el('div', { class: 'meta', text: [cond ? `Bedingungen: ${cond}` : '', beh ? `Verhalten: ${beh}` : '', hints ? `Hinweise: ${hints}` : ''].filter(Boolean).join(' · ') }),
    );
  }

  // ---------------------------------------------------------------------------
  private renderDump(): HTMLElement {
    const { entries, families, ...rest } = this.system;
    const slim = { ...rest, entryCount: entries.length, familyCount: families.length };
    const pre = el('pre', { text: JSON.stringify(slim, null, 2) });
    const download = (name: string, data: unknown): void => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return el(
      'div',
      {},
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'small', text: 'System als JSON herunterladen', onClick: () => download(`stellar-${this.system.seed}.json`, this.system) }),
        el('button', { class: 'small', text: 'Nur Einträge (JSON)', onClick: () => download(`stellar-${this.system.seed}-archiv.json`, entries) }),
      ),
      el('p', { class: 'muted', text: 'Stern, Planeten, Treibstoff-Formel (ohne Einträge – die stehen im Tab Archiv).' }),
      pre,
    );
  }

  dispose(): void {
    this.root.remove();
  }
}
