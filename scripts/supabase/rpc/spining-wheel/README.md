# Vòng quay theo mùa

Chạy bằng Supabase SQL Editor theo thứ tự:

1. `../../migrations/spin_wheel_seasons.sql`
2. `spin-wheel.sql` (xóa RPC cũ `spin_wheel(uuid[])`, tạo `spin_wheel()` không có tham số).
3. Tạo mùa và thêm vật phẩm, sau đó triển khai frontend.

Cột chi phí là `public.currency.tickets` (số nhiều), mỗi lượt trừ 1 vé. RPC khóa dòng tiền tệ trước khi kiểm tra và trừ vé; việc cấp vật phẩm thất bại sẽ hoàn lại toàn bộ giao dịch. Cash không thay đổi.

Quản lý bằng SQL Editor hoặc backend dùng `service_role`. Tạo mùa ở trạng thái nháp, thêm thưởng rồi kích hoạt. Ví dụ sau cần thay các giá trị mẫu trước khi chạy:

```sql
BEGIN;
INSERT INTO public.spin_wheel_seasons (id, name, starts_at, ends_at)
VALUES ('<season_uuid>', 'Mùa mới', '2026-12-01 00:00:00+07', '2027-01-01 00:00:00+07');

INSERT INTO public.spin_wheel_rewards (season_id, item_id, sort_order)
VALUES
  ('<season_uuid>', '<item_uuid_1>', 10),
  ('<season_uuid>', '<item_uuid_2>', 20);

UPDATE public.spin_wheel_seasons SET is_active = true WHERE id = '<season_uuid>';
COMMIT;
```

Mùa hoạt động khi `is_active = true` và `starts_at <= now() < ends_at`. Lịch các mùa được kích hoạt không được chồng nhau. Không tự thêm vật phẩm vào mùa mới. Vật phẩm bị vô hiệu hóa không nằm trong vòng quay; mỗi vật phẩm hợp lệ có cùng xác suất trúng. Danh sách trong giao diện và kết quả quay cùng lấy từ `get_spin_wheel_rewards()`; RPC quay trả cả danh sách thưởng của lượt đó để xử lý trường hợp chuyển mùa khi modal đang mở.
