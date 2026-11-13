import type { DailyMissionRewardRow, RewardPayload } from "../../../types/table/dailyMissionAdmin";
import { defineStore } from "pinia";
import { supabaseDailyMissionRewardRepository } from "../../../data/supabaseDailyMissionAdminRepository";

const emptyForm = () => ({ id: null as string | null, required_points: 1, reward_data: "[]", is_active: true });
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Không thể thực hiện thao tác.";

export const useAdminDailyMissionRewardStore = defineStore("AdminDailyMissionReward", {
  state: () => ({
    items: [] as DailyMissionRewardRow[], search: "", statusFilter: "ALL",
    page: 1, pageSize: 10, total: 0, requestId: 0,
    isLoading: false, loadError: "", isFormOpen: false, isSaving: false,
    formError: "", form: emptyForm(), confirmDeleteId: null as string | null, isDeleting: false,
  }),
  getters: {
    filteredItems(state): DailyMissionRewardRow[] {
      return state.items;
    },
  },
  actions: {
    async load(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.isLoading = true;
      this.loadError = "";
      try {
        const result = await supabaseDailyMissionRewardRepository.fetchPage(page, this.search, this.statusFilter);
        if (request !== this.requestId) return;
        this.items = result.items; this.page = page; this.total = result.total;
        if (!result.items.length && page > 1) await this.load(Math.max(1, Math.ceil(result.total / this.pageSize)));
      }
      catch (error) { if (request === this.requestId) this.loadError = messageOf(error); }
      finally { if (request === this.requestId) this.isLoading = false; }
    },
    openCreateForm() {
      this.form = emptyForm(); this.formError = ""; this.isFormOpen = true;
    },
    openEditForm(item: DailyMissionRewardRow) {
      this.form = { ...item, reward_data: JSON.stringify(item.reward_data, null, 2) };
      this.formError = ""; this.isFormOpen = true;
    },
    closeForm() { if (!this.isSaving) { this.isFormOpen = false; this.formError = ""; } },
    buildPayload(): RewardPayload {
      const form = this.form;
      const points = Number(form.required_points);
      if (!Number.isInteger(points) || points <= 0 || points > 2147483647) throw new Error("Mốc điểm phải là số nguyên dương, tối đa 2147483647.");
      if (this.items.some(item => item.id !== form.id && item.required_points === points)) throw new Error("Mốc điểm đã tồn tại.");
      let data: unknown;
      try { data = JSON.parse(form.reward_data); } catch { throw new Error("Phần thưởng phải là JSON hợp lệ."); }
      if (!Array.isArray(data)) throw new Error("Phần thưởng phải là một mảng JSON.");
      return { required_points: points, reward_data: data, is_active: form.is_active };
    },
    async save() {
      if (this.isSaving) return;
      this.formError = "";
      try {
        const payload = this.buildPayload();
        this.isSaving = true;
        await supabaseDailyMissionRewardRepository.save(this.form.id, payload);
        await this.load();
        this.isFormOpen = false;
      } catch (error) { this.formError = messageOf(error); }
      finally { this.isSaving = false; }
    },
    async remove() {
      if (!this.confirmDeleteId || this.isDeleting) return;
      this.isDeleting = true; this.loadError = "";
      try {
        const id = this.confirmDeleteId;
        await supabaseDailyMissionRewardRepository.remove(id);
        await this.load();
        this.confirmDeleteId = null;
      } catch (error) { this.loadError = messageOf(error); }
      finally { this.isDeleting = false; }
    },
  },
});

