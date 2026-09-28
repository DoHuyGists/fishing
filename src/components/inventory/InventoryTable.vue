<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useInventoryStore } from "../../stores/inventory";
import type { UserInventory } from "../../data/supabaseUserInventoryRepository";
import { useEquipmentStore, type Category, type EquipmentSet, type ItemData } from "../../stores/equipment";

const SLOTS: Category[] = ["rod", "line", "reel", "hook", "bait"];
const LABELS: Record<Category, string> = {
  rod: "Cần câu",
  line: "Dây câu",
  reel: "Máy câu",
  hook: "Lưỡi câu",
  bait: "Mồi",
};
const SET_PRICE = 10000;
const SETS_PER_PAGE = 3;

const userId = ref<string | null>(null);
const loading = ref(true);
const savedSnapshot = ref<Record<string, string>>({});
const savingId = ref<string | null>(null);
const busy = ref(false);
const authStore = useAuthStore();
const inventoryStore = useInventoryStore();
const equipmentStore = useEquipmentStore();

const notice = ref<{ type: "ok" | "error"; text: string } | null>(null);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function toast(type: "ok" | "error", text: string) {
  notice.value = { type, text };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (notice.value = null), 3500);
}

// Trái
const viewMode = ref<"grid" | "list">("grid");
const itemSearch = ref("");
const itemPage = ref(1);
const selected = ref<Set<string>>(new Set());

// Phải
const setSearch = ref("");
const setPage = ref(1);
const active = ref<{ setId: string; slot: Category } | null>(null);

// Modal
const modal = ref<"buy" | "delete" | null>(null);

const itemName = (d: ItemData, fallbackId = "") =>
  (d.name as string | undefined) ?? (fallbackId ? `#${fallbackId.slice(0, 6)}` : "Không tên");

const snapshotOf = (s: EquipmentSet) => JSON.stringify(SLOTS.map((k) => s[k]));
const isDirty = (s: EquipmentSet) => snapshotOf(s) !== savedSnapshot.value[s.id];


async function load() {
  loading.value = true;
  userId.value = authStore.user?.id ?? null;
  if (!userId.value) {
    loading.value = false;
    return toast("error", "Bạn cần đăng nhập để xem kho đồ.");
  }

  await inventoryStore.setUserInventory(userId.value);
  await inventoryStore.setEquipmentSet(userId.value);
  savedSnapshot.value = Object.fromEntries(inventoryStore.equipmentSets.map((s) => [s.id, snapshotOf(s)]));
  loading.value = false;
}
onMounted(load);

const itemPageSize = computed(() => (viewMode.value === "grid" ? 12 : 10));

const filteredItems = computed(() => {
  const q = itemSearch.value.trim().toLowerCase();
  if (!q) return inventoryStore.items;
  return inventoryStore.items.filter((i) => {
    // @ts-ignore
    const label = LABELS[i.data.category]?.toLowerCase() ?? "";
    return itemName(i.data).toLowerCase().includes(q) || i.data.category?.includes(q) || label.includes(q);
  });
});
const itemPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / itemPageSize.value)));
const pagedItems = computed(() => {
  const start = (itemPage.value - 1) * itemPageSize.value;
  return filteredItems.value.slice(start, start + itemPageSize.value);
});
watch([itemSearch, viewMode], () => (itemPage.value = 1));
watch(itemPages, (n) => {
  if (itemPage.value > n) itemPage.value = n;
});

const toggleSelect = (id: string) => {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
};
const allOnPageSelected = computed(
  () => pagedItems.value.length > 0 && pagedItems.value.every((i) => selected.value.has(i.id))
);
function toggleSelectPage() {
  const next = new Set(selected.value);
  if (allOnPageSelected.value) pagedItems.value.forEach((i) => next.delete(i.id));
  else pagedItems.value.forEach((i) => next.add(i.id));
  selected.value = next;
}

async function deleteSelected() {
    if (!userId.value || selected.value.size === 0) return
    const ids = [...selected.value]

    const isItemInSet = inventoryStore.equipmentSets.some(x => 
        x.bait.some(x => ids.includes(x.id)) ||
        x.reel.some(x => ids.includes(x.id)) ||
        x.hook.some(x => ids.includes(x.id)) ||
        x.rod.some(x => ids.includes(x.id)) ||
        x.line.some(x => ids.includes(x.id))
    )

    if(isItemInSet){
        toast("error", "Có Item được chọn để xóa đang được trang bị")
        return;
    }

    busy.value = true;


    await inventoryStore.removeItem(userId.value, ids);

    busy.value = false

    inventoryStore.items = inventoryStore.items.filter((i) => !selected.value.has(i.id))

    // Gỡ các item đã xóa khỏi set (chưa lưu, set sẽ hiện trạng thái "chưa lưu")

    const gone = new Set(ids)
    
    inventoryStore.equipmentSets.forEach((s) => SLOTS.forEach((k) => (s[k] = s[k].filter((x) => !gone.has(x.id)))))

    selected.value = new Set()

    modal.value = null

    toast('ok', `Đã xóa ${ids.length} vật phẩm.`)
}

