<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Hint from "../../shared/Hint.vue";
import { useCaughtStore, type CaughtFish } from "../../../stores/caught.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import { useModalStore } from "../../../stores/modal.ts";
import { useToast } from "../../../composables/useToast.ts";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";

type Side = "net" | "stored";

const caughtStore = useCaughtStore();
const userProfileStore = useUserProfileStore();
const modalStore = useModalStore();
const toast = useToast();

const search = reactive<Record<Side, string>>({ net: "", stored: "" });
const viewMode = reactive<Record<Side, "grid" | "list" | "species">>({ net: "grid", stored: "grid" });
const expandedSpecies = reactive<Record<Side, Set<string>>>({ net: new Set(), stored: new Set() });
const selected = reactive<Record<Side, Set<string>>>({ net: new Set(), stored: new Set() });
const isMoving = ref(false);
const isFinishing = ref(false);
const showConfirm = ref(false);
const storageCapacity = computed(() => userProfileStore.speciesStorageCapacity);
const remainingStorage = computed(() => Math.max(0, storageCapacity.value - caughtStore.storedFishes.length));

function filtered(fishes: CaughtFish[], keyword: string) {
  const k = keyword.trim().toLowerCase();
  if (!k) return fishes;
  return fishes.filter((f) => f.species?.name?.toLowerCase().includes(k));
}

function groupedBySpecies(fishes: CaughtFish[]) {
  const groups = new Map<string, { key: string; name: string; image: string | null; fishes: CaughtFish[] }>();
  for (const fish of fishes) {
    const key = fish.species?.id ?? "unknown";
    let group = groups.get(key);
    if (!group) {
      group = { key, name: fish.species?.name || "Chưa rõ loài", image: fish.species?.image ?? null, fishes: [] };
      groups.set(key, group);
    }
    group.fishes.push(fish);
  }
  return [...groups.values()];
}

function toggleSpecies(side: Side, key: string) {
  const expanded = expandedSpecies[side];
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}

const panels = computed(() => [
  {
    key: "net" as Side,
    title: "Lưới",
    total: caughtStore.inNetFishes.length,
    fishes: filtered(caughtStore.inNetFishes, search.net),
  },
  {
    key: "stored" as Side,
    title: "Kho",
    total: caughtStore.storedFishes.length,
    capacity: storageCapacity.value,
    fishes: filtered(caughtStore.storedFishes, search.stored),
  },
]);

function toggle(side: Side, id: string) {
  const set = selected[side];
  if (set.has(id)) set.delete(id);
  else set.add(id);
}

function selectAllVisible(side: Side) {
  const panel = panels.value.find((p) => p.key === side)!;
  const allSelected = panel.fishes.length > 0 && panel.fishes.every((f) => selected[side].has(f.id));
  panel.fishes.forEach((f) => (allSelected ? selected[side].delete(f.id) : selected[side].add(f.id)));
}

