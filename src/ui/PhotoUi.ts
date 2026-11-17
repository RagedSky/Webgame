import { el, clear } from './dom';
import { STR } from './strings';
import type { PhotoSettings } from '@/world/photo/PhotoMode';
import { FILTER_LABELS } from '@/world/photo/PhotoMode';
import type { ScoredSubject } from '@/world/photo/PhotoMode';
import type { PhotoResult } from '@/game/progress/ArchiveProgress';
import { RARITY_LABELS, type ArchiveEntry } from '@/gen/archive/types';
import { BEHAVIOR_LABELS } from '@/gen/archive/descriptions';

export interface PhotoResultView {
  thumbUrl: string;
  subjects: Array<{ subject: ScoredSubject; result: PhotoResult; name: string }>;
  /** Gerüchte, die neue Entdeckungen ausgelöst haben. */
  rumors: string[];
  onExportPng: () => void;
  /** Auswertung schließen und das Archiv öffnen. */
  onArchive: () => void;
  onClose: () => void;
}

/**
 * Overlay des Foto-Modus: Sucher mit Eckmarken, Drittel-Raster, Einstellungsleiste und Auswertungskarte.
 * Die Karte ist die einzige klickbare Fläche; solange sie offen ist, friert die Szene die Steuerung ein.
 */
export class PhotoUi {
  readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly result: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly targets: HTMLElement;
  private readonly values: HTMLElement[] = [];
  private readonly targetNodes: HTMLElement[] = [];

  constructor(parent: HTMLElement) {
    this.grid = el('div', { class: 'photo-grid' });
    this.bar = el('div', { class: 'photo-bar' });
    this.result = el('div', { class: 'photo-result', style: 'display:none' });
    this.flash = el('div', { class: 'photo-flash' });
    this.targets = el('div', { class: 'photo-targets' });
    const frame = el('div', { class: 'photo-frame' }, el('span', { class: 'corner tl' }), el('span', { class: 'corner tr' }), el('span', { class: 'corner bl' }), el('span', { class: 'corner br' }), el('span', { class: 'reticle' }));
    this.root = el('div', { class: 'photo-ui', style: 'display:none' }, frame, this.grid, this.targets, this.bar, this.flash, this.result);
    parent.append(this.root);
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
    this.hideResult();
  }

  setSettings(s: PhotoSettings, focusRange: number, subjectsInFrame: number): void {
    const grid = s.grid ? 'block' : 'none';
    if (this.grid.style.display !== grid) this.grid.style.display = grid;
    // Leiste einmal aufbauen, danach nur geänderte Werte schreiben (wird mehrmals pro Sekunde aufgerufen)
    if (this.values.length === 0) {
      const item = (label: string, key: string): HTMLElement => {
        const value = el('span', { class: 'v' });
        this.values.push(value);
        return el('div', { class: 'photo-item' }, el('span', { class: 'k', text: key }), el('span', { class: 'l', text: label }), value);
      };
      this.bar.append(item('Zoom', 'Rad'), item('Fokus', ', . · RMT'), item('Blende', 'R'), item('Belichtung', '1 / 2'), item('Filter', 'F'), item('Raster', 'H'), item('Selfie', 'C'), item('Motive', ''), el('div', { class: 'photo-item photo-hint', text: STR.photo.shutterHint }));
    }
    const texts = [
      `${Math.round((55 / s.fov) * 10) / 10}× (${s.fov.toFixed(0)}°)`,
      `${s.focusDistance < 10 ? s.focusDistance.toFixed(1) : s.focusDistance.toFixed(0)} m ±${(focusRange / 2).toFixed(0)}`,
      s.aperture <= 0.15 ? 'f/1.4' : s.aperture <= 0.4 ? 'f/2.8' : s.aperture <= 0.7 ? 'f/5.6' : 'f/11',
      `${s.exposure >= 1 ? '+' : ''}${(Math.log2(s.exposure) * 3).toFixed(1)} EV`,
      FILTER_LABELS[s.filter],
      s.grid ? 'an' : 'aus',
      s.selfie ? 'an' : 'aus',
      String(subjectsInFrame),
    ];
    texts.forEach((text, i) => {
      const node = this.values[i] as HTMLElement;
      if (node.textContent !== text) node.textContent = text;
    });
  }

