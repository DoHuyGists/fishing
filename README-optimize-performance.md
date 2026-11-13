# Đánh giá tải đồng thời và kế hoạch tối ưu

Ngày đánh giá ban đầu: **12/11/2026**. Phạm vi: mã nguồn Vue/Pinia, repository Supabase, RPC và migration SQL có trong dự án. Các ước lượng tải dưới đây chưa được benchmark trên Supabase; tiến độ triển khai được ghi ở mục 9–10.

**Cập nhật 13/11/2026:** đã thay subscription của 14 bảng bằng snapshot/refresh trong client, giữ `fishing_sessions` và `active_sessions`. Đánh giá tại mục 9, kết quả triển khai tại mục 10; định hướng này thay thế các đề xuất giữ/thu hẹp subscription tại mục 5 và 7. Đã chuẩn bị migration gỡ publication, chưa áp dụng lên Supabase.

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

## 8. Kiểm tra trong lần đánh giá ban đầu ngày 12/11/2026

`npm run build` đã thành công, gồm `vue-tsc -b` và Vite production build. Có cảnh báo chunk vendor khoảng 616,49 kB sau minify, vượt ngưỡng 600 kB; đây là vấn đề phân phối bundle cần đo thêm, không phải bằng chứng về giới hạn CCU. File báo cáo đã được kiểm tra UTF-8 không BOM và các liên kết mã nguồn cục bộ. Chưa chạy benchmark hoặc thay đổi cấu hình/database Supabase.

## 9. Thay Realtime bằng tải lại dữ liệu — đánh giá 13/11/2026

### 9.1. Kết luận và phạm vi

**Đề xuất bỏ subscription của 14/16 bảng sau khi bổ sung các điểm refresh tương ứng; tạm giữ `fishing_sessions` và `active_sessions`.** Không có bảng nào bắt buộc dùng Postgres Changes về mặt kiến trúc. Hai bảng tạm giữ đang phục vụ hành vi cần phản ứng nhanh trong code hiện tại; muốn bỏ phải có cơ chế thay thế và kiểm thử riêng. Không tắt cả 16 bảng trên Dashboard trước khi sửa client.

Phân biệt ba cách cập nhật: lấy snapshot khi mở màn hình/bấm làm mới; đọc lại sau thao tác thành công của chính người chơi; polling có giới hạn cho thay đổi từ người khác. Chỉ GET sau thao tác của mình không thể tự phát hiện người khác mua cá, gửi lời mời, admin gửi thông báo hoặc đổi cấu hình. Các chu kỳ bên dưới là đề xuất ban đầu, cần đo tải và độ trễ chấp nhận được; không phải cấu hình đã triển khai hoặc cam kết thời gian thực khi mạng lỗi/tab bị trình duyệt đình chỉ.

GET dùng để đọc snapshot qua repository. Giữ mutation/RPC cho mua bán, nhận thưởng, vào/ra khu và chuyển trạng thái câu; không biến thao tác có ghi DB thành GET. Sau mutation, ưu tiên áp dụng response đầy đủ vào Pinia; nếu response chưa đủ thì GET đúng dữ liệu bị ảnh hưởng, tránh tải lại toàn bộ màn hình.

### 9.2. Quyết định cho từng bảng

