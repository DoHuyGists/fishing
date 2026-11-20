<script lang="ts" setup>
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminWeatherStore } from "./admin-weather-store.ts";

const emit = defineEmits(["close"]);
const store = useAdminWeatherStore();
store.fetchAll();

const columns: CrudColumn[] = [
  { key: "code", label: "Mã" },
  { key: "name", label: "Tên" },
  { key: "rarityTier", label: "Độ hiếm" },
  { key: "extremeWeight", label: "Hệ số khắc nghiệt (E)" },
  { key: "durationMin", label: "Tối thiểu (phút)" },
  { key: "durationMax", label: "Tối đa (phút)" },
  { key: "image", label: "Ảnh" },
];
const fields: CrudField[] = [
  { key: "code", label: "Mã", type: "text", required: true },
  { key: "name", label: "Tên", type: "text", required: true },
  { key: "rarityTier", label: "Độ hiếm", type: "text", required: true },
  {
    key: "extremeWeight",
    label: "Hệ số khắc nghiệt (E)",
    type: "number",
    required: true,
    defaultValue: 1,
    min: 0.000001,
    max: 1000000,
    step: 0.01,
  },
  { key: "durationMin", label: "Thời lượng tối thiểu (phút)", type: "number", required: true },
  { key: "durationMax", label: "Thời lượng tối đa (phút)", type: "number", required: true },
  { key: "image", label: "Ảnh", type: "text" },
  { key: "createdAt", label: "Ngày tạo", type: "datetime", readonly: true },
];

const save = (payload: any, id: string | null) => {
  if (
    !Number.isFinite(Number(payload.extremeWeight)) ||
    Number(payload.extremeWeight) <= 0 ||
    Number(payload.extremeWeight) > 1000000
  )
    throw new Error("Hệ số khắc nghiệt phải lớn hơn 0 và không vượt quá 1.000.000");
  if (payload.durationMin > payload.durationMax) throw new Error("Thời lượng tối thiểu phải nhỏ hơn hoặc bằng tối đa");
  return id ? store.update(id, payload) : store.create(payload);
};
</script>

<template>
  <AdminCrudScreen
    title="Quản lý thời tiết"
    icon="⛅"
    :columns="columns"
    :fields="fields"
    :items="store.items"
    :page="store.page"
    :page-size="store.pageSize"
    :total="store.total"
    @page="store.fetchAll"
    :loading="store.loading"
    :error="store.error"
    :save="save"
    :remove="store.remove"
    @close="emit('close')"
    @refresh="store.fetchAll()"
  >
    <template #cell-image="{ item, value }">
      <img
        v-if="value"
        :src="value"
        :alt="item.name"
        loading="lazy"
        class="size-16 rounded-md border border-border-default bg-surface object-contain"
      />
      <span v-else class="text-content">Chưa có ảnh</span>
    </template>
  </AdminCrudScreen>
</template>
