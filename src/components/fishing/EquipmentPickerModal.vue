<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { equipmentCategories, type EquipmentVariant } from "../../data/equipmentCatalog.ts";
import { useEquipmentStore } from "../../stores/equipment.ts";
import { useFishingStore, type FishingTool } from "../../stores/fishing.ts";
import Tab, { type TabItem } from "../shared/Tab.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useFishingStore();
const equipmentStore = useEquipmentStore();

const activeTab = ref<string>(store.selectedTool ?? equipmentCategories[0].id);
const search = ref("");

const tabs = computed<TabItem[]>(() =>
  equipmentCategories.map((c) => ({
    key: c.id,
    label: c.name,
    badge: equipmentStore.variants[c.id]?.length ?? 0,
    icon: c.icon
  })),
);

const filteredOptions = computed(() => {
  const options: EquipmentVariant[] = equipmentStore.variants[activeTab.value as FishingTool] ?? [];
  const term = search.value.trim().toLowerCase();
  if (!term) return options;
  return options.filter((o) => o.name.toLowerCase().includes(term) || o.detail.toLowerCase().includes(term));
});

function isImageIcon(icon: string) {
  return icon.startsWith("/") || icon.startsWith("http");
}

function imageSource(variant: EquipmentVariant) {
  return variant.image || (isImageIcon(variant.icon) ? variant.icon : null);
}

function pick(variant: EquipmentVariant) {
  store.selectVariant(activeTab.value as FishingTool, variant.id);
}

function onKeydown(event: KeyboardEvent) {
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
  store.selectTool(tab as FishingTool);
});

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[45] grid place-items-center overflow-y-auto bg-black/60 p-2 backdrop-blur-[3px] sm:p-5"
      @click.self="emit('close')"
    >
      <section
        class="flex max-h-[92dvh] w-[min(920px,100%)] flex-col overflow-hidden rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-[0_24px_70px_rgba(0,0,0,0.4)]"
        role="dialog"
        aria-modal="true"
        aria-label="Chọn trang bị"
      >
        <header class="flex items-center justify-between border-b border-[#cbd9c6] px-4 py-3">
          <h2 class="m-0 text-base font-bold">Chọn trang bị</h2>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full text-2xl leading-none hover:bg-black/5"
            aria-label="Đóng"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2 sm:px-6">
          <Tab v-model="activeTab" :tabs="tabs" aria-label="Loại trang bị">
            <template v-for="tab in tabs" :key="tab.key" #[tab.key]>
              <input
                v-model="search"
                type="text"
                class="mb-3 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-xs outline-none focus:border-[#70a77e]"
                placeholder="Tìm kiếm..."
              />
              <ul class="m-0 grid max-h-[calc(92dvh-190px)] list-none grid-cols-1 gap-3 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
                <li v-if="!filteredOptions.length" class="col-span-full p-3 text-center text-xs">
                  Không tìm thấy kết quả
                </li>
                <li v-for="variant in filteredOptions" :key="variant.id">
                  <button
                    type="button"
                    class="relative flex min-h-[150px] w-full items-center gap-3 overflow-hidden rounded-xl border border-[#cbd9c6] bg-white p-3 text-left transition hover:bg-[#eef8e9]"
                    :class="{
                      'border-2 border-[#2f8f4e] bg-[#eef8e9] shadow-[0_0_0_2px_#b9dba7]':
                        variant.id === store.equipmentLoadout[tab.key as FishingTool],
                    }"
                    :aria-pressed="variant.id === store.equipmentLoadout[tab.key as FishingTool]"
                    @click="pick(variant)"
                  >
                    <span class="grid h-32 w-20 flex-none place-items-center overflow-hidden text-3xl">
                      <img
                        v-if="imageSource(variant)"
                        :src="imageSource(variant)!"
                        :alt="variant.name"
                        class="h-[128px] w-[80px] max-h-full max-w-full rounded-md object-contain"
                      />
                      <template v-else>{{ variant.icon }}</template>
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col leading-tight">
                      <span
                        v-if="variant.id === store.equipmentLoadout[tab.key as FishingTool]"
                        class="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#24733d]"
                      >
                        <span class="grid h-4 w-4 place-items-center rounded-full bg-[#2f8f4e] text-white">✓</span>
                        Đang dùng
                      </span>
                      <strong class="text-xs font-bold">{{ variant.name }}</strong>
                      <small class="text-[10px] text-[#4b5f50]">{{ variant.detail }}</small>
                    </span>
                    <span
                      v-if="variant.id === store.equipmentLoadout[tab.key as FishingTool]"
                      class="absolute right-2 top-2 rounded-full bg-[#2f8f4e] px-2 py-1 text-[9px] font-extrabold text-white"
                    >
                      ĐÃ CHỌN
                    </span>
                  </button>
                </li>
              </ul>
            </template>
          </Tab>
        </div>

        <footer class="flex justify-end border-t border-[#cbd9c6] px-4 py-3">
          <button
            type="button"
            class="rounded-xl border border-[#cbd9c6] bg-white px-4 py-2 text-xs font-bold hover:bg-[#eaf5e8]"
            @click="emit('close')"
          >
            Xong
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
