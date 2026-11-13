import type { UserInventory } from './userInventory';

export type SurvivalResource = 'vitality' | 'hydration' | 'nutrition' | 'energy' | 'morale';
export type HealthSlot = 'head' | 'torso' | 'hands' | 'legs' | 'feet' | 'accessory';
export type BodyEquipmentSet = { id: string; user_id: string; is_used: boolean; created_at: string } & Record<HealthSlot, { inventory_id: string }[]>;
export interface HealthEquipment {
  inventory: UserInventory;
  name: string;
  image: string;
  icon: string;
  quantity: number;
  slot: HealthSlot | null;
  bonuses: Partial<Record<SurvivalResource, number>>;
}
