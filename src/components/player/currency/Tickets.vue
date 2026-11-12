<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed } from 'vue';
import { useInformationModal } from '../../../composables/useInformationModal';

const { open } = useInformationModal();
const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
    interactive?: boolean,
}>(), {
    size: 25,
    interactive: true,
});

const formattedAmount = computed(() => props.amount != undefined ? props.amount.toLocaleString(getFormattingLocale()) : 0);

function showInformation() {
    open({
        get name() { return tr('Tickets.ve'); },
        image: '/currency/ticket.svg',
        get description() { return tr('Tickets.so_ve_hien_co_trong_tai_khoan_cua_ban'); },
    });
}
</script>

<template>
    <component :is="props.interactive ? 'button' : 'span'" :type="props.interactive ? 'button' : undefined" class="inline-flex gap-2 items-center bg-white rounded-full px-2" :class="{ 'cursor-pointer': props.interactive }" :aria-label="props.interactive ? tr('Tickets.thong_tin_ve_ve') : undefined" @click.stop="props.interactive && showInformation()">
        <span v-if="props.amount != undefined">{{ formattedAmount }}</span>
        <img src="/currency/ticket.svg" :width="props.size" :alt="tr('Tickets.ve')" draggable="false">
    </component>
</template>
