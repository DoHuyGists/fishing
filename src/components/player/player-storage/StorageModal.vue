<script setup lang="ts">
import { computed, onMounted } from "vue";
import { t as tr } from "../../../i18n";
import { useStorageStore } from "../../../stores/player-storage-store";
import { useModalStore } from "../../../stores/player-modal-store";
import Modal from "../../shared/Modal.vue";
import CapacityUsage from "../../shared/CapacityUsage.vue";
import { useUserProfileStore } from "../../../stores/player-user-profile-store";
import Tab from "../../shared/Tab.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import StorageToolbar from "./StorageToolbar.vue";
import StorageItemsPanel from "./StorageItemsPanel.vue";
const storage = useStorageStore();
const profile = useUserProfileStore();
const modal = useModalStore();
const storageTabs = computed(() => {
  const classifications = [...new Set([...storage.classifications, storage.classification])].filter(Boolean);
  return [
    { key: "", label: tr("Storage.all") },
    ...classifications.map((key) => ({ key, label: storage.classificationLabel(key) })),
  ].map((tab) => ({
    ...tab,
    disabled: tab.key !== storage.classification && (storage.busy || storage.loading),
  }));
});
onMounted(() => { storage.confirmingDelete = false; void storage.load(); });
function close() { if (!storage.busy) { if (storage.confirmingDelete) storage.confirmingDelete = false; else modal.close(); } }
</script>

<template>
  <Modal :title="tr('InventoryModal.kho_do')" :on-refresh="async () => { if (!storage.busy) await storage.load(); }" content-width-class="max-w-7xl" @keydown.esc.stop="close">
    <div class="space-y-4 text-content">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-border-default bg-surface p-3 text-sm">
          <CapacityUsage :label="tr('UserProfile.suc_chua_tui_do')" :used="storage.ready ? storage.items.length : null" :capacity="profile.profile ? profile.inventoryCapacity : null" />
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-3 text-sm">{{ tr('Storage.totalQuantity') }} <b>{{ storage.totalQuantity }}</b></div>
        <div class="rounded-xl border border-border-default bg-surface p-3 text-sm">{{ tr('Storage.selected') }} <b>{{ storage.selectedIds.length }}</b></div>
      </div>
      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <StorageToolbar class="min-w-0 lg:sticky lg:top-0" />
        <Tab v-model="storage.classification" :tabs="storageTabs" :aria-label="tr('Storage.classification')" class="min-w-0">
          <template v-for="tab in storageTabs" :key="tab.key" #[tab.key]>
            <StorageItemsPanel v-if="storage.classification === tab.key" class="pt-4" />
          </template>
        </Tab>
      </div>
      <TwoOptionsModal v-if="storage.confirmingDelete" class="z-[10001]!"
        :title="tr('Storage.confirmDelete', { count: storage.selectedIds.length })"
        :aria-label="tr('Storage.confirmDelete', { count: storage.selectedIds.length })"
        :first-disabled="storage.busy" :second-disabled="!storage.canDelete"
        :second-text="tr(storage.busy ? 'InventoryModal.dang_xoa' : 'InventoryModal.xoa')"
        :on-first="() => { storage.confirmingDelete = false; }" :on-second="() => { void storage.deleteSelected(); }"
        :on-dismiss="() => { if (!storage.busy) storage.confirmingDelete = false; }">
        <div class="text-sm">{{ tr('Storage.deleteWarning') }}</div>
        <div v-if="storage.error" role="alert" class="mt-2 text-sm text-danger">{{ storage.error }}</div>
      </TwoOptionsModal>
    </div>
  </Modal>
</template>
