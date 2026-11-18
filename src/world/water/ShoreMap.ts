import { DataTexture, LinearFilter, RedFormat, RepeatWrapping, UnsignedByteType } from 'three';

/** Kantenlänge der Karte in Texeln und Meter je Texel: ein Fenster von 512 m um die Kamera. */
export const SHORE_CELLS = 256;
export const SHORE_RES = 2;
/** Gespeicherter Tiefenbereich in Metern: −2 (Land knapp über dem Wasser) bis +16 (tief). */
export const SHORE_MIN = -2;
export const SHORE_SPAN = 18;

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Wassertiefe rund um die Kamera als Textur. Der Wasser-Shader liest daraus, wo das Ufer liegt: flaches Wasser ist
 * klar und hell, tiefes dunkel; am Ufer liegt Schaum und die Wellen laufen aus.
 *
 * Die Karte ist ringförmig adressiert (Weltzelle modulo Kartengröße). Bewegt sich die Kamera, werden nur die neu
 * ins Fenster gekommenen Spalten und Zeilen berechnet, nicht die ganze Karte.
 */
export class ShoreMap {
  readonly texture: DataTexture;
  /** Halbe Fensterbreite in Metern. */
  readonly half = (SHORE_CELLS * SHORE_RES) / 2;
  /** Mittelpunkt des gültigen Fensters (Welt-x, Welt-z). */
  centerX = 0;
  centerZ = 0;
  private readonly data = new Uint8Array(SHORE_CELLS * SHORE_CELLS);
  private readonly colI = new Int32Array(SHORE_CELLS);
  private readonly rowJ = new Int32Array(SHORE_CELLS);
  private readonly needI = new Int32Array(SHORE_CELLS);
  private readonly needJ = new Int32Array(SHORE_CELLS);
  private filled = false;

  constructor(
    private readonly heightAt: (x: number, z: number) => number,
    private readonly seaLevel: number,
  ) {
    this.texture = new DataTexture(this.data, SHORE_CELLS, SHORE_CELLS, RedFormat, UnsignedByteType);
    this.texture.wrapS = RepeatWrapping;
    this.texture.wrapT = RepeatWrapping;
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
  }

  private write(ti: number, tj: number, i: number, j: number): void {
    const depth = this.seaLevel - this.heightAt((i + 0.5) * SHORE_RES, (j + 0.5) * SHORE_RES);
    this.data[tj * SHORE_CELLS + ti] = Math.round(Math.min(1, Math.max(0, (depth - SHORE_MIN) / SHORE_SPAN)) * 255);
  }

  /** Tiefe in Metern, wie sie im Texel der Weltzelle steht (für Tests). */
  depthAtCell(i: number, j: number): number {
    return ((this.data[mod(j, SHORE_CELLS) * SHORE_CELLS + mod(i, SHORE_CELLS)] as number) / 255) * SHORE_SPAN + SHORE_MIN;
  }

  /** Fenster auf die Kamera ausrichten; liefert die Zahl neu berechneter Texel. */
  update(x: number, z: number): number {
    const n = SHORE_CELLS;
    const i0 = Math.floor(x / SHORE_RES) - n / 2;
    const j0 = Math.floor(z / SHORE_RES) - n / 2;
    this.centerX = (i0 + n / 2) * SHORE_RES;
    this.centerZ = (j0 + n / 2) * SHORE_RES;
    let cols = 0;
    let rows = 0;
    for (let t = 0; t < n; t++) {
      this.needI[t] = i0 + mod(t - i0, n);
      this.needJ[t] = j0 + mod(t - j0, n);
      if (!this.filled || this.needI[t] !== this.colI[t]) cols++;
      if (!this.filled || this.needJ[t] !== this.rowJ[t]) rows++;
    }
    if (cols === 0 && rows === 0) return 0;
    let written = 0;
    for (let ti = 0; ti < n; ti++) {
      const colNew = !this.filled || this.needI[ti] !== this.colI[ti];
      for (let tj = 0; tj < n; tj++) {
        if (!colNew && this.needJ[tj] === this.rowJ[tj]) continue;
        this.write(ti, tj, this.needI[ti] as number, this.needJ[tj] as number);
        written++;
      }
    }
    this.colI.set(this.needI);
    this.rowJ.set(this.needJ);
    this.filled = true;
    this.texture.needsUpdate = true;
    return written;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
