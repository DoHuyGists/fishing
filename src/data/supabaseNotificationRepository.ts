import type { NotificationRow, AdminNotificationRow, AdminNotificationPayload } from "../types/table/notification";
import type { NotificationKind } from "../types/model/notification";
import supabase from "../database/connection";
import { COMPACT_PAGE_SIZE, pageRange, listPage } from './pagination';
import type { ListPage } from '../types/model/pagination';

const adminTable = (kind: NotificationKind) => (kind === "system" ? "system_notifications" : "personal_notifications");

class SupabaseNotificationRepository {
  async fetchAdminNotifications(kind: NotificationKind, page = 1, search = ''): Promise<ListPage<AdminNotificationRow>> {
    const columns =
      kind === "system"
        ? "id,title,body,type,data,created_at,expires_at"
        : "id,user_id,title,body,type,data,is_read,created_at";
    let query = supabase
      .from(adminTable(kind))
      .select(columns, { count: 'exact' });
    if (search.trim()) {
      const pattern = `"%${search.trim().replace(/[\\%_"']/g, '\\$&')}%"`;
      query = query.or(`title.ilike.${pattern},body.ilike.${pattern},type.ilike.${pattern}${kind === 'personal' && /^[0-9a-f-]{36}$/i.test(search.trim()) ? `,user_id.eq.${search.trim()}` : ''}`);
    }
    const { data, error, count } = await query.order("created_at", { ascending: false }).order('id').range(...pageRange(page, COMPACT_PAGE_SIZE));
    if (error) throw new Error(error.message);
    return listPage((data ?? []) as unknown as AdminNotificationRow[], count);
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

  async fetchNotifications(userId: string, personalPage = 1, systemPage = 1) {
    const now = new Date().toISOString();
    const [personalResult, systemResult, personalUnread, systemReads, nextExpiry] = await Promise.all([
      supabase
        .from("personal_notifications")
        .select("id,title,body,type,data,is_read,created_at", { count: 'exact' })
        .eq("user_id", userId)
        .order("created_at", { ascending: false }).order('id').range(...pageRange(personalPage, COMPACT_PAGE_SIZE)),
      supabase
        .from("system_notifications")
        .select("id,title,body,type,data,created_at,expires_at", { count: 'exact' })
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false }).order('id').range(...pageRange(systemPage, COMPACT_PAGE_SIZE)),
      supabase.from('personal_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
      supabase.from('system_notification_reads').select('notification_id,system_notifications!inner(id)', { count: 'exact', head: true })
        .eq('user_id', userId).or(`expires_at.is.null,expires_at.gt.${now}`, { referencedTable: 'system_notifications' }),
      supabase.from('system_notifications').select('expires_at').gt('expires_at', now)
        .order('expires_at').limit(1).maybeSingle(),
    ]);

    if (personalResult.error) throw new Error(personalResult.error.message);
    if (systemResult.error) throw new Error(systemResult.error.message);
    if (personalUnread.error) throw new Error(personalUnread.error.message);
    if (systemReads.error) throw new Error(systemReads.error.message);
    if (nextExpiry.error) throw new Error(nextExpiry.error.message);

    const systemIds = (systemResult.data ?? []).map(row => row.id);
    const readsResult = systemIds.length
      ? await supabase.from('system_notification_reads').select('notification_id').eq('user_id', userId).in('notification_id', systemIds)
      : { data: [], error: null };
    if (readsResult.error) throw new Error(readsResult.error.message);

    const readIds = new Set((readsResult.data ?? []).map((row) => row.notification_id as string));
    return {
      personalTotal: personalResult.count ?? 0,
      systemTotal: systemResult.count ?? 0,
      personalUnread: personalUnread.count ?? 0,
      systemUnread: Math.max(0, (systemResult.count ?? 0) - (systemReads.count ?? 0)),
      nextSystemExpiry: nextExpiry.data?.expires_at as string | null | undefined,
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

}

export const supabaseNotificationRepository = new SupabaseNotificationRepository();
