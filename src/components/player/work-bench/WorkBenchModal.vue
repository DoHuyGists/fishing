<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { items } from "../../../data/items.ts";
import { blueprints, type Blueprint, type ItemCategory } from "../../../data/blueprints.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useInventoryStore } from "../../../stores/inventory.ts";
import type { UserInventory } from "../../../data/supabaseUserInventoryRepository.ts";

const GRID_SIZE = 3;
type Cell = ItemCategory | null;
type ViewMode = "list" | "grid" | "group";
type PaletteItem = { id: string; name: string; image: string | null; icon: string | null; category: ItemCategory };

const authStore = useAuthStore();
const inventoryStore = useInventoryStore();
const grid = ref<Cell[]>(Array<Cell>(GRID_SIZE * GRID_SIZE).fill(null));
const selected = ref<ItemCategory | null>(null);
const crafted = ref<{ name: string; category: ItemCategory; quantity: number }[]>([]);
const searchQuery = ref("");
const viewMode = ref<ViewMode>("grid");
const itemLoadError = ref("");
const isLoadingInventory = ref(false);
const categoryByKey = new Map(items.map(({ category }) => [category.trim().toLocaleLowerCase(), category]));
const paletteItems = computed<PaletteItem[]>(() =>
  inventoryStore.items.flatMap((inventoryItem: UserInventory) => {
    const data = inventoryItem.data;
    const category = categoryByKey.get(String(data?.category ?? "").trim().toLocaleLowerCase());
    if (!category) return [];
    return [{
      id: inventoryItem.id,
      category,
      name: typeof data?.name === "string" ? data.name : "Vật phẩm không tên",
      image: typeof data?.image === "string" ? data.image : null,
      icon: typeof data?.icon === "string" ? data.icon : null,
    }];
  }),
);
const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return paletteItems.value.filter(({ name, category }) =>
    `${name} ${category}`.toLocaleLowerCase().includes(query),
  );
});
const groupedItems = computed(() => {
  const groups = new Map<ItemCategory, PaletteItem[]>();
  filteredItems.value.forEach((entry) => {
    const group = groups.get(entry.category);
    if (group) group.push(entry);
    else groups.set(entry.category, [entry]);
  });
  return Array.from(groups, ([category, categoryItems]) => ({ category, items: categoryItems }));
});
const displayItemByCategory = computed(() => {
  const byCategory = new Map<ItemCategory, PaletteItem>();
  paletteItems.value.forEach((item) => {
    if (!byCategory.has(item.category)) byCategory.set(item.category, item);
  });
  return byCategory;
});

onMounted(async () => {
  itemLoadError.value = "";
  if (!authStore.userId) {
    itemLoadError.value = "Bạn cần đăng nhập để xem vật phẩm trong túi.";
    return;
  }
  isLoadingInventory.value = true;
  try {
    await inventoryStore.setUserInventory(authStore.userId);
  } catch (error) {
    itemLoadError.value = error instanceof Error ? error.message : "Không thể tải vật phẩm trong túi.";
  } finally {
    isLoadingInventory.value = false;
  }
});

// Cắt phần viền trống để so khớp hình dạng bất kể vị trí đặt trong lưới.
function normalize(rows: Cell[][]): Cell[][] {
  const filledRows = rows.map((r, i) => (r.some(Boolean) ? i : -1)).filter((i) => i >= 0);
  if (!filledRows.length) return [];
  const cols = rows.flatMap((r) => r.map((c, i) => (c ? i : -1))).filter((i) => i >= 0);
  const [r0, r1] = [Math.min(...filledRows), Math.max(...filledRows)];
  const [c0, c1] = [Math.min(...cols), Math.max(...cols)];
  return rows.slice(r0, r1 + 1).map((r) => r.slice(c0, c1 + 1));
}

function sameShape(a: Cell[][], b: Cell[][]) {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length && row.every((c, j) => c === b[i][j]));
}

const gridRows = computed<Cell[][]>(() =>
  Array.from({ length: GRID_SIZE }, (_, r) => grid.value.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE)),
);

const matched = computed<Blueprint | null>(() => {
  const current = normalize(gridRows.value);
  if (!current.length) return null;
  return blueprints.find((bp) => sameShape(normalize(bp.pattern), current)) ?? null;
});

const hasIngredients = computed(() => grid.value.some(Boolean));

function placeCell(index: number) {
  grid.value[index] = selected.value && grid.value[index] !== selected.value ? selected.value : null;
}

function clearCell(index: number) {
  grid.value[index] = null;
}

function clearGrid() {
  grid.value = Array<Cell>(GRID_SIZE * GRID_SIZE).fill(null);
}

