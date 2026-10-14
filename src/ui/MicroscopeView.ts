import { el } from './dom';
import { STR } from './strings';
import type { MicroCell } from '@/game/samples';
import { clamp01 } from '@/math/utils';

/**
 * Mikroskop-Ansicht (2D-Canvas): prozedural gezeichnete Zellen in verschiedenen Tiefen; der Spieler stellt den Fokus
 * ein (Regler/Rad) und fotografiert eine scharfe Zelle. Schärfe bestimmt die Qualität (Sterne).
 */
export class MicroscopeView {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly slider: HTMLInputElement;
  private readonly info: HTMLElement;
  private cells: MicroCell[] = [];
  private focus = 0.5;
  private raf = 0;
  private time = 0;
  private selected: MicroCell | null = null;
  private onPhoto: ((cell: MicroCell, sharpness: number) => void) | null = null;
  private labels = new Map<string, string>();

  constructor(parent: HTMLElement, width = 640, height = 400) {
    this.canvas = el('canvas', { width: String(width), height: String(height), class: 'microscope-canvas' });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D-Canvas nicht verfügbar');
    this.ctx = ctx;
    this.slider = el('input', { type: 'range', min: '0', max: '1', step: '0.005', value: '0.5' });
    this.slider.addEventListener('input', () => (this.focus = Number(this.slider.value)));
    this.info = el('div', { class: 'muted', text: STR.micro.hint });
    const photoBtn = el('button', { class: 'small primary', text: STR.micro.photo, onClick: () => this.takePhoto() });
    this.root = el(
      'div',
      { class: 'microscope' },
      this.canvas,
      el('div', { class: 'row' }, el('span', { text: STR.micro.focus }), this.slider, photoBtn),
      this.info,
    );
    parent.append(this.root);
    this.canvas.addEventListener('click', (e) => this.pick(e));
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.focus = clamp01(this.focus + Math.sign(e.deltaY) * 0.03);
      this.slider.value = String(this.focus);
    }, { passive: false });
  }

  load(cells: MicroCell[], labels: Map<string, string>, onPhoto: (cell: MicroCell, sharpness: number) => void): void {
    this.cells = cells;
    this.labels = labels;
    this.onPhoto = onPhoto;
    this.selected = cells[0] ?? null;
    this.focus = 0.5;
    this.slider.value = '0.5';
    this.start();
  }

  private sharpness(cell: MicroCell): number {
    return clamp01(1 - Math.abs(cell.depth - this.focus) * 3.2);
  }

  private pick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    let best: MicroCell | null = null;
    let bd = Infinity;
    for (const c of this.cells) {
      const d = Math.hypot(c.x * this.canvas.width - px, c.y * this.canvas.height - py);
      if (d < c.size * 1.3 && d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best) this.selected = best;
  }

  private takePhoto(): void {
    if (!this.selected || !this.onPhoto) return;
    this.onPhoto(this.selected, this.sharpness(this.selected));
  }

  private start(): void {
    cancelAnimationFrame(this.raf);
    let last = 0;
    const loop = (now: number): void => {
      this.raf = requestAnimationFrame(loop);
      if (now - last < 50) return; // ~20 fps reichen für die Zellbewegung
      this.time += (now - last) / 1000;
      last = now;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private drawCell(c: MicroCell, blur: number): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const x = c.x * W + Math.sin(this.time * 0.6 + c.phase) * 6;
    const y = c.y * H + Math.cos(this.time * 0.5 + c.phase) * 5;
    const s = c.size;
    const g = c.genome;
    const hue = g.hue;
    ctx.save();
    ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
    ctx.translate(x, y);
    ctx.rotate(c.phase + (g.motility === 'none' ? 0 : this.time * 0.15));
    ctx.fillStyle = `hsla(${hue}, 55%, 55%, 0.55)`;
    ctx.strokeStyle = `hsla(${hue}, 70%, 40%, 0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    switch (g.shape) {
      case 'coccus':
        ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
        break;
      case 'bacillus':
        ctx.roundRect(-s * 0.7, -s * 0.28, s * 1.4, s * 0.56, s * 0.28);
        break;
      case 'spiral':
        ctx.moveTo(-s * 0.8, 0);
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          ctx.lineTo(-s * 0.8 + t * s * 1.6, Math.sin(t * Math.PI * 4 + this.time * 2) * s * 0.22);
        }
        ctx.lineWidth = s * 0.14;
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? s * 0.55 : s * 0.25;
          const a = (i / 10) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'amoeboid':
        for (let i = 0; i <= 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const r = s * 0.5 * (1 + 0.25 * Math.sin(a * 3 + this.time * 1.5) + 0.15 * Math.cos(a * 5 - this.time));
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'diatom':
        ctx.ellipse(0, 0, s * 0.75, s * 0.3, 0, 0, Math.PI * 2);
        break;
      case 'ciliate':
        ctx.ellipse(0, 0, s * 0.6, s * 0.38, 0, 0, Math.PI * 2);
        break;
      case 'colony':
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const r = i === 0 ? 0 : s * 0.42;
          ctx.moveTo(Math.cos(a) * r + s * 0.22, Math.sin(a) * r);
          ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.22, 0, Math.PI * 2);
        }
        break;
    }
    if (g.shape === 'spiral') ctx.stroke();
    else {
      ctx.fill();
      ctx.stroke();
    }
    // Details: Kerne, Membranmuster, Geißeln/Wimpern
    ctx.lineWidth = 1.2;
    if (g.shape === 'diatom') {
      ctx.strokeStyle = `hsla(${hue}, 60%, 30%, 0.6)`;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.18, -s * 0.28);
        ctx.lineTo(i * s * 0.18, s * 0.28);
        ctx.stroke();
      }
    }
    if (g.shape === 'ciliate' || g.motility === 'cilia') {
      ctx.strokeStyle = `hsla(${hue}, 60%, 35%, 0.7)`;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const rx = s * 0.6;
        const ry = s * 0.38;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rx, Math.sin(a) * ry);
        ctx.lineTo(Math.cos(a) * (rx + s * 0.12), Math.sin(a) * (ry + s * 0.12));
        ctx.stroke();
      }
    }
    if (g.motility === 'flagella') {
      ctx.strokeStyle = `hsla(${hue}, 60%, 35%, 0.8)`;
      ctx.beginPath();
      ctx.moveTo(s * 0.6, 0);
      for (let i = 1; i <= 12; i++) ctx.lineTo(s * 0.6 + i * s * 0.09, Math.sin(i * 0.9 + this.time * 8) * s * 0.12);
      ctx.stroke();
    }
    ctx.fillStyle = `hsla(${hue + 40}, 60%, 30%, 0.8)`;
    for (let i = 0; i < g.nucleusCount; i++) {
      const a = (i / Math.max(1, g.nucleusCount)) * Math.PI * 2;
      const r = g.nucleusCount > 1 ? s * 0.2 : 0;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    if (g.membranePattern === 'spots' || g.membranePattern === 'mottled') {
      ctx.fillStyle = `hsla(${hue + 180}, 50%, 45%, 0.5)`;
      for (let i = 0; i < 8; i++) {
        const a = i * 2.4 + c.phase;
        const r = s * 0.35 * ((i % 3) / 3 + 0.3);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private draw(): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const bg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    bg.addColorStop(0, '#c9d6de');
    bg.addColorStop(1, '#4a5a66');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Staub/Partikel im Hintergrund
    ctx.fillStyle = 'rgba(60,70,80,0.25)';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 + this.time * 7) % W + W) % W;
      const y = (i * 53) % H;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    const sorted = this.cells.slice().sort((a, b) => a.depth - b.depth);
    for (const c of sorted) {
      const blur = Math.abs(c.depth - this.focus) * 14;
      this.drawCell(c, blur);
    }
    // Auswahl + Info
    if (this.selected) {
      const c = this.selected;
      const sharp = this.sharpness(c);
      ctx.strokeStyle = sharp > 0.7 ? 'rgba(94,227,154,0.9)' : 'rgba(255,181,71,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(c.x * W - c.size - 8, c.y * H - c.size - 8, c.size * 2 + 16, c.size * 2 + 16);
      ctx.setLineDash([]);
      const label = this.labels.get(c.entry.id) ?? '?';
      this.info.textContent = `${label} · ${STR.micro.sharpness} ${(sharp * 100).toFixed(0)} % · ${(c.genome.sizeUm).toFixed(c.genome.sizeUm < 10 ? 1 : 0)} µm`;
    }
    // Maßstab
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W - 110, H - 24, 80, 3);
    ctx.font = '11px sans-serif';
    ctx.fillText('50 µm', W - 108, H - 30);
  }

  dispose(): void {
    this.stop();
    this.root.remove();
  }
}
