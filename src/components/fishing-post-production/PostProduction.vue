<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import Modal from "../Modal.vue";
import Hint from "../Hint.vue";
import { useCaughtStore, type CaughtFish } from "../../stores/caught";
import { useModalStore } from "../../stores/modal";
import { useToast } from "../../composables/useToast";

type Side = "net" | "stored";

const caughtStore = useCaughtStore();
const modalStore = useModalStore();
const toast = useToast();

const search = reactive<Record<Side, string>>({ net: "", stored: "" });
const viewMode = reactive<Record<Side, "grid" | "list">>({ net: "grid", stored: "grid" });
const selected = reactive<Record<Side, Set<string>>>({ net: new Set(), stored: new Set() });
const isMoving = ref(false);
const isFinishing = ref(false);
const showConfirm = ref(false);

function filtered(fishes: CaughtFish[], keyword: string) {
  const k = keyword.trim().toLowerCase();
  if (!k) return fishes;
  return fishes.filter((f) => f.species?.name?.toLowerCase().includes(k));
}

const panels = computed(() => [
  {
    key: "net" as Side,
    title: "Cá trong lưới",
    total: caughtStore.inNetFishes.length,
    fishes: filtered(caughtStore.inNetFishes, search.net),
  },
  {
    key: "stored" as Side,
    title: "Cá trong kho",
    total: caughtStore.storedFishes.length,
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
  isMoving.value = true;
  try {
    await caughtStore.moveFishes(ids, from === "net" ? "normal" : "in-net");
    selected[from].clear();
    toast.success(from === "net" ? `Đã chuyển ${ids.length} cá vào kho` : `Đã chuyển ${ids.length} cá ra lưới`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không thể chuyển cá");
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
      <div class="flex items-center gap-2 text-xs text-emerald-900">
        <Hint text="Chọn cá rồi nhấn nút chuyển. Cá còn trong lưới khi kết thúc sẽ bị thả." />
        <span>Chọn cá và chuyển giữa lưới và kho.</span>
      </div>

      <div class="flex min-h-0 grow gap-2">
        <template v-for="(panel, index) in panels" :key="panel.key">
          <section class="flex min-w-0 flex-1 flex-col rounded-lg border border-emerald-900/15 bg-white">
            <div class="flex flex-wrap items-center gap-2 border-b border-emerald-900/10 p-2">
              <h3 class="m-0 text-sm font-bold text-emerald-950">
                {{ panel.title }} ({{ panel.total }})
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
              <button
                type="button"
                class="rounded-md border border-emerald-900/15 px-2 py-1 text-xs font-bold hover:bg-emerald-50"
                :aria-label="viewMode[panel.key] === 'grid' ? 'Chuyển sang dạng danh sách' : 'Chuyển sang dạng lưới'"
                @click="viewMode[panel.key] = viewMode[panel.key] === 'grid' ? 'list' : 'grid'"
              >
                {{ viewMode[panel.key] === "grid" ? "☰ Danh sách" : "▦ Lưới" }}
              </button>
            </div>

            <div class="grow h-0 overflow-y-auto p-2">
              <p v-if="caughtStore.isLoadingCaught" class="text-center text-sm text-gray-500">Đang tải...</p>
              <p v-else-if="panel.fishes.length === 0" class="text-center text-sm text-gray-500">Không có cá</p>

              <div v-else-if="viewMode[panel.key] === 'grid'" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <button
                  v-for="fish in panel.fishes"
                  :key="fish.id"
                  type="button"
                  class="flex flex-col items-center gap-1 rounded-md border p-1 text-center transition-colors"
                  :class="selected[panel.key].has(fish.id)
                    ? 'border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500'
                    : 'border-gray-200 bg-gray-50 hover:bg-emerald-50'"
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
                    :class="selected[panel.key].has(fish.id)
                      ? 'border-emerald-600 bg-emerald-100'
                      : 'border-gray-200 bg-gray-50 hover:bg-emerald-50'"
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

          <div v-if="index === 0" class="flex shrink-0 flex-col justify-center gap-2">
            <button
              type="button"
              class="rounded-md bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isMoving || selected.net.size === 0"
              @click="move('net')"
            >
              Chuyển vào kho ➜
            </button>
            <button
              type="button"
              class="rounded-md bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
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

    <div v-if="showConfirm" class="fixed inset-0 z-10000 flex items-center justify-center bg-black/50">
      <div class="w-80 rounded-lg bg-white p-4 shadow-xl">
        <h3 class="m-0 mb-2 text-lg font-bold">Xác nhận</h3>
        <p class="m-0 mb-4 text-sm">Kết thúc thì cá trong lưới sẽ được thả.</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-bold hover:bg-gray-50"
            :disabled="isFinishing"
            @click="showConfirm = false"
          >
            Hủy
          </button>
          <button
            type="button"
            class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            :disabled="isFinishing"
            @click="finish"
          >
            {{ isFinishing ? "Đang xử lý..." : "Đồng ý" }}
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>
