# Theo dõi tối ưu hiệu năng

Cập nhật: **13/11/2026**. Đối chiếu mã nguồn hiện tại; trạng thái SQL/deploy trên Supabase chưa được xác minh. Chưa benchmark tải thực tế nên chưa chốt CCU hoặc tỷ lệ cải thiện.

## 1. Realtime và refresh đã triển khai

Đã bỏ listener phía client của 14 bảng: `currency`, `error_feedback`, `feature_flags`, `market_history`, `personal_notifications`, `player_unlocked_countries`, `species_market`, `system_notification_reads`, `system_notifications`, `user_in_area`, `user_profile`, `user_team_invite`, `user_team_members`, `user_teams`.

Giữ `fishing_sessions` để nhận trạng thái cá cắn và `active_sessions` để phát hiện phiên bị thay thế. Listener `zones` nằm ngoài phạm vi và vẫn giữ.

| Dữ liệu | Cơ chế hiện tại | Chu kỳ đối soát |
| --- | --- | --- |
| Trạng thái khu của mình | Snapshot theo user, sau vào/ra khu; route guard kiểm tra DB | 15 giây |
| Ví, profile | Khởi tạo và sau RPC có ảnh hưởng | 60 giây |
| Quốc gia mở khóa | Khi bản đồ hiển thị, sau thưởng/tiến trình | 60 giây |
| Feature flags | Pinia TTL + feature gate, một lịch polling | 30 giây |
| Chợ | Khi mở/đổi tab, trang, filter; sau giao dịch | 30 giây khi mở |
| Thông báo | Badge/modal dùng chung snapshot; đánh dấu đọc cập nhật state; timer loại thông báo hết hạn | 60 giây tại sảnh |
| Lịch sử báo lỗi | Mở panel, đổi trang, sau gửi và làm mới | 60 giây khi mở |
| Đội, thành viên, lời mời | Snapshot chung; directory chỉ tải khi mở panel | 30 giây tại sảnh, 15 giây trong panel; directory khoảng 30 giây |
| Monitor admin | Chỉ tải báo cáo đang xem | 30 giây |

Các lịch dùng [visibleRefresh.ts](src/utils/visibleRefresh.ts): dừng khi tab ẩn/offline, đối soát khi quay lại, jitter tối đa 15% và backoff khi lỗi. Chu kỳ polling khác TTL cache; lần đọc vẫn có thể dùng cache còn hạn.

Đã có single-flight/đọc bù, chặn response cũ khi đổi user hoặc trang, refresh sau mutation và không tự retry mutation. Chợ đã phân trang server **25 listing/trang**, history **20 dòng/trang**, filter/sort phía server.

Mã chính: [playerRefresh.ts](src/stores/playerRefresh.ts), [mutationRefresh.ts](src/database/mutationRefresh.ts), [refreshTask.ts](src/utils/refreshTask.ts).

## 2. Cache đã áp dụng

### Catalog: Pinia + IndexedDB

Policy: [gameCachePolicies.ts](src/data/gameCachePolicies.ts). TTL và tuổi tối đa đều tính từ lần fetch thành công, không gia hạn khi đọc.

| Domain | TTL | Tuổi tối đa cho stale khi lỗi tạm thời |
| --- | --- | --- |
| `countries`, `areas`, `species` | 6 giờ | 7 ngày |
| `guides` | 24 giờ | 7 ngày |
| `shop`, `items`, `blueprints` | 15 phút | 24 giờ, chỉ xem |
| `skills`, `aquaculture` | 30 phút | 24 giờ, chỉ xem |
| `rates` | 5 phút | Không dùng stale |

Đã nối vào các store/màn hình tương ứng. Đã gỡ `country_values`/`mapColors`; không cần tạo bảng thay thế.

### Snapshot cá nhân: Pinia/RAM

Policy và whitelist endpoint: [readCachePolicies.ts](src/data/readCachePolicies.ts). **Không lưu IndexedDB, không trả stale sau TTL.**

| Nhóm | TTL |
| --- | --- |
| Kho cá (`get_caught_in_home`, `caught`), túi đồ, danh sách bộ trang bị | 30 giây |
| Ví hiển thị (`currency`, `get_my_currency`) | 10 giây |
| Profile, kỹ năng đã học, bạn bè | 30 giây |
| Nhật ký đã sở hữu, quốc gia mở khóa | 60 giây |
| Thông báo, đội/thành viên/lời mời | 15 giây |
| Listing chợ / lịch sử giao dịch | 5 / 15 giây |
| Nhiệm vụ, phần thưởng và trạng thái user của Fishing Pass | 30 giây; đổi key khi sang giờ mới |
| Huy hiệu, trạng thái/hiệu ứng/điểm hoạt động phe | 30 giây |
| Leaderboard, lịch sử báo lỗi, hồ sơ nuôi cá | 30 giây |
| Danh sách thưởng vòng quay | 60 giây |

