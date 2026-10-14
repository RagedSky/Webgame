import { el } from './dom';

let current: HTMLElement | null = null;
let timer = 0;

let action: HTMLElement | null = null;

/** Einblendung mit Buttons (z. B. adaptive Qualität); bleibt bis zum Klick oder Timeout. */
export function showActionToast(message: string, actions: Array<{ label: string; onClick: () => void }>, durationMs = 15000): void {
  const root = document.getElementById('ui-root');
  if (!root) return;
  action?.remove();
  const node = el('div', { class: 'toast action' }, el('span', { text: message }));
  for (const a of actions) node.append(el('button', { class: 'small', text: a.label, onClick: () => { a.onClick(); node.remove(); if (action === node) action = null; } }));
  root.append(node);
  action = node;
  window.setTimeout(() => {
    if (action === node) {
      node.remove();
      action = null;
    }
  }, durationMs);
}

/** Kurze Einblendung am unteren Rand (für Hinweise, Kopiert!, Fehler). */
export function showToast(message: string, durationMs = 2200): void {
  const root = document.getElementById('ui-root');
  if (!root) return;
  current?.remove();
  current = el('div', { class: 'toast', text: message });
  root.append(current);
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    current?.remove();
    current = null;
  }, durationMs);
}
