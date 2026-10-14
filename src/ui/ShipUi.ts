import { clear, el } from './dom';
import { STR } from './strings';
import type { PlayerState } from '@/game/PlayerState';
import type { Planet } from '@/gen/universe/types';
import { shipStats, twr, validateDesign } from '@/game/ship/ShipDesign';
import { landingCost, launchCheck, launchCost, rangeAu } from '@/game/ship/travel';

export interface ShipUiCallbacks {
  onRefuel: () => void;
  onUnload: () => void;
  onShipyard: () => void;
  onLaunch: () => void;
  onClose: () => void;
}

/** Schiffspanel am Lander: Werte, Treibstoff, Startklar-Prüfung, Werft und Start. */
export class ShipUi {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private open = false;
  private unsubscribe: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly state: PlayerState,
    private readonly planet: Planet,
    private readonly cb: ShipUiCallbacks,
  ) {
    this.body = el('div', { class: 'inv-body' });
    this.root = el('div', { class: 'inv-ui', style: 'display:none' }, el('div', { class: 'panel inv-panel ship-panel' }, el('div', { class: 'row inv-head' }, el('h2', { text: STR.ship.title }), el('button', { class: 'small', text: STR.ship.close, onClick: () => cb.onClose() })), this.body));
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

  private row(label: string, value: string, cls = ''): HTMLElement {
    return el('div', { class: `stat-row ${cls}` }, el('span', { class: 'muted', text: label }), el('span', { class: 'num', text: value }));
  }

  private render(): void {
    if (!this.open) return;
    clear(this.body);
    const ship = this.state.ship;
    const s = shipStats(ship.design);
    const g = this.planet.gravity;
    const inv = this.state.inventory;
    const errors = validateDesign(ship.design, g, ship.fuel);
    const launch = launchCheck(s, ship.fuel, this.planet);
    const ready = errors.length === 0 && launch.ok;
    const fuelInv = inv.getItem('fuel');
    const lc = s.engineTier ? launchCost(s, ship.fuel, g) : 0;
    const ld = s.engineTier ? landingCost(s, ship.fuel, g) : 0;
    this.body.append(
      el('div', { class: `goal ${ready ? 'ok' : ''}`, text: ready ? `${STR.ship.ready} · ${STR.ship.launchNeeds}: ${lc} + ${ld}` : `${STR.ship.notReady}: ${[...errors, ...launch.reasons].join(' · ')}` }),
      el('h3', { text: STR.ship.stats }),
      el(
        'div',
        { class: 'stat-grid' },
        this.row(STR.ship.mass, `${(s.dryMass + ship.fuel * 0.05).toFixed(1)} t`),
        this.row(STR.ship.thrust, `${s.thrust} kN`),
        this.row(STR.ship.twr, s.engineTier ? twr(s, ship.fuel, g).toFixed(2) : '–', s.engineTier && twr(s, ship.fuel, g) < 1.1 ? 'bad' : ''),
        this.row(STR.ship.fuel, `${ship.fuel} / ${s.maxFuel} (${STR.inventory.title}: ${fuelInv})`),
        this.row(STR.ship.range, `${rangeAu(s, Math.max(0, ship.fuel - lc - ld)).toFixed(2)} AU`),
        this.row(STR.ship.engine, s.engineTier ? `${STR.ship.level} ${s.engineTier}` : STR.ship.none),
        this.row(STR.ship.shield, s.shieldTier ? `${STR.ship.level} ${s.shieldTier}` : STR.ship.none),
        this.row(STR.ship.scanner, s.scannerTier ? `${STR.ship.level} ${s.scannerTier}` : STR.ship.none),
        this.row(STR.ship.cargo, String(s.cargo)),
        this.row(STR.ship.legs, s.legs ? `${s.legs} (bis ${s.legRating.toFixed(1)} g)` : STR.ship.none),
      ),
      el(
        'div',
        { class: 'row wrap' },
        el('button', { class: 'small', text: `${STR.ship.refuel} (+${Math.min(fuelInv, Math.max(0, s.maxFuel - ship.fuel))})`, title: STR.ship.refuelHint, disabled: fuelInv <= 0 || ship.fuel >= s.maxFuel, onClick: () => this.cb.onRefuel() }),
        el('button', { class: 'small', text: STR.ship.unload, disabled: ship.fuel <= 0, onClick: () => this.cb.onUnload() }),
        el('button', { class: 'small', text: STR.editor.title, onClick: () => this.cb.onShipyard() }),
        el('button', { class: 'small primary', text: STR.ship.launch, disabled: !ready, onClick: () => this.cb.onLaunch() }),
      ),
      el('p', { class: 'muted small', text: STR.ship.recharge }),
    );
    if (this.state.blueprints.length) this.body.append(el('p', { class: 'muted small', text: `${STR.ship.blueprint}: ${this.state.blueprints.length}` }));
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}
