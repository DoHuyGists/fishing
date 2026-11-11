## Màn chơi hướng dẫn

Chạy `migrations/tutorials.sql` trong Supabase SQL Editor để tạo bảng danh mục, quyền đọc RLS và màn `new-player-fishing`.

Từ sảnh chọn **Thực hành**, chuyển giữa Danh sách/Lưới và mở **Buổi câu đầu tiên**. Route riêng: `/tutorial/new-player-fishing` (cần đăng nhập).

`tutorials` chỉ lưu thông tin hiển thị của màn chơi. Client chỉ đọc các dòng đã xuất bản qua `supabaseTutorialRepository`. Không tạo bảng tiến độ, phiên câu hoặc phần thưởng cho hướng dẫn.

`tutorialSession.ts` quản lý bộ trang bị, lượt quăng, bộ hẹn giờ, giằng co và cá bắt được trong bộ nhớ. `tutorials/newPlayerFishing.ts` quản lý cấu hình và chỉ dẫn riêng của màn đầu tiên. Chơi lại hoặc thoát sẽ hủy bộ hẹn giờ và xóa dữ liệu local.

Khi thêm màn mới, tạo component và store riêng, đăng ký slug trong `TutorialView.vue`, sau đó thêm thông tin vào `public.tutorials`. Component có thể tái sử dụng `FishingScene` qua `context` và `TensionChallenge` qua `controller`, tránh khởi tạo ngữ cảnh câu cá thật.

Kiểm tra: `node --test scripts/validate-tutorial.mjs` và `npm run build`.
