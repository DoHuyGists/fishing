# Các vấn đề cần cải thiện

Ngày ghi nhận: 18/11/2026.

Trạng thái: Vấn đề 1 đã sửa trong mã nguồn, chờ triển khai SQL lên Supabase và kiểm chứng thực tế. Vấn đề 2–4 chưa xử lý.

Kết quả kiểm tra trước bản sửa: build thành công, 106/106 kiểm thử đạt, kiểm tra i18n đạt. Bản sửa vấn đề 1 bổ sung bộ kiểm thử phục hồi kết quả câu.

## 1. Mất khả năng xác nhận lại kết quả câu khi lỗi mạng

- Mức độ: Cao.
- Trạng thái: Đã triển khai bản sửa trong mã nguồn ngày 18/11/2026; chưa áp dụng lên Supabase thực tế.
- Vị trí: `src/stores/fishing.ts`, action `finishChallenge`; `scripts/supabase/rpc/fishing/submit_tension_challenge.sql`.
- Lỗi trước khi sửa: Khi gửi kết quả bị lỗi hoặc timeout, client xóa `sessionId` và dữ liệu thao tác dù server có thể đã ghi nhận thành công. RPC từ chối phiên đã xử lý nên không lấy lại được kết quả.
- Bằng chứng ban đầu: Đã tái hiện lỗi mất phản hồi trong store; sau lỗi, `sessionId` là `null`, dữ liệu thao tác rỗng và trạng thái chuyển sang `lost`.

Các bước đã thực hiện:

1. Thêm trạng thái `unconfirmed` và hợp đồng lỗi `FISHING_RESULT_REJECTED`. Chỉ phản hồi kết quả hợp lệ hoặc lỗi từ chối rõ ràng của RPC mới kết thúc phục hồi; lỗi mạng, timeout và lỗi quyền trước khi vào RPC vẫn giữ dữ liệu.
2. Thêm bảng riêng `fishing_result_receipts`. Hai RPC kích hoạt/gửi kết quả kiểm tra chủ sở hữu, khóa phiên, rồi trả lại kết quả đã lưu. Lưu kết quả trong cùng giao dịch xử lý để không trừ mồi hoặc trao thưởng lần nữa, kể cả khi thử lại sau thời điểm hết hạn.
3. Giữ nguyên mã phiên và bản sao payload trong Pinia, đồng thời lưu `sessionStorage` theo tài khoản để phục hồi sau reload tại cùng bãi câu. Nếu storage không dùng được, vẫn thử lại trong bộ nhớ của tab hiện tại.
4. Thêm nút “Thử xác nhận lại” với bản dịch Việt/Anh; khóa lượt mới và rời bãi khi chưa xác nhận xong. Dùng kết quả trả từ server để cập nhật giỏ và loại trùng theo ID, kể cả khi giỏ đã được tải lại trước đó.
5. Bỏ qua phản hồi sau khi đổi tài khoản, thế hệ đăng nhập hoặc reset phiên câu. Phục hồi cả kết quả thất bại đã được xử lý ở bước kích hoạt; khi kích hoạt chưa hoàn tất, lần thử lại giữ nguyên thời điểm bắt đầu từ server.

Kiểm chứng và triển khai:

- `npm run test:fishing-result`: 7/7 kiểm thử đạt. Kiểm thử store và SQL bằng PostgreSQL nhúng (PGlite), bao phủ mất phản hồi/timeout, reload, storage không khả dụng, đổi tài khoản, lỗi từ chối, kết quả sai định dạng, thử lại đồng thời, hết hạn, quyền truy cập và không xử lý phần thưởng lần hai.
- Chạy các kiểm thử hồi quy liên quan đến phiên câu, giỏ cá, điểm mùa giải, refresh và cache; kiểm tra i18n và build.
- Trước khi triển khai client, chạy **toàn bộ** `scripts/supabase/rpc/fishing/submit_tension_challenge.sql` bằng quyền quản trị trong Supabase SQL Editor. File tạo bảng receipt và cập nhật cả hai RPC trong một giao dịch; cần có `submit_challenge.sql` và các phụ thuộc hiện tại trước đó.
- Kiểm chứng trên môi trường triển khai: làm mất phản hồi sau commit rồi thử xác nhận lại; kiểm tra số cá, mồi, XP và điểm chỉ thay đổi một lần. Chưa thực hiện bước này trên Supabase thực tế.
- Phạm vi: receipt chỉ tồn tại cho kết quả được xử lý qua RPC sau khi triển khai bản sửa; không tái tạo được kết quả cũ đã mất trước đó.

