<template>
    <div class="fixed inset-0 z-50 bg-black/40 p-4">
        <div class="bg-emerald-700 relative w-full h-full rounded-md flex items-center justify-center">
          <div class="flex gap-10">
            <ListItems/>
            <SpinWheel
            :rewards="rewards"
            @spin-end="onWin"
            :size="500"
          />
          </div>

          <button type="button"
            class="w-8 h- absolute top-10 right-10 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg flex items-center justify-center cursor-pointer transition-colors"
            @click="emit('close')">
            &times;
        </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSpinWheelStore } from '../../stores/spinWheel.ts';
import ListItems from './ListItems.vue';
import SpinWheel from './SpinWheel.vue'
import type { Reward } from './SpinWheel.vue'

const emit = defineEmits(["close"]);
const spinWheelStore = useSpinWheelStore();
const cost = ref(10)

const rewards: Reward[] = [
  {
    id: 1,
    value: 'rod',
    label: 'Cần câu',
    image: '',
    color: '#FF6B6B',
  },
  {
    id: 2,
    value: 'hook',
    label: 'Móc câu',
    image: '',
  },
  {
    id: 3,
    value: 'bait',
    label: 'Mồi câu',
    image: '',
  }
]

async function onWin(reward: Reward) {
  const item = await spinWheelStore.submitReward(reward, cost.value);
  console.log(item);
  
}
</script>