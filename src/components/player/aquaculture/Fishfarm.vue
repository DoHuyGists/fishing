<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAquacultureStore } from '../../../stores/aquaculture'
import { useCurrencyStore } from '../../../stores/currency'
import { useModalStore } from '../../../stores/modal'
import { batchProgress, type AquacultureBatch } from '../../../data/aquaculture'
import TwoOptionsModal from '../../shared/TwoOptionsModal.vue'
import Cash from '../currency/Cash.vue'
import AquacultureStockForm from './AquacultureStockForm.vue'
import FishPond from './FishPond.vue'
import { formatDuration } from './pondPresentation'

defineProps<{ paused?: boolean }>()
const farm = useAquacultureStore()
const currency = useCurrencyStore()
const modal = useModalStore()
const foodId = ref('')
const chosenFood = computed(() => farm.foodOptions.find(f => f.inventoryId === foodId.value && !!f.inventoryId))
const recordsDialog = ref<HTMLDialogElement | null>(null)
const confirmation = ref<{ kind: 'buy' | 'sell' | 'transfer' | 'release'; ids: string[]; message: string; detail: string; cash: number } | null>(null)
watch(() => farm.selectedBatchId, () => { foodId.value = '' })
watch(() => farm.ownerId, () => { confirmation.value = null; foodId.value = ''; recordsDialog.value?.close() })
function remaining(batch: AquacultureBatch) {
  return batch.status === 'ready' ? 'Có thể thu hoạch'
    : Date.parse(batch.ready_at) <= farm.now ? 'Đang cập nhật trưởng thành…' : 'Còn ' + formatDuration((Date.parse(batch.ready_at) - farm.now) / 1000)
}
function ask(kind: 'buy' | 'sell' | 'transfer' | 'release') {
  if (!farm.canMutate) return
  const ids = [...farm.selectedFishIds]
  const special = farm.selectedFish.filter(f => f.is_super_special).length
  confirmation.value = {
    kind, ids, cash: farm.selectionCash,
    message: kind === 'buy' ? 'Mua thêm một ao với 300 vỏ sò?'
      : kind === 'sell' ? 'Bán ' + ids.length + ' cá đã chọn, nhận'
      : kind === 'transfer' ? 'Chuyển ' + ids.length + ' cá đã chọn vào kho cá?'
      : 'Thả ' + ids.length + ' cá đã chọn để giải phóng chỗ?',
    detail: kind === 'buy' ? 'Ao mới có sức chứa 100. Mỗi người sở hữu tối đa 5 ao.'
      : (special ? 'Bạn đang chọn ' + special + ' cá siêu đặc biệt. ' : '')
        + (kind === 'release' ? 'Cá rời ao vĩnh viễn, không hoàn tiền giống.' : 'Cá sẽ rời ao sau khi xác nhận.'),
  }
}
async function confirm() {
  const action = confirmation.value
  confirmation.value = null
  if (!action) return
  if (action.kind === 'buy') await farm.buyPond()
  else await farm.actOnFish(action.kind, action.ids)
}
</script>