| Bảng | Đề xuất | Cơ chế thay thế và ảnh hưởng cần xử lý |
| --- | --- | --- |
| `active_sessions` | **Tạm giữ** | [use-single-session.ts](src/composables/use-single-session.ts) nghe UPDATE theo user để hiện cảnh báo khi thiết bị khác ghi đè session. Có thể thay bằng GET session mỗi 15–30 giây và khi focus, nhưng cảnh báo sẽ trễ; BroadcastChannel đang có chỉ xử lý cùng trình duyệt. Nếu yêu cầu thật sự chỉ một phiên được thao tác, server phải xác thực session hiện hành trong các mutation quan trọng; modal Realtime hiện tại không phải cơ chế cưỡng chế phía server. Chỉ bỏ khi chấp nhận độ trễ và hoàn thành kiểm tra này |
| `currency` | **Bỏ** | GET lúc khởi tạo, sau hành động có thay đổi tiền/vỏ sò và khi quay lại tab với cache hết hạn. Các thay đổi do người khác mua listing của mình, quà admin hoặc tác vụ nền cần GET đối soát mỗi 60 giây khi tab hiển thị, hoặc chấp nhận chỉ cập nhật lúc mở ví/chợ. RPC vẫn quyết định đủ tiền; không dựa vào số dư cache. Monitor admin cũng nghe bảng này, phải chuyển sang snapshot riêng |
| `error_feedback` | **Bỏ** | GET khi mở lịch sử, đổi trang, sau gửi báo lỗi và bấm làm mới; nếu cần thấy admin trả lời khi đang xem thì poll 60 giây chỉ lúc panel mở. Giữ trang hiện tại và phân trang server đã có. Không cần tải nền khi panel đóng |
| `feature_flags` | **Bỏ** | Store đã có polling 30 giây và TTL 30 giây: bỏ subscription, dùng chung một lịch refresh, dừng nền khi tab ẩn và đối soát lúc quay lại. Giữ kiểm tra tại feature gate và xử lý server denial. Chấp nhận UI phản ánh bảo trì trễ khoảng một chu kỳ; các RPC nhạy cảm phải được kiểm tra có gate phía server trước khi coi việc tắt tính năng có hiệu lực ngay |
| `fishing_sessions` | **Tạm giữ** | [FishingView.vue](src/views/FishingView.vue) chỉ bắt đầu challenge khi nhận `BITE`; repository có SELECT phục hồi sau subscribe/reconnect. Bỏ ngay có thể khiến người chơi kẹt chờ. Có thể thay bằng timer theo thời gian server rồi GET session, retry ngắn có giới hạn khi chưa `BITE`; hoặc thiết kế RPC activate nguyên tử tại hạn cá cắn. Chi tiết tại 9.3 |
| `market_history` | **Bỏ** | GET khi mở tab lịch sử/đổi trang và sau mua bán của mình. Với giao dịch do người khác mua listing của mình, refresh lịch sử khi quay lại tab hoặc poll 30–60 giây nếu lịch sử đang mở. Không tải lịch sử chỉ vì listing bất kỳ thay đổi. Lịch sử hiện đã có phân trang 20 dòng |
| `personal_notifications` | **Bỏ** | GET khi mở modal; badge ở sảnh dùng một lịch chung 60 giây khi hiển thị và refresh khi quay lại tab. Badge/modal cùng dùng Pinia, không tạo hai vòng polling. Thông báo mới đến trễ theo chu kỳ; nếu cần báo tức thời thì giữ riêng subscription INSERT theo người nhận hoặc dùng push, đây là yêu cầu trải nghiệm bổ sung |
| `player_unlocked_countries` | **Bỏ** | GET khi vào bản đồ và sau hành động có thể mở khóa nước (nhiệm vụ, thưởng, tiến trình…). Đối soát lúc trở lại bản đồ/focus để nhận mở khóa từ admin/tác vụ nền. Rà soát các nguồn ghi và trigger trước khi bỏ, không chỉ luồng đổi quốc gia đang chọn. Giữ bảo vệ response cũ/đổi user trong store |
| `species_market` | **Bỏ, ưu tiên cao** | GET khi mở chợ, đổi filter/trang, bấm làm mới, sau đăng bán/hủy/mua. Poll khoảng 30 giây chỉ khi danh sách chợ hiển thị; hiện store đã có đối soát 30 giây nên tránh thêm lịch thứ hai. Phân trang listing phía server là việc đi kèm cần làm. Khi listing đã bán, RPC từ chối mua và client refresh; GET trước khi mua không thay thế kiểm tra nguyên tử trong transaction |
| `system_notification_reads` | **Bỏ** | Store đã đánh dấu đọc cục bộ sau mutation thành công. Giữ cập nhật badge từ state chung; GET đối soát khi mở modal/focus. Trạng thái đọc từ thiết bị khác sẽ đồng bộ ở lần tải tiếp theo, không cần listener riêng |
| `system_notifications` | **Bỏ** | Dùng chung lịch refresh thông báo ở trên; GET khi mở modal, đối soát badge 60 giây tại sảnh. Lọc hạn dùng mỗi lần đọc và xử lý thông báo hết hạn trong UI ngay cả khi không có event DB. Thông báo bảo trì không được thay thế gate kiểm tra nghiệp vụ phía server |
| `user_in_area` | **Bỏ, ưu tiên cao; bổ sung luồng điều hướng trước** | Listener toàn bảng trong [PlayerLayout.vue](src/layouts/PlayerLayout.vue) hiện GET lại khu của chính mình rồi điều hướng. Thay bằng GET sau vào/ra khu, chuyến đi theo đội và lúc khởi tạo/focus. Khi trạng thái của mình có thể bị đổi từ bên ngoài, poll dòng của mình khoảng 15 giây khi tab hiển thị để phục hồi điều hướng; không poll toàn bảng. Danh sách người trong bãi chỉ GET khi mở panel/refresh. Snapshot monitor admin tách riêng |
| `user_profile` | **Bỏ, sau khi nối đủ điểm refresh** | GET sau câu/nhận thưởng/tiêu điểm/nâng sức chứa và thao tác khác thay đổi profile, hoặc áp dụng profile từ response RPC. Subscription hiện chỉ áp dụng level/EXP/skill points; [useLevelUpCelebration.ts](src/composables/useLevelUpCelebration.ts) theo dõi level trong Pinia nên vẫn có thể bắn confetti qua cập nhật từ GET. Phải giữ phản hồi lên cấp ngay sau thưởng, không chờ người chơi mở hồ sơ. Thay đổi từ admin được đối soát khi focus/mở hồ sơ |
| `user_team_invite` | **Bỏ** | GET lời mời khi vào sảnh/mở tổ đội, sau nhận/từ chối; poll khoảng 30 giây tại sảnh nếu cần badge lời mời. Người gửi vẫn nhận kết quả thao tác ngay, người nhận thấy lời mời trễ một chu kỳ. Lọc theo `invitee_id`; không tải lại toàn bộ danh sách đội vì mỗi lời mời |
| `user_team_members` | **Bỏ** | GET sau tham gia/rời/kick/chuyển trưởng nhóm; với thay đổi do thành viên khác, poll membership/đội của mình 10–15 giây khi panel đội mở, khoảng 30 giây tại sảnh có hiển thị đội. Nếu cần phản ứng tức thì với kick thì giữ riêng listener đúng đội/user hoặc thay bằng tín hiệu khác. Mutation phải kiểm tra quyền hiện tại ở server |
| `user_teams` | **Bỏ** | GET danh sách khi mở tổ đội/đổi trang/bấm làm mới, sau tạo/sửa/đóng đội; poll danh sách 30 giây chỉ khi đang xem. Đội của mình dùng chung chu kỳ snapshot membership ở trên, không thêm lịch cho mỗi bảng. Chấp nhận trạng thái đầy/đóng/đổi trưởng nhóm trễ; server xác thực khi thực hiện thao tác |

