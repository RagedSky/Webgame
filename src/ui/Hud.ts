import { el } from './dom';
import { STR } from './strings';

export interface CompassMarker {
  /** Peilung in Grad (0 = Norden, 90 = Osten). */
  bearing: number;
  glyph: string;
  cls: string;
}

export interface TutorialCard {
  index: number;
  total: number;
  title: string;
  text: string;
  done: boolean;
}

export interface SightingInfo {
  name: string;
  /** Seltenheit als Schlüssel (für die Farbe) und Beschriftung; leer, solange die Art unbekannt ist. */
  rarity: string;
  rarityLabel: string;
  behavior: string;
  distance: number;
  known: boolean;
}

const COMPASS_PX_PER_DEG = 3;
const COMPASS_HALF_WIDTH = 210;
const COMPASS_VISIBLE_DEG = 66;
/** Umfang des Sammelrings um das Fadenkreuz (r = 17). */
const RING_LENGTH = 2 * Math.PI * 17;

export interface HudInfo {
  planet: string;
  biome: string;
  clock: string;
  timeOfDay: string;
  /** Tagesabschnitt für das Symbol: day, night, dawn oder dusk. */
  timeKind: string;
  weather: string;
  temperatureC: number;
  altitude: number;
  x: number;
  z: number;
  swimming: boolean;
  nearEdge: boolean;
  fly: boolean;
  timeScale: number;
  /** Aktive Himmelsphänomene (fotografierbar). */
  phenomena?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Linien-Icons (24 × 24): bewusst schlicht, damit sie zur dünnen Linienführung des HUD passen. */
const ICONS = {
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
  horizon: 'M2 17h20M5 13a7 7 0 0 1 14 0M12 3v3M4.5 6.5l2 2M19.5 6.5l-2 2',
  cloud: 'M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18z',
  thermo: 'M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2zM12 9v8',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6l1-8z',
  air: 'M3 9h10a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 19h6',
  peak: 'M2 20l7-12 4 6 3-4 6 10z',
  pin: 'M12 2l7 10-7 10-7-10z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11',
  disk: 'M5 3h11l3 3v15H5V3zM8 3v6h7V3M8 21v-7h8v7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
} as const;

function icon(name: keyof typeof ICONS, cls = ''): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `hud-icon ${cls}`.trim());
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Zerlegt „E halten: Sammeln – Ferrit“ in Taste und Text (für Tastenkappen im Hinweis). */
function splitPrompt(part: string): [string, string] {
  const at = part.indexOf(': ');
  if (at > 0 && at <= 14) return [part.slice(0, at), part.slice(at + 2)];
  return ['', part];
}

/**
 * Spiel-HUD der Planetenoberfläche. Aufbau in vier Ecken um eine freie Bildmitte:
 * oben links Ort und Umwelt, oben Mitte Kompass, oben rechts Archivfortschritt, Ziel und Tutorial,
 * unten links Name und Lebenserhaltung, unten Mitte Interaktion, unten rechts Telemetrie.
 * Die Akzentfarbe stammt vom Anzug des Charakters (`setIdentity`), damit das HUD zur Figur gehört.
 */
