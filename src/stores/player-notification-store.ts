import type { NotificationRow } from "../types/table/notification";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { useAuthStore } from './auth';
import { useReadCacheStore } from './readCache';
import { createKeyedRefreshTask } from '../utils/refreshTask';
import { startVisibleRefresh } from '../utils/visibleRefresh';
import { supabaseNotificationRepository } from "../data/supabaseNotificationRepository";

type NotificationKind = "personal" | "system";

const refreshNotifications = createKeyedRefreshTask<Awaited<ReturnType<typeof supabaseNotificationRepository.fetchNotifications>>>();
const consumers = new Map<string, string>();
let stopRefresh: (() => void) | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

export const useNotificationStore = defineStore("notifications", {
  state: () => ({
    personal: [] as NotificationRow[],
    system: [] as NotificationRow[],
    loading: false,
    loadError: "",
    requestId: 0,
    ownerId: "",
    personalPage: 1,
    systemPage: 1,
    pageSize: 5,
    personalTotal: 0,
    systemTotal: 0,
    personalUnread: 0,
    systemUnread: 0,
    nextSystemExpiry: null as string | null,
  }),
  getters: {
    unreadCount: state => state.personalUnread + state.systemUnread,
  },
  actions: {
    async loadNotifications(userId: string, invalidate = false) {
      const auth = useAuthStore();
      const generation = auth.sessionGeneration;
      const request = ++this.requestId;
      const current = () => request === this.requestId && auth.user?.id === userId && auth.sessionGeneration === generation;
      if (this.ownerId !== userId) { this.personal = []; this.system = []; this.personalPage = 1; this.systemPage = 1; this.ownerId = userId; }
      this.loading = true; this.loadError = '';
      try {
        const personalPage = this.personalPage, systemPage = this.systemPage;
        const key = `list:${personalPage}:${systemPage}`;
        const notifications = await refreshNotifications(userId + ':' + generation + ':' + key,
          () => useReadCacheStore().get('notifications', key, () => supabaseNotificationRepository.fetchNotifications(userId, personalPage, systemPage), invalidate), invalidate);
        if (!current()) return;
        this.personal = notifications.personal; this.system = notifications.system;
        this.personalTotal = notifications.personalTotal; this.systemTotal = notifications.systemTotal;
        this.personalUnread = notifications.personalUnread; this.systemUnread = notifications.systemUnread;
        this.nextSystemExpiry = notifications.nextSystemExpiry ?? null;
        const lastPersonal = Math.max(1, Math.ceil(this.personalTotal / this.pageSize));
        const lastSystem = Math.max(1, Math.ceil(this.systemTotal / this.pageSize));
        if (this.personalPage > lastPersonal || this.systemPage > lastSystem) {
          this.personalPage = Math.min(this.personalPage, lastPersonal); this.systemPage = Math.min(this.systemPage, lastSystem);
          await this.loadNotifications(userId); return;
        }
        this.expireNotifications();
      } catch (error) {
        if (current()) this.loadError = error instanceof Error ? error.message : tr('notification.khong_the_tai_thong_bao');
      } finally { if (current()) this.loading = false; }
    },

    async markAsRead(kind: NotificationKind, item: NotificationRow, userId: string) {
      const generation = useAuthStore().sessionGeneration;
      await supabaseNotificationRepository.markAsRead(kind, item.id, userId);
      if (useAuthStore().user?.id !== userId || this.ownerId !== userId || useAuthStore().sessionGeneration !== generation) return;
      const list = kind === "personal" ? this.personal : this.system;
      const notification = list.find((entry) => entry.id === item.id);
      if (notification && !notification.is_read) {
        notification.is_read = true;
        if (kind === 'personal') this.personalUnread = Math.max(0, this.personalUnread - 1);
        else this.systemUnread = Math.max(0, this.systemUnread - 1);
      }
      void this.loadNotifications(userId, true);
    },

    expireNotifications() {
      clearTimeout(expiryTimer);
      const now = Date.now();
      const expired = this.system.filter(item => item.expires_at && Date.parse(item.expires_at) <= now);
      this.systemTotal = Math.max(0, this.systemTotal - expired.length);
      this.systemUnread = Math.max(0, this.systemUnread - expired.filter(item => !item.is_read).length);
      this.system = this.system.filter(item => !item.expires_at || Date.parse(item.expires_at) > now);
      const next = Math.min(
        ...this.system.filter(item => item.expires_at).map(item => Date.parse(item.expires_at!)),
        this.nextSystemExpiry ? Date.parse(this.nextSystemExpiry) : Infinity,
      );
      if (Number.isFinite(next)) expiryTimer = setTimeout(() => {
        this.nextSystemExpiry = null;
        this.expireNotifications();
        const userId = useAuthStore().user?.id;
        if (userId && this.ownerId === userId) void this.loadNotifications(userId, true);
      }, Math.min(Math.max(1, next - now + 1), 2_147_483_647));
    },
    startRefreshing(userId: string, consumer: 'badge' | 'modal') {
      if (this.ownerId !== userId) {
        consumers.clear(); stopRefresh?.(); stopRefresh = null;
        clearTimeout(expiryTimer); ++this.requestId;
        this.personal = []; this.system = []; this.personalPage = 1; this.systemPage = 1;
        this.personalTotal = 0; this.systemTotal = 0; this.personalUnread = 0; this.systemUnread = 0; this.ownerId = userId;
        this.nextSystemExpiry = null;
      }
      consumers.set(consumer, userId);
      if (!stopRefresh) stopRefresh = startVisibleRefresh(async () => {
        const owner = consumers.values().next().value;
        if (!owner || useAuthStore().user?.id !== owner) return;
        await this.loadNotifications(owner);
        if (this.loadError) throw new Error(this.loadError);
      }, 60_000);
      else if (consumer === 'modal') void this.loadNotifications(userId);
    },
    stopRefreshing(consumer: 'badge' | 'modal') {
      consumers.delete(consumer);
      if (consumers.size) return;
      stopRefresh?.(); stopRefresh = null;
      clearTimeout(expiryTimer);
      ++this.requestId;
      this.loading = false;
    },
  },
});
