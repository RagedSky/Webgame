import type { Object3D } from 'three';

export interface Disposable {
  dispose(): void;
}

/**
 * Sammelt alles, was beim Verlassen einer Szene freigegeben werden muss:
 * Three.js-Ressourcen, DOM-Knoten, Event-Listener, Timer.
 * Verhindert Memory-Leaks beim Planeten-/Szenenwechsel.
 */
export class Disposer implements Disposable {
  private readonly items: Array<() => void> = [];
  private disposed = false;

  /** Registriert ein Objekt mit dispose() (Geometry, Material, Texture, RenderTarget, Composer …). */
  add<T extends Disposable>(item: T): T {
    this.items.push(() => item.dispose());
    return item;
  }

  /** Registriert eine beliebige Aufräum-Funktion. */
  addFn(fn: () => void): void {
    this.items.push(fn);
  }

  /** Entfernt einen DOM-Knoten beim Dispose. */
  addDom(el: Element): void {
    this.items.push(() => el.remove());
  }

  /** Registriert einen Event-Listener und entfernt ihn beim Dispose. */
  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (ev: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (ev: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: (ev: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.items.push(() => target.removeEventListener(type, handler, options));
  }

  /** Gibt rekursiv alle Geometrien/Materialien/Texturen eines Three.js-Teilbaums frei. */
  addObject3D(root: Object3D): void {
    this.items.push(() => disposeObject3D(root));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = this.items.length - 1; i >= 0; i--) {
      try {
        this.items[i]!();
      } catch (err) {
        console.error('Disposer: Fehler beim Aufräumen', err);
      }
    }
    this.items.length = 0;
  }
}

interface MaybeDisposableMaterial {
  dispose?: () => void;
  [key: string]: unknown;
}

/** Gibt Geometrie, Materialien und Texturen eines Teilbaums frei und entfernt ihn vom Elternknoten. */
export function disposeObject3D(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as unknown as { geometry?: Disposable; material?: MaybeDisposableMaterial | MaybeDisposableMaterial[] };
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = m[key] as { isTexture?: boolean; dispose?: () => void } | null;
        if (v && typeof v === 'object' && v.isTexture && typeof v.dispose === 'function') v.dispose();
      }
      m.dispose?.();
    }
  });
  root.removeFromParent();
}
