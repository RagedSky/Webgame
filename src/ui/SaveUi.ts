import { clear, downloadBlob, el } from './dom';
import { STR } from './strings';
import { showToast } from './toast';
import { audio } from '@/audio/AudioManager';
import type { StarSystem } from '@/gen/universe/types';
import type { PlayerState } from '@/game/PlayerState';
import type { ArchiveProgress } from '@/game/progress/ArchiveProgress';
import { SaveManager } from '@/save/SaveManager';
import { exportFilename, formatPlaytime, type SaveBundle, type SaveSummary } from '@/save/SaveBundle';

export interface SaveGame {
  player: PlayerState;
  progress: ArchiveProgress;
  system: StarSystem;
  /** Globale Einstellungen für den Datei-Export. */
  settings: unknown;
}

export interface SaveUiCallbacks {
  onClose: () => void;
  /** Ein Slot oder eine Datei wurde als Live-Stand geschrieben: Spiel mit diesem Seed (neu) starten. */
  onLoaded: (bundle: SaveBundle) => void;
  /** Laufendes Spiel (null im Hauptmenü). */
  getGame: () => SaveGame | null;
}

/** Spielstände: Slots (Speichern/Laden/Löschen), Export als Datei, Import. Nutzbar im Hauptmenü und in der Pause. */
export class SaveUi {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly note: HTMLElement;
  private open = false;
  private manager: SaveManager | null = null;
  private slots: Array<SaveSummary | null> = [];
  private confirm: { slot: number; action: 'load' | 'delete' | 'save' } | null = null;
  private includePhotos = true;
  private busy = false;

