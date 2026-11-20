<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
function showInformation() {
    open({
        get name() { return tr('Shells.vo_so'); },
        image: '/currency/shells.svg',
        get description() { return tr('Shells.vo_so_la_mot_loai_tien_te_trong_tro_choi_dung_de_mua_fishing_pas'); },
    });
}


const props = withDefaults(defineProps<{
    amount?: number | string,
    interactive?: boolean,
}>(), {
    interactive: true,
})

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString(getFormattingLocale()) : 0)

</script>
<template>
    <component :is="props.interactive ? 'button' : 'span'" :type="props.interactive ? 'button' : undefined" class="ocean-currency-chip inline-flex gap-2 items-center bg-white rounded-full px-3 py-1 w-fit h-fit" :class="{ 'cursor-pointer': props.interactive }" :aria-label="props.interactive ? tr('Shells.thong_tin_ve_vo_so') : undefined" @click.stop="props.interactive && showInformation()">
        <span v-if="props.amount != undefined">{{ fmtPrice }}</span>
        <img src="/currency/shells.svg" class="w-4 sm:w-6" :alt="tr('Shells.shell')" draggable="false">
    </component>
</template>
