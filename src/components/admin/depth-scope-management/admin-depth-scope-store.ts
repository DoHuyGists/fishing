import { defineStore } from "pinia";
import { supabaseDepthScopeRepository, type DepthScopePayload, type DepthScopeRow } from "../../../data/supabaseDepthScopeRepository";

export const useDepthScopeStore = defineStore("depthScope", {
  state: () => ({
    items: [] as DepthScopeRow[],
    loading: false,
    saving: false,
    error: "",
    formOpen: false,
    editingId: null as string | null,
    draft: null as DepthScopePayload | null,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = "";
      try {
        this.items = await supabaseDepthScopeRepository.fetchAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải danh sách phạm vi độ sâu";
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.editingId = null;
      this.draft = { code: "", name: "", minDepth: 0, maxDepth: 1, peakDepth: 0, curvePower: 1 };
      this.error = "";
      this.formOpen = true;
    },
    openEdit(item: DepthScopeRow) {
      const { code, name, minDepth, maxDepth, peakDepth, curvePower } = item;
      this.editingId = item.id;
      this.draft = { code, name, minDepth, maxDepth, peakDepth, curvePower };
      this.error = "";
      this.formOpen = true;
    },
    closeForm() {
      this.formOpen = false;
      this.draft = null;
      this.editingId = null;
    },
    async save(payload: DepthScopePayload) {
      this.saving = true;
      this.error = "";
      try {
        if (this.editingId) {
          const updated = await supabaseDepthScopeRepository.update(this.editingId, payload);
          const index = this.items.findIndex((item) => item.id === updated.id);
          if (index !== -1) this.items[index] = updated;
        } else {
          this.items.push(await supabaseDepthScopeRepository.create(payload));
          this.items.sort((a, b) => a.code.localeCompare(b.code));
        }
        this.closeForm();
      } finally {
        this.saving = false;
      }
    },
    async remove(id: string) {
      await supabaseDepthScopeRepository.remove(id);
      this.items = this.items.filter((item) => item.id !== id);
    },
  },
});
