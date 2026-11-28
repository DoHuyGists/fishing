<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { WeatherPayload, WeatherRow } from "../../../types/table/weather";
import { useAdminWeatherStore } from "./admin-weather-store";

const props = defineProps<{ weather: WeatherRow | null }>();
const emit = defineEmits<{ close: []; saving: [value: boolean] }>();
const store = useAdminWeatherStore();
const saving = ref(false);
const error = ref("");
const form = reactive<{
  code: string;
  name: string;
  rarityTier: string;
  extremeWeight: number | string;
  durationMin: number | string;
  durationMax: number | string;
  image: string;
}>({ code: "", name: "", rarityTier: "", extremeWeight: 1, durationMin: "", durationMax: "", image: "" });

watch(() => props.weather, (weather) => {
  Object.assign(form, {
    code: weather?.code ?? "",
    name: weather?.name ?? "",
    rarityTier: weather?.rarityTier ?? "",
    extremeWeight: weather?.extremeWeight ?? 1,
    durationMin: weather?.durationMin ?? "",
    durationMax: weather?.durationMax ?? "",
    image: weather?.image ?? "",
  });
  error.value = "";
}, { immediate: true });

async function submit() {
  if (saving.value) return;
  error.value = "";
  try {
    const payload: WeatherPayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      rarityTier: form.rarityTier.trim(),
      extremeWeight: Number(form.extremeWeight),
      durationMin: Number(form.durationMin),
      durationMax: Number(form.durationMax),
      image: form.image.trim() || null,
    };
    if (!payload.code || !payload.name || !payload.rarityTier)
      throw new Error("Vui lòng nhập mã, tên và độ hiếm");
    if (!Number.isFinite(payload.extremeWeight) || payload.extremeWeight < 0.000001 || payload.extremeWeight > 1000000)
      throw new Error("Hệ số khắc nghiệt phải từ 0,000001 đến 1.000.000");
    for (const [key, label] of [
      ["durationMin", "Thời lượng tối thiểu (phút)"],
      ["durationMax", "Thời lượng tối đa (phút)"],
    ] as const) {
      if (String(form[key]).trim() === "") throw new Error(`Vui lòng nhập "${label}"`);
      if (!Number.isInteger(payload[key]) || payload[key] < 0)
        throw new Error(`"${label}" nằm ngoài phạm vi hợp lệ`);
    }
    if (payload.durationMin > payload.durationMax)
      throw new Error("Thời lượng tối thiểu phải nhỏ hơn hoặc bằng tối đa");

    saving.value = true;
    emit("saving", true);
    if (props.weather) await store.update(props.weather.id, payload);
    else await store.create(payload);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Không thể lưu thời tiết";
    return;
  } finally {
    saving.value = false;
    emit("saving", false);
  }
  emit("close");
}
</script>

<template>
  <form class="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl" @submit.prevent="submit">
    <div class="px-5 py-3 border-b border-border font-extrabold text-sm">
      {{ weather ? "Cập nhật" : "Thêm mới" }} - Quản lý thời tiết
    </div>
    <fieldset :disabled="saving" class="m-0 min-w-0 border-0 p-5 overflow-auto flex flex-col gap-3">
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Mã <span class="text-danger">*</span></span>
        <input v-model="form.code" required class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Tên <span class="text-danger">*</span></span>
        <input v-model="form.name" required class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Độ hiếm <span class="text-danger">*</span></span>
        <input v-model="form.rarityTier" required class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Hệ số khắc nghiệt (E) <span class="text-danger">*</span></span>
        <input v-model.number="form.extremeWeight" type="number" required min="0.000001" max="1000000" step="any" class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Thời lượng tối thiểu (phút) <span class="text-danger">*</span></span>
        <input v-model.number="form.durationMin" type="number" required min="0" step="1" class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Thời lượng tối đa (phút) <span class="text-danger">*</span></span>
        <input v-model.number="form.durationMax" type="number" required min="0" step="1" class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Ảnh</span>
        <input v-model="form.image" class="px-2 py-1.5 border border-content rounded-lg font-normal" />
      </label>
      <label class="flex flex-col gap-1 text-xs font-bold text-content">
        <span>Ngày tạo</span>
        <input :value="weather?.createdAt ? new Date(weather.createdAt).toLocaleString('vi-VN') : ''" disabled class="px-2 py-1.5 border border-border rounded-lg bg-surface text-content font-normal" />
      </label>
      <div v-if="error" role="alert" class="px-3 py-2 text-xs rounded-lg bg-surface border border-danger text-danger">{{ error }}</div>
    </fieldset>
    <div class="px-5 py-3 border-t border-border flex justify-end gap-2">
      <button type="button" :disabled="saving" class="px-3 py-1.5 border border-content rounded-lg text-xs font-bold cursor-pointer" @click="emit('close')">Huỷ</button>
      <button type="submit" :disabled="saving" class="px-3 py-1.5 rounded-lg bg-content-strong text-white text-xs font-bold cursor-pointer disabled:opacity-50">{{ saving ? "Đang lưu..." : "Lưu" }}</button>
    </div>
  </form>
</template>
