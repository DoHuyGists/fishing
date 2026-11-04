<script setup lang="ts">
import { useUserTurnsStore } from "../../../stores/userTurns";
import { useInformationModal } from "../../../composables/useInformationModal";

const { open } = useInformationModal();
function showInformation() {
  open({
    name: "Lượt câu",
    image: "/items/rod/fishing-rob.png",
    description: "Lượt câu dùng để thực hiện các lần câu cá. Khi chưa đạt giới hạn, bạn được hồi 1 lượt sau mỗi 5 phút. Đồng hồ bên cạnh cho biết thời gian còn lại đến lượt hồi tiếp theo.",
  });
}

const userTurnsStore = useUserTurnsStore();
</script>

<template>
  <button type="button" class="flex flex-wrap items-center gap-1 text-sm bg-white rounded-full px-2 cursor-pointer" aria-live="polite" aria-label="Thông tin về lượt câu" @click.stop="showInformation">
    <span class="font-bold">
      {{ userTurnsStore.status?.turns ?? "—" }} / {{ userTurnsStore.status?.max_turns ?? "—" }}
    </span>
    <span aria-hidden="true">🎣</span>
    <span v-if="userTurnsStore.status && userTurnsStore.status.turns < userTurnsStore.status.max_turns" class="text-xs w-20 text-[#617565]">
      +1 sau {{ userTurnsStore.countdown }}
    </span>
    <span v-else-if="userTurnsStore.error" class="text-xs text-red-700">Không tải được</span>
  </button>
</template>
