<template>
    <div class="flex flex-col">
        <template v-for="item in spinWheelStore.rewardList">
            <div class="flex gap-2">
                <input type="checkbox" v-model="spinWheelStore.selectedReward" :value="item">
                <div>{{ item.label }}</div>
            </div>
        </template>
    </div>
</template>
<script lang="ts" setup>
import { onMounted } from 'vue';
import { useSpinWheelStore } from '../../stores/spinWheel';

const spinWheelStore = useSpinWheelStore()

onMounted(async()=>{
    await spinWheelStore.setReward();
})

</script>