## 2. Tab mới ghi đè phiên tab cũ trước khi xử lý cảnh báo trùng tab

- Mức độ: Cao.
- Vị trí: `src/composables/use-single-session.ts`, `initTabCheck`, `registerAndListenRealtime` và luồng khởi tạo; nơi gọi tại `src/layouts/PlayerLayout.vue`.
- Hiện trạng: Kiểm tra bằng BroadcastChannel và ghi `active_session_id` chạy đồng thời. Tab mới vẫn có thể ghi đè phiên đang hoạt động dù đã nhận cảnh báo trùng tab. Chọn “Đóng tab này” không khôi phục phiên cũ.
- Bằng chứng: Xác nhận từ luồng mã nguồn; chưa tái hiện bằng hai trình duyệt kết nối Supabase thực tế.

Các bước sửa:

1. Chuyển việc đăng ký phiên thành luồng có thứ tự: kiểm tra tab đang hoạt động trước khi nhận quyền sở hữu phiên trên server.
2. Khi phát hiện trùng tab và người dùng chọn đóng tab mới, không ghi đè phiên cũ.
3. Xử lý trường hợp hai tab mở cùng lúc bằng cơ chế điều phối có kết quả xác định; xác minh quyền sở hữu sau khi đăng ký hoặc kết nối lại để không bỏ lỡ thay đổi giữa lúc ghi và subscribe.
4. Đưa truy vấn và Realtime qua repository theo kiến trúc hiện tại; cleanup kênh và bỏ qua phản hồi bất đồng bộ sau khi composable bị hủy.
5. Theo dõi tài khoản bằng nguồn reactive thay vì chuỗi `userId` chụp tại thời điểm khởi tạo; hủy đăng ký cũ khi tài khoản thay đổi.

Kiểm chứng:

- Mở tab B khi tab A hoạt động, rồi đóng B: A tiếp tục dùng được và giữ quyền sở hữu phiên.
- Mở hai tab đồng thời, tải lại tab, đổi tài khoản và unmount trong lúc đăng ký: không tạo kênh thừa hoặc ghi phiên cũ.
- Đăng nhập từ trình duyệt khác: cảnh báo đúng theo hành vi một phiên đang được áp dụng.
- Chạy kiểm thử nhiều tab/trình duyệt và build.

## 3. Cảnh ngày/đêm không cập nhật khi thời gian thay đổi

- Mức độ: Trung bình.
- Vị trí: `src/stores/dayPhase.ts`, getter `currentPhase`; `src/views/FishingView.vue`; `src/components/player/fishing/DayPhaseClock.vue`.
- Hiện trạng: Getter gọi `new Date()` nhưng không có phụ thuộc reactive, nên kết quả bị cache. Cảnh nền được gán riêng cũng không tự đổi khi đi qua mốc thời gian.
- Bằng chứng: Đã tái hiện bằng cách đổi giờ từ 16 sang 21; `currentPhase` vẫn là `day`, cảnh vẫn là `/lake/day.png`.

Các bước sửa:

