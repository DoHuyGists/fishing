<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useFishingStore, type CaughtFish } from "../../stores/fishing";

const store = useFishingStore();
type ViewMode = "list" | "grid" | "group";
const viewModes: { value: ViewMode; label: string; ariaLabel: string }[] = [
  { value: "list", label: "Danh sách", ariaLabel: "Hiển thị dạng danh sách" },
  { value: "grid", label: "Lưới", ariaLabel: "Hiển thị dạng lưới" },
  { value: "group", label: "Theo loài", ariaLabel: "Gom theo loài" },
];
const viewMode = ref<ViewMode>("group");
const expandedGroup = ref<string | null>(null);
const groupedInventory = computed(() => {
  const groups = new Map<string, CaughtFish[]>();
  store.inventory.forEach((fish) => {
    const group = groups.get(fish.name);
    if (group) group.push(fish);
    else groups.set(fish.name, [fish]);
  });
  return Array.from(groups, ([name, fishes]) => ({ name, fishes }));
});
watch(viewMode, () => {
  expandedGroup.value = null;
});
const selectedFishToRelease = ref<CaughtFish | null>(null);
const isReleasing = ref(false);

function openReleaseConfirm(fish: CaughtFish) {
  selectedFishToRelease.value = fish;
}

function cancelRelease() {
  selectedFishToRelease.value = null;
}

async function handleRelease() {
  if (!selectedFishToRelease.value) return;
  isReleasing.value = true;
  try {
    await store.releaseFish(selectedFishToRelease.value.id);
    selectedFishToRelease.value = null;
  } catch (err) {
    console.error("Lỗi khi thả cá:", err);
  } finally {
    isReleasing.value = false;
  }
}

function getRewardEffect(variant: "NORMAL" | "GOLDEN" | "MUTATED") {
  switch (variant) {
    case 'GOLDEN':
      return 'reward-special'
    case 'MUTATED':
      return 'reward-legendary'
    default:
      return ''
  }
}

</script>

