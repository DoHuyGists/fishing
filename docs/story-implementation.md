# Story — đợt 1

Đợt này có Story Player, Scenario Builder, lưu/xuất bản trên Supabase, tiến độ theo phiên bản và một truyện mẫu 7 node có hai nhánh. Các component được viết riêng trong `src/components/story/` và `src/components/admin/story/`; không sử dụng component shared hoặc component tính năng khác.

## Mở tính năng

- Người chơi: nút **Cốt truyện** ở FeatureTable → chọn chương. `/story` cũng mở thư viện; `/story?id=<UUID>` mở một chương đã xuất bản.
- Quản trị: **Cốt truyện → Biên tập kịch bản**, hoặc `/admin?module=story`.
- Demo không cần bảng story: `/story?id=51000000-0000-4000-8000-000000000001&demo=1`. Vẫn yêu cầu đăng nhập. Demo chạy cục bộ và không ghi tiến độ.
- Route story có `localContext`, không bị chuyển về `/fishing` khi tài khoản đang ở bãi câu. Route không thay đổi trạng thái tham gia bãi câu.

## Áp dụng database

Nếu môi trường đã có `20261112_feature_flags.sql`, chỉ chạy lần lượt hai file mới trong Supabase SQL Editor:

1. `scripts/supabase/migrations/20261117_story.sql`
2. `scripts/supabase/migrations/20261117_story_media.sql`

Migration đầu tạo bảng, RLS, RPC, feature flag và seed truyện đã xuất bản. Migration sau tạo bucket `story-media` và policy upload/liệt kê dành cho admin. Các file này đã được kiểm tra bằng PostgreSQL cục bộ qua PGlite; chưa áp dụng vào Supabase thật từ phiên làm việc này. Migration tạo schema chỉ chạy một lần trên mỗi môi trường.

Không chạy lại migration feature flags cũ chỉ để bật story. Bản cũ trong repo được cập nhật danh mục nhằm đồng bộ môi trường cài mới; migration story tự đăng ký các endpoint cho môi trường đang sử dụng.

Nếu chưa áp dụng migration mới, thiếu flag story chỉ khóa story phía máy chủ, không khóa các tính năng cũ. Demo cục bộ và Editor vẫn mở được qua URL; thao tác database sẽ báo lỗi rõ ràng, không giả lập lưu thành công.

## Soạn và xuất bản

- Tạo chương mới hoặc dùng **Truyện mẫu**. Sửa tiêu đề/tóm tắt và thứ tự ở tab **Chương**; cấu hình thư viện nhân vật và media ở **Assets**.
- Timeline hỗ trợ thêm, nhân bản, xóa, kéo thả và nút lên/xuống. Kéo thả chỉ thay thứ tự hiển thị. Luồng thực thi dùng đường nối UUID trong Inspector.
- Thêm node chèn vào đường nối thường của node đang chọn. Nhân bản tạo UUID mới cho node/lựa chọn và giữ đích nối để người soạn tự kết nối. Xóa node nối qua `nextNodeId` và gỡ lựa chọn trỏ tới node đó, sau khi xác nhận.
- Node có lựa chọn luôn đợi người chơi chọn. Nếu không có lựa chọn, `nextNodeId: null` kết thúc chương. Node không thể tới được hiện cảnh báo; nhánh không có đường đến kết thúc bị từ chối.
- **Play Test** mở Player từ node đang chọn; quay lại giữ nguyên bản nháp và lựa chọn node. Preview không ghi tiến độ thật. BGM kế thừa ở preview lấy từ node trước trong timeline; nên đặt BGM rõ ràng ở đầu nhánh nếu muốn kiểm tra riêng một nhánh.
- **Lưu nháp** không thay nội dung người chơi đang đọc. **Xuất bản** lưu bản nháp rồi tạo snapshot mới. **Ẩn chương** ngăn mở chương và cập nhật tiến độ qua API.
- Bản nháp tự lưu trên thiết bị theo tài khoản; đóng Editor không làm mất bản cục bộ. Ctrl/Cmd+S lưu lên Supabase. Xung đột revision yêu cầu nạp lại bản máy chủ; có thể xuất JSON trước để giữ bản đang sửa.
- Import kiểm tra dữ liệu rồi tạo chương với ID mới, tránh ghi đè chương đã có. Export cũng hoạt động với bản nháp chưa hợp lệ để bảo toàn công việc đang soạn.

## Hợp đồng dữ liệu

Interfaces nằm trong `src/types/model/story.ts`, kiểu dữ liệu repository trong `src/types/table/story.ts`. `schemaVersion` hiện là `1`; thoại, tiêu đề, tóm tắt, tên và lựa chọn đều có `vi/en`.

