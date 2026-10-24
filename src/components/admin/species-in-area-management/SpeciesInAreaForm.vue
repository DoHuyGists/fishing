<script setup lang="ts">
import type { FishingAreaRow } from "../../../data/supabaseFishingAreaRepository";
import type { SpeciesRow } from "../../../data/supabaseSpeciesRepository";
import type { DepthScopeRow } from "../../../data/supabaseDepthScopeRepository";

interface FormData {
  originalAreaId: string | null;
  originalSpeciesId: string | null;
  areaId: string;
  speciesId: string;
  depthScopeId: string;
  weightRate: number;
}

defineProps<{
  form: FormData;
  isSaving: boolean;
  error: string;
  areas: FishingAreaRow[];
  species: SpeciesRow[];
  depthScopes: DepthScopeRow[];
  filteredAreaOptions: FishingAreaRow[];
  filteredSpeciesOptions: SpeciesRow[];
  countryName: (code: string | null) => string;
}>();
const emit = defineEmits<{ close: []; save: [] }>();
const areaSearch = defineModel<string>("areaSearch", { required: true });
const speciesSearch = defineModel<string>("speciesSearch", { required: true });
</script>

<template>
  <div class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent" @click.self="emit('close')">
    <aside class="ml-auto flex h-full w-full max-w-lg flex-col border-l border-[#cbd9c6] bg-white text-[#24352a] shadow-xl">
      <div class="flex shrink-0 items-center justify-between border-b border-[#cbd9c6] px-5 py-4">
        <div>
          <h3 class="m-0 text-base font-extrabold">{{ form.originalAreaId ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình' }}</h3>
          <p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng species_in_area</p>
        </div>
        <button type="button" aria-label="Đóng biểu mẫu" class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100" @click="emit('close')">&times;</button>
      </div>
      <form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="emit('save')">
        <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold">Bãi câu *</label>
          <input v-model="areaSearch" type="search" placeholder="Tìm bãi câu..." class="rounded-md border border-[#cbd9c6] px-3 py-2 text-sm focus:outline-none" />
          <select v-model="form.areaId" size="6" class="rounded-md border border-[#cbd9c6] text-sm focus:outline-none">
            <option v-for="area in filteredAreaOptions" :key="area.id" :value="area.id">{{ area.title || '(Chưa đặt tên)' }} — {{ countryName(area.countryId) }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold">Loài cá *</label>
          <input v-model="speciesSearch" type="search" placeholder="Tìm loài cá..." class="rounded-md border border-[#cbd9c6] px-3 py-2 text-sm focus:outline-none" />
          <select v-model="form.speciesId" size="6" class="rounded-md border border-[#cbd9c6] text-sm focus:outline-none">
            <option v-for="item in filteredSpeciesOptions" :key="item.id" :value="item.id">{{ item.name }}<template v-if="item.rarity"> — {{ item.rarity }}</template></option>
          </select>
        </div>
        <label class="flex flex-col gap-1.5 text-xs font-bold">Phạm vi độ sâu
          <select v-model="form.depthScopeId" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal text-[#24352a]">
            <option value="">Không chọn</option>
            <option v-for="scope in depthScopes" :key="scope.id" :value="scope.id">{{ scope.name }} ({{ scope.code }}) · {{ scope.minDepth }}–{{ scope.maxDepth }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-xs font-bold">Tỉ trọng xuất hiện (weight_rate)
          <input v-model.number="form.weightRate" type="number" min="0" step="1" class="rounded-md border border-[#cbd9c6] px-3 py-2 text-sm font-normal text-gray-800 focus:outline-none" />
          <span class="text-[11px] font-normal text-gray-400">Giá trị càng cao thì loài cá càng dễ xuất hiện tại bãi câu này.</span>
        </label>
      </form>
      <div class="flex shrink-0 items-center justify-end gap-2 border-t border-[#cbd9c6] px-5 py-4">
        <button type="button" class="rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm font-bold hover:bg-[#f5f9f0]" @click="emit('close')">Huỷ</button>
        <button type="button" :disabled="isSaving" class="rounded-lg bg-[#24352a] px-4 py-2 text-sm font-bold text-white hover:bg-[#314a39] disabled:opacity-50" @click="emit('save')">{{ isSaving ? 'Đang lưu...' : 'Lưu cấu hình' }}</button>
      </div>
    </aside>
  </div>
</template>
