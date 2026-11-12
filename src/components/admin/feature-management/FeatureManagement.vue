<script setup lang="ts">
import { onMounted } from "vue";
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminFeatureStore } from "./admin-feature-store";
import { useToast } from "../../../composables/useToast";

const emit = defineEmits<{ close: [] }>();
const store = useAdminFeatureStore();
const toast = useToast();
onMounted(() => { void store.fetchAll(); });

async function save(payload: Record<string, unknown>, key: string | null) {
  try {
    await store.save(payload, key);
    const name = store.items.find(item => item.feature_key === key)?.name ?? key;
    const enabled = store.flags.find(flag => flag.feature_key === key)?.enabled;
    toast.success(`${name}: ${enabled ? 'Đang bật — người chơi có thể sử dụng.' : 'Đang tắt — tính năng đang khóa với người chơi.'}`, { title: 'Đã cập nhật tính năng' });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Không thể lưu cấu hình tính năng', { title: 'Cập nhật thất bại' });
    throw error;
  }
}

const columns: CrudColumn[] = [
  { key: "name", label: "Tính năng" },
  { key: "feature_key", label: "Mã" },
  { key: "enabled", label: "Trạng thái", format: row => row.enabled === undefined ? "Thiếu cấu hình DB" : row.enabled ? "Đang bật · Có thể sử dụng" : "Đang tắt · Đang khóa" },
  { key: "message_vi", label: "Thông báo (VI)" },
  { key: "message_en", label: "Thông báo (EN)" },
  { key: "updated_at", label: "Cập nhật lúc", format: row => row.updated_at ? new Date(row.updated_at).toLocaleString("vi-VN") : "" },
  { key: "updated_by", label: "Người cập nhật" },
];
const fields: CrudField[] = [
  { key: "name", label: "Tính năng", type: "text", readonly: true },
  { key: "feature_key", label: "Mã tính năng", type: "text", readonly: true },
  { key: "enabled", label: "Trạng thái", type: "select", required: true, options: [
    { value: "true", label: "Đang bật — người chơi có thể sử dụng" }, { value: "false", label: "Đang tắt — khóa tính năng với người chơi" },
  ] },
  { key: "message_vi", label: "Thông báo tiếng Việt (để trống dùng mặc định)", type: "text" },
  { key: "message_en", label: "Thông báo tiếng Anh (để trống dùng mặc định)", type: "text" },
  { key: "updated_at", label: "Cập nhật lúc", type: "datetime", readonly: true },
];
</script>

<template>
  <AdminCrudScreen
    title="Tính khả dụng của tính năng"
    subtitle="Sửa trạng thái để bật/tắt tính năng trên mọi máy người chơi. Flag bản đồ và vào bãi câu được quản lý riêng."
    icon="🛑"
    :columns="columns" :fields="fields" :items="store.items"
    :loading="store.loading" :error="store.error"
    :allow-create="false" :allow-delete="false"
    :save="save" :remove="store.remove"
    @refresh="store.fetchAll()" @close="emit('close')"
  >
    <template #cell-enabled="{ item, value }">
      <span
        class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold"
        :class="item.enabled === true ? 'border-emerald-300 bg-emerald-100 text-emerald-900' : item.enabled === false ? 'border-red-300 bg-red-100 text-red-900' : 'border-amber-300 bg-amber-100 text-amber-900'"
      >
        <span aria-hidden="true" class="size-2 rounded-full" :class="item.enabled === true ? 'bg-emerald-600' : item.enabled === false ? 'bg-red-600' : 'bg-amber-600'"></span>
        {{ value }}
      </span>
    </template>
  </AdminCrudScreen>
</template>
