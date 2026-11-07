<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AdminCrudScreen, { type CrudColumn, type CrudField } from '../AdminCrudScreen.vue'
import { useAdminAquacultureSpeciesStore } from './admin-aquaculture-species-store'

const emit = defineEmits<{ close: [] }>()
const store = useAdminAquacultureSpeciesStore()
onMounted(() => { void store.fetchAll() })
const name = (id: string) => store.species.find(s => s.id === id)?.name ?? id
const columns: CrudColumn[] = [
  { key: 'species_id', label: 'Loài', format: r => name(r.species_id) },
  { key: 'enabled', label: 'Trạng thái', format: r => r.enabled ? 'Đang mở' : 'Đã tắt' },
  { key: 'capacity_per_fish', label: 'Điểm/con' },
  { key: 'grow_seconds', label: 'Thời gian (giờ)', format: r => (r.grow_seconds / 3600).toLocaleString('vi-VN') },
  { key: 'seed_cash', label: 'Xu/con giống' },
  { key: 'sale_cash_per_kg', label: 'Xu/kg khi bán' },
  { key: 'rare_chance', label: 'Đặc biệt', format: r => +(r.rare_chance * 100).toFixed(4) + '%' },
  { key: 'rules_version', label: 'Phiên bản' },
]
const fields = computed<CrudField[]>(() => [
  { key: 'species_id', label: 'Loài cá', type: 'select', required: true, immutable: true, options: store.species.map(s => ({ value: s.id, label: s.name })) },
  { key: 'enabled', label: 'Mở nuôi', type: 'select', required: true, defaultValue: false, options: [{ value: 'false', label: 'Tắt' }, { value: 'true', label: 'Bật' }] },
  { key: 'capacity_per_fish', label: 'Điểm sức chứa mỗi cá (1–99)', type: 'number', required: true, min: 1, max: 99, step: 1, defaultValue: 5 },
  { key: 'grow_seconds', label: 'Thời gian nuôi (giây, tối thiểu 61)', type: 'number', required: true, min: 61, step: 1, defaultValue: 21600 },
  { key: 'seed_cash', label: 'Giá giống (xu/con)', type: 'number', required: true, min: 0, step: 1, defaultValue: 100 },
  { key: 'seed_weight_kg', label: 'Cân nặng cá giống (kg)', type: 'number', required: true, min: .0001, step: .0001, defaultValue: .05 },
  { key: 'adult_weight_kg', label: 'Cân nặng trưởng thành cơ bản (kg)', type: 'number', required: true, min: .0001, step: .0001, defaultValue: 1.2 },
  { key: 'sale_cash_per_kg', label: 'Giá bán (xu/kg)', type: 'number', required: true, min: 0, step: .01, defaultValue: 150 },
  { key: 'rare_chance', label: 'Tỷ lệ đặc biệt (0–1; 0.01 = 1%)', type: 'number', required: true, min: 0, max: 1, step: .000001, defaultValue: .01 },
  { key: 'advanced_rare_bonus', label: 'Thưởng tỷ lệ khi chất lượng đầy (0–1)', type: 'number', required: true, min: 0, max: 1, step: .000001, defaultValue: .02 },
  { key: 'rare_weight_multiplier', label: 'Hệ số cân nặng cá đặc biệt (1–10)', type: 'number', required: true, min: 1, max: 10, step: .01, defaultValue: 1.5 },
  { key: 'feed_cooldown_seconds', label: 'Thời gian chờ cho ăn (giây, tối thiểu 1800)', type: 'number', required: true, min: 1800, step: 1, defaultValue: 3600 },
])
</script>

<template>
  <AdminCrudScreen title="Cấu hình loài nuôi" subtitle="Thay đổi áp dụng cho lứa thả mới; lứa đang nuôi giữ cấu hình lúc thả. Loài có lịch sử nên tắt thay vì xoá." icon="🐟"
    :columns="columns" :fields="fields" :items="store.items" :loading="store.loading" :error="store.error" :save="store.save" :remove="store.remove" @refresh="store.fetchAll()" @close="emit('close')" />
</template>