  /** Markiert erkannte Motive mit Namen (nur Hinweis, Bewertung erfolgt beim Auslösen). Knoten werden wiederverwendet. */
  setTargets(items: Array<{ x: number; y: number; label: string; known: boolean }>): void {
    for (let i = this.targetNodes.length; i < items.length; i++) {
      const node = el('div', { class: 'photo-target' });
      this.targetNodes.push(node);
      this.targets.append(node);
    }
    this.targetNodes.forEach((node, i) => {
      const t = items[i];
      if (!t) {
        if (node.style.display !== 'none') node.style.display = 'none';
        return;
      }
      const cls = `photo-target ${t.known ? 'known' : 'unknown'}`;
      if (node.className !== cls) node.className = cls;
      if (node.textContent !== t.label) node.textContent = t.label;
      node.style.display = 'block';
      node.style.left = `${(((t.x + 1) / 2) * 100).toFixed(1)}%`;
      node.style.top = `${(((1 - t.y) / 2) * 100).toFixed(1)}%`;
    });
  }

  triggerFlash(): void {
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
  }

  showResult(view: PhotoResultView): void {
    clear(this.result);
    const list = el('div', { class: 'photo-subjects' });
    if (view.subjects.length === 0) list.append(el('p', { class: 'photo-empty', text: STR.photo.noSubject }));
    for (const { subject, result, name } of view.subjects) {
      const tags: string[] = [];
      if (result.newDiscovery) tags.push(STR.photo.newEntry);
      else if (result.improved) tags.push(STR.photo.improved);
      if (result.newBehavior && subject.observation.behavior) tags.push(`${STR.photo.behaviorBonus}: ${BEHAVIOR_LABELS[subject.observation.behavior] ?? subject.observation.behavior}`);
      const stars = el('span', { class: 'stars' });
      for (let i = 0; i < 3; i++) stars.append(el('span', { class: i < result.stars ? 'star on' : 'star' }));
      const part = (label: string, value: number): HTMLElement => {
        const fill = el('div');
        fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
        return el('div', { class: 'part' }, el('span', { class: 'k', text: label }), el('div', { class: 'thin-bar' }, fill), el('span', { class: 'v', text: value.toFixed(0) }));
      };
      list.append(
        el(
          'div',
          { class: `photo-subject ${subject.primary ? 'primary' : ''} rarity-${subject.entry.rarity}` },
          el('div', { class: 'head' }, el('span', { class: 'name', text: name }), el('span', { class: 'rarity', text: RARITY_LABELS[subject.entry.rarity] }), stars, el('span', { class: 'total', text: `${subject.score.total}` }), el('span', { class: 'unit', text: STR.photo.points })),
          el('div', { class: 'parts' }, part('Ausschnitt', subject.score.size), part('Komposition', subject.score.composition), part('Fokus', subject.score.focus), part('Licht', subject.score.lighting)),
          tags.length ? el('div', { class: 'tags' }, ...tags.map((t) => el('span', { class: 'tag', text: t }))) : null,
          subject.score.notes.length ? el('div', { class: 'notes', text: subject.score.notes.join(' ') }) : null,
        ),
      );
    }
    this.result.append(
      el('div', { class: 'title' }, el('span', { class: 'diamond' }), el('span', { text: STR.photo.resultTitle })),
      el('div', { class: 'shot' }, el('img', { src: view.thumbUrl, alt: 'Foto' })),
      list,
      el('div', { class: 'rumors' }, ...view.rumors.map((r) => el('div', { class: 'rumor' }, el('span', { class: 'diamond' }), el('span', { text: r })))),
      el('div', { class: 'actions' }, el('button', { class: 'small', text: STR.photo.exportPng, onClick: view.onExportPng }), el('button', { class: 'small', text: STR.photo.toArchive, onClick: view.onArchive }), el('button', { class: 'small primary', text: STR.photo.continue, onClick: view.onClose })),
      el('div', { class: 'hint', text: STR.photo.resultHint }),
    );
    this.result.style.display = 'flex';
    this.root.classList.add('review');
  }

  hideResult(): void {
    this.result.style.display = 'none';
    this.root.classList.remove('review');
  }

  get resultOpen(): boolean {
    return this.result.style.display !== 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}

export function entryLabel(entry: ArchiveEntry, known: boolean, hinted: boolean): string {
  if (known) return entry.name;
  if (hinted) return '? (Spuren bekannt)';
  return '?';
}
