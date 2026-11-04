<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { FishingPass, FishingPassPayload } from "./fishing-pass-admin";

const props = defineProps<{ pass: FishingPass | null; saving: boolean }>();
const emit = defineEmits<{ save: [payload: FishingPassPayload]; cancel: [] }>();
const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const form = reactive({ name: "", description: "", price: 300, totalDays: 10, startAt: "", endAt: "", isActive: true });
const error = computed(() => {
  if (!form.name.trim()) return "Vui lòng nhập tên vé.";
  if (!Number.isFinite(form.price) || form.price < 0) return "Giá vé phải lớn hơn hoặc bằng 0.";
  if (!Number.isInteger(form.totalDays) || form.totalDays <= 0) return "Số ngày phải là số nguyên lớn hơn 0.";
  if (!form.startAt || !form.endAt) return "Vui lòng chọn thời gian bắt đầu và kết thúc.";
  if (new Date(form.endAt) <= new Date(form.startAt)) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
  return "";
});
watch(() => props.pass, (pass) => {
  Object.assign(form, pass ? { name: pass.name, description: pass.description ?? "", price: pass.price, totalDays: pass.totalDays, startAt: localDateTime(pass.startAt), endAt: localDateTime(pass.endAt), isActive: pass.isActive } : { name: "", description: "", price: 300, totalDays: 10, startAt: "", endAt: "", isActive: true });
}, { immediate: true });
function submit() {
  if (error.value) return;
  emit("save", { name: form.name.trim(), description: form.description.trim() || null, price: form.price, totalDays: form.totalDays, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(), isActive: form.isActive });
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <label class="block text-sm font-medium text-[#24352a]">Tên vé <input v-model="form.name" required maxlength="160" class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" /></label>
    <label class="block text-sm font-medium text-[#24352a]">Mô tả <textarea v-model="form.description" rows="3" class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" /></label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="text-sm font-medium text-[#24352a]">Giá vé <input v-model.number="form.price" type="number" min="0" step="1" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" /></label>
      <label class="text-sm font-medium text-[#24352a]">Số ngày <input v-model.number="form.totalDays" type="number" min="1" step="1" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" /></label>
      <label class="text-sm font-medium text-[#24352a]">Bắt đầu <input v-model="form.startAt" type="datetime-local" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" /></label>
      <label class="text-sm font-medium text-[#24352a]">Kết thúc <input v-model="form.endAt" type="datetime-local" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" /></label>
    </div>
    <label class="flex items-center gap-2 text-sm text-[#24352a]"><input v-model="form.isActive" type="checkbox" class="accent-emerald-700" /> Đang hoạt động</label>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div class="flex justify-end gap-2 border-t border-[#cbd9c6] pt-4">
      <button type="button" class="rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm" @click="emit('cancel')">Huỷ</button>
      <button type="submit" :disabled="saving || !!error" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{{ saving ? 'Đang lưu…' : pass ? 'Lưu thay đổi' : 'Tạo vé' }}</button>
    </div>
  </form>
</template>
