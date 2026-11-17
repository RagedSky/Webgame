import { clear, downloadBlob, el } from './dom';
import { STR } from './strings';
import { showToast } from './toast';
import { BADGES, BADGE_LABELS, CRESTS, CREST_LABELS, FINISH_LABELS, HELMET_SHAPES, HELMET_SHAPE_LABELS, PACKS, PACK_LABELS, PATTERN_LABELS, SUIT_FINISHES, SUIT_PALETTES, SUIT_PATTERNS, VISOR_LABELS, VISOR_STYLES, VISOR_TINTS, decodeShareCode, defaultCharacter, encodeShareCode, randomCharacter, sanitizeCharacter, type CharacterConfig, type CharacterPreset } from '@/game/character/Character';
import { BACKGROUNDS } from '@/game/character/backgrounds';
import { Random, randomSeedString } from '@/math/Random';

export interface CharacterUiCallbacks {
  onChange: (cfg: CharacterConfig) => void;
  onApply: (cfg: CharacterConfig) => void;
  onCancel: () => void;
  onSavePreset: (preset: CharacterPreset) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
  onCamera: (view: 'helmet' | 'body' | 'back') => void;
  onTurntable: (on: boolean) => void;
}

type Tab = 'body' | 'suit' | 'helmet' | 'gear' | 'background' | 'presets';

/** Charakter-Editor (DOM): Tabs mit Reglern, Farben, Hintergrund-Karten, Presets, Share-Code und JSON. */
export class CharacterUi {
  readonly root: HTMLElement;
  private readonly tabsHost: HTMLElement;
  private readonly content: HTMLElement;
  private readonly side: HTMLElement;
  private tab: Tab = 'body';
  private cfg: CharacterConfig;
  private presetCounter = 0;
  private sideName: HTMLElement | null = null;
  private sideGoal: HTMLElement | null = null;
  private codeInput: HTMLInputElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private turnBtn: HTMLElement | null = null;
  private readonly locks = { body: false, suit: false, helmet: false, gear: false };
  private turntable = true;

  constructor(
    parent: HTMLElement,
    initial: CharacterConfig,
    private presets: CharacterPreset[],
    private readonly cb: CharacterUiCallbacks,
    private readonly applyLabel: string,
  ) {
    this.cfg = sanitizeCharacter(initial);
    this.tabsHost = el('div', { class: 'row wrap char-tabs' });
    this.content = el('div', { class: 'char-content' });
    this.side = el('div', { class: 'panel char-side' });
    const left = el('div', { class: 'panel char-panel' }, el('h2', { text: STR.character.title }), this.tabsHost, this.content);
    this.root = el('div', { class: 'editor-ui char-ui' }, left, this.side, el('div', { class: 'panel editor-hint', text: STR.character.preview }));
    parent.append(this.root);
    this.render();
  }

  get config(): CharacterConfig {
    return this.cfg;
  }

  setPresets(list: CharacterPreset[]): void {
    this.presets = list;
    if (this.tab === 'presets') this.renderContent();
  }

  private update(mut: (c: CharacterConfig) => void, rerender = false): void {
    mut(this.cfg);
    this.cfg = sanitizeCharacter(this.cfg);
    this.cb.onChange(this.cfg);
    if (rerender) this.renderContent();
    this.refreshSide();
  }

  /** Nur Werte der Seitenleiste aktualisieren (kein DOM-Neuaufbau, damit Eingabefelder den Fokus behalten). */
  private refreshSide(): void {
    const c = this.cfg;
    const bg = BACKGROUNDS.find((b) => b.id === c.background)!;
    if (this.sideName) this.sideName.textContent = c.name;
    if (this.sideGoal) this.sideGoal.textContent = `${bg.name} · ${bg.bonusText}`;
    if (this.codeInput) this.codeInput.value = encodeShareCode(c);
    if (this.nameInput && this.nameInput.value !== c.name && document.activeElement !== this.nameInput) this.nameInput.value = c.name;
    if (this.turnBtn) this.turnBtn.classList.toggle('primary', this.turntable);
  }

