import type { DonationResult } from "../types/model/donation";
import supabase from '../database/connection';

class SupabaseDonationRepository {
  async request(action: 'create' | 'capture' | 'status', donationId: string, amountCents?: number): Promise<DonationResult> {
    const { data, error } = await supabase.functions.invoke('paypal-donation', {
      body: { action, donationId, ...(amountCents === undefined ? {} : { amountCents }) },
    });
    if (error) {
      let code = 'PAYMENT_UNAVAILABLE';
      try { code = (await error.context?.json())?.code ?? code; } catch { /* Network failures have no JSON response. */ }
      throw new Error(code);
    }
    if (!data?.orderId || !data?.status) throw new Error('PAYMENT_UNAVAILABLE');
    return data;
  }
}

export const supabaseDonationRepository = new SupabaseDonationRepository();
