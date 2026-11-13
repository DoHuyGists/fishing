import type { ErrorFeedbackRow } from "../types/table/feedback";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import supabase from "../database/connection";
import { supabaseFeedbackRepository } from "../data/supabaseFeedbackRepository";
import { startVisibleRefresh } from '../utils/visibleRefresh';
import { createKeyedRefreshTask } from '../utils/refreshTask';
import { useAuthStore } from './auth';
import { COMPACT_PAGE_SIZE } from '../data/pagination';
import type { ListPage } from '../types/model/pagination';
const refreshHistory = createKeyedRefreshTask<ListPage<ErrorFeedbackRow>>();
let stopHistoryRefresh: (() => void) | null = null;

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
      const generation = useAuthStore().sessionGeneration;
      const request = ++this.historyRequest;
      const current = () => request === this.historyRequest && useAuthStore().user?.id === userId
        && useAuthStore().sessionGeneration === generation;
      this.historyLoading = true; this.historyError = '';
      try {
        const rows = await refreshHistory(userId + ':' + generation + ':' + page,
          () => supabaseFeedbackRepository.fetchMyErrors(userId, page));
        if (!current()) return;
        this.myErrors = rows.items; this.hasNext = page * COMPACT_PAGE_SIZE < rows.total; this.page = page;
        if (!rows.items.length && page > 1) await this.loadMyErrors(userId, Math.max(1, Math.ceil(rows.total / COMPACT_PAGE_SIZE)));
      } catch (err) { if (current()) this.historyError = err instanceof Error ? err.message : tr('feedback.khong_the_tai_bao_loi'); }
      finally { if (current()) this.historyLoading = false; }
    },
    watchMyErrors(userId: string) {
      this.stopWatchingErrors();
      this.watchingUserId = userId;
      this.myErrors = []; this.page = 1;
      stopHistoryRefresh = startVisibleRefresh(async () => {
        if (this.watchingUserId !== userId || useAuthStore().user?.id !== userId) return;
        await this.loadMyErrors(userId);
        if (this.historyError) throw new Error(this.historyError);
      }, 60_000);
    },
    stopWatchingErrors() {
      this.watchingUserId = "";
      ++this.historyRequest;
      stopHistoryRefresh?.();
      stopHistoryRefresh = null;
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
        if (this.watchingUserId === user.id) void this.loadMyErrors(user.id, 1);
      } catch (error) {
        this.error = error instanceof Error ? error.message : tr('feedback.khong_the_gui_phan_hoi_luc_nay_vui_long_thu_lai');
        throw error;
      } finally {
        this.submitting = false;
      }
    },
  },
});
