export type BookVariant = 'default' | 'ocean' | 'gold' | 'dark' | 'emerald'

export interface BookProps {
  /** Tiêu đề hiển thị trên gáy sách và bìa */
  title?: string
  /** Tên tác giả / chủ sở hữu */
  author?: string
  /** Số / Ký hiệu góc trên (Xoay 90 độ) */
  numUp?: string | number
  /** Số / Ký hiệu góc dưới (Xoay 90 độ) */
  numDown?: string | number
  /** Theme màu sắc có sẵn: 'default' | 'ocean' | 'gold' | 'dark' | 'emerald' */
  variant?: BookVariant
  /** Override màu nền/gradient bìa sách tùy chỉnh */
  coverBg?: string
  /** Override màu gáy sách tùy chỉnh */
  spineBg?: string
  /** Override màu chữ tùy chỉnh */
  textColor?: string
  /** Tỷ lệ thu phóng kích thước (Default: 1) */
  scale?: number
}

export interface Species {
  id: string;
  created_at: string;
  information: string | null;
  location: string | null;
  status: string | null;
  name: string;
  image: string | null;
}

export interface CaughtDiary {
  id: string;
  created_at: string;
  user_id: string;
  species_id: string;
}
