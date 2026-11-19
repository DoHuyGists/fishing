# Checklist hoàn thiện dự án

Ngày rà soát: 19/11/2026. Phạm vi: mã Vue/Pinia, repository, SQL, tài liệu triển khai và các bài kiểm tra trong repo.

Đây là danh sách công việc cần làm, chưa phải các thay đổi đã triển khai. Đã kiểm tra cục bộ; chưa kết nối database, Storage, Auth email hay Edge Functions đang chạy. Những nhận định phụ thuộc schema/RLS/trigger live được ghi rõ để đối chiếu trên môi trường thử nghiệm.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd run build` | Đạt: `vue-tsc -b` và Vite production build |
| `npm.cmd run check:i18n` | Đạt: 2.086 khóa mỗi ngôn ngữ, kiểm tra tham chiếu trong 528 file nguồn |
| 24 file kiểm tra Node/SQL, chạy riêng từng file | 12 đạt, 12 lỗi; cả 12 file lỗi đều gặp đường dẫn store cũ không còn tồn tại |
| Thử phản hồi huy hiệu đến sau khi đổi tài khoản | Tái hiện: đã chuyển A → B và reset store, phản hồi A vẫn ghi vào danh sách huy hiệu |
| Kiểm tra `claim_daily_mission_reward` qua các bộ xử lý request hiện tại | Không nhận diện feature (`[]`); không đăng ký refresh snapshot (`0` lần) |
| Kiểm tra trình duyệt và dịch vụ Supabase thực tế | Chưa chạy; không suy diễn trạng thái production từ kết quả build |

Các file đạt: `test-body-equipment-sql.mjs`, `test-catalog-sql.mjs`, `test-data-refresh.mjs`, `test-depth-preview.mjs`, `test-dispatch-sql.mjs`, `test-game-cache.mjs`, `test-grant-inventory-item.mjs`, `test-jwt-clock-skew.mjs`, `test-list-pagination.mjs`, `test-seasonal-fishing.mjs`, `test-single-session.mjs`, `validate-player-feature-sql.mjs` trong `scripts/`.

Các file lỗi: `test-cancel-fishing-session.mjs`, `test-day-phase.mjs`, `test-dispatch-store.mjs`, `test-fishing-map.mjs`, `test-fishing-net-capacity.mjs`, `test-fishing-result-recovery.mjs`, `test-game-catalog.mjs`, `test-health-equipment.mjs`, `test-leaderboard.mjs`, `test-read-cache.mjs`, `test-refresh-stores.mjs`, `test-story.mjs` trong `scripts/`.

Cách chạy lại nhóm kiểm tra trên bằng PowerShell, từ thư mục gốc dự án:

```powershell
$auditFiles = Get-ChildItem scripts -Filter 'test-*.mjs' | Where-Object { $_.Name -notmatch 'browser' }
$auditFiles += Get-Item scripts/validate-player-feature-sql.mjs
foreach ($auditFile in $auditFiles) {
  node --test --test-isolation=none $auditFile.FullName
}
```

## Danh sách ưu tiên

P1: cần xử lý trước đợt phát hành có module liên quan. P2: hoàn thiện tính đúng đắn, khả năng phục hồi hoặc kiểm chứng tích hợp. P3: cải thiện cấu trúc và khả năng bảo trì.

| ID | Ưu tiên | Module | Khoảng trống chính |
| --- | --- | --- | --- |
| IC-01 | P1 | Gacha / nguồn cấp trang bị | Payload thưởng còn dùng chỉ số cũ; thiếu phục hồi lượt quay mất phản hồi |
| IC-02 | P1 | Kết thúc chuyến câu | Xóa cá và hoàn thành chuyến câu là hai giao dịch |
| IC-03 | P1 | Chuyển cá kho ↔ lưới | Chuyển từng cá song song, có thể thành công một phần |
| IC-04 | P1 | Nhiệm vụ ngày | Thiếu đăng ký chặn bảo trì và refresh ví/hồ sơ sau nhận thưởng |
| IC-05 | P1 | Session / dữ liệu người chơi | Một số phản hồi cũ vẫn cập nhật store sau khi đổi tài khoản |
| IC-06 | P1 | Tổ đội | Tạo nhóm nhiều bước; chọn nhóm vừa tạo chưa gắn rõ người gọi |
| IC-07 | P1 | PayPal donation | Thiếu source Edge Functions mà README yêu cầu triển khai |
| IC-08 | P1 | Kiểm thử hồi quy | Đã sửa đường dẫn test và mock; còn lệnh tổng hợp và tích hợp CI |
| IC-09 | P1 | Database / triển khai | Chưa đủ baseline và quy trình thống nhất để dựng môi trường mới |
| IC-10 | Đã sửa | Kho đồ / chế tạo / trang bị | Tải đủ trang inventory, bảo vệ owner và thứ tự request; đã kiểm thử |
| IC-11 | P2 | Kho cá / thả cá | Xóa trực tiếp; tải lỗi chỉ ghi console, chưa có trạng thái lỗi UI |
| IC-12 | P2 | Người chơi cùng bãi | Cấp độ, danh tính và thống kê còn được suy dựng ở client |
| IC-13 | P2 | Phe phái | Đếm thành viên từ danh sách chưa phân trang; lỗi thành dữ liệu rỗng |
| IC-14 | P2 | Sự kiện | Tăng lượt xem từ số cũ; trạng thái thời gian không tự cập nhật |
| IC-15 | P2 | Nuôi cá | Còn điều kiện tích hợp live và dữ liệu cân bằng cần chốt |
| IC-16 | P2 | Story admin / media | Danh sách bị chặn ở 1.000 bản ghi, chưa có tải trang tiếp |
| IC-17 | Đã sửa | Modal dùng chung | Chờ callback, tách loading/cooldown, xử lý lỗi và dọn timer |
| IC-18 | P3 — đã refactor nhóm module | Kiến trúc / i18n / types | Đã tách đổi mã, sự kiện, query cùng bãi, kho cá, pass admin và các UI lớn; tiếp tục rà theo module |
| IC-19 | P3 — đã đồng bộ nhóm module | Tài liệu / mã cũ | Đã sửa README/runbook và xóa mock/backup không dùng; đồng bộ tiếp khi thay đổi module |

## Các bước sửa và nghiệm thu

### IC-01 — Gacha và hợp đồng vật phẩm trang bị

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `scripts/supabase/rpc/spining-wheel/spin-wheel.sql:109` dựng payload riêng với `rodMaxWeight`, `strength`, `match_number`; không giữ `items.data`, `classification`, `rpc` hoặc quy tắc `storage_type` như luồng mua/cấp đồ. Trong khi đó `scripts/supabase/rpc/fishing/cast_rod.sql:152` yêu cầu `max_weight`, `pull_strength`, `durability`, `catch_rate` và `fish_type`. Theo source hiện tại, trang bị từ quay thưởng không đáp ứng cùng hợp đồng với cơ chế câu mới.
- **Bước 1:** Chuẩn hóa payload từ catalog cho mọi nguồn cấp đồ; dùng lại quy tắc trong `grant_inventory_item.sql` khi phù hợp, giữ quyền helper ở phía database. Nếu cần roll chỉ số, roll trên đúng trường mới và có miền giá trị rõ ràng.
- **Bước 2:** Giữ metadata, RPC sử dụng item, số lượng mỗi gói và cơ chế cộng stack. Rà soát vật phẩm đã cấp bằng schema cũ, tạo migration chuyển đổi có chủ đích; không tự quy đổi `strength` sang tỷ lệ móc.
- **Bước 3:** Bổ sung request ID/biên nhận cho lượt quay. RPC hiện không nhận ID nên bấm quay lại sau mất phản hồi là một lần trừ vé mới; cần phục hồi kết quả cũ trước khi cho tạo lượt khác.
- **Nghiệm thu:** Quay được đủ năm loại trang bị rồi trang bị/câu thành công; item dùng được đúng RPC; stack đúng; mất phản hồi sau commit và retry cùng request không trừ vé hoặc cấp thưởng hai lần. Đối chiếu thêm trigger cấp đồ đang chạy trên staging.

### IC-02 — Kết thúc chuyến câu phải cùng thành công hoặc hoàn tác

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/stores/player-caught-store.ts:63` gọi `deleteInNetFishes()`, xóa cá khỏi state rồi mới gọi `completeFishing()`. `release_in_net_fishes.sql` thực sự DELETE cá; nếu bước sau lỗi, bước xóa đã commit.
- **Bước 1:** Bổ sung hoặc mở rộng một RPC kết thúc chuyến câu để kiểm tra người gọi, trạng thái phiên, xử lý cá trong lưới và hoàn tất chuyến câu trong cùng transaction.
- **Bước 2:** Chỉ cập nhật store sau kết quả xác nhận; giữ định danh thao tác để đối soát khi timeout, tránh hoàn tất/nhận thưởng lặp.
- **Bước 3:** Đồng bộ membership bãi, kho cá, tiền và hồ sơ qua repository/store và cơ chế refresh hiện có.
- **Nghiệm thu:** Ép lỗi sau bước xử lý cá phải rollback toàn bộ; hai yêu cầu đồng thời hoặc retry sau commit chỉ hoàn thành một lần; không còn trạng thái đã mất cá nhưng chuyến câu vẫn chưa kết thúc.

