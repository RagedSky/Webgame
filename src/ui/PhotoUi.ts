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
  onExportPng: () => void;
  onClose: () => void;
}

/** Overlay des Foto-Modus: Rahmen, Drittel-Raster, Einstellungsleiste, Ergebnis-Karte. */
export class PhotoUi {
  readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly result: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly targets: HTMLElement;

  constructor(parent: HTMLElement) {
    this.grid = el('div', { class: 'photo-grid' });
    this.bar = el('div', { class: 'photo-bar' });
    this.result = el('div', { class: 'photo-result', style: 'display:none' });
    this.flash = el('div', { class: 'photo-flash' });
    this.targets = el('div', { class: 'photo-targets' });
    this.root = el('div', { class: 'photo-ui', style: 'display:none' }, el('div', { class: 'photo-frame' }), this.grid, this.targets, this.bar, this.flash, this.result);
    parent.append(this.root);
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
    this.result.style.display = 'none';
  }

  setSettings(s: PhotoSettings, focusRange: number, subjectsInFrame: number): void {
    this.grid.style.display = s.grid ? 'block' : 'none';
    clear(this.bar);
    const item = (label: string, value: string, key: string): HTMLElement => el('div', { class: 'photo-item' }, el('span', { class: 'k', text: key }), el('span', { class: 'l', text: label }), el('span', { class: 'v', text: value }));
    this.bar.append(
      item('Zoom', `${Math.round((55 / s.fov) * 10) / 10}× (${s.fov.toFixed(0)}°)`, 'Rad'),
      item('Fokus', `${s.focusDistance < 10 ? s.focusDistance.toFixed(1) : s.focusDistance.toFixed(0)} m ±${(focusRange / 2).toFixed(0)}`, ', . · RMT'),
      item('Blende', s.aperture <= 0.15 ? 'f/1.4' : s.aperture <= 0.4 ? 'f/2.8' : s.aperture <= 0.7 ? 'f/5.6' : 'f/11', 'R'),
      item('Belichtung', `${s.exposure >= 1 ? '+' : ''}${(Math.log2(s.exposure) * 3).toFixed(1)} EV`, '1 / 2'),
      item('Filter', FILTER_LABELS[s.filter], 'F'),
      item('Raster', s.grid ? 'an' : 'aus', 'H'),
      item('Selfie', s.selfie ? 'an' : 'aus', 'C'),
      item('Motive', String(subjectsInFrame), ''),
      el('div', { class: 'photo-item photo-hint', text: STR.photo.shutterHint }),
    );
  }

  /** Markiert erkannte Motive mit Namen (nur Hinweis, Bewertung erfolgt beim Auslösen). */
  setTargets(items: Array<{ x: number; y: number; label: string; known: boolean }>): void {
    clear(this.targets);
    for (const t of items) {
      const node = el('div', { class: `photo-target ${t.known ? 'known' : 'unknown'}`, text: t.label });
      node.style.left = `${((t.x + 1) / 2) * 100}%`;
      node.style.top = `${((1 - t.y) / 2) * 100}%`;
      this.targets.append(node);
    }
  }

  triggerFlash(): void {
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
  }

  showResult(view: PhotoResultView): void {
    clear(this.result);
    const list = el('div', { class: 'photo-subjects' });
    if (view.subjects.length === 0) list.append(el('p', { class: 'muted', text: STR.photo.noSubject }));
    for (const { subject, result, name } of view.subjects) {
      const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
      const tags: string[] = [];
      if (result.newDiscovery) tags.push(STR.photo.newEntry);
      else if (result.improved) tags.push(STR.photo.improved);
      if (result.newBehavior && subject.observation.behavior) tags.push(`${STR.photo.behaviorBonus}: ${BEHAVIOR_LABELS[subject.observation.behavior] ?? subject.observation.behavior}`);
      list.append(
        el(
          'div',
          { class: `photo-subject ${subject.primary ? 'primary' : ''}` },
          el('div', { class: 'row' }, el('span', { class: 'name', text: name }), el('span', { class: `badge rarity-${subject.entry.rarity}`, text: RARITY_LABELS[subject.entry.rarity] }), el('span', { class: 'stars', text: stars })),
          el('div', { class: 'meta', text: `${subject.score.total} Punkte · Ausschnitt ${subject.score.size.toFixed(0)} · Komposition ${subject.score.composition.toFixed(0)} · Fokus ${subject.score.focus.toFixed(0)} · Licht ${subject.score.lighting.toFixed(0)}` }),
          tags.length ? el('div', { class: 'tags', text: tags.join(' · ') }) : null,
          subject.score.notes.length ? el('div', { class: 'notes', text: subject.score.notes.join(' ') }) : null,
        ),
      );
    }
    this.result.append(
      el('img', { src: view.thumbUrl, alt: 'Foto' }),
      list,
      el('div', { class: 'row' }, el('button', { class: 'small', text: STR.photo.exportPng, onClick: view.onExportPng }), el('button', { class: 'small primary', text: STR.photo.continue, onClick: view.onClose })),
    );
    this.result.style.display = 'flex';
  }

  hideResult(): void {
    this.result.style.display = 'none';
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