Mỗi node chứa bố cục hoàn chỉnh: background, tối đa ba nhân vật ở các slot khác nhau, speaker hoặc narrator, dialogue, VFX, audio, choices và nextNodeId. `characters` cấp script ánh xạ nhân vật sang ảnh biểu cảm. IDs node/lựa chọn/chương là UUID; ID thư viện nhân vật là chuỗi duy nhất.

Dialogue hỗ trợ `strong/b`, `em/i`, `br` và màu văn bản của `span`. Markup được lọc, sau đó chuyển thành token grapheme; typewriter không cắt HTML và không tách emoji ghép/dấu tiếng Việt. Không cho phép script, event handler, ảnh hoặc CSS tùy ý trong thoại.

Audio: thiếu `bgm` giữ track trước; chuỗi rỗng dừng BGM. SFX/voice chỉ thuộc node hiện tại. Auto đợi chữ và voice xong, dừng ở lựa chọn, và tạm dừng khi mở Log/popup hoặc tab trình duyệt bị ẩn. Tương tác bắt đầu giúp mở audio theo cơ chế của trình duyệt; nếu thiết bị không phát được thì vẫn tiếp tục bằng phụ đề.

Giới hạn: 1–1000 node, tối đa 100 nhân vật, 8 lựa chọn/node, JSON import tối đa 2 MB và media tối đa 30 MB/file. URL nhận đường dẫn nội bộ, HTTPS hoặc asset builtin; không nhận JavaScript/data URL.

## Lưu trữ và phân quyền

- `story_scripts`: bản nháp, revision, trạng thái công khai, phiên bản đang phát và thứ tự.
- `story_releases`: snapshot bất biến theo `(story_id, version)`.
- `story_progress`: node hiện tại, log tối đa 1000 node, trạng thái hoàn thành/bỏ qua theo `(user_id, story_id, version)`.
- `story_save_draft`, `story_publish`, `story_unpublish`: chỉ admin; ghi trực tiếp bảng bị cấm với client.
- `story_catalog`, `story_get`: chỉ người đăng nhập, chỉ nội dung đang công khai, kiểm tra feature flag tại server.
- `story_save_progress`: chỉ ghi cho `auth.uid()`, kiểm tra phiên bản, node, đường đi trong log và điều kiện kết thúc. Bỏ qua không tự chọn nhánh hoặc trao thưởng.

Checkpoint được xếp hàng để phản hồi chậm không đảo ngược thứ tự. Khi lỗi mạng, checkpoint chưa đồng bộ còn trong bộ nhớ của phiên; có nút thử lại và thử lại khi có mạng. Tải lại trang khi vẫn mất mạng có thể mất checkpoint chưa gửi. Xuất bản phiên bản mới bắt đầu tiến độ riêng; dữ liệu phiên bản cũ vẫn được giữ.

Không cần Realtime hoặc cron cho phiên bản này. Frontend chỉ truy cập Supabase qua `supabaseStoryRepository`.

## Media dự phòng

- `builtin:dawn`, `builtin:night`, `builtin:storm`: phong cảnh dựng bằng CSS.
- `builtin:signal`, `builtin:impact`: SFX tổng hợp; BGM builtin là âm nền nhẹ tổng hợp bằng Web Audio.
- Nhân vật mẫu dùng ảnh trong `/public/faction/character/`. Thiếu biểu cảm dùng ảnh normal, tông màu và nhãn biểu cảm; lỗi toàn bộ ảnh dùng silhouette. Một số ảnh gốc còn nền trắng, sẽ cần thay bằng ảnh tách nền ở đợt media tiếp theo.
- Ảnh nền lỗi dùng phong cảnh CSS. Voice thiếu/lỗi không phát âm thanh; nội dung thoại vẫn hoạt động.
- Kho story nhận PNG/JPEG/WebP/AVIF, MP3/OGG/WAV/M4A/WebM. URL media công khai theo thiết kế. Không cung cấp xóa media phía client để giữ URL trong các bản đã xuất bản.

## Kiểm tra

- `npm run build`: TypeScript và production bundle.
- `npm run test:story`: validator, state Player/Editor, thứ tự và retry checkpoint, đổi tài khoản; thực thi hai migration trên PGlite để kiểm tra RLS, quyền RPC, revision, snapshot và tiến độ.
- `npm run test:story:browser`: Edge/Chromium headless, dữ liệu repository giả lập; kiểm tra Player, rẽ nhánh, markup, VI/EN, Editor/preview, import/export, xuất bản, tiến độ, desktop/mobile và công tắc tính năng. Đặt `STORY_TEST_BROWSER` nếu cần chỉ định browser.
- `npm run check:i18n`: tính đầy đủ của bản dịch và các tham chiếu trong mã nguồn.

Ảnh kiểm tra nằm trong `artifacts/story/`.
