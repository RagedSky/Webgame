import { clear, el } from './dom';
import { STR } from './strings';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet } from '@/gen/universe/types';
import type { ArchiveEntry } from '@/gen/archive/types';
import { MAP_CELLS, type MapGrid } from '@/game/map/MapGrid';
import { catalogGaps } from '@/game/map/hotspots';
import type { MapMarker } from '@/game/PlayerState';
import type { ResourceNode } from '@/gen/terrain/ResourceNodes';
import { RESOURCES } from '@/gen/universe/catalog';
import { RESOURCE_COLORS } from '@/world/resources/ResourceNodeManager';
import type { ModuleType } from '@/game/crafting/recipes';

export interface MapLayers {
  biome: boolean;
  ore: boolean;
  life: boolean;
  markers: boolean;
}

export interface MapDynamic {
  player: { x: number; z: number; yaw: number };
  ship: { x: number; z: number } | null;
  modules: Array<{ x: number; z: number; type: ModuleType }>;
  rover: { x: number; z: number } | null;
  deepProbes: Array<{ x: number; z: number }>;
  respawn: { x: number; z: number } | null;
}

export interface MapSources {
  model: TerrainModel;
  planet: Planet;
  grid: MapGrid;
  entries: ArchiveEntry[];
  isDiscovered: (id: string) => boolean;
  satelliteTier: () => number;
  nodes: () => ResourceNode[];
  dynamic: () => MapDynamic;
  markers: MapMarker[];
  onMarkersChanged: () => void;
}

const RES = 160;
const SIZE_PX = 640;

/**
 * Planetenkarte (Canvas): Höhen- und Biomlayer aus dem Terrain-Modell, Fog of War aus dem Kartenraster,
 * Rohstoffknoten, Lebenszeichen (Katalog-Lücken je Biom), Positionen und Marker. Layer je nach Satelliten-Stufe.
 */
export class MapUi {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly side: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  private heightImg: HTMLCanvasElement | null = null;
  private biomeImg: HTMLCanvasElement | null = null;
  private readonly maskCanvas = document.createElement('canvas');
  private readonly fogCanvas = document.createElement('canvas');
  private readonly compose = document.createElement('canvas');
  private cellBiome: Uint8Array | null = null;
  private open = false;
  readonly layers: MapLayers = { biome: true, ore: true, life: true, markers: true };

