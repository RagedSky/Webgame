import { clear, el } from './dom';
import { STR } from './strings';
import type { StarSystem, Planet } from '@/gen/universe/types';
import { WEATHER } from '@/gen/universe/catalog';
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_SHORT, RARITIES, RARITY_LABELS, SPECIAL_LABELS, TIME_LABELS, type ArchiveEntry, type Category, type Rarity } from '@/gen/archive/types';
import { BEHAVIOR_LABELS } from '@/gen/archive/descriptions';
import type { ArchiveProgress, Sample } from '@/game/progress/ArchiveProgress';
import { SAMPLE_SOURCE_LABELS } from '@/game/samples';
import type { GameDb } from '@/save/Db';

export interface ArchiveUiCallbacks {
  onClose: () => void;
  onTabChange?: () => void;
  onAnalyzeSample: (sample: Sample) => void;
  onDiscardSample: (sample: Sample) => void;
  onExportPhoto: (photoId: string) => void;
}

type Tab = 'archive' | 'log' | 'samples';
type StatusFilter = 'all' | 'missing' | 'discovered' | 'hinted';

const PAGE = 80;

/**
 * Enzyklopädie-Overlay (Tab): Filter nach Planet, Kategorie, Seltenheit, Status; Suche; Sortierung;
 * Fortschrittsbalken; Eintragsdetails mit bestem Foto, Sternen, Verhaltens-Slots, Umbenennen.
 * Tabs: Archiv, Logbuch, Proben.
 */
export class ArchiveUi {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly header: HTMLElement;
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'archive';
  private selectedId: string | null = null;
  private filter = { planet: '', category: '' as Category | '', rarity: '' as Rarity | '', status: 'all' as StatusFilter, search: '', sort: 'status', limit: PAGE };
  private readonly thumbUrls = new Map<string, string>();
  private readonly planets: Map<string, Planet>;
  private unsubscribe: (() => void) | null = null;
  private open = false;
  /** Während das Mikroskop offen ist, nicht automatisch neu rendern. */
  holdRender = false;

