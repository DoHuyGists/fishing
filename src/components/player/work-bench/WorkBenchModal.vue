<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { useAuthStore } from "../../../stores/auth";
import { useInventoryStore } from "../../../stores/inventory";
import { useBlueprintStore } from "../../../stores/blueprint";
import { useCurrencyStore } from "../../../stores/currency";
import type { UserInventory } from "../../../data/supabaseUserInventoryRepository";
import type { Blueprint } from "../../../data/supabaseBlueprintRepository";

type InventoryItem = { id: string; name: string; image: string | null; icon: string | null; quantity: number; itemId: string };
const authStore = useAuthStore();
const inventoryStore = useInventoryStore();
const blueprintStore = useBlueprintStore();
const currencyStore = useCurrencyStore();
const searchQuery = ref("");
const selectedBlueprintId = ref<string | null>(null);
const craftQuantity = ref(1);
const isLoading = ref(false);
const errorMessage = ref("");

const inventoryByItemId = computed(() => {
  const result = new Map<string, InventoryItem>();
  inventoryStore.items.forEach((row: UserInventory) => {
    const itemId = typeof row.data?.id === "string" ? row.data.id : null;
    if (!itemId) return;
    const previous = result.get(itemId);
    const count = Number(row.data?.quantity ?? 1);
    result.set(itemId, {
      id: row.id,
      itemId,
      name: typeof row.data?.name === "string" ? row.data.name : "Vật phẩm",
      image: typeof row.data?.image === "string" ? row.data.image : null,
      icon: typeof row.data?.icon === "string" ? row.data.icon : null,
      quantity: (previous?.quantity ?? 0) + (Number.isFinite(count) ? count : 1),
    });
  });
  return result;
});
const filteredInventory = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return [...inventoryByItemId.value.values()].filter((item) => item.name.toLocaleLowerCase().includes(query));
});
const selectedBlueprint = computed(() => blueprintStore.blueprints.find((bp) => bp.id === selectedBlueprintId.value) ?? null);
const resultItem = computed(() => selectedBlueprint.value ? blueprintStore.itemsById[selectedBlueprint.value.resultItemId] : null);
const materials = computed(() => (selectedBlueprint.value?.requiredMaterials ?? []).map((material) => ({
  ...material,
  item: blueprintStore.itemsById[material.item_id],
  required: material.quantity * craftQuantity.value,
  owned: inventoryByItemId.value.get(material.item_id)?.quantity ?? 0,
})));
const quantityValid = computed(() => Number.isSafeInteger(craftQuantity.value) && craftQuantity.value >= 1 && craftQuantity.value <= 1000);
const craftCost = computed(() => (selectedBlueprint.value?.goldCost ?? 0) * craftQuantity.value);
const canCraft = computed(() => Boolean(quantityValid.value && selectedBlueprint.value && Number.isFinite(craftCost.value) && craftCost.value >= 0 && !currencyStore.error && currencyStore.cash >= craftCost.value && materials.value.every((material) => material.owned >= material.required)));

