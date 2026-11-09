# Hoàn thiện các tính năng người chơi

1. Sao lưu schema và chạy `migrations/player_feature_completion.sql` trong SQL Editor trước khi triển khai frontend. Migration chạy trong một transaction và có thể chạy lại.
2. Trong Supabase Authentication → URL Configuration, thêm URL chính xác của trang `<origin><BASE_URL>reset-password` vào Redirect URLs, cho cả localhost và môi trường triển khai. Kiểm tra Site URL và cấu hình SMTP để gửi email xác nhận/khôi phục.
3. Triển khai frontend và kiểm tra bằng hai tài khoản người chơi cùng một tài khoản admin.

## Các thay đổi database

- `user_profile`: thêm `display_name`, `avatar_url`, `avatar_path`, `onboarding_completed`.
- RPC `update_my_country`: kiểm tra chủ tài khoản, quốc gia tồn tại và cooldown bằng giờ server; khóa hồ sơ trước khi đổi; đặt thời gian chờ 365 ngày. Giữ nguyên các trigger hiện có (bao gồm trigger cấp chìa khóa nếu database đang dùng).
- RPC `update_my_identity`, `complete_my_onboarding`: cập nhật các trường được cho phép của chính người gọi.
- Bucket riêng `player-profile-avatars` là **private**. Chỉ chủ tài khoản được tải lên/xóa; người đã đăng nhập được xem ảnh đại diện qua signed URL. Không thay đổi bucket hiện có. File JPG/PNG/WebP, tối đa 2 MB; signed URL có hiệu lực 24 giờ và được tạo lại khi tải hồ sơ.
- `market_history`: dùng đúng các cột `id, created_at, seller_id, buyer_id, item, price` đã cung cấp. RLS cho phép người mua/người bán xem giao dịch của mình, admin xem tất cả.
- RPC `buy_species_with_history` bọc RPC `buy_species_from_market(uuid)` đang có. Khóa tin bán, gọi nghiệp vụ mua hiện có, kiểm tra chuyển chủ cá rồi ghi snapshot và giá bán trong cùng transaction. Nếu RPC cũ đã ghi lịch sử trong transaction này thì không ghi thêm. Lịch sử cũ giữ nguyên; không suy dựng giao dịch trước đây chưa được ghi.
- Thêm quyền quản trị bảng `blueprint`, quyền đọc báo lỗi của chính người gửi và đăng ký Realtime cho chợ, lịch sử, báo lỗi, thông báo.

## Kiểm tra triển khai

- Xác nhận chữ ký RPC `buy_species_from_market(p_market_id uuid)` và các bảng `species_market`, `caught`, `species`, `blueprint`, `error_feedback`, các bảng thông báo tồn tại như repository hiện tại. Migration không thay thế nghiệp vụ trừ tiền/phí/chuyển cá của RPC mua đang chạy.
- Kiểm tra trigger đổi quốc gia đang có: đổi lần đầu, từ chối trước hạn, đổi sau hạn, cấp chìa khóa đúng một lần và không thể đổi đồng thời hai lần. Migration không tạo thêm trigger cấp thưởng để tránh phát trùng chìa khóa.
- Đảm bảo RPC `craft_blueprint` hiện có vẫn kiểm tra tiền, nguyên liệu, sức chứa và số lượng ở server. Kiểm tra ở giao diện/store không thay thế kiểm tra trong transaction database.
- Gửi email quên mật khẩu, mở liên kết khi đang ở bãi câu, thử liên kết hết hạn và đổi mật khẩu với mật khẩu hiện tại sai/đúng.
- Dùng hai trình duyệt mua cùng một tin: chỉ một người thành công, chỉ một bản ghi lịch sử, tiền và cá nhất quán; người thứ hai thấy tin biến mất qua Realtime.
- Gửi báo lỗi bằng tài khoản A, cập nhật trạng thái bằng admin: A thấy cập nhật, B không đọc được báo lỗi của A.
- Tạo thông báo cá nhân/hệ thống, tải lại trang; mở cửa sổ chưa làm mất dấu chưa đọc, chọn thông báo mới đánh dấu đã đọc đúng loại.
- Admin thêm/sửa/xóa công thức, thử ID nguyên liệu sai/trùng, số lượng lẻ/âm, thiếu tiền và thiếu nguyên liệu.
- Tải ảnh đại diện, đổi tên, mở Bạn bè/Xếp hạng; hoàn thành hướng dẫn và đăng nhập lại để kiểm tra trạng thái được lưu.

## Kiểm tra cục bộ

```text
npm.cmd run build
node --test scripts/validate-player-features.mjs
npm.cmd install --no-save --package-lock=false @electric-sql/pglite
node --test scripts/validate-player-feature-sql.mjs
```

Kiểm tra store dùng repository giả lập. Kiểm tra SQL chạy migration thật trong PostgreSQL nhúng với schema thử nghiệm, kiểm tra cooldown, RLS, ghi lịch sử trong transaction, không ghi trùng và bucket ảnh private. Cần chạy checklist trên Supabase thử nghiệm để đối chiếu với schema/RPC/trigger đang triển khai và kiểm chứng Storage, email, Realtime thực tế.

Tài liệu luồng mật khẩu: https://supabase.com/docs/guides/auth/passwords
