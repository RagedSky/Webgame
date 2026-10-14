import { DEFAULT_BINDINGS, type GameAction } from '@/config/keybindings';

/**
 * Input-System: Tasten/Maus → benannte Aktionen. Gamepad-Grundlage (Achsen/Buttons) vorbereitet.
 * `wasPressed` gilt für genau einen Simulationsschritt (wird in `endFrame()` zurückgesetzt).
 */
export class Input {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly keysReleased = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mousePressed = new Set<number>();
  private bindings: Record<GameAction, string[]> = structuredClone(DEFAULT_BINDINGS);

  /** Mausbewegung seit dem letzten endFrame() (Pixel). */
  readonly mouseDelta = { x: 0, y: 0 };
  /** Mausposition in Canvas-Pixeln. */
  readonly mousePos = { x: 0, y: 0 };
  /** Scrollrad seit dem letzten endFrame(). */
  wheelDelta = 0;
  /** Wenn true, werden Tastendrücke ignoriert (z. B. Fokus in einem Textfeld). */
  textInputActive = false;

  private readonly target: HTMLElement;
  private readonly abort = new AbortController();

  constructor(target: HTMLElement) {
    this.target = target;
    const sig = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.isEditableTarget(e.target)) {
          this.textInputActive = true;
          return;
        }
        this.textInputActive = false;
        if (!this.keysDown.has(e.code)) this.keysPressed.add(e.code);
        this.keysDown.add(e.code);
        if (this.shouldPreventDefault(e.code)) e.preventDefault();
      },
      sig,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        this.keysDown.delete(e.code);
        this.keysReleased.add(e.code);
      },
      sig,
    );
    window.addEventListener('blur', () => this.reset(), sig);
    target.addEventListener(
      'mousedown',
      (e) => {
        this.mouseDown.add(e.button);
        this.mousePressed.add(e.button);
      },
      sig,
    );
    window.addEventListener('mouseup', (e) => this.mouseDown.delete(e.button), sig);
    window.addEventListener(
      'mousemove',
      (e) => {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
        const rect = this.target.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
      },
      sig,
    );
    target.addEventListener('wheel', (e) => (this.wheelDelta += Math.sign(e.deltaY)), { ...sig, passive: true });
    target.addEventListener('contextmenu', (e) => e.preventDefault(), sig);
  }

  private isEditableTarget(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  private shouldPreventDefault(code: string): boolean {
    return code === 'Space' || code === 'Tab' || code === 'F1' || code === 'F5' || code.startsWith('Arrow');
  }

  setBindings(bindings: Partial<Record<GameAction, string[]>>): void {
    this.bindings = { ...this.bindings, ...structuredClone(bindings) } as Record<GameAction, string[]>;
  }

  getBindings(): Readonly<Record<GameAction, string[]>> {
    return this.bindings;
  }

  /** Taste (KeyboardEvent.code) aktuell gedrückt? */
  keyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  isDown(action: GameAction): boolean {
    const codes = this.bindings[action];
    for (let i = 0; i < codes.length; i++) if (this.keysDown.has(codes[i] as string)) return true;
    return false;
  }

  wasPressed(action: GameAction): boolean {
    const codes = this.bindings[action];
    for (let i = 0; i < codes.length; i++) if (this.keysPressed.has(codes[i] as string)) return true;
    return false;
  }

  wasReleased(action: GameAction): boolean {
    const codes = this.bindings[action];
    for (let i = 0; i < codes.length; i++) if (this.keysReleased.has(codes[i] as string)) return true;
    return false;
  }

  /** Bewegungsachse -1..1 (z. B. axis('move_left','move_right')). */
  axis(negative: GameAction, positive: GameAction): number {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }

  mouseButtonDown(button: number): boolean {
    return this.mouseDown.has(button);
  }

  mouseButtonPressed(button: number): boolean {
    return this.mousePressed.has(button);
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestPointerLock(): void {
    if (!this.pointerLocked) this.target.requestPointerLock?.();
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** Am Ende jedes Simulationsschritts aufrufen. */
  endFrame(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mousePressed.clear();
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.wheelDelta = 0;
  }

  reset(): void {
    this.keysDown.clear();
    this.mouseDown.clear();
    this.endFrame();
  }

  dispose(): void {
    this.abort.abort();
  }
}
