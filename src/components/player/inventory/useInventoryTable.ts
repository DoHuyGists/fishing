import type { InventoryTableContext, InventoryTab } from "../../../types/model/inventory";
import type { UserInventory } from "../../../types/model/userInventory";
import { t as tr } from "../../../i18n";
import { inject, type InjectionKey } from "vue";
import { computed, onMounted, ref, watch } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useInventoryStore } from "../../../stores/inventory.ts";

import { useEquipmentStore, type Category, type EquipmentSet, type ItemData } from "../../../stores/equipment.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import { useToast } from "../../../composables/useToast.ts";
import { usePagedListFilters } from '../../../composables/usePagedListFilters';
import { useHealthStore } from '../../../stores/health';
import { healthEquipment, healthSlots } from '../../../data/healthEquipment';

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

export function useInventoryTable(initialTab: InventoryTab = 'fishing') {
  const activeTab = ref<InventoryTab>(initialTab);
  const healthStore = useHealthStore();
  const userId = ref<string | null>(null);
  const loading = ref(true);
  const savedSnapshot = ref<Record<string, string>>({});
  const savedSetInventoryIds = ref<Record<string, string[]>>({});
  const savingId = ref<string | null>(null);
  const switchingId = ref<string | null>(null);
  const busy = ref(false);
  const usingItemId = ref<string | null>(null);
  const authStore = useAuthStore();
  const inventoryStore = useInventoryStore();
  const itemClassification = computed(() => activeTab.value === 'health' ? 'body' : 'fishing');
  if (inventoryStore.viewClassification !== itemClassification.value) {
    inventoryStore.viewPage = 1;
    inventoryStore.viewItems = [];
    inventoryStore.viewTotal = 0;
    inventoryStore.ownedTotal = 0;
    ++inventoryStore.viewRequest;
  }
  inventoryStore.viewClassification = itemClassification.value;
  const equipmentStore = useEquipmentStore();
  const userProfileStore = useUserProfileStore();
  const equipmentCapacity = computed(() => userProfileStore.equipmentCapacity);
  const currencyStore = useCurrencyStore();
  const toast = useToast();

  const viewMode = ref<"grid" | "list" | "grouped">("grid");
  const itemSearch = computed({ get: () => inventoryStore.viewSearch, set: value => { inventoryStore.viewSearch = value; } });
  const itemPage = computed({ get: () => inventoryStore.viewPage, set: value => {
    inventoryStore.viewPage = value;
    void loadItemsPage(value).catch(error => toast.error(error.message));
  } });
  const selected = ref<Set<string>>(new Set());
  const selectedRecords = new Map<string, UserInventory>();
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
    userId.value = authStore.user?.id ?? null;
    if (!userId.value) {
      loading.value = false;
      return toast.error(tr('useInventoryTable.ban_can_dang_nhap_de_xem_kho_do'));
    }

    try {
      await Promise.all([loadItemsPage(), inventoryStore.setEquipmentSet(), healthStore.loadInventory()]);
      savedSnapshot.value = Object.fromEntries(inventoryStore.equipmentSets.map((set) => [set.id, snapshotOf(set)]));
      savedSetInventoryIds.value = Object.fromEntries(
        inventoryStore.equipmentSets.map((set) => [set.id, inventoryIdsInSet(set)])
      );
    } catch (error) { toast.error((error as Error).message); }
    finally { loading.value = false; }
  }
  onMounted(load);

  const filteredItems = computed(() => inventoryStore.viewItems);
  const itemPages = computed(() => Math.max(1, Math.ceil(inventoryStore.viewTotal / inventoryStore.viewPageSize)));
  const pagedItems = computed(() => inventoryStore.viewItems);
  async function loadItemsPage(page?: number) {
    const query = itemSearch.value.trim().toLowerCase();
    const categories = query ? activeTab.value === 'health'
      ? healthSlots.filter(slot => tr(`Health.slot_${slot}`).toLowerCase().includes(query))
      : SLOTS.filter(slot => LABELS[slot].toLowerCase().includes(query)) : [];
    await inventoryStore.loadViewPage(categories, page);
  }
  usePagedListFilters([itemSearch], () => { void loadItemsPage(1).catch(error => toast.error(error.message)); }, () => { ++inventoryStore.viewRequest; });
  watch(activeTab, () => {
    inventoryStore.viewClassification = itemClassification.value;
    inventoryStore.viewPage = 1;
    inventoryStore.viewItems = [];
    inventoryStore.viewTotal = 0;
    inventoryStore.ownedTotal = 0;
    selected.value = new Set(); selectedRecords.clear();
    if (modal.value === 'delete') modal.value = null;
    void loadItemsPage(1).catch(error => toast.error(error.message));
  }, { flush: 'sync' });

  const toggleSelect = (id: string) => {
    const next = new Set(selected.value);
    const record = pagedItems.value.find(item => item.id === id);
    if (record) selectedRecords.set(id, record);
    next.has(id) ? next.delete(id) : next.add(id);
    selected.value = next;
  };
  const allOnPageSelected = computed(
    () => pagedItems.value.length > 0 && pagedItems.value.every((item) => selected.value.has(item.id))
  );
  function toggleSelectPage() {
    const next = new Set(selected.value);
    if (allOnPageSelected.value) pagedItems.value.forEach((item) => next.delete(item.id));
    else pagedItems.value.forEach((item) => { next.add(item.id); selectedRecords.set(item.id, item); });
    selected.value = next;
  }

  async function useSelectedItem() {
    const item = [...selectedRecords.values()].find((candidate) => selected.value.has(candidate.id));
    if (!item || item.rpc == null || usingItemId.value) return;
    usingItemId.value = item.id;
    try {
      await inventoryStore.useItem(item.id);
      await loadItemsPage();
      await healthStore.loadInventory();
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

    if (healthStore.containsInventory(selectedIds)) {
      toast.error(tr('Health.removeBeforeDelete'));
      return;
    }

    busy.value = true;
    try {
      await inventoryStore.removeItem(userId.value, ids);
      inventoryStore.items = inventoryStore.items.filter((item) => !selectedIds.has(item.id));
      await loadItemsPage();
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
  const hasActiveSlot = computed(() => activeTab.value === 'health' ? !!healthStore.selectedSlot : !!active.value);
  const isCompatible = (item: UserInventory) => {
    if (activeTab.value !== 'health') return !active.value || item.data.category === active.value.slot;
    const equipment = healthEquipment(item);
    return !!equipment.slot && equipment.quantity > 0 && (!healthStore.selectedSlot || equipment.slot === healthStore.selectedSlot);
  };
  const isInActiveSlot = (item: UserInventory) =>
    activeTab.value === 'health' ? healthStore.equippedItems.some(equipped => equipped.inventory.id === item.id) : !!activeSet.value &&
    !!active.value &&
    activeSet.value[active.value.slot].some((setItem) => setItem.inventory_id === item.id);

  function pickItem(item: UserInventory) {
    if (activeTab.value === 'health') {
      if (!healthStore.selectedSlot) return toast.info(tr('Health.selectSlotFirst'));
      if (!isCompatible(item)) return toast.error(tr('Health.incompatibleSlot'));
      healthStore.equip(item.id);
      return;
    }
    if (!active.value || !activeSet.value) {
      return toast.info(tr('useInventoryTable.chon_mot_o_trong_set_ben_phai_truoc_roi_bam_vat_pham'));
    }
    if (item.data.category !== active.value.slot) {
      return toast.error(tr('useInventoryTable.o_nay_chi_nhan_vat_pham_loai_value0', { value0: LABELS[active.value.slot] }));
    }
    const list = activeSet.value[active.value.slot];
    if (list.some((setItem) => setItem.inventory_id === item.id)) return;
    if (equipmentStore.countSetItems(activeSet.value) >= equipmentCapacity.value) {
      return toast.error(tr('EquipmentSets.capacity_reached', { capacity: equipmentCapacity.value }));
    }
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
    if (!userId.value || savingId.value) return;
    const snapshot = JSON.parse(JSON.stringify(set)) as EquipmentSet;
    const owner = authStore.user?.id, generation = authStore.sessionGeneration;
    savingId.value = set.id;
    try {
      await equipmentStore.saveSet(userId.value, snapshot);
      if (authStore.user?.id !== owner || authStore.sessionGeneration !== generation) return;
      snapshot.isUsed = inventoryStore.equipmentSets.find(candidate => candidate.id === set.id)?.isUsed ?? false;
      inventoryStore.savedEquipmentSets = inventoryStore.savedEquipmentSets.map(saved => saved.id === set.id ? snapshot : saved);
      savedSnapshot.value = { ...savedSnapshot.value, [set.id]: snapshotOf(snapshot) };
      savedSetInventoryIds.value = { ...savedSetInventoryIds.value, [set.id]: inventoryIdsInSet(snapshot) };
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

  async function handleUpdateSetUsed(event: Event, setId: string) {
    const input = event.target as HTMLInputElement;
    if (!userId.value || switchingId.value || !input.checked) return;
    input.checked = false;
    const owner = authStore.user?.id, generation = authStore.sessionGeneration;
    switchingId.value = setId;
    try {
      await equipmentStore.chooseSet(userId.value, setId);
      if (authStore.user?.id !== owner || authStore.sessionGeneration !== generation) return;
      for (const set of [...inventoryStore.equipmentSets, ...inventoryStore.savedEquipmentSets]) set.isUsed = set.id === setId;
      toast.success(tr('useInventoryTable.cap_nhat_thanh_cong'));
    } catch (error) { toast.error((error as Error).message); }
    finally { switchingId.value = null; }
  }

  function hasRpc() {
    const targetItem = [...selectedRecords.values()].find((item) => selected.value.has(item.id));
    return targetItem?.rpc != null && targetItem.rpc !== "";
  }

  return {
    activeTab,
    healthStore,
    hasActiveSlot,
    SLOTS,
    LABELS,
    SET_PRICE,
    active,
    activeSetNumber,
    allOnPageSelected,
    busy,
    currencyStore,
    equipmentStore,
    equipmentCapacity,
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
    switchingId,
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
