import { el } from './dom';
import { STR } from './strings';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onSystemView: () => void;
  onMainMenu: () => void;
}

/** Pausemenü der Planetenoberfläche (öffnet sich bei Esc bzw. Verlust des Pointer-Locks). */
export class PauseMenu {
  readonly root: HTMLElement;
  private open = false;

  constructor(parent: HTMLElement, cb: PauseMenuCallbacks, extraLines: string[] = []) {
    this.root = el(
      'div',
      { class: 'pause-menu', style: 'display:none' },
      el(
        'div',
        { class: 'panel' },
        el('h2', { text: STR.pause.title }),
        el('div', { class: 'menu-buttons' }, el('button', { class: 'primary', text: STR.pause.resume, onClick: cb.onResume }), el('button', { text: STR.pause.systemView, onClick: cb.onSystemView }), el('button', { text: STR.pause.mainMenu, onClick: cb.onMainMenu })),
        el('div', { class: 'hint', html: [STR.pause.controls, ...extraLines].join('<br>') }),
      ),
    );
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
