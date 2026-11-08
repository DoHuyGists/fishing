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
    interactive?: boolean,
}>(), {
    size: 30,
    interactive: true,
})

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString("vi-VN") : 0)
function handleClick(event: MouseEvent) {
    if (!props.interactive) return
    event.stopPropagation()
    showInformation()
}

</script>
<template>
    <component
        :is="props.interactive ? 'button' : 'span'"
        :type="props.interactive ? 'button' : undefined"
        class="gap-2 items-center bg-white rounded-full px-2"
        :class="props.interactive ? 'flex cursor-pointer' : 'inline-flex text-[#24352a]'"
        :aria-label="props.interactive ? 'Thông tin về tiền' : undefined"
        @click="handleClick"
    >
        <span v-if="props.amount != undefined">{{ fmtPrice }}</span>
        <img src="/currency/cash.svg" :width="props.size" alt="Cash" draggable="false">
    </component>
</template>
