<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
function showInformation() {
    open({
        get name() { return tr('SkillPoints.diem_ky_nang'); },
        image: '/currency/skill-points.svg',
        get description() { return tr('SkillPoints.diem_ky_nang_dung_de_nang_cap_cac_ky_nang_cua_nguoi_choi_hay_mo_'); },
    });
}


const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 25
})

const formattedAmount = computed(() => Number(props.amount ?? 0).toLocaleString(getFormattingLocale()))

</script>
<template>
    <button type="button" class="flex gap-2 items-center bg-white rounded-full px-2 cursor-pointer" :aria-label="tr('SkillPoints.thong_tin_ve_diem_ky_nang')" @click.stop="showInformation">
        <div v-if="props.amount != undefined">{{ formattedAmount }}</div>
        <img src="/currency/skill-points.svg" :width="props.size" :alt="tr('SkillPoints.diem_ky_nang')" draggable="false">
    </button>
</template>
