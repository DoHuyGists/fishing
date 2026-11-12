# Quản lý tính khả dụng của tính năng

## Triển khai

1. Chạy `migrations/20261112_feature_flags.sql` trong Supabase SQL Editor trước khi phát hành client. Migration tạo 27 flag mặc định bật, RLS, Realtime, quy tắc request và hook PostgREST. Chạy lại không đặt lại trạng thái hoặc thông báo đã chỉnh.
2. Deploy lại Edge Function `paypal-donation` sau migration. Function kiểm tra flag trước mọi thao tác thanh toán; webhook đối soát vẫn hoạt động để không bỏ sót giao dịch đã thanh toán.
3. Phát hành client, vào `/admin` → **Tính khả dụng của tính năng** → **Sửa**. Chọn trạng thái và nhập thông báo VI/EN. Để trống thông báo sẽ dùng bản dịch mặc định. Không cho thêm/xóa mã tính năng qua giao diện.
4. Kiểm tra bằng hai phiên: một admin, một người chơi thường. Tắt `market`, xác nhận người chơi thấy bảo trì và không gửi request mua/bán. Thử gọi trực tiếp `buy_species_with_history` với token người chơi: Data API phải trả HTTP 403. Bật lại và xác nhận dùng được.

Nếu chưa có bảng hoặc thiếu flag, client hiển thị lỗi và nút thử lại trước khi mở màn chơi. Không dùng cache trên máy để bỏ qua kiểm tra lần đầu.

Migration dừng và rollback nếu phát hiện `pgrst.db_pre_request` khác đang được cấu hình trong DB. Trong trường hợp này, tích hợp `PERFORM public.check_feature_request();` vào hook hiện hữu, chạy phần migration không thay hook, rồi reload cấu hình PostgREST. Không thay thế hook bảo mật hiện hữu. Cũng kiểm tra cấu hình môi trường PostgREST nếu dự án self-hosted có đặt `PGRST_DB_PRE_REQUEST`.

## Hoạt động

- `src/data/featureCatalog.json` khai báo khóa, bản dịch nhãn và endpoint thuộc mỗi tính năng. Danh sách tương ứng được nhúng trong migration; `node scripts/validate-feature-flags.mjs` kiểm tra hai bản trùng nhau.
- Repository sở hữu truy vấn và subscription Supabase. Pinia store tải snapshot, nhận Realtime, tải lại khi reconnect/focus/online và mỗi 30 giây. Snapshot đến muộn từ phiên đăng nhập cũ bị bỏ qua. Sự kiện đến trong lúc tải sẽ yêu cầu tải lại sau đó.
- `featureRequestGate.ts` kiểm tra request của Supabase trước khi gửi. Request bị khóa nhận lỗi dạng PostgREST ngay trên client. Snapshot quá 30 giây được tải lại trước request. Nếu mất mạng sau khi đã tải, giữ trạng thái gần nhất; server vẫn kiểm tra từng request.
- Hook `check_feature_request()` kiểm tra RPC, các bảng riêng và các thao tác ghi trong catalog. Request trực tiếp từ client cũ cũng bị từ chối khi flag tắt. Lỗi trả thông báo theo `Accept-Language` và `details: FEATURE_DISABLED:<key>`. Client đồng bộ lại ngay khi nhận lỗi này.
- Storage có thêm policy ghi restrictive cho ảnh đại diện và tệp phản hồi. Edge Function PayPal tự kiểm tra flag vì không đi qua hook với token người chơi.
- Người chơi thường chỉ được đọc flag. Admin được cập nhật `enabled`, `message_vi`, `message_en`; DB tự ghi `updated_at`, `updated_by`. Lưu từ bản dữ liệu cũ bị từ chối để tránh ghi đè thay đổi của admin khác.
- Admin được miễn khóa ở lớp server để quản trị dữ liệu khi bảo trì; client chỉ miễn khóa request khi đang ở trang admin. Service role và SQL nội bộ không thuộc khóa dành cho người chơi.

## Phạm vi khóa

- `world-map`: ẩn bản đồ tương tác và danh sách bãi, chặn dữ liệu màu bản đồ và request vào bãi/trừ lượt.
- `enter-area`: giữ bản đồ để xem nhưng khóa mở màn chuẩn bị và request vào bãi/trừ lượt.
- `prepare` là modal nội bộ, dùng cả hai flag trên.
- Flag khác tương ứng với nút trong `FeatureTable.vue`. Modal đang mở sẽ đóng khi nhận trạng thái tắt; modal lưu trong localStorage và đường dẫn màn thực hành trực tiếp cũng được kiểm tra.
- Dữ liệu đọc dùng chung như hồ sơ, ví, danh mục vật phẩm, trang bị, cá và quốc gia vẫn có thể được dùng bởi các tính năng còn bật. Khóa màn tính năng không phải cơ chế thu hồi quyền đọc toàn bộ dữ liệu liên quan. `tables`, `writeTables`, `rpcs`, `functions`, `storageBuckets` trong catalog mô tả chính xác endpoint bị chặn.
- `user_leave_area`, `user_complete_fishing` và luồng câu đang diễn ra không phụ thuộc flag bản đồ/vào bãi, để người chơi có thể hoàn tất/rời bãi. `post-production` khóa thao tác chuyển cá và thả cá trong lưới.
- Request đã bắt đầu trước khi DB đổi flag có thể hoàn tất. Việc trừ lượt và vào bãi vẫn là hai RPC theo luồng hiện có, không trở thành một transaction mới trong thay đổi này.
- Hook áp dụng cho Data API, không thay cơ chế cấp quyền của GraphQL, Realtime hay các RPC mới chưa có trong catalog. Khi thêm endpoint thay đổi dữ liệu, cần bổ sung quy tắc tương ứng trước khi phát hành.

## Kiểm tra

```sh
node scripts/validate-feature-flags.mjs
node scripts/validate-paypal.mjs
npm run check:i18n
npm run build
```

Sau khi áp dụng migration trên DB phát triển, chạy `tests/feature_flags.sql` để kiểm tra chặn endpoint, giữ đường rời bãi và quyền RLS; script rollback toàn bộ thay đổi. Kiểm tra thêm quyền admin, Storage và hai trình duyệt thực tế khi triển khai. Các kiểm tra Node dùng mock, không áp dụng migration lên DB thật.

Tham khảo: [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
