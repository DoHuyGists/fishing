<script lang="ts" setup>
import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
function showInformation() {
    open({
        name: 'Tiền',
        image: '/currency/cash.svg',
        description: 'Tiền dùng để mua vật phẩm và trang bị trong cửa hàng. Hãy tích lũy tiền để chuẩn bị cho những chuyến câu tiếp theo.',
    });
}


const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 30
})

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString("vi-VN") : 0)

</script>
<template>
    <button type="button" class="flex gap-2 items-center bg-white rounded-full px-2 cursor-pointer" aria-label="Thông tin về tiền" @click.stop="showInformation">
        <div v-if="props.amount != undefined">{{ fmtPrice }}</div>
        <img src="/currency/cash.svg" :width="props.size" alt="Cash" draggable="false">
    </button>
</template>