export class Hud {
  readonly root: HTMLElement;
  private readonly planet: HTMLElement;
  private readonly biome: HTMLElement;
  private readonly timeIcon: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly weather: HTMLElement;
  private readonly temperature: HTMLElement;
  private readonly phenomena: HTMLElement;
  private readonly altitude: HTMLElement;
  private readonly coords: HTMLElement;
  private readonly flags: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly ring: SVGCircleElement;
  private readonly sighting: HTMLElement;
  private readonly sightingName: HTMLElement;
  private readonly sightingMeta: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly survival: HTMLElement;
  private readonly identityName: HTMLElement;
  private readonly identityRole: HTMLElement;
  private readonly o2Fill: HTMLElement;
  private readonly enFill: HTMLElement;
  private readonly o2Value: HTMLElement;
  private readonly enValue: HTMLElement;
  private readonly survivalText: HTMLElement;
  private readonly palette: HTMLElement;
  private readonly fade: HTMLElement;
  private readonly goal: HTMLElement;
  private readonly archive: HTMLElement;
  private readonly archiveCount: HTMLElement;
  private readonly archiveFill: HTMLElement;
  private readonly compass: HTMLElement;
  private readonly compassTape: HTMLElement;
  private readonly compassHeading: HTMLElement;
  private readonly compassMarkers: HTMLElement[] = [];
  private readonly tutorial: HTMLElement;
  private readonly tutorialHead: HTMLElement;
  private readonly tutorialTitle: HTMLElement;
  private readonly tutorialText: HTMLElement;
  private readonly saved: HTMLElement;
  private savedTimer = 0;
  private timeKind = '';
  private promptText = '';
  private harvesting = false;

  constructor(parent: HTMLElement) {
    // --- oben links: Ort und Umwelt ---
    this.planet = el('div', { class: 'loc-planet' });
    this.biome = el('div', { class: 'loc-biome' });
    this.timeIcon = el('span', { class: 'chip-icon' }, icon('sun'));
    this.clock = el('span');
    this.weather = el('span');
    this.temperature = el('span');
    this.phenomena = el('div', { class: 'loc-phenomena', style: 'display:none' });
    const location = el(
      'div',
      { class: 'hud-location hud-block' },
      this.planet,
      this.biome,
      el('div', { class: 'hud-chips' }, el('span', { class: 'chip' }, this.timeIcon, this.clock), el('span', { class: 'chip' }, icon('cloud'), this.weather), el('span', { class: 'chip' }, icon('thermo'), this.temperature)),
      this.phenomena,
    );

    // --- oben Mitte: Kompass ---
    this.compassTape = el('div', { class: 'tape' });
    for (let deg = -360; deg <= 720; deg += 15) {
      const major = deg % 45 === 0;
      const idx = (((deg % 360) + 360) % 360) / 45;
      const label = major ? (STR.hud.compass[idx] as string) : '';
      this.compassTape.append(el('span', { class: major ? (idx % 2 === 0 ? 'major cardinal' : 'major') : 'minor', text: label, style: `left:${(deg + 360) * COMPASS_PX_PER_DEG}px` }));
    }
    this.compassHeading = el('div', { class: 'heading' });
    this.compass = el('div', { class: 'hud-compass' }, el('div', { class: 'window' }, this.compassTape), el('div', { class: 'needle' }), this.compassHeading);
    for (let i = 0; i < 4; i++) {
      const m = el('span', { class: 'marker', style: 'display:none' });
      this.compassMarkers.push(m);
      this.compass.append(m);
    }

    // --- oben rechts: Archiv, Ziel, Tutorial ---
    this.archiveCount = el('span', { class: 'count' });
    this.archiveFill = el('div');
    this.archive = el('div', { class: 'hud-archive hud-block right' }, el('div', { class: 'head' }, icon('book'), el('span', { class: 'label', text: STR.hud.archive }), this.archiveCount), el('div', { class: 'thin-bar' }, this.archiveFill));
    this.goal = el('div', { class: 'hud-goal hud-block right', style: 'display:none' });
    this.tutorialHead = el('div', { class: 'tut-head' });
    this.tutorialTitle = el('div', { class: 'tut-title' });
    this.tutorialText = el('div', { class: 'tut-text' });
    this.tutorial = el('div', { class: 'hud-tutorial hud-block right', style: 'display:none' }, this.tutorialHead, this.tutorialTitle, this.tutorialText, el('div', { class: 'tut-skip', text: STR.tutorial.skip }));
    const topRight = el('div', { class: 'hud-top-right' }, this.archive, this.goal, this.tutorial);

    // --- unten links: Name und Lebenserhaltung ---
    this.identityName = el('span', { class: 'name' });
    this.identityRole = el('span', { class: 'role' });
    this.o2Fill = el('div');
    this.enFill = el('div');
    this.o2Value = el('span', { class: 'value' });
    this.enValue = el('span', { class: 'value' });
    this.survivalText = el('div', { class: 'hazards' });
    this.survival = el(
      'div',
      { class: 'hud-survival hud-block' },
      el('div', { class: 'identity' }, el('span', { class: 'diamond' }), this.identityName, this.identityRole),
      el('div', { class: 'vital o2' }, icon('air'), el('span', { class: 'label', text: STR.hud.oxygen }), el('div', { class: 'seg-bar' }, this.o2Fill), this.o2Value),
      el('div', { class: 'vital en' }, icon('bolt'), el('span', { class: 'label', text: STR.hud.energy }), el('div', { class: 'seg-bar' }, this.enFill), this.enValue),
      this.survivalText,
    );

    // --- unten rechts: Telemetrie ---
    this.altitude = el('span', { class: 'v' });
    this.coords = el('span', { class: 'v' });
    this.flags = el('div', { class: 'flags' });
    this.saved = el('div', { class: 'hud-saved' }, icon('disk'), el('span', { text: STR.save.autosaved }));
    const telemetry = el(
      'div',
      { class: 'hud-telemetry hud-block right' },
      this.flags,
      el('div', { class: 'row' }, icon('peak'), el('span', { class: 'k', text: STR.hud.altitude }), this.altitude),
      el('div', { class: 'row' }, icon('pin'), el('span', { class: 'k', text: STR.hud.position }), this.coords),
      this.saved,
    );

    // --- Bildmitte: Fadenkreuz mit Sammelring, Sichtung ---
    const ringSvg = document.createElementNS(SVG_NS, 'svg');
    ringSvg.setAttribute('viewBox', '0 0 40 40');
    ringSvg.setAttribute('class', 'ring');
    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'track');
    this.ring = document.createElementNS(SVG_NS, 'circle');
    this.ring.setAttribute('class', 'fill');
    for (const c of [track, this.ring]) {
      c.setAttribute('cx', '20');
      c.setAttribute('cy', '20');
      c.setAttribute('r', '17');
      ringSvg.append(c);
    }
    this.ring.style.strokeDasharray = `${RING_LENGTH}`;
    this.ring.style.strokeDashoffset = `${RING_LENGTH}`;
    this.crosshair = el('div', { class: 'crosshair' }, el('span', { class: 'dot' }));
    this.crosshair.append(ringSvg);
    this.sightingName = el('div', { class: 'name' });
    this.sightingMeta = el('div', { class: 'meta' });
    this.sighting = el('div', { class: 'hud-sighting', style: 'display:none' }, el('span', { class: 'lead' }), el('div', { class: 'card' }, el('div', { class: 'tag' }, icon('eye'), el('span', { text: STR.hud.sighting })), this.sightingName, this.sightingMeta));

