<script setup lang="ts">
import type { LobbyAction } from "../../../types/model/worldMap";
import { t as tr } from "../../../i18n";

import { useConfigStore } from "../../../stores/player-config-store.ts";
import { useModalStore } from "../../../stores/player-modal-store.ts";
import { useNotificationStore } from "../../../stores/player-notification-store.ts";
import { useFeatureAvailabilityStore } from "../../../stores/player-feature-availability-store.ts";
import FeatureIndicator from "../../shared/FeatureIndicator.vue";

const configStore = useConfigStore();
const modalStore = useModalStore();
const notificationStore = useNotificationStore();
const features = useFeatureAvailabilityStore();

const buttonDirections = ["from-top-left", "from-top-right", "from-bottom-left", "from-bottom-right"];

const utilityActions: LobbyAction[] = [
  {
    modal: "account",
    get label() {
      return tr("FeatureTable.tai_khoan");
    },
    icon: "⚙️",
    tourId: "first-play-account",
  },
  {
    modal: "game-settings",
    get label() {
      return tr("FishingView.cai_dat");
    },
    icon: "🔧",
  },
  {
    modal: "guide",
    get label() {
      return tr("FeatureTable.huong_dan");
    },
    icon: "📖",
  },
  {
    modal: "tutorial",
    get label() {
      return tr("NewPlayerFishing.thuc_hanh");
    },
    icon: "🎣",
  },
  {
    modal: "notifications",
    get label() {
      return tr("NotificationModal.thong_bao");
    },
    icon: "🔔",
  },
];

const actionGroups: { key: string; label: string; iconClass: string; actions: LobbyAction[] }[] = [
  {
    key: "equipment",
    get label() {
      return tr("FeatureTable.hanh_trang");
    },
    iconClass: "bg-surface",
    actions: [
      {
        modal: "inventory",
        get label() {
          return tr("InventoryModal.trang_bi");
        },
        icon: "🎽",
        tourId: "first-play-inventory",
      },
      {
        modal: "storage",
        get label() {
          return tr("InventoryModal.kho_do");
        },
        icon: "🎒",
      },
      {
        modal: "caught",
        get label() {
          return tr("FeatureTable.kho_ca");
        },
        icon: "🐟",
        tourId: "first-play-storage",
      },
      {
        modal: "shop",
        get label() {
          return tr("FeatureTable.cua_hang");
        },
        icon: "🛒",
      },
      {
        modal: "skill",
        get label() {
          return tr("SkillModal.ky_nang");
        },
        icon: "✨",
      },
      {
        modal: "post-production",
        get label() {
          return tr("PostProduction.luoi_ca");
        },
        icon: "🕸️",
        requiresUnlock: true,
      },
      {
        modal: "work-bench",
        get label() {
          return tr("WorkBenchModal.che_tao");
        },
        icon: "🛠️",
        requiresUnlock: true,
      },
    ],
  },
  {
    key: "activities",
    get label() {
      return tr("FeatureTable.hoat_dong");
    },
    iconClass: "bg-surface",
    actions: [
      {
        modal: "story",
        get label() {
          return tr("Story.library");
        },
        icon: "◈",
      },
      {
        modal: "mission",
        get label() {
          return tr("MissionList.nhiem_vu");
        },
        icon: "📜",
      },
      {
        modal: "fishing-map",
        get label() {
          return tr("FishingMapModal.title");
        },
        icon: "🗺️",
      },
      {
        modal: "attendance",
        get label() {
          return tr("AttendanceModal.diem_danh");
        },
        icon: "📅",
      },
      {
        modal: "event",
        get label() {
          return tr("EventModal.su_kien_2");
        },
        icon: "🎉",
        requiresUnlock: true,
      },
      {
        modal: "market",
        get label() {
          return tr("MarketWindow.cho_ca");
        },
        icon: "🏪",
        tourId: "first-play-market",
        requiresUnlock: true,
      },
      { modal: "gacha", label: "Gacha", icon: "🎁", requiresUnlock: true },
      {
        modal: "aquaculture",
        get label() {
          return tr("AquacultureModal.nong_trai_ca");
        },
        icon: "🐠",
      },
      {
        modal: "dispatch",
        get label() {
          return tr("Dispatch.title");
        },
        icon: "🧭",
      },
    ],
  },
  {
    key: "community",
    get label() {
      return tr("FeatureTable.cong_dong_thanh_tich");
    },
    iconClass: "bg-surface",
    actions: [
      {
        modal: "friend",
        get label() {
          return tr("FeatureTable.ban_be");
        },
        icon: "👥",
        requiresUnlock: true,
      },
      {
        modal: "team",
        get label() {
          return tr("FeatureTable.lap_doi");
        },
        icon: "🎣",
        requiresUnlock: true,
      },
      {
        modal: "faction",
        get label() {
          return tr("FactionSelectModal.phe_phai");
        },
        icon: "🛡️",
        requiresUnlock: true,
      },
      {
        modal: "leaderboard",
        get label() {
          return tr("FeatureTable.xep_hang");
        },
        icon: "📊",
        requiresUnlock: true,
      },
      {
        modal: "badge",
        get label() {
          return tr("Achievement.huy_hieu");
        },
        icon: "🏆",
        requiresUnlock: true,
      },
      {
        modal: "diary",
        get label() {
          return tr("FeatureTable.nhat_ky");
        },
        icon: "📖",
      },
    ],
  },
];

