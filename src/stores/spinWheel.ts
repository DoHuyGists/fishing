import { defineStore } from "pinia";
import type { Reward } from "../components/spin-wheel/SpinWheel.vue";
import { supabaseUserInventoryRepository } from "../data/supabaseUserInventoryRepository.ts";
import { useAuthStore } from "./auth.ts";

const authStore = useAuthStore()

export const useSpinWheelStore = defineStore("SpinWheel", {
    state: ()=> ({
        
    }),
    actions: {
        async submitReward(reward: Reward, cost: number) {
            if(authStore.user?.id){
                return await supabaseUserInventoryRepository.buyItemWithRandomIndex(authStore.user?.id, reward, cost)
            }
        }
    }
})