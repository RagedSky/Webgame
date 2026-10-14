import { Raycaster, Vector3, type Object3D, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { BrightnessContrastEffect, DepthOfFieldEffect, EffectPass, HueSaturationEffect, SepiaEffect, VignetteEffect, type EffectComposer } from 'postprocessing';
import { clamp } from '@/math/utils';
import type { ArchiveEntry } from '@/gen/archive/types';
import { scoreSubject, starsForScore, type CameraSettings, type ScoreBreakdown, type Stars, type SubjectObservation } from '@/game/photo/PhotoScoring';

export type PhotoFilter = 'none' | 'warm' | 'cool' | 'mono' | 'vivid' | 'vintage';
export const PHOTO_FILTERS: PhotoFilter[] = ['none', 'warm', 'cool', 'mono', 'vivid', 'vintage'];
export const FILTER_LABELS: Record<PhotoFilter, string> = { none: 'Neutral', warm: 'Warm', cool: 'Kühl', mono: 'Monochrom', vivid: 'Lebhaft', vintage: 'Vintage' };

export interface PhotoSettings {
  /** Blickwinkel in Grad (Zoom). */
  fov: number;
  focusDistance: number;
  /** Blende 0 (weit offen, enge Schärfe) … 1 (geschlossen, alles scharf). */
  aperture: number;
  exposure: number;
  filter: PhotoFilter;
  grid: boolean;
  selfie: boolean;
}

/** Ein mögliches Motiv in der Welt (von Kreaturen-, Vegetations-, Prop- und Himmel-Quellen geliefert). */
export interface SubjectCandidate {
  entry: ArchiveEntry;
  center: Vector3;
  radius: number;
  behavior?: string;
  motion: number;
  underwater: boolean;
  /** Himmelsphänomen: kein Weltobjekt, Bildanteil wird aus dem Kamerawinkel geschätzt. */
  sky?: boolean;
}

export interface PhotoSubjectSource {
  collectSubjects(cameraPos: Vector3, maxDist: number, out: SubjectCandidate[]): void;
}

export interface ScoredSubject {
  entry: ArchiveEntry;
  observation: SubjectObservation;
  score: ScoreBreakdown;
  stars: Stars;
  primary: boolean;
}

export interface PhotoEnv {
  daylight: number;
  sunDir: Vector3;
  cameraUnderwater: boolean;
  /** Objekte, die Motive verdecken können (Terrain-Gruppe, Props). */
  occluders: Object3D[];
  /** Toleranz-Bonus (Fotograf-Hintergrund), 0..1. */
  tolerance: number;
}

const tmpV = new Vector3();
const tmpDir = new Vector3();

/**
 * Foto-Modus: Kameraeinstellungen (Zoom, Fokus, Blende, Belichtung, Filter), Postprocessing-Effekte
 * (Tiefenschärfe, Vignette, Farbfilter) und Motivbewertung beim Auslösen.
 */
export class PhotoMode {
  active = false;
  readonly settings: PhotoSettings = { fov: 55, focusDistance: 12, aperture: 0.6, exposure: 1, filter: 'none', grid: true, selfie: false };
  private readonly dof: DepthOfFieldEffect;
  private readonly vignette: VignetteEffect;
  private readonly hueSat: HueSaturationEffect;
  private readonly brightness: BrightnessContrastEffect;
  private readonly sepia: SepiaEffect;
  private readonly pass: EffectPass;
  private readonly raycaster = new Raycaster();
  private readonly baseFov: number;
  private baseExposure = 1;
  private readonly candidates: SubjectCandidate[] = [];

  constructor(
    private readonly gl: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    private readonly composer: EffectComposer,
    private readonly sources: PhotoSubjectSource[],
  ) {
    this.baseFov = camera.fov;
    this.dof = new DepthOfFieldEffect(camera, { focusDistance: 12, focusRange: 8, bokehScale: 3, resolutionScale: 0.75 });
    this.vignette = new VignetteEffect({ offset: 0.35, darkness: 0.45 });
    this.hueSat = new HueSaturationEffect({ hue: 0, saturation: 0 });
    this.brightness = new BrightnessContrastEffect({ brightness: 0, contrast: 0 });
    this.sepia = new SepiaEffect({ intensity: 0 });
    this.pass = new EffectPass(camera, this.dof, this.hueSat, this.brightness, this.sepia, this.vignette);
    composer.addPass(this.pass);
    this.setPassEnabled(false);
  }

  /**
   * Der Composer gibt nur dem zuletzt hinzugefügten Pass `renderToScreen`. Ist der Foto-Pass aus, muss der
   * vorhergehende Pass auf den Bildschirm rendern – sonst bleibt die Leinwand schwarz.
   */
  private setPassEnabled(on: boolean): void {
    this.pass.enabled = on;
    this.pass.renderToScreen = on;
    const passes = this.composer.passes;
    const prev = passes[passes.indexOf(this.pass) - 1];
    if (prev) prev.renderToScreen = !on;
  }

  enter(): void {
    this.active = true;
    this.baseExposure = this.gl.toneMappingExposure;
    this.setPassEnabled(true);
    this.apply();
  }

  exit(): void {
    this.active = false;
    this.setPassEnabled(false);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.gl.toneMappingExposure = this.baseExposure;
    this.settings.selfie = false;
  }

  /** Schärfebereich in Metern aus Blende und Fokusentfernung. */
  get focusRange(): number {
    const s = this.settings;
    return 1.5 + s.aperture * 30 + s.focusDistance * (0.1 + s.aperture * 0.6);
  }

  apply(): void {
    const s = this.settings;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.gl.toneMappingExposure = this.baseExposure * s.exposure;
    this.dof.cocMaterial.focusDistance = s.focusDistance;
    this.dof.cocMaterial.focusRange = this.focusRange;
    this.dof.bokehScale = 1 + (1 - s.aperture) * 4;
    const f = s.filter;
    this.hueSat.hue = f === 'warm' ? 0.06 : f === 'cool' ? -0.08 : 0;
    this.hueSat.saturation = f === 'mono' ? -1 : f === 'vivid' ? 0.35 : f === 'vintage' ? -0.3 : f === 'warm' ? 0.1 : 0;
    this.brightness.contrast = f === 'vivid' ? 0.15 : f === 'vintage' ? -0.08 : 0;
    this.brightness.brightness = f === 'vintage' ? 0.05 : 0;
    this.sepia.intensity = f === 'vintage' ? 0.5 : 0;
    this.vignette.darkness = f === 'vintage' ? 0.7 : 0.45;
  }

  zoom(delta: number): void {
    this.settings.fov = clamp(this.settings.fov - delta, 14, 80);
    this.apply();
  }

  focus(delta: number): void {
    this.settings.focusDistance = clamp(this.settings.focusDistance * Math.exp(delta * 0.18), 0.5, 400);
    this.apply();
  }

  /** Autofokus: Entfernung zum nächsten Objekt im Fadenkreuz (oder zum nächsten Motiv nahe der Mitte). */
  autofocus(env: PhotoEnv, maxDist = 400): void {
    this.camera.getWorldDirection(tmpDir);
    this.raycaster.set(this.camera.position, tmpDir);
    this.raycaster.far = maxDist;
    let best = Infinity;
    // Motive nahe der Bildmitte haben Vorrang vor dem Terrain dahinter
    this.collect(maxDist);
    let subjectBest = Infinity;
    for (const c of this.candidates) {
      if (c.sky) continue;
      tmpV.subVectors(c.center, this.camera.position);
      const d = tmpV.length();
      if (d <= 0.01) continue;
      const cos = tmpV.divideScalar(d).dot(tmpDir);
      const angular = Math.atan2(c.radius, d);
      if (Math.acos(clamp(cos, -1, 1)) <= angular + 0.12 && d < subjectBest) subjectBest = d;
    }
    if (Number.isFinite(subjectBest)) best = subjectBest;
    else {
      const hits = this.raycaster.intersectObjects(env.occluders, true);
      if (hits.length) best = hits[0]!.distance;
    }
    if (Number.isFinite(best)) {
      this.settings.focusDistance = clamp(best, 0.5, 400);
      this.apply();
    }
  }

  cycleAperture(): void {
    const steps = [0.15, 0.4, 0.7, 1];
    const i = steps.findIndex((v) => v > this.settings.aperture + 0.01);
    this.settings.aperture = steps[i === -1 ? 0 : i] as number;
    this.apply();
  }

  exposureStep(delta: number): void {
    this.settings.exposure = clamp(this.settings.exposure * Math.pow(2, delta * 0.33), 0.35, 2.8);
    this.apply();
  }

  cycleFilter(): void {
    const i = PHOTO_FILTERS.indexOf(this.settings.filter);
    this.settings.filter = PHOTO_FILTERS[(i + 1) % PHOTO_FILTERS.length] as PhotoFilter;
    this.apply();
  }

  private collect(maxDist: number): void {
    this.candidates.length = 0;
    for (const s of this.sources) s.collectSubjects(this.camera.position, maxDist, this.candidates);
  }

  /** Leichte Vorschau: Motive im Bild mit Bildposition (keine Verdeckungsprüfung). */
  preview(out: Array<{ entry: ArchiveEntry; ndcX: number; ndcY: number; frameFill: number }> = []): typeof out {
    out.length = 0;
    this.collect(120);
    this.camera.updateMatrixWorld();
    const tanHalf = Math.tan(((this.camera.fov * Math.PI) / 180) / 2);
    for (const c of this.candidates) {
      if (c.sky) continue;
      tmpV.subVectors(c.center, this.camera.position);
      const dist = tmpV.length();
      if (dist < 0.3) continue;
      const ndc = tmpV.copy(c.center).project(this.camera);
      if (ndc.z > 1 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) continue;
      const frameFill = (c.radius * 2) / (dist * tanHalf * 2);
      if (frameFill < 0.04) continue;
      out.push({ entry: c.entry, ndcX: ndc.x, ndcY: ndc.y, frameFill });
    }
    return out;
  }

  /** Bewertet alle Motive im aktuellen Bild. */
  evaluate(env: PhotoEnv): ScoredSubject[] {
    this.collect(120);
    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(tmpDir);
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const tanHalf = Math.tan(fovRad / 2);
    const results: ScoredSubject[] = [];
    const cam: CameraSettings = { focusDistance: this.settings.focusDistance, focusRange: this.focusRange, exposure: this.settings.exposure };
    for (const c of this.candidates) {
      let obs: SubjectObservation;
      let kind: CameraSettings['kind'] = 'subject';
      if (c.sky) {
        // Himmelsanteil im Bild aus dem Kamerawinkel
        const pitch = Math.asin(clamp(tmpDir.y, -1, 1));
        const horizonNdc = clamp(Math.tan(-pitch) / tanHalf, -1, 1);
        const skyFraction = clamp((1 - horizonNdc) / 2, 0, 1);
        if (skyFraction < 0.2) continue;
        obs = { entryId: c.entry.id, frameFill: skyFraction, ndcX: 0, ndcY: (1 + horizonNdc) / 2, distance: 1000, occlusion: 0, lighting: 1, motion: 0 };
        kind = 'sky';
      } else {
        tmpV.subVectors(c.center, this.camera.position);
        const dist = tmpV.length();
        if (dist < 0.3) continue;
        const ndc = c.center.clone().project(this.camera);
        if (ndc.z > 1 || Math.abs(ndc.x) > 1.1 || Math.abs(ndc.y) > 1.1) continue;
        const frameFill = (c.radius * 2) / (dist * tanHalf * 2);
        if (frameFill < 0.03) continue;
        // Verdeckung: Strahl zur Mitte und zu zwei Punkten oben/unten
        let occluded = 0;
        const samples = 3;
        for (let i = 0; i < samples; i++) {
          const offsetY = (i - 1) * c.radius * 0.6;
          tmpV.copy(c.center);
          tmpV.y += offsetY;
          tmpV.sub(this.camera.position);
          const d = tmpV.length();
          this.raycaster.set(this.camera.position, tmpV.divideScalar(d));
          this.raycaster.far = Math.max(0, d - c.radius * 0.9);
          const hits = this.raycaster.intersectObjects(env.occluders, true);
          if (hits.length) occluded++;
        }
        let occlusion = occluded / samples;
        if (c.underwater !== env.cameraUnderwater) occlusion = Math.max(occlusion, 0.45);
        const toSun = clamp(0.5 + 0.5 * env.sunDir.y, 0, 1);
        const lighting = clamp(env.daylight * (0.55 + 0.45 * toSun) + (c.entry.genome.kind === 'fauna' && c.entry.genome.covering === 'bioluminescent' ? 0.5 : 0), 0, 1);
        obs = { entryId: c.entry.id, frameFill, ndcX: ndc.x, ndcY: ndc.y, distance: dist, occlusion, lighting, motion: c.motion, ...(c.behavior ? { behavior: c.behavior } : {}) };
      }
      const score = scoreSubject(obs, { ...cam, kind }, env.tolerance);
      if (!score.identified) continue;
      results.push({ entry: c.entry, observation: obs, score, stars: starsForScore(score.total), primary: false });
    }
    results.sort((a, b) => b.score.total - a.score.total);
    // Hauptmotiv voll, Nebenmotive mit Abzug; max. 3
    const out = results.slice(0, 3);
    out.forEach((r, i) => {
      if (i === 0) r.primary = true;
      else {
        r.score.total = Math.max(0, r.score.total - 15);
        r.stars = starsForScore(r.score.total);
      }
    });
    return out.filter((r) => r.stars > 0);
  }

  dispose(): void {
    this.dof.dispose();
    this.pass.dispose();
  }
}
