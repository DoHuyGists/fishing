<script lang="ts" setup>
import { computed} from "vue";

import { useCaughtStore } from "../../../stores/caught.ts";

const caughtStore = useCaughtStore();

const recentCaughtFishes = computed(() => caughtStore.inNetFishes);

</script>
<template>
  <section class="mt-3 w-full max-w-sm rounded-xl border border-emerald-900/15 bg-white/95 p-3 shadow-sm">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-sm font-bold text-[#153221]">Cá trong lưới</h2>
      <span class="text-[11px] text-gray-500">{{ recentCaughtFishes.length }} cá</span>
    </div>
    <p
      v-if="caughtStore.isLoadingCaught && !recentCaughtFishes.length"
      class="m-0 py-3 text-center text-xs text-gray-500"``
    >
      Đang tải danh sách cá...
    </p>
    <p v-else-if="!recentCaughtFishes.length" class="m-0 py-3 text-center text-xs text-gray-500">
      Chưa câu được cá nào
    </p>
    <ul v-else class="m-0 max-h-[min(55vh,520px)] list-none space-y-2 overflow-y-auto p-0">
      <li
        v-for="(fish, index) in recentCaughtFishes"
        :key="fish.id"
        class="flex min-w-0 items-center gap-2 rounded-lg bg-emerald-50/70 p-2"
      >
        <img
          :src="fish.species?.image || '/fish/VN/fish.jpg'"
          :alt="fish.species?.name || 'Cá'"
          class="h-10 w-1/3 shrink-0 rounded-md object-cover"
          draggable="false"
        />
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate text-xs font-bold text-gray-800">{{ fish.species?.name || "Cá chưa rõ tên" }}</p>
          <p class="m-0 text-[10px] text-gray-500">
            {{ fish.species?.rarity || "Thường" }} ·
            {{ fish.created_at ? new Date(fish.created_at).toLocaleDateString("vi-VN") : "" }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>
