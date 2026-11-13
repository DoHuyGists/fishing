<script setup lang="ts">
import type { LobbyAction } from "../../../types/model/worldMap";
import { t as tr } from "../../../i18n";

import { useConfigStore } from "../../../stores/config.ts";
import { useModalStore } from "../../../stores/modal.ts";
import { useNotificationStore } from "../../../stores/notification.ts";
import { useFeatureAvailabilityStore } from "../../../stores/featureAvailability";

const configStore = useConfigStore();
const modalStore = useModalStore();
const notificationStore = useNotificationStore();
const features = useFeatureAvailabilityStore();

const buttonDirections = ['from-top-left', 'from-top-right', 'from-bottom-left', 'from-bottom-right'];

const utilityActions: LobbyAction[] = [
  { modal: 'account', get label() { return tr('FeatureTable.tai_khoan'); }, icon: '⚙️', tourId: 'first-play-account' },
  { modal: 'guide', get label() { return tr('FeatureTable.huong_dan'); }, icon: '📖' },
  { modal: 'tutorial', get label() { return tr('NewPlayerFishing.thuc_hanh'); }, icon: '🎣' },
  { modal: 'notifications', get label() { return tr('NotificationModal.thong_bao'); }, icon: '🔔' },
];

const actionGroups: { key: string; label: string; iconClass: string; actions: LobbyAction[] }[] = [
  {
    key: 'equipment', get label() { return tr('FeatureTable.hanh_trang'); }, iconClass: 'bg-[#e7f0df]',
    actions: [
      { modal: 'inventory', get label() { return tr('InventoryModal.tui_do'); }, icon: '🎒', tourId: 'first-play-inventory' },
      { modal: 'body', get label() { return tr('EquipmentMenu.nhan_vat'); }, icon: '🧍' },
      { modal: 'caught', get label() { return tr('FeatureTable.kho_ca'); }, icon: '🐟', tourId: 'first-play-storage' },
      { modal: 'shop', get label() { return tr('FeatureTable.cua_hang'); }, icon: '🛒' },
      { modal: 'skill', get label() { return tr('SkillModal.ky_nang'); }, icon: '✨' },
      { modal: 'post-production', get label() { return tr('PostProduction.luoi_ca'); }, icon: '🕸️', requiresUnlock: true },
      { modal: 'work-bench', get label() { return tr('WorkBenchModal.che_tao'); }, icon: '🛠️', requiresUnlock: true },
    ],
  },
  {
    key: 'activities', get label() { return tr('FeatureTable.hoat_dong'); }, iconClass: 'bg-[#fcf0d9]',
    actions: [
      { modal: 'mission', get label() { return tr('MissionList.nhiem_vu'); }, icon: '📜' },
      { modal: 'attendance', get label() { return tr('AttendanceModal.diem_danh'); }, icon: '📅' },
      { modal: 'event', get label() { return tr('EventModal.su_kien_2'); }, icon: '🎉', requiresUnlock: true },
      { modal: 'market', get label() { return tr('MarketWindow.cho_ca'); }, icon: '🏪', tourId: 'first-play-market', requiresUnlock: true },
      { modal: 'gacha', label: 'Gacha', icon: '🎁', requiresUnlock: true },
      { modal: 'aquaculture', get label() { return tr('AquacultureModal.nong_trai_ca'); }, icon: '🐠' },
    ],
  },
  {
    key: 'community', get label() { return tr('FeatureTable.cong_dong_thanh_tich'); }, iconClass: 'bg-[#e7eff7]',
    actions: [
      { modal: 'friend', get label() { return tr('FeatureTable.ban_be'); }, icon: '👥', requiresUnlock: true },
      { modal: 'team', get label() { return tr('FeatureTable.lap_doi'); }, icon: '🎣', requiresUnlock: true },
      { modal: 'faction', get label() { return tr('FactionSelectModal.phe_phai'); }, icon: '🛡️', requiresUnlock: true },
      { modal: 'leaderboard', get label() { return tr('FeatureTable.xep_hang'); }, icon: '📊', requiresUnlock: true },
      { modal: 'badge', get label() { return tr('Achievement.huy_hieu'); }, icon: '🏆', requiresUnlock: true },
      { modal: 'diary', get label() { return tr('FeatureTable.nhat_ky'); }, icon: '📖' },
    ],
  },
];

const supportActions: LobbyAction[] = [
  { modal: 'redeem', get label() { return tr('CurrencyConvertTable.quy_doi'); }, icon: '🎟️' },
  { modal: 'feedback', get label() { return tr('Feedbackmodal.phan_hoi'); }, icon: '💬' },
  { modal: 'donation', get label() { return tr('FeatureTable.ung_ho'); }, icon: '💚', requiresUnlock: true },
];
</script>

