/** Inventar (rein): Rohstoffe und gefertigte Gegenstände, Kosten prüfen und bezahlen. */
import type { ResourceId } from '@/gen/universe/types';
import type { ItemId } from './crafting/recipes';

export type ResourceCost = Partial<Record<ResourceId, number>>;

export const MAX_STACK = 999;

export interface InventorySnapshot {
  resources: Partial<Record<ResourceId, number>>;
  items: Partial<Record<ItemId, number>>;
}

export class Inventory {
  private readonly resources = new Map<ResourceId, number>();
  private readonly items = new Map<ItemId, number>();
  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  get(id: ResourceId): number {
    return this.resources.get(id) ?? 0;
  }

  add(id: ResourceId, amount: number): number {
    const before = this.get(id);
    const after = Math.min(MAX_STACK, before + Math.max(0, amount));
    this.resources.set(id, after);
    this.emit();
    return after - before;
  }

  remove(id: ResourceId, amount: number): boolean {
    if (this.get(id) < amount) return false;
    this.resources.set(id, this.get(id) - amount);
    this.emit();
    return true;
  }

  canAfford(cost: ResourceCost): boolean {
    for (const [id, n] of Object.entries(cost) as [ResourceId, number][]) if (this.get(id) < n) return false;
    return true;
  }

  pay(cost: ResourceCost): boolean {
    if (!this.canAfford(cost)) return false;
    for (const [id, n] of Object.entries(cost) as [ResourceId, number][]) this.resources.set(id, this.get(id) - n);
    this.emit();
    return true;
  }

  /** Fehlende Mengen je Rohstoff (leer, wenn bezahlbar). */
  missing(cost: ResourceCost): ResourceCost {
    const out: ResourceCost = {};
    for (const [id, n] of Object.entries(cost) as [ResourceId, number][]) if (this.get(id) < n) out[id] = n - this.get(id);
    return out;
  }

  getItem(id: ItemId): number {
    return this.items.get(id) ?? 0;
  }

  addItem(id: ItemId, amount = 1): void {
    this.items.set(id, Math.min(MAX_STACK, this.getItem(id) + amount));
    this.emit();
  }

  removeItem(id: ItemId, amount = 1): boolean {
    if (this.getItem(id) < amount) return false;
    this.items.set(id, this.getItem(id) - amount);
    this.emit();
    return true;
  }

  /** Alle Rohstoffe mit Bestand > 0. */
  listResources(): Array<{ id: ResourceId; amount: number }> {
    return Array.from(this.resources.entries())
      .filter(([, n]) => n > 0)
      .map(([id, amount]) => ({ id, amount }));
  }

  listItems(): Array<{ id: ItemId; amount: number }> {
    return Array.from(this.items.entries())
      .filter(([, n]) => n > 0)
      .map(([id, amount]) => ({ id, amount }));
  }

  /** Verliert anteilig Rohstoffe (Respawn-Strafe); gibt die Verluste zurück. */
  loseFraction(fraction: number): ResourceCost {
    const lost: ResourceCost = {};
    for (const [id, n] of this.resources) {
      const loss = Math.floor(n * fraction);
      if (loss > 0) {
        this.resources.set(id, n - loss);
        lost[id] = loss;
      }
    }
    this.emit();
    return lost;
  }

  toJSON(): InventorySnapshot {
    return { resources: Object.fromEntries(this.resources) as InventorySnapshot['resources'], items: Object.fromEntries(this.items) as InventorySnapshot['items'] };
  }

  static fromJSON(s: InventorySnapshot | undefined): Inventory {
    const inv = new Inventory();
    if (!s) return inv;
    for (const [id, n] of Object.entries(s.resources ?? {})) inv.resources.set(id as ResourceId, Math.max(0, Number(n) || 0));
    for (const [id, n] of Object.entries(s.items ?? {})) inv.items.set(id as ItemId, Math.max(0, Number(n) || 0));
    return inv;
  }
}
