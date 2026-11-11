<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { useUserTurnsStore } from "../../../stores/userTurns";
import { useInformationModal } from "../../../composables/useInformationModal";

const { open } = useInformationModal();
function showInformation() {
  open({
    get name() { return tr('UserTurn.luot_cau'); },
    image: "/items/rod/fishing-rob.png",
    get description() { return tr('UserTurn.luot_cau_dung_de_thuc_hien_cac_lan_cau_ca_khi_chua_dat_gioi_han_'); },
  });
}

const userTurnsStore = useUserTurnsStore();
</script>

<template>
  <button type="button" class="flex flex-wrap items-center gap-1 bg-white rounded-full px-2 cursor-pointer" aria-live="polite" :aria-label="tr('UserTurn.thong_tin_ve_luot_cau')" @click.stop="showInformation">
    <span class="font-bold">
      {{ userTurnsStore.status?.turns ?? "—" }} / {{ userTurnsStore.status?.max_turns ?? "—" }}
    </span>
    <span aria-hidden="true">🎣</span>
    <span v-if="userTurnsStore.status && userTurnsStore.status.turns < userTurnsStore.status.max_turns" class="text-xs w-20 text-[#617565]">
      {{ tr('UserTurn.1_sau') }} {{ userTurnsStore.countdown }}
    </span>
    <span v-else-if="userTurnsStore.error" class="text-xs text-red-700">{{ tr('UserTurn.khong_tai_duoc') }}</span>
  </button>
</template>
