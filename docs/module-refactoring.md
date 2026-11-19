# Refactor theo module

Mỗi đợt chọn một module, xác định hợp đồng hiện tại, chuyển trách nhiệm về đúng lớp, chạy hồi quy và cập nhật tài liệu liên quan. Tách các thay đổi luật chơi, schema hoặc quyền thành công việc riêng có nghiệm thu cụ thể. IC-18/IC-19 vẫn mở đến khi các phần còn lại được xử lý.

## Đổi mã thưởng — đã refactor ngày 19/11/2026

Luồng: `RedeemCodeForm.vue` → `player-redeem-code-store.ts` → `supabaseRedeemCodeRepository.redeem` → RPC `redeem_code(p_code)`.

- Form giữ nội dung nhập, dùng trạng thái gửi của store và chỉ xóa nội dung khi action trả `true`.
- Store trim mã, bỏ yêu cầu rỗng/trùng khi đang gửi, quản lý loading và thông báo vi/en hiện có. Không lưu mã nhập vào state dùng chung.
- Repository gọi đúng RPC và tham số cũ, chuẩn hóa lỗi Supabase thành `Error`. Không suy diễn cấu trúc payload trả về vì form trước đây không sử dụng payload.
- Store tham gia reset snapshot theo session. Kết quả của phiên cũ không tạo toast, báo thành công hoặc mở khóa yêu cầu của phiên mới, kể cả đăng nhập lại cùng tài khoản.
- Giữ cơ chế refresh sau mutation tại connection chung. Đợt này không thay hợp đồng thưởng hay SQL của RPC.

Kiểm tra: `node --test --test-isolation=none scripts/test-redeem-code.mjs` kiểm tra request HTTP thực qua connection với fetch mock, trim, chặn gửi trùng, lỗi/retry và phản hồi đến muộn sau đổi phiên. Chạy thêm build, i18n và nhóm snapshot/cache khi sửa cơ chế reset.

## Các module đã cập nhật — 19/11/2026

| Module | Trách nhiệm sau refactor | Hợp đồng giữ lại / phần còn mở |
| --- | --- | --- |
| Sự kiện | `player-event-store.ts` tải/chọn lịch, loại phản hồi cũ, sửa lựa chọn khi lịch bị tắt/xóa; `useEventScheduleClock` cập nhật trạng thái theo thời gian, focus/visibility và dọn interval khi đóng | Vẫn gọi repository cũ cho bộ đếm; phép ghi `currentCount + 1` cần xử lý riêng theo IC-14 |
| Người cùng bãi | Query `caught` chuyển từ fishing store sang `supabaseFishRepository.fetchNearbyCatches`; store giữ phần tính count/best fish và chặn kết quả khác phiên/bãi/request | Giữ nguyên phạm vi RLS, giới hạn dòng, tên và cấp độ suy dựng; chưa có RPC thống kê công khai theo IC-12 |
| Kho cá | `CaughtFish` dùng lại `CaughtRow` qua `types/model/caughtFish.ts`; các consumer import từ types. `releaseFish`/`listFishForSale` trong store gọi repository rồi mới sửa snapshot; UI giữ xác nhận và thông báo. Nhãn Kho cá có vi/en | Không thay DELETE thả cá hoặc RPC bán hiện tại; IC-11 còn quyền/transaction và lỗi tải |
| Fishing Pass Admin | `supabaseFishingPassAdminRepository.ts` nằm trong data; type camelCase riêng tại `types/model/fishingPassAdmin.ts`; store/form/modal cập nhật imports | Giữ bảng `fishing_passes`, mapping payload và CRUD/quyền cũ; type pass người chơi vẫn riêng vì hợp đồng khác |
| Bạn bè | Modal điều phối tải, debounce, action và xác nhận; tách `FriendAcceptedList`, `FriendReceivedRequests`, `FriendSentRequests`, `FriendDiscovery`. `useFriendProfiles` dùng lại tra hồ sơ/quan hệ; type quan hệ/xóa nằm trong types | Giữ store, phân trang, tìm kiếm và bốn luồng action; timer hiển thị clipboard được dọn khi unmount |
| Sách | `TheBook.vue` giữ slots/nội dung; `useBookMotion` giữ mở/đóng/lật, keyboard, scroll lock, hủy animation và timer khi unmount; CSS scoped nằm tại `the-book.css`; type trang nằm trong diary types | Giữ Teleport, named slots, expose open/close và hiệu ứng cũ; thêm vi/en cho nhãn điều khiển, số trang và nội dung dự phòng |
| Tổ đội | Tách form dùng chung cho tạo/sửa thành `TeamEditorForm.vue`, dùng `TeamEditorFields` trong types; modal vẫn điều phối phòng, polling, action và xác nhận | Giữ draft, validation, giới hạn input, trạng thái loading, các modal con và hợp đồng RPC; IC-06 tiếp tục theo dõi transaction/quyền |
| Bản đồ admin | `Map.vue` giữ SVG/controls; `useLakeEditor` giữ thao tác shape/node/zone/pointer; `useLakePartition` giữ lưới, marching squares và tỷ lệ vùng; type riêng tại `types/model/lakeEditor.ts` | Giữ toàn bộ preset, biên kích thước, kéo node, màu và dữ liệu khởi tạo. Đây vẫn là editor hình học cục bộ, không bổ sung lưu database |

