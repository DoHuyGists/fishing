import supabase from "../database/connection";

export interface RedeemCodeRow {
  id: string;
  code: string;
  cash: number;
  createdAt: string;
  isDisabled: boolean;
  expiresAt: string | null;
}

export interface RedeemCodePayload {
  code: string;
  cash: number;
  is_disabled: boolean;
  expires_at: string | null;
}

class SupabaseRedeemCodeRepository {
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