const supportActions: LobbyAction[] = [
  {
    modal: "rule",
    get label() {
      return tr("RuleModal.title");
    },
    icon: "📋",
  },
  {
    modal: "redeem",
    get label() {
      return tr("CurrencyConvertTable.quy_doi");
    },
    icon: "🎟️",
  },
  {
    modal: "feedback",
    get label() {
      return tr("Feedbackmodal.phan_hoi");
    },
    icon: "💬",
  },
  {
    modal: "donation",
    get label() {
      return tr("FeatureTable.ung_ho");
    },
    icon: "💚",
    requiresUnlock: true,
  },
];
</script>

<template>
  <nav
    :aria-label="tr('FeatureTable.chuc_nang_sanh_cau_ca')"
    class="lobby-menu flex max-h-[calc(100dvh-6rem)] w-full min-w-0 max-w-sm flex-col self-start overflow-hidden rounded-xl border border-border-default bg-surface text-content shadow-[0_4px_20px_-12px_color-mix(in_srgb,_var(--color-content)_30%,_transparent)]"
  >
    <div class="lobby-menu__header shrink-0 border-b border-border-default bg-surface px-2.5 py-2">
      <div class="mb-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-default bg-white/80 text-lg shadow-sm"
          >🎣</span
        >
        <div class="min-w-0">
          <div class="text-sm font-bold tracking-wide">{{ tr("FeatureTable.sanh_cau_ca") }}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="(action, actionIndex) in utilityActions"
          :id="action.tourId"
          :key="action.modal"
          type="button"
          :data-locked="!features.canOpen(action.modal)"
          class="slide-fade-in lobby-menu__button [--slide-distance:24px]! [transition:background-color_150ms_ease,border-color_150ms_ease,box-shadow_150ms_ease] [&[data-locked=true]]:cursor-pointer [&[data-locked=true]]:border-dashed [&[data-locked=true]]:bg-surface [&[data-locked=true]]:shadow-none [&[data-locked=true]>[aria-hidden=true]]:grayscale [&[data-locked=true]>[aria-hidden=true]]:opacity-60 enabled:hover:border-accent enabled:hover:bg-surface enabled:hover:shadow-[0_2px_0_var(--color-border-default)] enabled:active:bg-surface enabled:active:shadow-[inset_0_1px_3px_var(--color-border-default)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed! disabled:border-dashed disabled:bg-surface disabled:shadow-none [&:disabled>[aria-hidden=true]]:grayscale [&:disabled>[aria-hidden=true]]:opacity-60 motion-reduce:transition-none relative flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-lg border border-border-default bg-white/85 px-1 py-1.5 text-[11px] leading-4"
          :class="buttonDirections[actionIndex % buttonDirections.length]"
          aria-haspopup="dialog"
          @click="features.canOpen(action.modal) ? modalStore.open(action.modal) : features.showDetails(action.modal)"
        >
          <span aria-hidden="true" class="text-sm">{{ action.icon }}</span>
          <span>{{ action.label }}</span>
          <span v-if="!features.canOpen(action.modal)" class="w-full text-[9px] underline underline-offset-2">{{
            tr("FeatureAvailability.maintenanceBadge")
          }}</span>
          <span
            v-if="action.modal === 'notifications' && notificationStore.unreadCount"
            class="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-surface"
            :aria-label="tr('FeatureTable.value0_thong_bao_chua_doc', { value0: notificationStore.unreadCount })"
            >{{ notificationStore.unreadCount > 99 ? "99+" : notificationStore.unreadCount }}</span
          >
        </button>
      </div>
    </div>

    <div
      role="region"
      :aria-label="tr('FeatureTable.danh_sach_chuc_nang')"
      tabindex="0"
      class="lobby-menu__body [scrollbar-width:thin] [scrollbar-color:var(--color-ocean-cyan)_transparent] scroll-py-2 min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <section
        v-for="(group, groupIndex) in actionGroups"
        :key="group.key"
        :aria-labelledby="`lobby-group-${group.key}`"
      >
        <div class="mb-1.5 flex items-center gap-2">
          <span
            :id="`lobby-group-${group.key}`"
            class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-content"
            >{{ group.label }}</span
          >
          <span aria-hidden="true" class="h-px flex-1 bg-surface"></span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="(action, actionIndex) in group.actions"
            :id="action.tourId"
            :key="action.modal"
            type="button"
            :disabled="features.canOpen(action.modal) && action.requiresUnlock && !configStore.isUnlocked(action.modal)"
            :data-locked="!features.canOpen(action.modal)"
            class="slide-fade-in lobby-menu__button [--slide-distance:24px]! [transition:background-color_150ms_ease,border-color_150ms_ease,box-shadow_150ms_ease] [&[data-locked=true]]:cursor-pointer [&[data-locked=true]]:border-dashed [&[data-locked=true]]:bg-surface [&[data-locked=true]]:shadow-none [&[data-locked=true]>[aria-hidden=true]]:grayscale [&[data-locked=true]>[aria-hidden=true]]:opacity-60 enabled:hover:border-accent enabled:hover:bg-surface enabled:hover:shadow-[0_2px_0_var(--color-border-default)] enabled:active:bg-surface enabled:active:shadow-[inset_0_1px_3px_var(--color-border-default)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed! disabled:border-dashed disabled:bg-surface disabled:shadow-none [&:disabled>[aria-hidden=true]]:grayscale [&:disabled>[aria-hidden=true]]:opacity-60 motion-reduce:transition-none flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-white px-1 py-1.5 text-center shadow-[0_2px_0_var(--color-surface)]"
            :class="buttonDirections[(actionIndex + groupIndex) % buttonDirections.length]"
            aria-haspopup="dialog"
            @click="features.canOpen(action.modal) ? modalStore.open(action.modal) : features.showDetails(action.modal)"
          >
            <span
              aria-hidden="true"
              class="flex size-6 shrink-0 items-center justify-center rounded-md text-base"
              :class="group.iconClass"
              >{{ action.icon }}</span
            >
            <span class="text-[11px] font-semibold leading-4">{{ action.label }}</span>
            <FeatureIndicator
              :modal="action.modal"
              :disabled="!features.canOpen(action.modal) || Boolean(action.requiresUnlock && !configStore.isUnlocked(action.modal))"
            />
            <span
              v-if="!features.canOpen(action.modal)"
              class="rounded bg-surface px-1 py-0.5 text-[9px] leading-3 text-accent underline underline-offset-2"
              >{{ tr("FeatureAvailability.maintenanceBadge") }}</span
            >
            <span
              v-else-if="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
              class="inline-flex items-center gap-0.5 rounded bg-surface px-1 py-0.5 text-[9px] leading-3 text-content"
              ><span aria-hidden="true">🔒</span> {{ tr("FishPond.cap") }}
              {{ configStore.requiredLevel(action.modal) }}</span
            >
          </button>
        </div>
      </section>
    </div>

    <div class="lobby-menu__footer grid shrink-0 grid-cols-2 gap-1 border-t border-border-default bg-surface px-2 py-1">
      <button
        v-for="(action, actionIndex) in supportActions"
        :key="action.modal"
        type="button"
        :disabled="features.canOpen(action.modal) && action.requiresUnlock && !configStore.isUnlocked(action.modal)"
        :data-locked="!features.canOpen(action.modal)"
        class="slide-fade-in lobby-menu__button [--slide-distance:24px]! [transition:background-color_150ms_ease,border-color_150ms_ease,box-shadow_150ms_ease] [&[data-locked=true]]:cursor-pointer [&[data-locked=true]]:border-dashed [&[data-locked=true]]:bg-surface [&[data-locked=true]]:shadow-none [&[data-locked=true]>[aria-hidden=true]]:grayscale [&[data-locked=true]>[aria-hidden=true]]:opacity-60 enabled:hover:border-accent enabled:hover:bg-surface enabled:hover:shadow-[0_2px_0_var(--color-border-default)] enabled:active:bg-surface enabled:active:shadow-[inset_0_1px_3px_var(--color-border-default)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed! disabled:border-dashed disabled:bg-surface disabled:shadow-none [&:disabled>[aria-hidden=true]]:grayscale [&:disabled>[aria-hidden=true]]:opacity-60 motion-reduce:transition-none flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1 text-[11px] leading-4"
        :class="buttonDirections[(actionIndex + 2) % buttonDirections.length]"
        aria-haspopup="dialog"
        @click="features.canOpen(action.modal) ? modalStore.open(action.modal) : features.showDetails(action.modal)"
      >
        <span aria-hidden="true" class="text-sm">{{ action.icon }}</span>
        <span>{{ action.label }}</span>
        <span
          v-if="!features.canOpen(action.modal)"
          class="w-full text-[9px] text-accent underline underline-offset-2"
          >{{ tr("FeatureAvailability.maintenanceBadge") }}</span
        >
        <span
          v-else-if="action.requiresUnlock && !configStore.isUnlocked(action.modal)"
          class="w-full text-[9px] leading-3 text-content"
          ><span aria-hidden="true">🔒</span> {{ tr("FishPond.cap") }}
          {{ configStore.requiredLevel(action.modal) }}</span
        >
      </button>
    </div>
  </nav>
