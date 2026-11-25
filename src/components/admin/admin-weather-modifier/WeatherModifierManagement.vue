<script lang="ts" setup>
import { computed } from "vue";
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminModifierStore } from "../admin-modifier/admin-modifier-store.ts";
import { useAdminWeatherStore } from "../admin-weather/admin-weather-store.ts";
import { useAdminWeatherModifierStore } from "./admin-weather-modifier-store.ts";

const emit = defineEmits(["close"]);
const store = useAdminWeatherModifierStore();
const weatherStore = useAdminWeatherStore();
const modifierStore = useAdminModifierStore();
store.fetchAll();
weatherStore.fetchOptions();
modifierStore.fetchOptions();

const weatherName = (id: string) => weatherStore.options.find((w) => w.id === id)?.name ?? id;
const modifierName = (id: string) => modifierStore.options.find((m) => m.id === id)?.name ?? id;

const columns: CrudColumn[] = [
  { key: "weatherId", label: "Thời tiết", format: (r) => weatherName(r.weatherId) },
  { key: "modifierId", label: "Chỉ số", format: (r) => modifierName(r.modifierId) },
  { key: "minValue", label: "Giá trị nhỏ nhất" },
  { key: "maxValue", label: "Giá trị lớn nhất" },
  { key: "baseChance", label: "Tỷ lệ cơ bản" },
];
const fields = computed<CrudField[]>(() => [
  {
    key: "weatherId",
    label: "Thời tiết",
    type: "select",
    required: true,
    options: weatherStore.options.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
  },
  {
    key: "modifierId",
    label: "Chỉ số",
    type: "select",
    required: true,
    options: modifierStore.options.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` })),
  },
  { key: "minValue", label: "Giá trị nhỏ nhất", type: "number", required: true },
  { key: "maxValue", label: "Giá trị lớn nhất", type: "number", required: true },
  { key: "baseChance", label: "Tỷ lệ cơ bản (0-1)", type: "number", min: 0, max: 1 },
]);

const save = (payload: any, id: string | null) => {
  if (payload.minValue > payload.maxValue) throw new Error("Giá trị nhỏ nhất phải nhỏ hơn hoặc bằng lớn nhất");
  return id ? store.update(id, payload) : store.create(payload);
};
</script>

<template>
  <AdminCrudScreen
    title="Chỉ số theo thời tiết"
    icon="🎚️"
    :columns="columns"
    :fields="fields"
    :items="store.items"
    :page="store.page"
    :search="store.search"
    :page-size="store.pageSize"
    :total="store.total"
    @page="store.fetchAll"
    :loading="store.loading"
    :error="store.error"
    :save="save"
    :remove="store.remove"
    @close="emit('close')"
    @refresh="store.fetchAll()"
  />
</template>
