# Quy đổi tiền tệ

Chạy `currency-conversion.sql` trong Supabase SQL Editor trước khi sử dụng giao diện.
Script dùng bảng ví hiện có `public.currency` với các cột `id`, `user_id`, `cash`, `shells`, `tickets`.

Chưa có tỷ giá mặc định. Cấu hình bằng SQL Editor hoặc backend `service_role`.
Thay các placeholder dưới đây bằng số nguyên dương trước khi chạy:

```sql
INSERT INTO public.currency_conversion_rates
  (source_currency, target_currency, source_amount, target_amount)
VALUES
  ('cash', 'shells', <cash_moi_goi_shells>, <shells_nhan_moi_goi>),
  ('cash', 'tickets', <cash_moi_goi_tickets>, <tickets_nhan_tu_cash>),
  ('shells', 'tickets', <shells_moi_goi_tickets>, <tickets_nhan_tu_shells>)
ON CONFLICT (source_currency, target_currency) DO UPDATE SET
  source_amount = EXCLUDED.source_amount,
  target_amount = EXCLUDED.target_amount,
  is_active = true;
```

Mỗi gói trừ `source_amount` và cộng `target_amount`. Số gói phải là số nguyên dương.
Đặt `is_active = false` để ngừng một chiều quy đổi. Chỉ hỗ trợ cash → shells, cash → tickets, shells → tickets.

RPC `get_currency_conversion_rates()` trả các mệnh giá đang hoạt động. Bảng giao diện và RPC quy đổi dùng chung dữ liệu này.
RPC `convert_currency(p_source_currency, p_target_currency, p_batches, p_source_amount, p_target_amount)`
nhận hai mệnh giá mà người chơi đã xem, kiểm tra chúng với cấu hình hiện tại rồi quy đổi.
Nếu tỷ giá thay đổi, người chơi phải xem lại bảng trước khi gửi yêu cầu mới.
Kết quả là số dư mới `{ cash, shells, tickets }`.

RPC lấy người chơi từ `auth.uid()`, khóa dòng tỷ giá và dòng ví, kiểm tra số dư rồi trừ/cộng trong cùng giao dịch.
Client không truyền user ID hoặc tự quyết định tỷ giá. Bảng tỷ giá không cho `anon`/`authenticated` ghi trực tiếp.
Các chính sách/quyền trên bảng ví hiện có phải tiếp tục ngăn người chơi tự sửa số dư.

Kiểm tra trên database thử nghiệm: ba chiều hợp lệ; số gói 0/âm/null; thiếu tiền;
chiều ngược; tỷ giá bị sửa/tắt; chưa đăng nhập; hai yêu cầu đồng thời chỉ đủ tiền cho một lần.
Với các trường hợp bị từ chối, cả ba số dư phải giữ nguyên.
