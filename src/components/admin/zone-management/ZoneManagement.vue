<script lang="ts" setup>
import { computed } from "vue";
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminWeatherStore } from "../weather-management/admin-weather-store";
import { useAdminZoneStore } from "./admin-zone-store";

const emit = defineEmits(["close"]);
const store = useAdminZoneStore();
const weatherStore = useAdminWeatherStore();
store.fetchAll();
weatherStore.fetchAll();

const weatherName = (id: string | null) => weatherStore.items.find((w) => w.id === id)?.name ?? "";
const dateText = (v: string | null) => (v ? new Date(v).toLocaleString("vi-VN") : "");

const columns: CrudColumn[] = [
  { key: "code", label: "Mã" },
  { key: "name", label: "Tên" },
  { key: "weatherId", label: "Thời tiết hiện tại", format: (r) => weatherName(r.weatherId) },
  { key: "weatherExpiresAt", label: "Hết hạn", format: (r) => dateText(r.weatherExpiresAt) },
];
const fields = computed<CrudField[]>(() => [
  { key: "code", label: "Mã", type: "text", required: true },
  { key: "name", label: "Tên", type: "text", required: true },
  {
    key: "weatherId",
    label: "Thời tiết hiện tại",
    type: "select",
    options: weatherStore.items.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
  },
  { key: "weatherExpiresAt", label: "Thời tiết hết hạn lúc", type: "datetime" },
  { key: "weatherActiveModifiers", label: "Chỉ số đang hoạt động (JSON)", type: "json" },
  { key: "weatherSeed", label: "Seed", type: "text", readonly: true },
  { key: "weatherUpdatedAt", label: "Cập nhật thời tiết", type: "datetime", readonly: true },
  { key: "createdAt", label: "Ngày tạo", type: "datetime", readonly: true },
]);

const save = (payload: any, id: string | null) => (id ? store.update(id, payload) : store.create(payload));
</script>

<template>
  <AdminCrudScreen
    title="Quản lý vùng"
    subtitle="Thêm, sửa, xoá vùng (zones)"
    icon="🌊"
    :columns="columns"
    :fields="fields"
    :items="store.items"
    :loading="store.loading"
    :error="store.error"
    :save="save"
    :remove="store.remove"
    @close="emit('close')"
    @refresh="store.fetchAll()"
  />
</template>
