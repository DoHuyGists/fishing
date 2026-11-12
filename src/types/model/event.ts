export interface EventThumbnailProps {
  /** Đường dẫn ảnh. Bỏ trống hoặc ảnh lỗi => hiện placeholder */
  src?: string | null;
  alt?: string;
  /** Chiều rộng khung (px) */
  width?: number;
  /** Chiều cao khung (px) */
  height?: number;
  /** Góc nghiêng (độ): âm = nghiêng trái, dương = nghiêng phải */
  rotate?: number;
  /** Bo góc (px) */
  radius?: number;
  /** Độ dày viền trắng (px) */
  border?: number;
}