### IC-03 — Chuyển nhiều cá giữa kho và lưới

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/data/supabaseFishRepository.ts:122` dùng `Promise.all` gọi `move_species` từng ID. `src/stores/player-caught-store.ts:53` chỉ cập nhật local state khi tất cả promise thành công; khi một request lỗi, cá đã chuyển ở server có thể vẫn hiển thị ở vị trí cũ.
- **Bước 1:** Tạo RPC nhận mảng ID và trạng thái đích; kiểm tra trùng ID, quyền sở hữu, trạng thái cá và sức chứa tổng trong cùng transaction.
- **Bước 2:** Khóa tài nguyên theo cùng thứ tự với các luồng thêm cá khác; trả snapshot hoặc danh sách kết quả đã xác nhận.
- **Bước 3:** Thay vòng gọi từng cá bằng một repository action; khi kết quả mạng không xác định, tải lại snapshot trước khi cho thao tác tiếp.
- **Nghiệm thu:** Chuyển sát giới hạn kho, ID sai, hai yêu cầu đồng thời và mất mạng không gây chuyển nửa nhóm hoặc vượt sức chứa.

### IC-04 — Nối đầy đủ luồng nhận thưởng nhiệm vụ ngày

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/data/supabaseMissionRepository.ts:8` gọi `claim_daily_mission_reward`, nhưng RPC này thiếu trong nhóm `mission` của `src/data/featureCatalog.json:158` và bảng mapping của `src/database/mutationRefresh.ts:10`. `src/stores/player-mission-store.ts:36` chỉ đánh dấu thưởng rồi tải lại nhiệm vụ. Đã kiểm tra cục bộ: request không được gắn feature và không đăng ký refresh ví/hồ sơ.
- **Bước 1:** Thêm RPC vào catalog frontend và request rules SQL tương ứng; đối chiếu quyền, RLS và kiểm tra phía server để bảo trì có hiệu lực cả khi gọi trực tiếp API.
- **Bước 2:** Đăng ký các snapshot thưởng thực sự tác động vào mutation refresh; kiểm tra inventory nếu phần thưởng gồm vật phẩm. Việc invalidate cache không tự cập nhật mọi state đang hiển thị.
- **Bước 3:** Thêm kiểm tra hồi quy cho nhận thưởng thành công, nhận lại, thiếu điểm, bảo trì và đổi tài khoản khi request chưa hoàn tất.
- **Nghiệm thu:** Nhận thưởng cập nhật ngay ví/hồ sơ liên quan; không nhận được qua API khi module bảo trì; retry không phát thưởng lặp. Chữ ký/nghiệp vụ RPC live cần kiểm chứng vì repo chưa có định nghĩa RPC này.

