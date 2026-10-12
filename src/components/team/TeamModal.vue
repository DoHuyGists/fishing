<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import Modal from '../Modal.vue';
import { useTeamStore } from '../../stores/team';
import { useAuthStore } from '../../stores/auth';

// ─── Store ────────────────────────────────────────────────────────────────────
const authStore = useAuthStore();
const teamStore = useTeamStore();

const userId = computed(() => authStore.userId);
const isLeader = computed(() => teamStore.isLeader(userId.value));
const otherMembers = computed(() =>
  teamStore.myTeamMembers.filter((m) => m.user_id !== userId.value)
);

// ─── Views ───────────────────────────────────────────────────────────────────
// 'list'  → danh sách nhóm
// 'create'→ form tạo nhóm
// 'room'  → phòng nhóm đang tham gia
type View = 'list' | 'create' | 'room';
// Khởi tạo mặc định 'list'; onMounted() sẽ cập nhật sang 'room' nếu đang trong nhóm
const view = ref<View>('list');

// ─── Create form ─────────────────────────────────────────────────────────────
const createForm = ref({ name: '', description: '', maxMembers: 4 });
const createError = ref('');

async function handleCreate() {
  createError.value = '';
  const { name, description, maxMembers } = createForm.value;
  if (!name.trim()) { createError.value = 'Vui lòng nhập tên nhóm'; return; }
  const ok = await teamStore.createTeam(
    userId.value,
    name.trim(),
    description.trim() || null,
    maxMembers
  );
  if (ok) {
    createForm.value = { name: '', description: '', maxMembers: 4 };
    view.value = 'room';
  } else {
    createError.value = teamStore.error;
  }
}

// ─── Join ────────────────────────────────────────────────────────────────────
async function handleJoin(teamId: string) {
  const ok = await teamStore.joinTeam(userId.value, teamId);
  if (ok) view.value = 'room';
}

// ─── Leave (leader có option chuyển quyền hoặc hủy nhóm) ─────────────────────
const showLeaveOptions = ref(false);
const transferTargetId = ref('');

async function handleLeave() {
  if (isLeader.value && otherMembers.value.length > 0) {
    showLeaveOptions.value = true;
    return;
  }
  // member rời / leader rời nhóm 1 mình → close + leave
  if (isLeader.value && otherMembers.value.length === 0) {
    await teamStore.closeTeam(userId.value);
    view.value = 'list';
    return;
  }
  await teamStore.leaveTeam(userId.value);
  view.value = 'list';
}

async function handleLeaveAndTransfer() {
  if (!transferTargetId.value) return;
  const ok = await teamStore.transferLeadership(userId.value, transferTargetId.value);
  if (ok) {
    await teamStore.leaveTeam(userId.value);
    showLeaveOptions.value = false;
    view.value = 'list';
  }
}

async function handleLeaveAndClose() {
  await teamStore.closeTeam(userId.value);
  showLeaveOptions.value = false;
  view.value = 'list';
}

// ─── Kick ────────────────────────────────────────────────────────────────────
async function handleKick(memberId: string) {
  await teamStore.kickMember(userId.value, memberId);
}

// ─── Close team (leader đóng nhóm) ───────────────────────────────────────────
async function handleClose() {
  const ok = await teamStore.closeTeam(userId.value);
  if (ok) view.value = 'list';
}

// ─── Transfer leadership ──────────────────────────────────────────────────────
const showTransferModal = ref(false);
const transferTarget = ref('');

async function handleTransfer() {
  if (!transferTarget.value) return;
  await teamStore.transferLeadership(userId.value, transferTarget.value);
  showTransferModal.value = false;
  transferTarget.value = '';
}

// ─── Status badge helpers ─────────────────────────────────────────────────────
const statusLabel: Record<string, string> = {
  OPEN: 'Mở', FULL: 'Đầy', FISHING: 'Đang câu', CLOSED: 'Đã đóng',
};
const statusClass: Record<string, string> = {
  OPEN:    'bg-[#d4f4dd] text-[#1a6e35] border border-[#9de2b4]',
  FULL:    'bg-[#fde8cc] text-[#8a4500] border border-[#f7bf7f]',
  FISHING: 'bg-[#dceeff] text-[#1a4fa0] border border-[#9ac4f7]',
  CLOSED:  'bg-[#f0e0e0] text-[#8a2020] border border-[#e8a0a0]',
};

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  await teamStore.loadData(userId.value);
  teamStore.subscribeRealtime(userId.value);
  view.value = teamStore.isInTeam ? 'room' : 'list';
});

onUnmounted(() => {
  teamStore.unsubscribeRealtime();
});
</script>

