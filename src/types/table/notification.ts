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
