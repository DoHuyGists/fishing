<script setup lang="ts">
import type { AdminFishingPass, AdminFishingPassItem } from "../../../types/model/fishingPassRewardsAdmin";
import type { FishingPassRewardPayload, FishingPassRewardRow } from "../../../types/table/fishingPassRewardsAdmin";
import { computed, reactive, watch } from "vue";


const props = defineProps<{ reward: FishingPassRewardRow | null; passes: AdminFishingPass[]; items: AdminFishingPassItem[]; saving: boolean }>();
const emit = defineEmits<{ save: [payload: FishingPassRewardPayload]; cancel: [] }>();
const form = reactive({ passId: "", dayNumber: 1, rewardType: "FREE" as "FREE" | "PREMIUM", itemId: "", quantity: 1 });
const selectedPass = computed(() => props.passes.find((pass) => pass.id === form.passId) ?? null);
const error = computed(() => {
  if (!form.passId) return "Vui lòng chọn vé câu.";
  if (!form.itemId) return "Vui lòng chọn vật phẩm.";
  if (!Number.isInteger(form.dayNumber) || form.dayNumber < 1) return "Ngày nhận phải là số nguyên lớn hơn 0.";
  if (selectedPass.value && form.dayNumber > selectedPass.value.totalDays) return `Ngày nhận không được vượt quá ${selectedPass.value.totalDays} ngày của vé.`;
  if (!Number.isInteger(form.quantity) || form.quantity < 1) return "Số lượng phải là số nguyên lớn hơn 0.";
  return "";
});
watch(() => [props.reward, props.passes] as const, ([reward, passes]) => {
  Object.assign(form, reward ? { passId: reward.passId, dayNumber: reward.dayNumber, rewardType: reward.rewardType, itemId: reward.itemId, quantity: reward.quantity } : { passId: passes[0]?.id ?? "", dayNumber: 1, rewardType: "FREE", itemId: props.items[0]?.id ?? "", quantity: 1 });
}, { immediate: true });
function submit() {
  if (error.value) return;
  emit("save", { passId: form.passId, dayNumber: form.dayNumber, rewardType: form.rewardType, itemId: form.itemId, quantity: form.quantity });
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <label class="block text-sm font-medium text-[#24352a]">Vé câu
      <select v-model="form.passId" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2"><option value="" disabled>Chọn vé câu</option><option v-for="pass in passes" :key="pass.id" :value="pass.id">{{ pass.name }} ({{ pass.totalDays }} ngày)</option></select>
    </label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="text-sm font-medium text-[#24352a]">Ngày nhận
        <input v-model.number="form.dayNumber" type="number" min="1" :max="selectedPass?.totalDays" step="1" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" />
      </label>
      <label class="text-sm font-medium text-[#24352a]">Loại phần thưởng
        <select v-model="form.rewardType" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2"><option value="FREE">Miễn phí (FREE)</option><option value="PREMIUM">Cao cấp (PREMIUM)</option></select>
      </label>
      <label class="text-sm font-medium text-[#24352a] sm:col-span-2">Vật phẩm
        <select v-model="form.itemId" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2"><option value="" disabled>Chọn vật phẩm</option><option v-for="item in items" :key="item.id" :value="item.id">{{ item.icon ? `${item.icon} ` : "" }}{{ item.name }}{{ item.category ? ` · ${item.category}` : "" }}</option></select>
      </label>
      <label class="text-sm font-medium text-[#24352a]">Số lượng
        <input v-model.number="form.quantity" type="number" min="1" step="1" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] px-3 py-2" />
      </label>
    </div>
    <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
    <div class="text-xs text-[#24352a]/65">Mỗi vé chỉ có một phần thưởng cho cùng ngày và loại (FREE/PREMIUM).</div>
    <div class="flex justify-end gap-2 border-t border-[#cbd9c6] pt-4">
      <button type="button" class="rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm" @click="emit('cancel')">Huỷ</button>
      <button type="submit" :disabled="saving || !!error" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{{ saving ? 'Đang lưu…' : reward ? 'Lưu thay đổi' : 'Tạo phần thưởng' }}</button>
    </div>
  </form>
</template>
