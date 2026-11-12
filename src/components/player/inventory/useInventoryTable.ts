import type { InventoryTableContext } from "../../../types/model/inventory";
import type { UserInventory } from "../../../types/model/userInventory";
import { t as tr } from "../../../i18n";
import { inject, type InjectionKey } from "vue";
import { computed, onMounted, ref, watch } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useInventoryStore } from "../../../stores/inventory.ts";

import { useEquipmentStore, type Category, type EquipmentSet, type ItemData } from "../../../stores/equipment.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { useToast } from "../../../composables/useToast.ts";

const SLOTS: Category[] = ["rod", "line", "reel", "hook", "bait"];
const LABELS: Record<Category, string> = {
  get rod() { return tr('useInventoryTable.can_cau'); },
  get line() { return tr('useInventoryTable.day_cau'); },
  get reel() { return tr('useInventoryTable.may_cau'); },
  get hook() { return tr('useInventoryTable.luoi_cau'); },
  get bait() { return tr('useInventoryTable.moi'); },
};
const SET_PRICE = 50000;
const SETS_PER_PAGE = 3;

export function useInventoryTable() {
  const userId = ref<string | null>(null);
  const loading = ref(true);
  const savedSnapshot = ref<Record<string, string>>({});
  const savedSetInventoryIds = ref<Record<string, string[]>>({});
  const savingId = ref<string | null>(null);
  const busy = ref(false);
  const usingItemId = ref<string | null>(null);
  const authStore = useAuthStore();
  const inventoryStore = useInventoryStore();
  const equipmentStore = useEquipmentStore();
  const currencyStore = useCurrencyStore();
  const toast = useToast();

  const viewMode = ref<"grid" | "list" | "grouped">("grid");
  const itemSearch = ref("");
  const itemPage = ref(1);
  const selected = ref<Set<string>>(new Set());
  const setSearch = ref("");
  const setPage = ref(1);
  const active = ref<{ setId: string; slot: Category } | null>(null);
  const modal = ref<"buy" | "delete" | null>(null);

  const itemName = (d: ItemData, fallbackId = "") =>
    (d.name as string | undefined) ?? (fallbackId ? `#${fallbackId.slice(0, 6)}` : tr('useInventoryTable.khong_ten'));

  const snapshotOf = (set: EquipmentSet) => JSON.stringify(SLOTS.map((slot) => set[slot]));
  const isDirty = (set: EquipmentSet) => snapshotOf(set) !== savedSnapshot.value[set.id];

  function inventoryIdsInSet(set: EquipmentSet) {
    return SLOTS.flatMap((slot) =>
      set[slot].flatMap((item) => (typeof item.inventory_id === "string" ? [item.inventory_id] : []))
    );
  }

  async function load() {
    loading.value = true;
    userId.value = authStore.userId ?? null;
    if (!userId.value) {
      loading.value = false;
      return toast.error(tr('useInventoryTable.ban_can_dang_nhap_de_xem_kho_do'));
    }

    await inventoryStore.setUserInventory(userId.value);
    await inventoryStore.setEquipmentSet();
    savedSnapshot.value = Object.fromEntries(inventoryStore.equipmentSets.map((set) => [set.id, snapshotOf(set)]));
    savedSetInventoryIds.value = Object.fromEntries(
      inventoryStore.equipmentSets.map((set) => [set.id, inventoryIdsInSet(set)])
    );
    loading.value = false;
  }
  onMounted(load);

  const itemPageSize = computed(() => (viewMode.value === "list" ? 10 : 12));
  const filteredItems = computed(() => {
    const query = itemSearch.value.trim().toLowerCase();
    if (!query) return inventoryStore.items;
    return inventoryStore.items.filter((item) => {
      const label = LABELS[item.data.category as Category]?.toLowerCase() ?? "";
      return (
        itemName(item.data).toLowerCase().includes(query) ||
        item.data.category?.includes(query) ||
        label.includes(query)
      );
    });
  });
  const itemPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / itemPageSize.value)));
  const pagedItems = computed(() => {
    const start = (itemPage.value - 1) * itemPageSize.value;
    return filteredItems.value.slice(start, start + itemPageSize.value);
  });
  watch([itemSearch, viewMode], () => (itemPage.value = 1));
  watch(itemPages, (pages) => {
    if (itemPage.value > pages) itemPage.value = pages;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected.value);
    next.has(id) ? next.delete(id) : next.add(id);
    selected.value = next;
  };
  const allOnPageSelected = computed(
    () => pagedItems.value.length > 0 && pagedItems.value.every((item) => selected.value.has(item.id))
  );
  function toggleSelectPage() {
    const next = new Set(selected.value);
    if (allOnPageSelected.value) pagedItems.value.forEach((item) => next.delete(item.id));
    else pagedItems.value.forEach((item) => next.add(item.id));
    selected.value = next;
  }

  async function useSelectedItem() {
    const item = inventoryStore.items.find((candidate) => selected.value.has(candidate.id));
    if (!item || item.rpc == null || usingItemId.value) return;
    usingItemId.value = item.id;
    try {
      await inventoryStore.useItem(item.id);
      await inventoryStore.setUserInventory(userId.value!);
      selected.value = new Set();
      toast.success(tr('useInventoryTable.da_su_dung_vat_pham'));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      usingItemId.value = null;
    }
  }

  async function deleteSelected() {
    if (!userId.value || selected.value.size === 0) return;
    const ids = [...selected.value];
    const selectedIds = new Set(ids);
    const isItemInSet = inventoryStore.equipmentSets.some(
      (set) =>
        inventoryIdsInSet(set).some((id) => selectedIds.has(id)) ||
        (savedSetInventoryIds.value[set.id] ?? []).some((id) => selectedIds.has(id))
    );

    if (isItemInSet) {
      toast.error(tr('useInventoryTable.khong_the_xoa_vat_pham_dang_co_trong_set_hay_go_vat_pham_va_luu_'));
      return;
    }

    busy.value = true;
    try {
      await inventoryStore.removeItem(userId.value, ids);
      inventoryStore.items = inventoryStore.items.filter((item) => !selectedIds.has(item.id));
      selected.value = new Set();
      modal.value = null;
      toast.success(tr('useInventoryTable.da_xoa_value0_vat_pham', { value0: ids.length }));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      busy.value = false;
    }
  }

  const filteredSets = computed(() => {
    const query = setSearch.value.trim().toLowerCase();
    const all = inventoryStore.equipmentSets.map((set, index) => ({ set, index }));
    if (!query) return all;
    return all.filter(
      ({ set, index }) =>
        `set ${index + 1}`.includes(query) ||
        SLOTS.some((slot) => set[slot].some((item) => itemName(item, item.id).toLowerCase().includes(query)))
    );
  });
  const setPages = computed(() => Math.max(1, Math.ceil(filteredSets.value.length / SETS_PER_PAGE)));
  const pagedSets = computed(() => {
    const start = (setPage.value - 1) * SETS_PER_PAGE;
    return filteredSets.value.slice(start, start + SETS_PER_PAGE);
  });
  watch(setSearch, () => (setPage.value = 1));
  watch(setPages, (pages) => {
    if (setPage.value > pages) setPage.value = pages;
  });

  const activeSet = computed(
    () => inventoryStore.equipmentSets.find((set) => set.id === active.value?.setId) ?? null
  );
  const activeSetNumber = computed(
    () => inventoryStore.equipmentSets.findIndex((set) => set.id === active.value?.setId) + 1
  );

  function toggleActive(setId: string, slot: Category) {
    const same = active.value?.setId === setId && active.value?.slot === slot;
    active.value = same ? null : { setId, slot };
  }
  const isActiveSlot = (setId: string, slot: Category) =>
    active.value?.setId === setId && active.value?.slot === slot;
  const isCompatible = (item: UserInventory) => !active.value || item.data.category === active.value.slot;
  const isInActiveSlot = (item: UserInventory) =>
    !!activeSet.value &&
    !!active.value &&
    activeSet.value[active.value.slot].some((setItem) => setItem.inventory_id === item.id);

  function pickItem(item: UserInventory) {
    if (!active.value || !activeSet.value) {
      return toast.info(tr('useInventoryTable.chon_mot_o_trong_set_ben_phai_truoc_roi_bam_vat_pham'));
    }
    if (item.data.category !== active.value.slot) {
      return toast.error(tr('useInventoryTable.o_nay_chi_nhan_vat_pham_loai_value0', { value0: LABELS[active.value.slot] }));
    }
    const list = activeSet.value[active.value.slot];
    if (list.some((setItem) => setItem.inventory_id === item.id)) return;
    list.push({
      ...item.data,
      id: typeof item.data.id === "string" ? item.data.id : item.id,
      inventory_id: item.id,
    });
  }

  function removeFromSet(set: EquipmentSet, slot: Category, item: EquipmentSet[Category][number]) {
    set[slot] = set[slot].filter((candidate) => candidate !== item);
  }

  async function saveSet(set: EquipmentSet) {
    if (!userId.value) return;
    savingId.value = set.id;
    try {
      await equipmentStore.saveSet(userId.value, set);
      savedSnapshot.value = { ...savedSnapshot.value, [set.id]: snapshotOf(set) };
      savedSetInventoryIds.value = { ...savedSetInventoryIds.value, [set.id]: inventoryIdsInSet(set) };
      active.value = null;
      selected.value = new Set();
      toast.success(tr('useInventoryTable.da_luu_set'));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      savingId.value = null;
    }
  }

  async function buySet() {
    try {
      busy.value = true;
      await equipmentStore.buySet();
      await inventoryStore.setEquipmentSet();
      toast.success(tr('useInventoryTable.da_them_set_moi'));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      busy.value = false;
      setSearch.value = "";
      modal.value = null;
    }
  }

  function handleUpdateSetUsed(event: Event, setId: string) {
    if ((event.target as HTMLInputElement).value === "on") {
      equipmentStore.chooseSet(userId.value!, setId);
      toast.success(tr('useInventoryTable.cap_nhat_thanh_cong'));
    }
  }

  function hasRpc() {
    const targetItem = inventoryStore.items.find((item) => selected.value.has(item.id));
    return targetItem?.rpc != null && targetItem.rpc !== "";
  }

  return {
    SLOTS,
    LABELS,
    SET_PRICE,
    active,
    activeSetNumber,
    allOnPageSelected,
    busy,
    currencyStore,
    deleteSelected,
    filteredItems,
    hasRpc,
    handleUpdateSetUsed,
    inventoryStore,
    isActiveSlot,
    isCompatible,
    isDirty,
    isInActiveSlot,
    itemName,
    itemPage,
    itemPages,
    itemSearch,
    load,
    loading,
    modal,
    pagedItems,
    pagedSets,
    pickItem,
    removeFromSet,
    saveSet,
    savingId,
    selected,
    setPage,
    setPages,
    setSearch,
    toggleActive,
    toggleSelect,
    toggleSelectPage,
    useSelectedItem,
    usingItemId,
    viewMode,
    buySet,
  };
}
export const inventoryTableContextKey: InjectionKey<InventoryTableContext> = Symbol("InventoryTableContext");

export function useInventoryTableContext() {
  const context = inject(inventoryTableContextKey);
  if (!context) throw new Error("Inventory table context is not provided.");
  return context;
}
