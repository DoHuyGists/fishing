import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../database/connection";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  expires_at?: string | null;
  is_read: boolean;
}

export type NotificationKind = "personal" | "system";

export interface AdminNotificationRow {
  id: string;
  title: string;
  body: string;
  type: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  user_id?: string;
  expires_at?: string | null;
  is_read?: boolean;
}

export type AdminNotificationPayload = Partial<Record<string, string | null>>;

const adminTable = (kind: NotificationKind) => (kind === "system" ? "system_notifications" : "personal_notifications");

class SupabaseNotificationRepository {
  async fetchAdminNotifications(kind: NotificationKind): Promise<AdminNotificationRow[]> {
    const columns =
      kind === "system"
        ? "id,title,body,type,data,created_at,expires_at"
        : "id,user_id,title,body,type,data,is_read,created_at";
    const { data, error } = await supabase
      .from(adminTable(kind))
      .select(columns)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminNotificationRow[];
  }

  async saveAdminNotification(kind: NotificationKind, id: string | null, payload: AdminNotificationPayload) {
    const table = supabase.from(adminTable(kind));
    const { error } = id ? await table.update(payload).eq("id", id) : await table.insert(payload);
    if (error) throw new Error(error.message);
  }

  async deleteAdminNotification(kind: NotificationKind, id: string) {
    const { error } = await supabase.from(adminTable(kind)).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async fetchNotifications(userId: string): Promise<{ personal: NotificationRow[]; system: NotificationRow[] }> {
    const now = new Date().toISOString();
    const [personalResult, systemResult, readsResult] = await Promise.all([
      supabase
        .from("personal_notifications")
        .select("id,title,body,type,data,is_read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("system_notifications")
        .select("id,title,body,type,data,created_at,expires_at")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false }),
      supabase.from("system_notification_reads").select("notification_id").eq("user_id", userId),
    ]);

    if (personalResult.error) throw new Error(personalResult.error.message);
    if (systemResult.error) throw new Error(systemResult.error.message);
    if (readsResult.error) throw new Error(readsResult.error.message);

    const readIds = new Set((readsResult.data ?? []).map((row) => row.notification_id as string));
    return {
      personal: (personalResult.data ?? []) as NotificationRow[],
      system: ((systemResult.data ?? []) as Omit<NotificationRow, "is_read">[]).map((row) => ({
        ...row,
        is_read: readIds.has(row.id),
      })),
    };
  }

  async markAsRead(kind: NotificationKind, notificationId: string, userId: string): Promise<void> {
    if (kind === "personal") {
      const { error } = await supabase
        .from("personal_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await supabase.rpc("mark_system_notification_read", { notif_id: notificationId });
    if (error) throw new Error(error.message);
  }

  subscribeToNotifications(userId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`notifications-modal:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_notifications", filter: `user_id=eq.${userId}` },
        onChange,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "system_notifications" }, onChange)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_notification_reads", filter: `user_id=eq.${userId}` },
        onChange,
      )
      .subscribe();
  }

  subscribeToNewNotifications(userId: string, onNewNotification: () => void): RealtimeChannel {
    return supabase
      .channel(`notifications-badge:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "personal_notifications", filter: `user_id=eq.${userId}` },
        onNewNotification,
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_notifications" }, onNewNotification)
      .subscribe();
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }
}

export const supabaseNotificationRepository = new SupabaseNotificationRepository();