  private slider(label: string, get: () => number, set: (v: number) => void): HTMLElement {
    const input = el('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(get() * 100)) });
    const num = el('span', { class: 'num', text: `${Math.round(get() * 100)}` });
    input.addEventListener('input', () => {
      num.textContent = input.value;
      this.update((c) => {
        void c;
        set(Number(input.value) / 100);
      });
    });
    return el('label', { class: 'char-row' }, el('span', { text: label }), input, num);
  }

  private select<T extends string>(label: string, options: readonly T[], labels: Record<T, string>, get: () => T, set: (v: T) => void): HTMLElement {
    const sel = el('select');
    for (const o of options) sel.append(el('option', { value: o, text: labels[o] }));
    sel.value = get();
    sel.addEventListener('change', () => this.update(() => set(sel.value as T)));
    return el('label', { class: 'char-row' }, el('span', { text: label }), sel);
  }

  private color(label: string, get: () => string, set: (v: string) => void): HTMLElement {
    const input = el('input', { type: 'color', value: get() });
    input.addEventListener('input', () => this.update(() => set(input.value)));
    return el('label', { class: 'char-row' }, el('span', { text: label }), input, el('span', { class: 'muted small', text: get() }));
  }

  render(): void {
    clear(this.tabsHost);
    const tabs: Array<[Tab, string]> = [
      ['body', STR.character.tabBody],
      ['suit', STR.character.tabSuit],
      ['helmet', STR.character.tabHelmet],
      ['gear', STR.character.tabGear],
      ['background', STR.character.tabBackground],
      ['presets', STR.character.tabPresets],
    ];
    for (const [id, label] of tabs) {
      this.tabsHost.append(el('button', { class: `small ${this.tab === id ? 'primary' : ''}`, text: label, onClick: () => {
        this.tab = id;
        // passende Ansicht zum Reiter: Helm von vorn, Ausrüstung von hinten
        if (id === 'helmet') this.cb.onCamera('helmet');
        else if (id === 'gear') this.cb.onCamera('back');
        else if (id === 'body' || id === 'suit') this.cb.onCamera('body');
        this.render();
      } }));
    }
    this.renderContent();
    if (!this.sideName) this.renderSide();
    else this.refreshSide();
  }

  private renderContent(): void {
    clear(this.content);
    const c = this.cfg;
    const host = this.content;
    if (this.tab === 'body') {
      host.append(
        this.slider(STR.character.height, () => c.body.height, (v) => (this.cfg.body.height = v)),
        this.slider(STR.character.build, () => c.body.build, (v) => (this.cfg.body.build = v)),
        this.slider(STR.character.shoulders, () => c.body.shoulders, (v) => (this.cfg.body.shoulders = v)),
        this.slider(STR.character.legLength, () => c.body.legLength, (v) => (this.cfg.body.legLength = v)),
      );
    } else if (this.tab === 'suit') {
      const pal = el('div', { class: 'row wrap' });
      for (const [p, s, a] of SUIT_PALETTES) {
        const sw = el('button', { class: 'small swatch', title: `${p} ${s} ${a}`, onClick: () => this.update((cc) => { cc.suit.primary = p; cc.suit.secondary = s; cc.suit.accent = a; }, true) });
        sw.style.background = `linear-gradient(90deg, ${p} 0 50%, ${s} 50% 80%, ${a} 80%)`;
        pal.append(sw);
      }
      host.append(
        el('div', { class: 'char-row' }, el('span', { text: STR.character.palettes }), pal),
        this.color(STR.character.primary, () => c.suit.primary, (v) => (this.cfg.suit.primary = v)),
        this.color(STR.character.secondary, () => c.suit.secondary, (v) => (this.cfg.suit.secondary = v)),
        this.color(STR.character.accent, () => c.suit.accent, (v) => (this.cfg.suit.accent = v)),
        this.select(STR.character.pattern, SUIT_PATTERNS, PATTERN_LABELS, () => c.suit.pattern, (v) => (this.cfg.suit.pattern = v)),
        this.select(STR.character.finish, SUIT_FINISHES, FINISH_LABELS, () => c.suit.finish, (v) => (this.cfg.suit.finish = v)),
        this.slider(STR.character.armor, () => c.suit.armor, (v) => (this.cfg.suit.armor = v)),
        this.select(STR.character.badge, BADGES, BADGE_LABELS, () => c.suit.badge, (v) => (this.cfg.suit.badge = v)),
      );
    } else if (this.tab === 'helmet') {
      const tints = el('div', { class: 'row wrap' });
      for (const t of VISOR_TINTS) {
        const sw = el('button', { class: 'small swatch', title: t, onClick: () => this.update((cc) => (cc.helmet.visorTint = t), true) });
        sw.style.background = t;
        tints.append(sw);
      }
      host.append(
        this.select(STR.character.helmetShape, HELMET_SHAPES, HELMET_SHAPE_LABELS, () => c.helmet.shape, (v) => (this.cfg.helmet.shape = v)),
        this.select(STR.character.visor, VISOR_STYLES, VISOR_LABELS, () => c.helmet.visor, (v) => (this.cfg.helmet.visor = v)),
        el('div', { class: 'char-row' }, el('span', { text: STR.character.visorTints }), tints),
        this.color(STR.character.visorTint, () => c.helmet.visorTint, (v) => (this.cfg.helmet.visorTint = v)),
        this.select(STR.character.crest, CRESTS, CREST_LABELS, () => c.helmet.crest, (v) => (this.cfg.helmet.crest = v)),
      );
    } else if (this.tab === 'gear') {
      host.append(
        this.select(STR.character.pack, PACKS, PACK_LABELS, () => c.gear.pack, (v) => (this.cfg.gear.pack = v)),
        el('p', { class: 'muted small', text: STR.character.gearHint }),
      );
    } else if (this.tab === 'background') {
      for (const b of BACKGROUNDS) {
        host.append(
          el(
            'div',
            { class: `part-row ${c.background === b.id ? 'sel' : ''}`, onClick: () => this.update((cc) => (cc.background = b.id), true) },
            el('div', { class: 'col' }, el('span', { class: 'name', text: b.name }), el('span', { class: 'muted small', text: b.description }), el('span', { class: 'cost-item ok', text: `${STR.character.bonus}: ${b.bonusText}` })),
          ),
        );
      }
    } else {
      const builtIn = this.presets.filter((p) => p.builtIn);
      const own = this.presets.filter((p) => !p.builtIn);
      const row = (p: CharacterPreset): HTMLElement =>
        el(
          'div',
          { class: 'part-row' },
          el('div', { class: 'col' }, el('span', { class: 'name', text: p.name }), el('span', { class: 'muted small', text: `${BACKGROUNDS.find((b) => b.id === p.config.background)?.name ?? ''} · ${HELMET_SHAPE_LABELS[p.config.helmet.shape]} · ${PATTERN_LABELS[p.config.suit.pattern]}` })),
          el('div', { class: 'row' }, el('button', { class: 'small primary', text: STR.character.load, onClick: () => this.update((cc) => Object.assign(cc, JSON.parse(JSON.stringify(p.config)), { name: cc.name }), true) }), p.builtIn ? null : el('button', { class: 'small', text: STR.character.delete, onClick: () => void this.cb.onDeletePreset(p.id) })),
        );
      host.append(el('h3', { text: STR.character.presetsBuiltIn }));
      for (const p of builtIn) host.append(row(p));
      host.append(el('h3', { text: STR.character.presetsOwn }));
      if (own.length === 0) host.append(el('p', { class: 'muted small', text: '–' }));
      for (const p of own) host.append(row(p));
      const nameInput = el('input', { type: 'text', placeholder: STR.character.presetName, maxlength: 24 });
      host.append(
        el('div', { class: 'row' }, nameInput, el('button', { class: 'small', text: STR.character.savePreset, onClick: () => {
          const name = nameInput.value.trim() || `${this.cfg.name} ${++this.presetCounter}`;
          void this.cb.onSavePreset({ id: `own-${Date.now().toString(36)}`, name, config: JSON.parse(JSON.stringify(this.cfg)) as CharacterConfig });
          nameInput.value = '';
        } })),
      );
    }
  }

  private renderSide(): void {
    clear(this.side);
    const c = this.cfg;
    const name = el('input', { type: 'text', value: c.name, maxlength: 24 });
    name.addEventListener('change', () => this.update((cc) => (cc.name = name.value)));
    const bg = BACKGROUNDS.find((b) => b.id === c.background)!;
    const code = el('input', { type: 'text', value: encodeShareCode(c), readonly: true });
    const importInput = el('input', { type: 'text', placeholder: 'SA2.…' });
    const locks = el('div', { class: 'row wrap small' });
    for (const [key, label] of [['body', STR.character.lockBody], ['suit', STR.character.lockSuit], ['helmet', STR.character.lockHelmet], ['gear', STR.character.lockGear]] as Array<[keyof typeof this.locks, string]>) {
      const cbx = el('input', { type: 'checkbox' });
      cbx.checked = this.locks[key];
      cbx.addEventListener('change', () => (this.locks[key] = cbx.checked));
      locks.append(el('label', { class: 'row small' }, cbx, el('span', { text: label })));
    }
    const turn = el('button', { class: `small ${this.turntable ? 'primary' : ''}`, text: STR.character.turntable, onClick: () => { this.turntable = !this.turntable; this.cb.onTurntable(this.turntable); this.refreshSide(); } });
    this.sideName = el('h2', { text: c.name });
    this.sideGoal = el('div', { class: 'goal', text: `${bg.name} · ${bg.bonusText}` });
    this.codeInput = code;
    this.nameInput = name;
    this.turnBtn = turn;
    this.side.append(
      this.sideName,
      el('label', { class: 'char-row' }, el('span', { text: STR.character.name }), name),
      this.sideGoal,
      el('div', { class: 'row wrap' }, el('button', { class: 'small', text: STR.character.camHelmet, onClick: () => this.cb.onCamera('helmet') }), el('button', { class: 'small', text: STR.character.camBody, onClick: () => this.cb.onCamera('body') }), el('button', { class: 'small', text: STR.character.camBack, onClick: () => this.cb.onCamera('back') }), turn),
      el('h3', { text: STR.character.random }),
      el('div', { class: 'row wrap' }, el('button', { class: 'small', text: STR.character.random, onClick: () => this.update((cc) => Object.assign(cc, randomCharacter(new Random(`char:${randomSeedString(8)}`), cc, this.locks), { name: cc.name, background: cc.background }), true) }), el('span', { class: 'muted small', text: `${STR.character.randomLocked}:` }), locks),
      el('button', { class: 'small', text: STR.character.reset, onClick: () => this.update((cc) => Object.assign(cc, defaultCharacter(), { name: cc.name }), true) }),
      el('h3', { text: STR.character.shareCode }),
      el('div', { class: 'row' }, code, el('button', { class: 'small', text: STR.character.copy, onClick: () => { void navigator.clipboard?.writeText(code.value); showToast(STR.copied); } })),
      el('div', { class: 'row' }, importInput, el('button', { class: 'small', text: STR.character.import, onClick: () => {
        const parsed = decodeShareCode(importInput.value);
        if (!parsed) showToast(STR.character.invalidCode);
        else this.update((cc) => Object.assign(cc, parsed), true);
      } })),
      el('div', { class: 'row wrap' }, el('button', { class: 'small', text: STR.character.exportJson, onClick: () => downloadBlob(new Blob([JSON.stringify(this.cfg, null, 2)], { type: 'application/json' }), `stellar-charakter-${c.name.replace(/\s+/g, '_')}.json`) }), this.jsonImportButton()),
      el('div', { class: 'row wrap char-actions' }, el('button', { class: 'primary', text: this.applyLabel, onClick: () => this.cb.onApply(this.cfg) }), el('button', { text: STR.character.cancel, onClick: () => this.cb.onCancel() })),
    );
  }

  private jsonImportButton(): HTMLElement {
    const file = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      void f.text().then((txt) => {
        try {
          this.update((cc) => Object.assign(cc, sanitizeCharacter(JSON.parse(txt))), true);
        } catch {
          showToast(STR.character.invalidCode);
        }
      });
    });
    return el('span', {}, el('button', { class: 'small', text: STR.character.importJson, onClick: () => file.click() }), file);
  }

  dispose(): void {
    this.root.remove();
  }
}
