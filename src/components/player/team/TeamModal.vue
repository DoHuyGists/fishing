<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import Modal from "../../shared/Modal.vue";
import PlayerIdentity from "../../shared/PlayerIdentity.vue";
import { useCountryStore } from "../../../stores/country.ts";
import { useTeamStore } from "../../../stores/team.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useFriendStore } from "../../../stores/friend.ts";
import type { TeamJoinType, TeamStatus } from "../../../data/supabaseTeamRepository.ts";
import TeamListSidebar from "./TeamListSidebar.vue";
import MyTeamPanel from "./MyTeamPanel.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";

// ─── Store ────────────────────────────────────────────────────────────────────
const authStore = useAuthStore();
const teamStore = useTeamStore();
const friendStore = useFriendStore();
const countryStore = useCountryStore();

function getMemberName(id: string) {
  return teamStore.myTeamMembers.find((member) => member.user_id === id)?.user_profile?.display_name
    || friendStore.profilesMap.get(id)?.display_name || `${id.slice(0, 8)}…`;
}

const userId = computed(() => authStore.userId);
const isLeader = computed(() => teamStore.isLeader(userId.value));
const otherMembers = computed(() => teamStore.myTeamMembers.filter((m) => m.user_id !== userId.value));
const teamSearch = ref("");
const teamStatusFilter = ref("ALL");
const filteredTeams = computed(() => {
  const query = teamSearch.value.trim().toLocaleLowerCase();
  return teamStore.teams.filter((team) => {
    const matchesSearch = !query || `${team.name} ${team.description ?? ""}`.toLocaleLowerCase().includes(query);
    return matchesSearch && (teamStatusFilter.value === "ALL" || team.status === teamStatusFilter.value);
  });
});

function canJoinTeam(team: (typeof teamStore.teams)[number]) {
  if (team.status !== "OPEN") return false;
  if (team.join_type === "everyone") return true;
  if (team.join_type === "friend") {
    return friendStore.friends.some(
      (friend) =>
        friend.status === "ACCEPTED" &&
        ((friend.user_id === userId.value && friend.friend_id === team.leader_id) ||
          (friend.friend_id === userId.value && friend.user_id === team.leader_id)),
    );
  }
  return false;
}

function joinRestrictionLabel(team: (typeof teamStore.teams)[number]) {
  if (team.status !== "OPEN") return "Không thể tham gia";
  if (team.join_type === "friend") return "Chỉ bạn bè của trưởng nhóm";
  if (team.join_type === "invited") return "Chỉ người được mời";
  return "";
}

// ─── Views ───────────────────────────────────────────────────────────────────
// 'list'  → danh sách nhóm
// 'create'→ form tạo nhóm
// 'room'  → phòng nhóm đang tham gia
type View = "list" | "create" | "edit" | "room";
// Khởi tạo mặc định 'list'; onMounted() sẽ cập nhật sang 'room' nếu đang trong nhóm
const view = ref<View>("list");

// ─── Create form ─────────────────────────────────────────────────────────────
const defaultTeamForm = {
  name: "Đội săn thủy quái",
  description: "Cùng lập tổ, thả cần và chinh phục những mẻ cá thật lớn!",
};
const createForm = ref({
  name: defaultTeamForm.name,
  description: defaultTeamForm.description,
  maxMembers: 4,
  status: "OPEN" as TeamStatus,
  joinType: "everyone" as TeamJoinType,
});
const createError = ref("");

function openEditForm() {
  const team = teamStore.myTeam;
  if (!team) return;
  createForm.value = {
    name: team.name,
    description: team.description ?? "",
    maxMembers: team.max_members,
    status: team.status,
    joinType: team.join_type,
  };
  createError.value = "";
  view.value = "edit";
}

async function handleCreate() {
  createError.value = "";
  const { name, description, maxMembers, status, joinType } = createForm.value;
  if (!name.trim()) {
    createError.value = "Vui lòng nhập tên nhóm";
    return;
  }
  const ok = await teamStore.createTeam(
    userId.value,
    name.trim(),
    description.trim() || null,
    maxMembers,
    status,
    joinType,
  );
  if (ok) {
    createForm.value = { name: "", description: "", maxMembers: 4, status: "OPEN", joinType: "everyone" };
    view.value = "room";
  } else {
    createError.value = teamStore.error;
  }
}

