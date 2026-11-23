<script setup lang="ts">
import { t as tr } from "../../i18n";
import Pagination from "./Pagination.vue";

defineProps<{
  title: string;
  count: number;
  actionLabel: string;
  actionId?: string;
  actionDisabled?: boolean;
  empty: boolean;
  emptyText: string;
  page: number;
  total: number;
  pageSize: number;
  loading?: boolean;
}>();
const search = defineModel<string>("search", { required: true });
defineEmits<{ action: []; "change-page": [page: number] }>();
</script>

<template>
  <section class="flex min-h-0 min-w-0 flex-col h-full rounded-xl border border-border-default bg-surface text-content" :aria-label="title">
    <header class="shrink-0 space-y-2 border-b border-border-default p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-bold">
          {{ title }} <span class="font-normal text-content">({{ count }})</span>
        </div>
        <button :id="actionId" type="button" :disabled="actionDisabled" class="ocean-primary-action rounded-md bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" @click="$emit('action')">
          {{ actionLabel }}
        </button>
      </div>
      <input v-model="search" type="search" :aria-label="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')" :placeholder="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')" class="w-full rounded-md border border-border-default bg-white px-3 py-2 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-surface" />
    </header>
    <div class="min-h-0 min-w-0 h-0 grow space-y-3 overflow-y-scroll p-3">
      <div v-if="empty" class="py-6 text-center text-xs text-content">{{ emptyText }}</div>
      <slot />
    </div>
    <Pagination :page="page" :total="total" :page-size="pageSize" :loading="loading" @change="$emit('change-page', $event)" />
  </section>
</template>
