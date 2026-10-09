<script lang="ts" setup>
import InventoryTable from './InventoryTable.vue';
import Modal from '../Modal.vue';

const guildeSteps = [
  {
    target: '#user-inventory',
    title: 'Túi đồ',
    description: 'Đây là các vật phẩm bạn đang ở hữu',
  },
  {
    target: '#user-equipment-sets',
    title: 'Set trang bị',
    description: 'Đây là các set trang bị bạn cài đặt trước khi câu',
  },
  {
    target: '#set-0-slot-0',
    title: 'Slot trang bị',
    description: 'Đây là slot trang bị, mỗi slot sẽ chứa các vật phẩm cùng loại.',
  },
  {
    target: '#buy-set-button',
    title: 'Mua set',
    description: 'Có thể mua thêm set trang bị',
  },
]

</script>
<template>
    <Modal :guid-steps="guildeSteps">
        <InventoryTable />
    </Modal>
</template>
