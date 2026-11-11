<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { ref } from "vue";
import PlayerIdentity from "../../shared/PlayerIdentity.vue";
import type { FriendUserProfile } from "../../../data/supabaseFriendRepository";
import type { UserTeam, UserTeamInvite, UserTeamMember } from "../../../data/supabaseTeamRepository";

defineProps<{
  profiles: Map<string, FriendUserProfile>;
  team: UserTeam | null;
  members: UserTeamMember[];
  invites: UserTeamInvite[];
  userId: string;
  isLeader: boolean;
  actionLoading: boolean;
}>();
const emit = defineEmits<{
  invite: [inviteeId: string, done: (ok: boolean) => void];
  respondInvite: [inviteId: string, accept: boolean];
  edit: [];
  close: [];
  leave: [];
  transfer: [memberId: string];
  kick: [memberId: string];
  create: [];
}>();
const tab = ref<"team" | "invites">("team");
const showInviteForm = ref(false);
const inviteeId = ref("");

function submitInvite() {
  const id = inviteeId.value.trim();
  if (!id) return;
  emit("invite", id, (ok) => {
    if (!ok) return;
    inviteeId.value = "";
    showInviteForm.value = false;
  });
}

const statusLabel: Record<string, string> = {
  get PENDING() { return tr('MyTeamPanel.cho_duyet'); },
  get OPEN() { return tr('MyTeamPanel.mo'); },
  get FULL() { return tr('MyTeamPanel.day'); },
  get FISHING() { return tr('MyTeamPanel.dang_cau'); },
  get CLOSED() { return tr('Feedbackmodal.da_dong'); },
};
const statusClass: Record<string, string> = {
  PENDING: "bg-[#f0e0e0] text-[#8a2020]",
  OPEN: "bg-[#d4f4dd] text-[#1a6e35]",
  FULL: "bg-[#fde8cc] text-[#8a4500]",
  FISHING: "bg-[#dceeff] text-[#1a4fa0]",
  CLOSED: "bg-[#f0e0e0] text-[#8a2020]",
};
</script>

