<script lang="ts" setup>
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminModifierStore } from "./admin-modifier-store";

const emit = defineEmits(["close"]);
const store = useAdminModifierStore();
store.fetchAll();

const columns: CrudColumn[] = [
  { key: "code", label: "Mã" },
  { key: "name", label: "Tên" },
  { key: "unit", label: "Đơn vị" },
];
const fields: CrudField[] = [
  { key: "code", label: "Mã", type: "text", required: true },
  { key: "name", label: "Tên", type: "text", required: true },
  { key: "unit", label: "Đơn vị", type: "text" },
  { key: "createdAt", label: "Ngày tạo", type: "datetime", readonly: true },
];

const save = (payload: any, id: string | null) => (id ? store.update(id, payload) : store.create(payload));
</script>

<template>
  <AdminCrudScreen
    title="Quản lý chỉ số"
    subtitle="Thêm, sửa, xoá chỉ số (modifiers)"
    icon="📊"
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
