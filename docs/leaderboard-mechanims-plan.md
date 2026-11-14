**Đủ để thiết kế giải pháp, nhưng chưa đủ để triển khai hoàn chỉnh và chống lạm dụng.** Phần còn thiếu chủ yếu nằm ở backend và các quy tắc cân bằng gameplay.

Mình đã đối chiếu code trong repo; chưa xác minh schema, trigger và RPC đang chạy trên Supabase.

| Nhóm | Hiện trạng | Phần cần bổ sung |
|---|---|---|
| Công thức điểm | BXH đã đọc, sắp xếp và hiển thị `best_fish.score`. Luồng câu có trọng lượng, độ hiếm và snapshot server. | Công thức tính điểm, cấu hình trọng số, nguồn hệ số môi trường và lưu điểm mỗi lượt bắt. |
| Anti-camping | Có bãi câu, phiên câu và RPC vào/rời bãi. | Trạng thái fatigue phía server, cách tích lũy thời gian, các tầng phạt và quy tắc reset. |
| Mùa giải | Trong repo có mùa vòng quay riêng. | Chưa thấy mùa BXH, thống kê loài, chuyển mùa, hệ số theo loài hoặc Hall of Fame. |

Các điểm cần hoàn thiện trong mô tả:

1. **Chuẩn hóa trọng lượng và xử lý đồng điểm**

   [cast_rod.sql](/D:/Vue/fishing/scripts/supabase/rpc/fishing/cast_rod.sql:264) hiện làm tròn trọng lượng đến hai chữ số và tính tỷ lệ bằng `(weight − weight_min) / (weight_max − weight_min)`. Mô tả của bạn lại hướng đến `weight / weight_max`; cần chọn rõ một cách.

   Giá trị liên tục **không bảo đảm hết đồng điểm**, đặc biệt với trọng lượng đã làm tròn. Nên lưu điểm với độ chính xác đủ cao, chỉ làm tròn khi hiển thị, đồng thời định nghĩa cách phá hòa cho Top 3.

   Cũng cần chốt `α`, `β`, bảng giá trị rarity và công thức `E`. Hiện có dữ liệu thời tiết, nhưng chưa thấy nó được tích hợp vào điểm trong luồng câu. Giá mồi nên dùng giá trị cấu hình server, tránh lấy giá giao dịch của người chơi làm hệ số.

2. **Fatigue đang có lỗ hổng trong quy tắc reset**

   Nếu đổi bãi là reset hoàn toàn, người chơi có thể đi **A → B → A** để xóa phạt và tiếp tục khai thác A.

   Đề xuất dùng `area_id` làm phạm vi, lưu fatigue theo người chơi và bãi. Đổi bãi cho phép câu ở bãi mới, còn fatigue bãi cũ chỉ hết sau thời gian hồi phục. Đây là điều chỉnh so với yêu cầu reset ngay khi di chuyển, nhưng cần thiết để đạt mục tiêu chống lạm dụng.

   Cần định nghĩa thêm:

   - Mốc thời gian và mức phạt từng tầng.
   - Khoảng nghỉ giữa hai lượt nào vẫn được xem là câu liên tục.
   - Cách tính lượt thất bại, hủy câu và mất kết nối.
   - Thời gian nghỉ đủ để reset.

   Tất cả phải dựa trên thời gian server và dùng chung giữa các tab. Giảm xác suất cá hiếm phải tác động vào trọng số xuất hiện; `R` trong điểm vẫn phản ánh đúng rarity của cá bắt được.

3. **“Loài thấp điểm” và “loài ít được chú ý” là hai tiêu chí khác nhau**

   Cần chọn cách thống kê loài: điểm cao nhất, điểm trung bình, tổng điểm hay số người săn. Dùng tổng điểm sẽ bị ảnh hưởng mạnh bởi số lượt câu; dùng điểm thấp nhất dễ bị thao túng bằng cá nhỏ.

   Đề xuất phân biệt rõ: đánh giá thành tích loài bằng điểm tốt nhất, đánh giá mức độ được chú ý bằng số người bắt được loài đó. Loài chưa thể tiếp cận không nên tự động nhận thưởng mùa sau. Cần xử lý cả mùa ít dữ liệu, dưới sáu loài hợp lệ và hai nhóm Top/Bottom bị trùng.

4. **Giảm/thưởng hệ số chưa bảo đảm đổi meta**

   `S_season < 1` chỉ làm loài dẫn đầu yếu đi; chưa chắc khiến nó mất vị trí tối ưu. Tương tự, thưởng nhẹ chưa chắc đưa loài cuối bảng thành meta mới.

   Cần kiểm tra mức thưởng/phạt với phân bố cá và độ khó thực tế. Nên tính hệ số từ mùa liền trước, giới hạn biên độ và tránh nhân dồn vô hạn qua nhiều mùa.

5. **Chuyển mùa cần quy tắc giao dịch rõ ràng**

   Cần chốt độ dài mùa, thời điểm bắt đầu/kết thúc, tiêu chí Top 3 người chơi và lượt quăng trước nhưng bắt sau thời điểm chuyển mùa.

   Đề xuất khóa mùa và hệ số lúc quăng cần; lưu kết quả sau khi server xác thực bắt thành công. Chuyển mùa phải chạy nguyên tử và an toàn khi gọi lại, lưu snapshot Hall of Fame vĩnh viễn, không tính lại điểm lịch sử bằng hệ số mới.

Về triển khai, nên đi theo luồng: **quăng cần → chốt snapshot mùa/môi trường/fatigue → xác thực bắt cá → ghi điểm và cập nhật BXH trong cùng giao dịch**. [submit_challenge.sql](/D:/Vue/fishing/scripts/supabase/rpc/fishing/submit_challenge.sql:221) đã có bước ghi cá và khóa phiên; đây là nơi phù hợp để nối phần ghi nhận điểm. UI tiếp tục đi qua repository và Pinia.

Trước khi sửa backend, cần đối chiếu thêm **DDL bảng `leaderboard`, trigger cập nhật điểm, quyền ghi/RLS và nội dung RPC vào/rời bãi** đang triển khai. Repo hiện chưa cho thấy đầy đủ những phần này.

Mình chưa sửa code. Bốn bài kiểm tra leaderboard hiện tại đều qua; chúng kiểm tra luồng hiển thị/xếp hạng, chưa kiểm chứng ba cơ chế mới.3