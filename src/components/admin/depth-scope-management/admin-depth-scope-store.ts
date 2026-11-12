import type { DepthScopePayload, DepthScopeRow } from "../../../types/table/depthScope";
import { defineStore } from "pinia";
import { supabaseDepthScopeRepository } from "../../../data/supabaseDepthScopeRepository";

function buildDepthCurve({ minDepth, maxDepth, peakDepth, curvePower }: DepthScopeRow) {
  if (
    ![minDepth, maxDepth, peakDepth, curvePower].every(Number.isFinite) ||
    minDepth < 0 || maxDepth <= minDepth ||
    peakDepth < minDepth || peakDepth > maxDepth || curvePower <= 0
  ) return null;

  const peakPosition = (peakDepth - minDepth) / (maxDepth - minDepth);
  // Include the exact peak so narrow or asymmetric curves always reach factor 1.
  const positions = [...new Set([
    ...Array.from({ length: 101 }, (_, index) => index / 100),
    peakPosition,
  ])].sort((a, b) => a - b);
  const points = positions.map((position) => {
    // Match preview_fish_by_depth, including its power curves at boundary peaks.
    const base = peakPosition === 0 ? 1 - position
      : peakPosition === 1 ? position
      : Math.sin(Math.PI / 2 * (position <= peakPosition
        ? position / peakPosition
        : (1 - position) / (1 - peakPosition)));
    const factor = Math.pow(Math.min(1, Math.max(0, base)), curvePower);
    return `${(24 + position * 160).toFixed(2)},${(66 - factor * 56).toFixed(2)}`;
  }).join(" ");

  return { points, peakX: 24 + peakPosition * 160 };
}

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
  getters: {
    itemsWithCurves: (state) => state.items.map((item) => ({ ...item, curve: buildDepthCurve(item) })),
  },
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
