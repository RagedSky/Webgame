import { clear, el } from './dom';
import { STR } from './strings';
import type { PlayerState } from '@/game/PlayerState';
import { RESOURCES } from '@/gen/universe/catalog';
import type { FuelFormula, ResourceId } from '@/gen/universe/types';
import { analyzeMix, FUEL_ROLE_LABELS, type FuelMix } from '@/gen/universe/Fuel';
import { analysisCost, analysisReport, batchCost, synthesize } from '@/game/crafting/fuel';
import { LAUNCH_FUEL_TARGET, labEfficiency } from '@/game/crafting/recipes';
import { costLabel } from './InventoryUi';

export interface LabCallbacks {
  onClose: () => void;
  onFuelProduced: (amount: number) => void;
}

interface Note {
  mix: string;
  purity: number;
  energy: number;
  stability: number;
}

/**
 * Labor: Treibstoff-Synthese als Forschungsaufgabe. Bis zu 3 Rohstoffe mit Anteilen (Summe 10),
 * Testmischung analysieren (kostet je 1), Chargen synthetisieren. Notizen der letzten Analysen.
 */
export class LabUi {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private open = false;
  private slots: Array<{ id: ResourceId | ''; parts: number }> = [
    { id: '', parts: 5 },
    { id: '', parts: 5 },
    { id: '', parts: 0 },
  ];
  private batches = 1;
  private readonly notes: Note[] = [];
  private lastReport: string[] = [];
  private lastAnalysis: ReturnType<typeof analyzeMix> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly state: PlayerState,
    private readonly formula: FuelFormula,
    private readonly cb: LabCallbacks,
  ) {
    this.body = el('div', { class: 'inv-body' });
    this.root = el('div', { class: 'inv-ui', style: 'display:none' }, el('div', { class: 'panel inv-panel lab-panel' }, el('div', { class: 'row inv-head' }, el('h2', { text: STR.lab.title }), el('button', { class: 'small', text: STR.inventory.close, onClick: () => cb.onClose() })), this.body));
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
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

  private candidates(): ResourceId[] {
    return this.state.inventory
      .listResources()
      .map((r) => r.id)
      .filter((id) => RESOURCES[id].fuelRole !== undefined)
      .sort((a, b) => RESOURCES[a].name.localeCompare(RESOURCES[b].name, 'de'));
  }

  private mix(): FuelMix {
    const parts: FuelMix['parts'] = {};
    for (const s of this.slots) if (s.id && s.parts > 0) parts[s.id] = (parts[s.id] ?? 0) + s.parts;
    return { parts };
  }

  private totalParts(): number {
    return this.slots.reduce((a, s) => a + (s.id ? s.parts : 0), 0);
  }

  private mixLabel(): string {
    return this.slots
      .filter((s) => s.id && s.parts > 0)
      .map((s) => `${RESOURCES[s.id as ResourceId].name} ${s.parts}`)
      .join(' · ');
  }

  private analyze(): void {
    const mix = this.mix();
    if (this.totalParts() !== 10) return;
    const cost = analysisCost(mix);
    if (!this.state.inventory.pay(cost)) return;
    const a = analyzeMix(this.formula, mix);
    this.lastAnalysis = a;
    this.lastReport = analysisReport(this.formula, mix, a, this.state.labLevel);
    this.notes.unshift({ mix: this.mixLabel(), purity: a.purity, energy: a.energyDensity, stability: a.stability });
    if (this.notes.length > 6) this.notes.pop();
    this.render();
  }

  private synth(): void {
    const mix = this.mix();
    if (this.totalParts() !== 10) return;
    const cost = batchCost(mix, this.batches);
    if (!this.state.inventory.pay(cost)) return;
    const r = synthesize(this.formula, mix, this.batches, this.state.labLevel);
    this.lastAnalysis = r.analysis;
    this.lastReport = r.stable ? [`${STR.lab.produced} ${r.fuelProduced}`] : [STR.lab.unstable];
    if (r.stable) {
      this.state.inventory.addItem('fuel', r.fuelProduced);
      this.cb.onFuelProduced(r.fuelProduced);
    }
    this.render();
  }

  private bar(label: string, v: number): HTMLElement {
    const fill = el('div');
    fill.style.width = `${Math.round(v * 100)}%`;
    fill.style.background = v >= 0.9 ? 'var(--ok)' : v >= 0.6 ? 'var(--accent-2)' : 'var(--danger)';
    return el('div', { class: 'archive-progress' }, el('span', { text: label }), el('div', { class: 'progress' }, fill), el('span', { class: 'num', text: `${Math.round(v * 100)} %` }));
  }

  private render(): void {
    if (!this.open) return;
    clear(this.body);
    const inv = this.state.inventory;
    const fuel = inv.getItem('fuel');
    const level = this.state.labLevel;
    this.body.append(
      el('div', { class: 'goal', text: `${STR.lab.fuel}: ${fuel} / ${LAUNCH_FUEL_TARGET} · ${STR.lab.level} ${level + 1} (${STR.lab.yield} ×${labEfficiency(level).toFixed(1)}) · ${this.formula.name}` }),
      el('p', { class: 'muted small', text: STR.lab.help }),
    );
    const cands = this.candidates();
    const slotsHost = el('div', { class: 'lab-slots' });
    this.slots.forEach((slot, i) => {
      const sel = el('select');
      sel.append(el('option', { value: '', text: '–' }));
      for (const id of cands) sel.append(el('option', { value: id, text: `${RESOURCES[id].name} (${inv.get(id)}) · ${FUEL_ROLE_LABELS[RESOURCES[id].fuelRole as keyof typeof FUEL_ROLE_LABELS]}` }));
      sel.value = slot.id;
      sel.addEventListener('change', () => {
        slot.id = sel.value as ResourceId | '';
        this.render();
      });
      const range = el('input', { type: 'range', min: '0', max: '10', step: '1', value: String(slot.parts) });
      const num = el('span', { class: 'num', text: String(slot.parts) });
      range.addEventListener('input', () => {
        slot.parts = Number(range.value);
        num.textContent = range.value;
        total.textContent = `${STR.lab.total}: ${this.totalParts()} / 10`;
        total.classList.toggle('bad', this.totalParts() !== 10);
      });
      slotsHost.append(el('div', { class: 'lab-slot' }, el('span', { class: 'muted small', text: `${STR.lab.slot} ${i + 1}` }), sel, range, num));
    });
    const total = el('div', { class: `lab-total ${this.totalParts() !== 10 ? 'bad' : ''}`, text: `${STR.lab.total}: ${this.totalParts()} / 10` });
    this.body.append(slotsHost, total);

    const mix = this.mix();
    const canTest = this.totalParts() === 10 && inv.canAfford(analysisCost(mix));
    const batchSel = el('select');
    for (const b of [1, 2, 5]) batchSel.append(el('option', { value: String(b), text: `${b}× (${b * 10} Einheiten)` }));
    batchSel.value = String(this.batches);
    batchSel.addEventListener('change', () => {
      this.batches = Number(batchSel.value);
      this.render();
    });
    const canSynth = this.totalParts() === 10 && inv.canAfford(batchCost(mix, this.batches));
    this.body.append(
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'small', text: STR.lab.analyze, disabled: !canTest, onClick: () => this.analyze() }),
        el('span', { class: 'muted small', text: STR.lab.analyzeCost }),
        batchSel,
        el('button', { class: 'small primary', text: STR.lab.synthesize, disabled: !canSynth, onClick: () => this.synth() }),
      ),
      this.totalParts() === 10 ? el('div', { class: 'small' }, costLabel(batchCost(mix, this.batches), this.state)) : el('div'),
    );
    if (this.lastAnalysis) {
      const a = this.lastAnalysis;
      this.body.append(el('h3', { text: STR.lab.result }), this.bar(STR.lab.purity, a.purity), this.bar(STR.lab.energy, a.energyDensity), this.bar(STR.lab.stability, a.stability), this.bar(STR.lab.quality, a.quality));
      if (this.lastReport.length) this.body.append(el('ul', { class: 'hints' }, ...this.lastReport.map((t) => el('li', { text: t }))));
      else if (level === 0) this.body.append(el('p', { class: 'muted small', text: STR.lab.upgradeHint }));
    }
    if (this.notes.length) {
      const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: STR.lab.notes }), el('th', { class: 'num', text: 'R' }), el('th', { class: 'num', text: 'E' }), el('th', { class: 'num', text: 'S' }))));
      const tb = el('tbody');
      for (const n of this.notes) tb.append(el('tr', {}, el('td', { text: n.mix }), el('td', { class: 'num', text: `${Math.round(n.purity * 100)}` }), el('td', { class: 'num', text: `${Math.round(n.energy * 100)}` }), el('td', { class: 'num', text: `${Math.round(n.stability * 100)}` })));
      table.append(tb);
      this.body.append(table);
    }
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}