  constructor(
    parent: HTMLElement,
    private readonly cb: SaveUiCallbacks,
  ) {
    this.body = el('div', { class: 'inv-body save-body' });
    this.note = el('p', { class: 'muted small' });
    this.root = el('div', { class: 'inv-ui save-ui', style: 'display:none' }, el('div', { class: 'panel inv-panel save-panel' }, el('div', { class: 'row inv-head' }, el('h2', { text: STR.save.title }), el('button', { class: 'small', text: STR.save.close, onClick: () => cb.onClose() })), this.note, this.body));
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  private async ensureManager(): Promise<SaveManager> {
    this.manager ??= await SaveManager.open();
    return this.manager;
  }

  show(): void {
    this.open = true;
    this.confirm = null;
    this.root.style.display = 'flex';
    void this.refresh();
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
  }

  private async refresh(): Promise<void> {
    const m = await this.ensureManager();
    this.slots = await m.listSlots();
    if (this.open) this.render();
  }

  /** Schnellspeichern in Slot 1 (F5). */
  async quicksave(): Promise<boolean> {
    const game = this.cb.getGame();
    if (!game) return false;
    const m = await this.ensureManager();
    await m.saveSlot(1, STR.save.quicksave, game.player, game.progress, game.system);
    showToast(`${STR.save.saved}: ${STR.save.slot} 1 (${STR.save.quicksave})`);
    audio.blip();
    if (this.open) void this.refresh();
    return true;
  }

  private render(): void {
    const game = this.cb.getGame();
    clear(this.body);
    this.note.textContent = game ? STR.save.autosaveNote : `${STR.save.noGame} ${STR.save.overwriteHint}`;
    const list = el('div', { class: 'save-slots' });
    this.slots.forEach((s, i) => list.append(this.slotRow(i + 1, s, game)));
    this.body.append(list);

    const photos = el('input', { type: 'checkbox' });
    photos.checked = this.includePhotos;
    photos.addEventListener('change', () => (this.includePhotos = photos.checked));
    const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f) void this.importFile(f);
      fileInput.value = '';
    });
    this.body.append(
      el('h3', { text: 'Datei' }),
      el(
        'div',
        { class: 'row wrap' },
        el('button', { class: 'small', text: STR.save.export, disabled: !game, onClick: () => void this.exportFile() }),
        el('label', { class: 'small row' }, photos, ` ${STR.save.exportPhotos}`),
        el('button', { class: 'small', text: STR.save.import, onClick: () => fileInput.click() }),
        fileInput,
      ),
      el('p', { class: 'muted small', text: STR.save.overwriteHint }),
    );
  }

  private slotRow(slot: number, s: SaveSummary | null, game: SaveGame | null): HTMLElement {
    const confirmFor = (action: 'load' | 'delete' | 'save'): boolean => this.confirm?.slot === slot && this.confirm.action === action;
    const label = (action: 'load' | 'delete' | 'save', text: string): string => (confirmFor(action) ? STR.save.confirm : text);
    const info = s
      ? el(
          'div',
          { class: 'save-info' },
          el('div', { class: 'save-title', text: `${STR.save.slot} ${slot} · ${s.name}` }),
          el('div', { class: 'muted small', text: `${STR.save.seed} ${s.seed} · ${s.characterName} · ${STR.save.location}: ${s.location}` }),
          el('div', { class: 'muted small', text: `${STR.save.archive} ${s.discovered}/${s.total} (${s.total ? Math.round((100 * s.discovered) / s.total) : 0} %) · ${s.stars} ★ · ${STR.save.playtime} ${formatPlaytime(s.playtime)} · ${new Date(s.savedAt).toLocaleString('de-DE')}` }),
        )
      : el('div', { class: 'save-info' }, el('div', { class: 'save-title', text: `${STR.save.slot} ${slot}` }), el('div', { class: 'muted small', text: STR.save.empty }));
    const buttons = el('div', { class: 'row save-actions' });
    if (game) buttons.append(el('button', { class: `small ${s ? '' : 'primary'}`, text: label('save', STR.save.save), onClick: () => void this.saveTo(slot, s) }));
    if (s) {
      buttons.append(el('button', { class: 'small primary', text: label('load', STR.save.load), onClick: () => void this.loadFrom(slot) }));
      buttons.append(el('button', { class: 'small danger', text: label('delete', STR.save.delete), onClick: () => void this.deleteSlot(slot) }));
    }
    return el('div', { class: `save-slot ${s ? '' : 'empty'}` }, info, buttons);
  }

  private needsConfirm(slot: number, action: 'load' | 'delete' | 'save'): boolean {
    if (this.confirm?.slot === slot && this.confirm.action === action) {
      this.confirm = null;
      return false;
    }
    this.confirm = { slot, action };
    this.render();
    return true;
  }

  private async saveTo(slot: number, existing: SaveSummary | null): Promise<void> {
    const game = this.cb.getGame();
    if (!game || this.busy) return;
    if (existing && this.needsConfirm(slot, 'save')) return;
    this.busy = true;
    try {
      const m = await this.ensureManager();
      const name = existing?.name && existing.seed === game.system.seed ? existing.name : `${STR.save.defaultName} ${slot}`;
      await m.saveSlot(slot, name, game.player, game.progress, game.system);
      showToast(`${STR.save.saved}: ${STR.save.slot} ${slot}`);
      audio.blip();
    } finally {
      this.busy = false;
    }
    await this.refresh();
  }

  private async loadFrom(slot: number): Promise<void> {
    if (this.busy || this.needsConfirm(slot, 'load')) return;
    this.busy = true;
    try {
      const m = await this.ensureManager();
      const bundle = await m.loadSlot(slot);
      if (!bundle) {
        showToast(STR.save.empty);
        return;
      }
      await m.writeLive(bundle);
      showToast(`${STR.save.loaded}: ${STR.save.slot} ${slot} · ${bundle.seed}`);
      audio.success(1);
      this.cb.onLoaded(bundle);
    } catch (err) {
      console.warn('[save] Laden fehlgeschlagen', err);
      showToast(`${STR.save.importError}: ${(err as Error).message}`, 4000);
    } finally {
      this.busy = false;
    }
  }

  private async deleteSlot(slot: number): Promise<void> {
    if (this.busy || this.needsConfirm(slot, 'delete')) return;
    const m = await this.ensureManager();
    await m.deleteSlot(slot);
    showToast(`${STR.save.deleted}: ${slot}`);
    await this.refresh();
  }

  private async exportFile(): Promise<void> {
    const game = this.cb.getGame();
    if (!game || this.busy) return;
    this.busy = true;
    showToast(STR.save.exporting, 60000);
    try {
      const m = await this.ensureManager();
      const { blob, bundle } = await m.exportBundle(game.player, game.progress, game.settings, this.includePhotos, (done, total) => showToast(`${STR.save.exporting} ${done}/${total}`, 60000));
      downloadBlob(blob, exportFilename(bundle.seed, bundle.savedAt));
      showToast(`${STR.save.exported} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
      audio.blip();
    } catch (err) {
      console.warn('[save] Export fehlgeschlagen', err);
      showToast(`${STR.save.importError}: ${(err as Error).message}`, 4000);
    } finally {
      this.busy = false;
    }
  }

  private async importFile(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const m = await this.ensureManager();
      const bundle = await m.importFile(file);
      showToast(`${STR.save.imported}: ${bundle.seed}${bundle.photos ? ` · ${bundle.photos.length} Fotos` : ''}`, 3500);
      audio.success(2);
      this.cb.onLoaded(bundle);
    } catch (err) {
      console.warn('[save] Import fehlgeschlagen', err);
      showToast(`${STR.save.importError}: ${(err as Error).message}`, 4500);
      audio.error();
    } finally {
      this.busy = false;
    }
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}