### IC-05 — Chặn phản hồi của phiên/tài khoản cũ

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/stores/player-badges-store.ts:19`, `player-fishing-pass-store.ts:29`, `player-faction-store.ts:104` ghi state sau `await` mà không đối chiếu owner/generation. Plugin tại `src/stores/player-snapshot-reset-store.ts:5` reset state nhưng không ngăn request cũ ghi lại. Đã tái hiện với huy hiệu. `player-spin-wheel-store.ts:49` còn ghi trực tiếp số vé từ phản hồi vào currency store; store `SpinWheel` và `userTurns` chưa nằm trong danh sách reset này.
- **Bước 1:** Áp dụng mẫu `userId + sessionGeneration + requestId` đã có ở các store khác cho cả success, catch và finally của các action liên quan.
- **Bước 2:** Bổ sung reset/cleanup cho state cá nhân còn thiếu; dừng timer/polling trước reset và không để callback cũ khởi động lại việc tải dữ liệu.
- **Bước 3:** Chỉ gọi refresh hoặc cập nhật store khác khi vẫn đúng owner/generation của thao tác ban đầu.
- **Nghiệm thu:** A tải dữ liệu/chạy action rồi đăng xuất, đăng nhập B, sau đó mới trả phản hồi A: state, lỗi, loading và ví của B không thay đổi. Kiểm tra cả đăng xuất rồi đăng nhập lại cùng ID với generation mới.

### IC-06 — Tạo, sửa và mời vào tổ đội

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/data/supabaseTeamRepository.ts:124` tạo nhóm qua RPC, truy vấn membership `role = LEADER` mới nhất rồi PATCH cấu hình. Truy vấn này không có điều kiện `user_id` hoặc ID trả về từ RPC; mức ảnh hưởng phụ thuộc RLS live. `updateTeam()` và `inviteUser()` vẫn ghi trực tiếp bảng.
- **Bước 1:** Cho RPC tạo nhóm nhận đầy đủ cấu hình hợp lệ và trả nhóm/ID vừa tạo trong cùng transaction; dùng `auth.uid()` ở server.
- **Bước 2:** Chuyển sửa nhóm và gửi lời mời qua RPC có kiểm tra quyền trưởng nhóm, giới hạn thành viên, trạng thái, lời mời trùng và điều kiện tham gia.
- **Bước 3:** Bỏ truy vấn suy ra nhóm vừa tạo; giữ lớp repository và cơ chế refresh/phân trang hiện có.
- **Nghiệm thu:** Hai trưởng nhóm tạo đồng thời không sửa nhầm nhóm; lỗi cấu hình không để lại nhóm tạo dở; không thể mời/sửa thay trưởng nhóm khác hoặc hạ sức chứa dưới số thành viên hiện có.

