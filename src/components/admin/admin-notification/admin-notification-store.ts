import type { AdminNotificationRow } from "../../../types/table/notification";
import type { NotificationKind } from "../../../types/model/notification";
import { defineStore } from "pinia";
import { supabaseNotificationRepository } from "../../../data/supabaseNotificationRepository";

const emptyForm = () => ({ title: "", body: "", type: "", userId: "", expiresAt: "" });

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export const useAdminNotificationStore = defineStore("AdminNotification", {
  state: () => ({
    tab: "system" as NotificationKind,
    rows: [] as AdminNotificationRow[],
    search: "",
    loading: false,
    page: 1,
    pageSize: 5,
    total: 0,
    requestId: 0,
    error: "",

    isFormOpen: false,
    saving: false,
    formError: "",
    editing: null as AdminNotificationRow | null,
    form: emptyForm(),

    deleting: null as AdminNotificationRow | null,
  }),
  getters: {
    filteredRows(state): AdminNotificationRow[] {
      return state.rows;
    },
  },
  actions: {
    async fetchRows(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.loading = true;
      this.error = "";
      try {
        const result = await supabaseNotificationRepository.fetchAdminNotifications(this.tab, page, this.search);
        if (request !== this.requestId) return;
        this.rows = result.items; this.total = result.total; this.page = page;
        if (!result.items.length && page > 1) await this.fetchRows(Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (cause) {
        if (request === this.requestId) this.error = messageOf(cause, "Không thể tải thông báo.");
      } finally {
        if (request === this.requestId) this.loading = false;
      }
    },

    changeTab(value: NotificationKind) {
      this.tab = value;
      this.search = "";
      this.page = 1;
      void this.fetchRows();
    },

    openCreate() {
      this.editing = null;
      this.form = { ...emptyForm(), type: this.tab === "system" ? "system" : "general" };
      this.formError = "";
      this.isFormOpen = true;
    },

    openEdit(item: AdminNotificationRow) {
      const expiresAt = item.expires_at ? new Date(item.expires_at) : null;
      this.editing = item;
      this.form = {
        title: item.title,
        body: item.body,
        type: item.type ?? "",
        userId: item.user_id ?? "",
        expiresAt: expiresAt
          ? new Date(expiresAt.getTime() - expiresAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
          : "",
      };
      this.formError = "";
      this.isFormOpen = true;
    },

    closeForm() {
      this.isFormOpen = false;
      this.formError = "";
      this.editing = null;
    },

    async save() {
      const { form, tab } = this;
      this.formError = "";
      if (!form.title.trim() || !form.body.trim()) {
        this.formError = "Tiêu đề và nội dung là bắt buộc.";
        return;
      }
      if (tab === "personal" && !form.userId.trim()) {
        this.formError = "Cần nhập UUID người dùng cho thông báo cá nhân.";
        return;
      }
      const payload =
        tab === "system"
          ? {
              title: form.title.trim(),
              body: form.body.trim(),
              type: form.type.trim() || "system",
              expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
            }
          : {
              user_id: form.userId.trim(),
              title: form.title.trim(),
              body: form.body.trim(),
              type: form.type.trim() || "general",
            };
      this.saving = true;
      try {
        await supabaseNotificationRepository.saveAdminNotification(tab, this.editing?.id ?? null, payload);
        this.closeForm();
        await this.fetchRows();
      } catch (cause) {
        this.formError = messageOf(cause, "Không thể lưu thông báo.");
      } finally {
        this.saving = false;
      }
    },

    async removeNotice() {
      if (!this.deleting) return;
      try {
        await supabaseNotificationRepository.deleteAdminNotification(this.tab, this.deleting.id);
        this.deleting = null;
        await this.fetchRows();
      } catch (cause) {
        this.error = messageOf(cause, "Không thể xóa thông báo.");
        this.deleting = null;
      }
    },
  },
});
