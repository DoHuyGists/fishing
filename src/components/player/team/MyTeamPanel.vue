<script lang="ts" setup>
import type { UserTeam, UserTeamMember } from "../../../data/supabaseTeamRepository";

defineProps<{
  team: UserTeam | null;
  members: UserTeamMember[];
  userId: string;
  isLeader: boolean;
  actionLoading: boolean;
}>();
const emit = defineEmits<{
  edit: [];
  close: [];
  leave: [];
  transfer: [memberId: string];
  kick: [memberId: string];
  create: [];
}>();
const statusLabel: Record<string, string> = {
  PENDING: "Chờ duyệt",
  OPEN: "Mở",
  FULL: "Đầy",
  FISHING: "Đang câu",
  CLOSED: "Đã đóng",
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
  <section v-if="team" class="flex flex-col gap-4">
    <div
      class="flex items-start justify-between gap-3 rounded-2xl border border-[#b8dab0] bg-linear-to-br from-[#e8f5e2] to-[#d4edcc] p-4"
    >
      <div>
        <h3 class="m-0 mb-1 text-[1.1rem] font-extrabold text-[#1a3a1a]">{{ team.name }}</h3>
        <p v-if="team.description" class="m-0 mb-2 text-[0.82rem] text-[#556655]">{{ team.description }}</p>
        <span :class="['inline-block rounded-full px-2 py-1 text-[0.72rem] font-bold', statusClass[team.status]]">{{
          statusLabel[team.status]
        }}</span>
      </div>
      <span class="font-bold text-[#2e6644]">{{ members.length }} / {{ team.max_members }}</span>
    </div>
    <ul class="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      <li v-for="member in members" :key="member.id" class="rounded-xl border border-[#daefd4] bg-white p-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3b7a57] text-xs font-extrabold text-white"
          >
            {{ member.user_id.slice(0, 2).toUpperCase() }}
          </div>
          <div class="min-w-0">
            <p class="m-0 truncate font-mono text-[0.8rem] text-[#334433]">{{ member.user_id.slice(0, 8) }}…</p>
            <span class="text-[0.72rem] font-bold text-[#2e6644]">{{
              member.role === "LEADER" ? "👑 Trưởng nhóm" : "Thành viên"
            }}</span>
          </div>
        </div>
        <div
          v-if="isLeader && member.user_id !== userId"
          class="mt-3 flex justify-end gap-2 border-t border-[#e3eee0] pt-2"
        >
          <button
            :disabled="actionLoading"
            class="rounded-lg border border-[#c0d8b8] px-2 py-1 text-xs"
            title="Chuyển quyền"
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
      </li>
    </ul>
    <div class="flex flex-wrap justify-end gap-2">
      <button
        v-if="isLeader"
        :disabled="actionLoading"
        class="rounded-lg border border-[#3b7a57] px-4 py-2 text-[0.85rem] font-bold text-[#3b7a57]"
        @click="emit('edit')"
      >
        Cập nhật tổ đội</button
      ><button
        v-if="isLeader"
        :disabled="actionLoading"
        class="rounded-lg border border-[#f5b7b1] bg-[#fde8e8] px-4 py-2 text-[0.85rem] font-bold text-[#c0392b]"
        @click="emit('close')"
      >
        Hủy nhóm</button
      ><button
        :disabled="actionLoading"
        class="rounded-lg border border-[#3b7a57] px-4 py-2 text-[0.85rem] font-bold text-[#3b7a57]"
        @click="emit('leave')"
      >
        Rời nhóm
      </button>
    </div>
  </section>
  <section
    v-else
    class="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c0d8b8] bg-[#fafefc] p-6 text-center"
  >
    <h3 class="m-0 text-lg font-bold text-[#1a3a1a]">Bạn chưa tham gia tổ đội</h3>
    <p class="mb-4 text-sm text-[#556655]">Chọn một tổ đội ở bên trái hoặc tự tạo tổ đội mới.</p>
    <button class="rounded-lg bg-[#3b7a57] px-4 py-2 text-sm font-bold text-white" @click="emit('create')">
      + Tạo nhóm
    </button>
  </section>
</template>
