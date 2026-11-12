<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import WorkBenchInventory from "./WorkBenchInventory.vue";
import WorkBenchBlueprints from "./WorkBenchBlueprints.vue";
import WorkBenchRecipe from "./WorkBenchRecipe.vue";
import type { WorkBenchInventoryItem } from "./types";
import { useAuthStore } from "../../../stores/auth";
import { useInventoryStore } from "../../../stores/inventory";
import { useBlueprintStore } from "../../../stores/blueprint";
import { useCurrencyStore } from "../../../stores/currency";
import type { UserInventory } from "../../../data/supabaseUserInventoryRepository";
import type { Blueprint } from "../../../data/supabaseBlueprintRepository";

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
  const result = new Map<string, WorkBenchInventoryItem>();
  inventoryStore.items.forEach((row: UserInventory) => {
    const itemId = typeof row.data?.id === "string" ? row.data.id : null;
    if (!itemId) return;
    const previous = result.get(itemId);
    const count = Number(row.data?.quantity ?? 1);
    result.set(itemId, {
      id: row.id,
      itemId,
      category: typeof row.data?.category === "string" ? row.data.category : null,
      name: typeof row.data?.name === "string" ? row.data.name : tr('ShopModal.vat_pham'),
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
    errorMessage.value = error instanceof Error ? error.message : tr('WorkBenchModal.khong_the_che_tao_vat_pham');
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
    if (!authStore.userId) throw new Error(tr('WorkBenchModal.ban_can_dang_nhap_de_xem_ban_che_tao'));
    await Promise.all([inventoryStore.setUserInventory(authStore.userId), blueprintStore.loadBlueprints(), currencyStore.fetchCurrency()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : tr('WorkBenchModal.khong_the_tai_du_lieu_ban_che_tao');
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadData);

const guideSteps = [
  { target: "#workbench-palette", get title() { return tr('ShopModal.vat_pham'); }, get description() { return tr('WorkBenchModal.danh_sach_vat_pham_hien_co_trong_tui'); } },
  { target: "#workbench-blueprints", get title() { return tr('WorkBenchModal.ban_ve'); }, get description() { return tr('WorkBenchModal.chon_ban_ve_de_xem_cong_thuc_che_tao'); } },
  { target: "#workbench-recipe", get title() { return tr('WorkBenchModal.cong_thuc'); }, get description() { return tr('WorkBenchModal.dieu_chinh_so_luong_de_tinh_nguyen_lieu_can_dung'); } },
];
</script>

<template>
  <Modal :title="tr('WorkBenchModal.ban_che_tao')" :sub-title="tr('WorkBenchModal.work_bench')" :guid-steps="guideSteps" :on-refresh="loadData">
    <section class="grid min-h-full w-full grid-cols-1 gap-4 text-[#24352a] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.8fr)]">
      <WorkBenchInventory
        v-model:search-query="searchQuery"
        :filtered-inventory="filteredInventory"
        :is-loading="isLoading"
        :error-message="errorMessage"
      />

      <div class="grid min-h-0 min-w-0 gap-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
        <WorkBenchBlueprints
          :blueprints="blueprintStore.blueprints"
          :items-by-id="blueprintStore.itemsById"
          :loading="blueprintStore.loading"
          :selected-blueprint-id="selectedBlueprintId"
          @select="selectBlueprint"
        />

        <WorkBenchRecipe
          v-model:craft-quantity="craftQuantity"
          :selected-blueprint="selectedBlueprint"
          :result-item="resultItem"
          :materials="materials"
          :quantity-valid="quantityValid"
          :craft-cost="craftCost"
          :can-craft="canCraft"
          :is-loading="isLoading"
          :cash="currencyStore.cash"
          :currency-error="currencyStore.error"
          @craft="craftSelectedBlueprint"
        />
      </div>
    </section>
  </Modal>
</template>