async function handleUpdate() {
  createError.value = "";
  const { name, description, maxMembers, status, joinType } = createForm.value;
  if (!name.trim()) {
    createError.value = "Vui lòng nhập tên nhóm";
    return;
  }
  const ok = await teamStore.updateTeam(userId.value, {
    name: name.trim(),
    description: description.trim() || null,
    max_members: maxMembers,
    status,
    join_type: joinType,
  });
  if (ok) view.value = "room";
  else createError.value = teamStore.error;
}

// ─── Join ────────────────────────────────────────────────────────────────────
async function handleJoin(teamId: string) {
  const ok = await teamStore.joinTeam(userId.value, teamId);
  if (ok) view.value = "room";
}

async function handleInvite(inviteeId: string, done: (ok: boolean) => void) {
  done(await teamStore.inviteUser(userId.value, inviteeId));
}

// ─── Leave (leader có option chuyển quyền hoặc hủy nhóm) ─────────────────────
const showLeaveConfirm = ref(false);
const showLeaveOptions = ref(false);
const transferTargetId = ref("");

function handleLeave() {
  showLeaveConfirm.value = true;
}

async function confirmLeave() {
  showLeaveConfirm.value = false;
  if (isLeader.value && otherMembers.value.length > 0) {
    showLeaveOptions.value = true;
    return;
  }
  // member rời / leader rời nhóm 1 mình → close + leave
  if (isLeader.value && otherMembers.value.length === 0) {
    const ok = await teamStore.closeAndLeaveTeam(userId.value);
    if (ok) view.value = "room";
    return;
  }
  await teamStore.leaveTeam(userId.value);
  view.value = "room";
}

async function handleLeaveAndTransfer() {
  if (!transferTargetId.value) return;
  const ok = await teamStore.transferLeadership(userId.value, transferTargetId.value);
  if (ok) {
    await teamStore.leaveTeam(userId.value);
    showLeaveOptions.value = false;
    view.value = "room";
  }
}

async function handleLeaveAndClose() {
  await teamStore.closeTeam(userId.value);
  showLeaveOptions.value = false;
  view.value = "room";
}

// ─── Kick ────────────────────────────────────────────────────────────────────
async function handleKick(memberId: string) {
  const ok = await teamStore.kickMember(userId.value, memberId);
  if (ok) {
    showKickConfirm.value = false;
    kickTargetId.value = "";
  }
}

const showKickConfirm = ref(false);
const kickTargetId = ref("");

// ─── Close team (leader đóng nhóm) ───────────────────────────────────────────
const showCloseConfirm = ref(false);

function handleClose() {
  showCloseConfirm.value = true;
}

async function confirmClose() {
  showCloseConfirm.value = false;
  const ok = await teamStore.closeTeam(userId.value);
  if (ok) view.value = "room";
}

// ─── Transfer leadership ──────────────────────────────────────────────────────
const showTransferModal = ref(false);
const transferTarget = ref("");

async function handleTransfer() {
  if (!transferTarget.value) return;
  await teamStore.transferLeadership(userId.value, transferTarget.value);
  showTransferModal.value = false;
  transferTarget.value = "";
}

// ─── Status badge helpers ─────────────────────────────────────────────────────
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

// ─── Lifecycle ───────────────────────────────────────────────────────────────
async function loadData() {
  await Promise.all([teamStore.loadData(userId.value), friendStore.loadData(userId.value), countryStore.fetchCountries()]);
}

onMounted(async () => {
  await loadData();
  view.value = "room";
});
</script>

