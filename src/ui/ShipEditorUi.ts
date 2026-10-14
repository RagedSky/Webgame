import { clear, el } from './dom';
import { STR } from './strings';
import { costLabel, effectiveCost } from './InventoryUi';
import type { PlayerState } from '@/game/PlayerState';
import type { ResourceCost } from '@/game/Inventory';
import { PART_DEFS, PART_TYPE_LABELS, type PartDef, type PartType } from '@/game/ship/parts';
import { costDelta, shipStats, twr, validateDesign, type ShipDesign } from '@/game/ship/ShipDesign';
import { isPartAvailable } from '@/game/ship/blueprints';
import { rangeAu } from '@/game/ship/travel';
import { RESOURCES } from '@/gen/universe/catalog';
import type { ResourceId } from '@/gen/universe/types';

export interface EditorUiCallbacks {
  onSelectPart: (partId: string | null) => void;
  onSetHull: (hullId: string) => void;
  onRemoveSelected: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

const ORDER: PartType[] = ['hull', 'cockpit', 'engine', 'tank', 'legs', 'shield', 'scanner', 'cargo'];

/** Werft-Overlay: Teileliste (links), Live-Werte und Kosten (rechts), Hinweiszeile. */
export class ShipEditorUi {
  readonly root: HTMLElement;
  private readonly partsHost: HTMLElement;
  private readonly statsHost: HTMLElement;
  private readonly hint: HTMLElement;
  selectedPart: string | null = null;
  selectedPlaced: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly state: PlayerState,
    private readonly gravity: number,
    private readonly cb: EditorUiCallbacks,
  ) {
    this.partsHost = el('div', { class: 'panel editor-parts' });
    this.statsHost = el('div', { class: 'panel editor-stats' });
    this.hint = el('div', { class: 'panel editor-hint', text: STR.editor.place });
    this.root = el('div', { class: 'editor-ui' }, this.partsHost, this.statsHost, this.hint);
    parent.append(this.root);
  }

  /** Positive Anteile der Kostendifferenz (zu zahlen). */
  static toPay(delta: ResourceCost): ResourceCost {
    const out: ResourceCost = {};
    for (const [id, n] of Object.entries(delta) as [ResourceId, number][]) if (n > 0) out[id] = n;
    return out;
  }

