import { el } from './dom';

/** Ladebildschirm mit Fortschrittsbalken (Landeanflug). */
export class LoadingOverlay {
  readonly root: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly text: HTMLElement;

  constructor(parent: HTMLElement, title: string, subtitle: string) {
    this.bar = el('div');
    this.text = el('div', { class: 'muted', text: subtitle });
    this.root = el('div', { class: 'loading' }, el('div', { class: 'panel' }, el('h2', { text: title }), this.text, el('div', { class: 'progress' }, this.bar)));
    parent.append(this.root);
  }

  set(fraction: number, text?: string): void {
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    if (text !== undefined) this.text.textContent = text;
  }

  /** Wartet einen Frame, damit der Browser den Fortschritt zeichnet. */
  async nextFrame(): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  dispose(): void {
    this.root.remove();
  }
}
