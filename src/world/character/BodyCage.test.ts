import { describe, expect, it } from 'vitest';
import { Random } from '@/math/Random';
import { BUILTIN_PRESETS, HELMET_SHAPES, SUIT_PATTERNS, VISOR_STYLES, defaultCharacter, randomCharacter } from '@/game/character/Character';
import { BONES, BONE_PARENTS, ZONE, buildBodyCage, buildBodyMesh, specFromConfig } from './BodyCage';
import { analyze, subdivide, type QuadMesh } from './QuadMesh';
import { bodyGeometry, buildCharacter } from './CharacterBuilder';
import { Color } from 'three';

const configs = [defaultCharacter(), ...BUILTIN_PRESETS.map((p) => p.config), ...Array.from({ length: 8 }, (_, i) => randomCharacter(new Random(`MESH-${i}`)))];

function bounds(mesh: QuadMesh): { minY: number; maxY: number; maxX: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    minY = Math.min(minY, mesh.positions[i + 1]!);
    maxY = Math.max(maxY, mesh.positions[i + 1]!);
    maxX = Math.max(maxX, Math.abs(mesh.positions[i]!));
  }
  return { minY, maxY, maxX };
}

describe('Körpernetz', () => {
  it('Käfig ist ein einziges geschlossenes, sauber ausgerichtetes Quad-Netz ohne Henkel', () => {
    for (const cfg of configs) {
      const report = analyze(buildBodyCage(specFromConfig(cfg)).mesh);
      expect(report.components, 'zusammenhängend').toBe(1);
      expect(report.boundaryEdges, 'keine Löcher').toBe(0);
      expect(report.nonManifoldEdges, 'mannigfaltig').toBe(0);
      expect(report.inconsistentEdges, 'einheitlich ausgerichtet').toBe(0);
      expect(report.euler, 'Kugeltopologie').toBe(2);
      expect(report.volume).toBeGreaterThan(0.04);
      // nur wenige irreguläre Punkte: Schritt, Schultern, Deckel, Daumen
      for (const v of Object.keys(report.valence)) expect([3, 4, 5, 6]).toContain(Number(v));
      expect(report.regular).toBeGreaterThan(0.88);
    }
  });

  it('Unterteilung erhält Topologie und Gewichte und macht das Netz fast vollständig regulär', () => {
    const cage = buildBodyCage(specFromConfig(defaultCharacter()));
    const base = analyze(cage.mesh);
    const fine = buildBodyMesh(cage, 2);
    const report = analyze(fine);
    expect(report.faces).toBe(base.faces * 16);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.inconsistentEdges).toBe(0);
    expect(report.euler).toBe(2);
    expect(report.components).toBe(1);
    expect(report.regular).toBeGreaterThan(0.99);
    // irreguläre Punkte vermehren sich nicht
    expect((report.valence[3] ?? 0) + (report.valence[5] ?? 0) + (report.valence[6] ?? 0)).toBe((base.valence[3] ?? 0) + (base.valence[5] ?? 0) + (base.valence[6] ?? 0));
    for (let v = 0; v < report.vertices; v++) {
      let sum = 0;
      for (let b = 0; b < fine.bones; b++) {
        const w = fine.weights[v * fine.bones + b]!;
        expect(w).toBeGreaterThanOrEqual(0);
        sum += w;
      }
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    }
    expect(fine.zones.length).toBe(report.faces);
    expect(fine.uvs.length).toBe(report.faces * 8);
  });

  it('steht auf dem Boden, erreicht die Nennhöhe und ist spiegelsymmetrisch', () => {
    for (const cfg of configs) {
      const cage = buildBodyCage(specFromConfig(cfg));
      const fine = buildBodyMesh(cage, 2);
      const b = bounds(fine);
      expect(Math.abs(b.minY)).toBeLessThan(0.01);
      expect(Math.abs(b.maxY - cage.height)).toBeLessThan(0.03);
      expect(cage.height).toBeGreaterThan(1.6);
      expect(cage.height).toBeLessThan(1.95);
      // links und rechts gleich viel Fläche: Summe aller x ist null
      let sumX = 0;
      for (let i = 0; i < fine.positions.length; i += 3) sumX += fine.positions[i]!;
      expect(Math.abs(sumX / (fine.positions.length / 3))).toBeLessThan(1e-6);
    }
  });

  it('alle Helmformen, Visiere und Muster ergeben gültige Netze; das Visier ist immer vorhanden', () => {
    for (const helmet of HELMET_SHAPES) {
      for (const visor of VISOR_STYLES) {
        for (const pattern of SUIT_PATTERNS) {
          const mesh = buildBodyCage({ height: 0.5, build: 0.5, shoulders: 0.5, legLength: 0.5, armor: 0.5, helmet, visor, pattern }).mesh;
          const report = analyze(mesh);
          expect(report.euler).toBe(2);
          expect(report.boundaryEdges).toBe(0);
          const visorFaces = mesh.zones.filter((z) => z === ZONE.VISOR).length;
          expect(visorFaces).toBe(visor === 'panorama' ? 8 : visor === 'band' ? 4 : visor === 'window' ? 4 : 2);
          for (const z of mesh.zones) expect(z).toBeGreaterThanOrEqual(0);
        }
      }
    }
    const striped = buildBodyCage({ ...specFromConfig(defaultCharacter()), pattern: 'stripes' }).mesh.zones.filter((z) => z === ZONE.FABRIC2).length;
    const solid = buildBodyCage({ ...specFromConfig(defaultCharacter()), pattern: 'solid' }).mesh.zones.filter((z) => z === ZONE.FABRIC2).length;
    expect(striped).toBeGreaterThan(solid);
  });

  it('Skelett: jeder Knochen hat ein Gelenk, Eltern stehen vor ihren Kindern', () => {
    const cage = buildBodyCage(specFromConfig(defaultCharacter()));
    expect(cage.joints.length).toBe(BONES.length);
    BONE_PARENTS.forEach((parent, i) => expect(parent).toBeLessThan(i));
    // jeder Knochen bewegt mindestens einen Punkt
    const used = new Array<number>(BONES.length).fill(0);
    for (let i = 0; i < cage.mesh.weights.length; i++) if (cage.mesh.weights[i]! > 0.5) used[i % BONES.length]!++;
    for (let b = 0; b < BONES.length; b++) expect(used[b], BONES[b]).toBeGreaterThan(0);
  });

  it('Catmull-Clark: ein Würfel schrumpft zur Kugel hin und bleibt geschlossen', () => {
    const cube: QuadMesh = {
      positions: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1],
      faces: [0, 3, 2, 1, 4, 5, 6, 7, 0, 1, 5, 4, 2, 3, 7, 6, 1, 2, 6, 5, 0, 4, 7, 3],
      zones: [0, 0, 0, 0, 0, 0],
      uvs: new Array<number>(48).fill(0),
      weights: new Array<number>(8).fill(1),
      bones: 1,
    };
    const once = subdivide(cube);
    const report = analyze(once);
    expect(report.vertices).toBe(26);
    expect(report.faces).toBe(24);
    expect(report.euler).toBe(2);
    expect(report.inconsistentEdges).toBe(0);
    // Eckpunkte wandern nach innen: (F + 2R + (n − 3)P) / n mit n = 3
    expect(Math.abs(once.positions[0]! + 5 / 9)).toBeLessThan(1e-9);
    expect(analyze(subdivide(once)).volume).toBeLessThan(analyze(cube).volume);
  });

  it('Geometrie und Figur: Hautattribute vollständig, Punkte nur an Nähten verdoppelt', () => {
    const cfg = defaultCharacter();
    const fine = buildBodyMesh(buildBodyCage(specFromConfig(cfg)), 2);
    const geo = bodyGeometry(fine, new Color(cfg.suit.primary), new Color(cfg.suit.secondary));
    const count = geo.getAttribute('position').count;
    expect(geo.getIndex()!.count).toBe((fine.faces.length / 4) * 6);
    expect(count).toBeGreaterThanOrEqual(fine.positions.length / 3);
    // Nähte kosten wenige Punkte zusätzlich
    expect(count).toBeLessThan((fine.positions.length / 3) * 1.25);
    for (const name of ['normal', 'uv', 'color', 'skinIndex', 'skinWeight']) expect(geo.getAttribute(name).count).toBe(count);
    const sw = geo.getAttribute('skinWeight');
    for (let i = 0; i < count; i++) expect(Math.abs(sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i) - 1)).toBeLessThan(1e-5);
    expect(geo.groups.length).toBe(5);
    geo.dispose();
    for (const c of configs.slice(0, 4)) {
      const built = buildCharacter(c);
      expect(built.height).toBeGreaterThan(1.6);
      expect(built.eyeHeight).toBeLessThan(built.height);
      expect(built.eyeHeight).toBeGreaterThan(built.height - 0.2);
      built.animate(0.1, 3, true);
      built.animate(0.1, 0, false);
      built.dispose();
    }
  });
});
