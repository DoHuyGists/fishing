<script setup lang="ts">
import { onMounted } from "vue";
import { t as tr } from "../../../i18n";
import { useStorageStore } from "../../../stores/player-storage-store";
import { useModalStore } from "../../../stores/player-modal-store";
import Modal from "../../shared/Modal.vue";
import CapacityUsage from "../../shared/CapacityUsage.vue";
import { useUserProfileStore } from "../../../stores/player-user-profile-store";
import Pagination from "../../shared/Pagination.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import StorageToolbar from "./StorageToolbar.vue";
import StorageItemCard from "./StorageItemCard.vue";
const storage = useStorageStore();
const profile = useUserProfileStore();
const modal = useModalStore();
onMounted(() => { storage.confirmingDelete = false; void storage.load(); });
function close() { if (!storage.busy) { if (storage.confirmingDelete) storage.confirmingDelete = false; else modal.close(); } }
</script>

<template>
  <Modal :title="tr('InventoryModal.kho_do')" :on-refresh="async () => { if (!storage.busy) await storage.load(); }" content-width-class="max-w-7xl" @keydown.esc.stop="close">
    <div class="space-y-4 text-content">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-border-default bg-surface p-3 text-sm">
          <CapacityUsage :label="tr('UserProfile.suc_chua_tui_do')" :used="storage.ready ? storage.items.length : null" :capacity="profile.profile ? profile.inventoryCapacity : null" />
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-3 text-sm">{{ tr('Storage.totalQuantity') }} <b>{{ storage.totalQuantity }}</b></div>
        <div class="rounded-xl border border-border-default bg-surface p-3 text-sm">{{ tr('Storage.selected') }} <b>{{ storage.selectedIds.length }}</b></div>
      </div>
      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <StorageToolbar class="min-w-0 lg:sticky lg:top-0" />
        <div class="min-w-0 space-y-4">
          <div v-if="storage.error" role="alert" class="rounded-lg border border-danger p-3 text-sm text-danger">{{ storage.error }}</div>
          <div class="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border-default bg-white p-3 text-sm">
            <label class="flex min-h-9 items-center gap-2"><input type="checkbox" :checked="storage.allPageSelected" :disabled="storage.loading || storage.busy || !storage.ready" @change="storage.togglePage()" />{{ tr('InventoryItems.chon_ca_trang') }}</label>
            <button type="button" :disabled="storage.busy || storage.loading || !storage.ready || !storage.filteredItems.length" class="min-h-9 rounded-lg border border-border-default px-3 disabled:opacity-50" @click="storage.selectFiltered()">{{ tr('Storage.selectResults') }}</button>
            <button type="button" :disabled="storage.busy || !storage.selectedIds.length" class="min-h-9 rounded-lg border border-border-default px-3 disabled:opacity-50" @click="storage.selectedIds = []">{{ tr('Storage.clearSelection') }}</button>
            <button v-if="storage.usableItem" type="button" :disabled="storage.busy || storage.loading || !storage.ready" class="min-h-9 rounded-lg bg-accent px-3 text-white disabled:opacity-50" @click="storage.useSelected()">{{ tr(storage.busy ? 'InventoryItems.dang_su_dung' : 'EquipmentSets.su_dung') }}</button>
            <button type="button" :disabled="!storage.canDelete" class="min-h-9 rounded-lg bg-danger px-3 text-white disabled:opacity-50" @click="storage.confirmingDelete = true">{{ tr('InventoryItems.xoa_da_chon') }} ({{ storage.selectedIds.length }})</button>
            <span v-if="storage.selectedProtectedCount" class="w-full text-xs">{{ tr('Storage.protectedSelection', { count: storage.selectedProtectedCount }) }}</span>
          </div>
          <div v-if="storage.loading" role="status" class="py-16 text-center text-sm">{{ tr('InventoryModal.dang_tai_kho_do') }}</div>
          <template v-else-if="storage.ready">
            <div v-if="!storage.pagedItems.length" class="py-16 text-center text-sm">{{ tr(storage.items.length ? 'InventoryItems.khong_co_vat_pham_nao_khop_voi_tim_kiem' : 'InventoryItems.kho_do_dang_trong') }}</div>
            <div :class="storage.view === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2'">
              <StorageItemCard v-for="(item,index) in storage.pagedItems" :key="item.id" :item="item" class="slide-fade-in from-bottom" :style="{ '--delay': `${index * 45}ms` }"/>
            </div>
            <Pagination :page="storage.page" :total="storage.filteredItems.length" :page-size="storage.pageSize" :loading="storage.busy" @change="storage.page = $event" />
          </template>
        </div>
      </div>
      <TwoOptionsModal v-if="storage.confirmingDelete" class="z-[10001]!"
        :title="tr('Storage.confirmDelete', { count: storage.selectedIds.length })"
        :aria-label="tr('Storage.confirmDelete', { count: storage.selectedIds.length })"
        :first-disabled="storage.busy" :second-disabled="!storage.canDelete"
        :second-text="tr(storage.busy ? 'InventoryModal.dang_xoa' : 'InventoryModal.xoa')"
        :on-first="() => { storage.confirmingDelete = false; }" :on-second="() => { void storage.deleteSelected(); }"
        :on-dismiss="() => { if (!storage.busy) storage.confirmingDelete = false; }">
        <div class="text-sm">{{ tr('Storage.deleteWarning') }}</div>
        <div v-if="storage.error" role="alert" class="mt-2 text-sm text-danger">{{ storage.error }}</div>
      </TwoOptionsModal>
    </div>
  </Modal>
</template>
