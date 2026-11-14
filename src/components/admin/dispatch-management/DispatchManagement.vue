<script setup lang="ts">
import { onMounted } from 'vue';
import AdminCrudScreen, { type CrudColumn, type CrudField } from '../AdminCrudScreen.vue';
import type { DispatchCatalogKind } from '../../../types/table/dispatch';
import { useAdminDispatchJobStore, useAdminDispatchNpcStore } from './admin-dispatch-store';
const props = defineProps<{ kind: DispatchCatalogKind }>();
const emit = defineEmits<{ close: [] }>();
const isNpc = props.kind === 'npcs';
const store = isNpc ? useAdminDispatchNpcStore() : useAdminDispatchJobStore();
onMounted(() => { void store.fetchAll(); });
const columns: CrudColumn[] = [
  { key: 'code', label: 'Mã' },
  { key: 'name', label: 'Tên', format: row => row.name.vi },
  { key: 'enabled', label: 'Trạng thái', format: row => row.enabled ? 'Đang mở' : 'Đã tắt' },
  ...(isNpc ? [{ key: 'purchase_shells', label: 'Giá mua (sò)' }, { key: 'operating_cash', label: 'Phí mỗi lượt (tiền)' }]
    : [{ key: 'duration_seconds', label: 'Thời lượng (giây)' }, { key: 'rewards', label: 'Thưởng', format: (row: any) => JSON.stringify(row.rewards) }]),
];
const fields: CrudField[] = [
  { key: 'code', label: 'Mã duy nhất (chữ thường, số, _ hoặc -)', type: 'text', required: true },
  { key: 'name', label: 'Tên song ngữ: {"vi":"Thủy thủ","en":"Sailor"}', type: 'json', required: true },
  { key: 'description', label: 'Mô tả song ngữ: {"vi":"…","en":"…"}', type: 'json' },
  { key: 'image_path', label: 'Đường dẫn ảnh', type: 'text' },
  { key: 'enabled', label: 'Cho phép mua/giao việc mới', type: 'select', defaultValue: false, options: [{ value: 'false', label: 'Tắt' }, { value: 'true', label: 'Bật' }] },
  { key: 'sort_order', label: 'Thứ tự', type: 'number', required: true, step: 1, defaultValue: 0 },
  ...(isNpc ? [
    { key: 'purchase_shells', label: 'Giá mua (sò)', type: 'number', required: true, min: 0, max: 1000000000, step: 1 },
    { key: 'operating_cash', label: 'Phí vận hành mỗi lượt (tiền)', type: 'number', required: true, min: 0, max: 1000000000, step: 1 },
    { key: 'data', label: 'Chỉ số: {"stats":{"strength":10,"navigation":5}}', type: 'json', required: true },
  ] as CrudField[] : [
    { key: 'duration_seconds', label: 'Thời lượng (60–2592000 giây)', type: 'number', required: true, min: 60, max: 2592000, step: 1 },
    { key: 'data', label: 'Đối kháng: {"requirements":{"strength":5}}', type: 'json', required: true },
    { key: 'rewards', label: 'Thưởng tiền/sò/vé: {"cash":100,"shells":1,"tickets":0}', type: 'json', required: true },
  ] as CrudField[]),
];
</script>

<template>
  <AdminCrudScreen :title="isNpc ? 'Quản lý NPC giao việc' : 'Quản lý công việc NPC'" icon="🧭"
    subtitle="Tìm kiếm theo mã. NPC phải đạt mọi chỉ số yêu cầu. Tắt cấu hình để ngừng lượt mới; lượt đã chạy giữ nguyên thông số và phần thưởng. Không xóa cấu hình đã có lịch sử."
    :columns="columns" :fields="fields" :items="store.items" :page="store.page" :page-size="store.pageSize" :total="store.total"
    :loading="store.loading" :error="store.error" :save="store.save" :remove="store.remove"
    @page="store.fetchAll" @refresh="store.fetchAll()" @close="emit('close')" />
</template>