  render(saved: ShipDesign, working: ShipDesign): void {
    const inv = this.state.inventory;
    const delta = effectiveCost(costDelta(saved, working), this.state);
    const pay = ShipEditorUi.toPay(delta);
    const affordable = inv.canAfford(pay);

    // Teileliste
    clear(this.partsHost);
    this.partsHost.append(el('h2', { text: STR.editor.title }), el('p', { class: 'muted small', text: `${STR.inventory.resources}: ${inv.listResources().map((r) => `${RESOURCES[r.id].name} ${r.amount}`).join(' · ') || '–'}` }));
    for (const type of ORDER) {
      const defs = PART_DEFS.filter((p) => p.type === type);
      const group = el('div', { class: 'part-group' }, el('h3', { text: type === 'hull' ? STR.editor.hull : PART_TYPE_LABELS[type] }));
      for (const def of defs) group.append(this.partRow(def, working, pay));
      this.partsHost.append(group);
    }

    // Werte
    clear(this.statsHost);
    const s = shipStats(working);
    const errors = validateDesign(working, this.gravity, s.maxFuel);
    const row = (label: string, value: string, cls = ''): HTMLElement => el('div', { class: `stat-row ${cls}` }, el('span', { class: 'muted', text: label }), el('span', { class: 'num', text: value }));
    this.statsHost.append(
      el('h2', { text: STR.ship.stats }),
      el(
        'div',
        { class: 'stat-grid' },
        row(STR.ship.mass, `${s.dryMass.toFixed(1)} t (+${(s.maxFuel * 0.05).toFixed(1)} t voll)`),
        row(STR.ship.thrust, `${s.thrust} kN`),
        row(STR.ship.twr, s.engineTier ? twr(s, s.maxFuel, this.gravity).toFixed(2) : '–', s.engineTier && twr(s, s.maxFuel, this.gravity) < 1.1 ? 'bad' : ''),
        row(STR.ship.fuel, `${s.maxFuel}`),
        row(STR.ship.range, `${rangeAu(s, s.maxFuel).toFixed(2)} AU`),
        row(STR.ship.engine, s.engineTier ? `${STR.ship.level} ${s.engineTier}` : STR.ship.none),
        row(STR.ship.shield, s.shieldTier ? `${STR.ship.level} ${s.shieldTier}` : STR.ship.none),
        row(STR.ship.scanner, s.scannerTier ? `${STR.ship.level} ${s.scannerTier}` : STR.ship.none),
        row(STR.ship.cargo, String(s.cargo)),
        row(STR.ship.legs, s.legs ? `${s.legs} (bis ${s.legRating.toFixed(1)} g)` : STR.ship.none),
      ),
      el('h3', { text: errors.length ? STR.editor.errors : STR.editor.valid }),
      errors.length ? el('ul', { class: 'hints' }, ...errors.map((e) => el('li', { text: e }))) : el('p', { class: 'muted small', text: '✓' }),
      el('h3', { text: STR.editor.costs }),
    );
    const costs = Object.entries(delta) as [ResourceId, number][];
    if (costs.length === 0) this.statsHost.append(el('p', { class: 'muted small', text: '–' }));
    else {
      const payRow = el('div', { class: 'cost' });
      for (const [id, n] of costs) payRow.append(el('span', { class: `cost-item ${n > 0 ? (inv.get(id) >= n ? 'ok' : 'missing') : 'refund'}`, text: `${RESOURCES[id].name} ${n > 0 ? `−${n}` : `+${-n}`}` }));
      this.statsHost.append(payRow);
    }
    if (this.selectedPlaced) this.statsHost.append(el('div', { class: 'row' }, el('span', { class: 'muted small', text: `${STR.editor.selected}: ${this.selectedPlaced}` }), el('button', { class: 'small', text: STR.editor.remove, onClick: () => this.cb.onRemoveSelected() })));
    this.statsHost.append(
      el(
        'div',
        { class: 'row wrap' },
        el('button', { class: 'small primary', text: STR.editor.apply, disabled: !affordable, title: affordable ? '' : STR.editor.unaffordable, onClick: () => this.cb.onApply() }),
        el('button', { class: 'small', text: STR.editor.discard, onClick: () => this.cb.onDiscard() }),
      ),
      el('p', { class: 'muted small', text: STR.editor.back }),
    );
  }

  private partRow(def: PartDef, working: ShipDesign, pending: ResourceCost): HTMLElement {
    const inv = this.state.inventory;
    const available = isPartAvailable(def.id, this.state.blueprints);
    const projected: ResourceCost = { ...pending };
    for (const [id, n] of Object.entries(effectiveCost(def.cost, this.state)) as [ResourceId, number][]) projected[id] = (projected[id] ?? 0) + n;
    const affordable = inv.canAfford(projected);
    const isHull = def.type === 'hull';
    const current = isHull ? working.hullId === def.id : false;
    const selected = this.selectedPart === def.id;
    const status = !available ? STR.editor.locked : !affordable && !current ? STR.editor.unaffordable : current ? '●' : '';
    const row = el(
      'div',
      { class: `part-row ${selected ? 'sel' : ''} ${available ? '' : 'locked'} ${affordable || current ? '' : 'unaffordable'}`, title: def.description },
      el('div', { class: 'col' }, el('span', { class: 'name', text: `${def.name} ` }, el('span', { class: 'tier-badge', text: `S${def.tier}` })), el('span', { class: 'muted small', text: `${def.mass} t · ${def.description}` }), costLabel(def.cost, this.state)),
      el('span', { class: 'muted small', text: status }),
    );
    if (available) {
      row.addEventListener('click', () => {
        if (isHull) this.cb.onSetHull(def.id);
        else {
          this.selectedPart = selected ? null : def.id;
          this.cb.onSelectPart(this.selectedPart);
        }
      });
    }
    return row;
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  dispose(): void {
    this.root.remove();
  }
}