Thông báo có thêm cache snapshot mức store để timestamp trong query không gây cache miss mỗi lần mở; vẫn loại thông báo hết hạn theo thời gian hiện tại.

### Catalog bổ sung: Pinia + IndexedDB

Các nhóm này dùng [readCachePolicies.ts](src/data/readCachePolicies.ts), **không fallback stale và chưa có revision guard SQL**.

| Nhóm | TTL |
| --- | --- |
| Tutorial (`tutorials`) | 6 giờ |
| Sự kiện/lịch (`event`, `event_schedule`) | 60 giây |
| Preview thưởng điểm danh (`daily_rewards`) | 1 giờ |
| Danh mục phe/hiệu ứng (`factions`, join `faction_effects`) | 1 giờ |

### Quy tắc dùng chung

- Cùng key dùng chung promise; key phân biệt user, Supabase project, query/projection, RPC arguments, phân trang và header ảnh hưởng kết quả.
- Reload dùng IndexedDB còn hạn; snapshot cá nhân RAM phải tải lại. Storage lỗi thì dùng RAM + network. Ngân sách IndexedDB: khoảng 10 MB/200 entry.
- Timeout đọc 10 giây; backoff 15/30/60/120 giây cộng jitter, tôn trọng `Retry-After`. Lỗi quyền/feature/schema không bị stale che.
- Mutation thành công hoặc kết quả ghi không chắc chắn sẽ bỏ snapshot cá nhân; sửa catalog bỏ cache domain/dependency. Invalidation khi đang đọc loại response cũ và gộp lượt đọc bù.
- BroadcastChannel đồng bộ invalidation giữa tab; promise chỉ gộp trong từng tab. Không thêm Supabase subscription.
- Đổi user/logout xóa cache/state cá nhân và chặn response phiên cũ; refresh token cùng user giữ cache. Không persist token hoặc challenge.
- Feature gate vẫn chạy trước cache hit. Admin đọc mới; kiểm tra quyền admin và ví trước chế tạo lấy mới. Nút Làm mới/cờ force bỏ cache theo luồng tương ứng.
- Cache phục vụ hiển thị; RPC/server quyết định quyền, giá, tài nguyên và kết quả giao dịch.

Mã chính: [gameCatalog.ts](src/stores/gameCatalog.ts), [readCache.ts](src/stores/readCache.ts), [gameCache.ts](src/utils/gameCache.ts), [indexedDbCacheRepository.ts](src/data/indexedDbCacheRepository.ts), [readCacheRequests.ts](src/database/readCacheRequests.ts), [playerSnapshotReset.ts](src/stores/playerSnapshotReset.ts).

### Những dữ liệu vẫn lấy mới có chủ đích

- Phiên đăng nhập/câu, trạng thái khu, `get_user_status`, bộ trang bị đang dùng (`get_user_equipment_set_using`).
- Cá/nhật ký theo khu, preview cá theo độ sâu, môi trường/thời tiết.
- `get_aquaculture_farm`: có thể lock/chốt batch; giữ adaptive polling hiện có, không coi là GET chỉ đọc.
- Query chọn Fishing Pass đang hiệu lực theo thời điểm hiện tại; các phần thưởng/trạng thái user đi kèm mới được cache ngắn.
- `user_flag`/trạng thái điểm danh, preferences, Auth, Storage/signed URL chưa thuộc whitelist. Feature flags chỉ dùng Pinia TTL 30 giây.

## 3. SQL và chế độ revision

| Migration đã có trong repo | Mục đích |
| --- | --- |
| [20261113_remove_optional_realtime.sql](scripts/supabase/migrations/20261113_remove_optional_realtime.sql) | Gỡ 14 bảng khỏi publication, giữ hai bảng đặc biệt và bảng ngoài phạm vi |
| [20261113_game_catalog_cache.sql](scripts/supabase/migrations/20261113_game_catalog_cache.sql) | Manifest/snapshot revision và wrapper kiểm tra phiên bản trước mutation |

`VITE_GAME_CATALOG_VERSIONED=true` **lúc build** bật manifest TTL 5 phút, snapshot nhất quán và guard revision cho `purchase_item`, `craft_blueprint`, `upgrade_skill`, `convert_currency`, `stock_aquaculture_batch`, `feed_aquaculture_batch`. Chỉ bật sau khi DB đã có migration và các prerequisite phù hợp.