<template>
  <nav
    :aria-label="tr('FeatureTable.chuc_nang_sanh_cau_ca')"
    class="lobby-menu flex max-h-[min(30rem,calc(100dvh-7rem))] w-full min-w-0 max-w-sm flex-col self-start overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-[0_4px_20px_-12px_rgba(36,53,42,0.3)]"
  >
    <div class="shrink-0 border-b border-[#cbd9c6] bg-linear-to-br from-[#edf5e5] to-[#f5f9f0] px-2.5 py-2">
      <div class="mb-2 flex items-center gap-2">
        <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#cbd9c6] bg-white/80 text-lg shadow-sm">🎣</span>
        <div class="min-w-0">
          <div class="text-sm font-bold tracking-wide">{{ tr('FeatureTable.sanh_cau_ca') }}</div>
          <div class="mt-0.5 text-[11px] leading-4 text-[#61745d]">{{ tr('FeatureTable.chuan_bi_cho_chuyen_cau_tiep_theo') }}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="(action, actionIndex) in utilityActions"
          :id="action.tourId"
          :key="action.modal"
          type="button"
          :data-locked="!features.canOpen(action.modal)"
          class="slide-fade-in lobby-menu__button [--slide-distance:24px]! [transition:background-color_150ms_ease,border-color_150ms_ease,box-shadow_150ms_ease] [&[data-locked=true]]:cursor-pointer [&[data-locked=true]]:border-dashed [&[data-locked=true]]:bg-[#f1f3ed] [&[data-locked=true]]:shadow-none [&[data-locked=true]>[aria-hidden=true]]:grayscale [&[data-locked=true]>[aria-hidden=true]]:opacity-60 enabled:hover:border-[#8bab7a] enabled:hover:bg-[#edf5e5] enabled:hover:shadow-[0_2px_0_#cbd9c6] enabled:active:bg-[#e2edd8] enabled:active:shadow-[inset_0_1px_3px_#cbd9c6] focus-visible:outline-2 focus-visible:outline-[#527547] focus-visible:outline-offset-2 disabled:cursor-not-allowed! disabled:border-dashed disabled:bg-[#f1f3ed] disabled:shadow-none [&:disabled>[aria-hidden=true]]:grayscale [&:disabled>[aria-hidden=true]]:opacity-60 motion-reduce:transition-none relative flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-lg border border-[#cbd9c6] bg-white/85 px-1 py-1.5 text-[11px] leading-4"
          :class="buttonDirections[actionIndex % buttonDirections.length]"
          aria-haspopup="dialog"
          @click="features.canOpen(action.modal) ? modalStore.open(action.modal) : features.showDetails(action.modal)"
        >
          <span aria-hidden="true" class="text-sm">{{ action.icon }}</span>
          <span>{{ action.label }}</span>
          <span v-if="!features.canOpen(action.modal)" class="w-full text-[9px] underline underline-offset-2">{{ tr('FeatureAvailability.maintenanceBadge') }}</span>
          <span
            v-if="action.modal === 'notifications' && notificationStore.unreadCount"
            class="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#b84436] px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-[#f5f9f0]"
            :aria-label="tr('FeatureTable.value0_thong_bao_chua_doc', { value0: notificationStore.unreadCount })"
          >{{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}</span>
        </button>
      </div>
    </div>

    <div
      role="region"
      :aria-label="tr('FeatureTable.danh_sach_chuc_nang')"
      tabindex="0"
      class="lobby-menu__body [scrollbar-width:thin] [scrollbar-color:#b7cbb4_transparent] scroll-py-2 min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#527547]"
    >
      <section
        v-for="(group, groupIndex) in actionGroups"
        :key="group.key"
        :aria-labelledby="`lobby-group-${group.key}`"
      >
        <div class="mb-1.5 flex items-center gap-2">
          <span :id="`lobby-group-${group.key}`" class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#61745d]">{{ group.label }}</span>
          <span aria-hidden="true" class="h-px flex-1 bg-[#dce5d6]"></span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="(action, actionIndex) in group.actions"
            :id="action.tourId"
            :key="action.modal"
            type="button"
            :disabled="features.canOpen(action.modal) && action.requiresUnlock && !configStore.isUnlocked(action.modal)"
            :data-locked="!features.canOpen(action.modal)"
            class="slide-fade-in lobby-menu__button [--slide-distance:24px]! [transition:background-color_150ms_ease,border-color_150ms_ease,box-shadow_150ms_ease] [&[data-locked=true]]:cursor-pointer [&[data-locked=true]]:border-dashed [&[data-locked=true]]:bg-[#f1f3ed] [&[data-locked=true]]:shadow-none [&[data-locked=true]>[aria-hidden=true]]:grayscale [&[data-locked=true]>[aria-hidden=true]]:opacity-60 enabled:hover:border-[#8bab7a] enabled:hover:bg-[#edf5e5] enabled:hover:shadow-[0_2px_0_#cbd9c6] enabled:active:bg-[#e2edd8] enabled:active:shadow-[inset_0_1px_3px_#cbd9c6] focus-visible:outline-2 focus-visible:outline-[#527547] focus-visible:outline-offset-2 disabled:cursor-not-allowed! disabled:border-dashed disabled:bg-[#f1f3ed] disabled:shadow-none [&:disabled>[aria-hidden=true]]:grayscale [&:disabled>[aria-hidden=true]]:opacity-60 motion-reduce:transition-none flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-[#d9e3d3] bg-white px-1 py-1.5 text-center shadow-[0_2px_0_#e2e9dc]"
            :class="buttonDirections[(actionIndex + groupIndex) % buttonDirections.length]"
            aria-haspopup="dialog"
            @click="features.canOpen(action.modal) ? modalStore.open(action.modal) : features.showDetails(action.modal)"
          >
            <span
              aria-hidden="true"
              class="flex size-6 shrink-0 items-center justify-center rounded-md text-base"
              :class="group.iconClass"
            >{{ action.icon }}</span>
            <span class="text-[11px] font-semibold leading-4">{{ action.label }}</span>
            <span
              v-if="!features.canOpen(action.modal)"
              class="rounded bg-amber-100 px-1 py-0.5 text-[9px] leading-3 text-amber-900 underline underline-offset-2"
            >{{ tr('FeatureAvailability.maintenanceBadge') }}</span>
            <span
              v-else-if="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
              class="inline-flex items-center gap-0.5 rounded bg-[#eef1e9] px-1 py-0.5 text-[9px] leading-3 text-[#64715e]"
            ><span aria-hidden="true">🔒</span> {{ tr('FishPond.cap') }} {{ configStore.requiredLevel(action.modal) }}</span>
          </button>
        </div>
      </section>
    </div>

    <div class="grid shrink-0 grid-cols-3 gap-1 border-t border-[#cbd9c6] bg-[#edf3e7] px-2 py-1">
      <button
        v-for="(action, actionIndex) in supportActions"
        :key="action.modal"
        type="button"
        :disabled="features.canOpen(action.modal) && action.requiresUnlock && !configStore.isUnlocked(action.modal)"
        :data-locked="!features.canOpen(action.modal)"
        class="slide-fade-in lobby-menu__button [--slide-distance:24px]! [transition:background-color_150ms_ease,border-color_150ms_ease,box-shadow_150ms_ease] [&[data-locked=true]]:cursor-pointer [&[data-locked=true]]:border-dashed [&[data-locked=true]]:bg-[#f1f3ed] [&[data-locked=true]]:shadow-none [&[data-locked=true]>[aria-hidden=true]]:grayscale [&[data-locked=true]>[aria-hidden=true]]:opacity-60 enabled:hover:border-[#8bab7a] enabled:hover:bg-[#edf5e5] enabled:hover:shadow-[0_2px_0_#cbd9c6] enabled:active:bg-[#e2edd8] enabled:active:shadow-[inset_0_1px_3px_#cbd9c6] focus-visible:outline-2 focus-visible:outline-[#527547] focus-visible:outline-offset-2 disabled:cursor-not-allowed! disabled:border-dashed disabled:bg-[#f1f3ed] disabled:shadow-none [&:disabled>[aria-hidden=true]]:grayscale [&:disabled>[aria-hidden=true]]:opacity-60 motion-reduce:transition-none flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1 text-[11px] leading-4"
        :class="buttonDirections[(actionIndex + 2) % buttonDirections.length]"
        aria-haspopup="dialog"
        @click="features.canOpen(action.modal) ? modalStore.open(action.modal) : features.showDetails(action.modal)"
      >
        <span aria-hidden="true" class="text-sm">{{ action.icon }}</span>
        <span>{{ action.label }}</span>
        <span
          v-if="!features.canOpen(action.modal)"
          class="w-full text-[9px] text-amber-900 underline underline-offset-2"
        >{{ tr('FeatureAvailability.maintenanceBadge') }}</span>
        <span
          v-else-if="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
          class="w-full text-[9px] leading-3 text-[#64715e]"
        ><span aria-hidden="true">🔒</span> {{ tr('FishPond.cap') }} {{ configStore.requiredLevel(action.modal) }}</span>
      </button>
    </div>
  </nav>
</template>