<template>
  <div class="fishfarm min-h-full border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]" :aria-busy="farm.busy || farm.loading">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[#cbd9c6] p-4">
      <div>
        <div class="m-0 mt-1 text-xs text-stone-600">Cá vẫn lớn khi bạn đi câu hoặc thoát game. Chăm sóc là phần thưởng thêm.</div>
      </div>
      <span class="text-xs font-semibold text-emerald-800">{{ farm.farm?.ponds.length ?? 0 }} / 5 ao · Kho cá còn {{ farm.storageAvailable }} chỗ</span>
      <button type="button" class="action-button" aria-haspopup="dialog" @click="recordsDialog?.showModal()">Thành quả nuôi cá</button>
    </header>

    <div v-if="farm.pending || farm.needsRefresh" class="mx-4 mt-4 flex flex-wrap items-center gap-3">
      <button v-if="farm.pending" type="button" class="action-button" :disabled="farm.busy || farm.loading" @click="farm.retryPending()">Thử lại thao tác</button>
      <button v-else type="button" class="action-button" :disabled="farm.busy || farm.loading" @click="farm.refresh(true)">Tải lại</button>
    </div>
    <div v-if="!farm.farm" class="p-8 text-center text-sm text-stone-500">{{ farm.loading ? 'Đang mở nông trại của bạn…' : 'Chưa tải được nông trại.' }}</div>

    <template v-else>
      <nav class="flex flex-wrap gap-2 p-4 pb-0" aria-label="Chọn ao cá">
        <button v-for="pond in farm.farm.ponds" :key="pond.id" type="button" class="pond-tab" :class="{ 'pond-tab-active': pond.id === farm.selectedPondId }" :aria-pressed="pond.id === farm.selectedPondId" :disabled="farm.busy" @click="farm.selectPond(pond.id)">
          <b>{{ pond.name }}</b><span class="mt-1 block text-[11px] opacity-75">{{ pond.fish.length }} cá · {{ pond.used_capacity }}/{{ pond.capacity }} sức chứa</span>
        </button>
        <button v-if="farm.farm.pond_slot < 5" type="button" class="pond-tab border-dashed" :disabled="!farm.canMutate || currency.shells < 300" @click="ask('buy')">
          <b>+ Mua ao</b><span class="mt-1 block text-[11px]">300 vỏ sò</span>
        </button>
      </nav>
      <div v-if="farm.farm.pond_slot < 5 && currency.shells < 300" class="mx-4 mb-0 mt-2 text-xs text-stone-500">Cần 300 vỏ sò để mở thêm ao.</div>

      <div v-if="farm.activePond" class="farm-workspace">
        <main class="min-w-0 space-y-4">
          <div class="pond-area rounded-2xl p-4 sm:p-6">
            <FishPond :pond="farm.activePond" :swimmers="farm.pondSwimmers" :paused="paused" />
          </div>

          <section class="rounded-xl border border-[#cbd9c6] bg-white p-4">
            <div class="mb-3 flex items-center justify-between gap-2"><div class="m-0 text-sm font-bold">Các lứa trong ao</div><span class="text-xs text-stone-500">Chọn một lứa để chăm hoặc thu cá</span></div>
            <div v-if="!farm.activePond.batches.length" class="m-0 text-xs text-stone-500">Ao trống. Chọn loài bạn đã câu được để bắt đầu.</div>
            <div class="grid gap-2 sm:grid-cols-2">
              <button v-for="(batch, index) in farm.activePond.batches" :key="batch.id" type="button" class="batch-card" :class="{ 'batch-card-active': batch.id === farm.selectedBatchId }" :aria-pressed="batch.id === farm.selectedBatchId" :disabled="farm.busy" @click="farm.selectBatch(batch.id)">
                <div class="flex justify-between gap-2"><b>{{ farm.speciesName(batch.species_id) }}</b><span class="shrink-0 text-[10px]">Lứa {{ index + 1 }}</span></div>
                <div class="mb-2 mt-1 text-[11px] text-stone-500">{{ batch.mode === 'simple' ? 'Thong thả' : 'Chăm chút' }} · {{ farm.activePond.fish.filter(f => f.batch_id === batch.id).length }} cá</div>
                <div class="h-1.5 overflow-hidden rounded-full bg-[#dfe8d8]"><div class="h-full bg-emerald-600" :style="{ width: batchProgress(batch, farm.now) + '%' }" /></div>
                <div class="mb-0 mt-2 text-[11px]" :class="batch.status === 'ready' ? 'font-semibold text-emerald-700' : 'text-stone-600'">{{ remaining(batch) }}</div>
              </button>
            </div>
          </section>
        </main>

        <aside class="min-w-0 space-y-4" aria-label="Quản lý ao cá">
          <AquacultureStockForm />
          <section v-if="farm.activePond.batches.some(b => b.mode === 'advanced' && b.status === 'growing')" class="panel space-y-3">
            <div class="m-0 text-sm font-bold">Chăm ao</div>
            <div class="m-0 text-xs text-stone-500">Tăng chất lượng cho các lứa chăm chút đang lớn. Hai việc dùng chung lượt chăm ao.</div>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="action-button" :disabled="!farm.canCare" @click="farm.care('water')">Thay nước · +10%<span class="block text-[10px] font-normal">Chờ 4 giờ</span></button>
              <button type="button" class="action-button" :disabled="!farm.canCare" @click="farm.care('oxygen')">Sục khí · +3%<span class="block text-[10px] font-normal">Chờ 1 giờ</span></button>
            </div>
            <div v-if="Date.parse(farm.activePond.care_available_at) > farm.now" class="m-0 text-xs text-amber-800">Lượt chăm tiếp theo sau {{ formatDuration((Date.parse(farm.activePond.care_available_at) - farm.now) / 1000) }}.</div>
          </section>

          <section v-if="farm.activeBatch" class="panel space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2"><div class="m-0 text-sm font-bold">{{ farm.speciesName(farm.activeBatch.species_id) }}</div><span class="text-xs text-emerald-700">{{ remaining(farm.activeBatch) }}</span></div>
            <div class="m-0 text-xs text-stone-500">{{ farm.batchFish.length }} / {{ farm.activeBatch.initial_fish_count }} cá còn trong lứa · {{ farm.activeBatch.mode === 'simple' ? 'Thong thả' : 'Chăm chút' }}</div>
            <div v-if="farm.activeBatch.mode === 'advanced'" class="space-y-2 rounded-lg bg-[#f5f9f0] p-3 text-xs">
              <div class="flex justify-between"><span>Chất lượng</span><b>{{ Math.round(farm.activeBatch.quality_score * 100) }}%</b></div>
              <div class="h-1.5 overflow-hidden rounded-full bg-[#dfe8d8]"><div class="h-full bg-emerald-600" :style="{ width: (farm.activeBatch.quality_score * 100) + '%' }" /></div>
              <template v-if="farm.activeBatch.status === 'growing'">
                <label class="block">Thức ăn cho lứa này
                  <select v-model="foodId" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white p-2" :disabled="!farm.canFeed">
                    <option value="">Chọn thức ăn trong túi</option>
                    <option v-for="food in farm.foodOptions" :key="food.itemId + ':' + food.inventoryId" :value="food.inventoryId" :disabled="!food.inventoryId || food.owned < food.needed">
                      {{ food.name }} · Cần {{ food.needed }} / Có {{ food.owned }} · +{{ Math.round(food.gain * 100) }}%
                    </option>
                  </select>
                </label>
                <button type="button" class="action-button w-full" :disabled="!farm.canFeed || !chosenFood || chosenFood.owned < chosenFood.needed" @click="farm.feed(foodId)">Cho ăn{{ chosenFood ? ' · Dùng ' + chosenFood.needed + ' phần' : '' }}</button>
                <div v-if="Date.parse(farm.activeBatch.feed_available_at) > farm.now" class="m-0 text-amber-800">Cho ăn tiếp sau {{ formatDuration((Date.parse(farm.activeBatch.feed_available_at) - farm.now) / 1000) }}.</div>
                <button type="button" class="text-emerald-700 underline" :disabled="farm.busy" @click="modal.open('shop')">Mua thức ăn tại cửa hàng</button>
              </template>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <b>Từng cá trong lứa</b><button type="button" class="text-emerald-700 underline disabled:opacity-50" :disabled="!farm.canMutate" @click="farm.selectOrdinaryReadyFish()">Chọn cá thường đã lớn</button>
            </div>
            <div class="space-y-1.5">
              <label v-for="fish in farm.pagedFish" :key="fish.id" class="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs" :class="fish.is_super_special ? 'border-amber-300 bg-amber-50' : 'border-[#cbd9c6]'">
                <input type="checkbox" :checked="farm.selectedFishIds.includes(fish.id)" :disabled="!farm.canMutate || (!farm.selectedFishIds.includes(fish.id) && farm.selectedFishIds.length >= 500)" @change="farm.toggleFish(fish.id)" />
                <span class="min-w-0 flex-1"><b>{{ fish.status === 'ready' ? fish.weight_kg + ' kg · ' + fish.star_rating + '★' : 'Cá đang lớn' }}</b><span v-if="fish.is_super_special" class="ml-1 text-amber-800">✦ Siêu đặc biệt</span><span class="mt-0.5 block text-[10px] text-stone-400">#{{ fish.id.slice(0, 8) }} · {{ fish.capacity }} sức chứa</span></span>
              </label>
            </div>
            <div v-if="farm.fishPages > 1" class="flex items-center justify-between text-xs">
              <button type="button" class="action-button" :disabled="farm.fishPage <= 1 || farm.busy" @click="farm.fishPage--">Trước</button><span>{{ farm.fishPage }} / {{ farm.fishPages }}</span><button type="button" class="action-button" :disabled="farm.fishPage >= farm.fishPages || farm.busy" @click="farm.fishPage++">Sau</button>
            </div>
            <div class="space-y-2 border-t border-[#cbd9c6] pt-3">
              <div class="m-0 text-xs">Đã chọn {{ farm.selectedFishIds.length }} cá <button v-if="farm.selectedFishIds.length" type="button" class="ml-2 text-stone-500 underline" :disabled="!farm.canMutate" @click="farm.selectedFishIds = []">Bỏ chọn</button></div>
              <button type="button" class="action-button primary w-full" :disabled="!farm.canMutate || !farm.selectionReady" @click="ask('sell')">Bán · <Cash :amount="farm.selectionCash" :size="18" :interactive="false" /></button>
              <button type="button" class="action-button w-full" :disabled="!farm.canMutate || !farm.selectionReady || farm.selectedFishIds.length > farm.storageAvailable" @click="ask('transfer')">Chuyển vào kho cá · Còn {{ farm.storageAvailable }} chỗ</button>
              <button type="button" class="w-full py-1 text-xs text-red-700 underline disabled:opacity-40" :disabled="!farm.canMutate || !farm.selectedFishIds.length" @click="ask('release')">Thả cá đã chọn · Không hoàn tiền</button>
            </div>
          </section>
        </aside>
      </div>
    </template>
    <div v-if="farm.busy" class="mx-4 pb-3 text-xs text-emerald-700" role="status">Đang xử lý thao tác…</div>
    <TwoOptionsModal v-if="confirmation" title="Xác nhận thao tác" :sub-text="confirmation.detail" second-text="Xác nhận" :first-disabled="farm.busy" :second-disabled="!farm.canMutate" :on-first="() => confirmation = null" :on-second="confirm" :on-dismiss="() => confirmation = null">
      <div class="flex flex-wrap items-center gap-1 text-sm text-[#24352a]">{{ confirmation.message }}<template v-if="confirmation.kind === 'sell'"><Cash :amount="confirmation.cash" :size="20" />?</template></div>
    </TwoOptionsModal>
    <Teleport to="body">
      <dialog ref="recordsDialog" aria-labelledby="aquaculture-records-title" class="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-0 text-[#24352a] shadow-xl backdrop:bg-black/40" @click.self="recordsDialog?.close()">
        <div class="p-4" @click.stop>
          <header class="mb-4 flex items-center justify-between gap-3">
            <div id="aquaculture-records-title" class="m-0 text-base font-bold">Thành quả nuôi cá</div>
            <button type="button" autofocus aria-label="Đóng thành quả nuôi cá" class="size-8 rounded-full text-2xl hover:bg-[#cbd9c6]/50" @click="recordsDialog?.close()">&times;</button>
          </header>
          <div v-if="farm.records.length" class="m-0 list-none space-y-2 p-0">
            <div v-for="record in farm.records" :key="record.species_id" class="rounded-lg border border-[#cbd9c6] bg-white p-3 text-xs">
              <b>{{ farm.speciesName(record.species_id) }}</b>
              <div class="mb-0 mt-1 text-stone-600">{{ record.matured_fish }} cá trưởng thành · Kỷ lục {{ record.best_weight_kg }} kg · {{ record.super_special_fish }} cá đặc biệt</div>
            </div>
          </div>
          <div v-else class="m-0 text-sm text-stone-600">Chưa có thành quả nuôi cá. Hãy nuôi lứa cá đầu tiên nhé!</div>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.farm-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 370px; align-items: start; gap: 20px; padding: 20px; }
.pond-area { display: grid; min-height: clamp(400px, 50vh, 540px); background: #dce8cd; }
.panel { padding: 16px; border: 1px solid #cbd9c6; border-radius: 12px; background: white; }
.pond-tab { min-width: 100px; border: 1px solid #cbd9c6; border-radius: 12px; padding: 10px 12px; background: white; text-align: left; font-size: 12px; }
.pond-tab-active { border-color: #347552; background: #dcebd6; box-shadow: inset 0 0 0 1px #347552; }
.batch-card { border: 1px solid #cbd9c6; border-radius: 10px; padding: 12px; text-align: left; font-size: 12px; }
.batch-card-active { border-color: #347552; background: #f5f9f0; box-shadow: inset 0 0 0 1px #347552; }
.action-button { border: 1px solid #cbd9c6; border-radius: 8px; padding: 8px 10px; background: #f5f9f0; font-size: 12px; font-weight: 600; }
.action-button:hover { background: #e8f0e0; }
.action-button.primary { border-color: #047857; background: #047857; color: white; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, summary:focus-visible { outline: 2px solid #347552; outline-offset: 3px; }
@media (max-width: 1023px) { .farm-workspace { grid-template-columns: 1fr; padding: 16px; } }
</style>
