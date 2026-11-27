# Mở khóa quốc gia trên bản đồ bãi câu

`FishingMapCountries.vue` trong `FishingMapModal.vue` hiển thị nút mở khóa cho quốc gia chưa mở khóa có ít nhất một dòng `fishing_areas`, kể cả bãi đang đóng. Repository dùng inner join, phân trang theo quốc gia và chỉ lấy một bãi mẫu cho mỗi quốc gia để kiểm tra điều kiện.

Giá cố định là **300 vỏ sò**. Hộp `PaymentConfirmation` tải lại ví, hiển thị chi phí/số dư và chặn xác nhận khi thiếu tiền hoặc đang xử lý. Action trong `player-fishing-map-store.ts` gọi repository, tải lại quốc gia đã mở khóa và ví sau thành công, rồi chọn quốc gia vừa mua. Kết quả từ phiên đăng nhập cũ bị bỏ qua.

RPC thanh toán: `scripts/supabase/rpc/countries/purchase_country_unlock.sql`. RPC dùng `auth.uid()`, khóa dòng ví, kiểm tra bãi câu và số dư, ghi `player_unlocked_countries` và trừ tiền trong cùng transaction. Gửi lại yêu cầu đã thành công không trừ thêm tiền. RPC dùng quyền của người gọi, không thay đổi RLS hiện có. RPC `unlock_country` hiện có được giữ nguyên cho các luồng cấp mở khóa miễn phí.

SQL phải được duyệt và áp dụng trên project trùng `VITE_SUPABASE_URL` trước khi sử dụng tính năng thanh toán. Chưa áp dụng SQL thì xác nhận mua sẽ báo lỗi và không trừ tiền. Các policy hiện tại cho phép authenticated ghi trực tiếp vào bảng ví và quốc gia đã mở khóa; RPC này không siết lại các quyền đó.

Kiểm tra: `node --test --test-isolation=none scripts/test-country-unlock.mjs scripts/test-fishing-map.mjs`, `npm.cmd run build`, `npm.cmd run check:i18n`. Các test dùng PostgreSQL cục bộ hoặc mock, không thay đổi dữ liệu từ xa.
