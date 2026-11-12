<script setup lang="ts">
import type { AquacultureBatch } from "../../../types/model/aquaculture";
import { t as tr } from "../../../i18n";

import { computed, ref, watch } from 'vue'
import { useAquacultureStore } from '../../../stores/aquaculture'
import { useCurrencyStore } from '../../../stores/currency'
import { useModalStore } from '../../../stores/modal'
import { batchProgress } from '../../../data/aquaculture';
import TwoOptionsModal from '../../shared/TwoOptionsModal.vue'
import PaymentConfirmation from '../../shared/PaymentConfirmation.vue'
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
  return batch.status === 'ready' ? tr('Fishfarm.co_the_thu_hoach')
    : Date.parse(batch.ready_at) <= farm.now ? tr('Fishfarm.dang_cap_nhat_truong_thanh') : tr('Fishfarm.readyIn', { value0: formatDuration((Date.parse(batch.ready_at) - farm.now) / 1000) })
}
function ask(kind: 'buy' | 'sell' | 'transfer' | 'release') {
  if (!farm.canMutate) return
  const ids = [...farm.selectedFishIds]
  const special = farm.selectedFish.filter(f => f.is_super_special).length
  confirmation.value = {
    kind, ids, cash: farm.selectionCash,
    get message() {
      return kind === 'buy' ? tr('Fishfarm.mua_them_mot_ao_voi_300_vo_so')
        : tr(kind === 'sell' ? 'Fishfarm.confirmSell' : kind === 'transfer' ? 'Fishfarm.confirmTransfer' : 'Fishfarm.confirmRelease', { value0: ids.length })
    },
    get detail() {
      return kind === 'buy' ? tr('Fishfarm.ao_moi_co_suc_chua_100_moi_nguoi_so_huu_toi_da_5_ao')
        : (special ? tr('Fishfarm.specialSelection', { value0: special }) + ' ' : '')
          + (kind === 'release' ? tr('Fishfarm.ca_roi_ao_vinh_vien_khong_hoan_tien_giong') : tr('Fishfarm.ca_se_roi_ao_sau_khi_xac_nhan'))
    },
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
        <div class="m-0 mt-1 text-xs text-stone-600">{{ tr('Fishfarm.ca_van_lon_khi_ban_di_cau_hoac_thoat_game_cham_soc_la_phan_thuon') }}</div>
      </div>
      <span class="text-xs font-semibold text-emerald-800">{{ farm.farm?.ponds.length ?? 0 }} {{ tr('Fishfarm.5_ao_kho_ca_con') }} {{ farm.storageAvailable }} {{ tr('Fishfarm.cho') }}</span>
      <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" aria-haspopup="dialog" @click="recordsDialog?.showModal()">{{ tr('Fishfarm.thanh_qua_nuoi_ca') }}</button>
    </header>

    <div v-if="farm.pending || farm.needsRefresh" class="mx-4 mt-4 flex flex-wrap items-center gap-3">
      <button v-if="farm.pending" type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" :disabled="farm.busy || farm.loading" @click="farm.retryPending()">{{ tr('Fishfarm.thu_lai_thao_tac') }}</button>
      <button v-else type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" :disabled="farm.busy || farm.loading" @click="farm.refresh(true)">{{ tr('Fishfarm.tai_lai') }}</button>
    </div>
    <div v-if="!farm.farm" class="p-8 text-center text-sm text-stone-500">{{ farm.loading ? tr('Fishfarm.dang_mo_nong_trai_cua_ban') : tr('Fishfarm.chua_tai_duoc_nong_trai') }}</div>

    <template v-else>
      <nav class="flex flex-wrap gap-2 p-4 pb-0" :aria-label="tr('Fishfarm.chon_ao_ca')">
        <button v-for="pond in farm.farm.ponds" :key="pond.id" type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] pond-tab min-w-[100px] border border-[#cbd9c6] rounded-xl px-3 py-2.5 bg-white text-left text-xs" :class="{ 'pond-tab-active [&.pond-tab-active]:border-[#347552] [&.pond-tab-active]:bg-[#dcebd6] [&.pond-tab-active]:shadow-[inset_0_0_0_1px_#347552]': pond.id === farm.selectedPondId }" :aria-pressed="pond.id === farm.selectedPondId" :disabled="farm.busy" @click="farm.selectPond(pond.id)">
          <b>{{ pond.name }}</b><span class="mt-1 block text-[11px] opacity-75">{{ pond.fish.length }} {{ tr('Fishfarm.ca') }} {{ pond.used_capacity }}/{{ pond.capacity }} {{ tr('Fishfarm.suc_chua') }}</span>
        </button>
        <button v-if="farm.farm.pond_slot < 5" type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] pond-tab min-w-[100px] border border-[#cbd9c6] rounded-xl px-3 py-2.5 bg-white text-left text-xs border-dashed" :disabled="!farm.canMutate || currency.shells < 300" @click="ask('buy')">
          <b>{{ tr('Fishfarm.mua_ao') }}</b><span class="mt-1 block text-[11px]">{{ tr('Fishfarm.300_vo_so') }}</span>
        </button>
      </nav>
      <div v-if="farm.farm.pond_slot < 5 && currency.shells < 300" class="mx-4 mb-0 mt-2 text-xs text-stone-500">{{ tr('Fishfarm.can_300_vo_so_de_mo_them_ao') }}</div>

      <div v-if="farm.activePond" class="farm-workspace grid grid-cols-[minmax(0,1fr)_370px] items-start gap-5 p-5 [@media(max-width:1023px)]:grid-cols-1 [@media(max-width:1023px)]:p-4">
        <main class="min-w-0 space-y-4">
          <div class="pond-area grid min-h-[clamp(400px,50vh,540px)] bg-[#dce8cd] rounded-2xl p-4 sm:p-6">
            <FishPond :pond="farm.activePond" :swimmers="farm.pondSwimmers" :paused="paused" />
          </div>

          <section class="slide-fade-in from-bottom player-content-in rounded-xl border border-[#cbd9c6] bg-white p-4">
            <div class="mb-3 flex items-center justify-between gap-2"><div class="m-0 text-sm font-bold">{{ tr('Fishfarm.cac_lua_trong_ao') }}</div><span class="text-xs text-stone-500">{{ tr('Fishfarm.chon_mot_lua_de_cham_hoac_thu_ca') }}</span></div>
            <div v-if="!farm.activePond.batches.length" class="m-0 text-xs text-stone-500">{{ tr('Fishfarm.ao_trong_chon_loai_ban_da_cau_duoc_de_bat_dau') }}</div>
            <div class="grid gap-2 sm:grid-cols-2">
              <button v-for="(batch, index) in farm.activePond.batches" :key="batch.id" type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] batch-card border border-[#cbd9c6] rounded-[10px] p-3 text-left text-xs" :class="{ 'batch-card-active [&.batch-card-active]:border-[#347552] [&.batch-card-active]:bg-[#f5f9f0] [&.batch-card-active]:shadow-[inset_0_0_0_1px_#347552]': batch.id === farm.selectedBatchId }" :aria-pressed="batch.id === farm.selectedBatchId" :disabled="farm.busy" @click="farm.selectBatch(batch.id)">
                <div class="flex justify-between gap-2"><b>{{ farm.speciesName(batch.species_id) }}</b><span class="shrink-0 text-[10px]">{{ tr('Fishfarm.lua') }} {{ index + 1 }}</span></div>
                <div class="mb-2 mt-1 text-[11px] text-stone-500">{{ batch.mode === 'simple' ? tr('AquacultureStockForm.thong_tha') : tr('AquacultureStockForm.cham_chut') }} · {{ farm.activePond.fish.filter(f => f.batch_id === batch.id).length }} {{ tr('Fishfarm.ca_2') }}</div>
                <div class="h-1.5 overflow-hidden rounded-full bg-[#dfe8d8]"><div class="h-full bg-emerald-600" :style="{ width: batchProgress(batch, farm.now) + '%' }" /></div>
                <div class="mb-0 mt-2 text-[11px]" :class="batch.status === 'ready' ? 'font-semibold text-emerald-700' : 'text-stone-600'">{{ remaining(batch) }}</div>
              </button>
            </div>
          </section>
        </main>

        <aside class="min-w-0 space-y-4" :aria-label="tr('Fishfarm.quan_ly_ao_ca')">
          <AquacultureStockForm />
          <section v-if="farm.activePond.batches.some(b => b.mode === 'advanced' && b.status === 'growing')" class="slide-fade-in from-right player-content-in panel p-4 border border-[#cbd9c6] rounded-xl bg-white space-y-3">
            <div class="m-0 text-sm font-bold">{{ tr('Fishfarm.cham_ao') }}</div>
            <div class="m-0 text-xs text-stone-500">{{ tr('Fishfarm.tang_chat_luong_cho_cac_lua_cham_chut_dang_lon_hai_viec_dung_chu') }}</div>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" :disabled="!farm.canCare" @click="farm.care('water')">{{ tr('Fishfarm.thay_nuoc_10') }}<span class="block text-[10px] font-normal">{{ tr('Fishfarm.cho_4_gio') }}</span></button>
              <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" :disabled="!farm.canCare" @click="farm.care('oxygen')">{{ tr('Fishfarm.suc_khi_3') }}<span class="block text-[10px] font-normal">{{ tr('Fishfarm.cho_1_gio') }}</span></button>
            </div>
            <div v-if="Date.parse(farm.activePond.care_available_at) > farm.now" class="m-0 text-xs text-amber-800">{{ tr('Fishfarm.luot_cham_tiep_theo_sau') }} {{ formatDuration((Date.parse(farm.activePond.care_available_at) - farm.now) / 1000) }}.</div>
          </section>

          <section v-if="farm.activeBatch" class="slide-fade-in from-right player-content-in panel p-4 border border-[#cbd9c6] rounded-xl bg-white space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2"><div class="m-0 text-sm font-bold">{{ farm.speciesName(farm.activeBatch.species_id) }}</div><span class="text-xs text-emerald-700">{{ remaining(farm.activeBatch) }}</span></div>
            <div class="m-0 text-xs text-stone-500">{{ farm.batchFish.length }} / {{ farm.activeBatch.initial_fish_count }} {{ tr('Fishfarm.ca_con_trong_lua') }} {{ farm.activeBatch.mode === 'simple' ? tr('AquacultureStockForm.thong_tha') : tr('AquacultureStockForm.cham_chut') }}</div>
            <div v-if="farm.activeBatch.mode === 'advanced'" class="space-y-2 rounded-lg bg-[#f5f9f0] p-3 text-xs">
              <div class="flex justify-between"><span>{{ tr('Fishfarm.chat_luong') }}</span><b>{{ Math.round(farm.activeBatch.quality_score * 100) }}%</b></div>
              <div class="h-1.5 overflow-hidden rounded-full bg-[#dfe8d8]"><div class="h-full bg-emerald-600" :style="{ width: (farm.activeBatch.quality_score * 100) + '%' }" /></div>
              <template v-if="farm.activeBatch.status === 'growing'">
                <label class="block">{{ tr('Fishfarm.thuc_an_cho_lua_nay') }}
                  <select v-model="foodId" class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white p-2" :disabled="!farm.canFeed">
                    <option value="">{{ tr('Fishfarm.chon_thuc_an_trong_tui') }}</option>
                    <option v-for="food in farm.foodOptions" :key="food.itemId + ':' + food.inventoryId" :value="food.inventoryId" :disabled="!food.inventoryId || food.owned < food.needed">
                      {{ food.name }} {{ tr('Fishfarm.can') }} {{ food.needed }} {{ tr('Fishfarm.co') }} {{ food.owned }} · +{{ Math.round(food.gain * 100) }}%
                    </option>
                  </select>
                </label>
                <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white w-full" :disabled="!farm.canFeed || !chosenFood || chosenFood.owned < chosenFood.needed" @click="farm.feed(foodId)">{{ tr('Fishfarm.cho_an') }}{{ chosenFood ? tr('Fishfarm.dung') + chosenFood.needed + tr('Fishfarm.phan') : '' }}</button>
                <div v-if="Date.parse(farm.activeBatch.feed_available_at) > farm.now" class="m-0 text-amber-800">{{ tr('Fishfarm.cho_an_tiep_sau') }} {{ formatDuration((Date.parse(farm.activeBatch.feed_available_at) - farm.now) / 1000) }}.</div>
                <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] text-emerald-700 underline" :disabled="farm.busy" @click="modal.open('shop')">{{ tr('Fishfarm.mua_thuc_an_tai_cua_hang') }}</button>
              </template>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <b>{{ tr('Fishfarm.tung_ca_trong_lua') }}</b><button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] text-emerald-700 underline disabled:opacity-50" :disabled="!farm.canMutate" @click="farm.selectOrdinaryReadyFish()">{{ tr('Fishfarm.chon_ca_thuong_da_lon') }}</button>
            </div>
            <div class="space-y-1.5">
              <label v-for="fish in farm.pagedFish" :key="fish.id" class="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs" :class="fish.is_super_special ? 'border-amber-300 bg-amber-50' : 'border-[#cbd9c6]'">
                <input type="checkbox" :checked="farm.selectedFishIds.includes(fish.id)" :disabled="!farm.canMutate || (!farm.selectedFishIds.includes(fish.id) && farm.selectedFishIds.length >= 500)" @change="farm.toggleFish(fish.id)" />
                <span class="min-w-0 flex-1"><b>{{ fish.status === 'ready' ? fish.weight_kg + ' kg · ' + fish.star_rating + '★' : tr('Fishfarm.ca_dang_lon') }}</b><span v-if="fish.is_super_special" class="ml-1 text-amber-800">{{ tr('Fishfarm.sieu_dac_biet') }}</span><span class="mt-0.5 block text-[10px] text-stone-400">#{{ fish.id.slice(0, 8) }} · {{ fish.capacity }} {{ tr('Fishfarm.suc_chua') }}</span></span>
              </label>
            </div>
            <div v-if="farm.fishPages > 1" class="flex items-center justify-between text-xs">
              <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" :disabled="farm.fishPage <= 1 || farm.busy" @click="farm.fishPage--">{{ tr('Fishfarm.truoc') }}</button><span>{{ farm.fishPage }} / {{ farm.fishPages }}</span><button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white" :disabled="farm.fishPage >= farm.fishPages || farm.busy" @click="farm.fishPage++">{{ tr('Fishfarm.sau') }}</button>
            </div>
            <div class="space-y-2 border-t border-[#cbd9c6] pt-3">
              <div class="m-0 text-xs">{{ tr('Fishfarm.da_chon') }} {{ farm.selectedFishIds.length }} {{ tr('Fishfarm.ca_2') }} <button v-if="farm.selectedFishIds.length" type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] ml-2 text-stone-500 underline" :disabled="!farm.canMutate" @click="farm.selectedFishIds = []">{{ tr('Fishfarm.bo_chon') }}</button></div>
              <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white primary w-full" :disabled="!farm.canMutate || !farm.selectionReady" @click="ask('sell')">{{ tr('Fishfarm.ban_2') }} <Cash :amount="farm.selectionCash" :size="18" :interactive="false" /></button>
              <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] action-button border border-[#cbd9c6] rounded-lg px-2.5 py-2 bg-[#f5f9f0] text-xs font-semibold! hover:bg-[#e8f0e0] [&.primary]:border-[#047857] [&.primary]:bg-[#047857] [&.primary]:text-white w-full" :disabled="!farm.canMutate || !farm.selectionReady || farm.selectedFishIds.length > farm.storageAvailable" @click="ask('transfer')">{{ tr('Fishfarm.chuyen_vao_kho_ca_con') }} {{ farm.storageAvailable }} {{ tr('Fishfarm.cho') }}</button>
              <button type="button" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] w-full py-1 text-xs text-red-700 underline disabled:opacity-40" :disabled="!farm.canMutate || !farm.selectedFishIds.length" @click="ask('release')">{{ tr('Fishfarm.tha_ca_da_chon_khong_hoan_tien') }}</button>
            </div>
          </section>
        </aside>
      </div>
    </template>
    <div v-if="farm.busy" class="mx-4 pb-3 text-xs text-emerald-700" role="status">{{ tr('Fishfarm.dang_xu_ly_thao_tac') }}</div>
    <PaymentConfirmation
      v-if="confirmation?.kind === 'buy'"
      :title="tr('Fishfarm.xac_nhan_thao_tac')"
      currency="shells"
      :balance="currency.shells"
      :total="300"
      :busy="farm.busy"
      :disabled="!farm.canMutate"
      @cancel="confirmation = null"
      @confirm="confirm"
    >
      <div class="text-sm">{{ confirmation.message }}</div>
      <div class="text-xs text-emerald-900/70">{{ confirmation.detail }}</div>
    </PaymentConfirmation>
    <TwoOptionsModal v-else-if="confirmation" :title="tr('Fishfarm.xac_nhan_thao_tac')" :sub-text="confirmation.detail" :second-text="tr('Fishfarm.xac_nhan')" :first-disabled="farm.busy" :second-disabled="!farm.canMutate" :on-first="() => confirmation = null" :on-second="confirm" :on-dismiss="() => confirmation = null">
      <div class="flex flex-wrap items-center gap-1 text-sm text-[#24352a]">{{ confirmation.message }}<template v-if="confirmation.kind === 'sell'"><Cash :amount="confirmation.cash" :size="20" />?</template></div>
    </TwoOptionsModal>
    <Teleport to="body">
      <dialog ref="recordsDialog" aria-labelledby="aquaculture-records-title" class="player-popup-in fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-0 text-[#24352a] shadow-xl backdrop:bg-black/40" @click.self="recordsDialog?.close()">
        <div class="p-4" @click.stop>
          <header class="mb-4 flex items-center justify-between gap-3">
            <div id="aquaculture-records-title" class="m-0 text-base font-bold">{{ tr('Fishfarm.thanh_qua_nuoi_ca') }}</div>
            <button type="button" autofocus :aria-label="tr('Fishfarm.dong_thanh_qua_nuoi_ca')" class="cursor-pointer disabled:cursor-not-allowed! disabled:opacity-45! focus-visible:outline-2 focus-visible:outline-[#347552] focus-visible:outline-offset-[3px] size-8 rounded-full text-2xl hover:bg-[#cbd9c6]/50" @click="recordsDialog?.close()">×</button>
          </header>
          <div v-if="farm.records.length" class="m-0 list-none space-y-2 p-0">
            <div v-for="record in farm.records" :key="record.species_id" class="rounded-lg border border-[#cbd9c6] bg-white p-3 text-xs">
              <b>{{ farm.speciesName(record.species_id) }}</b>
              <div class="mb-0 mt-1 text-stone-600">{{ record.matured_fish }} {{ tr('Fishfarm.ca_truong_thanh_ky_luc') }} {{ record.best_weight_kg }} kg · {{ record.super_special_fish }} {{ tr('Fishfarm.ca_dac_biet') }}</div>
            </div>
          </div>
          <div v-else class="m-0 text-sm text-stone-600">{{ tr('Fishfarm.chua_co_thanh_qua_nuoi_ca_hay_nuoi_lua_ca_dau_tien_nhe') }}</div>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>
