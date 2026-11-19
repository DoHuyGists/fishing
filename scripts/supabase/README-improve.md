# Trạng thái các khuyến nghị database

Đối chiếu với source ngày 19/11/2026. “Đã chuyển” mô tả mã trong repo; quyền, RLS, trigger và phiên bản RPC đang chạy vẫn cần kiểm tra trên staging. Các mục còn mở được theo dõi trong [improve-checklist.md](../../improve-checklist.md).

## Đã chuyển sang RPC

| Chức năng | Source hiện tại | Kiểm chứng còn cần |
| --- | --- | --- |
| Lưu bộ trang bị | [supabaseEquipmentRepository.ts](../../src/data/supabaseEquipmentRepository.ts) gọi `save_equipment_set` | Đối chiếu kiểm tra owner/ô trang bị và cạnh tranh trên staging |
| Xóa vật phẩm kho | [supabaseUserInventoryRepository.ts](../../src/data/supabaseUserInventoryRepository.ts) gọi `delete_inventory_items` | Đối chiếu khóa và kiểm tra vật phẩm trong set tại database |
| Hủy tin bán | [supabaseMarketRepository.ts](../../src/data/supabaseMarketRepository.ts) gọi `cancel_market_listing` | Thử đồng thời hủy và mua bằng hai tài khoản |
| Kết thúc chuyến câu | [player-caught-store.ts](../../src/stores/player-caught-store.ts) chỉ gọi complete; [function body](rpc/user-in-area/user_complete_fishing.sql) gọi `release_in_net_fishes` trong cùng transaction của RPC | Áp function body đúng chữ ký hiện có; kiểm tra trigger/live và retry theo IC-02 |
| Chuyển nhóm cá | [supabaseFishRepository.ts](../../src/data/supabaseFishRepository.ts) gọi một `move_species` với mảng `p_species_ids`; [SQL](rpc/caught/move_species.sql) kiểm tra/khóa cả nhóm | Mảng chứa `caught.id`; test local tại `scripts/test-move-species-sql.mjs`, còn cần kiểm chứng đồng thời trên staging theo IC-03 |

## Còn cần xử lý

| Chức năng | Hiện trạng và bước tiếp theo |
| --- | --- |
| Thả cá — IC-11 | `supabaseFishRepository.deleteCaughtFish` còn DELETE trực tiếp; cần RPC kiểm tra owner/trạng thái và phối hợp với luồng chợ/chuyển cá |
| Tạo/sửa nhóm — IC-06 | `supabaseTeamRepository` tạo qua RPC rồi truy vấn và cập nhật cấu hình; cần RPC tạo nhận đủ cấu hình và trả ID xác nhận |
| Mời vào nhóm — IC-06 | Repository còn kiểm tra rồi INSERT; đưa kiểm tra quyền, trạng thái và chống trùng vào transaction phía server |
| Lượt xem sự kiện — IC-14 | `supabaseEventScheduleRepository` ghi `currentCount + 1`; cần phép cộng tại database và quy tắc tính lượt rõ ràng |
| Đếm thành viên phe — IC-13 | `supabaseFactionRepository` đếm danh sách client chưa phân trang; cần tổng hợp và phân biệt lỗi với kết quả rỗng |
| Thống kê người cùng bãi — IC-12 | Query đã chuyển sang `supabaseFishRepository.fetchNearbyCatches`; store vẫn tính theo dữ liệu nhìn thấy qua RLS và giới hạn dòng hiện tại. Cần chốt phạm vi thống kê và hợp đồng tổng hợp công khai trước khi đổi nghiệp vụ |

Refactor kiến trúc thực hiện riêng theo [từng module](../../docs/module-refactoring.md); không dùng việc chuyển file làm bằng chứng đã sửa transaction hoặc quyền dữ liệu.
