import { defineStore } from "pinia";
import { supabaseUserInventoryRepository, type UserInventory } from "../data/supabaseUserInventoryRepository";
import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import type { EquipmentSet } from "./equipment";

export const useInventoryStore = defineStore("Inventory", {
    state: () => ({
        items: [] as UserInventory[],
        equipmentSets: [] as EquipmentSet[],
    }),
    actions: {
        async setUserInventory(userId: string) {
            this.items = await supabaseUserInventoryRepository.fetchUserInventory(userId);
        },
        async setEquipmentSet() {
            this.equipmentSets = await supabaseEquipmentRepository.fetchAllEquipmentSet();
        },
        async removeItem(userId: string, inventoryIds: string[]) {
            await supabaseUserInventoryRepository.deleteInventory(userId,inventoryIds)
        }
    }
})