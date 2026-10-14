import { Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3, type Scene } from 'three';
import { Random } from '@/math/Random';
import type { TerrainModel } from '@/gen/terrain/TerrainModel';
import type { Planet, WeatherType } from '@/gen/universe/types';
import { WEATHER } from '@/gen/universe/catalog';
import type { ArchiveEntry, Family, FaunaGenome, HintKind } from '@/gen/archive/types';
import { RARITY_LABELS, TIME_LABELS } from '@/gen/archive/types';
import { RARITY_SPAWN_WEIGHT } from '@/gen/archive/conditions';
import type { ArchiveProgress } from '@/game/progress/ArchiveProgress';

interface HintProp {
  entry: ArchiveEntry;
  kind: HintKind;
  mesh: Group;
  pos: Vector3;
  ttl: number;
  text: string;
}

export interface HintEvent {
  entry: ArchiveEntry;
  text: string;
  kind: HintKind;
}

/**
 * Hinweissystem: Spuren, Kot und Nester erscheinen in der Nähe des Spielers für noch unentdeckte Arten des aktuellen
 * Bioms; Geräusche und Gerüche kommen als Meldung. Beim Aufsammeln landet ein Logbuch-Hinweis im Archiv.
 * Gerüchte entstehen, wenn Verwandte einer seltenen Art entdeckt werden.
 */
export class HintSystem {
  readonly group = new Group();
  readonly stats = { active: 0, given: 0 };
  /** Hinweis-Häufigkeit (Biologe: 1,7). */
  rate = 1;
  private readonly props: HintProp[] = [];
  private readonly rng: Random;
  private timer = 20;
  private readonly fauna: ArchiveEntry[];
  private readonly families = new Map<string, Family>();
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly geoTrack = new SphereGeometry(0.16, 8, 6);
  private readonly geoDrop = new SphereGeometry(0.1, 7, 5);
  private readonly geoNest = new TorusGeometry(0.5, 0.14, 7, 14);
  private readonly matDark: MeshStandardMaterial;
  private readonly matNest: MeshStandardMaterial;

  constructor(
    scene: Scene,
    private readonly model: TerrainModel,
    planet: Planet,
    entries: ArchiveEntry[],
    families: Family[],
    private readonly progress: ArchiveProgress,
    seed: string,
  ) {
    this.rng = new Random(`hints:${seed}:${planet.id}`);
    this.fauna = entries.filter((e) => e.planetId === planet.id && e.genome.kind === 'fauna');
    for (const f of families) this.families.set(f.id, f);
    this.matDark = new MeshStandardMaterial({ color: new Color(0.16, 0.13, 0.1), roughness: 1 });
    this.matNest = new MeshStandardMaterial({ color: new Color(0.45, 0.35, 0.2), roughness: 1 });
    this.materials.push(this.matDark, this.matNest);
    scene.add(this.group);
  }

  /** Text eines Hinweises: verrät Biom, Tageszeit, ggf. Wetter und ein Körpermerkmal. */
  hintText(entry: ArchiveEntry, kind: HintKind, biomeName: string): string {
    const g = entry.genome as FaunaGenome;
    const fam = this.families.get(entry.familyId);
    const genus = fam?.name ?? 'unbekannte Gattung';
    const time = entry.spawn.timeOfDay === 'any' ? 'zu jeder Tageszeit' : TIME_LABELS[entry.spawn.timeOfDay];
    const weather = entry.spawn.weather === 'any' ? '' : `, bei ${entry.spawn.weather.map((w: WeatherType) => WEATHER[w].name).join(' oder ')}`;
    const size = g.lengthM < 0.5 ? 'kleines' : g.lengthM < 2 ? 'mittelgroßes' : 'großes';
    const rarity = entry.rarity === 'common' ? '' : ` (${RARITY_LABELS[entry.rarity].toLowerCase()})`;
    switch (kind) {
      case 'tracks':
        return `Fußspuren: ${g.legs > 0 ? `${g.legs} Beine` : 'Schleifspur ohne Beine'}, ${size} Tier der Gattung ${genus} – ${biomeName}, ${time}${weather}${rarity}.`;
      case 'droppings':
        return `Kot eines ${size}en ${g.covering === 'chitin' ? 'Panzertiers' : 'Tiers'} der Gattung ${genus} – ${biomeName}, aktiv ${time}${weather}${rarity}.`;
      case 'nest':
        return `Ein verlassenes Nest der Gattung ${genus} – die Art lebt ${g.locomotion === 'air' ? 'in der Luft' : g.locomotion === 'water' ? 'im Wasser' : 'am Boden'} in ${biomeName}, ${time}${weather}${rarity}.`;
      case 'sounds':
        return `Ein fremdes Rufen aus ${biomeName}: Gattung ${genus}, ${time}${weather}${rarity}.`;
      case 'scent':
        return `Ein strenger Geruch liegt über ${biomeName}: ${genus}-Art, ${time}${weather}${rarity}.`;
      default:
        return `Spuren einer ${genus}-Art in ${biomeName}, ${time}${weather}${rarity}.`;
    }
  }

