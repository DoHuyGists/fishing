<script setup lang="ts">
import { useUserTurnsStore } from "../../stores/userTurns";

const userTurnsStore = useUserTurnsStore();
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2 rounded-lg border border-[#cbd9c6] bg-white/70 px-3 py-1.5 text-sm text-[#24352a]"
    aria-live="polite"
  >
    <span aria-hidden="true">🎣</span>
    <span class="font-semibold">Lượt câu</span>
    <span class="font-bold">
      {{ userTurnsStore.status?.turns ?? "—" }} / {{ userTurnsStore.status?.max_turns ?? "—" }}
    </span>
    <span
      v-if="userTurnsStore.status && userTurnsStore.status.turns < userTurnsStore.status.max_turns"
      class="text-xs text-[#617565]"
    >
      +1 sau {{ userTurnsStore.countdown }}
    </span>
    <span v-else-if="userTurnsStore.error" class="text-xs text-red-700">Không tải được</span>
  </div>
</template>
