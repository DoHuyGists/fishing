<script lang="ts" setup>
import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
function showInformation() {
    open({
        name: 'Vỏ sò',
        image: '/currency/shells.svg',
        description: 'Vỏ sò là một loại tiền tệ trong trò chơi, dùng để mua Fishing Pass. Fishing Pass mở thêm các phần thưởng trong mùa điểm danh; hãy kiểm tra số vỏ sò cần dùng trước khi mua.',
    });
}


const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 25
})

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString("vi-VN") : 0)

</script>
<template>
    <button type="button" class="flex gap-2 items-center bg-white rounded-full px-2 cursor-pointer" aria-label="Thông tin về vỏ sò" @click.stop="showInformation">
        <div v-if="props.amount != undefined">{{ fmtPrice }}</div>
        <img src="/currency/shells.svg" :width="props.size" alt="Shell" draggable="false">
    </button>
</template>
