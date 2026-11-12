<script lang="ts" setup>
import type { PostProductionSide as Side } from "../../../types/model/postProduction";
import { t as tr } from "../../../i18n";

import { computed, onMounted, reactive, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Hint from "../../shared/Hint.vue";
import { useCaughtStore, type CaughtFish } from "../../../stores/caught.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import { useModalStore } from "../../../stores/modal.ts";
import { useToast } from "../../../composables/useToast.ts";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";

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
      group = { key, name: fish.species?.name || tr('PostProduction.chua_ro_loai'), image: fish.species?.image ?? null, fishes: [] };
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
    get title() { return tr('CaughtModal.luoi'); },
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
      tr('PostProduction.kho_ca_da_dat_gioi_han_value0_value1_co_the_chuyen_toi_da_value2', { value0: caughtStore.storedFishes.length, value1: storageCapacity.value, value2: remainingStorage.value }),
    );
    return;
  }
  isMoving.value = true;
  try {
    await caughtStore.moveFishes(ids, from === "net" ? "normal" : "in-net");
    selected[from].clear();
    toast.success(from === "net" ? tr('PostProduction.da_chuyen_value0_ca_vao_kho', { value0: ids.length }) : tr('PostProduction.da_chuyen_value0_ca_ra_luoi', { value0: ids.length }));
  } catch (err) {
    toast.error(err instanceof Error ? err.message : tr('PostProduction.khong_the_chuyen_ca'), { position: "bottom" });
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
    toast.error(err instanceof Error ? err.message : tr('PostProduction.khong_the_ket_thuc_cau_ca'));
  } finally {
    isFinishing.value = false;
  }
}

onMounted(() => {
  if (caughtStore.caughtFishes.length === 0) caughtStore.loadCaughtFishes();
});
</script>

<template>
  <Modal :title="tr('PostProduction.luoi_ca')" :sub-title="tr('PostProduction.xu_ly_sau_khi_cau')" :on-refresh="caughtStore.loadCaughtFishes">
    <div class="flex h-full flex-col gap-2">
      <div class="flex min-h-0 grow flex-col gap-2 md:flex-row">
        <template v-for="(panel, index) in panels" :key="panel.key">
          <section class="slide-fade-in from-bottom player-content-in flex min-w-0 flex-1 flex-col rounded-lg border border-emerald-900/15 bg-white">
            <div class="flex flex-wrap items-center gap-2 border-b border-emerald-900/10 p-2">
              <div class="m-0 text-sm font-bold text-emerald-950">
                {{ panel.title }} ({{ panel.total
                }}<template v-if="panel.key === 'stored'">/{{ panel.capacity }}</template
                >)
              </div>
              <input
                v-model="search[panel.key]"
                type="search"
                :placeholder="tr('PostProduction.tim_ca')"
                class="min-w-0 grow rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                class="rounded-md border border-emerald-900/15 px-2 py-1 text-xs font-bold hover:bg-emerald-50"
                @click="selectAllVisible(panel.key)"
              >
                {{ tr('PostProduction.chon_tat_ca') }}
              </button>
              <div
                class="flex rounded-md border border-emerald-900/15 p-0.5 text-xs font-bold"
                role="group"
                :aria-label="tr('PostProduction.che_do_xem')"
              >
                <button
                  type="button"
                  class="rounded px-2 py-1"
                  :class="viewMode[panel.key] === 'list' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
                  :aria-pressed="viewMode[panel.key] === 'list'"
                  @click="viewMode[panel.key] = 'list'"
                >
                  {{ tr('CaughtModal.danh_sach') }}
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1"
                  :class="viewMode[panel.key] === 'grid' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
                  :aria-pressed="viewMode[panel.key] === 'grid'"
                  @click="viewMode[panel.key] = 'grid'"
                >
                  {{ tr('CaughtModal.luoi') }}
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1"
                  :class="viewMode[panel.key] === 'species' ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-50'"
                  :aria-pressed="viewMode[panel.key] === 'species'"
                  @click="viewMode[panel.key] = 'species'"
                >
                  {{ tr('CaughtModal.theo_loai') }}
                </button>
              </div>
            </div>

            <div class="grow h-0 overflow-y-auto p-2">
              <div v-if="caughtStore.isLoadingCaught" class="text-center text-sm text-gray-500">{{ tr('WeatherSection.dang_tai') }}</div>
              <div v-else-if="panel.fishes.length === 0" class="text-center text-sm text-gray-500">{{ tr('PostProduction.khong_co_ca') }}</div>

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
                      >{{ group.fishes.length }} {{ tr('Fishfarm.ca_2') }}</span
                    >
                    <span aria-hidden="true" class="text-sm">{{
                      expandedSpecies[panel.key].has(group.key) ? "▴" : "▾"
                    }}</span>
                  </button>
                  <div
                    v-if="expandedSpecies[panel.key].has(group.key)"
                    class="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto border-t border-emerald-900/10 p-2"
                  >
                    <div v-for="fish in group.fishes" :key="fish.id">
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
                          :alt="fish.species?.name || tr('CaughtModal.ca')"
                          class="h-9 w-12 shrink-0 rounded object-cover"
                        />
                        <span class="grow truncate text-xs font-bold">{{ fish.species?.name || tr('CaughtModal.ca') }}</span>
                        <span class="text-xs text-gray-600">{{ fish.weight }} kg</span>
                      </button>
                    </div>
                  </div>
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
                    :alt="fish.species?.name || tr('CaughtModal.ca')"
                    class="h-14 w-full rounded object-cover"
                  />
                  <span class="w-full truncate text-[11px] font-bold">{{ fish.species?.name }}</span>
                  <span class="text-[10px] text-gray-600">{{ fish.weight }} kg</span>
                </button>
              </div>

              <div v-else class="m-0 flex list-none flex-col gap-1 p-0">
                <div v-for="fish in panel.fishes" :key="fish.id">
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
                      :alt="fish.species?.name || tr('CaughtModal.ca')"
                      class="h-10 w-14 shrink-0 rounded object-cover"
                    />
                    <span class="grow truncate text-sm font-bold">{{ fish.species?.name }}</span>
                    <span class="text-xs text-gray-600">{{ fish.weight }} kg</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div
            v-if="index === 0"
            class="flex shrink-0 flex-row flex-wrap items-center justify-center gap-2 md:flex-col"
          >
            <div class="">
              <Hint :text="tr('PostProduction.chon_ca_roi_nhan_nut_chuyen_ca_con_trong_luoi_khi_ket_thuc_se_du')" />
            </div>
            <button
              type="button"
              class="rounded-md w-full bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isMoving || selected.net.size === 0"
              @click="move('net')"
            >
              {{ tr('PostProduction.chuyen_vao_kho') }}
            </button>
            <button
              type="button"
              class="rounded-md w-full bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isMoving || selected.stored.size === 0"
              @click="move('stored')"
            >
              {{ tr('PostProduction.chuyen_ra_luoi') }}
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
          {{ tr('PostProduction.ket_thuc') }}
        </button>
      </div>
    </div>

    <Teleport to="body">
      <TwoOptionsModal
        v-if="showConfirm"
        :title="tr('PostProduction.xac_nhan')"
        :message="tr('PostProduction.ket_thuc_thi_ca_trong_luoi_se_duoc_tha')"
        :sub-text="tr('PostProduction.ban_vui_long_chon_thao_tac_tiep_theo')"
        :first-text="tr('AccountInfoModal.huy')"
        :second-text="tr('PostProduction.dong_y')"
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
