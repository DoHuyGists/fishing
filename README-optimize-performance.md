# Đánh giá tải đồng thời và kế hoạch tối ưu

Ngày đánh giá: **12/11/2026**. Phạm vi: mã nguồn Vue/Pinia, repository Supabase, RPC và migration SQL có trong dự án. Tài liệu này đề xuất thay đổi; chưa triển khai tối ưu hoặc chạy tải lên Supabase.

## 1. Hiện tại đáp ứng được khoảng bao nhiêu người chơi?

**Ước lượng để lập kế hoạch ban đầu: khoảng 20–50 người chơi đồng thời trên Free/Nano; khoảng 50–150 trên Pro/Micro với mã hiện tại.** Đây là khoảng chọn để bắt đầu kiểm thử, độ tin cậy thấp, không phải kết quả benchmark hoặc cam kết chịu tải. Hệ thống có thể chậm trước các mốc này nếu truy vấn thiếu index, RLS nặng, chợ sôi động hoặc cơ chế xử lý cá cắn giữ transaction lâu; cũng có thể vượt chúng nếu dữ liệu ít và người chơi thao tác thưa.

Chưa có thông tin gói thực tế, compute, region, cấu hình Realtime, số dòng dữ liệu, index/policy/trigger đang triển khai, thời gian RPC và telemetry production. Vì thế chưa thể xác nhận một ngưỡng CCU an toàn. Không suy ra throughput PostgreSQL chỉ từ việc đọc code.

| Cấu hình giả định | Khoảng kiểm thử nên bắt đầu với mã hiện tại | Mục tiêu kiểm thử sau tối ưu | Điều kiện |
| --- | --- | --- | --- |
| Free / Nano | 20–50 CCU | 50–100 CCU | Loại subscription toàn bảng không cần thiết, truy vấn có giới hạn, dữ liệu vừa phải; vẫn chịu hạn mức Free |
| Pro / Micro | 50–150 CCU | 100–300 CCU | Hoàn thành các việc P0 bên dưới; replay SQL và Realtime đạt SLO |
| Pro, tăng Small/Medium và cấu hình Realtime phù hợp | Chưa có cơ sở gán thêm CCU chỉ nhờ nâng máy | Thử các nấc 300 → 500 → 1.000 CCU | Đây là các mốc thử nghiệm, không phải dự báo đạt được; cần xử lý fan-out, đo replay, kiểm tra quota và chi phí |

Giả định cho các khoảng ban đầu: mỗi tài khoản một tab đang hoạt động; phần lớn người dùng câu cá, một phần ở sảnh/chợ/ao; một vòng câu trung bình 30 giây là giả định mô hình, không phải số đo của game; không có đợt đăng nhập hay đổi khu vực đồng loạt; hosting frontend và mạng đủ đáp ứng. Thử thách tối đa 90 giây không có nghĩa mọi lượt đều kéo dài 90 giây.

**Chưa cần xây một backend riêng chỉ vì muốn tăng CCU.** Supabase đang đóng vai trò backend thông qua Auth, Data API, PostgreSQL RPC và Realtime. SQL xử lý nghiệp vụ vẫn dùng CPU, I/O và lock phía server. Ưu tiên giảm công việc trên mỗi lượt và giảm số người nhận mỗi sự kiện trước khi thêm tầng dịch vụ.

### Phân biệt các giới hạn

Một Supabase client được tạo tại [connection.ts](src/database/connection.ts). Nhiều channel thường dùng chung một WebSocket trong một tab; 6 channel không tương đương 6 người dùng hoặc 6 kết nối PostgreSQL. Nhiều tab/thiết bị, admin và kết nối khác vẫn dùng chung ngân sách dự án. Hạn mức MAU theo tháng cũng không phải CCU.

Giới hạn Realtime công bố tại thời điểm đối chiếu:

| Hạng mục | Free | Pro | Pro không bật spend cap |
| --- | ---: | ---: | ---: |
| Kết nối đồng thời | 200 | 500 | 10.000 |
| Message/giây | 100 | 500 | 2.500 |
| Join channel/giây | 100 | 500 | 2.500 |

Cần kiểm tra giới hạn áp dụng thực tế tại Dashboard; các con số này không chứng minh game đạt tương ứng 200, 500 hoặc 10.000 CCU. Nguồn: [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits).

Gói thanh toán và compute là hai lựa chọn khác nhau. Nano có tối đa 0,5 GB RAM, Micro 1 GB, Small 2 GB, Medium 4 GB; CPU của các mức này là shared. Nâng gói không tự chứng minh đã nâng compute của dự án cũ. Nguồn: [Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk).

## 2. Những điểm tốt đã có

