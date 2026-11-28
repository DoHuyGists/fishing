# Danh mục kỹ năng

Ngày chuẩn bị: 2026-11-28. Danh mục còn 12 kỹ năng; hiệu ứng **chưa được áp dụng vào cơ chế câu cá**. Nâng cấp kỹ năng hiện vẫn lưu cấp và trừ điểm như trước.

Script dữ liệu: `scripts/supabase/seeds/prepare_skills_catalog.sql`. Script giữ ID và cấp tối đa của các kỹ năng được giữ, sắp xếp lại từ 1 đến 12 và cập nhật revision qua trigger catalog hiện có. Không sửa schema, RLS hoặc RPC.

| Code | Kỹ năng | Hiệu ứng chuẩn bị mỗi cấp | Cấp tối đa |
| --- | --- | --- | --- |
| xp_boost | Kinh Nghiệm Dày Dặn | xp_bonus: 2 | 10 |
| fast_bite | Mồi Câu Hấp Dẫn | bite_time_reduction: 3 | 5 |
| shiny_hunter | Thợ Săn Ánh Kim | shiny_rate_bonus: 0.2 | 5 |
| rare_fish | Truy Tìm Cá Hiếm | rare_fish_bonus: 1 | 5 |
| big_fish | Chinh Phục Cá Lớn | big_fish_bonus: 1.5 | 10 |
| escape_reduction | Đôi Tay Vững Chắc | slack_escape_time_bonus: 1 | 10 |
| hook_mastery | Tinh Thông Móc Câu | hook_efficiency_bonus: 2 | 5 |
| rod_mastery | Tinh Thông Cần Câu | rod_efficiency_bonus: 2 | 5 |
| line_mastery | Dây Câu Bền Bỉ | line_strength_bonus: 2 | 5 |
| bait_mastery | Chuyên Gia Mồi Câu | bait_efficiency_bonus: 1.5 | 10 |
| bait_saver | Tiết Kiệm Mồi | bait_save_chance: 2 | 5 |
| weather_mastery | Thích Nghi Thiên Nhiên | weather_penalty_reduction: 2 | 5 |

Các giá trị là cấu hình chuẩn bị, chưa chốt đơn vị và công thức áp dụng. Cần chốt phần trăm tương đối, điểm phần trăm hoặc điểm chỉ số cùng giới hạn khi triển khai server. Hai key `escape_rate_reduction` và `weather_efficiency_bonus` được thay bằng key diễn đạt đúng ý định mới.

Loại khỏi bảng: `catch_rate`, `fishing_luck`, `variant_hunter`, `heavy_fish`, `star_fish`, `cash_boost`, `deep_fishing`, `shallow_fishing`. Tại thời điểm kiểm tra, không có bản ghi `user_skills` cho các kỹ năng này. Script khóa các bảng liên quan và từ chối xóa nếu phát sinh đầu tư của người chơi; cần hoàn điểm trước trong trường hợp đó. Có thể chạy lại script trên danh mục đã chuẩn bị.

Chưa bổ sung Tinh Thông Máy Câu, Bền Bỉ Đường Dài hoặc Thuần Phục Cá trong giai đoạn này.
