# Kho ảnh/video và thư mục logic

Chạy các file sau trong Supabase SQL Editor, theo thứ tự, trước khi dùng giao diện mới:

1. `migrations/admin_assets.sql` nếu bucket và quyền quản trị chưa được thiết lập.
2. `migrations/asset_folders.sql` để tạo bảng `public.assets`, RLS và RPC chuyển thư mục.

Migration thứ hai nhập ảnh/video đang có trong bucket `admin-assets` vào thư mục logic gốc (`folder = ''`). Giữ nguyên `path`, thời gian tạo và URL. Có thể chạy lại để nhập thêm tệp tải trực tiếp từ Storage; các bản ghi đã có không bị ghi đè. Sau khi triển khai, nên upload qua ứng dụng để tạo cả tệp và bản ghi metadata.

`folder` là đường dẫn logic như `Hướng dẫn/Câu cá/`, không phải đường dẫn Storage. `path` là object key tương đối trong bucket. URL công khai được sinh từ `path`, không lưu trong bảng. Đổi tên/chuyển nhánh chỉ cập nhật `folder` trong một transaction và từ chối ghi đè thư mục đích đã tồn tại. Xóa tệp vẫn làm mất ảnh/video ở các nội dung đang sử dụng link đó.

Chỉ admin được đọc hoặc thay đổi bảng. Bucket tiếp tục phục vụ ảnh/video công khai như trước. Không cần thêm quyền di chuyển object Storage vì chức năng chuyển chỉ sửa metadata.

Chỉ dùng một bảng `assets`: cây thư mục được suy ra từ các bản ghi. Thư mục trống do người dùng tạo chỉ tồn tại trong phiên ứng dụng cho đến khi có tệp. Tải lại trang sẽ mất thư mục chưa có tệp; không có thao tác xóa đệ quy cả thư mục.

Giao diện có ba chế độ: **Danh sách (List)**, **Lưới (Grid)**, **Cây (Tree)**. List/Grid mặc định tìm trong thư mục hiện tại; tùy chọn "Bao gồm thư mục con" mở rộng phạm vi. Tree luôn tìm trong cả nhánh và tự mở các nhánh có kết quả. Có thể mở/thu gọn các nhánh hoặc chọn thư mục làm gốc xem hiện tại. Các chức năng này dùng chung cho màn quản lý và trình chọn ảnh/video trong trình soạn thảo.

Kiểm tra tự động, không truy cập dịch vụ thật:

```sh
node --test scripts/validate-assets.mjs
npm run build
```

Sau khi chạy migration trên Supabase, kiểm tra thủ công bằng tài khoản admin:

- Tệp cũ xuất hiện ở gốc và link trong các bài viết cũ vẫn hoạt động.
- Tạo thư mục nhiều cấp, upload ảnh/video, tải lại trang và kiểm tra cây thư mục.
- Kiểm tra tìm tên, lọc ảnh/video, điều hướng và cả ba chế độ xem.
- Chuyển tệp về gốc hoặc sang thư mục mới; đổi tên/chuyển cả nhánh. Kiểm tra URL không đổi và từ chối chuyển vào thư mục con hoặc thư mục đích đã có.
- Mở kho từ `RichEditor`, upload/chọn tệp, lưu bài và kiểm tra ảnh/video trong nội dung.
- Kiểm tra tài khoản không phải admin không được đọc/ghi `assets` hoặc gọi `assets_move_folder`.

Kiểm thử tự động mock ranh giới I/O; không thay thế kiểm tra migration/RLS trên PostgreSQL và thao tác giao diện trong trình duyệt.
