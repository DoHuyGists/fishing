<script lang="ts" setup>
import { computed } from 'vue';


const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 30
})

const fmtPrice = computed(() => props.amount != undefined && props.amount != 0 ? props.amount.toLocaleString("vi-VN") : 0)

</script>
<template>
    <span class="flex gap-2 items-center">
        <div v-if="props.amount != undefined">{{ fmtPrice }}</div>
        <img src="/currency/cash.svg" :width="props.size" alt="Cash" draggable="false">
    </span>
</template>