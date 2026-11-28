<script lang="ts" setup>
import AdminCrudScreen, { type CrudColumn } from "../AdminCrudScreen.vue";
import WeatherManagementForm from "./WeatherManagementForm.vue";
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
</script>

<template>
  <AdminCrudScreen
    title="Quản lý thời tiết"
    icon="⛅"
    :columns="columns"
    :items="store.items"
    :page="store.page"
    :search="store.search"
    :page-size="store.pageSize"
    :total="store.total"
    @page="store.fetchAll"
    :loading="store.loading"
    :error="store.error"
    :remove="store.remove"
    @close="emit('close')"
    @refresh="store.fetchAll()"
  >
    <template #form="{ item, close, setSaving }">
      <WeatherManagementForm :weather="item" @close="close" @saving="setSaving" />
    </template>
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