## Dọn mã dự phòng/mock và tài liệu

Đã tìm consumer trong source và script, kể cả import động/glob. Xóa `src/data/blueprints.ts` (mock không có consumer), `src/types/model/blueprintCatalog.ts` (chỉ phục vụ mock đó), `src/composables/use-single-session.old.ts` (implementation dự phòng không được dùng). Luồng chế tạo vẫn dùng `supabaseBlueprintRepository` và store thật. Giữ dữ liệu demo Story phục vụ editor/test và nội dung dự phòng của sách, đã dịch vi/en.

File `components/admin/admin-fishing-pass/fishing-pass-admin.ts` được thay bằng repository/type ở vị trí mới, không giữ bản sao. Đã sửa đường dẫn store nuôi cá trong runbook và cập nhật khuyến nghị thống kê người cùng bãi. README gốc tiếp tục ghi rõ giới hạn baseline và kiểm chứng staging.

## Kiểm tra nhóm module

```powershell
node --test --test-isolation=none scripts/test-module-refactoring.mjs
node scripts/test-module-refactoring-browser.mjs
npm.cmd run build
npm.cmd run check:i18n
```

Browser script dùng `REFACTOR_TEST_BROWSER` nếu trình duyệt không nằm ở đường dẫn tự dò. Fixture dùng repository/fetch mock, không ghi Supabase thật. Test Node kiểm tra sự kiện đảo thứ tự/đổi phiên, lựa chọn bị xóa/tắt, thao tác kho cá, hợp đồng query cùng bãi, mapping Fishing Pass Admin và giới hạn hình học. Browser kiểm tra CSS scoped/keyboard/scroll khi đóng sách, bốn tab Bạn bè, model/submit/loading form tổ đội, hai mốc sự kiện và dọn clock, thêm vùng bản đồ.

Các test hồi quy liên quan: `test-refresh-stores.mjs`, `test-read-cache.mjs`, `test-fishing-net-capacity.mjs`, `test-fishing-result-recovery.mjs`, `test-game-catalog.mjs`, `test-health-equipment.mjs`. Phần phân quyền/transaction, baseline và tải dữ liệu quy mô lớn vẫn nghiệm thu theo IC tương ứng; không suy ra từ refactor giao diện.

Kết quả đợt này: build/i18n đạt, 63 test Node/SQL trong 9 file (gồm nhóm module mới, các nhóm trên, cancel-session và redeem-code) đạt; browser script đạt trên Edge. UTF-8 không BOM, liên kết local và consumer của file xóa đã kiểm tra. Chưa gọi Supabase live.

Sau mỗi đợt: kiểm tra UTF-8 không BOM, build, i18n khi chạm UI, test liên quan và rà README/checklist để bỏ khuyến nghị đã lỗi thời. Không đánh dấu hoàn tất toàn bộ IC-18/IC-19 từ kết quả của một module.
