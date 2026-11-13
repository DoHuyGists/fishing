<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import Pagination from '../../shared/Pagination.vue';
import { usePagedListFilters } from '../../../composables/usePagedListFilters';
import { computed, ref } from "vue";
import { useAdminFishingPassStore } from "./admin-fishing-pass-store";
import type { FishingPass, FishingPassPayload } from "./fishing-pass-admin";
import FishingPassFormManagement from "./FishingPassFormManagement.vue";

const emit = defineEmits<{ close: [] }>();
const store = useAdminFishingPassStore();
const search = computed({ get: () => store.search, set: value => { store.search = value; } });
const status = computed({ get: () => store.status, set: value => { store.status = value; } });
usePagedListFilters([search, status], () => { void store.fetchAll(1); }, () => { ++store.requestId; });
const editing = ref<FishingPass | null>(null);
const formOpen = ref(false);
const deleting = ref<FishingPass | null>(null);
const filtered = computed(() => store.passes);
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} xu`;
const date = (value: string) => new Date(value).toLocaleString("vi-VN");
function openCreate() { editing.value = null; formOpen.value = true; }
function openEdit(pass: FishingPass) { editing.value = pass; formOpen.value = true; }
async function save(payload: FishingPassPayload) {
  if (await store.save(payload, editing.value?.id)) formOpen.value = false;
}
async function confirmRemove() {
  if (deleting.value && await store.remove(deleting.value.id)) deleting.value = null;
}
store.fetchAll();
</script>

<template>
  <AdminModal
    title="Quản lý vé câu"
    subtitle="Tạo và quản lý thời hạn, giá vé câu."
    @close="emit('close')"
    @keydown.esc="emit('close')"
  >
      <div v-if="formOpen" class="overflow-y-auto p-5 sm:p-7">
        <div class="mb-4 text-base font-bold">{{ editing ? 'Sửa vé câu' : 'Tạo vé câu' }}</div>
        <div v-if="store.error" class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ store.error }}</div>
        <FishingPassFormManagement :pass="editing" :saving="store.saving" @save="save" @cancel="formOpen = false" />
      </div>
      <template v-else>
        <div class="flex flex-wrap items-center gap-3 border-b border-[#cbd9c6] p-4 sm:px-6">
          <input v-model="search" type="search" placeholder="Tìm tên hoặc mô tả…" class="min-w-48 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" />
          <select v-model="status" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã tắt</option></select>
          <button type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm" :disabled="store.loading" @click="store.fetchAll()">{{ store.loading ? 'Đang tải…' : 'Làm mới' }}</button>
          <button type="button" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white" @click="openCreate">+ Tạo vé</button>
        </div>
        <div v-if="store.error" class="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:mx-6">{{ store.error }}</div>
        <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <div v-if="store.loading && !store.passes.length" class="py-12 text-center text-sm text-[#24352a]/70">Đang tải danh sách vé…</div>
          <div v-else-if="!filtered.length" class="rounded-xl border border-dashed border-[#cbd9c6] bg-white p-10 text-center text-sm text-[#24352a]/70">Chưa có vé câu phù hợp.</div>
          <div v-else class="overflow-x-auto rounded-xl border border-[#cbd9c6] bg-white">
            <table class="w-full min-w-[850px] text-left text-sm">
              <thead class="bg-[#eaf1e5] text-xs uppercase text-[#24352a]/70"><tr><th class="px-4 py-3">Tên vé</th><th class="px-4 py-3">Giá / số ngày</th><th class="px-4 py-3">Thời gian</th><th class="px-4 py-3">Trạng thái</th><th class="px-4 py-3 text-right">Thao tác</th></tr></thead>
              <tbody><tr v-for="pass in filtered" :key="pass.id" class="border-t border-[#e5ece1] align-top"><td class="max-w-72 px-4 py-3"><div class="font-semibold">{{ pass.name }}</div><div v-if="pass.description" class="mt-1 line-clamp-2 text-xs text-[#24352a]/65">{{ pass.description }}</div></td><td class="whitespace-nowrap px-4 py-3">{{ money(pass.price) }}<div class="text-xs text-[#24352a]/65">{{ pass.totalDays }} ngày</div></td><td class="whitespace-nowrap px-4 py-3 text-xs">{{ date(pass.startAt) }}<div class="mt-1">đến {{ date(pass.endAt) }}</div></td><td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="pass.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'">{{ pass.isActive ? 'Hoạt động' : 'Đã tắt' }}</span></td><td class="whitespace-nowrap px-4 py-3 text-right"><button type="button" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-[#f5f9f0]" @click="openEdit(pass)">Sửa</button><button type="button" class="ml-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" @click="deleting = pass">Xoá</button></td></tr></tbody>
            </table>
          </div>
        </div>
      </template>
    <div v-if="deleting" class="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"><div class="font-bold">Xác nhận xoá vé</div><div class="my-3 text-sm text-slate-600">Bạn có chắc muốn xoá “{{ deleting.name }}”?</div><div class="flex justify-end gap-2"><button type="button" class="rounded-lg border px-3 py-2 text-sm" @click="deleting = null">Huỷ</button><button type="button" class="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white" @click="confirmRemove">Xoá vé</button></div></div>
    </div>
    <Pagination v-if="!formOpen" :page="store.page" :page-size="store.pageSize" :total="store.total" :loading="store.loading" @change="store.fetchAll($event)" />
  </AdminModal>
</template>