  constructor(
    parent: HTMLElement,
    private readonly src: MapSources,
    cb: { onClose: () => void },
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE_PX;
    this.canvas.height = SIZE_PX;
    this.canvas.className = 'map-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.maskCanvas.width = this.maskCanvas.height = MAP_CELLS;
    this.fogCanvas.width = this.fogCanvas.height = MAP_CELLS;
    this.compose.width = this.compose.height = SIZE_PX;
    this.side = el('div', { class: 'map-side' });
    this.root = el(
      'div',
      { class: 'inv-ui map-ui', style: 'display:none' },
      el('div', { class: 'panel map-panel' }, el('div', { class: 'row inv-head' }, el('h2', { text: `${STR.map.title} – ${src.planet.name}` }), el('button', { class: 'small', text: STR.map.close, onClick: () => cb.onClose() })), el('div', { class: 'map-body' }, this.canvas, this.side)),
    );
    this.canvas.addEventListener('click', (e) => this.click(e));
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.root.style.display = 'flex';
    this.ensureImages();
    this.redraw();
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  private worldToPx(x: number, z: number): [number, number] {
    const s = this.src.model.size;
    return [((x + s / 2) / s) * SIZE_PX, ((z + s / 2) / s) * SIZE_PX];
  }

  private pxToWorld(px: number, py: number): [number, number] {
    const s = this.src.model.size;
    return [(px / SIZE_PX) * s - s / 2, (py / SIZE_PX) * s - s / 2];
  }

  private ensureImages(): void {
    if (this.heightImg) return;
    const m = this.src.model;
    const h = document.createElement('canvas');
    const b = document.createElement('canvas');
    h.width = h.height = b.width = b.height = RES;
    const hc = h.getContext('2d')!;
    const bc = b.getContext('2d')!;
    const hd = hc.createImageData(RES, RES);
    const bd = bc.createImageData(RES, RES);
    const palette = m.biomes.map((bi) => {
      const c = bi.palette.ground.replace('#', '');
      return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)] as [number, number, number];
    });
    const sample = { height: 0, biome: 0, biome2: 0, blend: 0, detail: 0, altitude: 0 };
    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const x = ((px + 0.5) / RES) * m.size - m.size / 2;
        const z = ((py + 0.5) / RES) * m.size - m.size / 2;
        const s = m.sample(x, z, sample);
        const i = (py * RES + px) * 4;
        const water = m.hasWater && s.height < m.seaLevel;
        const shade = 0.35 + 0.65 * Math.max(0, Math.min(1, s.altitude));
        if (water) {
          const depth = Math.min(1, (m.seaLevel - s.height) / 60);
          hd.data[i] = 40 - depth * 20;
          hd.data[i + 1] = 90 - depth * 40;
          hd.data[i + 2] = 150 - depth * 50;
          bd.data[i] = 30;
          bd.data[i + 1] = 100 - depth * 40;
          bd.data[i + 2] = 170 - depth * 50;
        } else {
          const g = Math.round(60 + 170 * shade);
          hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = g;
          const col = palette[s.blend > 0.5 ? s.biome2 : s.biome] ?? [120, 120, 120];
          bd.data[i] = Math.round(col[0] * (0.55 + 0.45 * shade));
          bd.data[i + 1] = Math.round(col[1] * (0.55 + 0.45 * shade));
          bd.data[i + 2] = Math.round(col[2] * (0.55 + 0.45 * shade));
        }
        hd.data[i + 3] = 255;
        bd.data[i + 3] = 255;
      }
    }
    hc.putImageData(hd, 0, 0);
    bc.putImageData(bd, 0, 0);
    this.heightImg = h;
    this.biomeImg = b;
    const cb = new Uint8Array(MAP_CELLS * MAP_CELLS);
    const grid = this.src.grid;
    for (let iz = 0; iz < MAP_CELLS; iz++) {
      for (let ix = 0; ix < MAP_CELLS; ix++) {
        const c = grid.center(ix, iz);
        const s = m.sample(c.x, c.z, sample);
        cb[iz * MAP_CELLS + ix] = s.blend > 0.5 ? s.biome2 : s.biome;
      }
    }
    this.cellBiome = cb;
  }

  private visible(ix: number, iz: number, tier: number, minTier: number): boolean {
    return tier >= minTier || this.src.grid.levelAt(ix, iz) >= 1;
  }

  /** Karte neu zeichnen; `withSide` = Seitenleiste neu aufbauen (nicht beim periodischen Aktualisieren). */
  redraw(withSide = true): void {
    if (!this.open || !this.heightImg || !this.biomeImg || !this.cellBiome) return;
    const ctx = this.ctx;
    const grid = this.src.grid;
    const tier = this.src.satelliteTier();
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, SIZE_PX, SIZE_PX);
    ctx.drawImage(this.heightImg, 0, 0, SIZE_PX, SIZE_PX);

    // Biom-Layer: nur erkundete Zellen bzw. alles ab Satellit Stufe 2
    if (this.layers.biome) {
      const mc = this.maskCanvas.getContext('2d')!;
      const md = mc.createImageData(MAP_CELLS, MAP_CELLS);
      for (let i = 0; i < MAP_CELLS * MAP_CELLS; i++) {
        const on = tier >= 2 || (grid.cells[i] ?? 0) >= 1;
        md.data[i * 4 + 3] = on ? 255 : 0;
      }
      mc.putImageData(md, 0, 0);
      const cc = this.compose.getContext('2d')!;
      cc.clearRect(0, 0, SIZE_PX, SIZE_PX);
      cc.globalCompositeOperation = 'source-over';
      cc.drawImage(this.biomeImg, 0, 0, SIZE_PX, SIZE_PX);
      cc.globalCompositeOperation = 'destination-in';
      cc.imageSmoothingEnabled = false;
      cc.drawImage(this.maskCanvas, 0, 0, SIZE_PX, SIZE_PX);
      cc.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.compose, 0, 0);
    }

    // Fog of War
    const fc = this.fogCanvas.getContext('2d')!;
    const fd = fc.createImageData(MAP_CELLS, MAP_CELLS);
    for (let i = 0; i < MAP_CELLS * MAP_CELLS; i++) {
      const lvl = grid.cells[i] ?? 0;
      const alpha = lvl >= 1 ? 0 : tier >= 1 ? 110 : 245;
      fd.data[i * 4] = 3;
      fd.data[i * 4 + 1] = 5;
      fd.data[i * 4 + 2] = 12;
      fd.data[i * 4 + 3] = alpha;
    }
    fc.putImageData(fd, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, SIZE_PX, SIZE_PX);

    // Rohstoffe
    if (this.layers.ore) {
      for (const n of this.src.nodes()) {
        const ix = grid.cellX(n.x);
        const iz = grid.cellZ(n.z);
        if (!this.visible(ix, iz, tier, 2)) continue;
        const [px, py] = this.worldToPx(n.x, n.z);
        ctx.fillStyle = RESOURCE_COLORS[n.resourceId];
        ctx.beginPath();
        ctx.arc(px, py, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Lebenszeichen: Katalog-Lücken je Biom im Kartenblock (6×6), in dem das Biom am stärksten sichtbar ist
    const gaps = catalogGaps(this.src.entries, this.src.planet, this.src.isDiscovered);
    if (this.layers.life) {
      const BLOCKS = 6;
      const per = MAP_CELLS / BLOCKS;
      const counts = gaps.map(() => new Float32Array(BLOCKS * BLOCKS * 3));
      for (let iz = 0; iz < MAP_CELLS; iz++) {
        for (let ix = 0; ix < MAP_CELLS; ix++) {
          if (!this.visible(ix, iz, tier, 2)) continue;
          const bi = this.cellBiome[iz * MAP_CELLS + ix] ?? 0;
          const acc = counts[bi];
          if (!acc) continue;
          const b = (Math.floor(iz / per) * BLOCKS + Math.floor(ix / per)) * 3;
          acc[b] = (acc[b] ?? 0) + 1;
          acc[b + 1] = (acc[b + 1] ?? 0) + ix;
          acc[b + 2] = (acc[b + 2] ?? 0) + iz;
        }
      }
      gaps.forEach((g, i) => {
        const acc = counts[i]!;
        if (g.missing === 0) return;
        let bestB = -1;
        let bestN = 0;
        for (let b = 0; b < BLOCKS * BLOCKS; b++) {
          const n = acc[b * 3] ?? 0;
          if (n > bestN) {
            bestN = n;
            bestB = b;
          }
        }
        if (bestB < 0) return;
        const px = (((acc[bestB * 3 + 1] ?? 0) / bestN + 0.5) / MAP_CELLS) * SIZE_PX;
        const py = (((acc[bestB * 3 + 2] ?? 0) / bestN + 0.5) / MAP_CELLS) * SIZE_PX;
        const r = Math.min(24, 7 + g.missing * 0.9);
        ctx.fillStyle = 'rgba(95, 227, 154, 0.22)';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(95, 227, 154, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#d6ffe6';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${STR.map.missing} ${g.missing}`, px, py - r - 3);
      });
    }

    // Positionen
    const dyn = this.src.dynamic();
    const dot = (x: number, z: number, color: string, r: number, shape: 'circle' | 'square' | 'diamond' = 'circle'): void => {
      const [px, py] = this.worldToPx(x, z);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (shape === 'circle') ctx.arc(px, py, r, 0, Math.PI * 2);
      else if (shape === 'square') ctx.rect(px - r, py - r, r * 2, r * 2);
      else {
        ctx.moveTo(px, py - r);
        ctx.lineTo(px + r, py);
        ctx.lineTo(px, py + r);
        ctx.lineTo(px - r, py);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    };
    for (const m of dyn.modules) dot(m.x, m.z, m.type === 'shelter' ? '#ffd38a' : '#8fd0ff', 4, 'square');
    if (dyn.respawn) dot(dyn.respawn.x, dyn.respawn.z, '#ffd38a', 6, 'square');
    for (const p of dyn.deepProbes) dot(p.x, p.z, '#8fe3ff', 5, 'diamond');
    if (dyn.rover) dot(dyn.rover.x, dyn.rover.z, '#ff9f40', 5);
    if (dyn.ship) dot(dyn.ship.x, dyn.ship.z, '#ffffff', 6, 'diamond');
    if (this.layers.markers) {
      this.src.markers.forEach((mk, i) => {
        const [px, py] = this.worldToPx(mk.x, mk.z);
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 5, py - 12);
        ctx.lineTo(px + 5, py - 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(mk.label || `${STR.map.marker} ${i + 1}`, px + 7, py - 4);
      });
    }
    {
      const [px, py] = this.worldToPx(dyn.player.x, dyn.player.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-dyn.player.yaw);
      ctx.fillStyle = '#41b8ff';
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (withSide) this.renderSide(gaps, tier);
  }

  private renderSide(gaps: ReturnType<typeof catalogGaps>, tier: number): void {
    clear(this.side);
    const grid = this.src.grid;
    const pct = Math.round(grid.fraction() * 100);
    this.side.append(
      el('div', { class: 'goal', text: `${pct} % ${STR.map.explored} · ${STR.map.satellite}: ${tier ? `${STR.ship.level} ${tier}` : STR.map.none}` }),
      el('h3', { text: STR.map.layers }),
    );
    const toggles: Array<[keyof MapLayers, string, number]> = [
      ['biome', STR.map.layerBiome, 2],
      ['ore', STR.map.layerOre, 2],
      ['life', STR.map.layerLife, 2],
      ['markers', STR.map.layerMarkers, 0],
    ];
    const row = el('div', { class: 'row wrap' });
    for (const [key, label, need] of toggles) {
      const full = tier >= need;
      row.append(el('button', { class: `small ${this.layers[key] ? 'primary' : ''}`, text: `${label}${full ? '' : ' (erkundet)'}`, title: full ? '' : STR.map.needsScanner, onClick: () => { this.layers[key] = !this.layers[key]; this.redraw(); } }));
    }
    this.side.append(row, el('p', { class: 'muted small', text: `${STR.map.clickHint} · ${STR.map.legend}` }));
    this.side.append(el('h3', { text: STR.map.gaps }));
    const list = el('div', { class: 'map-gaps' });
    const visibleBiomes = new Set<number>();
    if (this.cellBiome) {
      for (let i = 0; i < MAP_CELLS * MAP_CELLS; i++) if (tier >= 2 || (grid.cells[i] ?? 0) >= 1) visibleBiomes.add(this.cellBiome[i] ?? 0);
    }
    gaps.forEach((g, i) => {
      const known = visibleBiomes.has(i);
      list.append(el('div', { class: `stat-row ${g.missing === 0 ? 'ok' : ''}` }, el('span', { text: known ? g.biome.name : STR.map.hidden }), el('span', { class: 'num', text: known ? `${STR.map.missing} ${g.missing} / ${g.total}` : '?' })));
    });
    this.side.append(list);
    if (this.src.markers.length) {
      this.side.append(el('h3', { text: STR.map.layerMarkers }));
      this.src.markers.forEach((mk, i) => {
        const input = el('input', { type: 'text', value: mk.label || `${STR.map.marker} ${i + 1}`, maxlength: 24 });
        input.addEventListener('change', () => {
          mk.label = input.value.trim();
          this.src.onMarkersChanged();
          this.redraw();
        });
        this.side.append(el('div', { class: 'row' }, input, el('button', { class: 'small', text: '×', onClick: () => { this.src.markers.splice(i, 1); this.src.onMarkersChanged(); this.redraw(); } })));
      });
    }
    const nodes = this.src.nodes();
    if (this.layers.ore && nodes.length) {
      const kinds = new Map<string, number>();
      for (const n of nodes) {
        const ix = grid.cellX(n.x);
        const iz = grid.cellZ(n.z);
        if (this.visible(ix, iz, tier, 2)) kinds.set(n.resourceId, (kinds.get(n.resourceId) ?? 0) + 1);
      }
      if (kinds.size) {
        const legend = el('div', { class: 'row wrap small' });
        for (const [id, n] of kinds) legend.append(el('span', { class: 'cost-item ok', text: `● ${RESOURCES[id as keyof typeof RESOURCES].name} ${n}` }));
        this.side.append(el('h3', { text: STR.map.layerOre }), legend);
      }
    }
  }

  private click(e: MouseEvent): void {
    if (!this.layers.markers) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE_PX;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE_PX;
    const near = this.src.markers.findIndex((m) => {
      const [mx, my] = this.worldToPx(m.x, m.z);
      return Math.hypot(mx - px, my - py) < 12;
    });
    if (near >= 0) this.src.markers.splice(near, 1);
    else {
      const [x, z] = this.pxToWorld(px, py);
      this.src.markers.push({ x: Math.round(x), z: Math.round(z), label: `${STR.map.marker} ${this.src.markers.length + 1}` });
    }
    this.src.onMarkersChanged();
    this.redraw();
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }
}