### IC-07 — Bổ sung backend PayPal còn thiếu trong repo

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/data/supabaseDonationRepository.ts:6` gọi `paypal-donation`. `scripts/supabase/README-paypal.md:7` yêu cầu source tại `supabase/functions/paypal-donation/index.ts`, `paypal-webhook/index.ts`, `_shared/paypal.ts`, nhưng cả các file này lẫn `supabase/config.toml` đều không tồn tại trong checkout.
- **Bước 1:** Khôi phục source backend tương ứng với hợp đồng frontend và SQL donation; nếu backend ở repo riêng, ghi rõ vị trí, phiên bản và quy trình lấy source/triển khai.
- **Bước 2:** Kiểm tra xác thực người dùng, số tiền/merchant/currency phía server, xác minh webhook và chống xử lý lặp; đối chiếu môi trường sandbox/live và giao dịch chờ.
- **Bước 3:** Bổ sung kiểm tra sandbox cho create/capture/status, mất phản hồi, webhook lặp, hoàn tiền và lỗi cấu hình.
- **Nghiệm thu:** Một checkout mới có thể triển khai đủ backend từ tài liệu và đối soát giao dịch sandbox. Việc thiếu source không chứng minh function đang triển khai đã ngừng hoạt động; cần kiểm tra trạng thái dịch vụ riêng.

### IC-08 — Khôi phục bộ kiểm thử sau đổi tên store

- [ ] **Hoàn thành module.**
- **Bằng chứng ban đầu:** 12 file lỗi ở bảng kết quả do dùng tên store trước refactor; browser fixtures cũng còn tham chiếu cũ.
- [x] **Bước 1:** Đã cập nhật 15 file test: đường dẫn đọc source, SSR imports, browser fixture imports và dependency-map keys khi transpile/mock theo tên store hiện tại. Đã kiểm tra 41 đường dẫn store trong các test đều tồn tại.
- **Kết quả sau sửa:** 25 file `test-*.mjs` không dùng browser và `validate-player-feature-sql.mjs` đều đạt (26/26). Ba script browser đã chỉnh (`test-admin-state-browser.mjs`, `test-game-cache-browser.mjs`, `test-story-browser.mjs`) chạy đạt trên Edge. Build đạt. Bảng kết quả kiểm toán ban đầu ở trên được giữ để đối chiếu lịch sử.
- **Bước 2:** Chạy lại từng nhóm, sửa các assertion đã lệch hợp đồng sau refactor; bổ sung các tình huống nghiệp vụ ở IC-01 đến IC-06 thay vì chỉ xác nhận cấu trúc source.
- **Bước 3:** Tạo lệnh tổng hợp trả exit code thất bại nếu bất kỳ nhóm nào lỗi; nối build, i18n và nhóm hồi quy vào CI. Tách kiểm tra browser cần executable để cách chạy rõ ràng.
- **Nghiệm thu:** Cả 24 file Node/SQL chạy hết nội dung; các script browser tải đúng module và chạy được trên môi trường đã cấu hình; CI phát hiện được import store không tồn tại.

### IC-09 — Làm rõ baseline và thứ tự triển khai database

- [ ] **Hoàn thành phần triển khai.**
- **Bằng chứng:** `scripts/supabase/README-player-features.md` yêu cầu các RPC/bảng đang có; repo chưa có đầy đủ DDL nền và định nghĩa các RPC như `craft_blueprint`, `move_species`, `user_complete_fishing`, `claim_daily_mission_reward`. SQL đang chia giữa migrations và các file RPC chạy bằng SQL Editor; không có cấu hình Supabase CLI ở gốc.
- **Bước 1:** Lập danh sách hợp đồng database từ repository: bảng, cột, nullable, enum, RPC, quyền gọi, RLS, trigger và publication. Đối chiếu schema staging trước khi sửa nghiệp vụ.
- **Bước 2:** Bổ sung baseline/migrations có version hoặc quy trình lấy baseline từ nguồn được quản lý; ghi rõ thứ tự áp dụng và các file chỉ chứa function body như `rpc/shop/purchase_item.sql`.
- **Bước 3:** Dựng database thử nghiệm mới từ baseline, chạy migrations và smoke test bằng tài khoản người chơi/admin; ghi rõ bước cấu hình Auth/Storage/Realtime ngoài SQL.
- **Nghiệm thu:** Người mới dựng được môi trường đủ chức năng theo một runbook, không phải suy đoán RPC/trigger đang có. Không áp migration lên production chỉ để kiểm chứng checklist.

### IC-10 — Tải đủ inventory cho chế tạo và tính trang bị

- [x] **Hoàn thành sửa snapshot inventory.**
- **Lỗi ban đầu:** `fetchUserInventory` tải một truy vấn không phân trang, khiến snapshot dùng tính số lượng, chỉ số và nguyên liệu chế tạo có thể bị cắt theo max rows của PostgREST.
- [x] **Bước 1:** Dùng `readCatalogPages` với thứ tự `id` ổn định, tăng offset theo số dòng thực nhận và chỉ dừng khi trang rỗng. Inventory không áp giới hạn 10.000 dòng của catalog; catalog khác vẫn giữ giới hạn hiện tại. Trang lỗi làm toàn bộ lần tải thất bại, không áp snapshot dở dang.
- [x] **Bước 2:** Giữ riêng `items` dùng tính toán và `viewItems` dùng hiển thị phân trang. Chỉ áp snapshot khi owner, session generation và request mới nhất còn khớp; kết quả cũ không ghi đè lần tải mới.
- [x] **Bước 3 — Đối chiếu:** Blueprint, item catalog, diary và country đã dùng helper tải đủ trang. Các danh sách lựa chọn admin như `supabaseSpeciesRepository.fetchAll` và `supabaseItemRepository.fetchAll` vẫn truy vấn một trang; đây là phạm vi danh mục admin cần xử lý riêng. Không thay đổi các hợp đồng RPC lấy cá/bộ trang bị chưa có đủ định nghĩa trong repo.
- **Nghiệm thu đạt:** `scripts/test-inventory-snapshot.mjs` kiểm tra 1.203 và 10.001 dòng với server chỉ trả tối đa 73 dòng/request; nguyên liệu và trang bị ở cuối vẫn được tính đủ và chế tạo thành công. Kiểm tra kho rỗng, lỗi trang sau, request đảo thứ tự và đổi tài khoản đều đạt. Năm nhóm hồi quy cache/catalog/refresh/health và build đều đạt.

### IC-11 — Thả cá và hiển thị lỗi tải kho cá

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/data/supabaseFishRepository.ts:116` DELETE trực tiếp `caught` theo ID. Cần đối chiếu RLS/trigger live để biết các trạng thái đang được bảo vệ. `src/stores/player-caught-store.ts:71` bắt lỗi tải bằng `console.error` và không có error state, nên UI không phân biệt được kho rỗng, dữ liệu cũ và tải thất bại.
- **Bước 1:** Chuẩn hóa nghiệp vụ thả cá bằng RPC kiểm tra owner và trạng thái cho phép; xử lý cạnh tranh với đăng bán, chuyển cá và các luồng dùng cá khác.
- **Bước 2:** Thêm trạng thái lỗi vào store, hiển thị lỗi/thử lại ở modal bằng bản dịch; bảo toàn dữ liệu cũ nhưng báo rõ khi không thể làm mới.
- [x] **Bước 3:** `CaughtModal` gọi `releaseFish`/`listFishForSale` trong caught store; store gọi repository và chỉ sửa snapshot sau thành công, bỏ phản hồi khác phiên. Giữ nguyên hợp đồng backend trong đợt refactor.
- **Nghiệm thu:** Không thả nhầm cá của người khác hoặc cá đã chuyển sang trạng thái không hợp lệ; lỗi mạng/RLS có phản hồi rõ, không hiển thị như kho rỗng. Chỉ kết luận lỗi quyền sau khi kiểm tra policy live.

