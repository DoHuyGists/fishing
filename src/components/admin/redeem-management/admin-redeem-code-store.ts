import { defineStore } from "pinia";
import {
  supabaseRedeemCodeRepository,
  type RedeemCodePayload,
  type RedeemCodeRow,
} from "../../../data/supabaseRedeemCodeRepository";

export type RedeemStatusFilter = "ALL" | "ACTIVE" | "DISABLED" | "EXPIRED";

const emptyForm = () => ({ id: null as string | null, code: "", cash: "", expiresAt: "", isDisabled: false });

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export const isRedeemCodeExpired = (item: RedeemCodeRow) =>
  item.expiresAt !== null && new Date(item.expiresAt).getTime() <= Date.now();

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export const useAdminRedeemCodeStore = defineStore("AdminRedeemCode", {
  state: () => ({
    codes: [] as RedeemCodeRow[],
    search: "",
    statusFilter: "ALL" as RedeemStatusFilter,
    isLoading: false,
    loadError: "",

    isFormOpen: false,
    isSaving: false,
    formError: "",
    form: emptyForm(),

    updatingId: null as string | null,
    deletingId: null as string | null,
    confirmDeleteId: null as string | null,
  }),
  getters: {
    filteredCodes(state): RedeemCodeRow[] {
      const keyword = state.search.trim().toLocaleLowerCase();
      return state.codes.filter((item) => {
        const expired = isRedeemCodeExpired(item);
        const matchesSearch = !keyword || item.code.toLocaleLowerCase().includes(keyword);
        const matchesStatus =
          state.statusFilter === "ALL" ||
          (state.statusFilter === "ACTIVE" && !item.isDisabled && !expired) ||
          (state.statusFilter === "DISABLED" && item.isDisabled) ||
          (state.statusFilter === "EXPIRED" && expired);
        return matchesSearch && matchesStatus;
      });
    },
  },
  actions: {
    async loadCodes() {
      this.isLoading = true;
      this.loadError = "";
      try {
        this.codes = await supabaseRedeemCodeRepository.fetchAll();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể tải danh sách mã đổi thưởng");
      } finally {
        this.isLoading = false;
      }
    },

    openCreateForm() {
      this.form = emptyForm();
      this.formError = "";
      this.isFormOpen = true;
    },

    openEditForm(item: RedeemCodeRow) {
      this.form = {
        id: item.id,
        code: item.code,
        cash: String(item.cash),
        expiresAt: toDateTimeLocal(item.expiresAt),
        isDisabled: item.isDisabled,
      };
      this.formError = "";
      this.isFormOpen = true;
    },

    closeForm() {
      this.isFormOpen = false;
      this.formError = "";
    },

    buildPayload(): RedeemCodePayload | null {
      const code = this.form.code.trim();
      const cash = Number(this.form.cash);
      if (!code) {
        this.formError = "Mã đổi thưởng là bắt buộc";
        return null;
      }
      if (!Number.isSafeInteger(cash) || cash <= 0) {
        this.formError = "Tiền thưởng phải là số nguyên dương hợp lệ";
        return null;
      }
      const expiresAt = this.form.expiresAt ? new Date(this.form.expiresAt) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        this.formError = "Thời hạn không hợp lệ";
        return null;
      }
      return { code, cash, is_disabled: this.form.isDisabled, expires_at: expiresAt?.toISOString() ?? null };
    },

    async save() {
      this.formError = "";
      const payload = this.buildPayload();
      if (!payload) return;

      this.isSaving = true;
      try {
        if (this.form.id) await supabaseRedeemCodeRepository.update(this.form.id, payload);
        else await supabaseRedeemCodeRepository.create(payload);
        this.closeForm();
        await this.loadCodes();
      } catch (error) {
        this.formError = messageOf(error, "Không thể lưu mã đổi thưởng");
      } finally {
        this.isSaving = false;
      }
    },

    async toggleEnabled(item: RedeemCodeRow) {
      this.updatingId = item.id;
      this.loadError = "";
      try {
        await supabaseRedeemCodeRepository.update(item.id, {
          code: item.code,
          cash: item.cash,
          is_disabled: !item.isDisabled,
          expires_at: item.expiresAt,
        });
        await this.loadCodes();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể cập nhật trạng thái mã");
      } finally {
        this.updatingId = null;
      }
    },

    async remove() {
      if (!this.confirmDeleteId) return;
      this.deletingId = this.confirmDeleteId;
      try {
        await supabaseRedeemCodeRepository.delete(this.confirmDeleteId);
        this.confirmDeleteId = null;
        await this.loadCodes();
      } catch (error) {
        this.loadError = messageOf(error, "Không thể xoá mã đổi thưởng");
      } finally {
        this.deletingId = null;
      }
    },
  },
});
