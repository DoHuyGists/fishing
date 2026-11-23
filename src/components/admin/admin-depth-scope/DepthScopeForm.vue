<script setup lang="ts">
import type { DepthScopePayload } from "../../../types/table/depthScope";
import { computed, ref, watch } from "vue";

import { useDepthScopeStore } from "./admin-depth-scope-store";

const store = useDepthScopeStore();
const error = ref("");
const draft = computed(() => store.draft);
watch(
  () => store.formOpen,
  () => (error.value = ""),
);

async function submit() {
  const value = draft.value;
  if (!value) return;
  const payload: DepthScopePayload = {
    code: value.code.trim(),
    name: value.name.trim(),
    minDepth: Number(value.minDepth),
    maxDepth: Number(value.maxDepth),
    peakDepth: Number(value.peakDepth),
    curvePower: Number(value.curvePower),
  };
  if (!payload.code || !payload.name) error.value = "Vui lòng nhập mã và tên phạm vi.";
  else if (![payload.minDepth, payload.maxDepth, payload.peakDepth, payload.curvePower].every(Number.isFinite))
    error.value = "Các giá trị độ sâu và độ cong phải là số hợp lệ.";
  else if (payload.minDepth < 0 || payload.maxDepth <= payload.minDepth)
    error.value = "Độ sâu tối đa phải lớn hơn độ sâu tối thiểu và độ sâu tối thiểu không âm.";
  else if (payload.peakDepth < payload.minDepth || payload.peakDepth > payload.maxDepth)
    error.value = "Độ sâu đỉnh phải nằm trong khoảng độ sâu.";
  else if (payload.curvePower <= 0) error.value = "Độ cong phải lớn hơn 0.";
  else {
    error.value = "";
    try {
      await store.save(payload);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Không thể lưu phạm vi độ sâu.";
    }
  }
}
</script>

<template>
  <div
    v-if="store.formOpen && draft"
    class="fixed inset-0 z-[60] grid place-items-center bg-content/40 p-4"
    @click.self="store.closeForm()"
  >
    <form class="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-default bg-white shadow-xl" @submit.prevent="submit">
      <header class="flex shrink-0 items-center justify-between border-b border-border-default px-5 py-4">
        <div>
          <div class="m-0 text-lg font-bold text-content">
            {{ store.editingId ? "Chỉnh sửa phạm vi" : "Thêm phạm vi độ sâu" }}
          </div>
          <div class="m-0 mt-1 text-xs text-content">Thiết lập khoảng độ sâu và hình dạng đường cong.</div>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          class="rounded-lg px-2 py-1 text-xl text-content hover:bg-surface"
          @click="store.closeForm()"
        >
          &times;
        </button>
      </header>
      <div class="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto overscroll-contain p-5 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-xs font-semibold text-content"
          >Mã
          <input
            v-model="draft.code"
            required
            maxlength="100"
            class="rounded-lg border border-border-default px-3 py-2 font-normal"
            placeholder="Ví dụ: SHALLOW"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-content"
          >Tên
          <input
            v-model="draft.name"
            required
            class="rounded-lg border border-border-default px-3 py-2 font-normal"
            placeholder="Ví dụ: Vùng nước nông"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-content"
          >Độ sâu tối thiểu
          <input
            v-model.number="draft.minDepth"
            type="number"
            min="0"
            step="0.01"
            required
            class="rounded-lg border border-border-default px-3 py-2 font-normal"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-content"
          >Độ sâu tối đa
          <input
            v-model.number="draft.maxDepth"
            type="number"
            step="0.01"
            required
            class="rounded-lg border border-border-default px-3 py-2 font-normal"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-content"
          >Độ sâu đỉnh
          <input
            v-model.number="draft.peakDepth"
            type="number"
            step="0.01"
            required
            class="rounded-lg border border-border-default px-3 py-2 font-normal"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-content"
          >Độ cong (curve power)
          <input
            v-model.number="draft.curvePower"
            type="number"
            min="0.01"
            step="0.01"
            required
            class="rounded-lg border border-border-default px-3 py-2 font-normal"
          />
        </label>
        <div
          v-if="error"
          class="m-0 rounded-lg border border-danger bg-surface px-3 py-2 text-xs text-danger sm:col-span-2"
        >
          {{ error }}
        </div>
      </div>
      <footer class="flex shrink-0 justify-end gap-2 border-t border-border-default px-5 py-4">
        <button
          type="button"
          class="rounded-lg border border-border-default px-4 py-2 text-sm text-content hover:bg-surface"
          @click="store.closeForm()"
        >
          Hủy
        </button>
        <button
          type="submit"
          :disabled="store.saving"
          class="rounded-lg bg-content px-4 py-2 text-sm font-semibold text-white hover:bg-content disabled:opacity-50"
        >
          {{ store.saving ? "Đang lưu…" : "Lưu" }}
        </button>
      </footer>
    </form>
  </div>
</template>
