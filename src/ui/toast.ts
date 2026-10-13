import { el } from './dom';

let current: HTMLElement | null = null;
let timer = 0;

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
