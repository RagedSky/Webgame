/**
 * Kartenraster je Planet (rein): Fog of War in 96×96 Zellen über der quadratischen Karte.
 * Stufe 0 = unbekannt, 1 = erkundet (Spieler, Rover, Sonde), 2 = aus dem Orbit gescannt (Satellit).
 * Serialisierung als Base64, damit der Spielstand klein bleibt.
 */
export const MAP_CELLS = 96;
export type RevealLevel = 1 | 2;

export class MapGrid {
  readonly cells: Uint8Array;
  readonly cellSize: number;

  constructor(
    /** Kantenlänge der Karte in Metern (Koordinaten −size/2 … +size/2). */
    readonly size: number,
    cells?: Uint8Array,
  ) {
    this.cells = cells ?? new Uint8Array(MAP_CELLS * MAP_CELLS);
    this.cellSize = size / MAP_CELLS;
  }

  cellX(x: number): number {
    return Math.max(0, Math.min(MAP_CELLS - 1, Math.floor((x + this.size / 2) / this.cellSize)));
  }

  cellZ(z: number): number {
    return this.cellX(z);
  }

  index(x: number, z: number): number {
    return this.cellZ(z) * MAP_CELLS + this.cellX(x);
  }

  /** Weltkoordinate des Zellmittelpunkts. */
  center(ix: number, iz: number): { x: number; z: number } {
    return { x: -this.size / 2 + (ix + 0.5) * this.cellSize, z: -this.size / 2 + (iz + 0.5) * this.cellSize };
  }

  level(x: number, z: number): number {
    return this.cells[this.index(x, z)] ?? 0;
  }

  levelAt(ix: number, iz: number): number {
    return this.cells[iz * MAP_CELLS + ix] ?? 0;
  }

  /** Kreis um (x, z) aufdecken; nie eine Stufe senken. Liefert die Zahl neu aufgedeckter Zellen. */
  reveal(x: number, z: number, radius: number, level: RevealLevel = 1): number {
    const r = Math.ceil(radius / this.cellSize);
    const cx = this.cellX(x);
    const cz = this.cellZ(z);
    const r2 = (radius / this.cellSize) * (radius / this.cellSize);
    let changed = 0;
    for (let iz = Math.max(0, cz - r); iz <= Math.min(MAP_CELLS - 1, cz + r); iz++) {
      for (let ix = Math.max(0, cx - r); ix <= Math.min(MAP_CELLS - 1, cx + r); ix++) {
        const dx = ix - cx;
        const dz = iz - cz;
        if (dx * dx + dz * dz > r2) continue;
        const i = iz * MAP_CELLS + ix;
        if ((this.cells[i] ?? 0) < level) {
          if ((this.cells[i] ?? 0) === 0) changed++;
          this.cells[i] = level;
        }
      }
    }
    return changed;
  }

  revealAll(level: RevealLevel): void {
    for (let i = 0; i < this.cells.length; i++) if ((this.cells[i] ?? 0) < level) this.cells[i] = level;
  }

  /** Anteil der Zellen mit Stufe ≥ 1 (erkundet oder gescannt). */
  fraction(minLevel = 1): number {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) if ((this.cells[i] ?? 0) >= minLevel) n++;
    return n / this.cells.length;
  }

  toBase64(): string {
    let bin = '';
    for (let i = 0; i < this.cells.length; i++) bin += String.fromCharCode(this.cells[i] ?? 0);
    return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  }

  static fromBase64(size: number, data: string | undefined): MapGrid {
    const grid = new MapGrid(size);
    if (!data) return grid;
    try {
      const bin = typeof atob === 'function' ? atob(data) : Buffer.from(data, 'base64').toString('binary');
      for (let i = 0; i < Math.min(bin.length, grid.cells.length); i++) grid.cells[i] = Math.min(2, bin.charCodeAt(i));
    } catch {
      /* defekte Daten → leere Karte */
    }
    return grid;
  }
}
