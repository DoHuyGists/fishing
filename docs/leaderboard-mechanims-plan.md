
### 1. Công thức tính điểm tổng hợp (Score Formula)
Xây dựng hàm tính điểm cho mỗi con cá bắt được dựa trên sự kết hợp của 3 trọng số cơ bản và 1 hệ số đặc biệt chi phối bởi mùa giải:
- Score = [ (W_norm ^ α) × (R ^ β) × E ] × S_season
Trong đó:
+ W_norm (Trọng lượng chuẩn hóa nội loài): Giá trị liên tục từ 0 đến 1 dựa trên tỷ trọng thực tế so với kích thước tối đa của loài đó, giúp triệt tiêu hiện tượng trùng lặp điểm số.
+ R (Bậc độ hiếm): Thang giá trị rời rạc theo tier (Common đến Legendary).
+ E (Hệ số môi trường/độ khó): Đại diện cho mức độ hiểm trở của vùng nước, chi phí mồi hoặc điều kiện thời tiết khi câu.
+ S_season (Hệ số điều chỉnh mùa giải): Hệ số động tác động trực tiếp vào kết quả từ mùa trước (chi tiết tại Mục 3).

---

### 2. Cơ chế chống cắm trại / Bão hòa cục bộ (Anti-Camping Fatigue System)
Để ngăn người chơi bám trụ vĩnh viễn tại một tọa độ tối ưu duy nhất trong thế giới 256 quốc gia:
- Xây dựng một "Bộ đếm thời gian tại chỗ" (Camping Timer) tích lũy theo thời gian thực khi người chơi liên tục quăng cần ở cùng một khu vực.
- Khi thời gian vượt qua các mốc ngưỡng, hệ thống tự động áp dụng các tầng debuff tịnh tiến (Debuff Cascade): làm hẹp trần trọng lượng tối đa (W_norm), giảm nhẹ xác suất gặp cá hiếm (R), hoặc phạt nhẹ hiệu suất điểm.
- Bộ đếm này sẽ được reset hoàn toàn khi người chơi di chuyển sang tọa độ/vùng nước khác hoặc thoát game trong thời gian nhất định, ép buộc người chơi phải liên tục khám phá và di chuyển.

---

### 3. Xoay vòng Meta mùa giải & Lưu trữ lịch sử (Seasonal Meta Rotation & Hall of Fame)
Thiết kế chu kỳ chuyển giao mùa giải nhằm làm mới meta và vinh danh người chơi:
- Lưu trữ lịch sử theo từng mùa giải:
  + Top 3 loài có điểm số cao nhất (Top Highest Species).
  + Top 3 loài có điểm số thấp nhất/ít được chú ý nhất (Top Lowest Species).
  + Hall of Fame ghi danh vĩnh viễn Top 3 người chơi xuất sắc nhất mùa.
- Quy tắc cân bằng meta cho mùa giải kế tiếp:
  + Giáng cấp / Phạt hệ số điểm (S_season < 1.0) đối với Top 3 loài dẫn đầu của mùa trước, khiến việc tiếp tục săn chúng không còn là lựa chọn tối ưu trên BXH mùa mới.
  + Thăng hạng / Thưởng hệ số điểm (S_season > 1.0) đối với Top 3 loài thấp nhất của mùa trước, biến chúng thành "meta mới" để người chơi khai thác và tìm kiếm chiến thuật leo rank khác biệt.