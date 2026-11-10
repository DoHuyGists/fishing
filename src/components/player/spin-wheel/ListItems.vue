<template>
  <section
    class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]"
  >
    <header class="border-b border-[#cbd9c6] px-4 py-0">
      <div class="py-3 text-sm font-semibold">
        Phần thưởng theo mùa · Nhấn vật phẩm để xem thông tin
      </div>
    </header>

    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-[#cbd9c6] p-3">
      <label
        class="flex min-w-0 items-center gap-2 rounded-lg border border-[#cbd9c6] bg-white/70 px-3 focus-within:border-emerald-700"
      >
        <svg
          class="h-4 w-4 shrink-0 text-[#617565]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Tìm vật phẩm..."
          aria-label="Tìm vật phẩm"
          class="h-10 w-full min-w-0 bg-transparent text-sm text-[#24352a] outline-none placeholder:text-[#718174]"
        />
      </label>
      <select
        v-model="selectedCategory"
        aria-label="Lọc theo loại vật phẩm"
        class="h-10 max-w-36 rounded-lg border border-[#cbd9c6] bg-white px-2 text-sm text-[#24352a] outline-none focus:border-emerald-700"
      >
        <option value="all">Tất cả loại</option>
        <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
      </select>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div
        v-if="spinWheelStore.loading"
        class="flex h-full min-h-32 items-center justify-center gap-3 text-sm text-[#526a58]"
        role="status"
      >
        <span class="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700/25 border-t-emerald-700" />
        Đang tải vật phẩm...
      </div>
      <div v-else-if="spinWheelStore.error" class="flex h-full min-h-32 flex-col items-center justify-center gap-3 text-center">
        <div class="text-sm text-rose-700">{{ spinWheelStore.error }}</div>
        <button
          type="button"
          class="text-sm font-semibold text-emerald-800 hover:text-emerald-900"
          @click="spinWheelStore.setReward()"
        >
          Thử tải lại
        </button>
      </div>
      <div
        v-else-if="visibleRewards.length === 0"
        class="flex h-full min-h-32 items-center justify-center px-4 text-center text-sm text-[#617565]"
      >
        {{ spinWheelStore.season ? 'Không tìm thấy vật phẩm phù hợp.' : 'Chưa có mùa quay đang diễn ra.' }}
      </div>
      <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
          v-for="item in visibleRewards"
          :key="item.id"
          type="button"
          class="group cursor-pointer relative flex flex-col items-center gap-1 rounded-lg border border-[#cbd9c6] bg-white/70 px-2 py-2 text-center transition-colors hover:border-emerald-300 hover:bg-[#eaf2e5]"
          :aria-label="`Thông tin về ${item.label}`"
          @click="showInformation(item)"
        >
          <img v-if="item.image" :src="item.image" :alt="''" class="h-10 w-10 shrink-0 object-contain" />
          <span
            v-else
            class="flex h-10 w-10 shrink-0 items-center justify-center text-lg text-emerald-700"
            aria-hidden="true"
            >✦</span
          >
          <span class="line-clamp-2 min-h-8 w-full text-xs font-medium leading-tight">{{ item.label }}</span>
        </button>
      </div>
    </div>

    <footer class="flex items-center justify-between border-t border-[#cbd9c6] px-5 py-3 text-xs text-[#617565]">
      <span>{{ visibleRewards.length }} vật phẩm</span>
      <span>{{ spinWheelStore.season?.name }}</span>
    </footer>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useSpinWheelStore } from "../../../stores/spinWheel.ts";
import type { Reward } from "./SpinWheel.vue";
import { useInformationModal } from "../../../composables/useInformationModal";

const spinWheelStore = useSpinWheelStore();
const searchQuery = ref("");
const selectedCategory = ref("all");
const { open } = useInformationModal();

const categories = computed(() => [...new Set(spinWheelStore.rewardList.map((item) => String(item.value)))].sort());
const visibleRewards = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return spinWheelStore.rewardList.filter((item) => {
    const matchesQuery = item.label.toLocaleLowerCase().includes(query);
    const matchesCategory = selectedCategory.value === "all" || String(item.value) === selectedCategory.value;
    return matchesQuery && matchesCategory;
  });
});
function showInformation(item: Reward) {
  open({
    name: item.label,
    image: item.image ?? "",
    description: item.information || "Chưa có thông tin về vật phẩm này.",
  });
}

onMounted(() => spinWheelStore.setReward());
</script>