<template>
  <Teleport to="body">
    <Transition name="bag-dialog">
      <div v-if="store.bagOpen"
        class="fixed z-[31] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
        role="presentation" @click.self="store.closeBag">
        <section
          class="w-[min(460px,100%)] max-h-[min(580px,80vh)] overflow-auto border border-[rgba(255,226,149,0.68)] rounded-[20px] bg-[linear-gradient(145deg,#173d2b,#0e281b)] shadow-[0_24px_70px_rgba(0,0,0,0.48)] text-[#f4f0df]"
          role="dialog" aria-modal="true" aria-labelledby="bag-title">
          <header
            class="flex justify-between items-start px-5 pt-[19px] pb-3.5 border-b border-[rgba(223,241,207,0.14)]">
            <div>
              <h2 id="bag-title" class="m-0 text-xl">Thành quả câu được</h2>
            </div>
            <button type="button"
              class="w-[29px] h-[29px] border-0 rounded-full bg-[rgba(235,243,219,0.13)] text-white cursor-pointer text-[22px] leading-none"
              aria-label="Đóng túi cá" @click="store.closeBag">
              ×
            </button>
          </header>
          <p v-if="!store.inventory.length" class="py-[35px] px-5 text-[#b7cfb9] text-center text-[13px]">Túi còn trống.
            Hãy ra hồ câu một con cá!</p>
          <template v-else>
          <div class="flex justify-end px-[13px] pt-[13px]">
            <div class="flex rounded-lg border border-[rgba(223,241,207,0.2)] p-0.5" role="group"
              aria-label="Chế độ hiển thị">
              <button v-for="mode in viewModes" :key="mode.value" type="button"
                class="rounded-md px-2 py-1 text-xs font-bold transition-colors cursor-pointer"
                :class="viewMode === mode.value ? 'bg-[#e8bd62] text-[#173d2b]' : 'text-[#b7cfb9] hover:bg-[rgba(235,243,219,0.13)]'"
                :aria-pressed="viewMode === mode.value" :aria-label="mode.ariaLabel" @click="viewMode = mode.value">
                {{ mode.label }}
              </button>
            </div>
          </div>
          <ul v-if="viewMode === 'group'" class="grid gap-[9px] m-0 p-[13px] list-none">
            <li v-for="group in groupedInventory" :key="group.name"
              class="p-2 border rounded-xl border-[rgba(223,241,207,0.15)]">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <img :src="group.fishes[0].image" :alt="group.name"
                    class="w-[74px] h-12 rounded-lg object-cover flex-shrink-0" />
                  <strong class="text-sm truncate">{{ group.name }}</strong>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="px-2 py-1 rounded-full bg-[rgba(235,243,219,0.13)] text-[10px] font-extrabold">{{
                    group.fishes.length }} con</span>
                  <button type="button"
                    class="px-3 py-1.5 border border-[rgba(223,241,207,0.25)] rounded-lg bg-[rgba(235,243,219,0.1)] hover:bg-[rgba(235,243,219,0.2)] text-xs font-bold transition-colors cursor-pointer"
                    :aria-expanded="expandedGroup === group.name"
                    @click="expandedGroup = expandedGroup === group.name ? null : group.name">
                    {{ expandedGroup === group.name ? 'Ẩn' : 'Xem' }}
                  </button>
                </div>
              </div>
              <ul v-if="expandedGroup === group.name"
                class="grid gap-2 m-0 mt-2 pt-2 p-0 list-none border-t border-[rgba(223,241,207,0.14)]">
                <li v-for="fish in group.fishes" :key="fish.id"
                  :class="`flex items-center justify-between gap-3 p-2 border ${fish.isShiny ? getRewardEffect(fish.variantType) : ''} rounded-lg border-[rgba(223,241,207,0.15)]`">
                  <div class="grid gap-0.5 min-w-0">
                    <span class="text-[#e8bd62] text-[9px] font-black tracking-[0.09em] uppercase">{{ fish.variantType
                      }}</span>
                    <small class="text-[#b7cfb9] text-[11px]">{{ fish.weight }}<span v-if="fish.length"> · {{
                      fish.length }}</span></small>
                  </div>
                  <button type="button"
                    class="flex-shrink-0 px-3 py-1.5 border border-[rgba(235,110,110,0.4)] rounded-lg bg-[rgba(194,59,59,0.2)] hover:bg-[rgba(194,59,59,0.4)] text-[#ffaaaa] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    @click.stop="openReleaseConfirm(fish)">
                    Thả
                  </button>
                </li>
              </ul>
            </li>
          </ul>
          <ul v-else class="grid gap-[9px] m-0 p-[13px] list-none"
            :class="viewMode === 'grid' ? 'grid-cols-2' : ''">
            <li v-for="fish in store.inventory" :key="fish.id"
              :class="[`flex gap-3 p-2 border ${fish.isShiny ? getRewardEffect(fish.variantType) : ''} rounded-xl border-[rgba(223,241,207,0.15)]`, viewMode === 'grid' ? 'flex-col' : 'items-center justify-between']">
              <div class="flex gap-3 min-w-0" :class="viewMode === 'grid' ? 'flex-col' : 'items-center'">
                <img :src="fish.image" :alt="fish.name" class="rounded-lg object-cover flex-shrink-0"
                  :class="viewMode === 'grid' ? 'w-full h-24' : 'w-[74px] h-12'" />
                <div class="grid gap-0.5 min-w-0">
                  <span class="text-[#e8bd62] text-[9px] font-black tracking-[0.09em] uppercase">{{ fish.variantType
                    }}</span>
                  <strong class="text-sm truncate">{{ fish.name }}</strong>
                  <small class="text-[#b7cfb9] text-[11px]">{{ fish.weight }}<span v-if="fish.length"> · {{ fish.length
                      }}</span></small>
                </div>
              </div>
              <button type="button"
                class="flex-shrink-0 px-3 py-1.5 border border-[rgba(235,110,110,0.4)] rounded-lg bg-[rgba(194,59,59,0.2)] hover:bg-[rgba(194,59,59,0.4)] text-[#ffaaaa] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                @click.stop="openReleaseConfirm(fish)">
                Thả
              </button>
            </li>
          </ul>
          </template>
        </section>
      </div>
    </Transition>

    <!-- Dialog xác nhận thả cá -->
    <Transition name="bag-dialog">
      <div v-if="selectedFishToRelease"
        class="fixed z-[32] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.82)] backdrop-blur-[8px]"
        role="presentation" @click.self="cancelRelease">
        <div
          class="w-[min(380px,100%)] p-5 border border-[rgba(255,226,149,0.5)] rounded-[20px] bg-[linear-gradient(145deg,#1b4531,#0f2e1f)] shadow-[0_24px_70px_rgba(0,0,0,0.6)] text-[#f4f0df] text-center"
          role="dialog" aria-modal="true" aria-labelledby="confirm-release-title">
          <h3 id="confirm-release-title" class="m-0 text-lg font-bold text-[#e8bd62]">Xác nhận thả cá</h3>
          <p class="my-4 text-sm text-[#c8dccb] leading-relaxed">
            Bạn có chắc chắn muốn thả <strong class="text-white">{{ selectedFishToRelease.name }}</strong> ({{
              selectedFishToRelease.weight }}) về lại hồ không?
          </p>
          <div class="flex justify-center gap-3 mt-5">
            <button type="button"
              class="px-4 py-2 border border-[rgba(255,255,255,0.2)] rounded-xl bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white text-xs font-semibold transition-colors cursor-pointer"
              @click="cancelRelease">
              Hủy
            </button>
            <button type="button"
              class="px-4 py-2 border border-[#e65c5c] rounded-xl bg-[#c23b3b] hover:bg-[#d94848] text-white text-xs font-bold shadow-[0_4px_12px_rgba(194,59,59,0.4)] transition-colors cursor-pointer disabled:opacity-50"
              :disabled="isReleasing" @click="handleRelease">
              {{ isReleasing ? 'Đang thả...' : 'Xác nhận thả' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bag-dialog-enter-active,
.bag-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.bag-dialog-enter-from,
.bag-dialog-leave-to {
  opacity: 0;
}
</style>
