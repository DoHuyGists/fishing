import type { OpinionFeedbackRow } from "../types/table/feedback";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseFeedbackRepository } from "../data/supabaseFeedbackRepository";

export const useFeedbackListStore = defineStore("feedback-list", {
  state: () => ({
    opinionFeedback: [] as OpinionFeedbackRow[],
    loading: false,
    page: 1,
    pageSize: 5,
    total: 0,
    requestId: 0,
    error: "",
  }),
  actions: {
    async fetchOpinionFeedback(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.loading = true;
      this.error = "";
      try {
        const result = await supabaseFeedbackRepository.fetchOpinionFeedback(page);
        if (request !== this.requestId) return;
        this.opinionFeedback = result.items; this.total = result.total; this.page = page;
        if (!result.items.length && page > 1) await this.fetchOpinionFeedback(Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (error) {
        if (request === this.requestId) this.error = error instanceof Error ? error.message : tr('feedbackList.khong_the_tai_danh_sach_gop_y');
      } finally {
        if (request === this.requestId) this.loading = false;
      }
    },
  },
});
