<script lang="ts" setup>

const props = withDefaults(defineProps<{
    size?: number,
    amount?: number | string,
}>(), {
    size: 30
})

</script>
<template>
    <span class="flex gap-2 items-center">
        <template v-if="props.amount">
            {{ props.amount }}
        </template>
        <img src="/currency/cash.svg" :width="props.size" alt="Cash" draggable="false">
    </span>
</template>