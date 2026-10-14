import {
  AmbientLight,
  BufferGeometry,
  Color,
  EllipseCurve,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  DoubleSide,
  AdditiveBlending,
  BackSide,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { BloomEffect, EffectPass, type EffectComposer } from 'postprocessing';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import type { Planet, StarSystem } from '@/gen/universe/types';
import { createStarfield } from '@/render/Starfield';
import { createPlanetTexture } from '@/render/PlanetTexture';
import { SystemPanel } from '@/ui/SystemPanel';
import { el } from '@/ui/dom';
import { MainMenuScene } from './MainMenuScene';
import { PlanetScene } from './PlanetScene';

interface PlanetNode {
  planet: Planet;
  pivot: Group;
  mesh: Mesh;
  orbitRadius: number;
  angle0: number;
  angularSpeed: number; // rad pro Tag
  spin: number; // rad pro Tag
  orbitLine: Line;
  label: HTMLElement;
  moons: Array<{ mesh: Mesh; radius: number; angularSpeed: number; angle0: number }>;
}

/** Visuelle Skalierung: Orbits logarithmisch, Radien log-skaliert (siehe DECISIONS D-011). */
export const orbitDisplayRadius = (au: number): number => 10 + 14 * Math.log2(1 + au / 0.25);
export const planetDisplayRadius = (km: number): number => 1 + Math.log2(1 + km / 3000) * 0.9;
export const starDisplayRadius = (rel: number): number => 3 + Math.log2(1 + rel) * 1.5;

/**
 * Debug-/Übersichtsansicht des Sternsystems: Stern mit Bloom, Orbits, Planeten mit prozeduralen Texturen,
 * Monde, Lebenszone, Labels, Auswahl per Klick und Datenpanel (Übersicht, Planeten, Archiv, Daten-Dump).
 */
export class SystemViewScene implements GameScene {
  readonly name = 'SystemView';
  private ctx!: GameContext;
  private system!: StarSystem;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  private readonly disposer = new Disposer();
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private labelRenderer!: CSS2DRenderer;
  private panel!: SystemPanel;
  private nodes: PlanetNode[] = [];
  private starMesh!: Mesh;
  private selected: Planet | null = null;
  private following = false;
  private simDays = 0;
  private daysPerSecond = 2;
  private paused = false;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly tmpVec = new Vector3();
  private readonly lastTarget = new Vector3();
  private pointerDown: { x: number; y: number } | null = null;
  private uiRoot!: HTMLElement;
  private speedLabel!: HTMLElement;

  enter(ctx: GameContext): void {
    this.ctx = ctx;
    this.system = gameState.getSystem();
    ctx.debug.setScene(this.name);
    ctx.debug.setSeed(this.system.seed);
    this.buildScene();
    this.buildUi();
  }

  // ---------------------------------------------------------------------------
  private buildScene(): void {
    const sys = this.system;
    const gl = this.ctx.renderer.gl;
    this.scene.background = new Color(0x03050a);
    this.scene.add(createStarfield(this.disposer, `stars:${sys.seed}`, 3000, [400, 900]));

    // Stern
    const starR = starDisplayRadius(sys.star.radius);
    const starGeo = this.disposer.add(new SphereGeometry(starR, 48, 32));
    const starMat = this.disposer.add(new MeshBasicMaterial({ color: new Color(sys.star.color).multiplyScalar(1.6) }));
    this.starMesh = new Mesh(starGeo, starMat);
    this.starMesh.userData.kind = 'star';
    this.scene.add(this.starMesh);
    const glowGeo = this.disposer.add(new SphereGeometry(starR * 1.35, 32, 24));
    const glowMat = this.disposer.add(
      new MeshBasicMaterial({ color: sys.star.color, transparent: true, opacity: 0.22, blending: AdditiveBlending, side: BackSide, depthWrite: false }),
    );
    this.scene.add(new Mesh(glowGeo, glowMat));
    const starLabel = this.makeLabel(`${sys.star.name} · ${sys.star.label}`, 'star');
    const starLabelObj = new CSS2DObject(starLabel);
    starLabelObj.position.set(0, starR + 1.5, 0);
    this.starMesh.add(starLabelObj);

    const light = new PointLight(sys.star.lightColor, 2.6, 0, 0);
    this.scene.add(light);
    this.scene.add(new AmbientLight(0x8899bb, 0.25));

    // Lebenszone
    const hzInner = orbitDisplayRadius(sys.star.habitableZoneAu[0]);
    const hzOuter = orbitDisplayRadius(sys.star.habitableZoneAu[1]);
    const hzGeo = this.disposer.add(new RingGeometry(hzInner, hzOuter, 128));
    const hzMat = this.disposer.add(new MeshBasicMaterial({ color: 0x3fd98a, transparent: true, opacity: 0.07, side: DoubleSide, depthWrite: false }));
    const hz = new Mesh(hzGeo, hzMat);
    hz.rotation.x = -Math.PI / 2;
    this.scene.add(hz);

    // Planeten
    const sphereGeo = this.disposer.add(new SphereGeometry(1, 40, 28));
    const moonGeo = this.disposer.add(new SphereGeometry(1, 12, 8));
    sys.planets.forEach((planet, i) => {
      const orbitRadius = orbitDisplayRadius(planet.orbitRadiusAu);
      const pivot = new Group();
      this.scene.add(pivot);
      const tex = this.disposer.add(createPlanetTexture(planet));
      const mat = this.disposer.add(new MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 }));
      const mesh = new Mesh(sphereGeo, mat);
      const r = planetDisplayRadius(planet.radiusKm);
      mesh.scale.setScalar(r);
      mesh.position.set(orbitRadius, 0, 0);
      mesh.rotation.z = (planet.axialTiltDeg * Math.PI) / 180;
      mesh.userData.planetId = planet.id;
      pivot.add(mesh);

      // Orbitlinie
      const curve = new EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(160).map((p) => new Vector3(p.x, 0, p.y));
      const orbitGeo = this.disposer.add(new BufferGeometry().setFromPoints(pts));
      const orbitMat = this.disposer.add(new LineBasicMaterial({ color: planet.isStart ? 0xffd38a : 0x6fa6ff, transparent: true, opacity: planet.isStart ? 0.6 : 0.28 }));
      const orbitLine = new Line(orbitGeo, orbitMat);
      this.scene.add(orbitLine);

      // Label
      const label = this.makeLabel(planet.isStart ? `★ ${planet.name}` : planet.name, planet.isStart ? 'start' : '');
      const labelObj = new CSS2DObject(label);
      labelObj.position.set(0, 1.4, 0);
      mesh.add(labelObj);

      // Monde
      const moons: PlanetNode['moons'] = [];
      planet.moons.forEach((moon, mi) => {
        const mm = this.disposer.add(new MeshStandardMaterial({ color: moon.color, roughness: 1 }));
        const mMesh = new Mesh(moonGeo, mm);
        const mr = Math.max(0.12, Math.log2(1 + moon.radiusKm / 800) * 0.25);
        mMesh.scale.setScalar(mr / r); // Kind von mesh → Skalierung kompensieren
        const radius = 1.6 + mi * 0.7;
        mMesh.position.set(radius, 0, 0);
        mesh.add(mMesh);
        moons.push({ mesh: mMesh, radius, angularSpeed: (Math.PI * 2) / Math.max(0.5, moon.orbitPeriodDays), angle0: (mi * Math.PI) / 2 });
      });

      const angle0 = (i * 2.399963) % (Math.PI * 2); // goldener Winkel: Planeten verteilen
      this.nodes.push({
        planet,
        pivot,
        mesh,
        orbitRadius,
        angle0,
        angularSpeed: (Math.PI * 2) / planet.orbitPeriodDays,
        spin: (Math.PI * 2) / (planet.dayLengthHours / 24),
        orbitLine,
        label,
        moons,
      });
    });

    // Kamera, Controls, Composer
    const outer = this.nodes.length ? this.nodes[this.nodes.length - 1]!.orbitRadius : 60;
    this.camera.position.set(0, outer * 0.75, outer * 1.15);
    this.camera.far = Math.max(2000, outer * 20);
    this.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(this.camera, gl.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = outer * 4;
    this.disposer.addFn(() => this.controls.dispose());

    this.composer = this.ctx.renderer.createComposer(this.scene, this.camera);
    const bloom = new BloomEffect({ luminanceThreshold: 0.75, luminanceSmoothing: 0.2, intensity: 1.1, mipmapBlur: true, radius: 0.6 });
    this.composer.addPass(new EffectPass(this.camera, bloom));
    this.disposer.addFn(() => this.ctx.renderer.disposeComposer(this.composer));

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    this.disposer.addObject3D(this.scene);
  }

  private makeLabel(text: string, cls: string): HTMLElement {
    return el('div', { class: `planet-label ${cls}`.trim(), text });
  }

  // ---------------------------------------------------------------------------
  private buildUi(): void {
    const ctx = this.ctx;
    this.uiRoot = el('div', { class: 'system-ui' });
    ctx.uiRoot.append(this.uiRoot);
    this.disposer.addDom(this.uiRoot);
    this.uiRoot.append(this.labelRenderer.domElement);

    const topbar = el(
      'div',
      { class: 'panel system-topbar' },
      el('span', { class: 'sysname', text: `${this.system.name}` }),
      el('span', { class: 'muted', text: `${this.system.star.label} · ${this.system.planets.length} Planeten · ${this.system.entries.length} Einträge` }),
      el('span', { class: 'muted', text: `Seed ${this.system.seed}` }),
      el('button', { class: 'small', text: 'Seed kopieren', onClick: () => this.panel.copySeed() }),
      el('button', { class: 'small', text: 'Zurück (Esc)', onClick: () => this.backToMenu() }),
    );
    this.uiRoot.append(topbar);

    this.speedLabel = el('span', { class: 'muted' });
    const slider = el('input', { type: 'range', min: '0', max: '60', step: '1', value: String(this.daysPerSecond) });
    slider.addEventListener('input', () => {
      this.daysPerSecond = Number(slider.value);
      this.updateSpeedLabel();
    });
    const pauseBtn = el('button', { class: 'small', text: 'Pause' });
    pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      pauseBtn.textContent = this.paused ? 'Weiter' : 'Pause';
    });
    const bottombar = el(
      'div',
      { class: 'panel system-bottombar' },
      el('span', { text: 'Zeitraffer' }),
      slider,
      this.speedLabel,
      pauseBtn,
      el('span', { class: 'muted', text: '· Planet anklicken für Details · Ziehen: drehen · Rad: Zoom' }),
    );
    this.uiRoot.append(bottombar);
    this.updateSpeedLabel();

    this.panel = new SystemPanel(this.uiRoot, this.system, {
      onSelectPlanet: (p) => this.select(p, true),
      onFocusPlanet: (p) => this.focus(p),
      onLandPlanet: (p) => this.ctx.scenes.switchTo(new PlanetScene(p.id)),
    });
    this.disposer.addFn(() => this.panel.dispose());

    // Picking: Klick ohne Drag
    const canvas = ctx.renderer.canvas;
    this.disposer.listen(canvas, 'pointerdown', (e) => {
      this.pointerDown = { x: e.clientX, y: e.clientY };
    });
    this.disposer.listen(canvas, 'pointerup', (e) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved < 5 && e.button === 0) this.pick(e.clientX, e.clientY);
    });
    this.disposer.listen(canvas, 'pointerdown', () => {
      // Nutzer dreht selbst → Verfolgung beenden, wenn er zieht
      this.following = false;
    });
  }

  private updateSpeedLabel(): void {
    this.speedLabel.textContent = `${this.daysPerSecond} Tage/s · Tag ${Math.floor(this.simDays)}`;
  }

  private pick(clientX: number, clientY: number): void {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.nodes.map((n) => n.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      const id = hits[0]!.object.userData.planetId as string;
      const planet = this.system.planets.find((p) => p.id === id);
      if (planet) this.select(planet, false);
    }
  }

  private select(planet: Planet | null, fromPanel: boolean): void {
    this.selected = planet;
    for (const n of this.nodes) {
      const isSel = n.planet === planet;
      (n.orbitLine.material as LineBasicMaterial).opacity = isSel ? 0.9 : n.planet.isStart ? 0.6 : 0.28;
      n.label.classList.toggle('selected', isSel);
    }
    if (!fromPanel) this.panel.showPlanet(planet);
    this.following = false;
  }

  private focus(planet: Planet): void {
    this.select(planet, true);
    const node = this.nodes.find((n) => n.planet === planet);
    if (!node) return;
    node.mesh.getWorldPosition(this.tmpVec);
    const r = planetDisplayRadius(planet.radiusKm);
    this.controls.target.copy(this.tmpVec);
    this.camera.position.copy(this.tmpVec).add(new Vector3(r * 4, r * 2.5, r * 5));
    this.lastTarget.copy(this.tmpVec);
    this.following = true;
  }

  private backToMenu(): void {
    this.ctx.scenes.switchTo(new MainMenuScene());
  }

  // ---------------------------------------------------------------------------
  exit(): void {}

  update(dt: number): void {
    if (this.ctx.input.wasPressed('pause')) this.backToMenu();
    if (!this.paused) this.simDays += dt * this.daysPerSecond;
    if (this.ctx.input.keyDown('Space') && !this.ctx.input.textInputActive) {
      // Leertaste: nichts – reserviert
    }
  }

  render(_alpha: number, frameDt: number): void {
    const t = this.simDays;
    for (const n of this.nodes) {
      n.pivot.rotation.y = n.angle0 + n.angularSpeed * t;
      n.mesh.rotation.y = n.spin * t * 0.05;
      for (const m of n.moons) {
        const a = m.angle0 + m.angularSpeed * t;
        m.mesh.position.set(Math.cos(a) * m.radius, 0, Math.sin(a) * m.radius);
      }
    }
    if (this.following && this.selected) {
      const node = this.nodes.find((n) => n.planet === this.selected);
      if (node) {
        node.mesh.getWorldPosition(this.tmpVec);
        this.tmpVec.sub(this.lastTarget);
        this.controls.target.add(this.tmpVec);
        this.camera.position.add(this.tmpVec);
        this.lastTarget.add(this.tmpVec);
      }
    }
    this.controls.update();
    if (this.ctx.renderer.postprocessing) this.composer.render(frameDt);
    else this.ctx.renderer.gl.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    if ((this.ctx.loop.stats.frames & 15) === 0) this.updateSpeedLabel();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  }

  dispose(): void {
    this.disposer.dispose();
    this.nodes = [];
    this.scene.clear();
  }
}
