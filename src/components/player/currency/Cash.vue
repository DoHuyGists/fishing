<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
function showInformation() {
    open({
        get name() { return tr('Cash.tien'); },
        image: '/currency/cash.svg',
        get description() { return tr('Cash.tien_dung_de_mua_vat_pham_va_trang_bi_trong_cua_hang_hay_tich_lu'); },
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

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString(getFormattingLocale()) : 0)
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
        :aria-label="props.interactive ? tr('Cash.thong_tin_ve_tien') : undefined"
        @click="handleClick"
    >
        <span v-if="props.amount != undefined">{{ fmtPrice }}</span>
        <img src="/currency/cash.svg" :width="props.size" :alt="tr('Cash.cash')" draggable="false">
    </component>
</template>
