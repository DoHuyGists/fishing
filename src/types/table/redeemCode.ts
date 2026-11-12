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
