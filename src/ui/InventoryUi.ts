import { clear, el } from './dom';
import { STR } from './strings';
import type { PlayerState } from '@/game/PlayerState';
import { RECIPES, RECIPE_BY_ID, type ItemId, type Recipe } from '@/game/crafting/recipes';
import { RESOURCES } from '@/gen/universe/catalog';
import { FUEL_ROLE_LABELS } from '@/gen/universe/Fuel';
import type { ResourceId, ResourceKind } from '@/gen/universe/types';
import type { ResourceCost } from '@/game/Inventory';
import { bonusesFor, scaleCost } from '@/game/character/backgrounds';

export interface CraftCallbacks {
  /** Gegenstand fertigen (bezahlt) bzw. Modul zum Platzieren auswählen. */
  onCraft: (recipe: Recipe) => void;
  onUseItem: (item: ItemId) => void;
  onClose: () => void;
}

export const ITEM_LABELS: Record<ItemId, string> = {
  workbench: 'Werkbank',
  shelter: 'Unterkunft',
  charger: 'Ladestation',
  lab: 'Labor',
  oxygen_cell: 'Sauerstoffzelle',
  energy_cell: 'Energiezelle',
  lure: 'Köder',
  lab_upgrade: 'Labor-Upgrade',
  fuel: 'Treibstoff',
  satellite: 'Orbital-Satellit',
  rover: 'Rover',
  deep_probe: 'Tiefseesonde',
  atmo_probe: 'Atmosphärensonde',
};

export const KIND_LABELS: Record<ResourceKind, string> = { metal: 'Metall', crystal: 'Kristall', mineral: 'Mineral', gas: 'Gas', liquid: 'Flüssigkeit', organic: 'Organisch' };

/** Effektive Kosten mit Hintergrund-Bonus (Ingenieur: −20 %). */
export function effectiveCost(cost: ResourceCost, state: PlayerState): ResourceCost {
  return scaleCost(cost, bonusesFor(state.character?.background).costFactor);
}

export function costLabel(rawCost: ResourceCost, state: PlayerState): HTMLElement {
  const cost = effectiveCost(rawCost, state);
  const row = el('span', { class: 'cost' });
  for (const [id, n] of Object.entries(cost) as [ResourceId, number][]) {
    const have = state.inventory.get(id);
    row.append(el('span', { class: `cost-item ${have >= n ? 'ok' : 'missing'}`, text: `${RESOURCES[id].name} ${have}/${n}` }));
  }
  return row;
}

/**
 * Inventar und Fertigung (I): Rohstoffe, Gegenstände, Treibstoff, Ziel; Feldfertigung (von Hand) oder
 * alle Rezepte an der Werkbank. Dasselbe Panel dient als Werkbank-UI (`station = 'workbench'`).
 */
