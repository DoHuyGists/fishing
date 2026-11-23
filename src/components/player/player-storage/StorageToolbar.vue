<script setup lang="ts">
import { watch } from "vue";
import { useStorageStore } from "../../../stores/player-storage-store";
import { t as tr } from "../../../i18n";
const storage = useStorageStore();
watch(() => [storage.search, storage.classification, storage.category, storage.status, storage.sort, storage.pageSize], () => storage.filtersChanged(), { flush: "sync" });
watch(() => storage.classification, () => { storage.category = ""; }, { flush: "sync" });
</script>

<template>
  <div class="space-y-3 rounded-xl border border-border-default bg-surface p-3">
    <fieldset :disabled="storage.busy || storage.loading" class="grid min-w-0 grid-cols-2 gap-3 border-0 p-0 lg:grid-cols-1 [&>label]:min-w-0 [&_input]:w-full [&_input]:min-w-0 [&_select]:w-full [&_select]:min-w-0">
      <label class="col-span-2 flex flex-col gap-1 text-xs lg:col-span-1">
        <span>{{ tr('Storage.search') }}</span>
        <input v-model="storage.search" type="search" :placeholder="tr('InventoryItems.tim_theo_ten_hoac_loai_vat_pham')" class="min-h-10 rounded-lg border border-border-default bg-white px-3 text-sm" />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr('Storage.classification') }}</span>
        <select v-model="storage.classification" class="min-h-10 rounded-lg border border-border-default bg-white px-2 text-sm">
          <option value="">{{ tr('Storage.all') }}</option>
          <option v-for="value in storage.classifications" :key="value" :value="value">{{ storage.classificationLabel(value) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr('Storage.category') }}</span>
        <select v-model="storage.category" class="min-h-10 rounded-lg border border-border-default bg-white px-2 text-sm">
          <option value="">{{ tr('Storage.all') }}</option>
          <option v-for="value in storage.categories" :key="value" :value="value">{{ storage.categoryLabel(value) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr('Storage.status') }}</span>
        <select v-model="storage.status" class="min-h-10 rounded-lg border border-border-default bg-white px-2 text-sm">
          <option v-for="value in ['all', 'usable', 'protected', 'unassigned']" :key="value" :value="value">{{ tr(`Storage.${value}`) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr('Storage.sort') }}</span>
        <select v-model="storage.sort" class="min-h-10 rounded-lg border border-border-default bg-white px-2 text-sm">
          <option v-for="value in ['newest', 'oldest', 'name', 'quantity']" :key="value" :value="value">{{ tr(`Storage.${value}`) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span>{{ tr('Storage.pageSize') }}</span>
        <select v-model="storage.pageSize" class="min-h-10 rounded-lg border border-border-default bg-white px-2 text-sm">
          <option v-for="size in [20, 40, 80]" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <button type="button" class="self-end rounded-lg border border-border-default px-3 py-2 text-sm hover:bg-white" @click="storage.resetFilters()">{{ tr('Storage.reset') }}</button>
    </fieldset>
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-3 text-sm">
      <span aria-live="polite">{{ tr('Storage.results', { count: storage.filteredItems.length }) }}</span>
      <div class="flex gap-2" role="group" :aria-label="tr('InventoryItems.kieu_hien_thi')">
        <button v-for="mode in (['grid', 'list'] as const)" :key="mode" type="button" :aria-pressed="storage.view === mode"
          class="min-h-9 rounded-lg border border-border-default px-3" :class="storage.view === mode ? 'bg-accent text-white' : 'bg-white'" @click="storage.view = mode">
          {{ tr(mode === 'grid' ? 'CaughtModal.luoi' : 'CaughtModal.danh_sach') }}
        </button>
      </div>
    </div>
  </div>
</template>
