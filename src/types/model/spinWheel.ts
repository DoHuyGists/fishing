export interface SpinWheelReward {
  id: string | number
  label: string
  value: string | number
  image?: string
  information?: string
  /** Màu nền của lát cắt tương ứng, nếu không truyền sẽ dùng bảng màu mặc định */
  color?: string
}

export interface SpinWheelProps {
  rewards: SpinWheelReward[]
  spinConfirmation?: {
    currentBalance: number
    totalCost: number
  }
  /** Endpoint trả về JSON dạng { index: number }. Bỏ qua nếu dùng fetchRewardIndex */
  apiUrl?: string
  /** Hàm tự định nghĩa để lấy index ngẫu nhiên, ưu tiên hơn apiUrl nếu có */
  fetchRewardIndex?: () => Promise<number>
  /** Thời gian quay (ms) */
  spinDuration?: number
  /** Kích thước bánh xe (px) */
  size?: number
  /** Số vòng quay thêm cho hiệu ứng trước khi dừng */
  extraSpins?: number
  /** Chặn quay khi chưa đủ điều kiện (vd: chưa đủ số phần thưởng tối thiểu) */
  disabled?: boolean
}

export interface SpinWheelItem {
  id: string;
  name: string;
  category: string;
  image: string | null;
  information: string | null;
}

export interface SpinWheelSeasonRewards {
  season: { id: string; name: string; starts_at: string; ends_at: string } | null;
  rewards: SpinWheelItem[];
}

export interface SpinWheelResult extends SpinWheelSeasonRewards {
  item_id: string;
  inventory_id: string;
  cost: number;
  remaining_tickets: number;
}