export class InventoryUi {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private open = false;
  private station: 'hand' | 'workbench' = 'hand';
  private unsubscribe: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly state: PlayerState,
    private readonly cb: CraftCallbacks,
    private readonly goalText: () => string,
  ) {
    this.title = el('h2');
    this.body = el('div', { class: 'inv-body' });
    this.root = el('div', { class: 'inv-ui', style: 'display:none' }, el('div', { class: 'panel inv-panel' }, el('div', { class: 'row inv-head' }, this.title, el('button', { class: 'small', text: STR.inventory.close, onClick: () => cb.onClose() })), this.body));
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(station: 'hand' | 'workbench'): void {
    this.station = station;
    this.open = true;
    this.root.style.display = 'flex';
    this.unsubscribe?.();
    this.unsubscribe = this.state.onChange(() => this.render());
    this.render();
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private render(): void {
    if (!this.open) return;
    this.title.textContent = this.station === 'workbench' ? STR.inventory.workbenchTitle : STR.inventory.title;
    clear(this.body);
    const inv = this.state.inventory;
    const res = el('div', { class: 'inv-grid' });
    const list = inv.listResources().sort((a, b) => RESOURCES[a.id].name.localeCompare(RESOURCES[b.id].name, 'de'));
    if (list.length === 0) res.append(el('p', { class: 'muted', text: STR.inventory.empty }));
    for (const { id, amount } of list) {
      const def = RESOURCES[id];
      res.append(el('div', { class: 'inv-item', title: def.description }, el('span', { class: 'name', text: def.name }), el('span', { class: 'num', text: String(amount) }), el('span', { class: 'muted small', text: def.fuelRole ? `${KIND_LABELS[def.kind]} · Treibstoff: ${FUEL_ROLE_LABELS[def.fuelRole]}` : KIND_LABELS[def.kind] })));
    }
    const items = el('div', { class: 'inv-grid' });
    const fuel = inv.getItem('fuel');
    items.append(el('div', { class: 'inv-item fuel' }, el('span', { class: 'name', text: ITEM_LABELS.fuel }), el('span', { class: 'num', text: String(fuel) })));
    for (const { id, amount } of inv.listItems()) {
      if (id === 'fuel') continue;
      const usable = id === 'oxygen_cell' || id === 'energy_cell' || id === 'lure' || id === 'rover' || id === 'deep_probe';
      const orbitOnly = id === 'satellite' || id === 'atmo_probe';
      const buildable = !!RECIPE_BY_ID[id]?.module;
      items.append(
        el(
          'div',
          { class: 'inv-item' },
          el('span', { class: 'name', text: ITEM_LABELS[id] }),
          el('span', { class: 'num', text: String(amount) }),
          usable ? el('button', { class: 'small', text: id === 'lure' ? STR.inventory.placeLure : id === 'rover' ? STR.probe.roverDeploy : id === 'deep_probe' ? STR.probe.deepDeploy : STR.inventory.use, onClick: () => this.cb.onUseItem(id) }) : buildable ? el('button', { class: 'small primary', text: STR.inventory.build, onClick: () => this.cb.onUseItem(id) }) : orbitOnly ? el('span', { class: 'muted small', text: STR.probe.inOrbitOnly }) : null,
        ),
      );
    }
    this.body.append(el('div', { class: 'goal', text: this.goalText() }), el('h3', { text: STR.inventory.resources }), res, el('h3', { text: STR.inventory.items }), items);

    const recipes = RECIPES.filter((r) => this.station === 'workbench' || r.station === 'hand');
    const rec = el('div', { class: 'recipes' });
    for (const r of recipes) {
      const affordable = inv.canAfford(effectiveCost(r.cost, this.state));
      const count = inv.getItem(r.id);
      const maxed = r.max !== undefined && this.state.labLevel >= r.max;
      const needsLab = r.requiresLab && !this.state.hasModule(this.planetIdForLab, 'lab');
      const disabled = !affordable || maxed || !!needsLab;
      rec.append(
        el(
          'div',
          { class: `recipe ${affordable ? '' : 'unaffordable'}` },
          el('div', { class: 'col' }, el('span', { class: 'name', text: `${r.name}${count > 0 && !r.module ? ` (${count})` : ''}` }), el('span', { class: 'muted small', text: r.description }), costLabel(r.cost, this.state)),
          el('button', { class: 'small primary', text: maxed ? STR.inventory.maxed : needsLab ? STR.inventory.needsLab : r.module ? STR.inventory.craftModule : STR.inventory.craft, disabled, onClick: () => this.cb.onCraft(r) }),
        ),
      );
    }
    this.body.append(el('h3', { text: this.station === 'workbench' ? STR.inventory.recipesAll : STR.inventory.recipesHand }), rec);
    if (this.station === 'hand') this.body.append(el('p', { class: 'muted small', text: STR.inventory.workbenchHint }));
  }

  /** Planet für die Labor-Prüfung (Upgrade braucht ein Labor auf diesem Planeten). */
  planetIdForLab = '';

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}
