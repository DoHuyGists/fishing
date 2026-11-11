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
    size?: number,
    amount?: number | string,
}>(), {
    size: 25
})

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString(getFormattingLocale()) : 0)

</script>
<template>
    <button type="button" class="flex gap-2 items-center bg-white rounded-full px-2 cursor-pointer" :aria-label="tr('Shells.thong_tin_ve_vo_so')" @click.stop="showInformation">
        <div v-if="props.amount != undefined">{{ fmtPrice }}</div>
        <img src="/currency/shells.svg" :width="props.size" :alt="tr('Shells.shell')" draggable="false">
    </button>
</template>
