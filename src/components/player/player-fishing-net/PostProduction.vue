<script lang="ts" setup>
import type { CaughtFish } from "../../../types/model/caughtFish";
import type { PostProductionSide as Side } from "../../../types/model/postProduction.ts";
import { t as tr } from "../../../i18n/index.ts";

import { computed, onMounted, reactive, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import Hint from "../../shared/Hint.vue";
import { useCaughtStore } from "../../../stores/player-caught-store.ts";
import { useUserProfileStore } from "../../../stores/player-user-profile-store.ts";
import { useModalStore } from "../../../stores/player-modal-store.ts";
import { useToast } from "../../../composables/useToast.ts";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import PostProductionPanel from "./PostProductionPanel.vue";

const caughtStore = useCaughtStore();
const userProfileStore = useUserProfileStore();
const modalStore = useModalStore();
const toast = useToast();

const selected = reactive<Record<Side, Set<string>>>({ net: new Set(), stored: new Set() });
const isMoving = ref(false);
const isFinishing = ref(false);
const showConfirm = ref(false);
const storageCapacity = computed(() => userProfileStore.speciesStorageCapacity);
const remainingStorage = computed(() => Math.max(0, storageCapacity.value - caughtStore.storedFishes.length));

const panels = computed(() => [
  {
    key: "net" as Side,
    get title() {
      return tr("CaughtModal.luoi");
    },
    fishes: caughtStore.inNetFishes,
  },
  {
    key: "stored" as Side,
    title: tr("PostProduction.kho_ca"),
    capacity: storageCapacity.value,
    fishes: caughtStore.storedFishes,
  },
]);

function toggle(side: Side, id: string) {
  const set = selected[side];
  if (set.has(id)) set.delete(id);
  else set.add(id);
}

function selectAllVisible(side: Side, fishes: CaughtFish[]) {
  const allSelected = fishes.length > 0 && fishes.every((fish) => selected[side].has(fish.id));
  fishes.forEach((fish) => (allSelected ? selected[side].delete(fish.id) : selected[side].add(fish.id)));
}

async function move(from: Side) {
  const ids = [...selected[from]];
  if (ids.length === 0 || isMoving.value) return;
  if (from === "net" && ids.length > remainingStorage.value) {
    toast.error(
      tr("PostProduction.kho_ca_da_dat_gioi_han_value0_value1_co_the_chuyen_toi_da_value2", {
        value0: caughtStore.storedFishes.length,
        value1: storageCapacity.value,
        value2: remainingStorage.value,
      }),
    );
    return;
  }
  isMoving.value = true;
  try {
    await caughtStore.moveFishes(ids, from === "net" ? "normal" : "in-net");
    selected[from].clear();
    toast.success(
      from === "net"
        ? tr("PostProduction.da_chuyen_value0_ca_vao_kho", { value0: ids.length })
        : tr("PostProduction.da_chuyen_value0_ca_ra_luoi", { value0: ids.length }),
    );
  } catch (err) {
    toast.error(err instanceof Error ? err.message : tr("PostProduction.khong_the_chuyen_ca"), { position: "bottom" });
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
    toast.error(err instanceof Error ? err.message : tr("PostProduction.khong_the_ket_thuc_cau_ca"));
  } finally {
    isFinishing.value = false;
  }
}

onMounted(() => {
  if (caughtStore.caughtFishes.length === 0) caughtStore.loadCaughtFishes();
});
</script>

<template>
  <Modal :title="tr('PostProduction.luoi_ca')" :on-refresh="caughtStore.loadCaughtFishes">
    <div class="flex h-full flex-col gap-2">
      <div class="flex min-h-0 grow flex-col gap-2 md:flex-row">
        <template v-for="(panel, index) in panels" :key="panel.key">
          <PostProductionPanel
            :title="panel.title"
            :fishes="panel.fishes"
            :capacity="panel.capacity"
            :selected="selected[panel.key]"
            :is-loading="caughtStore.isLoadingCaught"
            @toggle="toggle(panel.key, $event)"
            @select-all="selectAllVisible(panel.key, $event)"
          />

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
              {{ tr("PostProduction.chuyen_vao_kho") }}
            </button>
            <button
              type="button"
              class="rounded-md w-full bg-[#153221] px-3 py-2 text-sm font-bold text-white hover:bg-[#1a3e29] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isMoving || selected.stored.size === 0"
              @click="move('stored')"
            >
              {{ tr("PostProduction.chuyen_ra_luoi") }}
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
          {{ tr("PostProduction.ket_thuc") }}
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
