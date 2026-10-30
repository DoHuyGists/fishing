<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Cash from "../currency/Cash.vue";
import { useInventoryStore } from "../../../stores/inventory.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { useAuthStore } from "../../../stores/auth.ts";

const inventoryStore = useInventoryStore();
const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const search = ref("");
const selectedClassification = ref("ALL");
const selectedCategory = ref("ALL");
const sort = ref<"name" | "price-asc" | "price-desc">("name");
const viewMode = ref<"list" | "grid" | "group">("grid");
const selectedItemId = ref<string | null>(null);
const quantity = ref(1);
const busy = ref(false);
const error = ref("");
const notice = ref("");
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
    const category = item.category?.trim() || "Khác";
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
const canBuy = computed(
  () =>
    !!selectedItem.value &&
    selectedItem.value.price >= 0 &&
    quantity.value > 0 &&
    (selectedItem.value.quantity == null || selectedItem.value.quantity >= quantity.value) &&
    currencyStore.cash >= totalPrice.value,
);

onMounted(() => {
  void inventoryStore.loadShopItems();
});

function selectItem(id: string) {
  selectedItemId.value = id;
  quantity.value = 1;
  error.value = "";
  notice.value = "";
}
function openImagePreview(event: Event, src: string, alt: string) {
  event.stopPropagation();
  previewImage.value = { src, alt };
}
async function buyItem() {
  if (!selectedItem.value || !canBuy.value) return;
  error.value = "";
  busy.value = true;
  try {
    await inventoryStore.purchaseItem(selectedItem.value.id, quantity.value);
    const itemName = selectedItem.value.name;
    await Promise.all([
      authStore.userId ? inventoryStore.setUserInventory(authStore.userId) : Promise.resolve(),
      currencyStore.fetchCurrency(),
      inventoryStore.loadShopItems(),
    ]);
    notice.value = `Đã mua ${quantity.value} × ${itemName}.`;
    selectedItemId.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Không thể mua vật phẩm. Vui lòng thử lại.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    title="Cửa hàng vật phẩm"
    sub-title="Chọn vật phẩm và số lượng muốn mua"
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
            placeholder="Tìm vật phẩm..."
            class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-700/30"
          />
          <select
            v-model="selectedClassification"
            class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Mọi nhóm vật phẩm</option>
            <option v-for="value in classifications" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="selectedCategory" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
            <option value="ALL">Mọi loại vật phẩm</option>
            <option v-for="value in categories" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="sort" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
            <option value="name">Tên A–Z</option>
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="price-desc">Giá cao đến thấp</option>
          </select>
          <div
            class="flex items-center justify-end gap-1 border-t border-[#cbd9c6]/70 pt-2 sm:col-span-2 xl:col-span-4"
            role="group"
            aria-label="Chế độ hiển thị"
          >
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-bold transition"
              :class="viewMode === 'list' ? 'bg-[#24352a] text-white' : 'text-[#24352a] hover:bg-white'"
              :aria-pressed="viewMode === 'list'"
              @click="viewMode = 'list'"
            >
              Danh sách
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-bold transition"
              :class="viewMode === 'grid' ? 'bg-[#24352a] text-white' : 'text-[#24352a] hover:bg-white'"
              :aria-pressed="viewMode === 'grid'"
              @click="viewMode = 'grid'"
            >
              Lưới
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-bold transition"
              :class="viewMode === 'group' ? 'bg-[#24352a] text-white' : 'text-[#24352a] hover:bg-white'"
              :aria-pressed="viewMode === 'group'"
              @click="viewMode = 'group'"
            >
              Nhóm
            </button>
          </div>
        </div>
        <p v-if="inventoryStore.shopLoading" class="py-16 text-center text-sm text-emerald-900/60">
          Đang tải vật phẩm...
        </p>
        <div
          v-else-if="!filteredItems.length"
          class="rounded-xl border border-dashed border-[#cbd9c6] py-16 text-center text-sm text-emerald-900/60"
        >
          Không tìm thấy vật phẩm phù hợp.
        </div>
        <div v-else class="space-y-5">
          <section v-for="group in displayGroups" :key="group.category || 'all-items'">
            <h3
              v-if="viewMode === 'group'"
              class="mb-2 mt-0 flex items-center gap-2 border-b border-[#cbd9c6] pb-2 text-sm font-extrabold uppercase tracking-wide text-emerald-900"
            >
              {{ group.category }}
              <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px]">{{ group.items.length }}</span>
            </h3>
            <div :class="viewMode === 'list' ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'">
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                class="group flex w-full min-w-0 overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                :class="
                  selectedItemId === item.id ? 'border-emerald-700 ring-2 ring-emerald-700/20' : 'border-[#cbd9c6]'
                "
                @click="selectItem(item.id)"
              >
                <div class="grid h-28 w-24 shrink-0 place-items-center overflow-hidden bg-[#f5f9f0] sm:h-32 sm:w-28">
                  <img
                    v-if="item.image"
                    :src="item.image"
                    :alt="item.name"
                    loading="lazy"
                    class="block h-full w-full cursor-zoom-in object-contain p-2"
                    :class="{ 'scale-[2.5]': item.category?.trim().toLocaleLowerCase() === 'hook' }"
                    @click.stop="openImagePreview($event, item.image, item.name)"
                    draggable="false"
                  />
                  <span v-else class="text-5xl">{{ item.icon || "🎁" }}</span>
                </div>
                <div class="flex min-w-0 flex-1 flex-col p-3">
                  <p
                    v-if="item.classification"
                    class="m-0 text-[10px] font-bold uppercase tracking-wide text-emerald-800"
                  >
                    {{ item.classification }}
                  </p>
                  <h3 class="m-0 truncate text-sm font-extrabold" :title="item.name">{{ item.name }}</h3>
                  <p class="m-0 mt-1 line-clamp-2 text-xs text-emerald-950/65">{{ item.information }}</p>
                  <div
                    class="mt-auto flex items-center justify-between gap-1 border-t border-[#cbd9c6]/70 pt-2 text-xs"
                  >
                    <span class="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900">{{
                      item.category || "Vật phẩm"
                    }}</span>
                    <strong class="whitespace-nowrap text-amber-700">{{ item.price.toLocaleString("vi-VN") }} đ</strong>
                  </div>
                  <p v-if="item.quantity != null" class="m-0 mt-1 text-[10px] text-emerald-950/55">
                    Còn {{ item.quantity.toLocaleString("vi-VN") }}
                  </p>
                </div>
              </button>
            </div>
          </section>
        </div>
      </section>
      <aside class="h-fit rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 lg:sticky lg:top-0">
        <h3 class="m-0 text-base font-extrabold">Đơn hàng</h3>
        <div v-if="selectedItem" class="mt-4">
          <div class="flex items-center gap-3">
            <div
              class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#cbd9c6] bg-white text-2xl"
            >
              <img
                v-if="selectedItem.image"
                :src="selectedItem.image"
                :alt="selectedItem.name"
                class="h-full w-full object-contain"
              /><span v-else>{{ selectedItem.icon || "🎁" }}</span>
            </div>
            <div class="min-w-0">
              <p class="m-0 truncate font-bold">{{ selectedItem.name }}</p>
              <p class="m-0 text-xs text-emerald-950/60">{{ selectedItem.category || "Vật phẩm" }}</p>
            </div>
          </div>
          <label class="mt-5 block text-xs font-bold"
            >Số lượng
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              :max="selectedItem.quantity ?? undefined"
              class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
            />
          </label>
          <div class="mt-4 space-y-2 border-t border-[#cbd9c6] pt-3 text-sm">
            <div class="flex justify-between">
              <span>Đơn giá</span><span>{{ selectedItem.price.toLocaleString("vi-VN") }} đ</span>
            </div>
            <div class="flex justify-between font-extrabold">
              <span>Thành tiền</span><span>{{ totalPrice.toLocaleString("vi-VN") }} đ</span>
            </div>
            <div class="flex justify-between text-xs text-emerald-900/65">
              <span>Số dư hiện tại</span><Cash :amount="currencyStore.formattedCash" />
            </div>
          </div>
          <p v-if="selectedItem.quantity != null && selectedItem.quantity < 1" class="mt-3 text-xs text-red-700">
            Vật phẩm đã hết hàng.
          </p>
          <p v-else-if="!canBuy && quantity > 0" class="mt-3 text-xs text-red-700">
            {{ currencyStore.cash < totalPrice ? "Bạn không đủ tiền." : "Số lượng vượt quá tồn kho." }}
          </p>
          <button
            type="button"
            class="mt-4 w-full rounded-lg bg-[#24352a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="busy || !canBuy"
            @click="buyItem"
          >
            {{ busy ? "Đang xử lý..." : "Mua vật phẩm" }}
          </button>
        </div>
        <p v-else class="mt-4 text-sm text-emerald-950/60">Chọn một vật phẩm để xem giá và mua.</p>
        <p v-if="error" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{{ error }}</p>
        <p v-if="notice" class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          {{ notice }}
        </p>
      </aside>
    </div>
  </Modal>
  <Teleport to="body">
    <div
      v-if="previewImage"
      class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="`Xem ảnh ${previewImage.alt}`"
      @click.self="previewImage = null"
      @keydown.esc="previewImage = null"
    >
      <button
        type="button"
        class="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-3xl leading-none text-white hover:bg-white/25"
        aria-label="Đóng ảnh"
        @click="previewImage = null"
      >
        &times;
      </button>
      <img
        :src="previewImage.src"
        :alt="previewImage.alt"
        class="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
      />
      <p
        class="absolute bottom-3 left-1/2 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-black/50 px-4 py-1.5 text-sm text-white"
      >
        {{ previewImage.alt }}
      </p>
    </div>
  </Teleport>
</template>
