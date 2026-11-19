# Fishing

Trò chơi câu cá dùng Vue 3 Composition API, TypeScript, Pinia, Tailwind CSS và Supabase. Giao diện người chơi hỗ trợ tiếng Việt và tiếng Anh.

## Chạy cục bộ

Dùng Node.js 24 và npm với `package-lock.json` trong repo. Các lệnh dưới đây chạy từ thư mục gốc; trên PowerShell dùng `npm.cmd` nếu execution policy chặn `npm.ps1`.

1. Chạy `npm.cmd ci`.
2. Tạo `.env.local` với cấu hình Supabase thử nghiệm:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

3. Chạy `npm.cmd run dev`, mở địa chỉ Vite in ra trong terminal.
4. Chạy `npm.cmd run build` để kiểm tra TypeScript và tạo `dist/`; `npm.cmd run preview` để xem bản build.

Các biến `VITE_*` được đưa vào frontend. Chỉ dùng publishable key; không đặt service-role key hay secret PayPal vào đây. Frontend cần database/Auth/Storage đã cấu hình; checkout hiện chưa đủ baseline để tự dựng toàn bộ backend mới.

## Kiến trúc và refactor

Component giữ tương tác nhập liệu; Pinia store quản lý dữ liệu và action; các `src/data/supabase*Repository.ts` thực hiện truy vấn/RPC/Realtime qua connection chung. Type dùng lại trong `src/types/model` và `src/types/table`; component dùng chung ở `src/components/shared`. Bản dịch nằm trong `src/i18n/locales`.

Refactor theo từng module và cập nhật tài liệu ngay trong cùng đợt. Xem [sổ refactor](docs/module-refactoring.md) để biết module đã chuyển, hợp đồng giữ lại và công việc tiếp theo. [Checklist](improve-checklist.md) theo dõi các vấn đề còn mở và giới hạn kiểm chứng.

## Kiểm tra

```powershell
npm.cmd run build
npm.cmd run check:i18n
node --test --test-isolation=none scripts/test-redeem-code.mjs
```

Chạy nhóm hồi quy tương ứng qua các lệnh trong `package.json`, ví dụ `npm.cmd run test:game-cache`, `npm.cmd run test:dispatch`, `npm.cmd run test:story`. Các file Node/SQL khác có thể chạy riêng bằng `node --test --test-isolation=none scripts/<ten-file>.mjs`; SQL dùng PGlite với schema thử nghiệm. Chạy riêng từng file giúp tránh chia sẻ mock giữa các nhóm.

Các script `test-*-browser.mjs` cần trình duyệt Chromium tương thích Playwright; xem biến cấu hình executable trong từng script trước khi chạy. Test local/mock và build không thay thế kiểm chứng RLS, trigger, Auth email, Storage, Realtime hoặc thanh toán trên staging.

## Database và triển khai

Chưa có baseline Supabase CLI thống nhất. Trước khi chạy SQL, đối chiếu schema/RPC hiện có, sao lưu và đọc prerequisites của từng module. Không chạy toàn bộ thư mục SQL theo thứ tự tên: một số file là function body để cập nhật trong SQL Editor.

- [Tính năng người chơi và kiểm tra tích hợp](scripts/supabase/README-player-features.md)
- [Trang bị và hợp đồng chỉ số](scripts/supabase/README-equipment-mechanics.md)
- [Quay thưởng và thứ tự cài helper](scripts/supabase/rpc/spining-wheel/README.md)
- [Nuôi cá và điều kiện schema/seed](scripts/supabase/migrations/aquaculture/README.md)
- [Dispatch](scripts/supabase/README-dispatch.md)
- [PayPal và yêu cầu backend](scripts/supabase/README-paypal.md) — source Edge Functions được tài liệu nhắc tới chưa có trong checkout; xem IC-07 trước khi triển khai.
- [Các khuyến nghị database đã đối chiếu với source](scripts/supabase/README-improve.md)

IC-09 trong checklist theo dõi baseline, Auth/Storage/Realtime và nghiệm thu một môi trường mới. Các runbook module hiện bổ sung cho backend đang có, chưa phải quy trình dựng database rỗng.
