<script lang="ts" setup>
import { computed, ref } from "vue";
import type { UserTeam } from "../../../data/supabaseTeamRepository";

const props = defineProps<{
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

const search = ref("");
const status = ref("ALL");
const statusLabel: Record<string, string> = {
  PENDING: "Chờ duyệt",
  OPEN: "Mở",
  FULL: "Đầy",
  FISHING: "Đang câu",
  CLOSED: "Đã đóng",
};
const statusClass: Record<string, string> = {
  PENDING: "bg-[#f0e0e0] text-[#8a2020] border border-[#e8a0a0]",
  OPEN: "bg-[#d4f4dd] text-[#1a6e35] border border-[#9de2b4]",
  FULL: "bg-[#fde8cc] text-[#8a4500] border border-[#f7bf7f]",
  FISHING: "bg-[#dceeff] text-[#1a4fa0] border border-[#9ac4f7]",
  CLOSED: "bg-[#f0e0e0] text-[#8a2020] border border-[#e8a0a0]",
};
const filteredTeams = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return props.teams.filter((team) => {
    const matchesSearch = !query || `${team.name} ${team.description ?? ""}`.toLocaleLowerCase().includes(query);
    return matchesSearch && (status.value === "ALL" || team.status === status.value);
  });
});

function joinTypeLabel(team: UserTeam) {
  return team.join_type === "everyone"
    ? "Ai cũng có thể tham gia"
    : team.join_type === "friend"
      ? "Chỉ bạn bè của trưởng nhóm"
      : "Chỉ người được mời";
}
</script>

<template>
  <aside class="flex min-h-0 flex-col gap-3 rounded-2xl border border-[#cde0c9] bg-[#f5f9f0] p-3 sm:max-h-[62vh]">
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 text-base font-bold text-[#1a3a1a]">Tổ đội hiện hành</h3>
      <button
        class="inline-flex items-center justify-center rounded-lg bg-linear-to-br from-[#3b7a57] to-[#2e6644] px-3 py-2 text-[0.8rem] font-bold text-white transition-all hover:from-[#2e6644] hover:to-[#245236]"
        @click="emit('create')"
      >
        + Tạo
      </button>
    </div>
    <input
      v-model="search"
      type="search"
      aria-label="Tìm tổ đội"
      placeholder="Tìm tổ đội..."
      class="min-w-0 rounded-lg border border-[#c0d8b8] bg-[#fafefc] px-3 py-2 text-[0.85rem] text-[#1a3a1a]"
    />
    <select
      v-model="status"
      aria-label="Lọc theo trạng thái"
      class="rounded-lg border border-[#c0d8b8] bg-[#fafefc] px-3 py-2 text-[0.85rem] text-[#1a3a1a]"
    >
      <option value="ALL">Tất cả trạng thái</option>
      <option value="OPEN">Mở</option>
      <option value="FULL">Đầy</option>
      <option value="FISHING">Đang câu</option>
      <option value="CLOSED">Đã đóng</option>
    </select>
    <p v-if="teams.length === 0" class="m-0 py-8 text-center text-[0.85rem] text-[#778877]">Chưa có tổ đội nào.</p>
    <p v-else-if="filteredTeams.length === 0" class="m-0 py-8 text-center text-[0.85rem] text-[#778877]">
      Không tìm thấy tổ đội phù hợp.
    </p>
    <ul v-else class="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
      <li v-for="team in filteredTeams" :key="team.id" class="rounded-xl border border-[#cde0c9] bg-white p-3">
        <div class="flex items-start justify-between gap-2">
          <span class="font-bold text-[#1a3a1a]">{{ team.name }}</span
          ><span :class="['shrink-0 rounded-full px-2 py-[2px] text-[0.68rem] font-bold', statusClass[team.status]]">{{
            statusLabel[team.status]
          }}</span>
        </div>
        <p v-if="team.description" class="my-1 line-clamp-2 text-[0.78rem] text-[#556655]">{{ team.description }}</p>
        <p class="my-1 text-[0.72rem] text-[#778877]">{{ joinTypeLabel(team) }} · tối đa {{ team.max_members }}</p>
        <div class="mt-2 flex justify-end">
          <span
            v-if="team.id === currentTeamId"
            class="rounded-full bg-[#e8f5e2] px-2 py-1 text-[0.68rem] font-bold text-[#2e6644]"
            >Đội của bạn</span
          >
          <button
            v-else-if="canJoin(team)"
            :disabled="actionLoading"
            class="rounded-lg bg-[#3b7a57] px-3 py-1.5 text-[0.76rem] font-bold text-white disabled:opacity-55"
            @click="emit('join', team.id)"
          >
            Tham gia
          </button>
          <span v-else class="rounded-full bg-[#fde8cc] px-2 py-1 text-[0.68rem] font-bold text-[#8a4500]">{{
            joinRestrictionLabel(team)
          }}</span>
        </div>
      </li>
    </ul>
  </aside>
</template>