### 9.3. Điều kiện để bỏ nốt hai subscription còn lại

**Phiên câu:** `cast_rod.sql` hiện trả `session_id`, `wait_time_ms`, `server_time_ms`; `bite_at` được lưu ở DB nhưng chưa trả trực tiếp. `start_tension_challenge` và submit hiện yêu cầu trạng thái `BITE`. Chỉ thêm timer frontend không làm DB tự đổi trạng thái.

1. Xác minh scheduler/trigger/worker đang chuyển `BITE` trong production và quyền SELECT trên session. Nếu giữ cơ chế đó, timer tới hạn chỉ GET session/challenge của chính lượt hiện tại; nếu vẫn chờ thì retry có giới hạn tới deadline, có đường báo lỗi/thử lại, không GET dồn liên tục. Dùng `bite_at`/thời gian server được trả rõ ràng để tránh tính sai từ đồng hồ client hoặc thời điểm response tới.
2. Phương án bỏ phụ thuộc scheduler: RPC activate xác minh owner, khu/phiên, thời gian server, expiry và trạng thái; chuyển sang `BITE` nguyên tử, idempotent theo session. Đây là mutation qua RPC, không phải GET. Không bắt đầu tính thời gian người chơi giữ nút trước hành động thật; giữ luật hiện tại của `start_tension_challenge`.
3. Timer và response phải gắn session/user hiện hành, hủy khi thu mồi/ra khu/đổi user; khi focus/online phải đối soát phiên. Kiểm thử mạng chậm, chạm hạn, tab ngủ, retry, session hết hạn và submit trùng trước khi gỡ publication.

**Phiên đăng nhập:** GET 15–30 giây chỉ phù hợp nếu chấp nhận phát hiện thiết bị khác trễ. Giữ BroadcastChannel cho cùng trình duyệt; đối soát lúc focus và kiểm tra server trước thao tác quan trọng. Nếu yêu cầu cảnh báo gần tức thời giữa thiết bị thì nên giữ listener `active_sessions` theo user: bảng này thay đổi theo lần đăng nhập, không theo tick câu. Cần sửa các truy vấn hiện nằm trong composable về repository khi triển khai thay thế.

