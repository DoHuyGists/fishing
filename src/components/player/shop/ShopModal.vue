<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import ShopItemCard from "./ShopItemCard.vue";
import ShopPurchaseForm from "./ShopPurchaseForm.vue";
import { useInventoryStore } from "../../../stores/inventory.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useToast } from "../../../composables/useToast";

const inventoryStore = useInventoryStore();
const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const toast = useToast();
const search = ref("");
const selectedClassification = ref("ALL");
const selectedCategory = ref("ALL");
const sort = ref<"name" | "price-asc" | "price-desc">("name");
const viewMode = ref<"list" | "grid" | "group">("grid");
const selectedItemId = ref<string | null>(null);
const quantity = ref(1);
const busy = ref(false);
const previewImage = ref<{ src: string; alt: string } | null>(null);

const classifications = computed(() =>
  [
    ...new Set(
      inventoryStore.shopItems
        .map((item) => item.classification?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi")),
);
const categories = computed(() =>
  [
    ...new Set(
      inventoryStore.shopItems.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi")),
);
const filteredItems = computed(() => {
  const term = search.value.trim().toLocaleLowerCase();
  const result = inventoryStore.shopItems.filter(
    (item) =>
      (!term ||
        `${item.name} ${item.information} ${item.category ?? ""} ${item.classification ?? ""}`
          .toLocaleLowerCase()
          .includes(term)) &&
      (selectedClassification.value === "ALL" || item.classification === selectedClassification.value) &&
      (selectedCategory.value === "ALL" || item.category === selectedCategory.value),
  );
  return result.sort((a, b) =>
    sort.value === "price-asc"
      ? a.price - b.price
      : sort.value === "price-desc"
        ? b.price - a.price
        : a.name.localeCompare(b.name, "vi"),
  );
});
const displayGroups = computed(() => {
  if (viewMode.value !== "group") return [{ category: "", items: filteredItems.value }];

  const groups = new Map<string, typeof filteredItems.value>();
  for (const item of filteredItems.value) {
    const category = item.category?.trim() || tr('InventoryItems.khac');
    const items = groups.get(category) ?? [];
    items.push(item);
    groups.set(category, items);
  }

  return [...groups]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category, "vi"));
});
const selectedItem = computed(() => inventoryStore.shopItems.find((item) => item.id === selectedItemId.value) ?? null);
const totalPrice = computed(() => (selectedItem.value?.price ?? 0) * quantity.value);
const totalReceived = computed(() => (selectedItem.value?.quantity ?? 1) * quantity.value);
const canBuy = computed(
  () =>
    !!selectedItem.value &&
    selectedItem.value.price >= 0 &&
    Number.isInteger(quantity.value) &&
    quantity.value > 0 &&
    currencyStore.cash >= totalPrice.value,
);

onMounted(() => {
  void inventoryStore.loadShopItems();
  if (authStore.userId) {
    void inventoryStore.setUserInventory(authStore.userId).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : tr('ShopModal.khong_the_tai_tui_do'), { position: "bottom" });
    });
  }
});