1. Dùng nguồn thời gian reactive dùng chung trong store hoặc composable, có cơ chế khởi động và dọn timer rõ ràng.
2. Tính giai đoạn trong ngày từ nguồn thời gian đó; cập nhật cảnh nền, nhãn và biểu tượng cùng nhau khi chuyển giai đoạn.
3. Cập nhật lại ngay khi tab trở về trạng thái hiển thị để xử lý timer bị trình duyệt tạm dừng.
4. Kết hợp với nguồn múi giờ thống nhất ở vấn đề 4 để tránh triển khai hai cơ chế tính giờ khác nhau.

Kiểm chứng:

- Đi qua các mốc 03:00, 09:00, 17:00, 19:00 và qua nửa đêm: cảnh, nhãn và biểu tượng đổi đúng.
- Tab bị ẩn qua một mốc thời gian rồi mở lại: cập nhật ngay, không cần tải lại trang.
- Rời và vào lại màn câu: không nhân đôi timer.
- Chạy kiểm thử với đồng hồ giả lập và build.

## 4. Giờ hiển thị không thống nhất với múi giờ tính cá xuất hiện

- Mức độ: Trung bình.
- Vị trí: `src/stores/dayPhase.ts`; `src/data/supabaseFishingAreaRepository.ts`, `fetchOneAreas`; `scripts/supabase/rpc/fishing/cast_rod.sql`.
- Hiện trạng: Client tính giai đoạn bằng `getHours()` theo giờ thiết bị. Server tính điều kiện xuất hiện cá theo `fishing_areas.timezone`, kế thừa `countries.default_timezone` khi chưa cấu hình. Dữ liệu chi tiết bãi câu hiện chưa trả múi giờ cho luồng hiển thị này.
- Bằng chứng: Xác nhận từ mã nguồn client và SQL; chưa đối chiếu cấu hình từng bãi câu trên Supabase thực tế.

Các bước sửa:

1. Trả múi giờ hiệu lực của bãi câu qua repository, tuân theo cùng quy tắc kế thừa như server; kiểm tra type hiện có trước khi bổ sung trường.
2. Dùng múi giờ IANA của bãi câu để tính giờ hiển thị và giai đoạn cảnh, không phụ thuộc múi giờ thiết bị.
3. Nếu cần đồng bộ cả thời điểm, sử dụng mốc giờ server và độ lệch thời gian thay vì chỉ dựa vào đồng hồ thiết bị.
4. Làm rõ quan hệ giữa bốn giai đoạn cảnh và hai điều kiện cá `DAY`/`NIGHT`. Server hiện coi giờ 06–18 là `DAY`; tránh để giao diện diễn giải bốn giai đoạn cảnh như điều kiện xuất hiện cá tương đương.
5. Xử lý múi giờ thiếu hoặc không hợp lệ một cách rõ ràng; không âm thầm dùng giờ thiết bị làm kết quả chính xác của bãi câu.

Kiểm chứng:

- Đổi múi giờ thiết bị trong khi giữ nguyên bãi câu và thời điểm: giờ bãi câu và cảnh không thay đổi sai lệch.
- Bãi có múi giờ riêng, bãi kế thừa múi giờ quốc gia và vùng có DST: hiển thị đúng.
- Đối chiếu điều kiện xuất hiện cá tại 06:00 và 19:00 theo giờ bãi câu.
- Chạy kiểm thử chuyển đổi múi giờ, kiểm tra i18n nếu đổi giao diện và build.

## Thứ tự thực hiện đề xuất

1. Triển khai SQL và kiểm chứng thực tế bản sửa phục hồi kết quả câu khi lỗi mạng.
2. Sửa điều phối phiên giữa các tab.
3. Thực hiện vấn đề 3 và 4 cùng nhau vì dùng chung nguồn thời gian và cách tính cảnh.

Tuân thủ `AGENTS.md` khi triển khai: dùng Pinia/composable cho logic và state, repository cho truy cập Supabase, tái sử dụng component chung, hỗ trợ i18n ngoài phần admin, giữ UTF-8 không BOM và chạy build sau khi sửa mã nguồn.