### IC-12 — Danh tính và thống kê người chơi cùng bãi

- [ ] **Hoàn thành module.**
- **Hiện trạng sau refactor:** Query đã chuyển sang `supabaseFishRepository.fetchNearbyCatches`; fishing store gọi repository và bỏ phản hồi khác request/bãi/session. Query vẫn chỉ lọc `user_id`, không lọc bãi/phiên/trạng thái. Cấp độ vẫn tính từ `floor(count / 3) + 1`; người khác dùng tên dựng từ UUID thay vì hồ sơ. Kết quả còn phụ thuộc max rows và RLS; IC-12 chưa hoàn thành nghiệp vụ thống kê.
- **Bước 1:** Chốt ý nghĩa thống kê: cả đời, chuyến hiện tại hay bãi hiện tại; quy định rõ dữ liệu công khai.
- **Bước 2:** Tạo RPC/view thống kê có kiểm soát quyền, tổng hợp tại database và trả hồ sơ phù hợp; đưa truy vấn qua repository.
- **Bước 3:** Dùng cấp độ, tên/ảnh đại diện thật theo hợp đồng `userProfile` và các helper/shared component danh tính hiện có.
- **Nghiệm thu:** Số liệu khớp phạm vi đã chọn khi có nhiều hơn một trang cá; người chơi đổi tên/ảnh/cấp độ được hiển thị đúng; không phải mở quyền đọc toàn bộ kho cá cá nhân.

