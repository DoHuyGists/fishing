<script lang="ts" setup>
import type { Blueprint } from "../../../types/model/blueprint";
import type { Item } from "../../../types/model/item";
import type { WorkBenchMaterial } from "../../../types/model/workBench";
import { t as tr } from "../../../i18n";




const craftQuantity = defineModel<number>("craftQuantity", { required: true });
defineProps<{
  selectedBlueprint: Blueprint | null;
  resultItem: Item | null | undefined;
  materials: WorkBenchMaterial[];
  quantityValid: boolean;
  craftCost: number;
  canCraft: boolean;
  isLoading: boolean;
  cash: number;
  currencyError: string | null;
}>();
const emit = defineEmits<{
  craft: [];
}>();
</script>

<template>
  <section id="workbench-recipe" class="slide-fade-in from-right player-content-in min-h-72 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:min-h-0 lg:overflow-y-auto">
    <template v-if="selectedBlueprint">
      <div class="flex flex-col items-center border-b border-[#cbd9c6] pb-5 text-center">
        <span class="relative grid size-24 place-items-center rounded-xl border border-[#cbd9c6] bg-white text-3xl">
          <img v-if="resultItem?.image" :src="resultItem.image" :alt="resultItem.name" class="h-full w-full object-contain p-2" />
          <span v-else>{{ resultItem?.icon || resultItem?.name.charAt(0) }}</span>
          <span class="absolute -right-2 -top-2 rounded-full bg-emerald-700 px-2 py-1 text-xs font-bold text-white">×{{ selectedBlueprint.resultQuantity * craftQuantity }}</span>
        </span>
        <div class="mt-2 text-base font-bold">{{ resultItem?.name ?? tr('WorkBenchModal.vat_pham_chua_xac_dinh') }}</div>
        <div class="text-xs opacity-70">{{ resultItem?.information }}</div>
      </div>

      <div class="my-4 flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm font-bold">{{ tr('WorkBenchModal.nguyen_lieu_can_thiet') }}</div>
        <div class="flex items-center gap-2">
          <span class="text-xs">{{ tr('WorkBenchModal.so_lan_che_tao') }}</span>
          <button type="button" :aria-label="tr('WorkBenchModal.giam_so_lan_che_tao')" class="grid size-8 place-items-center rounded border border-[#cbd9c6] bg-white font-bold disabled:opacity-40" :disabled="craftQuantity <= 1" @click="craftQuantity = Math.max(1, craftQuantity - 1)">−</button>
          <input v-model.number="craftQuantity" type="number" min="1" max="1000" step="1" class="w-16 rounded border border-[#cbd9c6] bg-white px-2 py-1.5 text-center text-sm" />
          <button type="button" :aria-label="tr('WorkBenchModal.tang_so_lan_che_tao')" class="grid size-8 place-items-center rounded border border-[#cbd9c6] bg-white font-bold" @click="craftQuantity = Math.max(1, craftQuantity) + 1">+</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div v-for="material in materials" :key="material.item_id" class="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[#cbd9c6] bg-white p-3 text-center">
          <span class="relative grid size-16 place-items-center rounded-lg bg-[#f5f9f0] text-xl">
            <img v-if="material.item?.image" :src="material.item.image" :alt="material.item.name" class="h-full w-full object-contain p-1" />
            <span v-else>{{ material.item?.icon || material.item?.name.charAt(0) || "?" }}</span>
            <span class="absolute -right-2 -top-2 rounded-full bg-[#24352a] px-2 py-1 text-[10px] font-bold text-white">×{{ material.required }}</span>
          </span>
          <span class="line-clamp-2 text-xs font-bold">{{ material.item?.name ?? tr('WorkBenchModal.nguyen_lieu') }}</span>
          <span class="text-[10px]" :class="material.owned >= material.required ? 'text-emerald-700' : 'text-red-600'">{{ tr('WorkBenchModal.co') }} {{ material.owned }}</span>
        </div>
        <div v-if="!materials.length" class="col-span-full py-5 text-center text-xs opacity-60">{{ tr('WorkBenchModal.ban_ve_nay_chua_khai_bao_nguyen_lieu') }}</div>
      </div>
      <div class="mt-4 text-center text-xs font-semibold" :class="canCraft ? 'text-emerald-700' : 'text-red-600'">{{ !quantityValid ? tr('WorkBenchModal.nhap_so_nguyen_tu_1_den_1000') : currencyError || (cash < craftCost ? tr('WorkBenchModal.khong_du_tien_che_tao') : canCraft ? tr('WorkBenchModal.du_nguyen_lieu_value0_vang', { value0: craftCost }) : tr('WorkBenchModal.khong_du_nguyen_lieu_de_che_tao_so_luong_da_chon')) }}</div>
      <button type="button" class="mt-3 w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canCraft || isLoading" @click="emit('craft')">{{ isLoading ? tr('WorkBenchModal.dang_che_tao') : tr('WorkBenchModal.che_tao') }}</button>
    </template>
    <div v-else class="grid h-full min-h-64 place-items-center text-center text-sm opacity-60">{{ tr('WorkBenchModal.chon_mot_ban_ve_de_xem_cong_thuc_che_tao') }}</div>
  </section>
</template>
