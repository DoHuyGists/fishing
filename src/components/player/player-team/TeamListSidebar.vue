<script lang="ts" setup>
import type { PlayerProfileSummary } from "../../../types/model/friend";
import type { UserTeam } from "../../../types/model/team";
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import { useTeamStore } from "../../../stores/player-team-store.ts";
import { useAuthStore } from "../../../stores/auth";
import Pagination from "../../shared/Pagination.vue";
import PlayerIdentity from "../../shared/PlayerIdentity.vue";

import Tab, { type TabItem } from "../../shared/Tab.vue";

const props = defineProps<{
  profiles: Map<string, PlayerProfileSummary>;
  teams: UserTeam[];
  currentTeamId?: string;
  actionLoading: boolean;
  canJoin: (team: UserTeam) => boolean;
  joinRestrictionLabel: (team: UserTeam) => string;
}>();

const emit = defineEmits<{
  join: [teamId: string];
  create: [];
}>();

const store = useTeamStore();
const auth = useAuthStore();
const search = computed({
  get: () => store.search,
  set: (value) => {
    store.search = value;
  },
});
const status = computed({
  get: () => store.statusFilter,
  set: (value) => {
    store.statusFilter = value;
  },
});
const statusTabs: TabItem[] = [
  {
    key: "ALL",
    get label() {
      return tr("Achievement.tat_ca");
    },
  },
  {
    key: "OPEN",
    get label() {
      return tr("MyTeamPanel.mo");
    },
  },
  {
    key: "FULL",
    get label() {
      return tr("MyTeamPanel.day");
    },
  },
  {
    key: "FISHING",
    get label() {
      return tr("MyTeamPanel.dang_cau");
    },
  },
  {
    key: "CLOSED",
    get label() {
      return tr("Feedbackmodal.da_dong");
    },
  },
];
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
  PENDING: "bg-surface text-danger border border-danger",
  OPEN: "bg-surface text-content border border-accent",
  FULL: "bg-surface text-gold border border-gold",
  FISHING: "bg-surface text-primary border border-primary",
  CLOSED: "bg-surface text-danger border border-danger",
};
const filteredTeams = computed(() => props.teams);

function joinTypeLabel(team: UserTeam) {
  return team.join_type === "everyone"
    ? tr("TeamListSidebar.ai_cung_co_the_tham_gia")
    : team.join_type === "friend"
      ? tr("TeamListSidebar.chi_ban_be_cua_truong_nhom")
      : tr("TeamListSidebar.chi_nguoi_duoc_moi");
}
</script>

<template>
  <aside
    class="slide-fade-in from-left player-content-in flex min-h-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:max-h-[62vh]"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="m-0 text-base font-bold text-content">{{ tr("TeamListSidebar.to_doi_hien_hanh") }}</div>
      <button
        class="inline-flex items-center justify-center rounded-lg bg-linear-to-br from-brand to-accent px-3 py-2 text-[0.8rem] font-bold text-white transition-all hover:from-accent hover:to-content"
        @click="emit('create')"
      >
        {{ tr("TeamListSidebar.tao") }}
      </button>
    </div>
    <input
      v-model="search"
      type="search"
      :aria-label="tr('TeamListSidebar.tim_to_doi')"
      :placeholder="tr('TeamListSidebar.tim_to_doi_2')"
      class="min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-[0.85rem] text-content"
    />
    <Tab
      v-model="status"
      :tabs="statusTabs"
      :aria-label="tr('TeamListSidebar.loc_to_doi_theo_trang_thai')"
      class="min-h-0"
    >
      <template v-for="tab in statusTabs" :key="tab.key" #[tab.key]>
        <div v-if="teams.length === 0" class="m-0 py-8 text-center text-[0.85rem] text-content">
          {{ tr("TeamListSidebar.chua_co_to_doi_nao") }}
        </div>
        <div v-else-if="filteredTeams.length === 0" class="m-0 py-8 text-center text-[0.85rem] text-content">
          {{ tr("TeamListSidebar.khong_tim_thay_to_doi_phu_hop") }}
        </div>
        <div v-else class="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
          <div v-for="team in filteredTeams" :key="team.id" class="rounded-xl border border-border bg-white p-3">
            <div class="flex items-start justify-between gap-2">
              <span class="font-bold text-content">{{ team.name }}</span
              ><span
                :class="['shrink-0 rounded-full px-2 py-[2px] text-[0.68rem] font-bold', statusClass[team.status]]"
              >
                {{ statusLabel[team.status] }}
              </span>
            </div>
            <div v-if="team.description" class="my-1 line-clamp-2 text-[0.78rem] text-content-caption">
              {{ team.description }}
            </div>
            <div class="my-1 text-[0.72rem] text-content">
              {{ joinTypeLabel(team) }} {{ tr("TeamListSidebar.toi_da") }} {{ team.max_members }}
            </div>
            <div class="mt-2 text-[11px] text-content-caption">{{ tr("TeamListSidebar.truong_nhom") }}</div>
            <PlayerIdentity :user-id="team.leader_id" :profile="profiles.get(team.leader_id)" class="mt-1" />
            <div class="mt-2 flex justify-end">
              <span
                v-if="team.id === currentTeamId"
                class="rounded-full bg-surface px-2 py-1 text-[0.68rem] font-bold text-content"
                >{{ tr("TeamListSidebar.doi_cua_ban") }}</span
              >
              <button
                v-else-if="canJoin(team)"
                :disabled="actionLoading"
                class="rounded-lg bg-brand px-3 py-1.5 text-[0.76rem] font-bold text-white disabled:opacity-55"
                @click="emit('join', team.id)"
              >
                {{ tr("TeamListSidebar.tham_gia") }}
              </button>
              <span v-else class="rounded-full bg-surface px-2 py-1 text-[0.68rem] font-bold text-gold">
                {{ joinRestrictionLabel(team) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </Tab>
    <Pagination
      :page="store.page"
      :page-size="store.pageSize"
      :total="store.total"
      :loading="store.directoryLoading"
      @change="
        store.page = $event;
        store.loadTeams(auth.userId);
      "
    />
  </aside>
</template>