function fillBlueprint(bp: Blueprint) {
  const next = Array<Cell>(GRID_SIZE * GRID_SIZE).fill(null);
  bp.pattern.forEach((row, r) => row.forEach((c, i) => (next[r * GRID_SIZE + i] = c)));
  grid.value = next;
}

function craft() {
  const bp = matched.value;
  if (!bp) return;
  const existing = crafted.value.find((c) => c.name === bp.result.name);
  if (existing) existing.quantity += bp.result.quantity;
  else crafted.value.push({ ...bp.result });
  clearGrid();
}

const guideSteps = [
  { target: "#workbench-palette", title: "Nguyên liệu", description: "Chọn loại vật phẩm để đặt vào bàn chế tạo." },
  { target: "#workbench-grid", title: "Bàn chế tạo", description: "Bấm vào ô để đặt nguyên liệu, chuột phải để xoá." },
  { target: "#workbench-result", title: "Kết quả", description: "Khi ghép đúng bản vẽ, vật phẩm mới sẽ xuất hiện." },
];
</script>

<template>
  <Modal title="Bàn chế tạo" sub-title="Work bench" :guid-steps="guideSteps">
    <section
      class="mx-auto grid w-full max-w-7xl grid-cols-1 items-stretch gap-4 text-[#24352a] lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,1.25fr)_minmax(0,1.1fr)]"
    >
      <div id="workbench-palette" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-bold">Nguyên liệu</h3>
          <div class="flex rounded-lg border border-[#cbd9c6] bg-white p-0.5" role="group" aria-label="Chế độ hiển thị">
            <button
              v-for="mode in [
                { value: 'list', label: 'Danh sách' },
                { value: 'grid', label: 'Lưới' },
                { value: 'group', label: 'Nhóm' },
              ] as const"
              :key="mode.value"
              type="button"
              class="rounded-md px-2 py-1 text-[11px] font-bold transition"
              :class="viewMode === mode.value ? 'bg-emerald-700 text-white' : 'text-[#24352a] hover:bg-[#e7ecda]'"
              :aria-pressed="viewMode === mode.value"
              @click="viewMode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>
        <label class="mb-3 block">
          <span class="sr-only">Tìm nguyên liệu</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Tìm theo tên hoặc loại vật phẩm..."
            class="w-full rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-xs outline-none focus:border-emerald-700"
          />
        </label>

        <p v-if="itemLoadError" class="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          Không thể tải vật phẩm: {{ itemLoadError }}
        </p>
        <p v-if="isLoadingInventory" class="py-6 text-center text-xs opacity-60">Đang tải vật phẩm trong túi...</p>
        <div
          v-else-if="viewMode === 'group'"
          class="flex max-h-[min(60vh,40rem)] flex-col gap-3 overflow-y-auto pr-1"
        >
          <section v-for="group in groupedItems" :key="group.category">
            <h4 class="mb-1 text-xs font-bold text-[#24352a]">{{ group.category }}</h4>
            <div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
              <button
                v-for="entry in group.items"
                :key="entry.id"
                type="button"
                class="flex min-h-28 min-w-0 flex-col items-center justify-center gap-2 rounded-md border bg-white p-2 text-center transition"
                :class="
                  selected === entry.category
                    ? 'border-emerald-700 bg-emerald-100'
                    : 'border-[#cbd9c6] hover:bg-[#e7ecda]'
                "
                @click="selected = selected === entry.category ? null : entry.category"
              >
                <span class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f9f0] text-2xl">
                  <img
                    v-if="entry.image"
                    :src="entry.image"
                    :alt="entry.name"
                    class="h-full w-full object-contain p-1.5"
                  />
                  <span v-else>{{ entry.icon || entry.name.charAt(0) }}</span>
                </span>
                <span class="min-w-0 max-w-full">
                  <span class="line-clamp-2 text-xs font-bold" :title="entry.name">{{ entry.name }}</span>
                  <span class="block truncate text-[10px] opacity-60">{{ entry.category }}</span>
                </span>
              </button>
            </div>
          </section>
          <p v-if="!groupedItems.length" class="py-4 text-center text-xs opacity-60">
            Không tìm thấy vật phẩm phù hợp.
          </p>
        </div>
        <div
          v-else
          class="max-h-[min(60vh,40rem)] gap-2 overflow-y-auto pr-1"
          :class="viewMode === 'grid' ? 'grid grid-cols-2 xl:grid-cols-3' : 'flex flex-col'"
        >
          <button
            v-for="entry in filteredItems"
            :key="entry.id"
            type="button"
            class="flex min-w-0 gap-2 rounded-md border bg-white p-2 transition"
            :class="
              [
                selected === entry.category
                  ? 'border-emerald-700 bg-emerald-100'
                  : 'border-[#cbd9c6] hover:bg-[#e7ecda]',
                viewMode === 'grid' ? 'min-h-28 flex-col items-center justify-center text-center' : 'items-center text-left',
              ]
            "
            @click="selected = selected === entry.category ? null : entry.category"
          >
            <span
              class="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f9f0] text-2xl"
              :class="viewMode === 'grid' ? 'size-16' : 'size-12'"
            >
              <img
                v-if="entry.image"
                :src="entry.image"
                :alt="entry.name"
                class="h-full w-full object-contain p-1.5"
              />
              <span v-else>{{ entry.icon || entry.name.charAt(0) }}</span>
            </span>
            <span :class="viewMode === 'grid' ? 'min-w-0 max-w-full' : 'min-w-0'">
              <span
                class="text-xs font-bold"
                :class="viewMode === 'grid' ? 'line-clamp-2' : 'block truncate'"
                :title="entry.name"
              >{{ entry.name }}</span>
              <span class="block truncate text-[10px] opacity-60">{{ entry.category }}</span>
            </span>
          </button>
          <p v-if="!filteredItems.length" class="col-span-full py-4 text-center text-xs opacity-60">
            Không tìm thấy vật phẩm phù hợp.
          </p>
        </div>
      </div>

      <div class="flex flex-col items-center gap-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
        <div class="flex items-center gap-4">
          <div id="workbench-grid" class="grid grid-cols-3 gap-2">
            <button
              v-for="(cell, index) in grid"
              :key="index"
              type="button"
              class="flex h-20 w-20 items-center justify-center rounded-lg border border-[#cbd9c6] bg-white p-1.5 text-center text-[11px] font-bold leading-tight hover:bg-[#e7ecda]"
              @click="placeCell(index)"
              @contextmenu.prevent="clearCell(index)"
            >
              <template v-if="cell && displayItemByCategory.get(cell)">
                <span class="flex h-full min-w-0 flex-col items-center justify-center gap-0.5">
                  <img
                    v-if="displayItemByCategory.get(cell)?.image"
                    :src="displayItemByCategory.get(cell)?.image ?? undefined"
                    :alt="displayItemByCategory.get(cell)?.name ?? cell"
                    class="h-12 w-12 object-contain"
                  />
                  <span v-else class="grid h-12 w-12 place-items-center text-xl">
                    {{ displayItemByCategory.get(cell)?.icon || displayItemByCategory.get(cell)?.name.charAt(0) }}
                  </span>
                  <span class="max-w-full truncate text-[9px] leading-tight">
                    {{ displayItemByCategory.get(cell)?.name }}
                  </span>
                </span>
              </template>
              <span v-else>{{ cell }}</span>
            </button>
          </div>
          <span class="text-2xl font-bold" aria-hidden="true">→</span>
          <div
            id="workbench-result"
            class="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[#cbd9c6] bg-white p-2 text-center text-xs font-bold"
          >
            <template v-if="matched">{{ matched.result.name }} ×{{ matched.result.quantity }}</template>
            <span v-else class="opacity-40">?</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!matched"
            @click="craft"
          >
            Chế tạo
          </button>
          <button
            type="button"
            class="rounded-md border border-[#cbd9c6] bg-white px-4 py-2 text-sm font-bold hover:bg-[#e7ecda] disabled:opacity-50"
            :disabled="!hasIngredients"
            @click="clearGrid"
          >
            Xoá bàn
          </button>
        </div>
        <p class="text-xs opacity-70">
          {{ matched ? `Khớp bản vẽ: ${matched.name}` : hasIngredients ? "Chưa khớp bản vẽ nào" : "Đặt nguyên liệu vào bàn" }}
        </p>
      </div>

      <div class="flex flex-col gap-4">
        <div class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
          <h3 class="mb-2 text-sm font-bold">Bản vẽ</h3>
          <ul class="flex flex-col gap-1">
            <li v-for="bp in blueprints" :key="bp.id">
              <button
                type="button"
                class="w-full rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-left text-xs font-bold hover:bg-[#e7ecda]"
                @click="fillBlueprint(bp)"
              >
                {{ bp.name }}
              </button>
            </li>
          </ul>
        </div>
        <div class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
          <h3 class="mb-2 text-sm font-bold">Đã chế tạo</h3>
          <p v-if="!crafted.length" class="text-xs opacity-60">Chưa có vật phẩm nào.</p>
          <ul v-else class="flex flex-col gap-1 text-xs font-bold">
            <li v-for="c in crafted" :key="c.name">{{ c.name }} ×{{ c.quantity }}</li>
          </ul>
        </div>
      </div>
    </section>
  </Modal>
</template>
