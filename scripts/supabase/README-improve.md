| Ưu tiên | Chức năng | Hiện trạng và lý do chuyển |
|---|---|---|
| Cao | **Lưu bộ trang bị** | [UpdateSet](/D:/fishing/src/data/supabaseEquipmentRepository.ts:68) cập nhật trực tiếp JSON vào `user_equipments`. RPC cần kiểm tra vật phẩm thuộc người chơi, đúng ô trang bị, không trùng và có được phép thay đổi trong phiên câu hiện tại hay không. |
| Cao | **Xóa vật phẩm trong kho** | [deleteInventory](/D:/fishing/src/data/supabaseUserInventoryRepository.ts:51) xóa trực tiếp `user_inventory`. Điều kiện “vật phẩm không nằm trong set” hiện được kiểm tra ở frontend; cần kiểm tra lại trong cùng giao dịch phía database để tránh dữ liệu cũ hoặc thao tác đồng thời. |
| Cao | **Hủy đăng bán cá** | [cancelListing](/D:/fishing/src/data/supabaseMarketRepository.ts:116) chỉ cập nhật `status = cancelled`. RPC nên khóa tin bán, kiểm tra chủ sở hữu và trạng thái còn bán, rồi cập nhật trạng thái liên quan của cá nếu nghiệp vụ yêu cầu. Cần xử lý đồng thời với RPC mua cá. |
| Cao | **Thả cá** | [deleteCaughtFish](/D:/fishing/src/data/supabaseFishRepository.ts:189) xóa trực tiếp theo ID. RPC nên xác nhận quyền sở hữu và trạng thái cho phép thả, tránh xóa cá đang được niêm yết hoặc thuộc luồng xử lý khác. |
| Cao | **Kết thúc chuyến câu** | [finishFishing](/D:/fishing/src/stores/caught.ts:48) xóa cá trong lưới trước, sau đó gọi `user_complete_fishing`. Nếu bước sau lỗi, cá đã bị xóa. Nên gom toàn bộ vào một RPC để cùng thành công hoặc cùng hoàn tác. |
| Cao | **Tạo và chỉnh sửa tổ đội** | [createTeam](/D:/fishing/src/data/supabaseTeamRepository.ts:151) gọi RPC tạo nhóm, rồi truy vấn nhóm và cập nhật tiếp. Nên truyền cấu hình ngay vào RPC tạo nhóm. [updateTeam](/D:/fishing/src/data/supabaseTeamRepository.ts:172) cũng nên qua RPC để kiểm tra quyền trưởng nhóm, số thành viên và quy tắc chuyển trạng thái. |
| Trung bình | **Mời người chơi vào tổ đội** | [inviteUser](/D:/fishing/src/data/supabaseTeamRepository.ts:43) kiểm tra người chơi rồi insert lời mời. RPC nên tự lấy người mời từ phiên đăng nhập, kiểm tra quyền, trạng thái nhóm và lời mời trùng trong cùng giao dịch. |



| Chức năng | Đề xuất |
|---|---|
| **Chuyển nhiều cá giữa kho và lưới** | [updateCaughtStatus](/D:/fishing/src/data/supabaseFishRepository.ts:195) đã dùng RPC nhưng gọi riêng từng cá bằng `Promise.all`. Nên dùng một RPC nhận danh sách ID, kiểm tra dung lượng kho và chuyển cả nhóm trong một giao dịch; hiện có thể chuyển thành công một phần. |
| **Tăng lượt xem sự kiện** | [incrementViewCount](/D:/fishing/src/data/supabaseEventScheduleRepository.ts:89) ghi `currentCount + 1` từ frontend. Nên dùng RPC tăng trực tiếp `view_count = view_count + 1` để tránh mất lượt khi nhiều người xem đồng thời. |
| **Đếm thành viên từng phe** | [fetchFactionMemberCounts](/D:/fishing/src/data/supabaseFactionRepository.ts:162) tải các dòng `user_factions` rồi đếm ở client. Nên tổng hợp tại database bằng RPC hoặc view; kết quả hiện tại phụ thuộc các dòng được RLS cho phép đọc và giới hạn trả về. |
| **Thống kê người đang câu trong hồ** | [fetchPlayersInArea](/D:/fishing/src/stores/fishing.ts:281) tải dữ liệu cá rồi tính số lượng, cá nặng nhất tại client. Nên trả thống kê từ RPC hoặc view, đồng thời đưa truy vấn ra khỏi store. |