import type { Reward } from "../components/spin-wheel/SpinWheel.vue";
import supabase from "../database/connection";

export interface UserInventory {
    id: string
    data: any
    userId: string
    createdAt: any
}

class SupabaseUserInventoryRepository {
    async fetchUserInventory(userId: string): Promise<UserInventory[]> {
        const { data, error } = await supabase
            .from("user_inventory")
            .select("*")
            .eq("user_id", userId);
    
        if (error) {
            throw new Error(error.message);
        }

        return data.map(x => ({
            id: x.id,
            data: x.data,
            userId: x.user_id,
            createdAt: x.created_at
        } as UserInventory));
    }
    async buyItemWithRandomIndex(userId: string, reward: Reward, cost: number): Promise<any> {
        const { data, error } = await supabase.rpc('buy_item', {
            p_user_id: userId,
            p_category: reward.value,
            p_cost: cost
        });
        if (error) {
            console.error(error.message);
        } else {
            return data;
        }
    }
    async deleteInventory(userId: string, inventoryIds: string[]){
        const { error } = await supabase.from('user_inventory').delete().in('id', inventoryIds).eq('user_id', userId);
        if (error) {
            throw new Error(error.message);
        }
    }
}
export const supabaseUserInventoryRepository = new SupabaseUserInventoryRepository();