### IC-13 — Đếm thành viên và xử lý lỗi phe phái

- [ ] **Hoàn thành module.**
- **Bằng chứng:** `src/data/supabaseFactionRepository.ts:113` lấy toàn bộ `faction_id` rồi đếm tại client, không phân trang. Các phương thức đọc phe/hiệu ứng/điểm ở cùng file trả `null`, `[]`, `0` khi query lỗi; UI có thể hiểu thành chưa gia nhập hoặc không có hiệu ứng.
- **Bước 1:** Chuyển đếm thành viên sang RPC/view tổng hợp với quyền công khai phù hợp và không phụ thuộc giới hạn số dòng trả về.
- **Bước 2:** Phân biệt kết quả hợp lệ rỗng với lỗi repository; store giữ dữ liệu đã xác nhận, báo lỗi tải và cho thử lại.
- **Bước 3:** Áp dụng kiểm tra owner/generation theo IC-05 cho tải dữ liệu và đổi/gia nhập phe.
- **Nghiệm thu:** Đếm chính xác khi lượng thành viên vượt max rows; giả lập lỗi quyền/mạng không biến người đã gia nhập thành người chưa có phe.

### IC-14 — Lượt xem và vòng đời thời gian của sự kiện

- [ ] **Hoàn thành module.**
- **Hiện trạng sau refactor:** `supabaseEventScheduleRepository.incrementViewCount` vẫn ghi `currentCount + 1`; hai người cùng đọc số cũ có thể ghi đè lượt xem nhau. Luồng tải/chọn lịch đã vào `player-event-store.ts`; `useEventScheduleClock` tự đổi trạng thái theo giờ và đồng bộ khi focus/visibility.
- **Bước 1:** Tạo RPC tăng bộ đếm bằng phép cộng tại database; quy định xem lại/click lại có tính lượt hay không và giới hạn quyền chỉ tăng lượt xem cần thiết.
- [x] **Bước 2:** Tải/chọn lịch và gọi cập nhật lượt xem nằm trong Pinia; clock phản ứng tick mỗi giây và đồng bộ focus/visibility. Chưa đổi phép ghi bộ đếm ở backend.
- [x] **Bước 3:** Scope disposal dọn interval/listener; làm mới sửa lựa chọn khi lịch bị tắt/xóa. Test Node kiểm tra phản hồi cũ/lựa chọn, browser kiểm tra hai mốc và dọn clock.
- **Nghiệm thu:** Nhiều request đồng thời không mất lượt; modal mở qua hai mốc tự đổi trạng thái; quay lại tab sau thời gian dài cập nhật đúng.

### IC-15 — Chốt tích hợp và dữ liệu production cho nuôi cá

- [ ] **Hoàn thành kiểm chứng tích hợp.**
- **Bằng chứng:** `scripts/supabase/migrations/aquaculture/README.md` ghi rõ seed 06 là mock chưa cân bằng; `caught.area_id`/`area_session_id` nullable và các trigger nhiệm vụ/thành tích live chưa được đối chiếu. Cá nuôi chuyển vào `caught` có thể bị các trigger đang đếm INSERT hiểu là cá vừa câu nếu chưa phân biệt nguồn. Repo chưa có file test aquaculture có thể chạy lại dù README mô tả lần kiểm tra PGlite trước đây.
- **Bước 1:** Đối chiếu DDL, trigger và nguồn gốc cá với baseline ở IC-09; bảo đảm cá chuyển từ ao không tự tăng tiến độ câu hoặc thưởng ngoài thiết kế.
- **Bước 2:** Chốt catalog thật, kinh tế giống/thức ăn/bán và xác suất cá đặc biệt; xác nhận cửa hàng mua được thức ăn dùng cho các loài đã bật. Không dùng seed mock như bằng chứng đã sẵn sàng production.
- **Bước 3:** Lưu thành script kiểm thử lặp lại cho trưởng thành offline, chống xử lý lặp, chuyển/bán/thả đồng thời, sức chứa và quyền truy cập; đối chiếu một lượt đầy đủ trên staging.
- **Nghiệm thu:** Cá nuôi có nguồn gốc rõ, không phát thưởng câu ngoài ý muốn, không vượt kho khi chuyển đồng thời, cùng request không trừ tiền hai lần. Đây là hạng mục cần xác minh tích hợp, không kết luận UI hiện chỉ là mô phỏng.

### IC-16 — Phân trang Story admin và thư viện media