- Luồng chính đi qua Pinia và repository; các hành động quan trọng dùng RPC. Có thể tối ưu tại SQL và repository mà giữ cấu trúc ứng dụng.
- [fishing.ts](src/stores/fishing.ts) chạy mô phỏng lực căng ở trình duyệt, thu các lần đổi trạng thái giữ/thả rồi submit một payload. **60 tick/giây không phải 60 request/giây/người.** SQL kiểm chứng kết quả, không chỉ tin cờ thắng do client gửi.
- Khi câu thành công, store thêm cá trực tiếp từ response vào giỏ, không tải lại toàn bộ giỏ mỗi lần.
- Channel phiên câu lọc theo `sessionId`, currency/profile và nhiều dữ liệu riêng đã lọc theo user; có cleanup ở nhiều vòng đời component.
- [Lobby.vue](src/components/player/world-map/Lobby.vue) và màn admin đã dùng nhiều async component. Router đã lazy-load các view chính; không đề xuất làm lại những phần này chỉ để có lazy loading.
- Nuôi cá tính tiến trình theo timestamp, chốt kết quả khi gọi RPC; không cập nhật DB mỗi giây. Có request ID để retry thao tác an toàn.

## 3. Các điểm nghẽn có bằng chứng từ mã nguồn

| Mức | Vị trí | Hiện trạng và ảnh hưởng |
| --- | --- | --- |
| P0 | [supabaseUserInAreaRepository.ts](src/data/supabaseUserInAreaRepository.ts), [PlayerLayout.vue](src/layouts/PlayerLayout.vue) | `subscribeToAreaUsers()` nghe `*` toàn bảng `user_in_area`. Mỗi event nhận được làm client đọc lại trạng thái của chính mình, dù người thay đổi là người khác. Subscription tồn tại cả ở sảnh và khi câu |
| P0 | [supabaseMarketRepository.ts](src/data/supabaseMarketRepository.ts), [market.ts](src/stores/market.ts) | Nghe toàn bảng `species_market`; mỗi đợt event sau debounce 250 ms tải lại danh sách listing và lịch sử riêng. Danh sách listing chưa phân trang phía server; fallback có thể thêm truy vấn |
| P0 | [fishing.ts](src/stores/fishing.ts), hàm `fetchPlayersInArea()` | Lấy người trong khu rồi tải các dòng `caught` của họ để tính count/best catch trong JavaScript. Chưa giới hạn số người/cá; tốn truyền dữ liệu và có thể tính thiếu khi chạm giới hạn dòng của Data API. Truy vấn DB này còn nằm trực tiếp trong store |
| P0 cần đo | [submit_tension_challenge.sql](scripts/supabase/rpc/fishing/submit_tension_challenge.sql) | `replay_tension_challenge()` lặp từng tick trong PL/pgSQL; 90 giây × 60 Hz = tối đa khoảng 5.400 tick với cấu hình cast hiện tại. Validator tổng quát còn cho phép tối đa 21.600 tick theo challenge. Đây là ứng viên dùng CPU đáng kể khi nhiều submit cùng lúc |
| P0 cần xác minh | [cast_rod.sql](scripts/supabase/rpc/fishing/cast_rod.sql), [FishingView.vue](src/views/FishingView.vue) | Frontend chờ UPDATE `BITE`; repo có `bite_at` nhưng chưa có đủ định nghĩa scheduler/trigger/worker chuyển phiên sang `BITE`. File cast là phần thân function, không phải toàn bộ schema/wrapper. Không thể kết luận cách xử lý đang chạy hoặc sức tải của nó |
| P1 | [team.ts](src/stores/team.ts) | Nghe ba bảng tổ đội không có filter; mỗi callback chạy lại `loadData()` gồm nhiều truy vấn. Không có gộp request cho các event liên tiếp |
| P1 | [featureAvailability.ts](src/stores/featureAvailability.ts) | Realtime đồng thời với polling bắt buộc 30 giây, kể cả tab ẩn. Các request qua feature gate cũng có thể làm mới cache hết TTL. Có single-flight nhưng vẫn tạo tải nền theo số người |
| P1 | [notification.ts](src/stores/notification.ts), [supabaseNotificationRepository.ts](src/data/supabaseNotificationRepository.ts) | Badge và modal có thể cùng đăng ký rồi tải lại ba tập dữ liệu thông báo. Tên `subscribeToNewNotifications()` ở store thực tế dùng subscription đầy đủ, không phải hàm INSERT-only cùng tên trong repository |
| P1 | [aquaculture.ts](src/stores/aquaculture.ts), [05_player_rpcs.sql](scripts/supabase/migrations/aquaculture/05_player_rpcs.sql) | Timer UI mỗi 15 giây nhưng store thường chỉ fetch sau 60 giây, hoặc 15 giây khi có batch đến hạn. `get_aquaculture_farm()` lấy lock profile, có thể ghi chốt cá và dựng JSON cả farm; không phải một GET nhẹ chỉ đọc |
| P1 | [supabaseFishRepository.ts](src/data/supabaseFishRepository.ts), [supabaseLeaderboardRepository.ts](src/data/supabaseLeaderboardRepository.ts) | Kho cá có luồng tải toàn bộ; leaderboard đã giới hạn top 50 nhưng có thêm exact count để tính hạng. Dữ liệu tích lũy làm chi phí tăng theo thời gian |
| P1 khi vận hành | [admin-monitor-store.ts](src/components/admin/monitor/admin-monitor-store.ts), [supabaseAdminMonitorRepository.ts](src/data/supabaseAdminMonitorRepository.ts) | Monitor nghe nhiều bảng gồm currency/presence, có debounce và poll nhưng vẫn thêm tải khi mở dashboard. Cần đưa ít nhất một admin vào bài test |