const filteredSets = computed(() => {
  const q = setSearch.value.trim().toLowerCase();
  const all = inventoryStore.equipmentSets.map((set, index) => ({ set, index }));
  if (!q) return all;
  return all.filter(
    ({ set, index }) =>
      `set ${index + 1}`.includes(q) ||
      SLOTS.some((k) => set[k].some((x) => itemName(x, x.id).toLowerCase().includes(q)))
  );
});
const setPages = computed(() => Math.max(1, Math.ceil(filteredSets.value.length / SETS_PER_PAGE)));
const pagedSets = computed(() => {
  const start = (setPage.value - 1) * SETS_PER_PAGE;
  return filteredSets.value.slice(start, start + SETS_PER_PAGE);
});
watch(setSearch, () => (setPage.value = 1));
watch(setPages, (n) => {
  if (setPage.value > n) setPage.value = n;
});

const activeSet = computed(() => inventoryStore.equipmentSets.find((s) => s.id === active.value?.setId) ?? null);
const activeSetNumber = computed(() => inventoryStore.equipmentSets.findIndex((s) => s.id === active.value?.setId) + 1);

function toggleActive(setId: string, slot: Category) {
  const same = active.value?.setId === setId && active.value?.slot === slot;
  active.value = same ? null : { setId, slot };
}
const isActiveSlot = (setId: string, slot: Category) => active.value?.setId === setId && active.value?.slot === slot;
const isCompatible = (i: UserInventory) => !active.value || i.data.category === active.value.slot;
const isInActiveSlot = (i: UserInventory) => !!activeSet.value && !!active.value && activeSet.value[active.value.slot].some((x) => x.id === i.id);

function pickItem(i: UserInventory) {
  if (!active.value || !activeSet.value) return toast("ok", "Chọn một ô trong set bên phải trước, rồi bấm vật phẩm.");
  if (i.data.category !== active.value.slot)
    return toast("error", `Ô này chỉ nhận vật phẩm loại "${LABELS[active.value.slot]}".`);
  const list = activeSet.value[active.value.slot];
  // @ts-ignore
  if (list.some((x) => x.id === i.id)) return;
  list.push({ ...i.data, id: i.id });
}
function removeFromSet(set: EquipmentSet, slot: Category, inventoryId: string) {
  set[slot] = set[slot].filter((x) => x.id !== inventoryId);
}

async function saveSet(set: EquipmentSet) {
  if (!userId.value) return
    savingId.value = set.id;
    await equipmentStore.saveSet(userId.value, set);
    savingId.value = null;

    savedSnapshot.value = { ...savedSnapshot.value, [set.id]: snapshotOf(set) }

    toast('ok', 'Đã lưu set.')
}

async function buySet() {
    if (!userId.value) return
    busy.value = true
    const data = equipmentStore.buySet(userId.value);
    busy.value = false
    const row = equipmentStore.normalize(data)
    inventoryStore.equipmentSets.push(row)
    savedSnapshot.value = { ...savedSnapshot.value, [row.id]: snapshotOf(row) }
    setSearch.value = ''
    setPage.value = setPages.value // nhảy tới trang chứa set mới
    modal.value = null
    toast('ok', 'Đã thêm set mới.')
}

function handleUpdateSetUsed(event: Event, setId: string) {
  if((event.target as HTMLInputElement).value == "on"){
    equipmentStore.chooseSet(userId.value!, setId);
    toast('ok', 'Cập nhật thành công.')
  }
}

const fmtPrice = (n: number) => n.toLocaleString("vi-VN");
</script>

