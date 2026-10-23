import { defineStore } from "pinia";
import { supabaseUserInventoryRepository, type UserInventory } from "../data/supabaseUserInventoryRepository";
import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import type { EquipmentSet } from "./equipment";
import { supabaseItemRepository, type ShopItem } from "../data/supabaseItemRepository";

export const useInventoryStore = defineStore("Inventory", {
    state: () => ({
        items: [] as UserInventory[],
        equipmentSets: [] as EquipmentSet[],
        shopItems: [] as ShopItem[],
        shopLoading: false,
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
        },
        async useItem(inventoryId: string) {
            return await supabaseUserInventoryRepository.useItem(inventoryId);
        },
        async loadShopItems() {
            this.shopLoading = true;
            try { this.shopItems = await supabaseItemRepository.fetchShopItems(); }
            finally { this.shopLoading = false; }
        },
        async purchaseItem(itemId: string, quantity: number) {
            await supabaseUserInventoryRepository.purchaseItem(itemId, quantity);
        },
    }
})
