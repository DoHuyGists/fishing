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
    amount?: number | string,
    interactive?: boolean,
}>(), {
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
        class="ocean-currency-chip gap-2 items-center bg-white rounded-full px-3 py-1 w-fit h-fit"
        :class="props.interactive ? 'flex cursor-pointer' : 'inline-flex text-content'"
        :aria-label="props.interactive ? tr('Cash.thong_tin_ve_tien') : undefined"
        @click="handleClick"
    >
        <span v-if="props.amount != undefined">{{ fmtPrice }}</span>
        <img src="/currency/cash.svg" class="w-4 sm:w-6" :alt="tr('Cash.cash')" draggable="false">
    </component>
</template>