  private buildProp(kind: HintKind, rng: Random): Group {
    const g = new Group();
    if (kind === 'tracks') {
      for (let i = 0; i < 5; i++) {
        const m = new Mesh(this.geoTrack, this.matDark);
        m.scale.set(1, 0.25, 1.5);
        m.position.set((i % 2) * 0.5 - 0.25, 0.03, i * 0.7);
        g.add(m);
      }
    } else if (kind === 'droppings') {
      for (let i = 0; i < 3; i++) {
        const m = new Mesh(this.geoDrop, this.matDark);
        m.position.set(rng.float(-0.25, 0.25), 0.08, rng.float(-0.25, 0.25));
        g.add(m);
      }
    } else {
      const m = new Mesh(this.geoNest, this.matNest);
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.12;
      g.add(m);
    }
    return g;
  }

  private spawnHint(playerPos: Vector3, biomeId: string, biomeName: string): void {
    const candidates = this.fauna
      .filter((e) => e.biomeIds.includes(biomeId) && !this.progress.isDiscovered(e.id))
      .map((e) => ({ item: e, weight: RARITY_SPAWN_WEIGHT[e.rarity] * (this.progress.isHinted(e.id) ? 0.25 : 1) + 0.02 }));
    if (candidates.length === 0) return;
    const entry = this.rng.weighted(candidates);
    const kinds = entry.hints.filter((h) => h !== 'logbook_rumor');
    const kind = kinds.length ? this.rng.pick(kinds) : 'tracks';
    const text = this.hintText(entry, kind, biomeName);
    if (kind === 'sounds' || kind === 'scent' || kind === 'sample_trace') {
      // Umgebungs-Hinweis ohne Objekt
      if (this.progress.addHint(entry.id, text, performance.now() / 1000)) this.pendingEvents.push({ entry, text, kind });
      return;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const a = this.rng.float(0, Math.PI * 2);
      const d = this.rng.float(10, 32);
      const x = playerPos.x + Math.cos(a) * d;
      const z = playerPos.z + Math.sin(a) * d;
      const h = this.model.heightAt(x, z);
      if (this.model.hasWater && h < this.model.seaLevel + 0.3) continue;
      if (this.model.slopeAt(x, z, 1) > 0.6) continue;
      const mesh = this.buildProp(kind, this.rng);
      mesh.position.set(x, h, z);
      mesh.rotation.y = this.rng.float(0, Math.PI * 2);
      this.group.add(mesh);
      this.props.push({ entry, kind, mesh, pos: new Vector3(x, h, z), ttl: 240, text });
      break;
    }
  }

  private readonly pendingEvents: HintEvent[] = [];

  /** Liefert und leert die seit dem letzten Aufruf ausgelösten Hinweise. */
  drainEvents(): HintEvent[] {
    const out = this.pendingEvents.slice();
    this.pendingEvents.length = 0;
    return out;
  }

  update(dt: number, playerPos: Vector3, biomeId: string, biomeName: string): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.rng.float(25, 45) / Math.max(0.1, this.rate);
      if (this.props.length < 3) this.spawnHint(playerPos, biomeId, biomeName);
    }
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i] as HintProp;
      p.ttl -= dt;
      const d = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
      if (d < 2.6) {
        if (this.progress.addHint(p.entry.id, p.text, performance.now() / 1000)) {
          this.pendingEvents.push({ entry: p.entry, text: p.text, kind: p.kind });
          this.stats.given++;
        }
        this.group.remove(p.mesh);
        this.props.splice(i, 1);
      } else if (p.ttl <= 0) {
        this.group.remove(p.mesh);
        this.props.splice(i, 1);
      }
    }
    this.stats.active = this.props.length;
  }

  /** Gerücht über eine seltene Verwandte, wenn eine Art neu entdeckt wurde. */
  rumorFor(discovered: ArchiveEntry, biomeNameOf: (id: string) => string): HintEvent | null {
    const fam = this.families.get(discovered.familyId);
    if (!fam) return null;
    const relatives = fam.memberIds
      .map((id) => this.fauna.find((e) => e.id === id))
      .filter((e): e is ArchiveEntry => !!e && e.id !== discovered.id && (e.rarity === 'rare' || e.rarity === 'legendary') && !this.progress.isDiscovered(e.id) && !this.progress.isHinted(e.id));
    if (relatives.length === 0) return null;
    const target = this.rng.pick(relatives);
    const biome = biomeNameOf(target.biomeIds[0] ?? '');
    const time = target.spawn.timeOfDay === 'any' ? '' : `, ${TIME_LABELS[target.spawn.timeOfDay]}`;
    const weather = target.spawn.weather === 'any' ? '' : `, bei ${target.spawn.weather.map((w: WeatherType) => WEATHER[w].name).join(' oder ')}`;
    const text = `Gerücht: In ${biome} soll eine ${RARITY_LABELS[target.rarity].toLowerCase()}e Verwandte von ${this.progress.displayName(discovered)} leben${time}${weather}.`;
    if (!this.progress.addHint(target.id, text, performance.now() / 1000)) return null;
    return { entry: target, text, kind: 'logbook_rumor' };
  }

  dispose(): void {
    for (const p of this.props) this.group.remove(p.mesh);
    this.props.length = 0;
    this.geoTrack.dispose();
    this.geoDrop.dispose();
    this.geoNest.dispose();
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
  }
}