### 9.4. Quy tắc tải lại để thực sự giảm tải

- Pinia quản lý cache theo user/phạm vi, thời điểm fetch, trạng thái đang chạy; repository thực hiện SELECT/RPC. Một tác vụ refresh chung cho cùng snapshot, nhiều nơi gọi dùng chung request đang chạy và tối đa một lượt đối soát bù. Request ID chỉ bỏ response cũ, không ngăn query đã gửi.
- Refresh sau mutation chỉ khi server xác nhận thành công. Nếu mutation thành công nhưng GET lỗi, giữ kết quả thao tác, báo dữ liệu cần tải lại và cho retry GET; không tự gửi lại mutation không có bảo vệ trùng.
- Focus/online chỉ làm mới phần dữ liệu cần dùng đã hết TTL; gộp `focus`, `visibilitychange`, `online` để tránh burst. Dừng polling thông thường lúc tab ẩn/offline, đóng panel hoặc đổi user; focus phải đối soát các luồng quan trọng trước khi tiếp tục thao tác. Tab ẩn không thể dựa vào timer để bảo đảm single-session.
- Lệch ngẫu nhiên thời điểm polling giữa client, tăng khoảng chờ khi lỗi, không chồng request. Các khoảng 10–60 giây ở bảng là lịch cho từng snapshot/màn hình, không phải tạo 14 timer độc lập. Hiển thị thời điểm cập nhật/nút làm mới ở nơi dữ liệu cũ ảnh hưởng quyết định người dùng; dùng i18n hiện có khi triển khai UI.
- Tách snapshot listing, history, badge, đội và số dư theo nhu cầu. `loadData()` đội hiện có nhiều query phụ; `fetchNotifications()` hiện có ba SELECT, chưa phải một request badge nhẹ. Tối ưu endpoint/phân trang trước khi polling thường xuyên, chỉ đọc trường cần thiết.
- Với `V` người xem, `q` query/lần và chu kỳ `T` giây, tải đọc nền xấp xỉ `V × q / T` request/giây, chưa tính lần mở màn hình/focus/mutation. Ví dụ 1.000 người dùng một snapshot một query mỗi 30 giây tạo khoảng 33,3 request/giây; gọi hàm notification hiện tại mỗi 60 giây cho 1.000 người tạo khoảng 50 request/giây. Bỏ Realtime không mặc nhiên giảm CPU DB nếu thay bằng nhiều GET không cần thiết.