- [ ] **Hoàn thành module khi dữ liệu tăng.**
- **Bằng chứng:** `src/data/supabaseStoryRepository.ts:12` list Storage với `limit: 1000` và không có offset; `drafts():44` dùng `.limit(1000)` không tải tiếp. Kịch bản/tài nguyên sau giới hạn không có đường truy cập qua danh sách hiện tại.
- **Bước 1:** Thêm phân trang ổn định và tìm kiếm phù hợp cho drafts/media; trả tổng hoặc trạng thái còn trang tiếp theo.
- **Bước 2:** Đưa page/filter/loading/error vào store editor, giữ bản nháp và lựa chọn đang sửa khi chuyển trang.
- **Bước 3:** Kiểm tra upload/tạo mới khi đang ở trang cuối và khi hai tài nguyên có cùng thời gian tạo.
- **Nghiệm thu:** Truy cập được tài nguyên và bản nháp thứ 1.001 trở đi, không trùng/mất dòng khi chuyển trang hoặc mất nội dung đang sửa.

### IC-17 — Hoàn tất vòng đời refresh của Modal dùng chung

- [x] **Hoàn thành component dùng chung.**
- **Lỗi ban đầu:** Modal gọi callback không `await`, mở khóa sau 5 giây dù việc tải chưa xong và không bắt promise rejection.
- [x] **Bước 1:** Callback hỗ trợ `void | Promise<void>`. `useModalRefresh` chờ invalidate cache và callback, tách loading khỏi cooldown 5 giây; nút khóa khi một trong hai còn hoạt động. Loading có nhãn và `aria-busy` riêng.
- [x] **Bước 2:** Dùng `try/catch/finally`. Module đã xử lý lỗi thì tiếp tục hiển thị lỗi tại module; lỗi được ném ra sẽ hiện trong vùng `role="alert"` của Modal, không thêm toast trùng. Có thông báo dự phòng tiếng Việt/Anh.
- [x] **Bước 3:** Đã rà các callback, sửa hồ sơ/huy hiệu trả Promise thay vì bỏ qua; adapter kho đồ/nuôi cá đợi Promise và bỏ giá trị trả về không cần thiết. Giữ invalidate read cache trước callback. Scope disposal dọn timer và bỏ qua kết quả/lỗi đến muộn của Modal đã đóng.
- **Nghiệm thu đạt:** `scripts/test-modal-refresh.mjs` kiểm tra callback đồng bộ, chậm hơn 5 giây, lỗi invalidate, throw/reject, cooldown và đóng giữa chừng. Kiểm tra Modal thực tế trên Edge xác nhận khóa nút, hiển thị lỗi và mở lại không mang trạng thái cũ. Build và i18n đều đạt.

### IC-18 — Chuẩn hóa kiến trúc, i18n, types và kích thước component

- [ ] **Hoàn thành các phần còn lệch quy ước dự án.**
- [x] **Đợt 1 — Đổi mã thưởng:** Form chỉ giữ nhập liệu; `player-redeem-code-store.ts` quản lý submit/thông báo, `supabaseRedeemCodeRepository.redeem` gọi RPC cũ. Dùng lại bản dịch hiện có, đăng ký reset session; phản hồi cũ không tạo toast hoặc mở khóa yêu cầu mới. Test `scripts/test-redeem-code.mjs` đạt cho hợp đồng request, trim/rỗng/trùng, lỗi/retry và đổi phiên (kể cả cùng user ID).
- **Kiểm chứng đợt 1:** Build và i18n đạt; `test-redeem-code.mjs` (4 test), `test-refresh-stores.mjs` (9 test) và `test-read-cache.mjs` (19 test) đều đạt. Các file sửa giữ UTF-8 không BOM; liên kết local trong tài liệu vừa cập nhật đều tồn tại. Chưa kiểm chứng RPC đổi mã trên Supabase live.
- [x] **Đợt 2 — Các module đã yêu cầu:** Sự kiện dùng store/clock; query cùng bãi về repository; kho cá chuyển type/actions và dịch nhãn; Fishing Pass Admin tách repository/type. Bạn bè chia bốn tab, sách tách motion/CSS, tổ đội tách form tạo/sửa, bản đồ admin tách controller/phân vùng/type. Các consumer đã đổi imports; bản đồ và sách bỏ HTML tag không đúng quy ước tại phần chỉnh sửa.
- **Kiểm chứng đợt 2 đạt:** Build, i18n (2.101 khóa mỗi locale), 63 test Node/SQL trong 9 file liên quan và `test-module-refactoring-browser.mjs` trên Edge. Browser kiểm tra vi/en của sách, mở/lật/đóng/unmount và scroll lock, bốn tab Bạn bè, model/submit/loading của form tổ đội, hai mốc trạng thái và dọn clock sự kiện, thêm vùng bản đồ. Đã kiểm tra UTF-8 không BOM, liên kết tài liệu và consumer của file bị xóa; chưa gọi Supabase live.
- **Phạm vi còn mở:** Các lỗi nghiệp vụ IC-06/IC-11/IC-12/IC-14 vẫn xử lý riêng. Tiếp tục rà type/chuỗi viết cứng và vùng UI lớn khi chỉnh module liên quan, không kết luận toàn repo đã hết lệch kiến trúc. Trách nhiệm, hợp đồng và lệnh test từng module nằm tại [sổ refactor](docs/module-refactoring.md).
- **Bước 1:** Đưa query/RPC/Realtime về `supabaseRepository`, action xử lý dữ liệu vào Pinia; giữ state tương tác cục bộ hợp lý trong component/composable, không chuyển tất cả ref vào store một cách máy móc.
- **Bước 2:** Tái sử dụng type trong `src/types/model` và `src/types/table`, di chuyển type còn phân tán và cập nhật mọi consumer; thay nhãn người chơi viết cứng bằng khóa vi/en. Kiểm tra i18n hiện tại đạt nhưng chưa phát hiện mọi chuỗi viết cứng.
- **Bước 3:** Tách các vùng có trách nhiệm riêng trong component lớn; ưu tiên thành phần shared hiện có, giữ hành vi focus, animation và các modal con. Rà các HTML tag không đúng AGENTS.md khi chỉnh phần liên quan.
- **Nghiệm thu:** Luồng redeem/event/thống kê có đường UI → store → repository rõ ràng; đổi vi/en đổi được toàn bộ nhãn vừa sửa; build/i18n và hồi quy của module đạt sau mỗi nhóm refactor.

