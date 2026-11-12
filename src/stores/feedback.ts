import type { ErrorFeedbackRow } from "../types/table/feedback";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import supabase from "../database/connection";
import { supabaseFeedbackRepository } from "../data/supabaseFeedbackRepository";
let myErrorsChannel: ReturnType<typeof supabaseFeedbackRepository.subscribeMyErrors> | null = null;

export const useFeedbackStore = defineStore("feedback", {
  state: () => ({
    submitting: false,
    error: "",
    myErrors: [] as ErrorFeedbackRow[],
    historyLoading: false,
    historyError: "",
    page: 1,
    hasNext: false,
    historyRequest: 0,
    watchingUserId: "",
  }),
  actions: {
    async loadMyErrors(userId: string, page?: number) {
      page ??= this.page;
      const request = ++this.historyRequest;
      this.historyLoading = true; this.historyError = "";
      try {
        const rows = await supabaseFeedbackRepository.fetchMyErrors(userId, page);
        if (request !== this.historyRequest) return;
        this.myErrors = rows.slice(0, 20); this.hasNext = rows.length > 20; this.page = page;
      } catch (err) { if (request === this.historyRequest) this.historyError = err instanceof Error ? err.message : tr('feedback.khong_the_tai_bao_loi'); }
      finally { if (request === this.historyRequest) this.historyLoading = false; }
    },
    watchMyErrors(userId: string) {
      this.stopWatchingErrors();
      this.watchingUserId = userId;
      this.myErrors = []; this.page = 1;
      void this.loadMyErrors(userId, 1);
      myErrorsChannel = supabaseFeedbackRepository.subscribeMyErrors(userId, () => { if (this.watchingUserId === userId) void this.loadMyErrors(userId); });
    },
    stopWatchingErrors() {
      this.watchingUserId = "";
      ++this.historyRequest;
      if (myErrorsChannel) void supabaseFeedbackRepository.unsubscribe(myErrorsChannel);
      myErrorsChannel = null;
    },
    async submitOpinion(payload: { like: string; dislike: string; contribute: string }) {
      return this.submit(async (userId) => supabaseFeedbackRepository.createOpinionFeedback({
        userId,
        like: payload.like.trim(),
        dislike: payload.dislike.trim(),
        contribute: payload.contribute.trim() || null,
      }));
    },
    async submitError(payload: { title: string; description: string; files: File[] }) {
      return this.submit(async (userId) => supabaseFeedbackRepository.createErrorFeedback({
        userId,
        title: payload.title.trim(),
        description: payload.description.trim() || null,
        files: payload.files,
      }));
    },
    async submit(action: (userId: string) => Promise<void>) {
      this.submitting = true;
      this.error = "";
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw new Error(tr('feedback.ban_can_dang_nhap_de_gui_phan_hoi'));
        await action(user.id);
      } catch (error) {
        this.error = error instanceof Error ? error.message : tr('feedback.khong_the_gui_phan_hoi_luc_nay_vui_long_thu_lai');
        throw error;
      } finally {
        this.submitting = false;
      }
    },
  },
});
