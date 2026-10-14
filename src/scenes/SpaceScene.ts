import { AdditiveBlending, AmbientLight, BackSide, BufferGeometry, Color, DoubleSide, EllipseCurve, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PointLight, Raycaster, RingGeometry, Scene, SphereGeometry, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { BloomEffect, EffectPass, type EffectComposer } from 'postprocessing';
import type { GameContext } from '@/core/GameContext';
import type { GameScene } from '@/core/Scene';
import { Disposer } from '@/core/Disposer';
import { gameState } from '@/game/GameState';
import { ensurePlayerState, savePlayerState } from '@/game/playerStore';
import type { PlayerState } from '@/game/PlayerState';
import { shipStats } from '@/game/ship/ShipDesign';
import { planTrip, type TripPlan } from '@/game/ship/travel';
import type { Planet, StarSystem } from '@/gen/universe/types';
import { createStarfield } from '@/render/Starfield';
import { createPlanetTexture } from '@/render/PlanetTexture';
import { buildShip, setFlames, ShipMaterials, type BuiltShip } from '@/world/ship/ShipBuilder';
import { HAZARD_LABELS } from '@/gen/universe/catalog';
import { ensureProgress, saveProgressStore } from '@/game/progressStore';
import type { ArchiveProgress } from '@/game/progress/ArchiveProgress';
import { terrainSizeFor } from '@/gen/terrain/TerrainModel';
import { atmosphereTargets, probeHintText } from '@/game/map/hotspots';
import { createSample } from '@/game/samples';
import { el, clear } from '@/ui/dom';
import { STR } from '@/ui/strings';
import { showToast } from '@/ui/toast';
import { audio } from '@/audio/AudioManager';
import { MainMenuScene } from './MainMenuScene';
import { PlanetScene } from './PlanetScene';
import { orbitDisplayRadius, planetDisplayRadius, starDisplayRadius } from './SystemViewScene';

interface Node {
  planet: Planet;
  mesh: Mesh;
  orbitLine: Line;
  label: HTMLElement;
  worldPos: Vector3;
  satellite: Mesh | null;
}

interface Transfer {
  to: Planet;
  from: Vector3;
  dest: Vector3;
  t: number;
  duration: number;
  cost: number;
}

/**
 * Orbit und Raumflug: stilisiertes Sternsystem, Lander im Orbit des aktuellen Planeten, Zielwahl mit
 * Treibstoffkosten und Stufenprüfung, animierter Transfer, Landung (→ PlanetScene mit Landesequenz).
 */
export class SpaceScene implements GameScene {
  readonly name = 'Space';
  private ctx!: GameContext;
  private system!: StarSystem;
  private state!: PlayerState;
  private progress!: ArchiveProgress;
  private sampleCounter = 0;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  private readonly disposer = new Disposer();
  private readonly mats = new ShipMaterials();
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private labelRenderer!: CSS2DRenderer;
  private nodes: Node[] = [];
  private ship: BuiltShip | null = null;
  private readonly shipGroup = new Group();
  private current!: Planet;
  private selected: Planet | null = null;
  private transfer: Transfer | null = null;
  private uiRoot!: HTMLElement;
  private list!: HTMLElement;
  private topInfo!: HTMLElement;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly tmp = new Vector3();
  private readonly lastShipPos = new Vector3();
  private pointerDown: { x: number; y: number } | null = null;
  private ready = false;
  private time = 0;

  async enter(ctx: GameContext): Promise<void> {
    this.ctx = ctx;
    this.system = gameState.getSystem();
    ctx.debug.setScene(this.name);
    ctx.debug.setSeed(this.system.seed);
    this.state = await ensurePlayerState(this.system.seed);
    this.progress = await ensureProgress(this.system.seed, this.system.entries);
    const loc = this.state.ship.location;
    const currentId = loc?.kind === 'orbit' ? loc.planetId : (loc?.planetId ?? this.system.startPlanetId);
    this.current = this.system.planets.find((p) => p.id === currentId) ?? this.system.planets[0]!;
    if (loc?.kind !== 'orbit') {
      this.state.ship.location = { kind: 'orbit', planetId: this.current.id };
      this.state.touch();
    }
    this.buildScene();
    this.buildUi();
    this.placeShipAt(this.current);
    this.focus(this.current);
    this.ready = true;
    audio.clearAmbient();
    audio.setMusic('space');
    showToast(`${STR.space.orbiting} ${this.current.name}`);
  }

  private buildScene(): void {
    const sys = this.system;
    const gl = this.ctx.renderer.gl;
    this.scene.background = new Color(0x03050a);
    this.scene.add(createStarfield(this.disposer, `stars:${sys.seed}`, 3000, [400, 900]));
    const starR = starDisplayRadius(sys.star.radius);
    const starGeo = this.disposer.add(new SphereGeometry(starR, 48, 32));
    const starMat = this.disposer.add(new MeshBasicMaterial({ color: new Color(sys.star.color).multiplyScalar(1.6) }));
    this.scene.add(new Mesh(starGeo, starMat));
    const glowGeo = this.disposer.add(new SphereGeometry(starR * 1.35, 32, 24));
    const glowMat = this.disposer.add(new MeshBasicMaterial({ color: sys.star.color, transparent: true, opacity: 0.22, blending: AdditiveBlending, side: BackSide, depthWrite: false }));
    this.scene.add(new Mesh(glowGeo, glowMat));
    this.scene.add(new PointLight(sys.star.lightColor, 2.6, 0, 0));
    this.scene.add(new AmbientLight(0x8899bb, 0.3));
    const hzGeo = this.disposer.add(new RingGeometry(orbitDisplayRadius(sys.star.habitableZoneAu[0]), orbitDisplayRadius(sys.star.habitableZoneAu[1]), 128));
    const hzMat = this.disposer.add(new MeshBasicMaterial({ color: 0x3fd98a, transparent: true, opacity: 0.07, side: DoubleSide, depthWrite: false }));
    const hz = new Mesh(hzGeo, hzMat);
    hz.rotation.x = -Math.PI / 2;
    this.scene.add(hz);

    const sphereGeo = this.disposer.add(new SphereGeometry(1, 40, 28));
    sys.planets.forEach((planet, i) => {
      const orbitRadius = orbitDisplayRadius(planet.orbitRadiusAu);
      const angle = (i * 2.399963) % (Math.PI * 2);
      const tex = this.disposer.add(createPlanetTexture(planet));
      const mat = this.disposer.add(new MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      const mesh = new Mesh(sphereGeo, mat);
      const r = planetDisplayRadius(planet.radiusKm);
      mesh.scale.setScalar(r);
      mesh.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
      mesh.rotation.z = (planet.axialTiltDeg * Math.PI) / 180;
      mesh.userData.planetId = planet.id;
      this.scene.add(mesh);
      const curve = new EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(160).map((p) => new Vector3(p.x, 0, p.y));
      const orbitGeo = this.disposer.add(new BufferGeometry().setFromPoints(pts));
      const orbitMat = this.disposer.add(new LineBasicMaterial({ color: planet.isStart ? 0xffd38a : 0x6fa6ff, transparent: true, opacity: planet.isStart ? 0.6 : 0.28 }));
      const orbitLine = new Line(orbitGeo, orbitMat);
      this.scene.add(orbitLine);
      const label = el('div', { class: `planet-label ${planet.isStart ? 'start' : ''}`, text: planet.isStart ? `★ ${planet.name}` : planet.name });
      const labelObj = new CSS2DObject(label);
      labelObj.position.set(0, 1.4, 0);
      mesh.add(labelObj);
      this.nodes.push({ planet, mesh, orbitLine, label, worldPos: mesh.position.clone(), satellite: null });
    });
    for (const n of this.nodes) this.syncSatellite(n);

    this.ship = buildShip(this.state.ship.design, this.mats);
    this.ship.group.scale.setScalar(0.35);
    this.ship.group.rotation.z = -Math.PI / 2;
    this.shipGroup.add(this.ship.group);
    this.scene.add(this.shipGroup);

    const outer = this.nodes.length ? orbitDisplayRadius(this.nodes[this.nodes.length - 1]!.planet.orbitRadiusAu) : 60;
    this.camera.far = Math.max(2000, outer * 20);
    this.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(this.camera, gl.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = outer * 4;
    this.disposer.addFn(() => this.controls.dispose());
    this.composer = this.ctx.renderer.createComposer(this.scene, this.camera);
    this.composer.addPass(new EffectPass(this.camera, new BloomEffect({ luminanceThreshold: 0.75, luminanceSmoothing: 0.2, intensity: 1.1, mipmapBlur: true, radius: 0.6 })));
    this.disposer.addFn(() => this.ctx.renderer.disposeComposer(this.composer));
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    this.disposer.addObject3D(this.scene);
  }

  private buildUi(): void {
    const ctx = this.ctx;
    this.uiRoot = el('div', { class: 'system-ui space-ui' });
    ctx.uiRoot.append(this.uiRoot);
    this.disposer.addDom(this.uiRoot);
    this.uiRoot.append(this.labelRenderer.domElement);
    this.topInfo = el('span', { class: 'muted' });
    this.uiRoot.append(
      el('div', { class: 'panel system-topbar' }, el('span', { class: 'sysname', text: `${this.system.name} · ${STR.space.title}` }), this.topInfo, el('button', { class: 'small', text: STR.space.back, onClick: () => this.toMenu() })),
      el('div', { class: 'panel system-bottombar' }, el('span', { class: 'muted', text: STR.space.hint })),
    );
    this.list = el('div', { class: 'panel space-panel' });
    this.uiRoot.append(this.list);
    this.renderList();
    const canvas = ctx.renderer.canvas;
    this.disposer.listen(canvas, 'pointerdown', (e) => (this.pointerDown = { x: e.clientX, y: e.clientY }));
    this.disposer.listen(canvas, 'pointerup', (e) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved < 5 && e.button === 0) this.pick(e.clientX, e.clientY);
    });
  }

  /** Kleiner Satellit, der den Planeten umkreist (sofern vorhanden). */
  private syncSatellite(n: Node): void {
    const tier = this.state.satellites[n.planet.id] ?? 0;
    if (tier > 0 && !n.satellite) {
      const geo = this.disposer.add(new SphereGeometry(0.12, 8, 6));
      const mat = this.disposer.add(new MeshBasicMaterial({ color: tier >= 2 ? 0x8fe3ff : 0xffd38a }));
      const m = new Mesh(geo, mat);
      this.scene.add(m);
      n.satellite = m;
    }
  }

  private nodeOf(planet: Planet): Node {
    return this.nodes.find((n) => n.planet === planet)!;
  }

  private placeShipAt(planet: Planet): void {
    const n = this.nodeOf(planet);
    const r = planetDisplayRadius(planet.radiusKm);
    this.shipGroup.position.copy(n.worldPos).add(new Vector3(r * 1.8, r * 0.4, 0));
    this.lastShipPos.copy(this.shipGroup.position);
  }

  private focus(planet: Planet): void {
    const n = this.nodeOf(planet);
    const r = planetDisplayRadius(planet.radiusKm);
    this.controls.target.copy(n.worldPos);
    this.camera.position.copy(n.worldPos).add(new Vector3(r * 4, r * 2.5, r * 5.5));
  }

  private pick(clientX: number, clientY: number): void {
    const rect = this.ctx.renderer.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.nodes.map((n) => n.mesh), false);
    if (hits.length) {
      const planet = this.system.planets.find((p) => p.id === hits[0]!.object.userData.planetId);
      if (planet) this.select(planet);
    }
  }

  private select(planet: Planet): void {
    this.selected = planet;
    for (const n of this.nodes) {
      (n.orbitLine.material as LineBasicMaterial).opacity = n.planet === planet ? 0.9 : n.planet.isStart ? 0.6 : 0.28;
      n.label.classList.toggle('selected', n.planet === planet);
    }
    this.renderList();
  }

  private plan(to: Planet): TripPlan {
    return planTrip(shipStats(this.state.ship.design), this.state.ship.fuel, this.current, to);
  }

  private renderList(): void {
    const s = shipStats(this.state.ship.design);
    this.topInfo.textContent = `${STR.space.orbiting} ${this.current.name} · ${STR.ship.fuel} ${this.state.ship.fuel}/${s.maxFuel} · ${STR.ship.engine} ${s.engineTier} · ${STR.ship.shield} ${s.shieldTier}`;
    clear(this.list);
    this.list.append(el('h2', { text: STR.space.destination }));
    const sorted = [...this.system.planets].sort((a, b) => Math.abs(a.orbitRadiusAu - this.current.orbitRadiusAu) - Math.abs(b.orbitRadiusAu - this.current.orbitRadiusAu));
    for (const p of sorted) {
      const here = p === this.current;
      const plan = this.plan(p);
      const canFly = !here && plan.reach.ok && this.state.ship.fuel >= plan.transfer && !this.transfer;
      const canLand = here && plan.land.ok && !this.transfer;
      const stranded = here && plan.land.ok && this.state.ship.fuel < plan.landing;
      const reasons = [...(!plan.reach.ok ? plan.reach.reasons : []), ...(!plan.land.ok ? plan.land.reasons : [])];
      const hazards = p.hazards.map((h) => HAZARD_LABELS[h]).join(', ');
      const satTier = this.state.satellites[p.id] ?? 0;
      const mapPct = Math.round(this.state.mapGrid(p.id, terrainSizeFor(p)).fraction() * 100);
      const mapInfo = `${STR.map.title} ${mapPct} % · ${STR.map.satellite} ${satTier ? `${STR.ship.level} ${satTier}` : STR.map.none}${this.state.atmoProbes.includes(p.id) ? ` · ${STR.probe.atmoHave}` : ''}`;
      const row = el(
        'div',
        { class: `space-row ${here ? 'here' : ''} ${this.selected === p ? 'sel' : ''} ${plan.reach.ok ? '' : 'locked'}` },
        el('div', { class: 'col' }, el('span', { class: 'name', text: `${p.isStart ? '★ ' : ''}${p.name}${here ? ` (${STR.space.here})` : ''}` }), el('span', { class: 'muted small', text: `${p.typeLabel} · ${p.orbitRadiusAu.toFixed(2)} AU · ${p.gravity.toFixed(2)} g${hazards ? ` · ${hazards}` : ''}` }), el('span', { class: 'muted small', text: here ? `${STR.space.landing}: ${plan.landing} ${STR.space.fuelCost}` : `${STR.space.transfer} ${plan.transfer} + ${STR.space.landing} ${plan.landing} = ${plan.total} ${STR.space.fuelCost} · Δ ${Math.abs(p.orbitRadiusAu - this.current.orbitRadiusAu).toFixed(2)} AU` }), el('span', { class: 'muted small', text: mapInfo }), reasons.length ? el('span', { class: 'small bad', text: reasons.join(' · ') }) : el('span')),
        el(
          'div',
          { class: 'col btns' },
          here ? el('button', { class: 'small primary', text: stranded ? `${STR.space.land} (0)` : STR.space.land, disabled: !canLand, title: plan.land.ok ? '' : STR.space.noLanding, onClick: () => this.land() }) : el('button', { class: 'small primary', text: STR.space.fly, disabled: !canFly, title: !plan.reach.ok ? STR.space.unreachable : this.state.ship.fuel < plan.transfer ? STR.space.cannotAfford : '', onClick: () => this.fly(p) }),
          here ? this.probeButtons(p) : null,
        ),
      );
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        this.select(p);
        this.focus(p);
      });
      this.list.append(row);
    }
  }

  /** Satellit aussetzen / Atmosphärensonde starten (nur beim aktuellen Planeten). */
  private probeButtons(p: Planet): HTMLElement {
    const inv = this.state.inventory;
    const stats = shipStats(this.state.ship.design);
    const newTier = Math.max(1, stats.scannerTier);
    const have = this.state.satellites[p.id] ?? 0;
    const host = el('div', { class: 'col' });
    if (inv.getItem('satellite') > 0) host.append(el('button', { class: 'small', text: `${STR.probe.satDeploy} (${STR.ship.level} ${newTier})`, disabled: have >= newTier || !!this.transfer, title: have >= newTier ? STR.probe.satHave : '', onClick: () => this.deploySatellite(p, newTier) }));
    if (inv.getItem('atmo_probe') > 0) {
      const done = this.state.atmoProbes.includes(p.id);
      host.append(el('button', { class: 'small', text: STR.probe.atmoDeploy, disabled: p.type !== 'gas_giant' || done || !!this.transfer, title: p.type !== 'gas_giant' ? STR.probe.atmoOnlyGas : done ? STR.probe.atmoHave : '', onClick: () => this.launchAtmoProbe(p) }));
    }
    return host;
  }

  private deploySatellite(p: Planet, tier: number): void {
    const inv = this.state.inventory;
    if (!inv.removeItem('satellite')) return;
    this.state.satellites[p.id] = Math.max(this.state.satellites[p.id] ?? 0, tier);
    this.state.mapGrid(p.id, terrainSizeFor(p)).revealAll(2);
    this.state.touch();
    void savePlayerState(this.state);
    const n = this.nodeOf(p);
    if (n.satellite) {
      this.scene.remove(n.satellite);
      n.satellite = null;
    }
    this.syncSatellite(n);
    showToast(`${STR.probe.satDone}${tier >= 2 ? ` · ${STR.probe.satTier2}` : ''}`, 5000);
    audio.success(2);
    this.renderList();
  }

  private launchAtmoProbe(p: Planet): void {
    const inv = this.state.inventory;
    if (p.type !== 'gas_giant' || this.state.atmoProbes.includes(p.id)) return;
    if (!inv.removeItem('atmo_probe')) return;
    const now = performance.now() / 1000;
    const targets = atmosphereTargets(this.system.entries, p, (id) => this.progress.isDiscovered(id));
    let discovered = 0;
    let hints = 0;
    for (const e of targets) {
      if (e.category === 'weather') {
        this.progress.discoverByAnalysis(e.id, 0.5, now);
        discovered++;
      } else if (!this.progress.isHinted(e.id)) {
        this.progress.addHint(e.id, probeHintText('Atmosphärensonde', e, p), now);
        hints++;
      }
    }
    const biome = p.biomes[0];
    if (biome) this.progress.addSample(createSample('air', p, biome, now, ++this.sampleCounter));
    this.state.atmoProbes.push(p.id);
    this.state.mapGrid(p.id, terrainSizeFor(p)).reveal(0, 0, 1500, 1);
    this.state.touch();
    void savePlayerState(this.state);
    void saveProgressStore(this.progress);
    this.progress.addLog('info', `${STR.probe.atmoDone}: ${p.name} – ${discovered} ${STR.probe.discovered}, ${hints} ${STR.probe.hints}`, now, undefined, p.id);
    showToast(`${STR.probe.atmoDone}: ${discovered} ${STR.probe.discovered} · ${hints} ${STR.probe.hints} · Luftprobe im Archiv`, 6000);
    audio.success(3);
    this.renderList();
  }

  private fly(to: Planet): void {
    if (this.transfer) return;
    const plan = this.plan(to);
    if (!plan.reach.ok || this.state.ship.fuel < plan.transfer) return;
    audio.unlock();
    const from = this.shipGroup.position.clone();
    const n = this.nodeOf(to);
    const r = planetDisplayRadius(to.radiusKm);
    const dest = n.worldPos.clone().add(new Vector3(r * 1.8, r * 0.4, 0));
    this.transfer = { to, from, dest, t: 0, duration: 2.5 + Math.min(6, from.distanceTo(dest) * 0.08), cost: plan.transfer };
    this.select(to);
    showToast(`${STR.space.flying} ${to.name}`);
    audio.blip();
    this.renderList();
  }

  private finishTransfer(): void {
    const tr = this.transfer;
    if (!tr) return;
    this.transfer = null;
    this.state.ship.fuel = Math.max(0, this.state.ship.fuel - tr.cost);
    this.state.ship.location = { kind: 'orbit', planetId: tr.to.id };
    this.current = tr.to;
    this.state.touch();
    void savePlayerState(this.state);
    this.placeShipAt(tr.to);
    this.focus(tr.to);
    showToast(`${STR.space.arrived}: ${tr.to.name}`);
    audio.success(1);
    this.renderList();
  }

  private land(): void {
    if (this.transfer) return;
    const plan = this.plan(this.current);
    if (!plan.land.ok) return;
    const cost = Math.min(plan.landing, this.state.ship.fuel);
    if (cost < plan.landing) showToast(STR.space.stranded, 4000);
    this.state.ship.fuel -= cost;
    // Ohne gespeicherten Landeplatz wählt die Planetenszene beim Eintritt einen flachen Platz (x/z nicht endlich)
    const site = this.state.sites[this.current.id];
    this.state.ship.location = { kind: 'surface', planetId: this.current.id, x: site?.x ?? Number.NaN, z: site?.z ?? Number.NaN, rot: site?.rot ?? 0 };
    this.state.touch();
    void savePlayerState(this.state);
    gameState.surface = null;
    gameState.arrival = 'landing';
    this.ctx.scenes.switchTo(new PlanetScene(this.current.id));
  }

  private toMenu(): void {
    void savePlayerState(this.state);
    this.ctx.scenes.switchTo(new MainMenuScene());
  }

  exit(): void {}

  update(dt: number): void {
    if (!this.ready) return;
    this.time += dt;
    this.state.playtime += dt;
    if (this.ctx.input.wasPressed('pause') && !this.transfer) this.toMenu();
    if (this.transfer) {
      const tr = this.transfer;
      tr.t += dt;
      const u = Math.min(1, tr.t / tr.duration);
      const e = u * u * (3 - 2 * u);
      const lift = Math.sin(u * Math.PI) * tr.from.distanceTo(tr.dest) * 0.18;
      this.shipGroup.position.lerpVectors(tr.from, tr.dest, e);
      this.shipGroup.position.y += lift;
      this.tmp.subVectors(this.shipGroup.position, this.lastShipPos);
      this.controls.target.add(this.tmp);
      this.camera.position.add(this.tmp);
      this.lastShipPos.copy(this.shipGroup.position);
      if (u >= 1) this.finishTransfer();
    }
  }

  render(_alpha: number, frameDt: number): void {
    if (!this.ready) return;
    if (this.ship) {
      setFlames(this.ship, this.transfer ? 1 : 0.15, this.time);
      this.shipGroup.rotation.y = this.time * 0.15;
    }
    for (const n of this.nodes) {
      if (!n.satellite) continue;
      const r = planetDisplayRadius(n.planet.radiusKm) * 1.5;
      const a = this.time * 0.9 + n.planet.index;
      n.satellite.position.set(n.worldPos.x + Math.cos(a) * r, n.worldPos.y + Math.sin(a * 0.7) * r * 0.3, n.worldPos.z + Math.sin(a) * r);
    }
    this.controls.update();
    if (this.ctx.renderer.postprocessing) this.composer.render(frameDt);
    else this.ctx.renderer.gl.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(width, height);
    this.labelRenderer?.setSize(width, height);
  }

  dispose(): void {
    this.ready = false;
    this.ship?.dispose();
    this.mats.dispose();
    this.disposer.dispose();
    this.nodes = [];
    this.scene.clear();
  }
}
