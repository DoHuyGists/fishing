import type { RedeemCodeRow, RedeemCodePayload } from "../types/table/redeemCode";
import supabase from "../database/connection";
import { fetchAdminListPage } from './supabaseAdminListRepository';

class SupabaseRedeemCodeRepository {
  async fetchPage(page: number, search: string, status: string) {
    const filters = status === 'ACTIVE' ? { is_disabled: false, _expired: false }
      : status === 'DISABLED' ? { is_disabled: true } : status === 'EXPIRED' ? { _expired: true } : {};
    const result = await fetchAdminListPage<any>('redeem_code', page, search, filters);
    return { ...result, items: result.items.map((row): RedeemCodeRow => ({
      id: row.id, code: row.code, cash: Number(row.cash), createdAt: row.created_at, isDisabled: row.is_disabled, expiresAt: row.expires_at,
    })) };
  }
  async fetchAll(): Promise<RedeemCodeRow[]> {
    const { data, error } = await supabase
      .from("redeem_code")
      .select("id, code, cash, created_at, is_disabled, expires_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return data.map((row) => ({
      id: row.id,
      code: row.code,
      cash: Number(row.cash),
      createdAt: row.created_at,
      isDisabled: row.is_disabled,
      expiresAt: row.expires_at,
    }));
  }

  async create(payload: RedeemCodePayload): Promise<void> {
    const { error } = await supabase.from("redeem_code").insert(payload);
    if (error) throw new Error(error.message);
  }

  async update(id: string, payload: RedeemCodePayload): Promise<void> {
    const { error } = await supabase.from("redeem_code").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("redeem_code").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export const supabaseRedeemCodeRepository = new SupabaseRedeemCodeRepository();
