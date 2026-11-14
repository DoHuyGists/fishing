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
  <section class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]" :aria-label="title">
    <header class="space-y-2 border-b border-[#cbd9c6] p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-bold">
          {{ title }} <span class="font-normal text-[#526650]">({{ count }})</span>
        </div>
        <button :id="actionId" type="button" :disabled="actionDisabled" class="rounded-md bg-teal-700 px-3 py-1.5 text-xs text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40" @click="$emit('action')">
          {{ actionLabel }}
        </button>
      </div>
      <input v-model="search" type="search" :aria-label="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')" :placeholder="tr('EquipmentSets.tim_theo_so_set_hoac_ten_vat_pham')" class="w-full rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
    </header>
    <div class="min-w-0 flex-1 space-y-3 p-3">
      <div v-if="empty" class="py-6 text-center text-xs text-[#526650]">{{ emptyText }}</div>
      <slot />
    </div>
    <Pagination :page="page" :total="total" :page-size="pageSize" :loading="loading" @change="$emit('change-page', $event)" />
  </section>
</template>
