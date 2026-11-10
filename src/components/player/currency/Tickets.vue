<script lang="ts" setup>
import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 25,
});

const formattedAmount = computed(() => props.amount != undefined ? props.amount.toLocaleString('vi-VN') : 0);

function showInformation() {
    open({
        name: 'Vé',
        image: '/currency/ticket.svg',
        description: 'Số vé hiện có trong tài khoản của bạn.',
    });
}
</script>

<template>
    <button type="button" class="flex gap-2 items-center bg-white rounded-full px-2 cursor-pointer" aria-label="Thông tin về vé" @click.stop="showInformation">
        <span v-if="props.amount != undefined">{{ formattedAmount }}</span>
        <img src="/currency/ticket.svg" :width="props.size" alt="Vé" draggable="false">
    </button>
</template>
