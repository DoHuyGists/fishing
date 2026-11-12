<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AdminCrudScreen, { type CrudColumn, type CrudField } from '../AdminCrudScreen.vue'
import { useAdminAquacultureFoodStore } from './admin-aquaculture-food-store'
import AquacultureFoodManagementForm from './AquacultureFoodManagementForm.vue'

const emit = defineEmits<{ close: [] }>()
const store = useAdminAquacultureFoodStore()
onMounted(() => { void store.fetchAll() })
const speciesName = (id: string) => store.species.find(s => s.id === id)?.name ?? id
const itemName = (id: string) => store.sourceItems.find(i => i.id === id)?.name ?? id
const columns: CrudColumn[] = [
  { key: 'species_id', label: 'Loài', format: r => speciesName(r.species_id) },
  { key: 'item_id', label: 'Thức ăn', format: r => itemName(r.item_id) },
  { key: 'enabled', label: 'Trạng thái', format: r => r.enabled ? 'Đang dùng' : 'Đã tắt' },
  { key: 'capacity_units_per_item', label: 'Điểm sức chứa/phần' },
  { key: 'quality_gain', label: 'Chất lượng/lượt', format: r => '+' + +(r.quality_gain * 100).toFixed(2) + '%' },
]
const fields = computed<CrudField[]>(() => [
  { key: 'species_id', label: 'Loài đã cấu hình nuôi', type: 'select', required: true, immutable: true, options: store.rules.map(r => ({ value: r.species_id, label: speciesName(r.species_id) })) },
  { key: 'item_id', label: 'Vật phẩm thức ăn (items)', type: 'select', required: true, immutable: true, options: store.sourceItems.map(i => ({ value: i.id, label: i.name + (i.isDisabled ? ' · Vật phẩm đang tắt' : '') + ' · ' + i.id.slice(0, 8) })) },
  { key: 'enabled', label: 'Cho phép dùng', type: 'select', required: true, defaultValue: false, options: [{ value: 'false', label: 'Tắt' }, { value: 'true', label: 'Bật' }] },
  { key: 'capacity_units_per_item', label: 'Một phần ăn cho bao nhiêu điểm sức chứa', type: 'number', required: true, min: 1, step: 1, defaultValue: 20 },
  { key: 'quality_gain', label: 'Chất lượng tăng/lượt (0.08 = 8%)', type: 'number', required: true, min: .001, max: 1, step: .001, defaultValue: .08 },
])
</script>

<template>
  <AdminCrudScreen title="Thức ăn theo loài nuôi" subtitle="Số phần ăn = làm tròn lên (tổng điểm cá trong lứa / điểm mỗi phần). Tên, giá và trạng thái vật phẩm được quản lý tại mục Vật phẩm." icon="🌾"
    :columns="columns" :fields="fields" :items="store.items" :loading="store.loading" :error="store.error" :save="store.save" :remove="store.remove" @refresh="store.fetchAll()" @close="emit('close')">
    <template #form-fields="{ form, editing }">
      <AquacultureFoodManagementForm :form="form" :editing="editing" :fields="fields" />
    </template>
  </AdminCrudScreen>
</template>
