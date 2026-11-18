# Các vấn đề cần cải thiện

Ngày ghi nhận: 18/11/2026.

Trạng thái: Vấn đề 1 đã sửa trong mã nguồn, chờ triển khai SQL lên Supabase và kiểm chứng thực tế. Vấn đề 2 đã sửa và kiểm thử với nhiều tab/trình duyệt bằng server giả lập; chờ kiểm chứng với Supabase thực tế. Vấn đề 3–4 đã sửa cùng nhau và kiểm thử tự động; chờ đối chiếu cấu hình bãi câu trên Supabase thực tế.

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
- Trạng thái: Đã sửa trong mã nguồn ngày 18/11/2026; chưa kiểm chứng với Supabase thực tế.
- Vị trí: `src/composables/use-single-session.ts`, `src/data/supabaseSessionRepository.ts`; nơi gọi tại `src/layouts/PlayerLayout.vue`.
- Lỗi trước khi sửa: Kiểm tra bằng BroadcastChannel và ghi `active_session_id` chạy đồng thời. Tab mới có thể ghi đè phiên đang hoạt động dù đã nhận cảnh báo trùng tab. Chọn “Đóng tab này” không khôi phục phiên cũ.

Các bước đã thực hiện:

1. Thay cơ chế dò tab bằng Web Locks theo tài khoản. Khóa được giữ suốt vòng đời phiên; tab không nhận được khóa chỉ hiện cảnh báo, không đăng ký Realtime hoặc ghi phiên server. Hai tab mở đồng thời chỉ có một tab được đăng ký.
2. Chờ Realtime subscribe thành công rồi mới ghi phiên. Đọc lại quyền sở hữu sau khi ghi, khi có thay đổi và sau mỗi lần kết nối lại; không tự ghi đè phiên khi reconnect. Giữ màn câu đang chạy trong lúc Realtime tạm mất kết nối.
3. Đưa truy vấn, subscribe và cleanup kênh vào repository; chuyển type phiên vào `src/types/table/activeSession.ts`. Hủy request bằng AbortSignal và bỏ qua kết quả cũ khi đổi tài khoản hoặc unmount.
4. Truyền getter tài khoản reactive từ layout. Chỉ mở màn chơi sau khi xác nhận quyền sở hữu; lỗi khởi tạo có nút thử lại và bản dịch Việt/Anh.
5. Khi không có Web Locks, hiển thị thông báo yêu cầu trình duyệt hỗ trợ và HTTPS; không dùng cơ chế dò tab theo timeout có thể ghi đè phiên cũ. Không cần thay đổi SQL.

Kiểm chứng:

- `npm run test:single-session`: 3/3 kiểm thử repository đạt, bao phủ truy vấn theo tài khoản, hủy request, subscribe/reconnect, timeout, lỗi và cleanup.
- `npm run test:single-session:browser`: 8/8 tình huống đạt bằng Edge headless, Web Locks thật và server/Realtime giả lập. Bao phủ nút “Đóng tab này”, mở đồng thời, reload, trình duyệt khác qua browser context riêng, đổi tài khoản, unmount khi chờ subscribe, ghi đè giữa lúc đăng ký và phản hồi đọc đến muộn.
- Kiểm tra i18n và build đạt.
- Còn cần kiểm chứng trên Supabase thực tế: mở tab B rồi đóng B để A tiếp tục chơi; đăng nhập bằng trình duyệt khác và ngắt/kết nối lại Realtime để đối chiếu cảnh báo với quyền sở hữu trong `active_sessions`.

## 3. Cảnh ngày/đêm không cập nhật khi thời gian thay đổi

- Mức độ: Trung bình.
- Trạng thái: Đã sửa trong mã nguồn ngày 18/11/2026.
- Vị trí: `src/stores/dayPhase.ts`, getter `currentPhase`; `src/views/FishingView.vue`; `src/components/player/fishing/DayPhaseClock.vue`.
- Lỗi trước khi sửa: Getter gọi `new Date()` nhưng không có phụ thuộc reactive, nên kết quả bị cache. Cảnh nền được gán riêng cũng không tự đổi khi đi qua mốc thời gian.
- Bằng chứng: Đã tái hiện bằng cách đổi giờ từ 16 sang 21; `currentPhase` vẫn là `day`, cảnh vẫn là `/lake/day.png`.

Các bước đã thực hiện:

