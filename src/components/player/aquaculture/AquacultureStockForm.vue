<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAquacultureStore } from '../../../stores/aquaculture'
import type { CareMode } from '../../../data/aquaculture'
import { formatDuration } from './pondPresentation'

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
    <summary class="cursor-pointer px-4 py-3 text-sm font-bold">+ Thả một lứa mới</summary>
    <form class="space-y-3 border-t border-[#cbd9c6] p-4 text-xs" @submit.prevent="submit">
      <p class="m-0 leading-relaxed text-stone-600">Mỗi lứa một loài. Bạn có thể thả nhiều loài chung ao nếu còn sức chứa.</p>
      <label class="block">Loài cá
        <select v-model="speciesId" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white p-2" :disabled="!farm.canMutate">
          <option value="">Chọn loài cá</option>
          <option v-for="species in farm.farm?.species" :key="species.species_id" :value="species.species_id" :disabled="!species.can_stock">
            {{ farm.speciesName(species.species_id) }}{{ species.can_stock ? '' : ' · Cần câu được trước' }}
          </option>
        </select>
      </label>
      <p v-if="!farm.farm?.species.length" class="text-stone-500">Chưa có loài nào được mở nuôi.</p>
      <template v-if="rule">
        <div class="grid grid-cols-2 gap-2 rounded-lg bg-[#f5f9f0] p-3">
          <span>{{ rule.capacity_per_fish }} điểm/con</span><span>{{ formatDuration(rule.grow_seconds) }}/lứa</span>
          <span>{{ rule.seed_cash.toLocaleString('vi-VN') }} xu/con giống</span><span>Tỷ lệ đặc biệt {{ +(rule.rare_chance * 100).toFixed(3) }}%</span>
        </div>
        <label class="block">Số lượng · Tối đa {{ maximum }} con theo chỗ trống và số xu
          <input v-model.number="quantity" type="number" min="1" :max="maximum" step="1" required :disabled="!farm.canMutate || !maximum" class="mt-1 w-full rounded-lg border border-[#cbd9c6] p-2" />
        </label>
        <fieldset class="space-y-2" :disabled="!farm.canMutate">
          <legend class="mb-2 font-semibold">Cách nuôi</legend>
          <label class="flex items-start gap-2 rounded-lg border border-[#cbd9c6] p-2">
            <input v-model="mode" type="radio" value="simple" name="care-mode" class="mt-0.5" />
            <span><b>Thong thả</b><span class="mt-1 block text-stone-500">Thả rồi chờ cá lớn, không cần cho ăn hay chăm sóc.</span></span>
          </label>
          <label class="flex items-start gap-2 rounded-lg border border-[#cbd9c6] p-2">
            <input v-model="mode" type="radio" value="advanced" name="care-mode" class="mt-0.5" />
            <span><b>Chăm chút</b><span class="mt-1 block text-stone-500">Chăm để tăng cân nặng và cơ hội đặc biệt, tối đa +{{ +(rule.advanced_rare_bonus * 100).toFixed(3) }} điểm %. Bỏ chăm vẫn lớn, không mất cá.</span></span>
          </label>
        </fieldset>
        <button type="submit" :disabled="!farm.canMutate || !maximum || !Number.isInteger(quantity) || quantity < 1 || quantity > maximum" class="w-full rounded-lg bg-emerald-700 p-2.5 font-semibold text-white disabled:opacity-50">
          Thả cá · {{ cost.toLocaleString('vi-VN') }} xu
        </button>
      </template>
    </form>
  </details>
</template>
