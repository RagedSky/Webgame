/**
 * Tutorial (rein, serialisierbar): eine Folge sanfter Schritte für die ersten Minuten auf dem Startplaneten.
 * Die Szene meldet Ereignisse (`notify`), das Tutorial rückt vor; es ist jederzeit überspringbar und
 * wird im Spielerzustand gespeichert. Texte liegen in `src/ui/strings.ts`.
 */
export type TutorialEvent =
  | 'look'
  | 'move'
  | 'sprint_or_jump'
  | 'photo_open'
  | 'photo_taken'
  | 'archive_open'
  | 'sample'
  | 'harvest'
  | 'inventory_open'
  | 'build'
  | 'map_open'
  | 'ship_open';

export interface TutorialStep {
  id: string;
  /** Ereignis, das den Schritt abschließt. */
  done: TutorialEvent;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'look', done: 'look' },
  { id: 'move', done: 'move' },
  { id: 'sprint', done: 'sprint_or_jump' },
  { id: 'photo', done: 'photo_open' },
  { id: 'shoot', done: 'photo_taken' },
  { id: 'archive', done: 'archive_open' },
  { id: 'sample', done: 'sample' },
  { id: 'harvest', done: 'harvest' },
  { id: 'inventory', done: 'inventory_open' },
  { id: 'build', done: 'build' },
  { id: 'map', done: 'map_open' },
  { id: 'ship', done: 'ship_open' },
];

export interface TutorialSnapshot {
  step: number;
  done: boolean;
}

/** Sekunden, die ein abgeschlossener Schritt als „erledigt“ stehen bleibt, bevor der nächste erscheint. */
export const TUTORIAL_ADVANCE_DELAY = 1.6;

export class Tutorial {
  private index: number;
  private finished: boolean;
  /** Verzögerung bis zum nächsten Schritt (Sekunden, 0 = keiner steht aus). */
  private pending = 0;
  /** Mausbewegung/Strecke, die der Spieler bisher gesammelt hat (für 'look'/'move'). */
  private lookAccum = 0;
  private moveAccum = 0;

  constructor(snapshot?: TutorialSnapshot | null) {
    this.index = Math.max(0, Math.min(TUTORIAL_STEPS.length, snapshot?.step ?? 0));
    this.finished = snapshot?.done ?? false;
    if (this.index >= TUTORIAL_STEPS.length) this.finished = true;
  }

  get active(): boolean {
    return !this.finished;
  }

  get stepIndex(): number {
    return this.index;
  }

  get total(): number {
    return TUTORIAL_STEPS.length;
  }

  /** Aktueller Schritt (null, wenn fertig/übersprungen). */
  get current(): TutorialStep | null {
    return this.finished ? null : (TUTORIAL_STEPS[this.index] ?? null);
  }

  /** Schritt gerade abgeschlossen, nächster erscheint nach kurzer Pause. */
  get justCompleted(): boolean {
    return this.pending > 0;
  }

  /** Mausbewegung in Pixeln (für den Umsehen-Schritt). */
  look(pixels: number): boolean {
    this.lookAccum += Math.abs(pixels);
    return this.lookAccum >= 400 ? this.notify('look') : false;
  }

  /** Zurückgelegte Strecke in Metern (für den Bewegen-Schritt). */
  move(meters: number): boolean {
    this.moveAccum += Math.abs(meters);
    return this.moveAccum >= 8 ? this.notify('move') : false;
  }

  /** Ereignis melden; true, wenn dadurch der aktuelle Schritt abgeschlossen wurde. */
  notify(event: TutorialEvent): boolean {
    const step = this.current;
    if (!step || this.pending > 0) return false;
    if (step.done !== event) return false;
    this.pending = TUTORIAL_ADVANCE_DELAY;
    return true;
  }

  /** Zeit fortschreiben; liefert true, wenn ein neuer Schritt sichtbar wurde (oder das Tutorial endete). */
  update(dt: number): boolean {
    if (this.pending <= 0) return false;
    this.pending -= dt;
    if (this.pending > 0) return false;
    this.pending = 0;
    this.index++;
    if (this.index >= TUTORIAL_STEPS.length) this.finished = true;
    return true;
  }

  skip(): void {
    this.finished = true;
    this.pending = 0;
    this.index = TUTORIAL_STEPS.length;
  }

  /** Tutorial neu starten (z. B. aus den Einstellungen). */
  restart(): void {
    this.finished = false;
    this.pending = 0;
    this.index = 0;
    this.lookAccum = 0;
    this.moveAccum = 0;
  }

  toJSON(): TutorialSnapshot {
    return { step: this.index, done: this.finished };
  }
}
