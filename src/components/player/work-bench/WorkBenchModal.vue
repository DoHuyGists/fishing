<script lang="ts" setup>
import { computed, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { items } from "../../../data/items.ts";
import { blueprints, type Blueprint, type ItemCategory } from "../../../data/blueprints.ts";

const GRID_SIZE = 3;
type Cell = ItemCategory | null;

const grid = ref<Cell[]>(Array<Cell>(GRID_SIZE * GRID_SIZE).fill(null));
const selected = ref<ItemCategory | null>(null);
const crafted = ref<{ name: string; category: ItemCategory; quantity: number }[]>([]);

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
    <section class="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 text-[#24352a] lg:grid-cols-[1fr_auto_1fr]">
      <div id="workbench-palette" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
        <h3 class="mb-2 text-sm font-bold">Nguyên liệu</h3>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
          <button
            v-for="item in items"
            :key="item.category"
            type="button"
            class="rounded-md border px-2 py-2 text-xs font-bold transition"
            :class="
              selected === item.category
                ? 'border-emerald-700 bg-emerald-100'
                : 'border-[#cbd9c6] bg-white hover:bg-[#e7ecda]'
            "
            @click="selected = selected === item.category ? null : item.category"
          >
            {{ item.category }}
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center gap-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
        <div class="flex items-center gap-4">
          <div id="workbench-grid" class="grid grid-cols-3 gap-1">
            <button
              v-for="(cell, index) in grid"
              :key="index"
              type="button"
              class="flex h-16 w-16 items-center justify-center rounded border border-[#cbd9c6] bg-white p-1 text-center text-[11px] font-bold leading-tight hover:bg-[#e7ecda]"
              @click="placeCell(index)"
              @contextmenu.prevent="clearCell(index)"
            >
              {{ cell }}
            </button>
          </div>
          <span class="text-2xl font-bold" aria-hidden="true">→</span>
          <div
            id="workbench-result"
            class="flex h-20 w-20 items-center justify-center rounded border-2 border-[#cbd9c6] bg-white p-1 text-center text-xs font-bold"
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
