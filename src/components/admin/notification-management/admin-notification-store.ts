import { defineStore } from "pinia";
import {
  supabaseNotificationRepository,
  type AdminNotificationRow,
  type NotificationKind,
} from "../../../data/supabaseNotificationRepository";

const emptyForm = () => ({ title: "", body: "", type: "", userId: "", expiresAt: "" });

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export const useAdminNotificationStore = defineStore("AdminNotification", {
  state: () => ({
    tab: "system" as NotificationKind,
    rows: [] as AdminNotificationRow[],
    search: "",
    loading: false,
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
      const q = state.search.trim().toLocaleLowerCase();
      return q
        ? state.rows.filter((item) =>
            `${item.title} ${item.body} ${item.type ?? ""} ${item.user_id ?? ""}`.toLocaleLowerCase().includes(q),
          )
        : state.rows;
    },
  },
  actions: {
    async fetchRows() {
      this.loading = true;
      this.error = "";
      try {
        this.rows = await supabaseNotificationRepository.fetchAdminNotifications(this.tab);
      } catch (cause) {
        this.error = messageOf(cause, "Không thể tải thông báo.");
      } finally {
        this.loading = false;
      }
    },

    changeTab(value: NotificationKind) {
      this.tab = value;
      this.search = "";
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
