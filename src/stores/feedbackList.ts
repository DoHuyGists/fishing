import { t as tr } from "../i18n";
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
        this.error = error instanceof Error ? error.message : tr('feedbackList.khong_the_tai_danh_sach_gop_y');
      } finally {
        this.loading = false;
      }
    },
  },
});