### IC-19 — Đồng bộ tài liệu và dọn mã cũ có kiểm chứng

- [ ] **Hoàn thành tài liệu bảo trì.**
- [x] **Đợt 1 — Tài liệu nền và module đổi mã:** README gốc mô tả dự án, biến môi trường mẫu, lệnh chạy/build/test và liên kết runbook, ghi rõ thiếu baseline/Edge Functions. `scripts/supabase/README-improve.md` đã đối chiếu source: lưu set, xóa inventory, hủy tin chợ, kết thúc chuyến câu và chuyển nhóm cá được ghi là đã chuyển RPC; tách kiểm chứng staging còn lại. Thêm `docs/module-refactoring.md` mô tả hợp đồng đổi mã và phạm vi từng đợt tiếp theo.
- [x] **Đợt 2 — Đồng bộ sau refactor:** Sổ module ghi trách nhiệm và kiểm thử của toàn bộ nhóm vừa sửa; README nuôi cá dùng tên store mới; khuyến nghị cùng bãi ghi đúng query đã chuyển repository. Đã tìm consumer source/script, import động/glob trước khi xóa mock `src/data/blueprints.ts`, type chỉ phục vụ mock `src/types/model/blueprintCatalog.ts` và backup `src/composables/use-single-session.old.ts`. Giữ demo Story và luồng blueprint thật. File pass admin cũ được thay bằng repository/type mới.
- **Duy trì:** Đồng bộ tiếp tài liệu theo mỗi module; baseline/triển khai live còn thuộc IC-09, không đánh dấu đã dựng được backend mới chỉ từ kết quả refactor.
- **Bước 1:** Viết README theo dự án thực: cấu hình môi trường bằng tên biến và giá trị mẫu, cách chạy, migration/runbook, nhóm test và giới hạn tích hợp. Không đưa secret thật vào tài liệu.
- **Bước 2:** Cập nhật hoặc đánh dấu đã giải quyết các khuyến nghị cũ bằng cách đối chiếu source; sửa link/file paths sau đổi tên.
- **Bước 3:** Tìm consumer của mock/backup/template, xóa hoặc chuyển sang fixture nếu thực sự không dùng; giữ dữ liệu demo Story đang phục vụ editor/kiểm thử.
- **Nghiệm thu:** Người mới làm theo README dựng và kiểm tra được dự án; không còn yêu cầu sửa lại hạng mục đã hoàn thành hoặc import trỏ mã dự phòng không dùng.

## Thứ tự thực hiện đề xuất

1. IC-08 và IC-09: khôi phục khả năng kiểm chứng và chốt hợp đồng database.
2. IC-01 đến IC-06, IC-10: sửa lỗi gameplay, transaction, thưởng và cách ly tài khoản; mỗi nhóm kèm kiểm tra nghiệp vụ tương ứng.
3. IC-07: bổ sung backend và nghiệm thu sandbox trước đợt phát hành donation.
4. IC-11 đến IC-17: hoàn thiện dữ liệu hiển thị, lỗi, quy mô và tích hợp staging.
5. IC-18 và IC-19: refactor theo từng module, đồng bộ tài liệu sau thay đổi; tránh gom toàn bộ refactor vào một đợt sửa nghiệp vụ.

Sau mỗi thay đổi code: chạy `npm.cmd run build`, `npm.cmd run check:i18n` nếu chạm nội dung đa ngôn ngữ, và nhóm kiểm thử liên quan. File chỉnh sửa phải giữ UTF-8 không BOM và không làm hỏng tiếng Việt.
