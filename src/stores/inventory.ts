import { useGameCatalogStore } from './gameCatalog';
import { useAuthStore } from './auth';
import type { UserInventory } from "../types/model/userInventory";
import type { ShopItem } from "../types/model/item";
import { defineStore } from "pinia";
import { supabaseUserInventoryRepository } from "../data/supabaseUserInventoryRepository";
import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import type { EquipmentSet } from "./equipment";

export const useInventoryStore = defineStore("Inventory", {
    state: () => ({
        items: [] as UserInventory[],
        equipmentSets: [] as EquipmentSet[],
        shopItems: [] as ShopItem[],
        shopLoading: false,
    }),
    getters: {
        ownedQuantitiesByItemId: (state): Map<string, number> => {
            const quantities = new Map<string, number>();
            for (const item of state.items) {
                const itemId = item.data?.id;
                const quantity = Number(item.data?.quantity ?? 1);
                if (typeof itemId !== "string" || !Number.isFinite(quantity) || quantity <= 0) continue;
                quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
            }
            return quantities;
        },
    },
    actions: {
        async setUserInventory(userId: string) {
            const auth = useAuthStore(), generation = auth.sessionGeneration;
            const items = await supabaseUserInventoryRepository.fetchUserInventory(userId);
            if (auth.user?.id === userId && auth.sessionGeneration === generation) this.items = items;
        },
        async setEquipmentSet() {
            const auth = useAuthStore(), generation = auth.sessionGeneration, userId = auth.user?.id;
            const sets = await supabaseEquipmentRepository.fetchAllEquipmentSet();
            if (auth.user?.id === userId && auth.sessionGeneration === generation) this.equipmentSets = sets;
        },
        async removeItem(userId: string, inventoryIds: string[]) {
            await supabaseUserInventoryRepository.deleteInventory(userId,inventoryIds)
        },
        async useItem(inventoryId: string) {
            return await supabaseUserInventoryRepository.useItem(inventoryId);
        },
        async loadShopItems(force = false) {
            const auth = useAuthStore(), generation = auth.sessionGeneration;
            this.shopLoading = true;
            try { await useGameCatalogStore().get('shop', { force, consumer: 'inventory', onUpdate: data => { this.shopItems = data ?? []; if (!data) this.shopLoading = false; } }); }
            catch (error) { if (auth.sessionGeneration === generation) { this.shopItems = []; throw error; } }
            finally { if (auth.sessionGeneration === generation) this.shopLoading = false; }
        },
        async purchaseItem(itemId: string, quantity: number) {
            await useGameCatalogStore().action('purchase_item', { p_item_id: itemId, p_quantity: quantity }, ['shop'],
                () => supabaseUserInventoryRepository.purchaseItem(itemId, quantity));
        },
    }
})
