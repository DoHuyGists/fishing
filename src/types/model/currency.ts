export type CurrencyKind = "cash" | "shells" | "tickets";

export interface PaymentCostLine {
  label: string;
  amount: number;
}

export interface CurrencyConversionRate {
  source_currency: CurrencyKind;
  target_currency: CurrencyKind;
  source_amount: number;
  target_amount: number;
}
