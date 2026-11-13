import type { HealthEquipment, HealthSlot, SurvivalResource } from '../types/model/health';
import type { UserInventory } from '../types/model/userInventory';

export const survivalResources: SurvivalResource[] = ['vitality', 'hydration', 'nutrition', 'energy', 'morale'];
export const healthSlots: HealthSlot[] = ['head', 'torso', 'hands', 'legs', 'feet', 'accessory'];

// Explicit metadata on item snapshots: category and health_bonuses.
export function healthEquipment(inventory: UserInventory): HealthEquipment {
  const data = inventory.data ?? {};
  const slot = healthSlots.includes(data.category) ? data.category as HealthSlot : null;
  const bonuses: HealthEquipment['bonuses'] = {};
  for (const resource of survivalResources) {
    const value = data.health_bonuses?.[resource];
    if (slot && typeof value === 'number' && Number.isFinite(value) && value > 0) bonuses[resource] = value;
  }
  const quantity = data.quantity == null ? 1 : Number(data.quantity);
  return {
    inventory, slot, bonuses,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : `#${inventory.id.slice(0, 6)}`,
    image: typeof data.image === 'string' ? data.image : '',
    icon: typeof data.icon === 'string' ? data.icon : '',
    quantity: Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0,
  };
}
