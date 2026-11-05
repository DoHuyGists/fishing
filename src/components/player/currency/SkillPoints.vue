<script lang="ts" setup>
import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
function showInformation() {
    open({
        name: 'Điểm kỹ năng',
        image: '/currency/skill-points.svg',
        description: 'Điểm kỹ năng dùng để nâng cấp các kỹ năng của người chơi. Hãy mở mục Kỹ năng để chọn kỹ năng muốn nâng cấp.',
    });
}


const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 25
})

const formattedAmount = computed(() => Number(props.amount ?? 0).toLocaleString("vi-VN"))

</script>
<template>
    <button type="button" class="flex gap-2 items-center bg-white rounded-full px-2 cursor-pointer" aria-label="Thông tin về điểm kỹ năng" @click.stop="showInformation">
        <div v-if="props.amount != undefined">{{ formattedAmount }}</div>
        <img src="/currency/skill-points.svg" :width="props.size" alt="Điểm kỹ năng" draggable="false">
    </button>
</template>