function selectItem(id: string) {
  selectedItemId.value = id;
  quantity.value = 1;
}
async function buyItem() {
  if (busy.value || !selectedItem.value || !canBuy.value) return;
  const item = selectedItem.value;
  const purchaseQuantity = quantity.value;
  const receivedQuantity = (item.quantity ?? 1) * purchaseQuantity;
  busy.value = true;
  try {
    await inventoryStore.purchaseItem(item.id, purchaseQuantity);
    await Promise.all([
      authStore.userId ? inventoryStore.setUserInventory(authStore.userId) : Promise.resolve(),
      currencyStore.fetchCurrency(),
      inventoryStore.loadShopItems(),
    ]);
    toast.success(tr('ShopModal.da_mua_value0_value1', { value0: receivedQuantity, value1: item.name }), { position: "bottom" });
    selectedItemId.value = null;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : tr('ShopModal.khong_the_mua_vat_pham_vui_long_thu_lai'), { position: "bottom" });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    :title="tr('ShopModal.cua_hang_vat_pham')"
    :sub-title="tr('ShopModal.chon_vat_pham_va_so_luong_muon_mua')"
    :on-refresh="inventoryStore.loadShopItems"
  >
    <div class="grid min-h-full gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] text-[#24352a]">
      <section>
        <div
          class="sticky top-0 z-10 mb-4 grid gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <input
            v-model="search"
            type="search"
            :placeholder="tr('ShopModal.tim_vat_pham')"
            class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-700/30"
          />
          <select
            v-model="selectedClassification"
            class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">{{ tr('ShopModal.moi_nhom_vat_pham') }}</option>
            <option v-for="value in classifications" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="selectedCategory" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
            <option value="ALL">{{ tr('ShopModal.moi_loai_vat_pham') }}</option>
            <option v-for="value in categories" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="sort" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
            <option value="name">{{ tr('ShopModal.ten_a_z') }}</option>
            <option value="price-asc">{{ tr('ShopModal.gia_thap_den_cao') }}</option>
            <option value="price-desc">{{ tr('ShopModal.gia_cao_den_thap') }}</option>
          </select>
          <div
            class="flex items-center justify-end gap-1 border-t border-[#cbd9c6]/70 pt-2 sm:col-span-2 xl:col-span-4"
            role="group"
            :aria-label="tr('CaughtModal.che_do_hien_thi')"
          >
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-bold transition"
              :class="viewMode === 'list' ? 'bg-[#24352a] text-white' : 'text-[#24352a] hover:bg-white'"
              :aria-pressed="viewMode === 'list'"
              @click="viewMode = 'list'"
            >
              {{ tr('CaughtModal.danh_sach') }}
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-bold transition"
              :class="viewMode === 'grid' ? 'bg-[#24352a] text-white' : 'text-[#24352a] hover:bg-white'"
              :aria-pressed="viewMode === 'grid'"
              @click="viewMode = 'grid'"
            >
              {{ tr('CaughtModal.luoi') }}
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-bold transition"
              :class="viewMode === 'group' ? 'bg-[#24352a] text-white' : 'text-[#24352a] hover:bg-white'"
              :aria-pressed="viewMode === 'group'"
              @click="viewMode = 'group'"
            >
              {{ tr('ShopModal.nhom') }}
            </button>
          </div>
        </div>
        <div v-if="inventoryStore.shopLoading" class="py-16 text-center text-sm text-emerald-900/60">
          {{ tr('ShopModal.dang_tai_vat_pham') }}
        </div>
        <div
          v-else-if="!filteredItems.length"
          class="rounded-xl border border-dashed border-[#cbd9c6] py-16 text-center text-sm text-emerald-900/60"
        >
          {{ tr('ShopModal.khong_tim_thay_vat_pham_phu_hop') }}
        </div>
        <div v-else class="space-y-5">
          <section v-for="group in displayGroups" :key="group.category || 'all-items'">
            <div
              v-if="viewMode === 'group'"
              class="mb-2 mt-0 flex items-center gap-2 border-b border-[#cbd9c6] pb-2 text-sm font-extrabold uppercase tracking-wide text-emerald-900"
            >
              {{ group.category }}
              <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px]">{{ group.items.length }}</span>
            </div>
            <div :class="viewMode === 'list' ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'">
              <ShopItemCard
                v-for="item in group.items"
                :key="item.id"
                :item="item"
                :selected="selectedItemId === item.id"
                :owned-quantity="authStore.userId ? inventoryStore.ownedQuantitiesByItemId.get(item.id) ?? 0 : 0"
                @select="selectItem"
                @preview="previewImage = $event"
              />
            </div>
          </section>
        </div>
      </section>
      <ShopPurchaseForm
        v-model:quantity="quantity"
        :selected-item="selectedItem"
        :total-price="totalPrice"
        :total-received="totalReceived"
        :can-buy="canBuy"
        :cash="currencyStore.cash"
        :busy="busy"
        @buy="buyItem"
      />
    </div>
  </Modal>
  <Teleport to="body">
    <div
      v-if="previewImage"
      class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="tr('ShopModal.xem_anh_value0', { value0: previewImage.alt })"
      @click.self="previewImage = null"
      @keydown.esc="previewImage = null"
    >
      <button
        type="button"
        class="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-3xl leading-none text-white hover:bg-white/25"
        :aria-label="tr('ShopModal.dong_anh')"
        @click="previewImage = null"
      >
        ×
      </button>
      <img
        :src="previewImage.src"
        :alt="previewImage.alt"
        class="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
      />
      <div
        class="absolute bottom-3 left-1/2 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-black/50 px-4 py-1.5 text-sm text-white"
      >
        {{ previewImage.alt }}
      </div>
    </div>
  </Teleport>
</template>
