export interface MonitorPlayerChange {
  id: string;
  areaId: string | null;
}

export type MonitorRealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

export interface MonitorSubscriptionHandlers {
  onPlayerChange: (change: MonitorPlayerChange) => void;
  onCurrencyRefresh: () => void;
  onRefresh: () => void;
  onStatus: (status: MonitorRealtimeStatus) => void;
}
