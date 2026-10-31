<template>
  <section
    class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]"
  >
    <header class="border-b border-[#cbd9c6] px-4 py-0">
      <div class="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          class="shrink-0 text-sm font-semibold text-emerald-800 transition-colors hover:text-emerald-900 disabled:cursor-not-allowed disabled:text-[#87958a]"
          :disabled="visibleRewards.length === 0"
          @click="toggleVisibleRewards"
        >
          {{ allVisibleSelected ? "Bỏ chọn kết quả" : "Chọn tất cả" }}
        </button>
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
        v-if="loading"
        class="flex h-full min-h-32 items-center justify-center gap-3 text-sm text-[#526a58]"
        role="status"
      >
        <span class="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700/25 border-t-emerald-700" />
        Đang tải vật phẩm...
      </div>
      <div v-else-if="loadError" class="flex h-full min-h-32 flex-col items-center justify-center gap-3 text-center">
        <p class="text-sm text-rose-700">Không tải được danh sách vật phẩm.</p>
        <button
          type="button"
          class="text-sm font-semibold text-emerald-800 hover:text-emerald-900"
          @click="loadRewards"
        >
          Thử tải lại
        </button>
      </div>
      <div
        v-else-if="visibleRewards.length === 0"
        class="flex h-full min-h-32 items-center justify-center px-4 text-center text-sm text-[#617565]"
      >
        Không tìm thấy vật phẩm phù hợp.
      </div>
      <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
          v-for="item in visibleRewards"
          :key="item.id"
          type="button"
          class="group cursor-pointer relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors"
          :class="
            isSelected(item)
              ? 'border-emerald-600 bg-emerald-100'
              : 'border-[#cbd9c6] bg-white/70 hover:border-emerald-300 hover:bg-[#eaf2e5]'
          "
          @click="toggleReward(item)"
        >
          <span
            v-if="isSelected(item)"
            class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white"
            aria-hidden="true"
            >✓</span
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
      <div class="flex gap-2 items-center">
        <span class="shrink-0 rounded-full border border-[#cbd9c6] bg-[#eaf2e5] px-3 py-1 text-xs font-semibold text-emerald-800">
          {{ spinWheelStore.selectedReward.length }} đã chọn
        </span>
        <span :class="spinWheelStore.selectedReward.length >= 4 ? 'text-emerald-700' : 'text-amber-800'">
          {{
            spinWheelStore.selectedReward.length >= 4
              ? "Sẵn sàng quay"
              : `Còn ${4 - spinWheelStore.selectedReward.length} món nữa`
          }}
        </span>
      </div>
    </footer>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useSpinWheelStore } from "../../../stores/spinWheel.ts";
import type { Reward } from "./SpinWheel.vue";

const spinWheelStore = useSpinWheelStore();
const searchQuery = ref("");
const selectedCategory = ref("all");
const loading = ref(false);
const loadError = ref(false);

const categories = computed(() => [...new Set(spinWheelStore.rewardList.map((item) => String(item.value)))].sort());
const visibleRewards = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return spinWheelStore.rewardList.filter((item) => {
    const matchesQuery = item.label.toLocaleLowerCase().includes(query);
    const matchesCategory = selectedCategory.value === "all" || String(item.value) === selectedCategory.value;
    return matchesQuery && matchesCategory;
  });
});
const allVisibleSelected = computed(
  () => visibleRewards.value.length > 0 && visibleRewards.value.every((item) => isSelected(item)),
);

function isSelected(item: Reward) {
  return spinWheelStore.selectedReward.some((selected) => selected.id === item.id);
}

function toggleReward(item: Reward) {
  if (isSelected(item)) {
    spinWheelStore.selectedReward = spinWheelStore.selectedReward.filter((selected) => selected.id !== item.id);
  } else {
    spinWheelStore.selectedReward = [...spinWheelStore.selectedReward, item];
  }
}

function toggleVisibleRewards() {
  if (allVisibleSelected.value) {
    const visibleIds = new Set(visibleRewards.value.map((item) => item.id));
    spinWheelStore.selectedReward = spinWheelStore.selectedReward.filter((item) => !visibleIds.has(item.id));
    return;
  }

  const selectedIds = new Set(spinWheelStore.selectedReward.map((item) => item.id));
  spinWheelStore.selectedReward = [
    ...spinWheelStore.selectedReward,
    ...visibleRewards.value.filter((item) => !selectedIds.has(item.id)),
  ];
}

async function loadRewards() {
  loading.value = true;
  loadError.value = false;
  try {
    await spinWheelStore.setReward();
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(loadRewards);
</script>
