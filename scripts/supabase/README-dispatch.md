# Phái NPC

Chạy `migrations/20261114_dispatch.sql` trong Supabase SQL Editor sau migration feature flags. File tạo mới sáu bảng, RLS và RPC; không cần cron hoặc Realtime. Chưa có dữ liệu NPC/công việc mặc định. Vào trang quản trị → Phái NPC → NPC / Công việc để tạo và bật cấu hình.

## Quy tắc

- Mỗi người chơi sở hữu tối đa một NPC của mỗi mẫu. NPC không bị tiêu hao; mỗi NPC chỉ giữ một lượt chưa kết thúc.
- Mua NPC bằng `currency.shells`; bắt đầu hoặc lặp việc trả `currency.cash` theo giá NPC hiện tại.
- NPC đạt yêu cầu nếu mọi giá trị trong `job.data.requirements` nhỏ hơn hoặc bằng `npc.data.stats` cùng khóa; chỉ số thiếu được tính là 0. Không có xác suất thất bại ngầm.
- Thưởng hiện hỗ trợ các số nguyên không âm `cash`, `shells`, `tickets`, mỗi loại tối đa 1.000.000. Không âm thầm bỏ qua khóa thưởng không hỗ trợ.
- Khi hoàn thành, **Giao việc khác** nhận thưởng, giải phóng NPC và cho phép chọn việc tiếp theo. **Lặp lại chu kỳ** nhận thưởng và khởi tạo đúng một lượt mới cho cùng NPC/công việc, theo cấu hình hiện hành. Không tự động lặp vô hạn.
- Có thể dùng thưởng tiền lượt cũ để trả phí lượt lặp. Nếu lượt mới không hợp lệ hoặc không đủ tiền, toàn bộ giao dịch lặp được rollback; lượt cũ vẫn chờ nhận thưởng qua Giao việc khác.
- Hủy không hoàn phí và không trao thưởng, kể cả khi lượt đã đủ thời gian. Việc hủy được lưu lịch sử.

## Bảng và hợp đồng JSON

`dispatch_npcs`: mã duy nhất, tên/mô tả song ngữ, ảnh, giá mua sò, phí vận hành tiền, `data`, trạng thái bật, thứ tự, thời gian tạo/cập nhật. Ví dụ `name = {"vi":"Thủy thủ","en":"Sailor"}`, `data = {"stats":{"strength":10,"navigation":5}}`.

`dispatch_jobs`: mã, tên/mô tả song ngữ, ảnh, thời lượng giây (60 đến 2.592.000), `data`, `rewards`, trạng thái bật, thứ tự, thời gian tạo/cập nhật. Ví dụ `data = {"requirements":{"strength":5}}`, `rewards = {"cash":150,"shells":1}`. Các khóa khác trong `data` dành cho metadata mở rộng, chưa tự tạo hiệu ứng gameplay.

`dispatch_owned_npcs`: NPC sở hữu, giá sò đã trả, thời điểm mua. `dispatch_runs`: lượt làm việc và snapshot NPC/công việc/thưởng/chi phí. `dispatch_history`: kết quả nhận thưởng hoặc hủy, chi phí, snapshot và ba mốc thời gian. `dispatch_actions`: biên nhận chống lặp giao dịch.

Tên/mô tả dùng `vi` và `en`. Các khóa chỉ số là nội dung quản trị, được hiển thị đúng theo khóa đã nhập. Có thể thêm chỉ số mới vào JSON mà không sửa schema. Không xóa mẫu đã được sở hữu hoặc sử dụng; tắt `enabled` để ngừng bán/giao lượt mới. Lượt đang chạy vẫn nhận thưởng theo snapshot.

## Thời gian và tính nguyên tử

Supabase tự tạo `started_at`, `ends_at`, `resolved_at` bằng `clock_timestamp()` và lưu dưới kiểu `TIMESTAMPTZ` (mốc UTC). UI dùng `formatDateTime` hiển thị giờ địa phương. Progress dựa trên mốc giờ máy chủ và đồng hồ đơn điệu của trình duyệt, chỉ cập nhật khi modal đang mở và tab hiển thị. Không ghi tiến độ định kỳ; RPC nhận thưởng xác minh `clock_timestamp() >= ends_at` khi người chơi thao tác.

`dispatch_action` chỉ nhận loại thao tác, ID mục tiêu/công việc, phiên bản cấu hình và request UUID; không nhận tiền thưởng, giá hoặc thời gian từ trình duyệt. Phiên bản `updated_at` ngăn tính phí theo giá mới khi người chơi còn xem giá cũ. Giao dịch khóa profile rồi ví, kiểm tra chủ sở hữu, và ghi thưởng/lịch sử/lượt lặp trong cùng transaction. Unique index ngăn hai lượt hoạt động cho cùng NPC.

Nếu mất phản hồi, client giữ request UUID trong sessionStorage riêng từng người chơi và khóa thao tác mới cho đến khi thử lại chính giao dịch đó. Nhận lại biên nhận không trừ phí hoặc trao thưởng thêm. Đổi tài khoản xóa snapshot hiển thị và bỏ kết quả request cũ. RLS chỉ cho người chơi đọc dữ liệu của mình; ghi trực tiếp sở hữu/lượt/lịch sử bị cấm. Quản trị chỉ được CRUD danh mục NPC/công việc.

## Kiểm tra cục bộ

`npm run test:dispatch` chạy migration và giao dịch trên PostgreSQL bằng PGlite, bao gồm kiểm tra nhận sớm, quyền sở hữu, chống lặp, snapshot, rollback lượt lặp, giá thay đổi và hủy không hoàn phí. Kiểm tra Pinia đi kèm xác minh phân công hai chiều, mất phản hồi rồi mở lại, đổi tài khoản và phản hồi sai thứ tự.

`npm run test:dispatch:browser` kiểm tra giao diện bằng Edge/Chromium headless với dữ liệu giả lập, bao gồm Việt/Anh và màn hình điện thoại; không kết nối Supabase thật. Có thể đặt `DISPATCH_TEST_BROWSER` trỏ đến trình duyệt cục bộ.
