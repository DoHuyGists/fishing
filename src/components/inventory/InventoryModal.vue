<script lang="ts" setup>
import InventoryTable from './InventoryTable.vue';

const emit = defineEmits(["close"]);


</script>
<template>
    <div class="fixed inset-0 z-50 bg-black/40 p-4">
        <div class="bg-emerald-700 relative w-full h-full rounded-md flex items-center justify-center">
            <InventoryTable />
            <button type="button"
                class="w-8 h-8 absolute -top-3 -right-3 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg flex items-center justify-center cursor-pointer transition-colors"
                @click="emit('close')">
                &times;
            </button>
        </div>
    </div>
</template>
