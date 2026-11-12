import type { UserInventory } from "../types/model/userInventory";
import type { AquacultureCatalog, AquacultureFarm, CareMode, FarmAction, AquaculturePond, AquacultureBatch, AquacultureFish, PondSwimmer, FarmFoodOption } from "../types/model/aquaculture";
import type { AquacultureRecord } from "../types/table/aquaculture";
import { getFormattingLocale } from '../i18n';
import { t as tr } from "../i18n";
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useCurrencyStore } from './currency'
import { useInventoryStore } from './inventory'
import { useUserProfileStore } from './userProfile'
import { supabaseCurrencyRepository } from '../data/supabaseCurrencyRepository'
import { supabaseUserInventoryRepository } from '../data/supabaseUserInventoryRepository';
import { supabaseUserProfileRepository } from '../data/supabaseUserProfileRepository'
import { AquacultureRpcError, supabaseAquacultureRepository as repository } from '../data/supabaseAquacultureRepository'
import { batchProgress, fishSaleCash, maxStockQuantity } from '../data/aquaculture';
import { createUuid } from '../utils/uuid'
import { useToast } from '../composables/useToast'

interface PendingAction { action: FarmAction; params: Record<string, unknown>; requestId: string }
const actions: FarmAction[] = ['purchase_pond_slot', 'stock_aquaculture_batch', 'feed_aquaculture_batch',
  'care_aquaculture_pond', 'sell_aquaculture_fish', 'transfer_aquaculture_fish', 'release_aquaculture_fish']
function rememberRequest(owner: string, request: PendingAction | null) {
  try {
    const key = 'aquaculture-pending:' + owner
    if (request) sessionStorage.setItem(key, JSON.stringify(request))
    else sessionStorage.removeItem(key)
  } catch { /* The in-memory receipt still supports retries when storage is unavailable. */ }
}
function restoreRequest(owner: string): PendingAction | null {
  try {
    const request = JSON.parse(sessionStorage.getItem('aquaculture-pending:' + owner) ?? 'null')
    return request && actions.includes(request.action) && typeof request.requestId === 'string'
      && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(request.requestId)
      && request.params && typeof request.params === 'object' && !Array.isArray(request.params) ? request : null
  } catch { return null }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : tr('aquaculture.khong_the_thuc_hien_thao_tac_vui_long_thu_lai')
  const translations: Record<string, string> = {
    get 'Not enough room in fish storage'() { return tr('aquaculture.kho_ca_khong_du_cho_hay_don_kho_hoac_chon_it_ca_hon'); },
    get 'Maximum of 5 ponds reached'() { return tr('aquaculture.ban_da_so_huu_toi_da_5_ao'); },
    get 'Insufficient or invalid wallet balance'() { return tr('aquaculture.so_du_khong_du_hoac_chua_hop_le_hay_kiem_tra_lai_tien_va_vo_so'); },
    get 'Catch this species at least once before farming it'() { return tr('aquaculture.hay_cau_duoc_loai_nay_it_nhat_mot_lan_truoc_khi_nuoi'); },
    get 'Total fish capacity must be strictly less than pond capacity'() { return tr('aquaculture.ao_khong_du_cho_tong_suc_chua_ca_phai_nho_hon_suc_chua_ao'); },
    get 'Every selected fish must belong to you and be ready'() { return tr('aquaculture.mot_so_ca_chua_truong_thanh_hoac_da_roi_ao_hay_tai_lai_nong_trai'); },
    get 'Not enough food for the batch'() { return tr('aquaculture.khong_du_thuc_an_trong_chong_vat_pham_da_chon'); },
    get 'Pond care is on cooldown'() { return tr('aquaculture.ao_van_dang_trong_thoi_gian_cho_cham_soc'); },
    get 'Feeding is on cooldown or quality is already full'() { return tr('aquaculture.lua_ca_dang_cho_luot_cho_an_hoac_chat_luong_da_day'); },
  }
  return translations[message] ?? message
}

