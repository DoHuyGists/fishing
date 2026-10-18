<script lang="ts" setup>
import { computed } from "vue";
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminWeatherStore } from "../weather-management/admin-weather-store";
import { useAdminZoneStore } from "../zone-management/admin-zone-store";
import { useAdminZoneWeatherStore } from "./admin-zone-weather-store";

const emit = defineEmits(["close"]);
const store = useAdminZoneWeatherStore();
const zoneStore = useAdminZoneStore();
const weatherStore = useAdminWeatherStore();
store.fetchAll();
zoneStore.fetchAll();
weatherStore.fetchAll();

const zoneName = (id: string) => zoneStore.items.find((z) => z.id === id)?.name ?? id;
const weatherName = (id: string) => weatherStore.items.find((w) => w.id === id)?.name ?? id;

const columns: CrudColumn[] = [
  { key: "zoneId", label: "Vùng", format: (r) => zoneName(r.zoneId) },
  { key: "weatherId", label: "Thời tiết", format: (r) => weatherName(r.weatherId) },
  { key: "weightModifier", label: "Hệ số trọng số" },
];
const fields = computed<CrudField[]>(() => [
  { key: "zoneId", label: "Vùng", type: "select", required: true, options: zoneStore.items.map((z) => ({ value: z.id, label: `${z.name} (${z.code})` })) },
  { key: "weatherId", label: "Thời tiết", type: "select", required: true, options: weatherStore.items.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })) },
  { key: "weightModifier", label: "Hệ số trọng số", type: "number" },
]);

const save = (payload: any, id: string | null) => (id ? store.update(id, payload) : store.create(payload));
</script>

<template>
  <AdminCrudScreen
    title="Thời tiết theo vùng"
    subtitle="Chọn thời tiết được phép xuất hiện ở mỗi vùng (zone_allowed_weathers)"
    icon="🌦️"
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
