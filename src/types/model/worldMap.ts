import type { useModalStore } from "../../stores/modal";

export type LobbyAction = {
  modal: NonNullable<Parameters<ReturnType<typeof useModalStore>["open"]>[0]>;
  label: string;
  icon: string;
  tourId?: string;
  requiresUnlock?: boolean;
};

export interface PickPoint {
  screen: { x: number; y: number }; // px trên canvas
  map: { x: number; y: number }; // toạ độ trong hệ chưa zoom
  lon: number | null;
  lat: number | null;
  k: number;
}

export interface ViewTarget {
  lon?: number; // bỏ trống = giữ tâm hiện tại
  lat?: number;
  k?: number; // bỏ trống = giữ mức zoom hiện tại
  duration?: number; // ms, 0 = nhảy ngay, >0 = bay mượt
}

export interface ZoomState {
  x: number; // dịch chuyển ngang (px)
  y: number; // dịch chuyển dọc (px)
  k: number; // mức zoom (1 = ban đầu)
  center: [number, number] | null; // [kinh độ, vĩ độ] tại tâm khung nhìn
  fromUser: boolean;
}

export interface AreaPoint {
  id: string;
  title?: string | null;
  location?: { lon?: number; lat?: number } | null;
  [key: string]: any;
}