export const useAquacultureStore = defineStore('AquaculturePlayer', {
  state: () => ({
    ownerId: '', epoch: 0,
    farm: null as AquacultureFarm | null,
    catalog: { species: [], foods: [] } as AquacultureCatalog,
    records: [] as AquacultureRecord[], foodInventory: [] as UserInventory[],
    storedFishCount: 0, storageCapacity: 0,
    selectedPondId: '', selectedBatchId: '', selectedFishIds: [] as string[], fishPage: 1,
    loading: false, busy: false, needsRefresh: false,
    error: '', pending: null as PendingAction | null,
    now: Date.now(), serverOffset: 0, lastRefreshAt: 0,
  }),
  getters: {
    activePond: (s): AquaculturePond | null => s.farm?.ponds.find(p => p.id === s.selectedPondId) ?? null,
    activeBatch(): AquacultureBatch | null { return this.activePond?.batches.find(b => b.id === this.selectedBatchId) ?? null },
    batchFish(): AquacultureFish[] { return this.activePond?.fish.filter(f => f.batch_id === this.selectedBatchId) ?? [] },
    pagedFish(): AquacultureFish[] { return this.batchFish.slice((this.fishPage - 1) * 12, this.fishPage * 12) },
    fishPages(): number { return Math.max(1, Math.ceil(this.batchFish.length / 12)) },
    selectedFish(): AquacultureFish[] { const ids = new Set(this.selectedFishIds); return this.batchFish.filter(f => ids.has(f.id)) },
    selectionReady(): boolean { return this.selectedFish.length > 0 && this.selectedFish.every(f => f.status === 'ready') },
    selectionCash(): number { return this.activeBatch ? this.selectedFish.reduce((n, f) => n + fishSaleCash(f, this.activeBatch!), 0) : 0 },
    storageAvailable: (s) => Math.max(0, s.storageCapacity - s.storedFishCount),
    canMutate: (s) => !!s.farm && !s.loading && !s.busy && !s.needsRefresh && !s.pending,
    pondSwimmers(): PondSwimmer[] {
      if (!this.activePond) return []
      const pond = this.activePond
      const ordered = [...pond.fish].sort((a, b) => Number(b.is_super_special) - Number(a.is_super_special))
      const representatives = new Map<string, typeof ordered[number]>()
      for (const fish of ordered) if (!representatives.has(fish.species_id)) representatives.set(fish.species_id, fish)
      const unique = new Map([...representatives.values(), ...ordered].map(fish => [fish.id, fish]))
      return [...unique.values()].slice(0, 4).map(fish => ({
        id: fish.id, image: this.catalog.species.find(s => s.id === fish.species_id)?.image ?? null, special: fish.is_super_special,
        progress: batchProgress(pond.batches.find(b => b.id === fish.batch_id)!, this.now),
      }))
    },
    canCare(): boolean {
      return this.canMutate && !!this.activePond && Date.parse(this.activePond.care_available_at) <= this.now
        && this.activePond.batches.some(b => b.mode === 'advanced' && b.status === 'growing'
          && Date.parse(b.ready_at) > this.now && b.quality_score < 1)
    },
    canFeed(): boolean {
      const batch = this.activeBatch
      return this.canMutate && !!batch && batch.mode === 'advanced' && batch.status === 'growing'
        && Date.parse(batch.ready_at) > this.now && Date.parse(batch.feed_available_at) <= this.now && batch.quality_score < 1
    },
    foodOptions(): FarmFoodOption[] {
      const batch = this.activeBatch
      if (!batch) return []
      const used = this.batchFish.reduce((n, f) => n + f.capacity, 0)
      return this.catalog.foods.filter(f => f.species_id === batch.species_id && f.enabled && f.item && !f.item.isDisabled)
        .flatMap(food => {
          const needed = Math.ceil(used / food.capacity_units_per_item)
          const inventory = this.foodInventory.filter(i => i.data?.id === food.item_id && Number.isInteger(i.data?.quantity) && i.data.quantity > 0)
          return (inventory.length ? inventory : [null]).map(item => ({
            inventoryId: item?.id ?? '', itemId: food.item_id, name: food.item!.name,
            needed, owned: Number(item?.data?.quantity ?? 0), gain: food.quality_gain,
          }))
        })
    },
  },
  actions: {
    notifyError(message: string) {
      if (this.error === message) return
      this.error = message
      useToast().error(message, { get title() { return tr('AquacultureModal.nong_trai_ca'); }, position: 'bottom', duration: 8000 })
    },
    resetSession(userId = '') {
      const epoch = this.epoch + 1
      this.$reset(); this.epoch = epoch; this.ownerId = userId
      this.pending = userId ? restoreRequest(userId) : null
    },
    async initialize(userId: string) {
      if (this.ownerId !== userId) this.resetSession(userId)
      if (userId) await this.refresh(true)
    },
    speciesName(id: string) { return this.catalog.species.find(s => s.id === id)?.name ?? tr('AquacultureStockForm.loai_ca') },
    speciesImage(id: string) { return this.catalog.species.find(s => s.id === id)?.image ?? null },
    maxStock(speciesId: string): number {
      const rule = this.farm?.species.find(s => s.species_id === speciesId && s.can_stock)
      return this.activePond && rule ? maxStockQuantity(this.activePond, rule, useCurrencyStore().cash) : 0
    },
    selectPond(id: string) {
      if (this.busy) return
      this.selectedPondId = id; this.selectedBatchId = this.activePond?.batches[0]?.id ?? ''
      this.selectedFishIds = []; this.fishPage = 1
    },
    selectBatch(id: string) {
      if (this.busy) return
      this.selectedBatchId = id; this.selectedFishIds = []; this.fishPage = 1
    },
    toggleFish(id: string) {
      if (!this.canMutate || !this.batchFish.some(f => f.id === id)) return
      this.selectedFishIds = this.selectedFishIds.includes(id)
        ? this.selectedFishIds.filter(f => f !== id) : [...this.selectedFishIds, id]
    },
    selectOrdinaryReadyFish() {
      if (!this.canMutate) return
      this.selectedFishIds = this.batchFish.filter(f => f.status === 'ready' && !f.is_super_special).slice(0, 500).map(f => f.id)
    },
    updateClock() { this.now = Date.now() + this.serverOffset },
    async refresh(full = false, duringAction = false): Promise<boolean> {
      if (!this.ownerId || this.loading || (this.busy && !duringAction)) return false
      const owner = this.ownerId, epoch = this.epoch
      this.loading = true
      try {
        const farm = await repository.fetchFarm()
        const context = full ? await Promise.all([
            repository.fetchCatalog(), repository.fetchRecords(owner),
            supabaseUserInventoryRepository.fetchUserInventory(owner),
            supabaseCurrencyRepository.fetchMyCurrency(), supabaseUserProfileRepository.fetchUserProfile(owner),
            repository.fetchStoredFishCount(owner),
          ]) : null
        if (this.epoch !== epoch || useAuthStore().user?.id !== owner) return false
        this.farm = farm; this.serverOffset = Date.parse(farm.server_time) - Date.now(); this.updateClock()
        if (context) {
          const [catalog, records, inventory, wallet, profile, storedCount] = context
          this.catalog = catalog; this.records = records; this.foodInventory = inventory
          this.storedFishCount = storedCount; this.storageCapacity = profile?.species_storage_capacity ?? 0
          useCurrencyStore().cash = Number(wallet.cash); useCurrencyStore().shells = Number(wallet.shells ?? 0)
          useInventoryStore().items = inventory; useUserProfileStore().profile = profile
        }
        if (!farm.ponds.some(p => p.id === this.selectedPondId)) this.selectedPondId = farm.ponds[0]?.id ?? ''
        if (!this.activePond?.batches.some(b => b.id === this.selectedBatchId)) this.selectedBatchId = this.activePond?.batches[0]?.id ?? ''
        const current = new Set(this.batchFish.map(f => f.id))
        this.selectedFishIds = this.selectedFishIds.filter(id => current.has(id))
        this.fishPage = Math.min(this.fishPage, this.fishPages); this.needsRefresh = false
        if (!this.pending) this.error = ''
        return true
      } catch (error) {
        if (this.epoch === epoch) {
          this.needsRefresh = true
          if (!duringAction) this.notifyError(errorMessage(error))
        }
        return false
      } finally {
        if (this.epoch === epoch) { this.loading = false; this.lastRefreshAt = Date.now() }
      }
    },
    async poll() {
      this.updateClock()
      const due = this.farm?.ponds.some(p => p.batches.some(b => b.status === 'growing' && Date.parse(b.ready_at) <= this.now))
      if (Date.now() - this.lastRefreshAt >= (due ? 15000 : 60000)) await this.refresh(!this.farm || this.needsRefresh || due)
    },
    async perform(action: FarmAction, params: Record<string, unknown>, retry = false): Promise<boolean> {
      if (this.busy || this.loading || useAuthStore().user?.id !== this.ownerId || (!retry && !this.canMutate)) return false
      const request = retry ? this.pending : { action, params, requestId: createUuid() }
      if (!request) return false
      const owner = this.ownerId, epoch = this.epoch
      this.pending = request; this.busy = true; this.error = ''
      rememberRequest(owner, request)
      try {
        const result = await repository.execute(request.action, request.params, request.requestId)
        if (this.epoch !== epoch || useAuthStore().user?.id !== owner) return false
        this.pending = null
        rememberRequest(owner, null)
        if (result.pond_id && request.action === 'purchase_pond_slot') this.selectedPondId = result.pond_id
        if (result.batch_id && request.action === 'stock_aquaculture_batch') this.selectedBatchId = result.batch_id
        this.selectedFishIds = []
        const notice = request.action === 'sell_aquaculture_fish'
          ? tr('aquaculture.da_ban_ca_nhan_value0_tien', { value0: Number(result.cash_earned ?? 0).toLocaleString(getFormattingLocale()) })
          : request.action === 'transfer_aquaculture_fish' ? tr('aquaculture.da_chuyen_ca_vao_kho_ca_cua_ban')
          : request.action === 'release_aquaculture_fish' ? tr('aquaculture.da_tha_ca_va_giai_phong_suc_chua_ao')
          : request.action === 'purchase_pond_slot' ? tr('aquaculture.da_mua_ao_moi_voi_300_vo_so')
          : request.action === 'stock_aquaculture_batch' ? tr('aquaculture.da_tha_lua_ca_moi_ca_van_lon_khi_ban_roi_nong_trai')
          : tr('aquaculture.da_cham_soc_chat_luong_lua_ca_duoc_tang_them')
        useToast().success(notice, { get title() { return tr('AquacultureModal.nong_trai_ca'); }, position: 'bottom' })
        this.needsRefresh = true
        const refreshed = await this.refresh(true, true)
        if (this.epoch !== epoch) return true
        if (!refreshed) this.notifyError(tr('aquaculture.thao_tac_da_thanh_cong_hay_lam_moi_de_cap_nhat_du_lieu'))
        return true
      } catch (error) {
        if (this.epoch === epoch) {
          const uncertain = !(error instanceof AquacultureRpcError) || error.uncertain
          if (!uncertain) { this.pending = null; rememberRequest(owner, null) }
          this.notifyError(uncertain
            ? tr('aquaculture.chua_nhan_duoc_ket_qua_tu_may_chu_nhan_thu_lai_thao_tac_de_kiem_')
            : errorMessage(error))
        }
        return false
      } finally { if (this.epoch === epoch) this.busy = false }
    },
    retryPending() { return this.pending ? this.perform(this.pending.action, this.pending.params, true) : Promise.resolve(false) },
    buyPond() { return this.perform('purchase_pond_slot', {}) },
    stock(speciesId: string, quantity: number, mode: CareMode) {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > this.maxStock(speciesId)) {
        this.notifyError(tr('aquaculture.so_luong_ca_vuot_suc_chua_con_lai_hoac_so_du_hien_co')); return Promise.resolve(false)
      }
      return this.perform('stock_aquaculture_batch', { p_pond_id: this.selectedPondId, p_species_id: speciesId, p_quantity: quantity, p_mode: mode })
    },
    feed(inventoryId: string) { return this.perform('feed_aquaculture_batch', { p_batch_id: this.selectedBatchId, p_inventory_id: inventoryId }) },
    care(task: 'water' | 'oxygen') { return this.perform('care_aquaculture_pond', { p_pond_id: this.selectedPondId, p_task: task }) },
    actOnFish(kind: 'sell' | 'transfer' | 'release', ids: string[]) {
      if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) return Promise.resolve(false)
      return this.perform(`${kind}_aquaculture_fish`, { p_fish_ids: [...ids].sort() })
    },
  },
})