  constructor(
    parent: HTMLElement,
    private readonly system: StarSystem,
    private readonly progress: ArchiveProgress,
    private readonly db: GameDb,
    private readonly cb: ArchiveUiCallbacks,
    currentPlanetId: string,
  ) {
    this.planets = new Map(system.planets.map((p) => [p.id, p]));
    this.filter.planet = currentPlanetId;
    const tabs = el('div', { class: 'tabs' });
    for (const [id, label] of [['archive', STR.archive.tabArchive], ['log', STR.archive.tabLog], ['samples', STR.archive.tabSamples]] as Array<[Tab, string]>) {
      const b = el('button', { text: label, onClick: () => this.setTab(id) });
      this.tabButtons.set(id, b);
      tabs.append(b);
    }
    tabs.append(el('button', { class: 'close', text: STR.archive.close, onClick: () => this.cb.onClose() }));
    this.header = el('div', { class: 'archive-header' });
    this.body = el('div', { class: 'archive-body' });
    this.root = el('div', { class: 'archive-ui', style: 'display:none' }, el('div', { class: 'panel archive-panel' }, tabs, this.header, this.body));
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(tab: Tab = 'archive'): void {
    this.open = true;
    this.root.style.display = 'flex';
    this.unsubscribe?.();
    this.unsubscribe = this.progress.onChange(() => {
      if (!this.holdRender) this.render();
    });
    this.setTab(tab);
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  selectEntry(id: string): void {
    this.selectedId = id;
    this.setTab('archive');
  }

  private setTab(tab: Tab): void {
    this.cb.onTabChange?.();
    this.tab = tab;
    for (const [id, b] of this.tabButtons) b.classList.toggle('active', id === tab);
    this.render();
  }

  private render(): void {
    if (!this.open) return;
    this.renderHeader();
    clear(this.body);
    if (this.tab === 'archive') this.body.append(this.renderArchive());
    else if (this.tab === 'log') this.body.append(this.renderLog());
    else this.body.append(this.renderSamples());
  }

  private bar(fraction: number, label: string): HTMLElement {
    const fill = el('div');
    fill.style.width = `${Math.round(fraction * 100)}%`;
    return el('div', { class: 'archive-progress' }, el('span', { text: label }), el('div', { class: 'progress' }, fill), el('span', { class: 'num', text: `${Math.round(fraction * 100)} %` }));
  }

  private renderHeader(): void {
    clear(this.header);
    const total = this.progress.completion();
    this.header.append(el('h2', { text: `${STR.archive.title} · ${this.system.name}` }));
    this.header.append(this.bar(total.fraction, `${STR.archive.total}: ${total.discovered}/${total.total}`));
    if (this.progress.isSealed()) this.header.append(el('div', { class: 'sealed', text: STR.archive.sealed }));
    const planetBars = el('div', { class: 'archive-planets' });
    for (const p of this.system.planets) {
      const c = this.progress.completion(p.id);
      if (c.total === 0) continue;
      planetBars.append(this.bar(c.fraction, `${p.isStart ? '★ ' : ''}${p.name} ${c.discovered}/${c.total}`));
    }
    this.header.append(planetBars);
  }

  private readonly unknownIndex = new Map<string, number>();

  /** Laufende Nummer unbekannter Einträge je Planet und Kategorie (damit die Liste unterscheidbar bleibt). */
  private indexOf(e: ArchiveEntry): number {
    let n = this.unknownIndex.get(e.id);
    if (n === undefined) {
      const same = this.system.entries.filter((x) => x.planetId === e.planetId && x.category === e.category);
      same.forEach((x, i) => this.unknownIndex.set(x.id, i + 1));
      n = this.unknownIndex.get(e.id) ?? 0;
    }
    return n;
  }

  private entryName(e: ArchiveEntry): string {
    if (this.progress.isDiscovered(e.id)) return this.progress.displayName(e);
    const idx = `${CATEGORY_SHORT[e.category]} #${this.indexOf(e)}`;
    if (this.progress.isHinted(e.id)) return `${STR.archive.unknown} · ${idx} · Spuren`;
    return `${STR.archive.unknown} · ${idx}`;
  }

  private filtered(): ArchiveEntry[] {
    const f = this.filter;
    const q = f.search.toLowerCase();
    const list = this.system.entries.filter((e) => {
      if (f.planet && e.planetId !== f.planet) return false;
      if (f.category && e.category !== f.category) return false;
      if (f.rarity && e.rarity !== f.rarity) return false;
      const disc = this.progress.isDiscovered(e.id);
      const hint = this.progress.isHinted(e.id);
      if (f.status === 'missing' && disc) return false;
      if (f.status === 'discovered' && !disc) return false;
      if (f.status === 'hinted' && !(hint && !disc)) return false;
      if (q) {
        const name = disc ? this.progress.displayName(e).toLowerCase() : '';
        if (!name.includes(q) && !(disc && e.latinName.toLowerCase().includes(q)) && !CATEGORY_LABELS[e.category].toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const rarityRank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
    list.sort((a, b) => {
      if (f.sort === 'rarity') return rarityRank[b.rarity] - rarityRank[a.rarity] || a.id.localeCompare(b.id);
      if (f.sort === 'stars') return (this.progress.get(b.id).stars - this.progress.get(a.id).stars) || a.id.localeCompare(b.id);
      if (f.sort === 'status') {
        const rank = (e: ArchiveEntry): number => (this.progress.isDiscovered(e.id) ? 0 : this.progress.isHinted(e.id) ? 1 : 2);
        return rank(a) - rank(b) || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || this.entryName(a).localeCompare(this.entryName(b), 'de');
      }
      const da = this.progress.isDiscovered(a.id);
      const dbb = this.progress.isDiscovered(b.id);
      if (da !== dbb) return da ? -1 : 1;
      return this.entryName(a).localeCompare(this.entryName(b), 'de');
    });
    return list;
  }

  private async thumbFor(photoId: string, img: HTMLImageElement): Promise<void> {
    let url = this.thumbUrls.get(photoId);
    if (!url) {
      const rec = await this.db.getPhoto(photoId);
      if (!rec) return;
      url = URL.createObjectURL(rec.thumb);
      this.thumbUrls.set(photoId, url);
    }
    img.src = url;
  }

  private renderArchive(): HTMLElement {
    const f = this.filter;
    const mk = (opts: Array<[string, string]>, value: string, onChange: (v: string) => void): HTMLSelectElement => {
      const sel = el('select');
      for (const [v, label] of opts) sel.append(el('option', { value: v, text: label }));
      sel.value = value;
      sel.addEventListener('change', () => {
        onChange(sel.value);
        f.limit = PAGE;
        this.render();
      });
      return sel;
    };
    const planetSel = mk([['', STR.systemView.allPlanets], ...this.system.planets.map((p): [string, string] => [p.id, `${p.isStart ? '★ ' : ''}${p.name}`])], f.planet, (v) => (f.planet = v));
    const catSel = mk([['', STR.systemView.allCategories], ...CATEGORIES.map((c): [string, string] => [c, CATEGORY_LABELS[c]])], f.category, (v) => (f.category = v as Category | ''));
    const rarSel = mk([['', STR.systemView.allRarities], ...RARITIES.map((r): [string, string] => [r, RARITY_LABELS[r]])], f.rarity, (v) => (f.rarity = v as Rarity | ''));
    const statusSel = mk([['all', STR.archive.statusAll], ['missing', STR.archive.statusMissing], ['hinted', STR.archive.statusHinted], ['discovered', STR.archive.statusDiscovered]], f.status, (v) => (f.status = v as StatusFilter));
    const sortSel = mk([['name', STR.archive.sortName], ['rarity', STR.archive.sortRarity], ['stars', STR.archive.sortStars], ['status', STR.archive.sortStatus]], f.sort, (v) => (f.sort = v));
    const search = el('input', { type: 'text', placeholder: STR.systemView.search, value: f.search });
    search.addEventListener('input', () => {
      f.search = search.value.trim();
      f.limit = PAGE;
      this.renderList(listHost, listInfo);
    });

    const listHost = el('div', { class: 'archive-list' });
    const listInfo = el('div', { class: 'muted small' });
    const detail = el('div', { class: 'archive-detail' });
    this.detailHost = detail;
    this.renderList(listHost, listInfo);
    this.renderDetail();

    return el(
      'div',
      { class: 'archive-columns' },
      el('div', { class: 'archive-left' }, el('div', { class: 'entry-filters' }, planetSel, catSel, rarSel, statusSel, sortSel, search), listInfo, listHost),
      detail,
    );
  }

  private detailHost: HTMLElement | null = null;

  private renderList(host: HTMLElement, info: HTMLElement): void {
    clear(host);
    const list = this.filtered();
    info.textContent = STR.systemView.showing(Math.min(this.filter.limit, list.length), list.length);
    if (!this.selectedId && list.length) this.selectedId = list[0]!.id;
    for (const e of list.slice(0, this.filter.limit)) {
      const p = this.progress.get(e.id);
      const disc = p.stars > 0;
      const stars = disc ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '';
      const img = el('img', { class: 'thumb', alt: '' });
      if (p.bestPhotoId) void this.thumbFor(p.bestPhotoId, img);
      else img.classList.add('empty');
      const item = el(
        'div',
        { class: `archive-item ${disc ? 'discovered' : this.progress.isHinted(e.id) ? 'hinted' : 'unknown'} ${e.id === this.selectedId ? 'selected' : ''}` },
        img,
        el('div', { class: 'col' }, el('span', { class: 'name', text: this.entryName(e) }), el('span', { class: 'meta', text: `${disc || this.progress.isHinted(e.id) ? RARITY_LABELS[e.rarity] + ' · ' : ''}${this.planets.get(e.planetId)?.name ?? ''} · ${CATEGORY_SHORT[e.category]}` })),
        el('span', { class: 'stars', text: stars }),
      );
      item.addEventListener('click', () => {
        this.selectedId = e.id;
        this.renderList(host, info);
        this.renderDetail();
      });
      host.append(item);
    }
    if (list.length > this.filter.limit) {
      host.append(
        el('button', {
          class: 'small',
          text: `Weitere ${Math.min(PAGE, list.length - this.filter.limit)} anzeigen`,
          onClick: () => {
            this.filter.limit += PAGE;
            this.renderList(host, info);
          },
        }),
      );
    }
  }

  private renderDetail(): void {
    const host = this.detailHost;
    if (!host) return;
    clear(host);
    const e = this.selectedId ? this.system.entries.find((x) => x.id === this.selectedId) : undefined;
    if (!e) {
      host.append(el('p', { class: 'muted', text: STR.archive.selectEntry }));
      return;
    }
    const p = this.progress.get(e.id);
    const planet = this.planets.get(e.planetId);
    const disc = p.stars > 0;
    const hinted = this.progress.isHinted(e.id);
    const biomes = e.biomeIds.map((id) => planet?.biomes.find((b) => b.id === id)?.name ?? id).join(', ');
    const cond = [
      e.spawn.timeOfDay !== 'any' ? TIME_LABELS[e.spawn.timeOfDay] : 'jederzeit',
      e.spawn.weather === 'any' ? 'jedes Wetter' : e.spawn.weather.map((w) => WEATHER[w].name).join('/'),
      e.spawn.special ? SPECIAL_LABELS[e.spawn.special] : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const title = el('h3', { text: this.entryName(e) });
    host.append(title);
    if (disc) host.append(el('div', { class: 'latin', text: e.latinName }));
    host.append(el('div', { class: 'row' }, el('span', { class: `badge rarity-${e.rarity}`, text: disc || hinted ? RARITY_LABELS[e.rarity] : '?' }), el('span', { class: 'badge cat', text: CATEGORY_LABELS[e.category] }), el('span', { class: 'badge cat', text: e.captureMethod === 'photo' ? STR.archive.methodPhoto : e.captureMethod === 'microscope' ? STR.archive.methodMicro : STR.archive.methodSample }), el('span', { class: 'stars big', text: disc ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '☆☆☆' })));

    if (p.bestPhotoId) {
      const img = el('img', { class: 'best-photo', alt: 'Bestes Foto' });
      void this.thumbFor(p.bestPhotoId, img);
      host.append(img, el('div', { class: 'row' }, el('button', { class: 'small', text: STR.photo.exportPng, onClick: () => this.cb.onExportPhoto(p.bestPhotoId as string) }), el('span', { class: 'muted small', text: `${p.photoIds.length} ${STR.archive.photos} · ${STR.archive.bestScore} ${p.bestScore}` })));
    }

    const kv = el('dl', { class: 'kv' });
    const add = (k: string, v: string): void => {
      kv.append(el('dt', { text: k }), el('dd', { text: v }));
    };
    add(STR.archive.planet, planet?.name ?? e.planetId);
    add(STR.archive.biomes, disc || hinted ? biomes : '?');
    add(STR.archive.conditions, disc || hinted ? cond : '?');
    if (disc) add(STR.archive.family, this.system.families.find((f) => f.id === e.familyId)?.name ?? '-');
    host.append(kv);

    if (disc) {
      host.append(el('p', { class: 'desc', text: e.description }));
      if (e.behaviors.length) {
        const slots = el('div', { class: 'behaviors' });
        for (const b of e.behaviors) slots.append(el('span', { class: `badge ${p.behaviors.includes(b) ? 'done' : ''}`, text: `${p.behaviors.includes(b) ? '✓ ' : ''}${BEHAVIOR_LABELS[b] ?? b}` }));
        host.append(el('div', { class: 'muted small', text: STR.archive.behaviorSlots }), slots);
      }
      const rename = el('input', { type: 'text', value: this.progress.displayName(e), maxlength: 40, placeholder: e.name });
      const renameBtn = el('button', { class: 'small', text: STR.archive.rename, onClick: () => this.progress.rename(e.id, rename.value) });
      host.append(el('div', { class: 'row' }, rename, renameBtn));
    } else {
      host.append(el('p', { class: 'muted', text: hinted ? STR.archive.hintedHelp : STR.archive.unknownHelp }));
    }
    if (p.hints.length) {
      const h = el('ul', { class: 'hints' });
      for (const t of p.hints) h.append(el('li', { text: t }));
      host.append(el('div', { class: 'muted small', text: STR.archive.hints }), h);
    }
  }

  private renderLog(): HTMLElement {
    const host = el('div', { class: 'archive-log' });
    const items = this.progress.logbook.slice().reverse();
    if (items.length === 0) host.append(el('p', { class: 'muted', text: STR.archive.logEmpty }));
    for (const l of items) {
      const kind = l.kind === 'discovery' ? '●' : l.kind === 'hint' ? '◆' : l.kind === 'rumor' ? '✦' : '·';
      const row = el('div', { class: `log-item ${l.kind}` }, el('span', { class: 'k', text: kind }), el('span', { text: l.text }));
      if (l.entryId) row.addEventListener('click', () => this.selectEntry(l.entryId as string));
      host.append(row);
    }
    return host;
  }

  private renderSamples(): HTMLElement {
    const host = el('div', { class: 'archive-samples' });
    if (this.progress.samples.length === 0) host.append(el('p', { class: 'muted', text: STR.archive.samplesEmpty }));
    for (const s of this.progress.samples.slice().reverse()) {
      const planet = this.planets.get(s.planetId);
      const biome = planet?.biomes.find((b) => b.id === s.biomeId)?.name ?? '';
      host.append(
        el(
          'div',
          { class: `sample-item ${s.analyzed ? 'analyzed' : ''}` },
          el('div', { class: 'col' }, el('span', { class: 'name', text: s.label }), el('span', { class: 'meta', text: `${SAMPLE_SOURCE_LABELS[s.source]} · ${planet?.name ?? ''} · ${biome}${s.analyzed ? ` · ${STR.archive.analyzed}` : ''}` })),
          el('div', { class: 'row' }, el('button', { class: 'small primary', text: s.analyzed ? STR.archive.analyzeAgain : STR.archive.analyze, onClick: () => this.cb.onAnalyzeSample(s) }), el('button', { class: 'small', text: STR.archive.discard, onClick: () => this.cb.onDiscardSample(s) })),
        ),
      );
    }
    return host;
  }

  /** Host-Element für die Mikroskop-Ansicht (unterhalb der Probenliste). */
  get bodyElement(): HTMLElement {
    return this.body;
  }

  dispose(): void {
    this.hide();
    for (const url of this.thumbUrls.values()) URL.revokeObjectURL(url);
    this.thumbUrls.clear();
    this.root.remove();
  }
}
