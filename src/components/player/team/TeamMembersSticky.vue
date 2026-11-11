<script setup lang="ts">
import { t as tr } from "../../../i18n";

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
    :aria-label="tr('TeamMembersSticky.thanh_vien_to_doi')"
  >
    <button
      v-for="member in members"
      :key="member.id"
      type="button"
      class="relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#cbd9c6] bg-[#3b7a57] text-xs font-extrabold text-white shadow-sm transition hover:scale-105 hover:border-[#3b7a57] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b7a57]"
      :title="tr('TeamMembersSticky.value0_value1', { value0: member.user_id.slice(0, 8), value1: member.role === 'LEADER' ? tr('TeamMembersSticky.truong_nhom') : '' })"
      :aria-label="tr('TeamMembersSticky.value0_value1_mo_to_doi', { value0: member.user_id.slice(0, 8), value1: member.role === 'LEADER' ? tr('TeamMembersSticky.truong_nhom_2') : '' })"
      @click="emit('openTeam')"
    >
      {{ member.user_id.slice(0, 2).toUpperCase() }}
      <span v-if="member.role === 'LEADER'" class="absolute -right-1 -top-1 text-[0.7rem]" aria-hidden="true">
        👑
      </span>
    </button>
  </aside>
</template>