async function move(from: Side) {
  const ids = [...selected[from]];
  if (ids.length === 0 || isMoving.value) return;
  if (from === "net" && ids.length > remainingStorage.value) {
    toast.error(
      `Kho cá đã đạt giới hạn (${caughtStore.storedFishes.length}/${storageCapacity.value}). Có thể chuyển tối đa ${remainingStorage.value} cá.`,
    );
    return;
  }
  isMoving.value = true;
  try {
    await caughtStore.moveFishes(ids, from === "net" ? "normal" : "in-net");
    selected[from].clear();
    toast.success(from === "net" ? `Đã chuyển ${ids.length} cá vào kho` : `Đã chuyển ${ids.length} cá ra lưới`, {
      position: "bottom",
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể chuyển cá", { position: "bottom" });
  } finally {
    isMoving.value = false;
  }
}

async function finish() {
  isFinishing.value = true;
  try {
    await caughtStore.finishFishing();
    showConfirm.value = false;
    modalStore.close();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể kết thúc câu cá");
  } finally {
    isFinishing.value = false;
  }
}

onMounted(() => {
  if (caughtStore.caughtFishes.length === 0) caughtStore.loadCaughtFishes();
});
</script>

<template>
  <Modal title="Lưới cá" sub-title="Xử lý sau khi câu">
    <div class="flex h-full flex-col gap-2">
      <div class="flex min-h-0 grow flex-col gap-2 md:flex-row">
        <template v-for="(panel, index) in panels" :key="panel.key">
          <section class="flex min-w-0 flex-1 flex-col rounded-lg border border-emerald-900/15 bg-white">
            <div class="flex flex-wrap items-center gap-2 border-b border-emerald-900/10 p-2">
              <h3 class="m-0 text-sm font-bold text-emerald-950">
                {{ panel.title }} ({{ panel.total
                }}<template v-if="panel.key === 'stored'">/{{ panel.capacity }}</template
                >)
              </h3>
              <input
                v-model="search[panel.key]"
                type="search"
                placeholder="Tìm cá..."
                class="min-w-0 grow rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                class="rounded-md border border-emerald-900/15 px-2 py-1 text-xs font-bold hover:bg-emerald-50"
                @click="selectAllVisible(panel.key)"
              >
                Chọn tất cả
              </button>
              <div
                class="flex rounded-md border border-emerald-900/15 p-0.5 text-xs font-bold"
                role="group"
                aria-label="Chế độ xem"
              >
                <button
                  type="button"
                  class="rounded px-2 py-1"
                  :class="viewMode[panel.key] === 'list' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
                  :aria-pressed="viewMode[panel.key] === 'list'"
                  @click="viewMode[panel.key] = 'list'"
                >
                  Danh sách
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1"
                  :class="viewMode[panel.key] === 'grid' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
                  :aria-pressed="viewMode[panel.key] === 'grid'"
                  @click="viewMode[panel.key] = 'grid'"
                >
                  Lưới
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1"
                  :class="viewMode[panel.key] === 'species' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
                  :aria-pressed="viewMode[panel.key] === 'species'"
                  @click="viewMode[panel.key] = 'species'"
                >
                  Theo loài
                </button>
              </div>
            </div>

            <div class="grow h-0 overflow-y-auto p-2">
              <p v-if="caughtStore.isLoadingCaught" class="text-center text-sm text-gray-500">Đang tải...</p>
              <p v-else-if="panel.fishes.length === 0" class="text-center text-sm text-gray-500">Không có cá</p>

              <div v-else-if="viewMode[panel.key] === 'species'" class="flex flex-col gap-2">
                <section
                  v-for="group in groupedBySpecies(panel.fishes)"
                  :key="group.key"
                  class="overflow-hidden rounded-md border border-emerald-900/15 bg-[#f5f9f0]"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 p-2 text-left hover:bg-emerald-50"
                    :aria-expanded="expandedSpecies[panel.key].has(group.key)"
                    @click="toggleSpecies(panel.key, group.key)"
                  >
                    <img
                      :src="group.image || '/fish/VN/fish.jpg'"
                      :alt="group.name"
                      class="h-12 w-14 shrink-0 rounded object-cover"
                    />
                    <span class="min-w-0 grow truncate text-sm font-bold text-[#24352a]">{{ group.name }}</span>
                    <span class="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold"
                      >{{ group.fishes.length }} cá</span
                    >
                    <span aria-hidden="true" class="text-sm">{{
                      expandedSpecies[panel.key].has(group.key) ? "▴" : "▾"
                    }}</span>
                  </button>
                  <ul
                    v-if="expandedSpecies[panel.key].has(group.key)"
                    class="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto border-t border-emerald-900/10 p-2"
                  >
                    <li v-for="fish in group.fishes" :key="fish.id">
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 rounded-md border p-1 text-left transition-colors"
                        :class="
                          selected[panel.key].has(fish.id)
                            ? 'border-emerald-600 bg-emerald-100'
                            : 'border-gray-200 bg-white hover:bg-emerald-50'
                        "
                        @click="toggle(panel.key, fish.id)"
                      >
                        <img
                          :src="fish.species?.image || '/fish/VN/fish.jpg'"
                          :alt="fish.species?.name || 'Cá'"
                          class="h-9 w-12 shrink-0 rounded object-cover"
                        />
                        <span class="grow truncate text-xs font-bold">{{ fish.species?.name || "Cá" }}</span>
                        <span class="text-xs text-gray-600">{{ fish.weight }} kg</span>
                      </button>
                    </li>
                  </ul>
                </section>
              </div>

              <div
                v-else-if="viewMode[panel.key] === 'grid'"
                class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2"
              >
                <button
                  v-for="fish in panel.fishes"
                  :key="fish.id"
                  type="button"
                  class="flex flex-col items-center gap-1 rounded-md border p-1 text-center transition-colors"
                  :class="
                    selected[panel.key].has(fish.id)
                      ? 'border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500'
                      : 'border-gray-200 bg-gray-50 hover:bg-emerald-50'
                  "
                  @click="toggle(panel.key, fish.id)"
                >
                  <img
                    :src="fish.species?.image || '/fish/VN/fish.jpg'"
                    :alt="fish.species?.name || 'Cá'"
                    class="h-14 w-full rounded object-cover"
                  />
                  <span class="w-full truncate text-[11px] font-bold">{{ fish.species?.name }}</span>
                  <span class="text-[10px] text-gray-600">{{ fish.weight }} kg</span>
                </button>
              </div>

              <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
                <li v-for="fish in panel.fishes" :key="fish.id">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md border p-1 text-left transition-colors"
                    :class="
                      selected[panel.key].has(fish.id)
                        ? 'border-emerald-600 bg-emerald-100'
                        : 'border-gray-200 bg-gray-50 hover:bg-emerald-50'
                    "
                    @click="toggle(panel.key, fish.id)"
                  >
                    <img
                      :src="fish.species?.image || '/fish/VN/fish.jpg'"
                      :alt="fish.species?.name || 'Cá'"
                      class="h-10 w-14 shrink-0 rounded object-cover"
                    />
                    <span class="grow truncate text-sm font-bold">{{ fish.species?.name }}</span>
                    <span class="text-xs text-gray-600">{{ fish.weight }} kg</span>
                  </button>
                </li>
              </ul>
            </div>
          </section>

          <div
            v-if="index === 0"
            class="flex shrink-0 flex-row flex-wrap items-center justify-center gap-2 md:flex-col"
          >
            <div class="">
              <Hint text="Chọn cá rồi nhấn nút chuyển. Cá còn trong lưới khi kết thúc sẽ được thả." />
            </div>
            <button
              type="button"
              class="rounded-md w-full bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isMoving || selected.net.size === 0"
              @click="move('net')"
            >
              Chuyển vào kho ➜
            </button>
            <button
              type="button"
              class="rounded-md w-full bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isMoving || selected.stored.size === 0"
              @click="move('stored')"
            >
              ⬅ Chuyển ra lưới
            </button>
          </div>
        </template>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-md bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          :disabled="isFinishing"
          @click="showConfirm = true"
        >
          Kết thúc
        </button>
      </div>
    </div>

    <Teleport to="body">
      <TwoOptionsModal
        v-if="showConfirm"
        title="⚠️ Xác nhận"
        message="Kết thúc thì cá trong lưới sẽ được thả."
        sub-text="Bạn vui lòng chọn thao tác tiếp theo:"
        first-text="Hủy"
        second-text="Đồng ý"
        :on-first="
          () => {
            showConfirm = false;
          }
        "
        :on-second="finish"
      />
    </Teleport>
  </Modal>
</template>