1. Store `dayPhase` giữ thời gian reactive dùng chung; composable `useDayPhaseClock` giữ và trả quyền sử dụng timer theo vòng đời màn hình. Nhiều nơi sử dụng chỉ tạo một timer, nơi cuối cùng rời màn hình sẽ dọn timer và listener.
2. Cảnh nền, nhãn, biểu tượng và đồng hồ đều được tính từ thời gian này và múi giờ bãi câu, cập nhật mỗi giây.
3. Sự kiện `visibilitychange` cập nhật ngay khi tab hiển thị trở lại.
4. Xem trước trên bản đồ tải chi tiết bãi qua store/repository để có múi giờ hiệu lực; dùng dữ liệu riêng và bỏ qua phản hồi cũ khi đổi lựa chọn, không ghi đè cảnh màn câu.

Kiểm chứng:

- `npm run test:day-phase`: 7/7 kiểm thử đạt, bao phủ các mốc 03:00, 09:00, 17:00, 19:00, nửa đêm, cập nhật khi tab hiển thị trở lại và vòng đời timer bằng đồng hồ giả lập.
- Kiểm thử cũng bao phủ phản hồi xem trước đến muộn và việc xem trước không thay đổi cảnh đang câu.
- Kiểm tra i18n, kiểm thử hồi quy bản đồ/phục hồi kết quả câu và build đạt.

## 4. Giờ hiển thị không thống nhất với múi giờ tính cá xuất hiện

- Mức độ: Trung bình.
- Trạng thái: Đã sửa trong mã nguồn ngày 18/11/2026; không cần thay đổi SQL.
- Vị trí: `src/stores/dayPhase.ts`; `src/data/supabaseFishingAreaRepository.ts`, `fetchOneAreas`; `scripts/supabase/rpc/fishing/cast_rod.sql`.
- Lỗi trước khi sửa: Client tính giai đoạn bằng `getHours()` theo giờ thiết bị. Server tính điều kiện xuất hiện cá theo `fishing_areas.timezone`, kế thừa `countries.default_timezone` khi chưa cấu hình. Dữ liệu chi tiết bãi câu chưa trả múi giờ cho luồng hiển thị này.
- Bằng chứng: Xác nhận từ mã nguồn client và SQL; chưa đối chiếu cấu hình từng bãi câu trên Supabase thực tế.

Các bước đã thực hiện:

1. `fetchOneAreas` trả múi giờ hiệu lực: ưu tiên múi giờ bãi đã trim, kế thừa múi giờ quốc gia nếu rỗng/null, đúng quy tắc `cast_rod.sql`. Type `FishingAreaDetails` tái sử dụng trường của `FishingAreaRow`.
2. Dùng `Intl.DateTimeFormat` với `timeZone` IANA cho giờ và giai đoạn cảnh, hỗ trợ DST và không phụ thuộc múi giờ thiết bị.
3. Phạm vi bản sửa là thống nhất múi giờ; thời điểm vẫn lấy từ `Date.now()`, chưa bổ sung đồng bộ giờ server. Đồng hồ thiết bị sai thời điểm vẫn có thể làm giao diện lệch so với server; server tiếp tục quyết định cá xuất hiện.
4. Hiển thị riêng điều kiện cá ban ngày (06:00 đến trước 19:00) hoặc ban đêm (19:00 đến trước 06:00), kèm bản dịch Việt/Anh, để phân biệt với bốn giai đoạn cảnh.
5. Nếu múi giờ thiếu/không hợp lệ, hiển thị thông báo và dấu “—”, không dùng múi giờ thiết bị hoặc hiển thị cảnh sai như dữ liệu hợp lệ.

Kiểm chứng:

- `npm run test:day-phase`: kiểm tra độc lập với múi giờ thiết bị, cả hai lần chuyển DST, múi giờ riêng/kế thừa, giá trị rỗng/sai và các mốc 06:00/19:00 theo giờ bãi câu đều đạt.
- `npm run check:i18n` và `npm run build` đạt; 8/8 kiểm thử hồi quy bản đồ/phục hồi kết quả câu đạt.
- Chưa đối chiếu cấu hình, quyền đọc quan hệ quốc gia và cá xuất hiện trên Supabase thực tế.

## Thứ tự thực hiện đề xuất

1. Triển khai SQL và kiểm chứng thực tế bản sửa phục hồi kết quả câu khi lỗi mạng.
2. Kiểm chứng thực tế bản sửa điều phối phiên giữa các tab.
3. Kiểm chứng thực tế bản sửa chung của vấn đề 3 và 4 theo múi giờ cấu hình tại từng bãi câu.

Tuân thủ `AGENTS.md` khi triển khai: dùng Pinia/composable cho logic và state, repository cho truy cập Supabase, tái sử dụng component chung, hỗ trợ i18n ngoài phần admin, giữ UTF-8 không BOM và chạy build sau khi sửa mã nguồn.