async function craftSelectedBlueprint() {
  if (!selectedBlueprint.value || !canCraft.value || isLoading.value) return;

  isLoading.value = true;
  errorMessage.value = "";
  try {
    await blueprintStore.craft(selectedBlueprint.value.id, craftQuantity.value);
    if (authStore.userId) await inventoryStore.setUserInventory(authStore.userId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Không thể chế tạo vật phẩm.";
  } finally {
    isLoading.value = false;
  }
}

function selectBlueprint(blueprint: Blueprint) {
  selectedBlueprintId.value = blueprint.id;
  craftQuantity.value = 1;
}

async function loadData() {
  if (isLoading.value) return;
  isLoading.value = true;
  errorMessage.value = "";
  try {
    if (!authStore.userId) throw new Error("Bạn cần đăng nhập để xem bàn chế tạo.");
    await Promise.all([inventoryStore.setUserInventory(authStore.userId), blueprintStore.loadBlueprints(), currencyStore.fetchCurrency()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Không thể tải dữ liệu bàn chế tạo.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadData);

const guideSteps = [
  { target: "#workbench-palette", title: "Vật phẩm", description: "Danh sách vật phẩm hiện có trong túi." },
  { target: "#workbench-blueprints", title: "Bản vẽ", description: "Chọn bản vẽ để xem công thức chế tạo." },
  { target: "#workbench-recipe", title: "Công thức", description: "Điều chỉnh số lượng để tính nguyên liệu cần dùng." },
];
</script>

<template>
  <Modal title="Bàn chế tạo" sub-title="Work bench" :guid-steps="guideSteps" :on-refresh="loadData">
    <section class="grid min-h-full w-full grid-cols-1 gap-4 text-[#24352a] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.8fr)]">
      <aside id="workbench-palette" class="flex min-h-0 flex-col rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
        <div class="mb-3 text-sm font-bold">Vật phẩm trong túi</div>
        <input v-model="searchQuery" type="search" placeholder="Tìm vật phẩm..." class="mb-3 w-full rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-xs outline-none focus:border-emerald-700" />
        <p v-if="isLoading" class="py-6 text-center text-xs opacity-60">Đang tải dữ liệu...</p>
        <p v-else-if="errorMessage" class="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{{ errorMessage }}</p>
        <div v-else class="grid max-h-[min(65vh,44rem)] grid-cols-2 content-start gap-2 overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
          <div v-for="item in filteredInventory" :key="item.id" class="flex min-w-0 flex-col items-center gap-1 rounded-md border border-[#cbd9c6] bg-white p-2 text-center">
            <span class="grid size-14 place-items-center overflow-hidden rounded-lg bg-[#f5f9f0] text-xl">
              <img v-if="item.image" :src="item.image" :alt="item.name" class="h-full w-full object-contain p-1" />
              <span v-else>{{ item.icon || item.name.charAt(0) }}</span>
            </span>
            <span class="line-clamp-2 text-xs font-bold" :title="item.name">{{ item.name }}</span>
            <span class="text-[10px] opacity-70">×{{ item.quantity }}</span>
          </div>
          <p v-if="!filteredInventory.length" class="col-span-2 py-4 text-center text-xs opacity-60">Không có vật phẩm.</p>
        </div>
      </aside>

      <div class="grid min-h-0 min-w-0 gap-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
        <aside id="workbench-blueprints" class="flex min-h-0 flex-col rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
          <div class="mb-3 text-sm font-bold">Bản vẽ</div>
          <p v-if="blueprintStore.loading" class="py-4 text-center text-xs opacity-60">Đang tải bản vẽ...</p>
          <div v-else class="flex max-h-[min(65vh,44rem)] flex-col gap-2 overflow-y-auto lg:min-h-0 lg:max-h-none lg:flex-1">
            <div v-for="blueprint in blueprintStore.blueprints" :key="blueprint.id">
              <button type="button" class="flex w-full items-center gap-2 rounded-md border p-2 text-left transition" :class="selectedBlueprintId === blueprint.id ? 'border-emerald-700 bg-emerald-100' : 'border-[#cbd9c6] bg-white hover:bg-[#e7ecda]'" @click="selectBlueprint(blueprint)">
                <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded bg-[#f5f9f0] text-lg">
                  <img v-if="blueprintStore.itemsById[blueprint.resultItemId]?.image" :src="blueprintStore.itemsById[blueprint.resultItemId]?.image ?? undefined" :alt="blueprintStore.itemsById[blueprint.resultItemId]?.name ?? ''" class="h-full w-full object-contain p-1" />
                  <span v-else>{{ blueprintStore.itemsById[blueprint.resultItemId]?.icon || "?" }}</span>
                </span>
                <span class="min-w-0 truncate text-xs font-bold">{{ blueprintStore.itemsById[blueprint.resultItemId]?.name ?? "Bản vẽ" }}</span>
              </button>
            </div>
            <div v-if="!blueprintStore.blueprints.length" class="py-4 text-center text-xs opacity-60">Chưa có bản vẽ.</div>
          </div>
        </aside>

        <section id="workbench-recipe" class="min-h-72 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:min-h-0 lg:overflow-y-auto">
          <template v-if="selectedBlueprint">
            <div class="flex flex-col items-center border-b border-[#cbd9c6] pb-5 text-center">
              <span class="relative grid size-24 place-items-center rounded-xl border border-[#cbd9c6] bg-white text-3xl">
                <img v-if="resultItem?.image" :src="resultItem.image" :alt="resultItem.name" class="h-full w-full object-contain p-2" />
                <span v-else>{{ resultItem?.icon || resultItem?.name.charAt(0) }}</span>
                <span class="absolute -right-2 -top-2 rounded-full bg-emerald-700 px-2 py-1 text-xs font-bold text-white">×{{ selectedBlueprint.resultQuantity * craftQuantity }}</span>
              </span>
              <h3 class="mt-2 text-base font-bold">{{ resultItem?.name ?? "Vật phẩm chưa xác định" }}</h3>
              <p class="text-xs opacity-70">{{ resultItem?.information }}</p>
            </div>

            <div class="my-4 flex flex-wrap items-center justify-between gap-3">
              <h4 class="text-sm font-bold">Nguyên liệu cần thiết</h4>
              <div class="flex items-center gap-2">
                <span class="text-xs">Số lần chế tạo</span>
                <button type="button" aria-label="Giảm số lần chế tạo" class="grid size-8 place-items-center rounded border border-[#cbd9c6] bg-white font-bold disabled:opacity-40" :disabled="craftQuantity <= 1" @click="craftQuantity = Math.max(1, craftQuantity - 1)">−</button>
                <input v-model.number="craftQuantity" type="number" min="1" max="1000" step="1" class="w-16 rounded border border-[#cbd9c6] bg-white px-2 py-1.5 text-center text-sm" />
                <button type="button" aria-label="Tăng số lần chế tạo" class="grid size-8 place-items-center rounded border border-[#cbd9c6] bg-white font-bold" @click="craftQuantity = Math.max(1, craftQuantity) + 1">+</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div v-for="material in materials" :key="material.item_id" class="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[#cbd9c6] bg-white p-3 text-center">
                <span class="relative grid size-16 place-items-center rounded-lg bg-[#f5f9f0] text-xl">
                  <img v-if="material.item?.image" :src="material.item.image" :alt="material.item.name" class="h-full w-full object-contain p-1" />
                  <span v-else>{{ material.item?.icon || material.item?.name.charAt(0) || "?" }}</span>
                  <span class="absolute -right-2 -top-2 rounded-full bg-[#24352a] px-2 py-1 text-[10px] font-bold text-white">×{{ material.required }}</span>
                </span>
                <span class="line-clamp-2 text-xs font-bold">{{ material.item?.name ?? "Nguyên liệu" }}</span>
                <span class="text-[10px]" :class="material.owned >= material.required ? 'text-emerald-700' : 'text-red-600'">Có {{ material.owned }}</span>
              </div>
              <p v-if="!materials.length" class="col-span-full py-5 text-center text-xs opacity-60">Bản vẽ này chưa khai báo nguyên liệu.</p>
            </div>
            <p class="mt-4 text-center text-xs font-semibold" :class="canCraft ? 'text-emerald-700' : 'text-red-600'">{{ !quantityValid ? 'Nhập số nguyên từ 1 đến 1000.' : currencyStore.error || (currencyStore.cash < craftCost ? 'Không đủ tiền chế tạo.' : canCraft ? `Đủ nguyên liệu · ${craftCost} vàng` : 'Không đủ nguyên liệu để chế tạo số lượng đã chọn.') }}</p>
            <button type="button" class="mt-3 w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canCraft || isLoading" @click="craftSelectedBlueprint">{{ isLoading ? "Đang chế tạo..." : "Chế tạo" }}</button>
          </template>
          <div v-else class="grid h-full min-h-64 place-items-center text-center text-sm opacity-60">Chọn một bản vẽ để xem công thức chế tạo.</div>
        </section>
      </div>
    </section>
  </Modal>
</template>
