# Quản lý thời tiết

`WeatherManagement.vue` hiển thị danh sách và phân trang. `WeatherManagementForm.vue` giữ bản nháp cục bộ, kiểm tra dữ liệu và gọi action thêm/sửa của `useAdminWeatherStore`. Form dùng lại `WeatherRow`/`WeatherPayload`; không sửa trực tiếp dòng đang hiển thị. `AdminCrudScreen` hỗ trợ slot `form` với `item`, `close`, `setSaving`; các màn hình khác tiếp tục dùng form mặc định. Trạng thái lưu khóa thao tác đóng modal.

Store tiếp tục dùng `supabaseWeatherRepository` và tải lại trang sau khi lưu. UPDATE dùng `maybeSingle()` và báo lỗi rõ ràng nếu không trả về dòng nào, không coi trường hợp này là lưu thành công. Các repository cùng factory cũng nhận cách xử lý này. Thời lượng phải là số nguyên không âm, tối thiểu không vượt tối đa; hệ số khắc nghiệt giữ giới hạn nhập từ 0,000001 đến 1.000.000.

## Nguyên nhân lỗi cập nhật

Kiểm tra chỉ đọc ngày 28/11/2026 trên project `qxgiisntmkiehpptjsud`, khớp `VITE_SUPABASE_URL`:

- `public.weathers` bật RLS; có 35 dòng và khóa chính UUID `id`.
- Chỉ có policy SELECT cho `authenticated`, điều kiện `true`; không có policy UPDATE hoặc ALL.
- Role `authenticated` có grant UPDATE nhưng thiếu policy cho phép cập nhật. UPDATE bị lọc về 0 dòng, nên `.single()` trước đây báo `Cannot coerce the result to a single JSON object`.
- INSERT cũng chưa có policy và grant cho `authenticated`, nên thêm mới cần bổ sung quyền riêng. Không thể giải quyết quyền ghi bằng cách thay `.single()`.
- Không có trigger tùy chỉnh trên bảng. `get_admin_list_page` chỉ phục vụ đọc, không có RPC admin ghi thời tiết trong các routine đã kiểm tra.

Chưa thay đổi database từ xa. Để cho phép cập nhật, cần policy UPDATE giới hạn admin với cả USING và WITH CHECK. Có thể dùng helper hiện có `public.player_features_is_admin()` (đọc `user_profile.is_admin`, đã xác minh role `authenticated` có quyền gọi). Không mở quyền ghi cho toàn bộ người đăng nhập. Mọi thay đổi grant/policy từ xa cần người dùng phê duyệt trước theo AGENTS.md.

## Kiểm tra

`node --test scripts/test-admin-weather.mjs` kiểm tra mapping/id, thành công, kết quả rỗng và lỗi database. `npm.cmd run test:admin`, `npm.cmd run test:admin:browser` kiểm tra hồi quy CRUD; `npm.cmd run build` kiểm tra TypeScript và bundle. Test dùng mock, không ghi database thật.
