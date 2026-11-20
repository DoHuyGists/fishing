<script lang="ts" setup>
import type { SpeciesFormState, SpeciesPayload, SpeciesRow } from "../../../types/table/species";
import { reactive, ref, watch } from "vue";

import { useAdminSpeciesStore } from "./admin-species-store";

const props = defineProps<{
  species: SpeciesRow | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const speciesStore = useAdminSpeciesStore();
const isSaving = ref(false);
const formError = ref("");

function emptyForm(): SpeciesFormState {
  return {
    name: "",
    information: "",
    location: "",
    image: "",
    rarity: "",
    weightMin: null,
    weightMax: null,
    baseCatchRate: 0.5,
    rareWeight: 1,
    activeTime: "",
    experiencePoint: 0,
    fishType: "",
    strength: null,
    alertness: null,
    burstMultiplier: null,
  };
}

const form = reactive<SpeciesFormState>(emptyForm());

watch(
  () => props.species,
  (species) => {
    Object.assign(
      form,
      species
        ? {
            name: species.name,
            information: species.information ?? "",
            location: species.location ?? "",
            image: species.image ?? "",
            rarity: species.rarity ?? "",
            weightMin: species.weight_min,
            weightMax: species.weight_max,
            baseCatchRate: species.base_catch_rate,
            rareWeight: species.rare_weight ?? 1,
            activeTime: species.active_time ?? "",
            experiencePoint: species.experience_point ?? 0,
            fishType: species.fish_type ?? "",
            strength: species.strength,
            alertness: species.alertness,
            burstMultiplier: species.burst_multiplier,
          }
        : emptyForm(),
    );
    formError.value = "";
  },
  { immediate: true },
);

function optionalNumber(value: number | null | string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildPayload(): SpeciesPayload | null {
  const name = form.name.trim();
  const weightMin = optionalNumber(form.weightMin);
  const weightMax = optionalNumber(form.weightMax);
  const baseCatchRate = optionalNumber(form.baseCatchRate);
  const rareWeight = optionalNumber(form.rareWeight);
  const experiencePoint = optionalNumber(form.experiencePoint);
  const strength = optionalNumber(form.strength);
  const alertness = optionalNumber(form.alertness);
  const burstMultiplier = optionalNumber(form.burstMultiplier);

  if (experiencePoint === null || !Number.isInteger(experiencePoint) || experiencePoint < 0) {
    formError.value = "Điểm kinh nghiệm phải là số nguyên không âm";
    return null;
  }
  if ([strength, alertness].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
    formError.value = "Sức mạnh và độ cảnh giác phải là số không âm hợp lệ";
    return null;
  }
  if (burstMultiplier !== null && (!Number.isFinite(burstMultiplier) || burstMultiplier < 1 || burstMultiplier > 10)) {
    formError.value = "Hệ số bùng nổ phải nằm trong khoảng 1 đến 10";
    return null;
  }

  if (rareWeight === null || !Number.isFinite(rareWeight) || rareWeight <= 0 || rareWeight > 1000000) {
    formError.value = "Trọng số độ hiếm phải lớn hơn 0 và không vượt quá 1.000.000";
    return null;
  }

  if (!name) {
    formError.value = "Tên loài cá là bắt buộc";
    return null;
  }
  if ([weightMin, weightMax, baseCatchRate].some((value) => value !== null && !Number.isFinite(value))) {
    formError.value = "Các giá trị số phải hợp lệ";
    return null;
  }
  if ((weightMin !== null && weightMin < 0) || (weightMax !== null && weightMax < 0)) {
    formError.value = "Khối lượng không được nhỏ hơn 0";
    return null;
  }
  if (weightMin !== null && weightMax !== null && weightMin > weightMax) {
    formError.value = "Khối lượng tối thiểu không được lớn hơn tối đa";
    return null;
  }
  if (baseCatchRate !== null && (baseCatchRate < 0 || baseCatchRate > 1)) {
    formError.value = "Tỉ lệ bắt cơ bản phải nằm trong khoảng 0 đến 1";
    return null;
  }

  return {
    name,
    information: form.information.trim() || null,
    location: form.location.trim() || null,
    image: form.image.trim() || null,
    rarity: form.rarity.trim() || null,
    weight_min: weightMin,
    weight_max: weightMax,
    base_catch_rate: baseCatchRate,
    rare_weight: rareWeight,
    active_time: form.activeTime.trim() || null,
    experience_point: experiencePoint,
    fish_type: form.fishType.trim() || null,
    strength,
    alertness,
    burst_multiplier: burstMultiplier,
  };
}

async function handleSave() {
  formError.value = "";
  const payload = buildPayload();
  if (!payload) return;

  isSaving.value = true;
  try {
    if (props.species) await speciesStore.updateSpecies(props.species.id, payload);
    else await speciesStore.createSpecies(payload);
    emit("saved");
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Không thể lưu loài cá";
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <aside class="player-popup-in ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl" @click.stop>
    <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
      <div>
        <div class="m-0 text-base font-extrabold text-content-strong">
          {{ species ? "Chỉnh sửa loài cá" : "Thêm loài cá" }}
        </div>
      </div>
      <button
        type="button"
        aria-label="Đóng biểu mẫu"
        class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100"
        @click="emit('close')"
      >
        &times;
      </button>
    </div>
    <form class="flex flex-1 flex-col overflow-y-auto" @submit.prevent="handleSave">
      <div class="flex-1 space-y-4 p-5">
        <div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ formError }}
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2">
            Tên loài *
            <input
              v-model="form.name"
              required
              maxlength="200"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Khu vực
            <input
              v-model="form.location"
              placeholder="Ví dụ: VN"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Độ hiếm
            <input
              v-model="form.rarity"
              placeholder="Ví dụ: common, rare..."
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Tỉ lệ bắt cơ bản (0–1)
            <input
              v-model.number="form.baseCatchRate"
              type="number"
              min="0"
              max="1"
              step="0.01"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Khối lượng tối thiểu
            <input
              v-model.number="form.weightMin"
              type="number"
              min="0"
              step="0.01"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Khối lượng tối đa
            <input
              v-model.number="form.weightMax"
              type="number"
              min="0"
              step="0.01"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Trọng số độ hiếm (R)
            <input v-model.number="form.rareWeight" type="number" min="0.000001" max="1000000" step="any" required class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Thời gian hoạt động
            <input v-model="form.activeTime" placeholder="ALL, DAY, NIGHT..." class="rounded-md border border-border-default px-3 py-2 text-sm font-normal text-content focus:border-emerald-600 focus:outline-none" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Loại cá
            <input v-model="form.fishType" class="rounded-md border border-border-default px-3 py-2 text-sm font-normal text-content focus:border-emerald-600 focus:outline-none" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Điểm kinh nghiệm *
            <input v-model.number="form.experiencePoint" type="number" min="0" step="1" required class="rounded-md border border-border-default px-3 py-2 text-sm font-normal text-content focus:border-emerald-600 focus:outline-none" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Sức mạnh kéo
            <input v-model.number="form.strength" type="number" min="0" step="any" class="rounded-md border border-border-default px-3 py-2 text-sm font-normal text-content focus:border-emerald-600 focus:outline-none" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Độ cảnh giác
            <input v-model.number="form.alertness" type="number" min="0" step="any" class="rounded-md border border-border-default px-3 py-2 text-sm font-normal text-content focus:border-emerald-600 focus:outline-none" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">
            Hệ số bùng nổ (1–10)
            <input v-model.number="form.burstMultiplier" type="number" min="1" max="10" step="any" class="rounded-md border border-border-default px-3 py-2 text-sm font-normal text-content focus:border-emerald-600 focus:outline-none" />
          </label>
          <div class="rounded-md border border-border-default bg-surface p-3 text-xs text-content sm:col-span-2">
            Trọng số theo mùa: {{ species?.season_weight ?? 1 }} (tự động theo mùa, không phải %)
            <template v-if="species">
              <div class="mt-2 break-all">ID: {{ species.id }}</div>
              <div class="mt-2">Ngày tạo: {{ new Date(species.created_at).toLocaleString('vi-VN') }}</div>
            </template>
          </div>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2">
            Đường dẫn hình ảnh
            <input
              v-model="form.image"
              type="text"
              placeholder="https://... hoặc đường dẫn asset"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2">
            Thông tin
            <textarea
              v-model="form.information"
              rows="5"
              class="resize-y rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"
            ></textarea>
          </label>
        </div>
      </div>
      <div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
          @click="emit('close')"
        >
          Huỷ
        </button>
        <button
          type="submit"
          :disabled="isSaving"
          class="rounded-lg bg-content-strong px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {{ isSaving ? "Đang lưu..." : "Lưu loài cá" }}
        </button>
      </div>
    </form>
  </aside>
</template>
