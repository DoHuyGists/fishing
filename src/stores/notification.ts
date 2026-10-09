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
  }),
  actions: {
    async loadNotifications(userId: string) {
      this.loading = true;
      this.loadError = "";
      try {
        const notifications = await supabaseNotificationRepository.fetchNotifications(userId);
        this.personal = notifications.personal;
        this.system = notifications.system;
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : "Không thể tải thông báo.";
      } finally {
        this.loading = false;
      }
    },

    async markAsRead(kind: NotificationKind, item: NotificationRow, userId: string) {
      await supabaseNotificationRepository.markAsRead(kind, item.id, userId);
      const list = kind === "personal" ? this.personal : this.system;
      const notification = list.find((entry) => entry.id === item.id);
      if (notification) notification.is_read = true;
    },

    subscribeToNotifications(userId: string) {
      if (realtimeChannel) void supabaseNotificationRepository.unsubscribe(realtimeChannel);
      realtimeChannel = supabaseNotificationRepository.subscribeToNotifications(userId, () => {
        void this.loadNotifications(userId);
      });
    },

    subscribeToNewNotifications(userId: string, onNewNotification: () => void) {
      if (badgeChannel) void supabaseNotificationRepository.unsubscribe(badgeChannel);
      badgeChannel = supabaseNotificationRepository.subscribeToNewNotifications(userId, onNewNotification);
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
