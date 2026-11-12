export interface MonitorAreaRow {
  id: string;
  title: string | null;
  country_id: string;
  is_available: boolean;
}

export interface MonitorPlayerRow {
  id: string;
  area_id: string;
}

export interface MonitorCurrencyRow {
  id: string;
  user_id: string;
  cash: string;
  shells: string;
}

export interface MonitorPresenceRow {
  id: string;
  area_id: string | null;
  status: string | null;
}
