<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useFishingAreaStore } from '../../stores/fishingArea';
import { useWorldStore } from '../../stores/world';
const fishingAreaStore = useFishingAreaStore();
const anchors = computed(() => fishingAreaStore.areas);
const worldStore = useWorldStore();
onMounted(() => {
  fishingAreaStore.fetchArea();
});
</script>
<template>
  <aside
    class="map-sidebar w-60 flex-none h-full p-4 border-[1px] border-gray-300 rounded-xl bg-white text-[#263238] flex flex-col overflow-hidden">
    <div class="flex items-center justify-between">
      <h2 class="m-0 text-lg font-bold">Bản đồ</h2>
    </div>
    <div class="mt-5 flex-1 overflow-y-auto">
      <div class="flex items-center justify-between text-[13px] font-bold">
        <span>Danh sách bãi câu</span>
      </div>
      <p v-if="!anchors.length" class="mt-[3px] mb-0 text-[#607176] text-xs">Chưa có điểm neo</p>
      <ul v-else class="grid gap-2 p-0 mt-3 mb-0 list-none">
        <li v-for="(anchor, index) in anchors" :key="anchor.id" class="flex items-center gap-2 min-w-0">
          <span
            class="grid place-items-center w-6 h-6 rounded-full bg-[#d84315] text-white text-xs font-bold flex-shrink-0">{{
              index + 1
            }}</span>
          <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
            <button @click="worldStore.handleMoveToArea(anchor)" type="button"
              class="cursor-pointer font-medium hover:underline text-left w-full truncate">{{ anchor.title }}</button>
          </span>
        </li>
      </ul>
    </div>
  </aside>
</template>