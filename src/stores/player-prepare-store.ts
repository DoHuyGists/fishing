import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { t as tr } from "../i18n";
import { equipmentCategories } from "../data/equipmentCatalog";
import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository";
import type { FishingTool } from "../types/model/fishing";
import type { EquipmentSet } from "./player-equipment-store";
import type { FishingArea } from "./player-fishing-area-store";
import { useAuthStore } from "./auth";
import { useInventoryStore } from "./player-inventory-store";
import { useHealthStore } from "./player-health-store";
import { useDiaryStore } from "./player-diary-store";
import { useUserTurnsStore } from "./player-user-turns-store";
import { useUserInAreaStore } from "./player-user-In-area-store";
import { useWorldStore } from "./player-world-map-store";
import { useGameCatalogStore } from "./player-game-catalog-store";
import { useFeatureAvailabilityStore } from "./player-feature-availability-store";
import { useFishingTransitionStore } from "./player-fishing-transition-store";
import { useModalStore } from "./player-modal-store";

export const usePrepareStore = defineStore("prepare", () => {
  const authStore = useAuthStore();
  const inventoryStore = useInventoryStore();
  const healthStore = useHealthStore();
  const diaryStore = useDiaryStore();
  const userTurnsStore = useUserTurnsStore();
  const userInAreaStore = useUserInAreaStore();
  const worldStore = useWorldStore();
  const catalog = useGameCatalogStore();
  const features = useFeatureAvailabilityStore();
  const fishingTransition = useFishingTransitionStore();
  const modalStore = useModalStore();
  const area = ref<FishingArea | null>(null);
  const loading = ref(true);
  const error = ref("");
  const switchingSet = ref(false);
  const selectingItemId = ref<string | null>(null);
  const entering = ref(false);
  let requestId = 0;
  const usedSet = computed(() =>
    inventoryStore.equipmentSets.find((set) => set.isUsed) ?? inventoryStore.equipmentSets[0] ?? null,
  );

  async function loadData(areaId: string, force = false) {
    const request = ++requestId;
    const generation = authStore.sessionGeneration;
    const current = () => request === requestId && generation === authStore.sessionGeneration;
    loading.value = true;
    error.value = "";
    area.value = null;
    worldStore.targetArea({});
    try {
      if (!areaId) throw new Error(tr("PrepareModal.areaNotFound"));
      const areas = await catalog.get("areas", { force });
      if (!current()) return;
      const selected = areas.find((candidate) => candidate.id === areaId);
      if (!selected) throw new Error(tr("PrepareModal.areaNotFound"));
      area.value = selected;
      worldStore.targetArea(selected);
      await Promise.all([
        inventoryStore.setEquipmentSet(),
        healthStore.loadInventory(),
        diaryStore.loadDiscoveredAreaSpecies(areaId, authStore.userId),
        userTurnsStore.fetchStatus(),
        userInAreaStore.setCurrentUserInArea(authStore.userId),
      ]);
    } catch (err) {
      if (current()) error.value = err instanceof Error ? err.message : tr("PrepareModal.khong_the_tai_trang_bi");
    } finally {
      if (current()) loading.value = false;
    }
  }

  function isItemSelected(tool: FishingTool, itemId: string | number): boolean {
    const items = usedSet.value?.[tool];
    return Array.isArray(items) && items.some((item) => String(item.id) === String(itemId) && item.is_used === true);
  }

  function isSlotReady(tool: FishingTool): boolean {
    const items = usedSet.value?.[tool];
    return Array.isArray(items) && items.some((item) => item.is_used === true);
  }

  /**
   * Đổi set: Chỉ 1 set được sử dụng.
   */
  async function switchSet(targetSet: EquipmentSet) {
    if (targetSet.isUsed || switchingSet.value || selectingItemId.value || entering.value) return;
    switchingSet.value = true;
    error.value = "";
    try {
      if (authStore.userId) {
        await supabaseEquipmentRepository.updateCurrentUsedSet(authStore.userId, targetSet.id);
        await inventoryStore.setEquipmentSet();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : tr("PrepareModal.khong_the_doi_set_trang_bi");
    } finally {
      switchingSet.value = false;
    }
  }

  /** Chọn item chính trong set đang dùng bằng selectItem */
  async function chooseMainItem(tool: FishingTool, item: EquipmentSet[FishingTool][number]) {
    if (switchingSet.value || selectingItemId.value || entering.value) return;
    const itemId = String(item.id);

    if (isItemSelected(tool, itemId)) return;

    selectingItemId.value = itemId;
    try {
      await supabaseEquipmentRepository.selectItem(itemId);
      const items = usedSet.value?.[tool];
      if (Array.isArray(items)) {
        for (const candidate of items) {
          candidate.is_used = String(candidate.id) === itemId;
        }
      }
    } catch (err) {
      console.error("Lỗi khi chọn item chính:", err);
    } finally {
      selectingItemId.value = null;
    }
  }

  const allSlotsReady = computed(() => equipmentCategories.every((cat) => isSlotReady(cat.id)));

  /** Kiểm tra set có ít nhất 1 item cho mỗi loại trang bị hay không */
  function isSetComplete(s?: EquipmentSet | null): boolean {
    if (!s) return false;
    return equipmentCategories.every((cat) => {
      const list = s[cat.id];
      return Array.isArray(list) && list.length > 0;
    });
  }

  /** Set trang bị đang dùng có ít nhất 1 item mỗi loại */
  const isUsedSetComplete = computed(() => isSetComplete(usedSet.value));

  /** Danh sách loại trang bị còn thiếu trong set đang chọn */
  const missingCategoriesInSet = computed(() => {
    if (!usedSet.value) return equipmentCategories.map((c) => c.name);
    return equipmentCategories
      .filter((cat) => {
        const list = usedSet.value![cat.id];
        return !Array.isArray(list) || list.length === 0;
      })
      .map((cat) => cat.name);
  });

  /** Danh sách loại trang bị chưa có món được đánh dấu đang dùng */
  const missingUsedSlots = computed(() => {
    return equipmentCategories.filter((cat) => !isSlotReady(cat.id)).map((cat) => cat.name);
  });

  /** Điều kiện cho phép tiếp tục: Không lỗi/loading, set đủ mỗi loại >= 1 item, và đã chọn đủ 5/5 trang bị */
  const canProceed = computed(() => {
    return (
      !!area.value &&
      !loading.value &&
      !entering.value &&
      !switchingSet.value &&
      !selectingItemId.value &&
      !modalStore.isModalOpening &&
      features.canOpen("prepare") &&
      userInAreaStore.canEnterFishingArea &&
      !fishingTransition.visible &&
      !error.value &&
      !healthStore.loading &&
      !healthStore.busy &&
      isUsedSetComplete.value &&
      allSlotsReady.value
    );
  });

  const proceedBlockReason = computed(() => {
    if (!area.value || loading.value || error.value) return null;
    if (!userInAreaStore.canEnterFishingArea) return tr("InteractWorldMap.can_ket_thuc_xu_ly_ca_trong_luoi_truoc");
    if (!usedSet.value) {
      return tr("PrepareModal.chua_chon_set_trang_bi_nao");
    }
    if (!isUsedSetComplete.value) {
      return tr("PrepareModal.set_dang_chon_thieu_loai_value0_can_co_it_nhat_1_mon_moi_loai", {
        value0: missingCategoriesInSet.value.join(", "),
      });
    }
    if (!allSlotsReady.value) {
      return tr("PrepareModal.chua_chon_du_5_5_trang_bi_chinh_con_thieu_value0", {
        value0: missingUsedSlots.value.join(", "),
      });
    }
    return null;
  });


  async function enterArea() {
    if (!canProceed.value || !area.value) return false;
    const areaId = area.value.id;
    entering.value = true;
    try {
      await fishingTransition.coverScreen();
      await userTurnsStore.consumeTurn();
      await supabaseUserInAreaRepository.setUserEnterArea(areaId);
      return true;
    } catch (err) {
      entering.value = false;
      fishingTransition.hide();
      throw err;
    }
  }

  function cancelLoad() {
    requestId++;
    area.value = null;
    loading.value = true;
  }

  return {
    area, loading, error, switchingSet, selectingItemId, entering, usedSet,
    canProceed, proceedBlockReason, isUsedSetComplete, isSetComplete, isItemSelected,
    loadData, switchSet, chooseMainItem, enterArea, cancelLoad,
  };
});
