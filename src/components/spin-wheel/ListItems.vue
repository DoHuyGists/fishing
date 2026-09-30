<template>
    <section class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-950/80 text-white shadow-2xl">
        <header class="border-b border-white/10 px-4 py-3">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Vòng quay may mắn</p>
                    <h2 class="mt-1 text-lg font-bold">Chọn phần thưởng</h2>
                </div>
                <span class="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-emerald-200">
                    {{ spinWheelStore.selectedReward.length }} đã chọn
                </span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3">
                <p class="text-sm text-slate-300">Cần chọn ít nhất 4 món để quay</p>
                <button
                    type="button"
                    class="shrink-0 text-sm font-semibold text-emerald-300 transition-colors hover:text-emerald-100 disabled:cursor-not-allowed disabled:text-slate-500"
                    :disabled="visibleRewards.length === 0"
                    @click="toggleVisibleRewards"
                >
                    {{ allVisibleSelected ? 'Bỏ chọn kết quả' : 'Chọn tất cả' }}
                </button>
            </div>
        </header>

        <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-white/10 p-3">
            <label class="flex min-w-0 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 focus-within:border-emerald-300/70">
                <svg class="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                </svg>
                <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Tìm phần thưởng..."
                    aria-label="Tìm phần thưởng"
                    class="h-10 w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                >
            </label>
            <select
                v-model="selectedCategory"
                aria-label="Lọc theo loại phần thưởng"
                class="h-10 max-w-36 rounded-lg border border-white/15 bg-slate-900 px-2 text-sm text-white outline-none focus:border-emerald-300/70"
            >
                <option value="all">Tất cả loại</option>
                <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
            </select>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <div v-if="loading" class="flex h-full min-h-32 items-center justify-center gap-3 text-sm text-slate-300" role="status">
                <span class="h-5 w-5 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
                Đang tải phần thưởng...
            </div>
            <div v-else-if="loadError" class="flex h-full min-h-32 flex-col items-center justify-center gap-3 text-center">
                <p class="text-sm text-rose-200">Không tải được danh sách phần thưởng.</p>
                <button type="button" class="text-sm font-semibold text-emerald-300 hover:text-emerald-100" @click="loadRewards">
                    Thử tải lại
                </button>
            </div>
            <div v-else-if="visibleRewards.length === 0" class="flex h-full min-h-32 items-center justify-center px-4 text-center text-sm text-slate-400">
                Không tìm thấy phần thưởng phù hợp.
            </div>
            <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                <button
                    v-for="item in visibleRewards"
                    :key="item.id"
                    type="button"
                    class="group relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors"
                    :class="isSelected(item) ? 'border-emerald-400/80 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'"
                    @click="toggleReward(item)"
                >
                    <span
                        v-if="isSelected(item)"
                        class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-emerald-950"
                        aria-hidden="true"
                    >✓</span>
                    <img v-if="item.image" :src="item.image" :alt="''" class="h-10 w-10 shrink-0 object-contain">
                    <span v-else class="flex h-10 w-10 shrink-0 items-center justify-center text-lg text-emerald-200" aria-hidden="true">✦</span>
                    <span class="line-clamp-2 min-h-8 w-full text-xs font-medium leading-tight">{{ item.label }}</span>
                    <span class="max-w-full truncate rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{{ item.value }}</span>
                </button>
            </div>
        </div>

        <footer class="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-slate-400">
            <span>{{ visibleRewards.length }} phần thưởng hiển thị</span>
            <span :class="spinWheelStore.selectedReward.length >= 4 ? 'text-emerald-300' : 'text-amber-200'">
                {{ spinWheelStore.selectedReward.length >= 4 ? 'Sẵn sàng quay' : `Còn ${4 - spinWheelStore.selectedReward.length} món nữa` }}
            </span>
        </footer>
    </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useSpinWheelStore } from '../../stores/spinWheel';
import type { Reward } from './SpinWheel.vue';

const spinWheelStore = useSpinWheelStore();
const searchQuery = ref('');
const selectedCategory = ref('all');
const loading = ref(false);
const loadError = ref(false);

const categories = computed(() => [...new Set(spinWheelStore.rewardList.map((item) => String(item.value)))].sort());
const visibleRewards = computed(() => {
    const query = searchQuery.value.trim().toLocaleLowerCase();
    return spinWheelStore.rewardList.filter((item) => {
        const matchesQuery = item.label.toLocaleLowerCase().includes(query);
        const matchesCategory = selectedCategory.value === 'all' || String(item.value) === selectedCategory.value;
        return matchesQuery && matchesCategory;
    });
});
const allVisibleSelected = computed(() =>
    visibleRewards.value.length > 0 && visibleRewards.value.every((item) => isSelected(item)),
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