<template>
  <Modal title="Lập đội câu" sub-title="Tìm đồng đội cùng chinh phục">

    <!-- ── Loading ── -->
    <div v-if="teamStore.loading" class="flex flex-col items-center justify-center gap-3 py-12 text-[#5a7a5a]">
      <span class="block w-8 h-8 border-[3px] border-[#d1e7d1] border-t-[#3b7a57] rounded-full animate-spin" />
      <p>Đang tải dữ liệu…</p>
    </div>

    <template v-else>

      <!-- ════════════════════════════════════════════════════════ -->
      <!-- VIEW: ROOM (đang trong nhóm)                            -->
      <!-- ════════════════════════════════════════════════════════ -->
      <div v-if="view === 'room' && teamStore.myTeam" class="flex flex-col gap-4">
        <!-- Room header -->
        <div class="flex items-start justify-between gap-3 p-4 bg-gradient-to-br from-[#e8f5e2] to-[#d4edcc] rounded-2xl border border-[#b8dab0]">
          <div>
            <h3 class="m-0 mb-1 text-[1.1rem] font-extrabold text-[#1a3a1a]">{{ teamStore.myTeam.name }}</h3>
            <p v-if="teamStore.myTeam.description" class="m-0 mb-2 text-[0.82rem] text-[#556655]">
              {{ teamStore.myTeam.description }}
            </p>
            <span :class="['inline-block px-[10px] py-[2px] rounded-full text-[0.72rem] font-bold tracking-wide', statusClass[teamStore.myTeam.status]]">
              {{ statusLabel[teamStore.myTeam.status] }}
            </span>
          </div>
          <div class="shrink-0">
            <span class="flex items-center gap-1 font-bold text-base text-[#2e6644]">
              {{ teamStore.memberCount }} / {{ teamStore.myTeam.max_members }}
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M9 6a3 3 0 1 1 6 0A3 3 0 0 1 9 6zM3 17a6 6 0 1 1 12 0H3z"/>
              </svg>
            </span>
          </div>
        </div>

        <!-- Member list -->
        <ul class="list-none m-0 p-0 flex flex-col gap-2">
          <li
            v-for="member in teamStore.myTeamMembers"
            :key="member.id"
            class="flex items-center gap-3 px-[14px] py-[10px] bg-[#f8fbf5] border border-[#daefd4] rounded-xl"
          >
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#3b7a57] to-[#2e6644] text-white flex items-center justify-center text-[0.78rem] font-extrabold shrink-0">
              {{ member.user_id.slice(0, 2).toUpperCase() }}
            </div>
            <div class="flex-1 flex flex-col gap-0.5">
              <span class="text-[0.82rem] text-[#334433] font-mono">{{ member.user_id.slice(0, 8) }}…</span>
              <span
                :class="[
                  'inline-block px-[7px] py-[1px] rounded-full text-[0.7rem] font-bold',
                  member.role === 'LEADER'
                    ? 'bg-[#fff3cd] text-[#7d6000] border border-[#ffd454]'
                    : 'bg-[#e8f5e2] text-[#2e6644] border border-[#b8dab0]'
                ]"
              >
                {{ member.role === 'LEADER' ? '👑 Trưởng nhóm' : 'Thành viên' }}
              </span>
            </div>
            <!-- Leader actions for members -->
            <div v-if="isLeader && member.user_id !== userId" class="flex gap-1.5">
              <button
                class="inline-flex items-center justify-center px-[10px] py-[5px] rounded-lg text-[0.78rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
                :disabled="teamStore.actionLoading"
                @click="() => { transferTarget = member.user_id; showTransferModal = true; }"
                title="Chuyển quyền"
              >👑</button>
              <button
                class="inline-flex items-center justify-center px-[10px] py-[5px] rounded-lg text-[0.78rem] font-bold bg-[#fde8e8] text-[#c0392b] border border-[#f5b7b1] cursor-pointer hover:bg-[#fbd4d4] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
                :disabled="teamStore.actionLoading"
                @click="handleKick(member.user_id)"
                title="Kick"
              >✕</button>
            </div>
          </li>
        </ul>

        <!-- Error -->
        <p v-if="teamStore.error" class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]">{{ teamStore.error }}</p>

        <!-- Room actions -->
        <div class="flex gap-2.5 justify-end pt-1">
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
          <h3 class="m-0 text-base font-bold text-[#1a3a1a]">Nhóm đang hoạt động</h3>
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-gradient-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] transition-all"
            @click="view = 'create'"
          >
            + Tạo nhóm
          </button>
        </div>

        <p v-if="teamStore.error" class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]">{{ teamStore.error }}</p>

        <div v-if="teamStore.teams.length === 0" class="text-center py-10 px-5 text-[#778877] text-[0.9rem]">
          <p>Chưa có nhóm nào. Hãy tạo nhóm đầu tiên!</p>
        </div>

        <ul v-else class="list-none m-0 p-0 flex flex-col gap-2.5">
          <li
            v-for="team in teamStore.teams"
            :key="team.id"
            class="bg-[#f5f9f0] border border-[#cde0c9] rounded-xl overflow-hidden transition-shadow hover:shadow-[0_4px_16px_rgba(59,122,87,0.12)]"
          >
            <div class="px-4 py-[14px]">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="font-bold text-[0.97rem] text-[#1a3a1a]">{{ team.name }}</span>
                <span :class="['inline-block px-[10px] py-[2px] rounded-full text-[0.72rem] font-bold tracking-wide', statusClass[team.status]]">
                  {{ statusLabel[team.status] }}
                </span>
              </div>
              <p v-if="team.description" class="text-[0.82rem] text-[#556655] my-1 mb-2">{{ team.description }}</p>
              <div class="flex items-center justify-between gap-2 mt-2">
                <span class="text-[0.78rem] text-[#778877]">Chỗ trống · max {{ team.max_members }}</span>
                <button
                  v-if="team.status === 'OPEN'"
                  class="inline-flex items-center justify-center gap-1.5 px-[10px] py-[5px] rounded-lg text-[0.78rem] font-bold bg-gradient-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
                  :disabled="teamStore.actionLoading"
                  @click="handleJoin(team.id)"
                >
                  Tham gia
                </button>
                <span v-else class="inline-block px-[10px] py-[2px] rounded-full text-[0.72rem] font-bold tracking-wide bg-[#fde8cc] text-[#8a4500] border border-[#f7bf7f]">Không thể join</span>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- ════════════════════════════════════════════════════════ -->
      <!-- VIEW: CREATE                                            -->
      <!-- ════════════════════════════════════════════════════════ -->
      <div v-else-if="view === 'create'" class="max-w-[480px] mx-auto">
        <div class="flex items-center justify-between gap-3 mb-4">
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] transition-colors"
            @click="view = 'list'"
          >← Quay lại</button>
          <h3 class="m-0 text-base font-bold text-[#1a3a1a]">Tạo nhóm mới</h3>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleCreate">
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
                type="range" min="2" max="10" step="1"
                class="flex-1 accent-[#3b7a57]"
              />
              <span class="min-w-[28px] text-center font-bold text-[1.1rem] text-[#3b7a57]">{{ createForm.maxMembers }}</span>
            </div>
          </label>

          <p v-if="createError" class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]">{{ createError }}</p>

          <button
            type="submit"
            class="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-gradient-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
            :disabled="teamStore.actionLoading"
          >
            {{ teamStore.actionLoading ? 'Đang tạo…' : '🎣 Tạo nhóm' }}
          </button>
        </form>
      </div>

    </template>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- OVERLAY: Leader rời → chọn chuyển quyền / hủy nhóm    -->
    <!-- ════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showLeaveOptions" class="fixed inset-0 z-[10000] bg-black/45 flex items-center justify-center p-4" style="animation: fadeIn 0.18s ease" @click.self="showLeaveOptions = false">
        <div class="bg-white rounded-2xl px-6 py-7 max-w-[380px] w-full shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style="animation: slideUp 0.2s ease">
          <h4 class="m-0 mb-2 text-[1.05rem] font-extrabold text-[#1a3a1a]">Bạn là trưởng nhóm</h4>
          <p class="m-0 mb-4 text-[0.88rem] text-[#445544]">
            Còn {{ otherMembers.length }} thành viên trong nhóm. Chọn một tùy chọn:
          </p>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            Chuyển quyền cho
            <select v-model="transferTargetId" class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a] outline-none transition focus:border-[#3b7a57]">
              <option value="" disabled>-- Chọn thành viên --</option>
              <option v-for="m in otherMembers" :key="m.user_id" :value="m.user_id">
                {{ m.user_id.slice(0, 8) }}…
              </option>
            </select>
          </label>

          <div class="flex flex-col gap-2 mt-4">
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-gradient-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
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
      <div v-if="showTransferModal" class="fixed inset-0 z-[10000] bg-black/45 flex items-center justify-center p-4" style="animation: fadeIn 0.18s ease" @click.self="showTransferModal = false">
        <div class="bg-white rounded-2xl px-6 py-7 max-w-[380px] w-full shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style="animation: slideUp 0.2s ease">
          <h4 class="m-0 mb-2 text-[1.05rem] font-extrabold text-[#1a3a1a]">Chuyển quyền trưởng nhóm</h4>
          <p class="m-0 mb-4 text-[0.88rem] text-[#445544]">
            Chuyển cho: <strong>{{ transferTarget.slice(0, 8) }}…</strong>
          </p>
          <div class="flex flex-col gap-2 mt-4">
            <button
              class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-gradient-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
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
    </Teleport>

  </Modal>
</template>

<style>
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
