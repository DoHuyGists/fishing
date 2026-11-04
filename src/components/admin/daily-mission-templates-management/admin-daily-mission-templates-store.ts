import { defineStore } from "pinia";
import { supabaseDailyMissionTemplateRepository, type DailyMissionTemplateRow, type TemplatePayload } from "../../../data/supabaseDailyMissionAdminRepository";

const emptyForm = () => ({ id: null as string | null, code: "", name: "", description: "", event_type: "", target_value: 1, mission_points: 1, difficulty: "EASY", weight: 1, config: "{}", is_active: true });
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Không thể thực hiện thao tác.";

export const useAdminDailyMissionTemplateStore = defineStore("AdminDailyMissionTemplate", {
  state: () => ({
    items: [] as DailyMissionTemplateRow[], search: "", statusFilter: "ALL",
    isLoading: false, loadError: "", isFormOpen: false, isSaving: false,
    formError: "", form: emptyForm(), confirmDeleteId: null as string | null, isDeleting: false,
  }),
  getters: {
    filteredItems(state): DailyMissionTemplateRow[] {
      const keyword = state.search.trim().toLocaleLowerCase();
      return state.items.filter(item =>
        [item.code, item.name, item.description, item.event_type, item.difficulty].some(value => value?.toLocaleLowerCase().includes(keyword)) &&
        (state.statusFilter === "ALL" || item.is_active === (state.statusFilter === "ACTIVE")),
      );
    },
  },
  actions: {
    async load() {
      if (this.isLoading) return;
      this.isLoading = true;
      this.loadError = "";
      try { this.items = await supabaseDailyMissionTemplateRepository.fetchAll(); }
      catch (error) { this.loadError = messageOf(error); }
      finally { this.isLoading = false; }
    },
    openCreateForm() {
      this.form = emptyForm(); this.formError = ""; this.isFormOpen = true;
    },
    openEditForm(item: DailyMissionTemplateRow) {
      this.form = { ...item, description: item.description ?? "", config: JSON.stringify(item.config, null, 2) };
      this.formError = ""; this.isFormOpen = true;
    },
    closeForm() { if (!this.isSaving) { this.isFormOpen = false; this.formError = ""; } },
    buildPayload(): TemplatePayload {
      const form = this.form;
      const code = form.code.trim(), name = form.name.trim(), event_type = form.event_type.trim(), difficulty = form.difficulty.trim();
      if (!code || !name || !event_type || !difficulty) throw new Error("Vui lòng nhập mã, tên, loại sự kiện và độ khó.");
      if (this.items.some(item => item.id !== form.id && item.code === code)) throw new Error("Mã nhiệm vụ đã tồn tại.");
      const target = Number(form.target_value), points = Number(form.mission_points), weight = Number(form.weight);
      if (!Number.isFinite(target) || target <= 0) throw new Error("Mục tiêu phải lớn hơn 0.");
      if (!Number.isInteger(points) || points <= 0 || points > 2147483647) throw new Error("Điểm nhiệm vụ phải là số nguyên dương, tối đa 2147483647.");
      if (form.weight === null || String(form.weight).trim() === "" || !Number.isInteger(weight) || weight < 0 || weight > 2147483647) throw new Error("Trọng số phải là số nguyên từ 0 đến 2147483647.");
      let config: unknown;
      try { config = JSON.parse(form.config); } catch { throw new Error("Cấu hình phải là JSON hợp lệ."); }
      if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Cấu hình phải là một object JSON.");
      return { code, name, event_type, difficulty, description: form.description.trim() || null, target_value: target, mission_points: points, weight, config: config as Record<string, unknown>, is_active: form.is_active };
    },
    async save() {
      if (this.isSaving) return;
      this.formError = "";
      try {
        const payload = this.buildPayload();
        this.isSaving = true;
        const saved = await supabaseDailyMissionTemplateRepository.save(this.form.id, payload);
        this.items = [...this.items.filter(item => item.id !== saved.id), saved].sort((a, b) => a.code.localeCompare(b.code));
        this.isFormOpen = false;
      } catch (error) { this.formError = messageOf(error); }
      finally { this.isSaving = false; }
    },
    async remove() {
      if (!this.confirmDeleteId || this.isDeleting) return;
      this.isDeleting = true; this.loadError = "";
      try {
        const id = this.confirmDeleteId;
        await supabaseDailyMissionTemplateRepository.remove(id);
        this.items = this.items.filter(item => item.id !== id);
        this.confirmDeleteId = null;
      } catch (error) { this.loadError = messageOf(error); }
      finally { this.isDeleting = false; }
    },
  },
});

