<script lang="ts" setup>
import { reactive, ref, watch } from "vue";
import type { SpeciesPayload, SpeciesRow } from "../../../data/supabaseSpeciesRepository";
import { useAdminSpeciesStore } from "./species-store";

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

interface SpeciesFormState {
  name: string;
  information: string;
  location: string;
  status: string;
  image: string;
  rarity: string;
  weightMin: number | null;
  weightMax: number | null;
  baseCatchRate: number | null;
}

function emptyForm(): SpeciesFormState {
  return {
    name: "",
    information: "",
    location: "",
    status: "normal",
    image: "",
    rarity: "",
    weightMin: null,
    weightMax: null,
    baseCatchRate: 0.5,
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
            status: species.status ?? "",
            image: species.image ?? "",
            rarity: species.rarity ?? "",
            weightMin: species.weight_min,
            weightMax: species.weight_max,
            baseCatchRate: species.base_catch_rate,
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
    status: form.status.trim() || null,
    image: form.image.trim() || null,
    rarity: form.rarity.trim() || null,
    weight_min: weightMin,
    weight_max: weightMax,
    base_catch_rate: baseCatchRate,
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
  <aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl" @click.stop>
    <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
      <div>
        <h3 class="m-0 text-base font-extrabold text-[#153221]">
          {{ species ? "Chỉnh sửa loài cá" : "Thêm loài cá" }}
        </h3>
        <p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng species</p>
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
            Trạng thái
            <input
              v-model="form.status"
              placeholder="normal"
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
          class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {{ isSaving ? "Đang lưu..." : "Lưu loài cá" }}
        </button>
      </div>
    </form>
  </aside>
</template>