Supabase mô tả chi phí Postgres Changes tăng theo số subscriber cần kiểm quyền, cùng xử lý thay đổi theo thứ tự trên một luồng. Đó là lý do ưu tiên bỏ fan-out chợ/khu/đội; không đủ để khẳng định polling luôn nhanh hơn. Nguồn đối chiếu: [Scaling Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes#scaling-postgres-changes).

### 9.5. Theo dõi triển khai

| Hạng mục | Trạng thái ngày 13/11/2026 | Điều kiện hoàn tất |
| --- | --- | --- |
| Đánh giá 16 bảng và cơ chế thay thế | Đã hoàn thành trong tài liệu | Đã đối chiếu call site, store, repository và SQL có trong repo; chưa xác minh cấu hình production |
| Bỏ listener chợ, lịch sử, feedback, đọc thông báo | Đã triển khai client | Chợ phân trang server 25 listing/trang; tải đúng tab; feedback giữ phân trang; thông báo cập nhật state sau đánh dấu đọc |
| Bỏ listener profile, mở khóa nước, currency | Đã triển khai client | Làm mới sau các RPC được liệt kê trong mutationRefresh; đối soát thay đổi bên ngoài bằng snapshot. Nguồn ghi/trigger chỉ có trên production vẫn cần kiểm thử thực tế |
| Bỏ listener flags và thông báo mới | Đã triển khai client | Flags giữ TTL 30 giây; badge/modal dùng chung một lịch 60 giây. Repo đã có migration gate phía server, chưa xác minh trạng thái deploy của gate |
| Bỏ listener đội và trạng thái khu | Đã triển khai client | Tách directory khỏi membership; GET khu theo owner; đối soát lúc hiển thị. Cần smoke test nhiều tài khoản với RLS production |
| Chuyển monitor admin sang snapshot | Đã triển khai client | Bỏ toàn bộ subscription monitor, chỉ tải báo cáo đang xem mỗi 30 giây; dashboard hiển thị chế độ snapshot |
| Thay `fishing_sessions` và `active_sessions` | Tạm giữ; chưa triển khai thay thế | Hoàn thành điều kiện 9.3; không dùng GET để thực hiện chuyển trạng thái |
| Tắt publication từng bảng | Đã chuẩn bị migration; chưa áp dụng DB | Deploy client trước, rà soát consumer ngoài repo/client cũ, chụp danh sách publication để rollback; chạy migration mới sau các migration cũ có ADD TABLE |
| Kiểm tra cập nhật code | Build, i18n và kiểm thử refresh đã qua | Chi tiết và giới hạn xác minh tại mục 10.3 |

Thứ tự đề xuất: chợ/feedback → profile/currency/mở khóa → thông báo/flags → đội/khu và monitor → hai luồng đặc biệt. Sau mỗi nhóm, đo số subscription, message, HTTP request, lỗi và p95 bằng cùng kịch bản trước/sau. Chưa thể khẳng định tăng được bao nhiêu CCU chỉ từ việc bỏ listener.

## 10. Kết quả triển khai snapshot/refresh — 13/11/2026

### 10.1. Hành vi đã cập nhật

14 bảng ở mục 9.2 đã hết consumer Postgres Changes trong `src`. Trong danh sách 16 bảng ban đầu chỉ còn hai consumer cần giữ. Realtime `zones` nằm ngoài phạm vi yêu cầu và được giữ nguyên; Supabase Auth và BroadcastChannel cùng trình duyệt không thay đổi.

| Snapshot | Thời điểm đọc và chu kỳ đối soát khi tab hiển thị |
| --- | --- |
| Trạng thái khu của mình | Khởi tạo, sau RPC vào/ra/kết thúc chuyến và mỗi 15 giây. Chỉ SELECT theo user; route guard vẫn kiểm tra DB khi điều hướng |
| Ví và hồ sơ | Khởi tạo, sau RPC có ảnh hưởng và mỗi 60 giây; ví dùng một SELECT `cash,shells,tickets`, thay cho RPC tiền cộng SELECT vé riêng trong store |
| Quốc gia đã mở khóa | Mở/hiện bản đồ, sau RPC thưởng/tiến trình và mỗi 60 giây khi bản đồ có hiển thị lớp mở khóa |
| Feature flags | Một lịch 30 giây dùng TTL hiện có, cộng kiểm tra tại feature gate; không có subscription song song |
| Chợ | Mở chợ, chuyển tab/trang/filter, làm mới thủ công, sau mua/hủy/đăng bán; đối soát 30 giây chỉ tải tab đang xem. History giữ 20 dòng/trang |
| Thông báo | Badge và modal dùng chung một lịch 60 giây tại sảnh; mở modal tải mới, đánh dấu đọc cập nhật Pinia rồi đối soát. Timer cục bộ loại thông báo hệ thống hết hạn mà không chờ event DB |
| Lịch sử báo lỗi | Mở panel, đổi trang, sau gửi, refresh thủ công và đối soát 60 giây khi panel còn mở |
| Đội | Membership và lời mời khoảng 30 giây tại sảnh, 15 giây khi panel đội mở. Directory đội chỉ tải ở panel, tối đa theo lịch khoảng 30 giây, hoặc sau thao tác/làm mới; không tải toàn bộ directory tại sảnh |
| Monitor admin | Khởi tạo/chuyển báo cáo/làm mới và mỗi 30 giây; chỉ tải báo cáo đang xem |

Các lịch trên dùng [visibleRefresh.ts](src/utils/visibleRefresh.ts): dừng khi tab ẩn/offline, gộp focus/visibility/online khi hết chu kỳ, lệch ngẫu nhiên tối đa 15% để giảm đồng loạt và tăng thời gian chờ khi lỗi. Các chu kỳ là gần đúng; trình duyệt/mạng có thể làm dữ liệu trễ hơn. Không tự gửi lại mutation khi GET đối soát lỗi.

[refreshTask.ts](src/utils/refreshTask.ts) gộp các lần đọc cùng snapshot theo user/phiên/trang; mutation xảy ra khi đang đọc sẽ yêu cầu một lượt đọc bù được gộp. Dữ liệu trả về được áp dụng với kiểm tra thế hệ đăng nhập/request hiện hành để tránh response cũ ghi vào user hoặc trang mới. [playerRefresh.ts](src/stores/playerRefresh.ts) điều phối các store; toàn bộ query mới vẫn nằm trong repository.

[mutationRefresh.ts](src/database/mutationRefresh.ts) mở rộng tầng fetch chung hiện có bằng danh sách RPC ảnh hưởng tới ví/profile/quốc gia/khu. Chỉ đánh dấu cần đối soát sau HTTP thành công và kết quả không có `success: false`; giữ nguyên response cho nơi gọi. Handler được cài sau Pinia trong `main.ts`, chụp user/thế hệ đăng nhập trước request. Lỗi GET chỉ được ghi vào store, không biến mutation đã commit thành thao tác thất bại. Khi thêm RPC thưởng/chi phí/tiến trình mới, phải cập nhật danh sách này hoặc áp dụng response đầy đủ vào store.

Listing chợ dùng `.range()` lấy 25 dòng cộng một dòng kiểm tra trang tiếp, filter tên/rarity/owner và sort ở server, thứ tự ổn định với `created_at`/`id`. Fallback quan hệ cũ cũng được giới hạn trang; khi tìm theo loài mà quan hệ query bị lỗi thì hiển thị lỗi, không lọc một trang không khớp rồi báo thiếu kết quả. Chế độ nhóm loài gom các listing trong trang đang xem. Bỏ badge tổng listing trên tab để không nhầm 25 dòng của trang là tổng toàn chợ. Sau lỗi mua do listing cũ, tải lại snapshot; tính đúng giao dịch vẫn do RPC server quyết định.

### 10.2. Áp dụng publication trên Supabase

Migration đã chuẩn bị: [20261113_remove_optional_realtime.sql](scripts/supabase/migrations/20261113_remove_optional_realtime.sql). Migration chỉ gỡ đúng 14 bảng, kiểm tra tồn tại trước khi gỡ, giữ hai bảng đặc biệt và các bảng ngoài phạm vi. Dừng với lỗi rõ ràng nếu publication đang ở chế độ `FOR ALL TABLES`.

Chưa chạy SQL này trên database. Trình tự rollout:

1. Lưu danh sách bảng publication hiện tại để rollback; kiểm tra các consumer khác và client cũ.
2. Deploy client snapshot/refresh. Smoke test câu/thưởng, tiền, mời/kick/đóng đội, vào/ra khu, mua cùng listing, badge/đánh dấu đọc, bảo trì và admin monitor bằng JWT người dùng thật.
3. Chạy migration mới **sau** các migration cũ có `ADD TABLE` (`player_feature_completion.sql`, `user_profile_progress_realtime.sql`, `world_map_unlock_realtime.sql`, `20261112_feature_flags.sql`). Không sửa lịch sử migration cũ; không replay chúng sau migration gỡ publication mà thiếu bước đối soát.
4. Xác minh publication và thống kê Realtime/HTTP/DB trước–sau. Nếu quay về client cũ, ADD TABLE lại đúng các bảng trong snapshot trước triển khai trước khi rollback frontend.

### 10.3. Kiểm tra và giới hạn

- `npm run build`: qua TypeScript và Vite; vẫn có cảnh báo vendor 616,49 kB vượt ngưỡng 600 kB đã tồn tại trước thay đổi.
- `npm run check:i18n`: qua kiểm tra 1.697 bản dịch mỗi ngôn ngữ và kiểm tra runtime Việt/Anh; UI mới tái sử dụng các key hiện có.
- `npm run test:data-refresh` (Node 24 trong môi trường này): 12 kiểm thử đạt, gồm gộp request/đọc bù, phục hồi sau lỗi, khác user/phiên, điều kiện mutation thành công, pause/resume/backoff/cleanup, phân trang/filter/sort chợ trước khi lấy trang, đổi trang 1 → 2 → 1 và response hồ sơ tới muộn sau đổi tài khoản.
- Kiểm thử repository dùng transport giả, kiểm thử store dùng Pinia thật qua Vite SSR; không gửi request tới Supabase. Chưa kiểm thử SQL migration, RLS/trigger production, UI với tài khoản thật hoặc tải CCU. Endpoint notification hiện vẫn đọc ba tập dữ liệu, directory đội vẫn chưa phân trang; đây là các việc P0-B/P1 tiếp theo, không coi việc bỏ Realtime đã giải quyết chúng.
