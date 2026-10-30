import { defineStore } from "pinia";
import { supabaseFeedbackRepository, type OpinionFeedbackRow } from "../data/supabaseFeedbackRepository";

export const useFeedbackListStore = defineStore("feedback-list", {
  state: () => ({
    opinionFeedback: [] as OpinionFeedbackRow[],
    loading: false,
    error: "",
  }),
  actions: {
    async fetchOpinionFeedback() {
      this.loading = true;
      this.error = "";
      try {
        this.opinionFeedback = await supabaseFeedbackRepository.fetchOpinionFeedback();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải danh sách góp ý.";
      } finally {
        this.loading = false;
      }
    },
  },
});
