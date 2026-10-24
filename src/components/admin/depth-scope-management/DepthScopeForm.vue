<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DepthScopePayload } from "../../../data/supabaseDepthScopeRepository";
import { useDepthScopeStore } from "./depthScope";

const store = useDepthScopeStore();
const error = ref("");
const draft = computed(() => store.draft);
watch(() => store.formOpen, () => (error.value = ""));

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
  else if (![payload.minDepth, payload.maxDepth, payload.peakDepth, payload.curvePower].every(Number.isFinite)) error.value = "Các giá trị độ sâu và độ cong phải là số hợp lệ.";
  else if (payload.minDepth < 0 || payload.maxDepth <= payload.minDepth) error.value = "Độ sâu tối đa phải lớn hơn độ sâu tối thiểu và độ sâu tối thiểu không âm.";
  else if (payload.peakDepth < payload.minDepth || payload.peakDepth > payload.maxDepth) error.value = "Độ sâu đỉnh phải nằm trong khoảng độ sâu.";
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
  <div v-if="store.formOpen && draft" class="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" @click.self="store.closeForm()">
    <form class="w-full max-w-lg rounded-2xl border border-[#cbd9c6] bg-white shadow-xl" @submit.prevent="submit">
      <header class="flex items-center justify-between border-b border-[#cbd9c6] px-5 py-4">
        <div>
          <h3 class="m-0 text-lg font-bold text-[#24352a]">{{ store.editingId ? "Chỉnh sửa phạm vi" : "Thêm phạm vi độ sâu" }}</h3>
          <p class="m-0 mt-1 text-xs text-gray-500">Thiết lập khoảng độ sâu và hình dạng đường cong.</p>
        </div>
        <button type="button" aria-label="Đóng" class="rounded-lg px-2 py-1 text-xl text-gray-500 hover:bg-gray-100" @click="store.closeForm()">&times;</button>
      </header>
      <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-xs font-semibold text-[#24352a]">Mã
          <input v-model="draft.code" required maxlength="100" class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" placeholder="Ví dụ: SHALLOW" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-[#24352a]">Tên
          <input v-model="draft.name" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" placeholder="Ví dụ: Vùng nước nông" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-[#24352a]">Độ sâu tối thiểu
          <input v-model.number="draft.minDepth" type="number" min="0" step="0.01" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-[#24352a]">Độ sâu tối đa
          <input v-model.number="draft.maxDepth" type="number" step="0.01" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-[#24352a]">Độ sâu đỉnh
          <input v-model.number="draft.peakDepth" type="number" step="0.01" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-[#24352a]">Độ cong (curve power)
          <input v-model.number="draft.curvePower" type="number" min="0.01" step="0.01" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <p v-if="error" class="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2">{{ error }}</p>
      </div>
      <footer class="flex justify-end gap-2 border-t border-[#cbd9c6] px-5 py-4">
        <button type="button" class="rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm text-[#24352a] hover:bg-[#f5f9f0]" @click="store.closeForm()">Hủy</button>
        <button type="submit" :disabled="store.saving" class="rounded-lg bg-[#24352a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#314a39] disabled:opacity-50">{{ store.saving ? "Đang lưu…" : "Lưu" }}</button>
      </footer>
    </form>
  </div>
</template>