<template>
  <div class="flex flex-col gap-4">
  <div class="flex gap-2 border-b border-[#cbd9c6]">
    <button
      v-for="item in [
        { key: 'team', get label() { return tr('MyTeamPanel.to_doi_cua_toi'); } },
        { key: 'invites', label: tr('MyTeamPanel.loi_moi_value0', { value0: invites.length }) },
      ] as const"
      :key="item.key"
      :class="[
        '-mb-px border-b-2 px-3 py-2 text-[0.85rem] font-bold',
        tab === item.key ? 'border-[#3b7a57] text-[#3b7a57]' : 'border-transparent text-[#556655]',
      ]"
      @click="tab = item.key"
    >
      {{ item.label }}
    </button>
  </div>
  <section v-if="tab === 'invites'" class="flex flex-col gap-3">
    <div
      v-if="invites.length === 0"
      class="m-0 rounded-2xl border border-dashed border-[#cbd9c6] bg-[#f5f9f0] p-6 text-center text-sm text-[#556655]"
    >
      {{ tr('MyTeamPanel.ban_chua_co_loi_moi_nao') }}
    </div>
    <div v-else class="m-0 flex list-none flex-col gap-3 p-0">
      <div v-for="invite in invites" :key="invite.id" class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3">
        <div class="m-0 font-bold text-[#24352a]">{{ invite.team?.name ?? tr('MyTeamPanel.to_doi_khong_ton_tai') }}</div>
        <div v-if="invite.team?.description" class="m-0 text-[0.8rem] text-[#556655]">{{ invite.team.description }}</div>
        <div class="m-0 mt-1 text-[0.75rem] text-[#556655]">
          {{ tr('MyTeamPanel.nguoi_moi') }}
          <PlayerIdentity :user-id="invite.inviter_id" :profile="profiles.get(invite.inviter_id)" class="my-2" />
          {{ new Date(invite.created_at).toLocaleString(getFormattingLocale()) }}
        </div>
        <div class="mt-2 flex justify-end gap-2">
          <button
            :disabled="actionLoading"
            class="rounded-lg border border-[#f5b7b1] bg-[#fde8e8] px-3 py-1 text-xs font-bold text-[#c0392b]"
            @click="emit('respondInvite', invite.id, false)"
          >
            {{ tr('FriendModal.tu_choi') }}
          </button>
          <button
            :disabled="actionLoading || !!team"
            :title="team ? tr('MyTeamPanel.hay_roi_to_doi_hien_tai_truoc') : ''"
            class="rounded-lg bg-[#3b7a57] px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
            @click="emit('respondInvite', invite.id, true)"
          >
            {{ tr('MyTeamPanel.chap_nhan') }}
          </button>
        </div>
      </div>
    </div>
  </section>
  <template v-else>
  <section v-if="team" class="flex flex-col gap-4">
    <div
      class="flex items-start justify-between gap-3 rounded-2xl border border-[#b8dab0] bg-linear-to-br from-[#e8f5e2] to-[#d4edcc] p-4"
    >
      <div>
        <div class="m-0 mb-1 text-[1.1rem] font-extrabold text-[#1a3a1a]">{{ team.name }}</div>
        <div v-if="team.description" class="m-0 mb-2 text-[0.82rem] text-[#556655]">{{ team.description }}</div>
        <span :class="['inline-block rounded-full px-2 py-1 text-[0.72rem] font-bold', statusClass[team.status]]">{{
          statusLabel[team.status]
        }}</span>
      </div>
      <span class="font-bold text-[#2e6644]">{{ members.length }} / {{ team.max_members }}</span>
    </div>
    <div class="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      <div v-for="member in members" :key="member.id" class="rounded-xl border border-[#daefd4] bg-white p-3">
        <PlayerIdentity :user-id="member.user_id" :profile="member.user_profile">
            <span class="text-[0.72rem] font-bold text-[#2e6644]">{{
              member.role === "LEADER" ? tr('MyTeamPanel.truong_nhom') : tr('MyTeamPanel.thanh_vien')
            }}</span>
        </PlayerIdentity>
        <div
          v-if="isLeader && member.user_id !== userId"
          class="mt-3 flex justify-end gap-2 border-t border-[#e3eee0] pt-2"
        >
          <button
            :disabled="actionLoading"
            class="rounded-lg border border-[#c0d8b8] px-2 py-1 text-xs"
            :title="tr('MyTeamPanel.chuyen_quyen')"
            @click="emit('transfer', member.user_id)"
          >
            👑</button
          ><button
            :disabled="actionLoading"
            class="rounded-lg border border-[#f5b7b1] bg-[#fde8e8] px-2 py-1 text-xs text-[#c0392b]"
            @click="emit('kick', member.user_id)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
    <form
      v-if="isLeader && team.join_type === 'invited' && showInviteForm"
      class="flex flex-wrap gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3"
      @submit.prevent="submitInvite"
    >
      <input
        v-model="inviteeId"
        :placeholder="tr('MyTeamPanel.nhap_id_nguoi_choi')"
        class="min-w-0 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 font-mono text-[0.85rem] text-[#24352a]"
      />
      <button
        type="submit"
        :disabled="actionLoading || !inviteeId.trim()"
        class="rounded-lg bg-[#3b7a57] px-4 py-2 text-[0.85rem] font-bold text-white disabled:opacity-50"
      >
        {{ tr('MyTeamPanel.moi') }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-[#cbd9c6] px-3 py-2 text-[0.85rem] text-[#24352a]"
        @click="showInviteForm = false"
      >
        {{ tr('AccountInfoModal.huy') }}
      </button>
    </form>
    <div class="flex flex-wrap justify-end gap-2">
      <button
        v-if="isLeader && team.join_type === 'invited'"
        :disabled="actionLoading"
        class="rounded-lg bg-[#3b7a57] px-4 py-2 text-[0.85rem] font-bold text-white"
        @click="showInviteForm = true"
      >
        {{ tr('MyTeamPanel.moi_nguoi_choi') }}</button
      ><button
        v-if="isLeader"
        :disabled="actionLoading"
        class="rounded-lg border border-[#3b7a57] px-4 py-2 text-[0.85rem] font-bold text-[#3b7a57]"
        @click="emit('edit')"
      >
        {{ tr('MyTeamPanel.cap_nhat_to_doi') }}</button
      ><button
        v-if="isLeader"
        :disabled="actionLoading"
        class="rounded-lg border border-[#f5b7b1] bg-[#fde8e8] px-4 py-2 text-[0.85rem] font-bold text-[#c0392b]"
        @click="emit('close')"
      >
        {{ tr('MyTeamPanel.huy_nhom') }}</button
      ><button
        :disabled="actionLoading"
        class="rounded-lg border border-[#3b7a57] px-4 py-2 text-[0.85rem] font-bold text-[#3b7a57]"
        @click="emit('leave')"
      >
        {{ tr('MyTeamPanel.roi_nhom') }}
      </button>
    </div>
  </section>
  <section
    v-else
    class="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c0d8b8] bg-[#fafefc] p-6 text-center"
  >
    <div class="m-0 text-lg font-bold text-[#1a3a1a]">{{ tr('MyTeamPanel.ban_chua_tham_gia_to_doi') }}</div>
    <div class="mb-4 text-sm text-[#556655]">{{ tr('MyTeamPanel.chon_mot_to_doi_o_ben_trai_hoac_tu_tao_to_doi_moi') }}</div>
    <button class="rounded-lg bg-[#3b7a57] px-4 py-2 text-sm font-bold text-white" @click="emit('create')">
      {{ tr('MyTeamPanel.tao_nhom') }}
    </button>
  </section>
  </template>
  </div>
</template>
