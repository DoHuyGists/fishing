import { defineStore } from "pinia";
import type { Reward } from "../components/spin-wheel/SpinWheel.vue";
import { supabaseUserInventoryRepository } from "../data/supabaseUserInventoryRepository.ts";
import { useAuthStore } from "./auth.ts";
import { supabaseItemRepository } from "../data/supabaseItemRepository.ts";

const authStore = useAuthStore();

export const useSpinWheelStore = defineStore("SpinWheel", {
  state: () => ({
    selectedReward: [] as Reward[],
    rewardList: [] as Reward[],
  }),
  actions: {
    async setReward() {
      const items = await supabaseItemRepository.getReward();
      this.rewardList = items.map((x) => ({
        id: x.id,
        label: x.name,
        value: x.category,
        image: x.image,
      }));
    },
    async claimRandomItem(itemIds: string[]): Promise<string> {
      return await supabaseUserInventoryRepository.claimRandomItem(itemIds);
    },
  },
});
