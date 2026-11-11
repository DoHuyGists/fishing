<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed, ref, watch } from 'vue'
import { useAquacultureStore } from '../../../stores/aquaculture'
import type { CareMode } from '../../../data/aquaculture'
import { formatDuration } from './pondPresentation'
import Cash from '../currency/Cash.vue'

const farm = useAquacultureStore()
const speciesId = ref('')
const quantity = ref(1)
const mode = ref<CareMode>('simple')
const rule = computed(() => farm.farm?.species.find(s => s.species_id === speciesId.value))
const maximum = computed(() => farm.maxStock(speciesId.value))
const cost = computed(() => (rule.value?.seed_cash ?? 0) * (Number(quantity.value) || 0))
watch(() => farm.selectedPondId, () => { quantity.value = 1 })
watch(maximum, max => { if (quantity.value > max) quantity.value = Math.max(1, max) })
async function submit() {
  if (await farm.stock(speciesId.value, quantity.value, mode.value)) quantity.value = 1
}
</script>

<template>
  <details class="rounded-xl border border-[#cbd9c6] bg-white" :open="!farm.activePond?.fish.length">
    <summary class="cursor-pointer px-4 py-3 text-sm font-bold">{{ tr('AquacultureStockForm.tha_mot_lua_moi') }}</summary>
    <form class="space-y-3 border-t border-[#cbd9c6] p-4 text-xs" @submit.prevent="submit">
      <div class="m-0 leading-relaxed text-stone-600">{{ tr('AquacultureStockForm.moi_lua_mot_loai_ban_co_the_tha_nhieu_loai_chung_ao_neu_con_suc_') }}</div>
      <label class="block">{{ tr('AquacultureStockForm.loai_ca') }}
        <select v-model="speciesId" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white p-2" :disabled="!farm.canMutate">
          <option value="">{{ tr('AquacultureStockForm.chon_loai_ca') }}</option>
          <option v-for="species in farm.farm?.species" :key="species.species_id" :value="species.species_id" :disabled="!species.can_stock">
            {{ farm.speciesName(species.species_id) }}{{ species.can_stock ? '' : tr('AquacultureStockForm.can_cau_duoc_truoc') }}
          </option>
        </select>
      </label>
      <div v-if="!farm.farm?.species.length" class="text-stone-500">{{ tr('AquacultureStockForm.chua_co_loai_nao_duoc_mo_nuoi') }}</div>
      <template v-if="rule">
        <div class="grid grid-cols-2 gap-2 rounded-lg bg-[#f5f9f0] p-3">
          <span>{{ rule.capacity_per_fish }} {{ tr('AquacultureStockForm.suc_chua_con') }}</span><span>{{ formatDuration(rule.grow_seconds) }}{{ tr('AquacultureStockForm.lua') }}</span>
          <span class="flex flex-wrap items-center gap-1"><Cash :amount="rule.seed_cash" :size="18" />{{ tr('AquacultureStockForm.con_giong') }}</span><span>{{ tr('AquacultureStockForm.ty_le_dac_biet') }} {{ +(rule.rare_chance * 100).toFixed(3) }}%</span>
        </div>
        <label class="block">{{ tr('AquacultureStockForm.so_luong_toi_da') }} {{ maximum }} {{ tr('AquacultureStockForm.con_theo_cho_trong_va_so_du') }}
          <input v-model.number="quantity" type="number" min="1" :max="maximum" step="1" required :disabled="!farm.canMutate || !maximum" class="mt-1 w-full rounded-lg border border-[#cbd9c6] p-2" />
        </label>
        <fieldset class="space-y-2" :disabled="!farm.canMutate">
          <legend class="mb-2 font-semibold">{{ tr('AquacultureStockForm.cach_nuoi') }}</legend>
          <label class="flex items-start gap-2 rounded-lg border border-[#cbd9c6] p-2">
            <input v-model="mode" type="radio" value="simple" name="care-mode" class="mt-0.5" />
            <span><b>{{ tr('AquacultureStockForm.thong_tha') }}</b><span class="mt-1 block text-stone-500">{{ tr('AquacultureStockForm.tha_roi_cho_ca_lon_khong_can_cho_an_hay_cham_soc') }}</span></span>
          </label>
          <label class="flex items-start gap-2 rounded-lg border border-[#cbd9c6] p-2">
            <input v-model="mode" type="radio" value="advanced" name="care-mode" class="mt-0.5" />
            <span><b>{{ tr('AquacultureStockForm.cham_chut') }}</b><span class="mt-1 block text-stone-500">{{ tr('AquacultureStockForm.cham_de_tang_can_nang_va_co_hoi_dac_biet_toi_da') }}{{ +(rule.advanced_rare_bonus * 100).toFixed(3) }} {{ tr('AquacultureStockForm.diem_bo_cham_van_lon_khong_mat_ca') }}</span></span>
          </label>
        </fieldset>
        <button type="submit" :disabled="!farm.canMutate || !maximum || !Number.isInteger(quantity) || quantity < 1 || quantity > maximum" class="w-full rounded-lg bg-emerald-700 p-2.5 font-semibold text-white disabled:opacity-50">
          {{ tr('AquacultureStockForm.tha_ca') }} <Cash :amount="cost" :size="18" :interactive="false" />
        </button>
      </template>
    </form>
  </details>
</template>
