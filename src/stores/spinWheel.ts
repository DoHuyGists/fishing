import type { SpinWheelReward as Reward, SpinWheelSeasonRewards } from "../types/model/spinWheel";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";

import { supabaseUserInventoryRepository } from "../data/supabaseUserInventoryRepository.ts";
import { supabaseSpinWheelRepository } from "../data/supabaseSpinWheelRepository";
import { useCurrencyStore } from "./currency";

export const useSpinWheelStore = defineStore("SpinWheel", {
  state: () => ({
    season: null as SpinWheelSeasonRewards["season"],
    rewardList: [] as Reward[],
    loading: false,
    claiming: false,
    error: "",
  }),
  actions: {
    applyRewards(data: SpinWheelSeasonRewards) {
      this.season = data.season;
      this.rewardList = data.rewards.map((item) => ({
        id: item.id,
        label: item.name,
        value: item.category,
        image: item.image ?? undefined,
        information: item.information ?? "",
      }));
    },
    async setReward() {
      if (this.loading || this.claiming) return;
      this.loading = true;
      this.error = "";
      this.season = null;
      this.rewardList = [];
      try {
        this.applyRewards(await supabaseSpinWheelRepository.fetchRewards());
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('spinWheel.khong_the_tai_phan_thuong_vong_quay');
      } finally {
        this.loading = false;
      }
    },
    async claimRandomItem(): Promise<string> {
      if (this.claiming) throw new Error(tr('spinWheel.dang_xu_ly_luot_quay'));
      this.claiming = true;
      try {
        const result = await supabaseUserInventoryRepository.claimRandomItem();
        // Use the server snapshot if the season changed while the modal was open.
        this.applyRewards(result);
        useCurrencyStore().tickets = result.remaining_tickets;
        return result.item_id;
      } finally {
        this.claiming = false;
      }
    },
  },
});