**Điều kiện về RLS:** “nghe toàn bảng” ở trên mô tả cấu hình client. RLS quyết định event nào thực sự được nhận. Nếu policy chỉ cho đọc dòng của mình, fan-out phát đến client có thể nhỏ hơn nhiều; chưa có đầy đủ policy production để xác nhận. Filter giúp thu hẹp subscription nhưng không thay thế RLS hoặc mặc nhiên loại bỏ mọi chi phí kiểm quyền phía Realtime.

Supabase lưu ý Postgres Changes kiểm quyền theo subscriber và xử lý thay đổi trên một luồng để giữ thứ tự. Vì vậy tăng compute DB đơn thuần không giải quyết triệt để nút thắt này. Nguồn: [Scaling Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes#scaling-postgres-changes).

## 4. Mô hình tải để hiểu các khoảng CCU

### 4.1. Tải nền của một vòng câu

Luồng bình thường sau khi đã vào khu:

1. RPC `cast_rod` tạo session và snapshot mechanics.
2. Join channel phiên câu; khi `SUBSCRIBED`, repository SELECT session để phục hồi event bị bỏ lỡ.
3. Nhận `BITE`, store SELECT lại challenge.
4. RPC `start_tension_challenge` khi bắt đầu giữ nút.
5. RPC `submit_tension_challenge`, replay rồi resolve: cập nhật session, mồi, profile và tạo cá nếu thắng.

Khoảng **5 HTTP request/vòng câu** trong đường đi bình thường, chưa tính feature flags, vào/ra khu, tải lại, truy vấn phụ, retry hay reconnect. Số statement SQL thực tế lớn hơn 5 vì RPC chạy nhiều truy vấn nội bộ. Có nhiều UPDATE có thể phát Realtime trong vòng đời session; cần đo message thực tế, không coi một vòng chỉ có một event.

Đặt `N_f` là số người đang câu và `T` là số giây trung bình/vòng:

```text
Vòng câu/giây       ≈ N_f / T
HTTP request/giây   ≈ 5 × N_f / T + tải tính năng khác
Submit replay/giây  ≈ N_f / T
```

| Người đang câu | Vòng/giây, giả định T = 30 s | HTTP request/giây từ vòng câu |
| ---: | ---: | ---: |
| 50 | 1,67 | 8,3 |
| 150 | 5 | 25 |
| 300 | 10 | 50 |
| 500 | 16,67 | 83,3 |
| 1.000 | 33,33 | 166,7 |

Đây chỉ là nhu cầu tải, không phải năng lực Supabase đã đo. Nếu trận dài, request/giây giảm nhưng mỗi replay lại nhiều tick hơn. Ví dụ 500 người với vòng khoảng 95 giây, trong đó đấu 90 giây: khoảng 5,26 submit/giây × 5.400 tick ≈ 28.400 tick replay/giây, chưa tính SQL khác. Chi phí CPU/tick phải benchmark.

### 4.2. Vì sao subscription toàn bảng nguy hiểm

Giả sử `N` client đều nhìn được thay đổi `user_in_area`; mỗi người tạo một thay đổi nhận được trong 60 giây:

```text
Thay đổi nguồn/giây                  = N / 60
Message giao tới client/giây         ≈ N² / 60
SELECT phát sinh lại từ callback/giây ≈ N² / 60
```

Với 150 người: khoảng 375 message/giây và 375 SELECT/giây chỉ để làm mới trạng thái khu. Với 300 người: khoảng 1.500 cho mỗi loại. Lọc đúng owner có thể đưa số message/callback này xuống khoảng `N/60`, tương ứng giảm khoảng `N` lần trong chính kịch bản này. Không áp dụng tỷ lệ đó cho toàn hệ thống hoặc khẳng định throughput nội bộ Realtime tăng đúng `N` lần.

Tần suất một thay đổi/phút/người là giả định để thấy độ nhạy. Nếu người chơi ở một khu lâu, tải sẽ thấp hơn; nếu trigger cập nhật dòng thường xuyên, tải sẽ cao hơn. Phải xem trigger và policy thật trước khi dùng mô hình này dự báo.

Tương tự với chợ: `E` event/giây và `V` người mở chợ tạo khoảng `E × V` lượt nhận. Nếu 100 người cùng mở chợ, 2 event/giây cách nhau hơn 250 ms có thể khiến khoảng 400 request đọc/giây vì mỗi event tải listing và lịch sử. Event dồn trong cửa sổ debounce được gộp; event liên tục cũng có thể trì hoãn refresh. Debounce không giảm message đã phát tới client.

Polling flags ở 1.000 người tạo riêng khoảng 33 request/giây. Polling chợ thêm khoảng `2 × V / 30` request/giây khi tab hiển thị. Những số này chưa tính lần load đầu hoặc request khác làm cache hết hạn.

### 4.3. Sức tải và ngân sách theo tháng

Một thay đổi DB gửi đến nhiều client được tính nhiều message. Ví dụ duy trì 100 message nhận/giây trong 8 giờ/ngày, 30 ngày tương đương 86,4 triệu message/tháng, dù lượng ghi nguồn có thể nhỏ. Đây là phép tính giả định, không phải dự báo usage hiện tại.

Hạn mức tháng được công bố là 2 triệu message với Free và 5 triệu với Pro; Pro có phí vượt mức khi đủ điều kiện thanh toán. Kiểm tra cả egress, dung lượng DB và peak connections khi chọn cấu hình. Nguồn: [Realtime Messages usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages).

## 5. Phương án tối ưu có ảnh hưởng đáng kể

### P0-A. Thu hẹp và giảm phản ứng của các subscription

**Cách làm ngay trong kiến trúc hiện tại:**

1. Đổi repository theo dõi trạng thái của chính người chơi thành `subscribeToMyArea(userId, ...)`, filter `user_id=eq.<id>`. Cập nhật nơi gọi trong `PlayerLayout`; không dùng subscription điều hướng này làm danh sách người trong khu.
2. Với dữ liệu chung theo khu/đội, chỉ subscribe khi màn liên quan mở, lọc `area_id`/`team_id` khi phù hợp. Invite lọc người nhận; danh sách đội công khai dùng phân trang và refresh thưa hơn. DELETE/move giữa khu cần có đường đối soát vì filter/RLS có giới hạn với event xóa hoặc dòng không còn được phép đọc.
3. Gom các event liên tiếp thành một refresh đang chạy và tối đa một lượt chạy bù. `requestId` hiện tại chỉ bỏ response cũ, không hủy hoặc ngăn query đã gửi. Dùng chung dữ liệu notification trong Pinia cho badge và modal.
4. Currency/profile nên áp dụng payload hoặc response RPC đủ trường vào store; chỉ fetch lại khi thiếu dữ liệu hoặc cần đối soát. Không cập nhật từ payload thiếu trường theo cách xóa mất state cũ.
5. Reconnect phải có snapshot để phục hồi; giữ cleanup khi đổi user/unmount và tránh callback đến muộn ghi vào user mới.

**Ảnh hưởng:** giảm mạnh tải đọc không phục vụ người đang thao tác. Đo message/event nguồn, số HTTP request/event và p95 trước/sau. Trường hợp toàn bảng đã bị RLS giới hạn đúng owner thì mức giảm sẽ ít hơn mô hình ở mục 4.2.

### P0-B. Phân trang phía server và dữ liệu tổng hợp

- Chợ: trả 20–50 listing/trang với thứ tự ổn định `(created_at DESC, id DESC)`; ưu tiên cursor khi dữ liệu lớn. History đang có phân trang 20 dòng; giữ cơ chế đó, chỉ tải lại history khi event liên quan buyer/seller hiện tại hoặc sau thao tác của họ. Hiện một event listing của người khác cũng reload history của mình.
- Khi có thay đổi chợ chung, đánh dấu trang đang xem cần cập nhật hoặc gộp refresh có giới hạn; tránh tải lại mọi listing. Mua cá vẫn phải dùng RPC kiểm tra tồn tại/status/giá trong transaction, kể cả UI đang hiển thị snapshot cũ.
- Người trong khu: đưa truy vấn trong `fetchPlayersInArea()` về repository. Tạo RPC trả trang người chơi cùng `caught_count`, best catch, level từ dữ liệu tổng hợp. Aggregate theo user và đúng phạm vi quyền; không tải toàn bộ `caught` về browser để đếm. Nếu dùng bảng stats, cập nhật nguyên tử theo user và xác định rõ “thành tích lịch sử” khác “cá còn sở hữu”; có backfill và đối soát sau bán/xóa/chuyển cá.
- Kho cá/nhật ký/thông báo: phân trang ở repository/RPC, có filter trước khi truyền; phân trang bằng `.slice()` trên client không giảm tải DB hoặc mạng.
- Leaderboard: giữ top có giới hạn; nếu exact rank tốn thời gian, dùng snapshot xếp hạng cập nhật theo lịch và công bố thời điểm cập nhật. Không đổi ý nghĩa score hoặc cách xử lý đồng hạng một cách ngầm định.

**Ảnh hưởng:** lượng dữ liệu mỗi request bị chặn theo page size; tránh sai thống kê do giới hạn dòng API. Ví dụ danh sách 1.000 listing chuyển sang 25 listing/trang giảm khoảng 40 lần số listing của request trang đầu, không đồng nghĩa query nhanh hơn 40 lần.

### P0-C. Kiểm tra cơ chế `BITE` và bỏ phụ thuộc vào scheduler cho từng lượt nếu phù hợp

Trước tiên xuất định nghĩa function/trigger/job thực tế xử lý `fishing_sessions`: nó chạy định kỳ, dựa trigger hay giữ connection trong lúc đợi? Không thấy `pg_sleep` trong SQL được commit; không được kết luận production có hoặc không có nó.

Thiết kế đề xuất khi muốn bỏ việc phát `BITE` bằng scheduler: `cast_rod` trả `session_id`, `bite_at`, thời gian server. UI đặt timer theo thời gian đó; đến hạn gọi RPC lấy/activate challenge. RPC xác minh owner, membership, `bite_at`, expiry và trạng thái, chuyển phiên nguyên tử, hỗ trợ retry cùng session. Có thể thiết kế gộp bước lấy challenge với activate để giảm round trip nhưng phải giữ thời điểm người chơi thực sự bắt đầu đấu.

Thay đổi phải đồng bộ frontend và toàn bộ state machine SQL: các hàm start/submit/resolve hiện đều có điều kiện `BITE`. Tab bị treo, sleep/resume, refresh, clock lệch và mạng chậm phải được xử lý bằng thời gian server; timer client chỉ điều khiển giao diện. Không gửi sớm snapshot bí mật về loài cá/kết quả đã roll. Triển khai theo phiên bản giao thức để phiên đang câu không hỏng.

**Ảnh hưởng:** có thể bỏ channel thay đổi theo từng lượt, giảm join/reconnect và loại nhu cầu scheduler cập nhật từng session. Đây là thay đổi nghiệp vụ lớn hơn filter subscription; đo baseline và xác minh cơ chế production trước khi chọn.

### P0-D. Đo và tối ưu SQL, index, RLS, lock

Thu thập schema đang triển khai trước khi thêm index. Repo chưa chứa đầy đủ schema ban đầu nên không thể khẳng định các index dưới đây đang thiếu.

| Đường truy cập | Index ứng viên cần kiểm tra bằng query plan |
| --- | --- |
| Trạng thái khu theo user | Unique/index `user_in_area(user_id)` theo quy tắc số dòng; `(area_id, user_id)` nếu truy vấn theo khu cần |
| Cá theo owner, status và trang | `caught(user_id, status, created_at DESC, id DESC)`; stats aggregate có thể cần index riêng theo truy vấn |
| Listing đang bán | Partial index `(created_at DESC, id DESC) WHERE status = 'normal'`, bổ sung filter khác sau khi đo |
| Lịch sử buyer/seller | Repo đã có index theo buyer/seller và date; cân nhắc thêm `id` phù hợp thứ tự/cursor, không tạo index trùng máy móc |
| Session theo owner/trạng thái hoặc dọn hết hạn | `fishing_sessions(user_id, status)` / index expiry phù hợp job; SELECT theo `id` thường đã dùng primary key |
| Danh sách loài trong khu, set đang dùng | `species_in_area(area_id)`; index theo `user_equipments(user_id, is_used, created_at DESC, id DESC)` hoặc partial cho set đang dùng |
| RLS, invite, notification, farm | Các cột owner/receiver/team/FK được dùng trong predicate và join |

Chạy `EXPLAIN (ANALYZE, BUFFERS)` với dữ liệu đại diện và role/JWT tương ứng. SELECT bằng owner đặc quyền không phản ánh chi phí RLS của người chơi. Với RPC ghi dữ liệu, ANALYZE thực sự thực thi thao tác: chỉ đo trên staging, snapshot hoặc transaction kiểm soát được; không replay mutation tùy ý trên production.

Với policy, index cột kiểm quyền và cân nhắc `(select auth.uid())` cho biểu thức không phụ thuộc từng dòng; không bọc tùy tiện function phụ thuộc row. Giữ RLS, quyền owner và snapshot mechanics riêng tư. Nguồn: [RLS performance recommendations](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations).

Đo riêng `cast_rod`, `replay_tension_challenge`, `submit_tension_challenge` và resolve. Ưu tiên loại truy vấn lặp hoặc parse JSON trong vòng tick nếu có; replay hiện đã đưa nhiều cấu hình/input ra biến và mảng nên cần profile trước khi sửa. Không giảm tick rate chỉ để nhanh hơn: phải version protocol, kiểm chứng deterministic replay giữa JS/SQL, rounding, RNG và kết quả thưởng.

Giữ transaction ngắn, thứ tự lock nhất quán cho các thao tác cùng profile/currency/inventory; lock theo user không tự khóa tất cả người chơi. Không bỏ lock chống tiêu tiền/mồi hai lần. Benchmark contention khi một tài khoản thao tác nhiều luồng và nhiều tài khoản mua cùng listing.

Thêm giới hạn phía RPC cho số session đang hoạt động, nhịp cast/activate/submit và kích thước payload phù hợp luật chơi; UI khóa nút không ngăn gọi API trực tiếp. Hiện có validation tick/input nhưng vẫn cần xem giới hạn hoạt động của wrapper/DB thật. Giới hạn phải nguyên tử để tránh burst lách qua nhiều request song song.

**Ảnh hưởng:** giảm CPU/I/O, thời gian giữ connection và tail latency. Chọn index dựa trên plan và tần suất ghi, vì mỗi index thêm cũng làm ghi/WAL tốn hơn.

### P1-A. Dùng Broadcast theo topic cho luồng fan-out lớn

Với chợ/khu/đội có nhiều subscriber, cân nhắc DB trigger gọi `realtime.broadcast_changes()` hoặc event invalidation nhỏ vào topic riêng: `user:<id>`, `area:<id>`, `team:<id>`, và topic chợ theo nhu cầu. Cần private channel và policy Realtime Authorization phù hợp; client không được tự phát sự kiện giả làm kết quả gameplay.

Không cần backend riêng cho phương án DB trigger → Broadcast. Giữ Postgres Changes ở luồng ít tải nếu đã đủ tốt. Thông điệp nên mang ID/version/trường cần thiết, không đính kèm cả snapshot nhạy cảm. Reconnect vẫn lấy snapshot, không xem event là sổ cái giao dịch.

Broadcast được Supabase khuyến nghị cho khả năng mở rộng: [Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes). Tuy nhiên gửi một event đến 500 người vẫn tạo 500 lượt nhận; chỉ đổi transport mà giữ nguyên fan-out và refetch toàn bộ sẽ chưa giải quyết vấn đề. Thu hẹp topic và giảm callback mới tạo phần lớn lợi ích.

### P1-B. Cache, polling và đồng bộ lại có kiểm soát

- Cache catalog ít đổi trong Pinia theo version/TTL: species/item, cấu hình khu, blueprint, farm catalog. Không dùng cache chung cho wallet, inventory hoặc dữ liệu riêng giữa hai user.
- Flags: giữ server-side enforcement của tính năng. Dùng Realtime invalidation; tăng chu kỳ đối soát khi channel khỏe, dừng/giảm poll tab ẩn và refresh khi focus/reconnect. Chọn TTL theo độ trễ bật/tắt tính năng chấp nhận được; frontend cache không được trở thành cơ chế cấp quyền.
- Thêm jitter để người chơi không poll cùng nhịp sau đợt login; dùng single-flight, backoff khi lỗi. Không retry mutation mù sau timeout: timeout trong `withTimeout()` không chứng minh transaction server đã hủy. Dùng request ID/receipt hoặc đọc lại trạng thái trước khi thực hiện lại.
- Ao cá: giữ adaptive polling 15/60 giây hiện có; đừng hiểu timer UI 15 giây thành GET mỗi 15 giây. Tách phần catalog khỏi snapshot hay đổi; chỉ tải lại khi hết TTL. Nếu payload farm lớn, trả summary và trang cá của ao/batch đang mở; deadline trưởng thành dùng timestamp để UI tự tính.
- Với `get_aquaculture_farm()`, đo thời gian lock và chốt batch đến hạn trước khi tách read/write. Chỉ giảm lock nếu vẫn bảo đảm chốt ngẫu nhiên đúng một lần và retry an toàn.

**Ảnh hưởng:** giảm tải nền và đỉnh truy vấn đồng loạt; dễ đạt lợi ích trước khi phải tăng compute.

### P1-C. Kiểm soát dữ liệu tích lũy và tác vụ quản trị

Mỗi cast tạo ít nhất một `fishing_sessions` và một `fishing_session_mechanics`. Với 500 người thực sự câu liên tục, vòng trung bình 30 giây trong một giờ, riêng session đã thêm khoảng 60.000 dòng/giờ, chưa tính mechanics, cá, receipt, history và WAL. Đây là ví dụ tải duy trì, không phải usage của dự án.

Đặt retention cho session kết thúc/hết hạn và receipt theo thời hạn retry/đối soát; dọn theo batch nhỏ có index, tránh đụng phiên đang chạy hoặc xóa dữ liệu thưởng/audit cần giữ. Mechanics có FK `ON DELETE CASCADE`, cần tính cả tải xóa kéo theo. Đo autovacuum, dead tuples, kích thước index và replication lag. Chỉ cân nhắc partition khi có quy mô và query plan chứng minh cần.

Admin monitor nên đọc summary hoặc gộp delta theo cửa sổ, tránh mỗi thay đổi currency kéo full refresh. Poll/subscribe theo vòng đời màn hình và bật khi thực sự cần.

### P1-D. Frontend và phân phối tài nguyên

Giữ hosting static có CDN, nén Brotli/gzip, cache dài cho asset có hash; HTML cần cơ chế cập nhật phiên bản. Dùng ảnh đúng kích thước, WebP/AVIF khi thích hợp, lazy-load ảnh ngoài viewport và chỉ tải scene/audio cần dùng.

Thư mục `public` tại thời điểm xem có 124 file, tổng khoảng 170 MB theo hệ thập phân. **Không phải mỗi lần mở trang sẽ tải hết 170 MB.** Dùng Network đo byte thực tải lúc login, mở map, vào khu và mở gallery; tối ưu các tài nguyên đó trước. Build size cũng không đo được CCU database.

Đánh giá chunk theo import graph và byte tải đầu; `chunkSizeWarningLimit` chỉ thay đổi ngưỡng cảnh báo. Không gom/tách vendor hoặc đổi framework chỉ vì số KB cảnh báo. Các tối ưu này giúp tải trang, FPS và egress, ít ảnh hưởng CPU replay SQL.

### P2. Nâng cấu hình hoặc thêm dịch vụ khi có số đo

| Phương án | Khi phù hợp | Giới hạn và đánh đổi |
| --- | --- | --- |
| Tăng compute trong Supabase | CPU/RAM/I/O DB là nút thắt sau khi sửa truy vấn | Tăng chi phí; không tự chữa fan-out hay throughput một luồng của Postgres Changes |
| Điều chỉnh giới hạn Realtime / gói thanh toán | Đã chạm connection, join hoặc message quota trong khi DB còn dư | Kiểm tra usage và ngân sách trước khi bỏ spend cap; không đồng nghĩa app đạt ngưỡng kết nối được cấp |
| Read replica hoặc snapshot chung | Đọc catalog/leaderboard nặng, chấp nhận dữ liệu trễ | Kiểm tra đường đọc API thực sự đi replica; primary vẫn xử lý mutation/replay. Không giải quyết write bottleneck |
| Supabase Edge Function cho bước xử lý phù hợp | Cần bí mật, tích hợp bên ngoài, chặn abuse hoặc chuyển CPU replay ra DB | Vẫn là logic server nhưng không cần vận hành server riêng; có giới hạn runtime, cold start và thêm hop. RPC DB vẫn phải quyết định thưởng/transaction |
| Worker/dịch vụ riêng + queue | Replay đã đo là nút thắt CPU, cần kiểm soát burst, retry và throughput độc lập | Cần bảo vệ kết quả giữa worker và DB, idempotency, version protocol, observability. Queue thêm độ trễ; chỉ dùng nơi gameplay chấp nhận được |

Không chia shard nhiều project Supabase hoặc thêm Redis ngay từ đầu. Pinia cache chỉ giảm request trong một browser; muốn cache dùng chung giữa người chơi cần snapshot/materialized data hoặc tầng phục vụ chung, với quy tắc invalidation/quyền phù hợp.

## 6. Cách đo để chốt CCU thật

### Bước 1: Chốt cấu hình và baseline

Ghi lại plan, compute, region, Realtime settings, kích thước bảng/index, policy, trigger, publication và job. Xác minh đầy đủ đường `BITE`, function wrapper, giới hạn session và schema production; migration trong repo không tự chứng minh đã được deploy.

Dùng DevTools ghi request và WebSocket của một người cho các luồng: login → sảnh → vào khu → nhiều lượt câu thắng/thua → ra khu; mở chợ và giao dịch; notification/team; farm đến hạn. Ghi request/vòng, byte/vòng, message/vòng, channel và số lần refetch. Kiểm tra cả tab ẩn/resume và reconnect.

### Bước 2: Kiểm thử trên staging tương đương

Seed dữ liệu có quy mô đại diện, không chỉ DB trống: số cá/user, listing/history, session cũ, notification và batch farm. Tạo tài khoản test riêng có đủ trang bị/mồi/lượt; script phải đi theo state machine và thời gian server, tạo trace lực căng hợp lệ để thật sự đi qua replay và resolve.

Dùng k6/Artillery hoặc công cụ tương đương cho HTTP và harness `supabase-js` cho Realtime. Mỗi người mô phỏng phải có JWT của chính họ, filter và vòng đời subscription giống ứng dụng. Không dùng một service-role token chung để benchmark đường người chơi: nó bỏ qua RLS và làm sai kết quả; không dùng một tài khoản chung vì gây contention không đại diện. Đăng nhập chuẩn bị ngoài pha steady-state, rồi đo login burst riêng.

Các profile cần chạy riêng và chạy hỗn hợp:

- 100% đang câu với cả vòng ngắn và thử thách gần giới hạn; bao gồm submit đồng loạt.
- Hỗn hợp khởi đầu: 70% câu, 15% sảnh, 10% chợ, 5% farm; điều chỉnh bằng analytics thật. Có ít nhất một admin monitor và người nhận notification.
- Nhiều người xem chợ khi listing thay đổi nhanh; nhiều người vào/ra khu và đội cùng lúc.
- Reconnect/focus sau khi mất mạng; burst join và login; retry sau timeout với cùng request ID/session.
- Tranh mua cùng listing, submit trùng phiên, thao tác farm/tiền đồng thời; kiểm tra không nhân đôi thưởng hoặc trừ sai tài nguyên.

Tăng tải từng nấc 20 → 50 → 100 → 150 → 300 → 500 → 1.000, chỉ đến mức quota staging cho phép. Warm-up rồi giữ mỗi nấc ít nhất 15–30 phút; ngưỡng ứng viên chạy soak 1–2 giờ và burst riêng. Báo cả CCU đạt thực tế, request/giây, số vòng hoàn tất và cách pacing; “1.000 virtual users” ngủ phần lớn thời gian không phải 1.000 người đang câu.

### Bước 3: Tiêu chí đạt đề xuất

Các mức dưới đây là mục tiêu ban đầu cần thống nhất với trải nghiệm thực tế, không phải kết quả hiện có:

| Chỉ số | Mục tiêu ban đầu |
| --- | --- |
| cast/start API latency | p95 < 500 ms, p99 < 1.500 ms, đo từ vùng gần người chơi |
| submit gồm replay | p95 < 1.000 ms, p99 < 2.000 ms |
| `BITE` | p95 độ trễ từ `bite_at` đến UI nhận hợp lệ < 1 giây, đo cả scheduler và mạng |
| Lỗi hạ tầng/timeout/429 | < 0,5%; tách khỏi thua câu và lỗi nghiệp vụ có chủ đích |
| DB | CPU duy trì mục tiêu < 70%; I/O/connection có dư địa, không tăng hàng chờ/replication lag qua thời gian |
| Realtime | Không có vòng reconnect lặp, không mất trạng thái sau đối soát; giữ dư địa khoảng 30% message/join/connection quota |
| Tính đúng | Không thưởng trùng, không âm tiền/mồi, không vượt quyền, không kẹt session khi retry |

Theo dõi Supabase Reports/Logs, Query Performance, `pg_stat_statements` nếu bật, DB CPU/RAM/I/O/lock waits, Realtime throughput/lag và egress. Phân biệt tổng thời gian query với p95/p99: `pg_stat_statements` không tự cung cấp percentile; cần số đo từ harness hoặc tracing. P95 client gồm mạng và round trip, không tương đương thời gian SQL.

Chọn **nấc cao nhất vẫn đạt tiêu chí trong bài hỗn hợp và soak**, rồi giảm khoảng 20–30% để công bố công suất vận hành ban đầu. Không ngoại suy tuyến tính từ 50 CCU lên 1.000 CCU. Kiểm thử lại khi thay luật câu, schema/policy hoặc quy mô dữ liệu.

## 7. Thứ tự triển khai đề xuất

1. Lấy baseline và cấu hình thật; xác minh `BITE`, RLS và SQL đã deploy.
2. Sửa subscription trạng thái khu theo owner; giảm refetch của chợ/đội/notification, bổ sung single-flight và phân trang server.
3. Thay tải `caught` để tính thống kê người chơi bằng summary có quyền rõ ràng; kiểm tra index/query plan và đo replay SQL.
4. Chạy lại các nấc tải. Dựa vào số đo chọn tối ưu state machine `BITE`, Broadcast theo topic, cache/polling và retention.
5. Khi còn nghẽn tài nguyên hoặc quota, mới chọn nâng compute/Realtime; thêm worker cho replay chỉ khi số đo chứng minh cần.

Mục tiêu hợp lý đầu tiên là **kiểm chứng 100 CCU trên Pro/Micro sau P0**, sau đó thử 150 và 300. Giữ mô hình Vue + Supabase là khả thi về kiến trúc; con số chịu tải cần được xác nhận bằng dữ liệu triển khai và load test theo quy trình trên.

## 8. Kiểm tra trong lần đánh giá này

`npm run build` đã thành công, gồm `vue-tsc -b` và Vite production build. Có cảnh báo chunk vendor khoảng 616,49 kB sau minify, vượt ngưỡng 600 kB; đây là vấn đề phân phối bundle cần đo thêm, không phải bằng chứng về giới hạn CCU. File báo cáo đã được kiểm tra UTF-8 không BOM và các liên kết mã nguồn cục bộ. Chưa chạy benchmark hoặc thay đổi cấu hình/database Supabase.