<template>
  <section class="relative mx-auto w-full h-full p-4 text-slate-800">
    <!-- Toast -->
    <div
      v-if="notice"
      role="status"
      :class="[
        'fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg',
        notice.type === 'ok' ? 'bg-teal-700 text-white' : 'bg-red-600 text-white',
      ]"
    >
      {{ notice.text }}
    </div>

    <div v-if="loading" class="py-24 text-center text-sm text-slate-500">Đang tải kho đồ…</div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2 h-full">
      <!-- TRÁI: Kho đồ -->
      <div class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
        <header class="space-y-3 border-b border-slate-200 p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">
              Kho đồ <span class="text-sm font-normal text-slate-500">({{ inventoryStore.items.length }})</span>
            </h2>
            <div
              class="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm"
              role="group"
              aria-label="Kiểu hiển thị"
            >
              <button
                type="button"
                :aria-pressed="viewMode === 'grid'"
                :class="['px-3 py-1', viewMode === 'grid' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
                @click="viewMode = 'grid'"
              >
                Lưới
              </button>
              <button
                type="button"
                :aria-pressed="viewMode === 'list'"
                :class="['px-3 py-1', viewMode === 'list' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
                @click="viewMode = 'list'"
              >
                Danh sách
              </button>
            </div>
          </div>

          <input
            v-model="itemSearch"
            type="search"
            placeholder="Tìm theo tên hoặc loại vật phẩm"
            class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />

          <div class="flex items-center justify-between text-sm">
            <label class="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                class="h-4 w-4 accent-teal-700"
                :checked="allOnPageSelected"
                @change="toggleSelectPage"
              />
              Chọn cả trang
            </label>
            <button
              type="button"
              :disabled="selected.size === 0"
              class="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              @click="modal = 'delete'"
            >
              Xóa đã chọn<span v-if="selected.size"> ({{ selected.size }})</span>
            </button>
          </div>

          <div
            v-if="active"
            class="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900"
          >
            <span>
              Đang chọn ô <b>{{ LABELS[active.slot] }}</b> của Set {{ activeSetNumber }}. Bấm vật phẩm để thêm.
            </span>
            <button type="button" class="ml-2 underline" @click="active = null">Hủy</button>
          </div>
        </header>

        <div class="flex-1 p-4">
          <p v-if="pagedItems.length === 0" class="py-12 text-center text-sm text-slate-500">
            {{ inventoryStore.items.length === 0 ? "Kho đồ đang trống." : "Không có vật phẩm nào khớp với tìm kiếm." }}
          </p>

          <div
            :class="
              viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-2'
            "
          >
            <div
              v-for="item in pagedItems"
              :key="item.id"
              :class="[
                'relative cursor-pointer rounded-md border bg-white transition',
                viewMode === 'grid' ? 'p-3' : 'flex items-center gap-3 px-3 py-2',
                selected.has(item.id) ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-400',
                active && isCompatible(item) ? 'ring-2 ring-teal-400' : '',
                active && !isCompatible(item) ? 'opacity-40' : '',
              ]"
              @click="pickItem(item)"
            >
              <input
                type="checkbox"
                class="h-4 w-4 accent-red-600"
                :class="viewMode === 'grid' ? 'absolute left-2 top-2' : 'shrink-0'"
                :checked="selected.has(item.id)"
                :aria-label="`Chọn ${itemName(item.data, item.id)} để xóa`"
                @click.stop
                @change="toggleSelect(item.id)"
              />

              <div
                :class="[
                  'flex items-center justify-center overflow-hidden rounded bg-slate-100 text-slate-400',
                  viewMode === 'grid' ? 'mx-auto mb-2 h-16 w-16' : 'h-10 w-10 shrink-0',
                ]"
              >
                <img
                  v-if="item.data.image"
                  :src="item.data.image"
                  :alt="itemName(item.data)"
                  class="h-full w-full object-cover"
                />
                <span v-else class="text-lg font-semibold">
                  {{ itemName(item.data, item.id).charAt(0).toUpperCase() }}
                </span>
              </div>

              <div :class="viewMode === 'grid' ? 'text-center' : 'min-w-0 flex-1'">
                <p class="truncate text-sm font-medium">{{ itemName(item.data, item.id) }}</p>
                <p class="truncate text-xs text-slate-500">{{ 
                // @ts-ignore
                 LABELS[item.data.category] ?? item.data.category }}</p>
              </div>

              <span
                v-if="isInActiveSlot(item)"
                class="text-xs font-medium text-teal-700"
                :class="viewMode === 'grid' ? 'mt-1 block text-center' : ''"
              >
                Đã thêm
              </span>
            </div>
        </div>
        </div>

        <footer
          v-if="itemPages > 1"
          class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm"
        >
          <button
            type="button"
            :disabled="itemPage <= 1"
            class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            @click="itemPage--"
          >
            Trước
          </button>
          <span class="text-slate-600">Trang {{ itemPage }} / {{ itemPages }}</span>
          <button
            type="button"
            :disabled="itemPage >= itemPages"
            class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            @click="itemPage++"
          >
            Sau
          </button>
        </footer>
      </div>

      <!-- PHẢI: Set trang bị -->
      <div class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
        <header class="space-y-3 border-b border-slate-200 bg-white p-4 lg:rounded-t-lg">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">
              Set trang bị
              <span class="text-sm font-normal text-slate-500">({{ inventoryStore.equipmentSets.length }})</span>
            </h2>
            <button
              type="button"
              class="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800"
              @click="modal = 'buy'"
            >
              Mua thêm set
            </button>
          </div>
          <input
            v-model="setSearch"
            type="search"
            placeholder="Tìm theo số set hoặc tên vật phẩm"
            class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </header>

        <div class="flex-1 space-y-4 p-4">
          <p v-if="pagedSets.length === 0" class="py-12 text-center text-sm text-slate-500">
            {{
              inventoryStore.equipmentSets.length === 0
                ? 'Bạn chưa có set nào. Bấm "Mua thêm set" để bắt đầu.'
                : "Không có set nào khớp với tìm kiếm."
            }}
          </p>

          <article
            v-for="{ set, index } in pagedSets"
            :key="set.id"
            class="rounded-md border border-slate-200 bg-white p-3"
          >
            <div class="mb-3 flex items-center justify-between">
              <div class="text-sm font-semibold">
                Set {{ index + 1 }}
                <span v-if="isDirty(set)" class="ml-2 text-xs font-normal text-amber-600">Chưa lưu</span>
              </div>
            <div class="select-none flex gap-2">
              <input type="radio" name="equipment-set" :checked="set.isUsed" @change="handleUpdateSetUsed($event, set.id)" class="cursor-pointer">
              <label for="" class="text-sm">
                Sử dụng
              </label>
            </div>
              <button
                type="button"
                :disabled="!isDirty(set) || savingId === set.id"
                class="rounded-md bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                @click="saveSet(set)"
              >
                {{ savingId === set.id ? "Đang lưu…" : "Lưu set" }}
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2 xl:grid-cols-5">
              <div
                v-for="slot in SLOTS"
                :key="slot"
                :class="[
                  'min-w-0 cursor-pointer rounded-md border p-2 transition',
                  isActiveSlot(set.id, slot)
                    ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-200'
                    : 'border-slate-200 hover:border-slate-400',
                ]"
                @click="toggleActive(set.id, slot)"
              >
                <button
                  type="button"
                  class="mb-1 flex w-full items-center justify-between text-left text-xs font-medium text-slate-600"
                  :aria-pressed="isActiveSlot(set.id, slot)"
                  @click.stop="toggleActive(set.id, slot)"
                >
                  <span class="truncate">{{ LABELS[slot] }}</span>
                  <span class="text-slate-400">{{ set[slot].length }}</span>
                </button>

                <ul class="space-y-1">
                  <li
                    v-for="eq in set[slot]"
                    :key="eq.id"
                    class="flex items-center justify-between gap-1 rounded bg-slate-100 px-1.5 py-1 text-xs"
                  >
                    <span class="truncate" :title="itemName(eq, eq.id)">{{ itemName(eq, eq.id) }}</span>
                    <button
                      type="button"
                      class="shrink-0 rounded px-1 text-slate-500 hover:bg-red-100 hover:text-red-600"
                      :aria-label="`Gỡ ${itemName(eq, eq.id)} khỏi set`"
                      @click.stop="removeFromSet(set, slot, eq.id)"
                    >
                      ✕
                    </button>
                  </li>
                </ul>
                <p v-if="set[slot].length === 0" class="py-2 text-center text-xs text-slate-400">Trống</p>
              </div>
            </div>
          </article>
        </div>

        <footer
          v-if="setPages > 1"
          class="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm lg:rounded-b-lg"
        >
          <button
            type="button"
            :disabled="setPage <= 1"
            class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            @click="setPage--"
          >
            Trước
          </button>
          <span class="text-slate-600">Trang {{ setPage }} / {{ setPages }}</span>
          <button
            type="button"
            :disabled="setPage >= setPages"
            class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            @click="setPage++"
          >
            Sau
          </button>
        </footer>
      </div>
    </div>

    <!-- Modal -->
    <div
      v-if="modal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      @click.self="modal = null"
      @keydown.esc="modal = null"
    >
      <div class="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <template v-if="modal === 'buy'">
          <h3 class="text-base font-semibold">Mua thêm set trang bị?</h3>
          <p class="mt-2 text-sm text-slate-600">
            Bạn sẽ thêm 1 set trống với giá <b>{{ fmtPrice(SET_PRICE) }}</b>.
          </p>
        </template>
        <template v-else>
          <h3 class="text-base font-semibold">Xóa {{ selected.size }} vật phẩm?</h3>
          <p class="mt-2 text-sm text-slate-600">
            Vật phẩm sẽ bị xóa khỏi kho và gỡ khỏi các set đang dùng. Không thể hoàn tác.
          </p>
        </template>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            :disabled="busy"
            @click="modal = null"
          >
            Hủy
          </button>
          <button
            v-if="modal === 'buy'"
            type="button"
            class="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
            :disabled="busy"
            @click="buySet"
          >
            {{ busy ? "Đang xử lý…" : `Mua set (${fmtPrice(SET_PRICE)})` }}
          </button>
          <button
            v-else
            type="button"
            class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            :disabled="busy"
            @click="deleteSelected"
          >
            {{ busy ? "Đang xóa…" : "Xóa" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>