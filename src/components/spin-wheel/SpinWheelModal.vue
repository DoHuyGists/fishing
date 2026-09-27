<template>
    <div class="fixed inset-0 z-50 bg-black/40 p-4">
        <div class="bg-emerald-700 relative w-full h-full rounded-md flex items-center justify-center">
            <SpinWheel
            :rewards="rewards"
            @spin-end="onWin"
            :size="500"
          />

          <button type="button"
            class="w-8 h- absolute top-10 right-10 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg flex items-center justify-center cursor-pointer transition-colors"
            @click="emit('close')">
            &times;
        </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import SpinWheel from './SpinWheel.vue'
import type { Reward } from './SpinWheel.vue'

const emit = defineEmits(["close"]);

const rewards: Reward[] = [
  {
    id: 1,
    value: '100.000đ',
    label: 'Voucher 100k',
    image: '',
    color: '#FF6B6B',
  },
  {
    id: 2,
    value: '50.000đ',
    label: 'Voucher 50k',
    image: '',
  },
  {
    id: 3,
    value: 'Áo thun',
    label: 'Áo thun',
    image: '',
  },
  {
    id: 4,
    value: 'Chúc may mắn',
    label: 'Chúc may mắn lần sau',
    image: '',
  },
  {
    id: 5,
    value: 'Chúc may mắn',
    label: 'Chúc may mắn lần sau',
    image: '',
  },
]

function onWin(reward: Reward) {
  console.log('Người dùng trúng:', reward)
}
</script>