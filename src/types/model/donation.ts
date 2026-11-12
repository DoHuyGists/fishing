export type DonationStatus = 'CREATED' | 'APPROVED' | 'PENDING' | 'COMPLETED' | 'DECLINED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'REVERSED';

export interface DonationResult { donationId: string; orderId: string; status: DonationStatus }