</template>

<style scoped>
.lobby-menu__button {
  position: relative;
}

html.ocean-theme .lobby-menu {
  border-color: color-mix(in srgb, var(--color-ocean-gold) 70%, transparent);
  background: var(--color-ocean-deep);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-ocean-panel) 80%, transparent), 0 12px 28px color-mix(in srgb, var(--color-content) 25%, transparent);
}

html.ocean-theme .lobby-menu__header,
html.ocean-theme .lobby-menu__footer {
  border-color: color-mix(in srgb, var(--color-ocean-gold) 45%, transparent);
  background: var(--color-primary);
}

html.ocean-theme .lobby-menu__button {
  border-color: var(--color-accent);
  background: var(--color-surface);
  color: var(--color-ocean-pearl);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-surface) 12%, transparent), 0 2px 0 color-mix(in srgb, var(--color-content) 20%, transparent);
}

html.ocean-theme .lobby-menu__button:enabled:hover {
  border-color: var(--color-ocean-cyan);
  background: var(--color-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-surface) 18%, transparent), 0 0 12px color-mix(in srgb, var(--color-sky) 18%, transparent);
}

html.ocean-theme .lobby-menu__button:disabled,
html.ocean-theme .lobby-menu__button[data-locked="true"] {
  border-color: color-mix(in srgb, var(--color-ocean-pearl) 20%, transparent);
  background: var(--color-ocean-deep);
  box-shadow: none;
}

html.ocean-theme .lobby-menu__button:focus-visible {
  outline-color: var(--color-ocean-cyan);
}
</style>