    // --- unten Mitte: Interaktion, Bauleiste, Starthinweis ---
    this.hint = el('div', { class: 'hud-hint' });
    this.prompt = el('div', { class: 'hud-prompt', style: 'display:none' });
    this.palette = el('div', { class: 'hud-palette', style: 'display:none' });
    this.fade = el('div', { class: 'hud-fade' });

    this.root = el('div', { class: 'hud' }, el('div', { class: 'hud-shade' }), location, this.compass, topRight, this.survival, telemetry, this.crosshair, this.sighting, this.hint, this.prompt, this.palette, this.fade);
    parent.append(this.root);
  }

  /** Name, Hintergrund und Anzug-Akzent des Charakters: das HUD übernimmt die Akzentfarbe. */
  setIdentity(name: string, role: string, accent: string): void {
    setText(this.identityName, name);
    setText(this.identityRole, role);
    // global setzen: auch Foto-Sucher und Benachrichtigungen liegen außerhalb des HUD-Knotens
    document.documentElement.style.setProperty('--hud-accent', accent);
  }

  /** Archivfortschritt (entdeckt / gesamt). */
  setArchive(discovered: number, total: number): void {
    setText(this.archiveCount, `${discovered} / ${total}`);
    this.archiveFill.style.width = `${total > 0 ? Math.min(100, (discovered / total) * 100) : 0}%`;
  }

  /** Kompass: Blickrichtung in Grad (0 = Norden) und Markierungen (Schiff, Unterkunft, Rover …). */
  setCompass(headingDeg: number, markers: readonly CompassMarker[]): void {
    const h = ((headingDeg % 360) + 360) % 360;
    this.compassTape.style.transform = `translateX(${COMPASS_HALF_WIDTH - (h + 360) * COMPASS_PX_PER_DEG}px)`;
    setText(this.compassHeading, `${Math.round(h) % 360}°`);
    for (let i = 0; i < this.compassMarkers.length; i++) {
      const node = this.compassMarkers[i] as HTMLElement;
      const m = markers[i];
      if (!m) {
        node.style.display = 'none';
        continue;
      }
      let rel = ((m.bearing - h + 540) % 360) - 180;
      const clamped = Math.abs(rel) > COMPASS_VISIBLE_DEG;
      if (clamped) rel = Math.sign(rel) * COMPASS_VISIBLE_DEG;
      node.style.display = 'block';
      node.style.left = `${COMPASS_HALF_WIDTH + rel * COMPASS_PX_PER_DEG}px`;
      const cls = `marker ${m.cls}${clamped ? ' edge' : ''}`;
      if (node.className !== cls) node.className = cls;
      setText(node, m.glyph);
    }
  }

  setCompassVisible(on: boolean): void {
    this.compass.style.display = on ? 'block' : 'none';
  }

  /** Tutorial-Karte (null = ausblenden). */
  setTutorial(card: TutorialCard | null): void {
    this.tutorial.style.display = card ? 'block' : 'none';
    if (!card) return;
    setText(this.tutorialHead, `${STR.tutorial.title} · ${STR.tutorial.stepOf} ${card.index}/${card.total}`);
    setText(this.tutorialTitle, card.title);
    setText(this.tutorialText, card.text);
    this.tutorial.classList.toggle('done', card.done);
  }

  /** Kurze „Gespeichert“-Einblendung. */
  flashSaved(): void {
    this.saved.classList.add('show');
    window.clearTimeout(this.savedTimer);
    this.savedTimer = window.setTimeout(() => this.saved.classList.remove('show'), 1800);
  }

  setHint(text: string): void {
    setText(this.hint, text);
    this.hint.style.display = text ? 'block' : 'none';
  }

  /** Sichtung neben dem Fadenkreuz: Art, Seltenheit, Verhalten, Entfernung (null = ausblenden). */
  setSighting(info: SightingInfo | null): void {
    this.sighting.style.display = info ? 'flex' : 'none';
    if (!info) return;
    setText(this.sightingName, info.name);
    setText(this.sightingMeta, [info.rarityLabel, info.behavior, `${info.distance.toFixed(0)} m`].filter(Boolean).join('  ·  '));
    const cls = `hud-sighting ${info.known ? 'known' : 'unknown'}${info.rarity ? ` rarity-${info.rarity}` : ''}`;
    if (this.sighting.className !== cls) this.sighting.className = cls;
  }

  /** Interaktionshinweis unten: Teile der Form „Taste: Text“, getrennt durch „·“, werden zu Tastenkappen. */
  setPrompt(text: string): void {
    this.prompt.style.display = text ? 'flex' : 'none';
    this.crosshair.classList.toggle('active', text !== '' || this.harvesting);
    if (text === this.promptText) return;
    this.promptText = text;
    this.prompt.textContent = '';
    for (const part of text.split('   ·   ')) {
      if (!part) continue;
      const [key, label] = splitPrompt(part);
      this.prompt.append(el('div', { class: 'item' }, key ? el('span', { class: 'keycap', text: key }) : null, el('span', { class: 'label', text: label })));
    }
  }

  setSurvival(oxygen: number, energy: number, text: string, warn: boolean): void {
    this.o2Fill.style.width = `${Math.round(oxygen)}%`;
    this.enFill.style.width = `${Math.round(energy)}%`;
    setText(this.o2Value, `${Math.round(oxygen)}`);
    setText(this.enValue, `${Math.round(energy)}`);
    setText(this.survivalText, text);
    this.survival.classList.toggle('warn', warn);
    this.survival.classList.toggle('low-o2', oxygen <= 25);
    this.survival.classList.toggle('low-en', energy <= 25);
  }

  /** Sammelfortschritt als Ring um das Fadenkreuz (null = aus). */
  setHarvest(progress: number | null): void {
    this.harvesting = progress !== null;
    this.crosshair.classList.toggle('harvest', this.harvesting);
    this.crosshair.classList.toggle('active', this.harvesting || this.promptText !== '');
    this.ring.style.strokeDashoffset = `${RING_LENGTH * (1 - (progress ?? 0))}`;
  }

  /** Bau-Palette: Liste von Beschriftungen, ausgewählter Index. */
  setPalette(items: Array<{ label: string; affordable: boolean }> | null, selected: number, hint: string): void {
    this.palette.style.display = items ? 'flex' : 'none';
    this.palette.textContent = '';
    if (!items) return;
    const slots = el('div', { class: 'slots' });
    items.forEach((it, i) => slots.append(el('div', { class: `pal ${i === selected ? 'sel' : ''} ${it.affordable ? '' : 'missing'}` }, el('span', { class: 'keycap', text: `${i + 1}` }), el('span', { class: 'label', text: it.label }))));
    this.palette.append(slots, el('div', { class: 'pal-hint', text: hint }));
  }

  setGoal(text: string): void {
    setText(this.goal, text);
    this.goal.style.display = text ? 'block' : 'none';
  }

  setFade(alpha: number): void {
    this.fade.style.opacity = String(Math.max(0, Math.min(1, alpha)));
  }

  /** Im Foto-Modus alles bis auf Überleben ausblenden (sauberer Sucher). */
  setPhotoMode(on: boolean): void {
    this.root.classList.toggle('photo', on);
  }

  setCrosshair(visible: boolean): void {
    this.crosshair.style.display = visible ? 'block' : 'none';
  }

  update(i: HudInfo): void {
    setText(this.planet, i.planet);
    setText(this.biome, i.biome);
    setText(this.clock, `${i.clock}  ${i.timeOfDay}`);
    setText(this.weather, i.weather);
    setText(this.temperature, `${i.temperatureC.toFixed(0)} °C`);
    const kind = i.timeKind === 'night' ? 'moon' : i.timeKind === 'day' ? 'sun' : 'horizon';
    if (kind !== this.timeKind) {
      this.timeKind = kind;
      this.timeIcon.replaceChildren(icon(kind));
    }
    setText(this.phenomena, i.phenomena ?? '');
    this.phenomena.style.display = i.phenomena ? 'block' : 'none';
    setText(this.altitude, `${i.altitude.toFixed(0)} m`);
    setText(this.coords, `${i.x.toFixed(0)} / ${i.z.toFixed(0)}`);
    const flags = [i.swimming ? STR.hud.swimming : '', i.fly ? STR.hud.fly : '', i.nearEdge ? STR.hud.edge : '', i.timeScale > 1 ? `${STR.hud.timeScale} ×${i.timeScale}` : ''].filter(Boolean).join('|');
    if (this.flags.dataset.v !== flags) {
      this.flags.dataset.v = flags;
      this.flags.textContent = '';
      for (const f of flags.split('|')) if (f) this.flags.append(el('span', { class: 'flag', text: f }));
    }
  }

  dispose(): void {
    window.clearTimeout(this.savedTimer);
    document.documentElement.style.removeProperty('--hud-accent');
    this.root.remove();
  }
}
