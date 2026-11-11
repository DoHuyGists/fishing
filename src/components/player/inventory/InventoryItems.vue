<script lang="ts" setup>
import { computed } from "vue";
import { useInventoryTableContext } from "./useInventoryTable.ts";

defineEmits<{ "request-delete": [] }>();

const {
  LABELS,
  active,
  activeSetNumber,
  allOnPageSelected,
  hasRpc,
  inventoryStore,
  isCompatible,
  isInActiveSlot,
  itemName,
  itemPage,
  itemPages,
  itemSearch,
  pagedItems,
  pickItem,
  selected,
  toggleSelect,
  toggleSelectPage,
  useSelectedItem,
  usingItemId,
  viewMode,
} = useInventoryTableContext();

const categoryName = (category: string) => LABELS[category as keyof typeof LABELS] ?? category;
const groupedPagedItems = computed(() => {
  const groups = new Map<string, typeof pagedItems.value>();
  for (const item of pagedItems.value) {
    const category = item.data.category || "";
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }

  const categoryOrder = Object.keys(LABELS);
  return [...groups.entries()]
    .sort(([first], [second]) => {
      const firstOrder = categoryOrder.indexOf(first);
      const secondOrder = categoryOrder.indexOf(second);
      if (firstOrder !== -1 || secondOrder !== -1) {
        return (firstOrder === -1 ? categoryOrder.length : firstOrder) -
          (secondOrder === -1 ? categoryOrder.length : secondOrder);
      }
      return first.localeCompare(second, "vi");
    })
    .map(([category, items]) => ({ category, items }));
});
const displayedGroups = computed(() =>
  viewMode.value === "grouped" ? groupedPagedItems.value : [{ category: "", items: pagedItems.value }],
);
</script>

<template>
  <div id="user-inventory" class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
    <header class="space-y-3 border-b border-slate-200 p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="text-lg font-semibold">
          Kho đồ <span class="text-sm font-normal text-slate-500">({{ inventoryStore.items.length }})</span>
        </div>
        <div class="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm" role="group"
          aria-label="Kiểu hiển thị">
          <button type="button" :aria-pressed="viewMode === 'grid'"
            :class="['px-3 py-1', viewMode === 'grid' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
            @click="viewMode = 'grid'">
            Lưới
          </button>
          <button type="button" :aria-pressed="viewMode === 'list'"
            :class="['px-3 py-1', viewMode === 'list' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
            @click="viewMode = 'list'">
            Danh sách
          </button>
          <button type="button" :aria-pressed="viewMode === 'grouped'"
            :class="['px-3 py-1', viewMode === 'grouped' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
            @click="viewMode = 'grouped'">
            Nhóm loại
          </button>
        </div>
      </div>

      <input v-model="itemSearch" type="search" placeholder="Tìm theo tên hoặc loại vật phẩm"
        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />

      <div class="flex items-center justify-between text-sm">
        <label class="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" class="h-4 w-4 accent-teal-700" :checked="allOnPageSelected"
            @change="toggleSelectPage" />
          Chọn cả trang
        </label>
        <button type="button" :disabled="selected.size === 0"
          class="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          @click="$emit('request-delete')">
          Xóa đã chọn<span v-if="selected.size"> ({{ selected.size }})</span>
        </button>
        <button v-if="selected.size === 1 && hasRpc()" type="button" :disabled="!!usingItemId"
          class="rounded-md bg-teal-700 px-3 py-1 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          @click="useSelectedItem">
          {{ usingItemId ? "Đang sử dụng…" : "Sử dụng" }}
        </button>
      </div>

      <div v-if="active" class="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
        <span>
          Đang chọn ô <b>{{ LABELS[active.slot] }}</b> của Set {{ activeSetNumber }}. Bấm vật phẩm để thêm.
        </span>
        <button type="button" class="ml-2 underline" @click="active = null">Hủy</button>
      </div>
    </header>

    <div class="flex-1 p-4">
      <div v-if="pagedItems.length === 0" class="py-12 text-center text-sm text-slate-500">
        {{ inventoryStore.items.length === 0 ? "Kho đồ đang trống." : "Không có vật phẩm nào khớp với tìm kiếm." }}
      </div>

      <div v-for="group in displayedGroups" :key="group.category" class="mb-4 last:mb-0">
        <div v-if="viewMode === 'grouped'" class="mb-2 text-sm font-semibold text-slate-700">
          {{ categoryName(group.category) || "Khác" }}
          <span class="font-normal text-slate-500">({{ group.items.length }})</span>
        </div>
        <div :class="viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'">
        <div v-for="item in group.items" :key="item.id" :class="[
          'relative cursor-pointer rounded-md border bg-white transition',
          viewMode === 'list' ? 'flex items-center gap-3 px-3 py-2' : 'p-3',
          selected.has(item.id) ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-400',
          active && isCompatible(item) ? 'ring-2 ring-teal-400' : '',
          active && !isCompatible(item) ? 'opacity-40' : '',
        ]" @click="pickItem(item)">
          <input type="checkbox" class="h-4 w-4 accent-red-600"
            :class="viewMode !== 'list' ? 'absolute left-2 top-2' : 'shrink-0'" :checked="selected.has(item.id)"
            :aria-label="`Chọn ${itemName(item.data, item.id)} để xóa`" @click.stop
            @change="toggleSelect(item.id)" />

          <div :class="[
            'flex items-center justify-center overflow-hidden rounded bg-slate-100 text-slate-400',
            viewMode !== 'list' ? 'mx-auto mb-2 h-16 w-16' : 'h-10 w-10 shrink-0',
          ]">
            <img v-if="item.data.image" :src="item.data.image" :alt="itemName(item.data)"
              class="h-full w-full object-cover" />
            <span v-else class="text-lg font-semibold">
              {{ itemName(item.data, item.id).charAt(0).toUpperCase() }}
            </span>
          </div>

          <div :class="viewMode !== 'list' ? 'text-center' : 'min-w-0 flex-1'">
            <div class="truncate text-sm font-medium">{{ itemName(item.data, item.id) }}</div>
            <div class="truncate text-xs text-slate-500">{{ categoryName(item.data.category) }}</div>
          </div>

          <span v-if="isInActiveSlot(item)" class="text-xs font-medium text-teal-700"
            :class="viewMode !== 'list' ? 'mt-1 block text-center' : ''">
            Đã thêm
          </span>
        </div>
        </div>
      </div>
    </div>

    <footer v-if="itemPages > 1" class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
      <button type="button" :disabled="itemPage <= 1"
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        @click="itemPage--">
        Trước
      </button>
      <span class="text-slate-600">Trang {{ itemPage }} / {{ itemPages }}</span>
      <button type="button" :disabled="itemPage >= itemPages"
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        @click="itemPage++">
        Sau
      </button>
    </footer>
  </div>
</template>
