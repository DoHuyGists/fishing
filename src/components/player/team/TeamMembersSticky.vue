<script setup lang="ts">
import type { UserTeamMember } from "../../../data/supabaseTeamRepository.ts";

defineProps<{
  members: UserTeamMember[];
}>();

const emit = defineEmits<{
  openTeam: [];
}>();
</script>

<template>
  <aside
    v-if="members.length"
    class="fixed right-2 top-1/2 z-40 flex max-h-[70vh] -translate-y-1/2 flex-col items-center gap-2 overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0]/95 p-2 shadow-lg backdrop-blur-sm sm:right-4"
    aria-label="Thành viên tổ đội"
  >
    <button
      v-for="member in members"
      :key="member.id"
      type="button"
      class="relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#cbd9c6] bg-[#3b7a57] text-xs font-extrabold text-white shadow-sm transition hover:scale-105 hover:border-[#3b7a57] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b7a57]"
      :title="`${member.user_id.slice(0, 8)}${member.role === 'LEADER' ? ' · Trưởng nhóm' : ''}`"
      :aria-label="`${member.user_id.slice(0, 8)}${member.role === 'LEADER' ? ', trưởng nhóm' : ''}. Mở tổ đội`"
      @click="emit('openTeam')"
    >
      {{ member.user_id.slice(0, 2).toUpperCase() }}
      <span v-if="member.role === 'LEADER'" class="absolute -right-1 -top-1 text-[0.7rem]" aria-hidden="true">
        👑
      </span>
    </button>
  </aside>
</template>
