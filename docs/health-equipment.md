# Set trang bị cơ thể

Trong InventoryModal, hai tab dùng chung danh sách kho. Tab sức khỏe gồm năm chỉ số và các set trang bị, không còn body map. Mỗi set có sáu nhóm: `head`, `torso`, `hands`, `legs`, `feet`, `accessory`. Chọn ô trong set rồi chọn vật phẩm từ kho; mỗi nhóm lưu mảng `inventory_id`, tương tự set công cụ câu. Một vật phẩm chỉ xuất hiện một lần trong cùng set, có thể dùng lại ở các set khác. Thêm set cơ thể hiện không thu tiền; không thay đổi giá mua set câu.

Chỉnh sửa là bản nháp cho đến khi bấm Lưu set. Chọn Sử dụng chỉ chuyển set đang dùng, không tự lưu bản nháp. Năm chỉ số là tổng `health_bonuses` từ vật phẩm của set đã lưu được đánh dấu `is_used`; không cộng base 100, không giới hạn 100, không có thanh phần trăm. Chưa chọn set hoặc set rỗng thì cả năm bằng 0. Vật phẩm có mặt trong bất kỳ set đã lưu hoặc bản nháp nào đều cần được gỡ và lưu trước khi xóa.

Snapshot `user_inventory.data` cần metadata như sau:

```json
{
  "name": "Áo bảo hộ",
  "quantity": 1,
  "category": "torso",
  "health_bonuses": { "vitality": 200, "energy": 10 }
}
```

`health_bonuses` hỗ trợ năm khóa `vitality`, `hydration`, `nutrition`, `energy`, `morale`; chỉ cộng số dương hữu hạn. Metadata không hợp lệ không được tính. Vật phẩm không có `category` phù hợp vẫn hiện trong kho nhưng không lắp được vào set cơ thể.

## Triển khai Supabase

Chạy theo thứ tự trong SQL Editor trước khi triển khai client:

1. `scripts/supabase/migrations/20261113_user_body_equipments.sql`
2. `scripts/supabase/rpc/equipment/save_body_equipment_set.sql`

Bảng `user_body_equipments` chứa ID, người sở hữu, ngày tạo, `is_used` và sáu cột JSONB mảng. RLS chỉ cho người chơi đọc set của mình, mọi ghi đi qua RPC. Unique index bảo đảm mỗi người có tối đa một set đang dùng. Set đầu tiên được tạo sẽ tự đánh dấu sử dụng.

RPC `create_body_equipment_set`, `save_body_equipment_set`, `switch_body_equipment` lấy chủ sở hữu từ `auth.uid()`, không tin ID người dùng gửi từ client. RPC lưu kiểm tra kiểu dữ liệu, trùng vật phẩm, quyền sở hữu, số lượng và loại ô; chỉ lưu `inventory_id`, bỏ qua chỉ số do client gửi. Các thao tác set của một người được tuần tự hóa. Trigger bảo vệ vật phẩm đang được tham chiếu khỏi xóa, kể cả set không hoạt động. Migration đăng ký các endpoint với feature gate nếu đã có; file seed feature flags cũng đã đồng bộ cho cài đặt mới.

Chỉ số được hiển thị từ snapshot inventory trong Pinia. Đây chưa phải cơ chế trừ sức khỏe hoặc áp dụng hiệu ứng vào sự kiện máy chủ. Khi triển khai gameplay sinh tồn, máy chủ cần tính tổng từ set đang dùng và inventory; không nhận tổng từ client làm nguồn tin cậy.
