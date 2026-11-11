import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseNotificationRepository, type NotificationRow } from "../data/supabaseNotificationRepository";

type NotificationKind = "personal" | "system";

let realtimeChannel: RealtimeChannel | null = null;
let badgeChannel: RealtimeChannel | null = null;

export const useNotificationStore = defineStore("notifications", {
  state: () => ({
    personal: [] as NotificationRow[],
    system: [] as NotificationRow[],
    loading: false,
    loadError: "",
    requestId: 0,
    ownerId: "",
  }),
  getters: {
    unreadCount: state => [...state.personal, ...state.system].filter(item => !item.is_read).length,
  },
  actions: {
    async loadNotifications(userId: string) {
      const request = ++this.requestId;
      if (this.ownerId !== userId) { this.personal = []; this.system = []; this.ownerId = userId; }
      this.loading = true;
      this.loadError = "";
      try {
        const notifications = await supabaseNotificationRepository.fetchNotifications(userId);
        if (request !== this.requestId) return;
        this.personal = notifications.personal;
        this.system = notifications.system;
      } catch (error) {
        if (request === this.requestId) this.loadError = error instanceof Error ? error.message : tr('notification.khong_the_tai_thong_bao');
      } finally {
        if (request === this.requestId) this.loading = false;
      }
    },

    async markAsRead(kind: NotificationKind, item: NotificationRow, userId: string) {
      await supabaseNotificationRepository.markAsRead(kind, item.id, userId);
      const list = kind === "personal" ? this.personal : this.system;
      const notification = list.find((entry) => entry.id === item.id);
      if (notification) notification.is_read = true;
      void this.loadNotifications(userId);
    },

    subscribeToNotifications(userId: string) {
      if (realtimeChannel) void supabaseNotificationRepository.unsubscribe(realtimeChannel);
      realtimeChannel = supabaseNotificationRepository.subscribeToNotifications(userId, () => {
        void this.loadNotifications(userId);
      });
    },

    subscribeToNewNotifications(userId: string, onNewNotification: () => void) {
      if (badgeChannel) void supabaseNotificationRepository.unsubscribe(badgeChannel);
      void this.loadNotifications(userId);
      badgeChannel = supabaseNotificationRepository.subscribeToNotifications(userId, () => {
        void this.loadNotifications(userId);
        onNewNotification();
      }, "badge");
    },

    async unsubscribeFromNotifications() {
      if (!realtimeChannel) return;
      const channel = realtimeChannel;
      realtimeChannel = null;
      await supabaseNotificationRepository.unsubscribe(channel);
    },

    async unsubscribeFromNewNotifications() {
      if (!badgeChannel) return;
      const channel = badgeChannel;
      badgeChannel = null;
      await supabaseNotificationRepository.unsubscribe(channel);
    },
  },
});
