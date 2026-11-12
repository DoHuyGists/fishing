<script setup lang="ts">
import { computed } from 'vue'
import type { CrudField } from '../AdminCrudScreen.vue'
import { useAdminAquacultureFoodStore } from './admin-aquaculture-food-store'

const props = defineProps<{
  form: Record<string, any>
  editing: boolean
  fields: CrudField[]
}>()
const store = useAdminAquacultureFoodStore()
const selectedItem = computed(() => store.sourceItems.find(item => item.id === props.form.item_id))
const qualityPercent = computed(() => {
  const value = Number(props.form.quality_gain)
  return Number.isFinite(value) && value >= .001 && value <= 1
    ? (value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
    : null
})

function isConfigured(itemId: string) {
  return store.items.some(item => item.species_id === props.form.species_id && item.item_id === itemId)
}
</script>

<template>
  <div class="flex flex-col gap-4 text-[#24352a]">
    <div class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 text-xs">
      Mỗi cấu hình gắn một vật phẩm thức ăn với một loài đã cấu hình nuôi.
      Khi chỉnh sửa, loài và vật phẩm được giữ cố định.
    </div>

    <div v-if="!editing && (!store.rules.length || !store.sourceItems.length)"
      role="status" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <div v-if="!store.rules.length">Chưa có loài được cấu hình nuôi. Hãy thêm cấu hình loài nuôi trước.</div>
      <div v-if="!store.sourceItems.length">Chưa có vật phẩm thức ăn. Hãy thêm vật phẩm tại mục Vật phẩm trước.</div>
    </div>

    <label v-for="field in fields" :key="field.key" class="flex flex-col gap-1 text-xs font-semibold">
      <span>{{ field.label }}<span v-if="field.required && !(editing && field.immutable)" class="text-red-600"> *</span></span>
      <input v-if="editing && field.immutable"
        :value="field.options?.find(option => option.value === String(form[field.key]))?.label ?? form[field.key]"
        disabled class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 font-normal" />
      <select v-else-if="field.type === 'select'" v-model="form[field.key]" :required="field.required"
        class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 font-normal">
        <option value="">-- Chọn --</option>
        <option v-for="option in field.options" :key="option.value" :value="option.value"
          :disabled="!editing && field.key === 'item_id' && isConfigured(option.value)">
          {{ option.label }}{{ !editing && field.key === 'item_id' && isConfigured(option.value) ? ' · Đã cấu hình cho loài này' : '' }}
        </option>
      </select>
      <input v-else v-model.number="form[field.key]" type="number" :required="field.required"
        :min="field.min" :max="field.max" :step="field.step ?? 'any'"
        class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 font-normal" />
      <span v-if="field.key === 'capacity_units_per_item'" class="font-normal text-gray-500">
        Số phần ăn mỗi lượt = làm tròn lên (tổng điểm sức chứa của lứa / điểm mỗi phần).
      </span>
      <span v-if="field.key === 'quality_gain' && qualityPercent !== null" class="font-normal text-gray-500">
        Tăng {{ qualityPercent }}% chất lượng mỗi lượt cho ăn.
      </span>
    </label>

    <div v-if="selectedItem?.isDisabled" role="status"
      class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Vật phẩm này đang tắt. Tên, giá và trạng thái vật phẩm được quản lý tại mục Vật phẩm.
    </div>
  </div>
</template>
