<script setup lang="ts">
import { computed, onMounted } from "vue";
import AdminCrudScreen, { type CrudColumn, type CrudField } from "../AdminCrudScreen.vue";
import { useAdminBlueprintStore } from "./admin-blueprint-store";
const emit = defineEmits<{ close: [] }>();
const store = useAdminBlueprintStore();
onMounted(() => { void store.fetchAll(); });
const itemName = (id: string) => store.sourceItems.find(item => item.id === id)?.name ?? id;
const columns: CrudColumn[] = [
  { key: 'result_item_id', label: 'Thành phẩm', format: row => itemName(row.result_item_id) },
  { key: 'result_quantity', label: 'Số lượng' },
  { key: 'gold_cost', label: 'Phí vàng' },
  { key: 'required_materials', label: 'Nguyên liệu', format: row => row.required_materials.map((m: { item_id: string; quantity: number }) => `${itemName(m.item_id)} ×${m.quantity}`).join(', ') },
];
const fields = computed<CrudField[]>(() => [
  { key: 'result_item_id', label: 'Vật phẩm thành phẩm', type: 'select', required: true, options: store.sourceItems.map(item => ({ value: item.id, label: `${item.name} · ${item.id}` })) },
  { key: 'result_quantity', label: 'Số lượng thành phẩm', type: 'number', required: true, min: 1, max: 1000, step: 1, defaultValue: 1 },
  { key: 'gold_cost', label: 'Phí vàng mỗi lần chế tạo', type: 'number', required: true, min: 0, step: 1, defaultValue: 0 },
  { key: 'required_materials', label: 'Nguyên liệu: [{"item_id":"ID vật phẩm","quantity":1}]', type: 'json', required: true },
]);
</script>
<template>
  <AdminCrudScreen title="Công thức chế tạo" subtitle="Chọn thành phẩm, số lượng, phí và danh sách nguyên liệu. ID vật phẩm có trong danh sách chọn thành phẩm." icon="🛠️" :columns="columns" :fields="fields" :items="store.items" :loading="store.loading" :error="store.error" :save="store.save" :remove="store.remove" @refresh="store.fetchAll()" @close="emit('close')" />
</template>
