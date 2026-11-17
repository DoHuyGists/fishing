# VAI TRÒ & MỤC TIÊU
Thiết kế và xây dựng một hệ thống kể chuyện 2D (Visual Novel / Storytelling Engine) lấy cảm hứng từ phong cách của tựa game **Goddess of Victory: Nikke**.

Tạo route /story dành riêng để phát kịch bản.

Hệ thống bao gồm 2 module độc lập nhưng dùng chung một chuẩn định dạng dữ liệu JSON:
1. **Scenario Builder (Công cụ xây dựng kịch bản):** Giao diện trực quan để biên kịch/designer tạo hội thoại, cấu hình nhân vật, biểu cảm, hiệu ứng màn hình và xuất ra file JSON. Cái này sẽ được tạo ở trong thư mục @admin
2. **Story Player (Công cụ trình bày/trình chiếu kịch bản):** Engine đọc dữ liệu JSON từ module 1 để diễn hoạt thành phân cảnh cốt truyện hoàn chỉnh.
Thêm một nút trong @FeatureTable.vue để mở StoryModal.vue để chứa các phần story.
Tạo StoryView.vue (route /story) trong thư mục @view, khi nhấn mở một phần cốt truyện sẽ mở view này.

---

# TECH STACK ĐỀ XUẤT
- **Animation & VFX:** CSS Keyframes / GSAP (hoặc PixiJS nếu cần hiệu năng cao cho các lớp Parallax).
- Nhân vật mẫu lấy trong /public/faction/
---

# CHI TIẾT YÊU CẦU TỪNG PHẦN

## PHẦN 1: CHUẨN DỮ LIỆU KỊCH BẢN (JSON SCHEMA)
Trước tiên, hãy định nghĩa một interface TypeScript (`StoryScript`, `SceneNode`, `CharacterState`, `VFXAction`) thật rõ ràng để kết nối Phần 1 và Phần 2. Mỗi `SceneNode` (một bước/dòng thoại) cần hỗ trợ:
- `id`: string (UUID)
- `speaker`: { id: string, name: string, title?: string }
- `dialogue`: string (hỗ trợ các thẻ định dạng cơ bản như nhấn mạnh, đổi màu)
- `background`: { url: string, transition: 'fade' | 'none' | 'flash' }
- `characters`: Mảng các nhân vật đang xuất hiện trên màn hình (tối đa 3 nhân vật: `left`, `center`, `right`), mỗi nhân vật gồm:
  - `characterId`: string
  - `expression`: string (`normal`, `happy`, `angry`, `shocked`, `sad`)
  - `isSpeaking`: boolean (nhân vật đang nói sẽ sáng rõ và hơi phóng to, nhân vật nghe sẽ tối màu đi - dim)
  - `animation`: `'none' | 'bounce' | 'shake' | 'slide-in' | 'fade-out'`
- `vfx`: Hiệu ứng toàn màn hình (`'none' | 'screen-shake' | 'flash-white' | 'flash-red' | 'vignette-pulse'`)
- `audio`: { bgm?: string, sfx?: string, voice?: string }
- `choices` (tùy chọn): Mảng các lựa chọn rẽ nhánh cho người chơi (nhảy tới `nextNodeId`).

---

## PHẦN 2: CÔNG CỤ XÂY DỰNG KỊCH BẢN (SCENARIO EDITOR)
Xây dựng giao diện quản lý dạng 3 cột (tương tự các công cụ làm game chuyên nghiệp):
- **Cột trái (Timeline / Node List):**
  - Hiển thị danh sách các bước hội thoại (Nodes) theo thứ tự.
  - Cho phép Thêm node mới, Nhân bản (Duplicate), Xóa, và Kéo thả (Drag & Drop) để sắp xếp lại thứ tự.
- **Cột giữa (Live Mini-Preview):**
  - Khung màn hình tỷ lệ 16:9 thu nhỏ hiển thị ngay lập tức bố cục nhân vật, phông nền và hộp thoại của node đang chọn.
- **Cột phải (Inspector / Properties Panel):**
  - Form chỉnh sửa chi tiết cho node hiện tại: Chọn phông nền, thêm/xóa nhân vật vào các slot (Trái/Giữa/Phải), đổi biểu cảm, chọn hiệu ứng rung/chớp màn hình, nhập nội dung thoại.
- **Thanh công cụ trên cùng (Toolbar):**
  - Quản lý thư viện tài nguyên mẫu (Mock Assets: vài nhân vật với các biểu cảm khác nhau, vài phông nền mẫu).
  - Nút **Export JSON**, **Import JSON**, và nút **Play Test** (mở ngay Phần 3 để chạy thử từ node hiện tại).

---

## PHẦN 3: CÔNG CỤ TRÌNH BÀY KỊCH BẢN (2D STORY PLAYER)
Xây dựng trình phát cốt truyện toàn màn hình với trải nghiệm mượt mà:
- **Sân khấu hiển thị (Stage):**
  - Hiển thị Background với hiệu ứng chuyển cảnh mượt mà.
  - Render các nhân vật đúng vị trí (`left`, `center`, `right`). Tự động làm tối (brightness-50) những nhân vật không nói và highlight nhân vật đang nói.
  - Thực thi chính xác các hiệu ứng VFX (`screen-shake`, `flash`, `bounce`) khi bước sang node mới.
- **Khung hội thoại (Dialogue Box phong cách Sci-fi/Nikke):**
  - Hiển thị tên nhân vật + chức danh (nếu có).
  - **Hiệu ứng Typewriter:** Chữ chạy từng ký tự một. Nếu người dùng click khi chữ đang chạy, lập tức hiển thị toàn bộ câu thoại; nếu chữ đã chạy xong, click sẽ chuyển sang node tiếp theo.
- **Hệ thống điều khiển (HUD Controls):**
  - **Auto:** Tự động chuyển câu thoại sau khi chạy xong chữ (có thanh tiến trình nhỏ hoặc indicator).
  - **Skip:** Tua nhanh hoặc bỏ qua toàn bộ phân cảnh (có popup xác nhận kèm tóm tắt ngắn).
  - **Log (Lịch sử):** Mở modal xem lại toàn bộ các câu thoại đã đi qua.
  - **Hide UI:** Ẩn toàn bộ khung thoại và nút bấm để ngắm trọn hình ảnh nhân vật và phông nền (click bất kỳ đâu để hiện lại UI).

---

# YÊU CẦU TRIỂN KHAI
Hãy thực hiện theo từng bước rõ ràng:
1. Tạo cấu trúc thư mục và định nghĩa TypeScript Interfaces
2. Xây dựng **Story Player** trước để đảm bảo các hiệu ứng diễn hoạt, typewriter và state hoạt động hoàn hảo.
3. Xây dựng **Scenario Editor** kết nối trực tiếp với store dữ liệu.
4. Đảm bảo UI hiện đại, hỗ trợ phím tắt (`Space` / `Enter` để next thoại, `H` để ẩn UI) và xử lý clean-up các timer/interval của hiệu ứng typewriter tránh memory leak.
5. Xây dựng các bảng, rpc phù hợp để chạy được thực tế. (tạo sẵn 1 kịch bản mẫu ngắn khoảng 5-7 câu thoại có đầy đủ hiệu ứng rung màn hình, đổi biểu cảm và 2 nhân vật đối đáp để test ngay).