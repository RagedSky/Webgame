/**
 * Kollisionswelt für feste Objekte (rein, ohne Three.js): Bäume, Felsen, Rohstoffknoten, Fundstücke, Basis-Module,
 * Schiff und Rover sind stehende Zylinder (Kreis in der Ebene plus Oberkante). Systeme melden ihre Zylinder gruppenweise
 * an (z. B. je Vegetationszelle) und wieder ab; ein Raster hält die Abfrage klein. `resolve` schiebt einen Läufer aus
 * allen Zylindern heraus, in denen er steht – dadurch gleitet er an Hindernissen entlang, statt hängen zu bleiben.
 */
export interface Collider {
  x: number;
  z: number;
  /** Radius in Metern. */
  r: number;
  /** Oberkante in Welthöhe: wer darüber ist (Sprung, Flug), wird nicht geschoben. */
  top: number;
}

const CELL = 8;
/** Größter Läuferradius, der noch korrekt erfasst wird (Zylinder werden um diesen Rand in Nachbarzellen eingetragen). */
const MARGIN = 0.8;
/** So weit darf man über die Oberkante ragen, um noch als „darüber“ zu gelten (niedrige Kanten übersteigt man). */
const STEP = 0.3;

const cellKey = (i: number, j: number): number => (i + 32768) * 65536 + (j + 32768);

export class CollisionWorld {
  private readonly groups = new Map<string, Collider[]>();
  private readonly grid = new Map<number, Collider[]>();

  get size(): number {
    let n = 0;
    for (const g of this.groups.values()) n += g.length;
    return n;
  }

  private forCells(c: Collider, fn: (key: number) => void): void {
    const reach = c.r + MARGIN;
    const i0 = Math.floor((c.x - reach) / CELL);
    const i1 = Math.floor((c.x + reach) / CELL);
    const j0 = Math.floor((c.z - reach) / CELL);
    const j1 = Math.floor((c.z + reach) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(cellKey(i, j));
  }

  /** Ersetzt die Zylinder einer Gruppe (leere Liste = Gruppe entfernen). */
  set(group: string, colliders: Collider[]): void {
    this.remove(group);
    if (colliders.length === 0) return;
    this.groups.set(group, colliders);
    for (const c of colliders) {
      this.forCells(c, (key) => {
        const list = this.grid.get(key);
        if (list) list.push(c);
        else this.grid.set(key, [c]);
      });
    }
  }

  remove(group: string): void {
    const old = this.groups.get(group);
    if (!old) return;
    this.groups.delete(group);
    for (const c of old) {
      this.forCells(c, (key) => {
        const list = this.grid.get(key);
        if (!list) return;
        const at = list.indexOf(c);
        if (at >= 0) list.splice(at, 1);
        if (list.length === 0) this.grid.delete(key);
      });
    }
  }

  clear(): void {
    this.groups.clear();
    this.grid.clear();
  }

  /**
   * Schiebt `pos` (Fußpunkt) aus allen Zylindern heraus. Verändert nur x und z; gibt zurück, ob etwas berührt wurde.
   * Zwei Durchgänge fangen Ecken zwischen zwei Hindernissen ab.
   */
  resolve(pos: { x: number; y: number; z: number }, radius: number): boolean {
    let touched = false;
    for (let pass = 0; pass < 2; pass++) {
      const list = this.grid.get(cellKey(Math.floor(pos.x / CELL), Math.floor(pos.z / CELL)));
      if (!list) return touched;
      let moved = false;
      for (let k = 0; k < list.length; k++) {
        const c = list[k] as Collider;
        if (pos.y >= c.top - STEP) continue;
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-4) {
          pos.x = c.x + min;
        } else {
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
        moved = true;
        touched = true;
      }
      if (!moved) break;
    }
    return touched;
  }

  /** Liegt der Punkt in einem Zylinder (z. B. um Bauplätze zu prüfen)? */
  blocked(x: number, z: number, radius: number): boolean {
    const list = this.grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const c of list) {
      const min = c.r + radius;
      if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < min * min) return true;
    }
    return false;
  }
}
