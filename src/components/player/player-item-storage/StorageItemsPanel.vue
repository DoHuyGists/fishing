<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useStorageStore } from "../../../stores/player-storage-store";
import Pagination from "../../shared/Pagination.vue";
import StorageItemCard from "./StorageItemCard.vue";

const storage = useStorageStore();
</script>

<template>
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
</template>
