<script setup lang="ts">
import type { EquipmentVariant } from "../../../types/model/equipment";
import { getFormattingLocale, t as tr } from "../../../i18n";

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { equipmentCategories } from "../../../data/equipmentCatalog.ts";
import { healthSlots } from "../../../data/healthEquipment.ts";
import { useEquipmentStore } from "../../../stores/player-equipment-store.ts";
import { useHealthStore } from "../../../stores/player-health-store.ts";
import { useFishingStore } from "../../../stores/player-fishing-store.ts";
import type { FishingTool } from "../../../types/model/fishing";
import Tab, { type TabItem } from "../../shared/Tab.vue";
import EquipmentPickerItemCard from "./EquipmentPickerItemCard.vue";
import { useInformationModal } from "../../../composables/useInformationModal";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useFishingStore();
const equipmentStore = useEquipmentStore();
const healthStore = useHealthStore();
const information = useInformationModal();

const activeTab = ref<string>(store.selectedTool ?? equipmentCategories[0].id);
const search = ref("");

const fishingTabs = computed<TabItem[]>(() =>
  equipmentCategories.map((c) => ({
    key: c.id,
    label: c.name,
    badge: equipmentStore.variants[c.id]?.length ?? 0,
    icon: c.icon,
  })),
);
const tabs = computed<TabItem[]>(() => [
  ...fishingTabs.value,
  ...healthSlots.map((slot) => ({
    key: slot,
    label: tr(`Health.slot_${slot}`),
    badge: healthStore.activeItems.filter((item) => item.slot === slot).length,
  })),
]);
const bodySlot = computed(() => healthSlots.find((slot) => slot === activeTab.value));

function isFishingTool(tab: string): tab is FishingTool {
  return equipmentCategories.some((category) => category.id === tab);
}

const filteredOptions = computed(() => {
  const options: EquipmentVariant[] = isFishingTool(activeTab.value)
    ? equipmentStore.variants[activeTab.value]
    : healthStore.activeItems
        .filter((item) => item.slot === bodySlot.value)
        .map((item) => ({
          ...item.inventory.data,
          id: item.inventory.id,
          name: item.name,
          image: item.image,
          icon: item.icon,
          detail: Object.entries(item.bonuses)
            .map(([resource, value]) => `${tr(`Health.${resource}`)}: +${value.toLocaleString(getFormattingLocale())}`)
            .join(" · "),
          is_used: true,
        }));
  const term = search.value.trim().toLowerCase();
  if (!term) return options;
  return options.filter((o) => o.name.toLowerCase().includes(term) || o.detail.toLowerCase().includes(term));
});

async function pick(variant: EquipmentVariant) {
  const tool = activeTab.value;
  if (!isFishingTool(tool)) return;
  const selected = await store.selectVariant(tool, variant.id);
  if (!selected) return;
  for (const option of equipmentStore.variants[tool]) {
    option.is_used = option.id === variant.id;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (information.content.value) return;
  if (props.open && event.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    search.value = "";
    if (store.selectedTool) activeTab.value = store.selectedTool;
  },
);
watch(activeTab, (tab) => {
  search.value = "";
  if (isFishingTool(tab)) store.selectTool(tab);
});
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && !healthStore.loading && !healthStore.busy) {
      void healthStore.loadInventory();
    }
  },
  { immediate: true },
);

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[45] grid place-items-center overflow-y-auto bg-content/60 p-2 backdrop-blur-[3px] sm:p-5"
      @click.self="emit('close')"
    >
      <section
        class="player-popup-in flex max-h-[92dvh] w-[min(920px,100%)] flex-col overflow-hidden rounded-2xl border border-border-default bg-surface text-content shadow-[0_24px_70px_color-mix(in_srgb,_var(--color-content)_40%,_transparent)]"
        role="dialog"
        aria-modal="true"
        :aria-label="tr('EquipmentMenu.chon_trang_bi')"
      >
        <header class="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div class="m-0 text-base font-bold">{{ tr("EquipmentMenu.chon_trang_bi") }}</div>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full text-2xl leading-none hover:bg-content/5"
            :aria-label="tr('ChangePasswordModal.dong')"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2 sm:px-6">
          <Tab v-model="activeTab" :tabs="tabs" contained wrap :aria-label="tr('EquipmentPickerModal.loai_trang_bi')">
            <template v-for="tab in tabs" :key="tab.key" #[tab.key]>
              <div
                v-if="tab.key === activeTab"
                class="flex h-full flex-col"
                :aria-busy="!!bodySlot && (healthStore.loading || healthStore.busy)"
              >
                <div v-if="bodySlot" class="shrink-0 space-y-2 text-xs">
                  <div v-if="healthStore.loading" role="status">{{ tr("PrepareModal.dang_tai_trang_bi") }}</div>
                  <div v-else-if="healthStore.error" role="alert" class="flex items-center gap-2 text-danger">
                    <span>{{ healthStore.error }}</span>
                    <button
                      type="button"
                      class="shrink-0 rounded border border-border-default px-2 py-1"
                      @click="healthStore.loadInventory()"
                    >
                      {{ tr("Maintenance.thu_lai") }}
                    </button>
                  </div>
                </div>
                <input
                  v-model="search"
                  type="text"
                  class="mb-3 w-full shrink-0 rounded-lg border border-border-default bg-white px-3 py-2 text-xs outline-none focus:border-accent"
                  :placeholder="tr('EquipmentPickerModal.tim_kiem')"
                />
                <div class="m-0 grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
                  <div
                    v-if="!filteredOptions.length && !(bodySlot && (healthStore.loading || healthStore.error))"
                    class="col-span-full p-3 text-center text-xs"
                  >
                    {{
                      bodySlot && !search.trim()
                        ? tr(healthStore.savedSets.length ? "Health.emptySlot" : "PrepareModal.body_sets_empty")
                        : tr("EquipmentPickerModal.khong_tim_thay_ket_qua")
                    }}
                  </div>
                  <EquipmentPickerItemCard
                    v-for="variant in filteredOptions"
                    :key="variant.id"
                    :variant="variant"
                    :category="tab.label"
                    :read-only="!!bodySlot"
                    :bait="activeTab === 'bait'"
                    @pick="pick"
                  />
                </div>
              </div>
            </template>
          </Tab>
        </div>

        <footer class="flex justify-end border-t border-border-default px-4 py-3">
          <button
            type="button"
            class="rounded-xl border border-border-default bg-white px-4 py-2 text-xs font-bold hover:bg-surface"
            @click="emit('close')"
          >
            {{ tr("EquipmentPickerModal.xong") }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