<template>
  <Modal title="Lập đội câu" sub-title="Tìm đồng đội cùng chinh phục" :on-refresh="loadData">
    <!-- ── Loading ── -->
    <div v-if="teamStore.loading" class="flex flex-col items-center justify-center gap-3 py-12 text-[#5a7a5a]">
      <span class="block w-8 h-8 border-[3px] border-[#d1e7d1] border-t-[#3b7a57] rounded-full animate-spin" />
      <div>Đang tải dữ liệu…</div>
    </div>

    <template v-else>
      <div
        v-if="view === 'room'"
        class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)] lg:items-start"
      >
        <TeamListSidebar
          :profiles="friendStore.profilesMap"
          :teams="teamStore.teams"
          :current-team-id="teamStore.myTeam?.id"
          :action-loading="teamStore.actionLoading"
          :can-join="canJoinTeam"
          :join-restriction-label="joinRestrictionLabel"
          @create="view = 'create'"
          @join="handleJoin"
        />
        <div class="min-w-0">
          <div
            v-if="teamStore.error"
            class="mb-3 rounded-lg border border-[#f5c6c3] bg-[#fef0ef] px-3 py-2 text-[0.83rem] text-[#c0392b]"
          >
            {{ teamStore.error }}
          </div>
          <MyTeamPanel
            :profiles="friendStore.profilesMap"
            :team="teamStore.myTeam"
            :members="teamStore.myTeamMembers"
            :invites="teamStore.myInvites"
            :user-id="userId"
            :is-leader="isLeader"
            :action-loading="teamStore.actionLoading"
            @invite="handleInvite"
            @respond-invite="(inviteId, accept) => teamStore.respondInvite(userId, inviteId, accept)"
            @create="view = 'create'"
            @edit="openEditForm"
            @close="handleClose"
            @leave="handleLeave"
            @transfer="
              (memberId) => {
                transferTarget = memberId;
                showTransferModal = true;
              }
            "
            @kick="
              (memberId) => {
                kickTargetId = memberId;
                showKickConfirm = true;
              }
            "
          />
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════ -->
      <!-- VIEW: ROOM (đang trong nhóm)                            -->
      <!-- ════════════════════════════════════════════════════════ -->
      <div v-if="view === 'list' && teamStore.myTeam" class="flex flex-col gap-4">
        <!-- Room header -->
        <div
          class="flex items-start justify-between gap-3 p-4 bg-linear-to-br from-[#e8f5e2] to-[#d4edcc] rounded-2xl border border-[#b8dab0]"
        >
          <div>
            <div class="m-0 mb-1 text-[1.1rem] font-extrabold text-[#1a3a1a]">{{ teamStore.myTeam.name }}</div>
            <div v-if="teamStore.myTeam.description" class="m-0 mb-2 text-[0.82rem] text-[#556655]">
              {{ teamStore.myTeam.description }}
            </div>
            <span
              :class="[
                'inline-block px-[10px] py-[2px] rounded-full text-[0.72rem] font-bold tracking-wide',
                statusClass[teamStore.myTeam.status],
              ]"
            >
              {{ statusLabel[teamStore.myTeam.status] }}
            </span>
          </div>
          <div class="shrink-0">
            <span class="flex items-center gap-1 font-bold text-base text-[#2e6644]">
              {{ teamStore.memberCount }} / {{ teamStore.myTeam.max_members }}
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M9 6a3 3 0 1 1 6 0A3 3 0 0 1 9 6zM3 17a6 6 0 1 1 12 0H3z" />
              </svg>
            </span>
          </div>
        </div>

        <!-- Member list -->
        <div class="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div
            v-for="member in teamStore.myTeamMembers"
            :key="member.id"
            class="flex flex-col gap-3 p-4 bg-linear-to-br from-white to-[#f5faf2] border border-[#daefd4] rounded-2xl shadow-sm"
          >
            <div class="flex items-center gap-3 min-w-0">
              <PlayerIdentity :user-id="member.user_id" :profile="member.user_profile" class="flex-1" />
              <div class="flex-1 min-w-0 flex flex-col gap-1">
                <span
                  :class="[
                    'inline-block px-[7px] py-[1px] rounded-full text-[0.7rem] font-bold',
                    member.role === 'LEADER'
                      ? 'bg-[#fff3cd] text-[#7d6000] border border-[#ffd454]'
                      : 'bg-[#e8f5e2] text-[#2e6644] border border-[#b8dab0]',
                  ]"
                >
                  {{ member.role === "LEADER" ? "👑 Trưởng nhóm" : "Thành viên" }}
                </span>
                <span class="text-xs font-semibold text-[#648064]">
                  ⭐ Cấp {{ member.user_profile?.level ?? 1 }}
                  <span class="mx-1 text-[#b2c8ae]">·</span>
                  {{ Number(member.user_profile?.experience_point ?? 0).toLocaleString("vi-VN") }} EXP
                </span>
              </div>
            </div>
            <!-- Leader actions for members -->
            <div
              v-if="isLeader && member.user_id !== userId"
              class="flex gap-1.5 justify-end border-t border-[#e3eee0] pt-2"
            >
              <button
                class="inline-flex items-center justify-center px-[10px] py-[5px] rounded-lg text-[0.78rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
                :disabled="teamStore.actionLoading"
                @click="
                  () => {
                    transferTarget = member.user_id;
                    showTransferModal = true;
                  }
                "
                title="Chuyển quyền"
              >
                👑
              </button>
              <button
                class="inline-flex items-center justify-center px-[10px] py-[5px] rounded-lg text-[0.78rem] font-bold bg-[#fde8e8] text-[#c0392b] border border-[#f5b7b1] cursor-pointer hover:bg-[#fbd4d4] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
                :disabled="teamStore.actionLoading"
                @click="
                  () => {
                    kickTargetId = member.user_id;
                    showKickConfirm = true;
                  }
                "
                title="Kick"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div
          v-if="teamStore.error"
          class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]"
        >
          {{ teamStore.error }}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2 mb-3">
          <input
            v-model="teamSearch"
            type="search"
            aria-label="Tìm tổ đội"
            placeholder="Tìm theo tên hoặc mô tả..."
            class="min-w-0 px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a]"
          />
          <select
            v-model="teamStatusFilter"
            aria-label="Lọc theo trạng thái"
            class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="OPEN">Mở</option>
            <option value="FULL">Đầy</option>
            <option value="FISHING">Đang câu</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
        </div>

        <!-- Room actions -->
        <div class="flex gap-2.5 justify-end pt-1">
          <button
            v-if="isLeader"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#3b7a57] border-[1.5px] border-[#3b7a57] cursor-pointer hover:bg-[#e8f5e2]"
            :disabled="teamStore.actionLoading"
            @click="openEditForm"
          >
            Cập nhật tổ đội
          </button>
          <button
            v-if="isLeader"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-[#fde8e8] text-[#c0392b] border border-[#f5b7b1] cursor-pointer hover:bg-[#fbd4d4] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
            :disabled="teamStore.actionLoading"
            @click="handleClose"
          >
            🚫 Hủy nhóm
          </button>
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#3b7a57] border-[1.5px] border-[#3b7a57] cursor-pointer hover:bg-[#e8f5e2] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
            :disabled="teamStore.actionLoading"
            @click="handleLeave"
          >
            🚪 Rời nhóm
          </button>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════ -->
      <!-- VIEW: LIST                                              -->
      <!-- ════════════════════════════════════════════════════════ -->
      <div v-else-if="view === 'list'">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div class="m-0 text-base font-bold text-[#1a3a1a]">Nhóm đang hoạt động</div>
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-linear-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] transition-all"
            @click="view = 'create'"
          >
            + Tạo nhóm
          </button>
        </div>

        <div
          v-if="teamStore.error"
          class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]"
        >
          {{ teamStore.error }}
        </div>

        <div v-if="teamStore.teams.length === 0" class="text-center py-10 px-5 text-[#778877] text-[0.9rem]">
          <div>Chưa có nhóm nào. Hãy tạo nhóm đầu tiên!</div>
        </div>

        <div v-else-if="filteredTeams.length === 0" class="text-center py-8 px-5 text-[#778877] text-[0.9rem]">
          Không tìm thấy tổ đội phù hợp.
        </div>

        <div v-else class="list-none m-0 p-0 flex flex-col gap-2.5">
          <div
            v-for="team in filteredTeams"
            :key="team.id"
            class="bg-[#f5f9f0] border border-[#cde0c9] rounded-xl overflow-hidden transition-shadow hover:shadow-[0_4px_16px_rgba(59,122,87,0.12)]"
          >
            <div class="px-4 py-[14px]">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="font-bold text-[0.97rem] text-[#1a3a1a]">{{ team.name }}</span>
                <span
                  :class="[
                    'inline-block px-[10px] py-[2px] rounded-full text-[0.72rem] font-bold tracking-wide',
                    statusClass[team.status],
                  ]"
                >
                  {{ statusLabel[team.status] }}
                </span>
              </div>
              <div v-if="team.description" class="text-[0.82rem] text-[#556655] my-1 mb-2">{{ team.description }}</div>
              <PlayerIdentity :user-id="team.leader_id" :profile="friendStore.profilesMap.get(team.leader_id)" class="my-2" />
              <div class="text-[0.76rem] text-[#778877] my-1">
                {{
                  team.join_type === "everyone"
                    ? "Ai cũng có thể tham gia"
                    : team.join_type === "friend"
                      ? "Chỉ bạn bè của trưởng nhóm"
                      : "Chỉ người được mời"
                }}
              </div>
              <div class="flex items-center justify-between gap-2 mt-2">
                <span class="text-[0.78rem] text-[#778877]">Chỗ trống · max {{ team.max_members }}</span>
                <button
                  v-if="canJoinTeam(team)"
                  class="inline-flex items-center justify-center gap-1.5 px-[10px] py-[5px] rounded-lg text-[0.78rem] font-bold bg-linear-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
                  :disabled="teamStore.actionLoading"
                  @click="handleJoin(team.id)"
                >
                  Tham gia
                </button>
                <span
                  v-else
                  class="inline-block px-[10px] py-[2px] rounded-full text-[0.72rem] font-bold tracking-wide bg-[#fde8cc] text-[#8a4500] border border-[#f7bf7f]"
                  >{{ joinRestrictionLabel(team) }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════ -->
      <!-- VIEW: CREATE                                            -->
      <!-- ════════════════════════════════════════════════════════ -->
      <div v-else-if="view === 'create' || view === 'edit'" class="max-w-[480px] mx-auto">
        <div class="flex items-center justify-between gap-3 mb-4">
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] transition-colors"
            @click="view = 'room'"
          >
            ← Quay lại
          </button>
          <div class="m-0 text-base font-bold text-[#1a3a1a]">
            {{ view === "edit" ? "Cập nhật tổ đội" : "Tạo nhóm mới" }}
          </div>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="view === 'edit' ? handleUpdate() : handleCreate()">
          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            Tên nhóm <span class="text-[#c0392b]">*</span>
            <input
              v-model="createForm.name"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a] outline-none transition focus:border-[#3b7a57] focus:shadow-[0_0_0_3px_rgba(59,122,87,0.12)]"
              type="text"
              placeholder="VD: Hội câu Đà Lạt"
              maxlength="50"
              required
            />
          </label>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            Mô tả
            <textarea
              v-model="createForm.description"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a] outline-none transition resize-y min-h-[72px] focus:border-[#3b7a57] focus:shadow-[0_0_0_3px_rgba(59,122,87,0.12)]"
              placeholder="Mô tả ngắn về nhóm của bạn…"
              rows="3"
              maxlength="200"
            />
          </label>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            Số thành viên tối đa
            <div class="flex items-center gap-3">
              <input
                v-model.number="createForm.maxMembers"
                type="range"
                min="2"
                max="10"
                step="1"
                class="flex-1 accent-[#3b7a57]"
              />
              <span class="min-w-[28px] text-center font-bold text-[1.1rem] text-[#3b7a57]">{{
                createForm.maxMembers
              }}</span>
            </div>
          </label>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]"
            >Trạng thái
            <select
              v-model="createForm.status"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a]"
            >
              <option value="PENDING">Chờ duyệt (chưa hiển thị)</option>
              <option value="OPEN">Mở</option>
              <option value="FULL">Đầy</option>
              <option value="FISHING">Đang câu</option>
              <option value="CLOSED">Đã đóng</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]"
            >Quyền tham gia
            <select
              v-model="createForm.joinType"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a]"
            >
              <option value="everyone">Ai cũng có thể tham gia</option>
              <option value="friend">Chỉ bạn bè của trưởng nhóm</option>
              <option value="invited">Chỉ người được mời</option>
            </select>
          </label>
          <div
            v-if="createError"
            class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]"
          >
            {{ createError }}
          </div>

          <button
            type="submit"
            class="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-linear-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
            :disabled="teamStore.actionLoading"
          >
            {{ teamStore.actionLoading ? "Đang lưu…" : view === "edit" ? "Lưu thay đổi" : "🎣 Tạo nhóm" }}
          </button>
        </form>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- OVERLAY: Leader rời → chọn chuyển quyền / hủy nhóm    -->
    <!-- ════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <!-- OVERLAY: Confirm close team -->
      <TwoOptionsModal
        v-if="showCloseConfirm"
        title="Xác nhận hủy nhóm?"
        message="Nhóm sẽ bị đóng và các thành viên không thể tiếp tục tham gia."
        first-text="Quay lại"
        second-text="Xác nhận hủy"
        :first-disabled="teamStore.actionLoading"
        :second-disabled="teamStore.actionLoading"
        :on-first="() => (showCloseConfirm = false)"
        :on-second="confirmClose"
        :on-dismiss="() => (showCloseConfirm = false)"
      />

      <!-- OVERLAY: Confirm leaving team -->
      <TwoOptionsModal
        v-if="showLeaveConfirm"
        title="Xác nhận rời nhóm?"
        first-text="Quay lại"
        second-text="Tiếp tục"
        :first-disabled="teamStore.actionLoading"
        :second-disabled="teamStore.actionLoading"
        :on-first="() => (showLeaveConfirm = false)"
        :on-second="confirmLeave"
        :on-dismiss="() => (showLeaveConfirm = false)"
      >
        <div class="mb-2 text-[0.95rem] leading-normal text-[#374151]">
          Bạn sẽ rời khỏi nhóm hiện tại.
          <template v-if="isLeader && otherMembers.length > 0">
            Tiếp theo, bạn có thể chuyển quyền trưởng nhóm hoặc hủy nhóm.
          </template>
        </div>
      </TwoOptionsModal>

      <div
        v-if="showLeaveOptions"
        class="fixed inset-0 z-[10000] bg-black/45 flex items-center justify-center p-4"
        style="animation: fadeIn 0.18s ease"
        @click.self="showLeaveOptions = false"
      >
        <div
          class="bg-white rounded-2xl px-6 py-7 max-w-[380px] w-full shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
          style="animation: slideUp 0.2s ease"
        >
          <div class="m-0 mb-2 text-[1.05rem] font-extrabold text-[#1a3a1a]">Bạn là trưởng nhóm</div>
          <div class="m-0 mb-4 text-[0.88rem] text-[#445544]">
            Còn {{ otherMembers.length }} thành viên trong nhóm. Chọn một tùy chọn:
          </div>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            Chuyển quyền cho
            <select
              v-model="transferTargetId"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a] outline-none transition focus:border-[#3b7a57]"
            >
              <option value="" disabled>-- Chọn thành viên --</option>
              <option v-for="m in otherMembers" :key="m.user_id" :value="m.user_id">
                {{ getMemberName(m.user_id) }}
              </option>
            </select>
          </label>

          <div class="flex flex-col gap-2 mt-4">
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-linear-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
              :disabled="!transferTargetId || teamStore.actionLoading"
              @click="handleLeaveAndTransfer"
            >
              Chuyển quyền & Rời
            </button>
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-[#fde8e8] text-[#c0392b] border border-[#f5b7b1] cursor-pointer hover:bg-[#fbd4d4] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
              :disabled="teamStore.actionLoading"
              @click="handleLeaveAndClose"
            >
              Hủy nhóm & Rời
            </button>
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] transition-colors"
              @click="showLeaveOptions = false"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </div>

      <!-- OVERLAY: Transfer leadership -->
      <div
        v-if="showTransferModal"
        class="fixed inset-0 z-[10000] bg-black/45 flex items-center justify-center p-4"
        style="animation: fadeIn 0.18s ease"
        @click.self="showTransferModal = false"
      >
        <div
          class="bg-white rounded-2xl px-6 py-7 max-w-[380px] w-full shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
          style="animation: slideUp 0.2s ease"
        >
          <div class="m-0 mb-2 text-[1.05rem] font-extrabold text-[#1a3a1a]">Chuyển quyền trưởng nhóm</div>
          <div class="m-0 mb-4 text-[0.88rem] text-[#445544]">
            Chuyển cho: <strong>{{ getMemberName(transferTarget) }}</strong>
            <PlayerIdentity :user-id="transferTarget" :profile="teamStore.myTeamMembers.find((member) => member.user_id === transferTarget)?.user_profile" class="mt-2" />
          </div>
          <div class="flex flex-col gap-2 mt-4">
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-linear-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
              :disabled="teamStore.actionLoading"
              @click="handleTransfer"
            >
              Xác nhận
            </button>
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] transition-colors"
              @click="showTransferModal = false"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </div>

      <!-- OVERLAY: Confirm kick -->
      <TwoOptionsModal
        v-if="showKickConfirm"
        title="Xác nhận xóa thành viên?"
        :first-disabled="teamStore.actionLoading"
        :second-disabled="teamStore.actionLoading"
        first-text="Hủy"
        second-text="Xóa thành viên"
        :on-first="
          () => {
            showKickConfirm = false;
            kickTargetId = '';
          }
        "
        :on-second="() => handleKick(kickTargetId)"
        :on-dismiss="
          () => {
            showKickConfirm = false;
            kickTargetId = '';
          }
        "
      >
        <div class="mb-2 text-[0.95rem] leading-normal text-[#374151]">
          Thành viên <strong>{{ getMemberName(kickTargetId) }}</strong> sẽ bị đưa khỏi tổ đội.
          <PlayerIdentity :user-id="kickTargetId" :profile="teamStore.myTeamMembers.find((member) => member.user_id === kickTargetId)?.user_profile" class="mt-2" />
        </div>
      </TwoOptionsModal>
    </Teleport>
  </Modal>
</template>

<style>
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
