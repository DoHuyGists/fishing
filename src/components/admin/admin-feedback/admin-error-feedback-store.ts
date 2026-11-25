import type { ErrorFeedbackRow } from "../../../types/table/feedback";
import type { ErrorFeedbackStatus } from "../../../types/model/feedback";
import { defineStore } from "pinia";
import { supabaseFeedbackRepository } from "../../../data/supabaseFeedbackRepository";

export const useErrorFeedbackManagementStore = defineStore("error-feedback-management", {
  state: () => ({
    errorFeedback: [] as ErrorFeedbackRow[],
    loading: false,
    page: 1,
    pageSize: 5,
    total: 0,
    requestId: 0,
    error: "",
    updatingIds: [] as string[],
    signedUrls: {} as Record<string, string>,
    signedUrlExpiresAt: {} as Record<string, number>,
    pendingAttachmentPaths: [] as string[],
    attachmentError: "",
    loadingAttachments: false,
  }),
  actions: {
    async fetchErrorFeedback(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.loading = true;
      this.error = "";
      try {
        const result = await supabaseFeedbackRepository.fetchErrorFeedback(page);
        if (request !== this.requestId) return;
        this.errorFeedback = result.items; this.total = result.total; this.page = page;
        await this.fetchAttachmentUrls(result.items.flatMap(item => item.attachments ?? []).map(file => file.path));
        if (!result.items.length && page > 1) await this.fetchErrorFeedback(Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (error) {
        if (request === this.requestId) this.error = error instanceof Error ? error.message : "Không thể tải danh sách báo lỗi.";
      } finally {
        if (request === this.requestId) this.loading = false;
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
    async fetchAttachmentUrls(paths: string[], force = false) {
      const now = Date.now();
      const missingPaths = [...new Set(paths)].filter((path) =>
        !this.pendingAttachmentPaths.includes(path) &&
        (force || !this.signedUrls[path] || (this.signedUrlExpiresAt[path] ?? 0) <= now),
      );
      if (!missingPaths.length) return;

      this.pendingAttachmentPaths.push(...missingPaths);
      this.loadingAttachments = true;
      this.attachmentError = "";
      try {
        const urls = await supabaseFeedbackRepository.createErrorFeedbackSignedUrls(missingPaths);
        Object.assign(this.signedUrls, urls);
        // Storage links last one hour; renew early to allow time to open the file.
        for (const path of Object.keys(urls)) this.signedUrlExpiresAt[path] = now + 55 * 60_000;
      } catch (error) {
        this.attachmentError = error instanceof Error ? error.message : "Không thể tải tệp đính kèm.";
      } finally {
        this.pendingAttachmentPaths = this.pendingAttachmentPaths.filter(path => !missingPaths.includes(path));
        this.loadingAttachments = this.pendingAttachmentPaths.length > 0;
      }
    },
  },
});
