import { defineStore } from "pinia";
import {
  supabaseFeedbackRepository,
  type ErrorFeedbackRow,
  type ErrorFeedbackStatus,
} from "../data/supabaseFeedbackRepository";

export const useErrorFeedbackManagementStore = defineStore("error-feedback-management", {
  state: () => ({
    errorFeedback: [] as ErrorFeedbackRow[],
    loading: false,
    error: "",
    updatingIds: [] as string[],
    signedUrls: {} as Record<string, string>,
    attachmentError: "",
    loadingAttachments: false,
  }),
  actions: {
    async fetchErrorFeedback() {
      this.loading = true;
      this.error = "";
      try {
        this.errorFeedback = await supabaseFeedbackRepository.fetchErrorFeedback();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải danh sách báo lỗi.";
      } finally {
        this.loading = false;
      }
    },
    async updateErrorStatus(id: string, status: ErrorFeedbackStatus) {
      if (this.updatingIds.includes(id)) return;
      this.updatingIds.push(id);
      this.error = "";
      try {
        await supabaseFeedbackRepository.updateErrorFeedbackStatus(id, status);
        const row = this.errorFeedback.find((item) => item.id === id);
        if (row) {
          row.status = status;
          row.updated_at = new Date().toISOString();
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể cập nhật trạng thái báo lỗi.";
      } finally {
        this.updatingIds = this.updatingIds.filter((updatingId) => updatingId !== id);
      }
    },
    async fetchAttachmentUrls(paths: string[]) {
      const missingPaths = [...new Set(paths)].filter((path) => !this.signedUrls[path]);
      if (!missingPaths.length) return;

      this.loadingAttachments = true;
      this.attachmentError = "";
      try {
        this.signedUrls = {
          ...this.signedUrls,
          ...(await supabaseFeedbackRepository.createErrorFeedbackSignedUrls(missingPaths)),
        };
      } catch (error) {
        this.attachmentError = error instanceof Error ? error.message : "Không thể tải tệp đính kèm.";
      } finally {
        this.loadingAttachments = false;
      }
    },
  },
});
