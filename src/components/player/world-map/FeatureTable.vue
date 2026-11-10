<script setup lang="ts">
import { useConfigStore } from "../../../stores/config.ts";
import { useModalStore } from "../../../stores/modal.ts";
import { useNotificationStore } from "../../../stores/notification.ts";

const configStore = useConfigStore();
const modalStore = useModalStore();
const notificationStore = useNotificationStore();

type LobbyAction = {
  modal: NonNullable<Parameters<typeof modalStore.open>[0]>;
  label: string;
  icon: string;
  tourId?: string;
  requiresUnlock?: boolean;
};

const utilityActions: LobbyAction[] = [
  { modal: 'account', label: 'Tài khoản', icon: '⚙️', tourId: 'first-play-account' },
  { modal: 'guide', label: 'Hướng dẫn', icon: '📖' },
  { modal: 'notifications', label: 'Thông báo', icon: '🔔' },
];

const actionGroups: { key: string; label: string; iconClass: string; actions: LobbyAction[] }[] = [
  {
    key: 'equipment', label: 'Hành trang', iconClass: 'bg-[#e7f0df]',
    actions: [
      { modal: 'inventory', label: 'Túi đồ', icon: '🎒', tourId: 'first-play-inventory' },
      { modal: 'caught', label: 'Kho cá', icon: '🐟', tourId: 'first-play-storage' },
      { modal: 'shop', label: 'Cửa hàng', icon: '🛒' },
      { modal: 'skill', label: 'Kỹ năng', icon: '✨' },
      { modal: 'post-production', label: 'Lưới cá', icon: '🕸️', requiresUnlock: true },
      { modal: 'work-bench', label: 'Chế tạo', icon: '🛠️', requiresUnlock: true },
    ],
  },
  {
    key: 'activities', label: 'Hoạt động', iconClass: 'bg-[#fcf0d9]',
    actions: [
      { modal: 'mission', label: 'Nhiệm vụ', icon: '📜' },
      { modal: 'attendance', label: 'Điểm danh', icon: '📅' },
      { modal: 'event', label: 'Sự kiện', icon: '🎉', requiresUnlock: true },
      { modal: 'market', label: 'Chợ cá', icon: '🏪', tourId: 'first-play-market', requiresUnlock: true },
      { modal: 'gacha', label: 'Gacha', icon: '🎁', requiresUnlock: true },
      { modal: 'aquaculture', label: 'Nông trại cá', icon: '🐠' },
    ],
  },
  {
    key: 'community', label: 'Cộng đồng & thành tích', iconClass: 'bg-[#e7eff7]',
    actions: [
      { modal: 'friend', label: 'Bạn bè', icon: '👥', requiresUnlock: true },
      { modal: 'team', label: 'Lập đội', icon: '🎣', requiresUnlock: true },
      { modal: 'faction', label: 'Phe phái', icon: '🛡️', requiresUnlock: true },
      { modal: 'leaderboard', label: 'Xếp hạng', icon: '📊', requiresUnlock: true },
      { modal: 'badge', label: 'Huy hiệu', icon: '🏆', requiresUnlock: true },
      { modal: 'diary', label: 'Nhật ký', icon: '📖' },
    ],
  },
];

const supportActions: LobbyAction[] = [
  { modal: 'redeem', label: 'Đổi mã', icon: '🎟️' },
  { modal: 'feedback', label: 'Phản hồi', icon: '💬' },
  { modal: 'donation', label: 'Ủng hộ', icon: '💚', requiresUnlock: true },
];
</script>