Khi nhận `CATALOG_VERSION_MISMATCH`: invalidate domain/dependency → tải mới → yêu cầu người dùng thử lại; không tự gửi lại mutation. Ao giữ ưu tiên receipt cho request đã commit. Chế độ legacy dùng API cũ, làm mới trước thao tác nhưng không có guard revision nguyên tử.

## 4. Xác minh và quan sát

Kết quả kiểm tra gần nhất của phần triển khai: build TypeScript/Vite, i18n Việt/Anh, **27 test catalog/cache**, **19 test read-cache**, **13 test refresh**, browser test **Edge + IndexedDB thật** đều qua. Build còn cảnh báo vendor khoảng 616,49 kB. Test dùng transport/fixture cục bộ, không xác nhận DB production.

Các lệnh: `npm run build`, `npm run check:i18n`, `npm run test:game-cache`, `npm run test:read-cache`, `npm run test:data-refresh`, `npm run test:game-cache:browser`.

Trong dev, mở lại cùng modal trong TTL, không làm mới hoặc mutation giữa hai lần; xem Console:

```js
console.table(window.gameCatalogCache.inspect().counts)
console.table(window.gameReadCache.inspect().counts)
```

`ramHit`/`indexedDbHit`: dùng cache; `joined`: gộp request; `network`: lượt loader chạy. Có thể xem thêm `.recent`; catalog có `.entries` để xem TTL/revision. API chỉ có ở dev, không log payload/token. `network` không tương đương tổng HTTP: legacy catalog phân trang và snapshot thông báo có nhiều request con.

Kho cá mở lại trong 30 giây phải dùng RAM nếu chưa invalidation; reload sẽ tải mới. Catalog persist còn TTL có thể dùng IndexedDB. Đối chiếu Network theo endpoint `/rest/v1/`; flags, polling đến hạn, manifest và các ngoại lệ vẫn tạo request.

## 5. Chưa làm / cần xác minh tiếp

| Ưu tiên | Công việc còn lại |
| --- | --- |
| P0 | Xác minh hai migration đã áp dụng trên Supabase, prerequisite/signature RPC, grants/RLS/trigger và cấu hình versioned trong bản build đang chạy. Deploy client snapshot trước khi gỡ publication; rà consumer/client cũ và lưu danh sách publication để rollback. |
| P0 | Smoke test staging bằng nhiều tài khoản/JWT thật: đổi user, mua cùng listing, thưởng/tiền, đội/khu, thông báo, bảo trì; kiểm tra mismatch trước side effect, receipt và lock khi cập nhật catalog đồng thời. |
| P0 | Thay `fishing.fetchPlayersInArea()` tải toàn bộ cá để đếm bằng RPC/summary có phân trang; chuyển query Supabase trực tiếp trong store về repository. |
| P0 | Phân trang server cho directory đội, các luồng kho cá/nhật ký/thông báo còn tải toàn bộ; giảm số query thông báo; đánh giá chi phí exact rank leaderboard. Cache chưa giải quyết kích thước payload. |
| P0 | Xác minh scheduler/trigger/worker chuyển `BITE`; profile `cast_rod`/replay/submit, index/RLS/query plan và contention với dữ liệu đại diện. |
| P0 | Đo request, byte, p95/p99, CPU/I/O/lock, Realtime và cache hit trước–sau. Load test staging tăng dần 20 → 50 → 100 → 150 → 300… kèm soak/burst, reconnect và admin monitor; chỉ chốt CCU từ kết quả đo. |
| P1 | Đối chiếu mọi RPC/trigger production làm đổi tiền/tiến trình với danh sách refresh; bổ sung khi thêm mutation mới. |
| P1 | Kiểm tra Firefox/Safari, storage eviction/quota trên thiết bị thật; điều chỉnh TTL bằng số đo. Chưa có telemetry production hoặc khóa fetch giữa các tab. |
| P1 | Thiết lập retention/dọn batch cho session, mechanics, receipt/history; đo autovacuum, WAL và replication lag. |
| P1 | Đo lock/payload farm trước khi tách read/write; bổ sung giới hạn RPC chống burst/abuse theo số đo và luật chơi. |
| P1 | Đo byte tải đầu, tối ưu ảnh/audio/CDN/compression và bundle theo Network; chưa tối ưu cảnh báo vendor. |
| P2 | Chỉ thay hai listener còn giữ khi có cơ chế thay thế đã kiểm thử: `BITE` nguyên tử phía server, kiểm tra phiên hiện hành trong mutation. |
| P2 | Chưa có cache dùng chung giữa người chơi, Redis, worker replay hoặc nâng compute. Chỉ triển khai khi benchmark xác định nút thắt và nhu cầu. |
