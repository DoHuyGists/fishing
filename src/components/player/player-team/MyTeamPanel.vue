<script lang="ts" setup>
import type { PlayerProfileSummary } from "../../../types/model/friend";
import { useTeamStore } from "../../../stores/player-team-store.ts";
import Pagination from "../../shared/Pagination.vue";
import type { UserTeam, UserTeamInvite, UserTeamMember } from "../../../types/model/team";
import { getFormattingLocale } from "../../../i18n";
import { t as tr } from "../../../i18n";

import { ref } from "vue";
import PlayerIdentity from "../../shared/PlayerIdentity.vue";

defineProps<{
  profiles: Map<string, PlayerProfileSummary>;
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
const store = useTeamStore();
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
  get PENDING() {
    return tr("MyTeamPanel.cho_duyet");
  },
  get OPEN() {
    return tr("MyTeamPanel.mo");
  },
  get FULL() {
    return tr("MyTeamPanel.day");
  },
  get FISHING() {
    return tr("MyTeamPanel.dang_cau");
  },
  get CLOSED() {
    return tr("Feedbackmodal.da_dong");
  },
};
const statusClass: Record<string, string> = {
  PENDING: "bg-surface text-danger",
  OPEN: "bg-surface text-content",
  FULL: "bg-surface text-gold",
  FISHING: "bg-surface text-primary",
  CLOSED: "bg-surface text-danger",
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 border-b border-border-default">
      <button
        v-for="item in [
          {
            key: 'team',
            get label() {
              return tr('MyTeamPanel.to_doi_cua_toi');
            },
          },
          { key: 'invites', label: tr('MyTeamPanel.loi_moi_value0', { value0: store.inviteTotal }) },
        ] as const"
        :key="item.key"
        :class="[
          '-mb-px border-b-2 px-3 py-2 text-[0.85rem] font-bold',
          tab === item.key ? 'border-brand text-brand' : 'border-transparent text-content-caption',
        ]"
        @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </div>
    <section v-if="tab === 'invites'" class="flex flex-col gap-3">
      <div
        v-if="invites.length === 0"
        class="m-0 rounded-2xl border border-dashed border-border-default bg-surface p-6 text-center text-sm text-content-caption"
      >
        {{ tr("MyTeamPanel.ban_chua_co_loi_moi_nao") }}
      </div>
      <div v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <div
          v-for="invite in invites"
          :key="invite.id"
          class="slide-fade-in from-bottom player-content-in rounded-xl border border-border-default bg-surface p-3"
        >
          <div class="m-0 font-bold text-content">
            {{ invite.team?.name ?? tr("MyTeamPanel.to_doi_khong_ton_tai") }}
          </div>
          <div v-if="invite.team?.description" class="m-0 text-[0.8rem] text-content-caption">
            {{ invite.team.description }}
          </div>
          <div class="m-0 mt-1 text-[0.75rem] text-content-caption">
            {{ tr("MyTeamPanel.nguoi_moi") }}
            <PlayerIdentity :user-id="invite.inviter_id" :profile="profiles.get(invite.inviter_id)" class="my-2" />
            {{ new Date(invite.created_at).toLocaleString(getFormattingLocale()) }}
          </div>
          <div class="mt-2 flex justify-end gap-2">
            <button
              :disabled="actionLoading"
              class="rounded-lg border border-surface bg-surface px-3 py-1 text-xs font-bold text-danger"
              @click="emit('respondInvite', invite.id, false)"
            >
              {{ tr("FriendModal.tu_choi") }}
            </button>
            <button
              :disabled="actionLoading || !!team"
              :title="team ? tr('MyTeamPanel.hay_roi_to_doi_hien_tai_truoc') : ''"
              class="rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
              @click="emit('respondInvite', invite.id, true)"
            >
              {{ tr("MyTeamPanel.chap_nhan") }}
            </button>
          </div>
        </div>
      </div>
      <Pagination
        :page="store.invitePage"
        :page-size="store.invitePageSize"
        :total="store.inviteTotal"
        :loading="store.actionLoading"
        @change="
          store.invitePage = $event;
          store.loadMyTeam(userId);
        "
      />
    </section>
    <template v-else>
      <section v-if="team" class="flex flex-col gap-4">
        <div
          class="slide-fade-in from-top player-content-in flex items-start justify-between gap-3 rounded-2xl border border-border bg-linear-to-br from-surface to-surface p-4"
        >
          <div>
            <div class="m-0 mb-1 text-[1.1rem] font-extrabold text-content">{{ team.name }}</div>
            <div v-if="team.description" class="m-0 mb-2 text-[0.82rem] text-content-caption">{{ team.description }}</div>
            <span :class="['inline-block rounded-full px-2 py-1 text-[0.72rem] font-bold', statusClass[team.status]]">{{
              statusLabel[team.status]
            }}</span>
          </div>
          <span class="font-bold text-content">{{ members.length }} / {{ team.max_members }}</span>
        </div>
        <div class="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          <div
            v-for="member in members"
            :key="member.id"
            class="slide-fade-in from-bottom player-content-in rounded-xl border border-border bg-white p-3"
          >
            <PlayerIdentity :user-id="member.user_id" :profile="member.user_profile">
              <span class="text-[0.72rem] font-bold text-content">{{
                member.role === "LEADER" ? tr("MyTeamPanel.truong_nhom") : tr("MyTeamPanel.thanh_vien")
              }}</span>
            </PlayerIdentity>
            <div
              v-if="isLeader && member.user_id !== userId"
              class="mt-3 flex justify-end gap-2 border-t border-border pt-2"
            >
              <button
                :disabled="actionLoading"
                class="rounded-lg border border-border px-2 py-1 text-xs"
                :title="tr('MyTeamPanel.chuyen_quyen')"
                @click="emit('transfer', member.user_id)"
              >
                👑</button
              ><button
                :disabled="actionLoading"
                class="rounded-lg border border-surface bg-surface px-2 py-1 text-xs text-danger"
                @click="emit('kick', member.user_id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        <form
          v-if="isLeader && team.join_type === 'invited' && showInviteForm"
          class="flex flex-wrap gap-2 slide-fade-in from-bottom player-content-in rounded-xl border border-border-default bg-surface p-3"
          @submit.prevent="submitInvite"
        >
          <input
            v-model="inviteeId"
            :placeholder="tr('MyTeamPanel.nhap_id_nguoi_choi')"
            class="min-w-0 flex-1 rounded-lg border border-border-default bg-white px-3 py-2 font-mono text-[0.85rem] text-content"
          />
          <button
            type="submit"
            :disabled="actionLoading || !inviteeId.trim()"
            class="rounded-lg bg-brand px-4 py-2 text-[0.85rem] font-bold text-white disabled:opacity-50"
          >
            {{ tr("MyTeamPanel.moi") }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-border-default px-3 py-2 text-[0.85rem] text-content"
            @click="showInviteForm = false"
          >
            {{ tr("AccountInfoModal.huy") }}
          </button>
        </form>
        <div class="flex flex-wrap justify-end gap-2">
          <button
            v-if="isLeader && team.join_type === 'invited'"
            :disabled="actionLoading"
            class="rounded-lg bg-brand px-4 py-2 text-[0.85rem] font-bold text-white"
            @click="showInviteForm = true"
          >
            {{ tr("MyTeamPanel.moi_nguoi_choi") }}</button
          ><button
            v-if="isLeader"
            :disabled="actionLoading"
            class="rounded-lg border border-brand px-4 py-2 text-[0.85rem] font-bold text-brand"
            @click="emit('edit')"
          >
            {{ tr("MyTeamPanel.cap_nhat_to_doi") }}</button
          ><button
            v-if="isLeader"
            :disabled="actionLoading"
            class="rounded-lg border border-surface bg-surface px-4 py-2 text-[0.85rem] font-bold text-danger"
            @click="emit('close')"
          >
            {{ tr("MyTeamPanel.huy_nhom") }}</button
          ><button
            :disabled="actionLoading"
            class="rounded-lg border border-brand px-4 py-2 text-[0.85rem] font-bold text-brand"
            @click="emit('leave')"
          >
            {{ tr("MyTeamPanel.roi_nhom") }}
          </button>
        </div>
      </section>
      <section
        v-else
        class="slide-fade-in from-bottom player-content-in flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-6 text-center"
      >
        <div class="m-0 text-lg font-bold text-content">{{ tr("MyTeamPanel.ban_chua_tham_gia_to_doi") }}</div>
        <div class="mb-4 text-sm text-content-caption">
          {{ tr("MyTeamPanel.chon_mot_to_doi_o_ben_trai_hoac_tu_tao_to_doi_moi") }}
        </div>
        <button class="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white" @click="emit('create')">
          {{ tr("MyTeamPanel.tao_nhom") }}
        </button>
      </section>
    </template>
  </div>
</template>