<template>
  <nav
    aria-label="Chức năng sảnh câu cá"
    class="lobby-menu flex max-h-[min(30rem,calc(100dvh-7rem))] w-full min-w-0 max-w-sm flex-col self-start overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-[0_4px_20px_-12px_rgba(36,53,42,0.3)]"
  >
    <div class="shrink-0 border-b border-[#cbd9c6] bg-linear-to-br from-[#edf5e5] to-[#f5f9f0] px-2.5 py-2">
      <div class="mb-2 flex items-center gap-2">
        <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#cbd9c6] bg-white/80 text-lg shadow-sm">🎣</span>
        <div class="min-w-0">
          <div class="text-sm font-bold tracking-wide">Sảnh câu cá</div>
          <div class="mt-0.5 text-[11px] leading-4 text-[#61745d]">Chuẩn bị cho chuyến câu tiếp theo</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="action in utilityActions"
          :id="action.tourId"
          :key="action.modal"
          type="button"
          class="lobby-menu__button relative flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-lg border border-[#cbd9c6] bg-white/85 px-1 py-1.5 text-[11px] leading-4"
          aria-haspopup="dialog"
          @click="modalStore.open(action.modal)"
        >
          <span aria-hidden="true" class="text-sm">{{ action.icon }}</span>
          <span>{{ action.label }}</span>
          <span
            v-if="action.modal === 'notifications' && notificationStore.unreadCount"
            class="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#b84436] px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-[#f5f9f0]"
            :aria-label="`${notificationStore.unreadCount} thông báo chưa đọc`"
          >{{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}</span>
        </button>
      </div>
    </div>

    <div
      role="region"
      aria-label="Danh sách chức năng"
      tabindex="0"
      class="lobby-menu__body min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#527547]"
    >
      <section
        v-for="group in actionGroups"
        :key="group.key"
        :aria-labelledby="`lobby-group-${group.key}`"
      >
        <div class="mb-1.5 flex items-center gap-2">
          <span :id="`lobby-group-${group.key}`" class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#61745d]">{{ group.label }}</span>
          <span aria-hidden="true" class="h-px flex-1 bg-[#dce5d6]"></span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="action in group.actions"
            :id="action.tourId"
            :key="action.modal"
            type="button"
            :disabled="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
            class="lobby-menu__button flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-[#d9e3d3] bg-white px-1 py-1.5 text-center shadow-[0_2px_0_#e2e9dc]"
            aria-haspopup="dialog"
            @click="modalStore.open(action.modal)"
          >
            <span
              aria-hidden="true"
              class="flex size-6 shrink-0 items-center justify-center rounded-md text-base"
              :class="group.iconClass"
            >{{ action.icon }}</span>
            <span class="text-[11px] font-semibold leading-4">{{ action.label }}</span>
            <span
              v-if="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
              class="inline-flex items-center gap-0.5 rounded bg-[#eef1e9] px-1 py-0.5 text-[9px] leading-3 text-[#64715e]"
            ><span aria-hidden="true">🔒</span> Cấp {{ configStore.requiredLevel(action.modal) }}</span>
          </button>
        </div>
      </section>
    </div>

    <div class="grid shrink-0 grid-cols-3 gap-1 border-t border-[#cbd9c6] bg-[#edf3e7] px-2 py-1">
      <button
        v-for="action in supportActions"
        :key="action.modal"
        type="button"
        :disabled="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
        class="lobby-menu__button flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1 text-[11px] leading-4"
        aria-haspopup="dialog"
        @click="modalStore.open(action.modal)"
      >
        <span aria-hidden="true" class="text-sm">{{ action.icon }}</span>
        <span>{{ action.label }}</span>
        <span
          v-if="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
          class="w-full text-[9px] leading-3 text-[#64715e]"
        ><span aria-hidden="true">🔒</span> Cấp {{ configStore.requiredLevel(action.modal) }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.lobby-menu__body {
  scrollbar-width: thin;
  scrollbar-color: #b7cbb4 transparent;
  scroll-padding-block: 0.5rem;
}

.lobby-menu__button {
  transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.lobby-menu__button:not(:disabled):hover {
  border-color: #8bab7a;
  background-color: #edf5e5;
  box-shadow: 0 2px 0 #cbd9c6;
}

.lobby-menu__button:not(:disabled):active {
  background-color: #e2edd8;
  box-shadow: inset 0 1px 3px #cbd9c6;
}

.lobby-menu__button:focus-visible {
  outline: 2px solid #527547;
  outline-offset: 2px;
}

.lobby-menu__button:disabled {
  cursor: not-allowed;
  border-style: dashed;
  background-color: #f1f3ed;
  box-shadow: none;
}

.lobby-menu__button:disabled > [aria-hidden="true"] {
  filter: grayscale(1);
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .lobby-menu__button {
    transition: none;
  }
}
</style>
