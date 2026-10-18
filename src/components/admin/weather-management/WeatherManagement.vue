<script lang="ts" setup>
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminWeatherStore } from "./admin-weather-store";

const emit = defineEmits(["close"]);
const store = useAdminWeatherStore();
store.fetchAll();

const columns: CrudColumn[] = [
  { key: "code", label: "Mã" },
  { key: "name", label: "Tên" },
  { key: "rarityTier", label: "Độ hiếm" },
  { key: "durationMin", label: "Tối thiểu (phút)" },
  { key: "durationMax", label: "Tối đa (phút)" },
  { key: "image", label: "Ảnh" },
];
const fields: CrudField[] = [
  { key: "code", label: "Mã", type: "text", required: true },
  { key: "name", label: "Tên", type: "text", required: true },
  { key: "rarityTier", label: "Độ hiếm", type: "text", required: true },
  { key: "durationMin", label: "Thời lượng tối thiểu (phút)", type: "number", required: true },
  { key: "durationMax", label: "Thời lượng tối đa (phút)", type: "number", required: true },
  { key: "image", label: "Ảnh", type: "text" },
  { key: "createdAt", label: "Ngày tạo", type: "datetime", readonly: true },
];

const save = (payload: any, id: string | null) => {
  if (payload.durationMin > payload.durationMax) throw new Error("Thời lượng tối thiểu phải nhỏ hơn hoặc bằng tối đa");
  return id ? store.update(id, payload) : store.create(payload);
};
</script>

<template>
  <AdminCrudScreen
    title="Quản lý thời tiết"
    subtitle="Thêm, sửa, xoá thời tiết (weathers)"
    icon="⛅"
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
