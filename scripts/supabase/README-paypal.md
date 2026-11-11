# PayPal support payments

The donation modal keeps the existing bank QR and adds PayPal Web SDK v6 with eligible guest card payments. It accepts voluntary contributions of USD 1.00–1,000.00 and grants no game items or currency. Visa/Mastercard availability depends on the merchant account and PayPal eligibility; adding credentials does not guarantee card acceptance.

## Edge Function source files

Code nằm trong thư mục `supabase/functions/` ở **gốc repo**, khác với thư mục `scripts/supabase/` chứa README và SQL:

| File | Chức năng |
| --- | --- |
| [paypal-donation/index.ts](../../supabase/functions/paypal-donation/index.ts) | Xác thực người dùng, tạo đơn, kiểm tra và xác nhận thanh toán |
| [paypal-webhook/index.ts](../../supabase/functions/paypal-webhook/index.ts) | Nhận và xác thực webhook từ PayPal, cập nhật trạng thái giao dịch |
| [_shared/paypal.ts](../../supabase/functions/_shared/paypal.ts) | Mã dùng chung: kết nối Supabase, gọi PayPal API và đối soát giao dịch |
| [config.toml](../../supabase/config.toml) | Cấu hình triển khai hai Edge Function |

Hai file `index.ts` đều import `../_shared/paypal.ts`. Không chỉ dán riêng một file `index.ts` vào Supabase Dashboard vì sẽ thiếu module dùng chung. Luồng triển khai bên dưới dùng Supabase CLI để đóng gói cả module được import.

Chạy các lệnh deploy ở bước 4 từ thư mục gốc dự án `D:\Vue\fishing`. Deploy thành công mới đưa code lên Supabase; việc có các file này trong repo chưa tạo function trên Dashboard. `_shared` là thư mục dùng chung, không deploy thành function riêng.

## Configure and deploy

1. Create a PayPal Business REST application in the PayPal Developer Dashboard. Start with sandbox credentials and a separate sandbox buyer. Obtain the receiving account's merchant ID. Confirm with PayPal that your account may accept this type of voluntary game support and guest card payments.
2. Run `scripts/supabase/migrations/20261111_paypal_donations.sql` against the intended Supabase database using the SQL editor. This repository keeps SQL migrations in `scripts/supabase/migrations`; `supabase db push` will not discover this file automatically.
3. Set these **Edge Function secrets** in Supabase Dashboard (never in frontend variables or Git):

   | Secret | Value |
   | --- | --- |
   | `PAYPAL_ENVIRONMENT` | `sandbox` initially; `live` for production |
   | `PAYPAL_CLIENT_ID` | REST app client ID |
   | `PAYPAL_CLIENT_SECRET` | REST app secret |
   | `PAYPAL_MERCHANT_ID` | Receiving Business account's merchant ID |
   | `PAYPAL_WEBHOOK_ID` | Webhook ID created in step 5 |
   | `DONATION_ALLOWED_ORIGINS` | Comma-separated exact origins, e.g. `http://localhost:5173,https://your-domain.example` (no paths or trailing slash) |

   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions. Do not expose them in the browser.
4. Đăng nhập Supabase CLI, liên kết đúng project rồi deploy. Trên Windows, mở Terminal trong VS Code và chạy lần lượt:

   ```powershell
   cd D:\Vue\fishing
   npx.cmd --yes supabase@latest login
   ```

   Làm theo hướng dẫn đăng nhập trên terminal/trình duyệt. Lệnh `npx.cmd` chạy CLI qua Node.js, không cần cài Supabase CLI riêng và tránh lỗi PowerShell chặn file `npx.ps1`.

   Sau khi đăng nhập thành công, xem danh sách project:

   ```powershell
   npx.cmd --yes supabase@latest projects list
   ```

   Thay `YOUR_PROJECT_REF` bằng **Reference ID** của project cần triển khai (cũng là phần sau `/project/` trong URL Supabase Dashboard):

   ```powershell
   npx.cmd --yes supabase@latest link --project-ref YOUR_PROJECT_REF
   ```

   Khi liên kết thành công, deploy hai function:

   ```powershell
   npx.cmd --yes supabase@latest functions deploy paypal-donation --use-api
   npx.cmd --yes supabase@latest functions deploy paypal-webhook --use-api
   ```

   `--use-api` đóng gói function trên server, không cần Docker. Mở **Supabase Dashboard → Edge Functions** để kiểm tra có `paypal-donation` và `paypal-webhook` sau khi deploy thành công.

   `supabase/config.toml` disables gateway JWT checks for these functions so modern publishable keys work and PayPal can reach the webhook. **The donation endpoint validates the user's bearer token with Supabase Auth itself on every request.** The webhook verifies the PayPal signature before processing any event.
5. In the same PayPal REST app, create an HTTPS webhook targeting `https://YOUR_PROJECT.supabase.co/functions/v1/paypal-webhook` and subscribe to:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.PENDING`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`

   Save its ID as `PAYPAL_WEBHOOK_ID`. Use actual sandbox transactions for signature tests: PayPal's webhook simulator does not support the postback signature verification API used here.
6. Add `VITE_PAYPAL_CLIENT_ID` and `VITE_PAYPAL_ENVIRONMENT=sandbox` to `.env.local` or your frontend deployment settings. Use the **same app/environment as the backend**, then rebuild the frontend. Leave the client ID empty to keep online payments unavailable while retaining the bank QR.

## Chuyển từ sandbox sang live

Chỉ đổi `sandbox` thành `live` là chưa đủ. Cần thay đồng bộ thông tin ứng dụng, tài khoản nhận tiền, webhook và frontend. Sandbox dùng tài khoản và tiền giả; live sử dụng tài khoản và tiền thật. Tham khảo [hướng dẫn lên production của PayPal](https://developer.paypal.com/api/rest/production/).

### 1. Chuẩn bị tài khoản và ứng dụng live

- Hoàn tất xác minh tài khoản PayPal Business nhận tiền và kiểm tra tài khoản được phép nhận loại khoản ủng hộ này.
- Vào **PayPal Developer → Apps & Credentials → Live**, chọn hoặc tạo ứng dụng REST của tài khoản nhận tiền. Lấy **Client ID và Secret live** từ cùng ứng dụng.
- Lấy **Merchant ID của tài khoản Business thật**. Không dùng Merchant ID của tài khoản sandbox.
- Quyền nhận thẻ ở live có thể khác sandbox; chỉ hiển thị những phương thức SDK xác định đủ điều kiện.

### 2. Chọn Supabase project và xử lý các giao dịch thử

Nên dùng Supabase project riêng cho thử nghiệm và production. Nếu project production mới, chạy file SQL ở bước 2 của phần **Configure and deploy**, rồi cấu hình frontend trỏ tới URL/publishable key của project đó.

Nếu tiếp tục dùng project hiện tại:

- Hoàn tất đối soát các giao dịch sandbox còn chờ trước khi thay cấu hình; đóng các cửa sổ checkout thử đang mở.
- Lưu danh sách ID các giao dịch thử để phân biệt với tiền thật. Bảng `donations` hiện **chưa có cột môi trường**, vì vậy không tính các bản ghi `COMPLETED` sandbox vào tổng tiền thật; đổi secrets không tự chuyển các bản ghi đó thành giao dịch live.
- Backend hiện dùng một bộ secrets cho một môi trường. Không chạy sandbox và live đồng thời trên cùng hai function này.
- Trên trình duyệt đã thử sandbox, sau khi đối soát xong, xóa riêng mục `fishing.paypal-donation.<USER_ID>` trong **DevTools → Application → Session Storage** nếu còn tồn tại. Mục này lưu lượt checkout cũ và không được dùng lại cho live. Không xóa dữ liệu giao dịch thật hoặc toàn bộ storage.

### 3. Tạo webhook live và cập nhật Supabase Secrets

Trong ứng dụng PayPal **Live** vừa chọn, tạo webhook mới tới:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/paypal-webhook
```

Thay `YOUR_PROJECT` bằng reference của Supabase project production. Đăng ký cùng sáu sự kiện ở bước 5 của phần **Configure and deploy**. Lấy **Webhook ID live** mới; không dùng lại Webhook ID sandbox. Cách tạo và xác minh webhook được mô tả trong [tài liệu PayPal](https://developer.paypal.com/api/rest/webhooks/rest/).

Trong **Supabase → project production → Edge Functions → Secrets**, cập nhật:

| Biến backend | Giá trị khi live |
| --- | --- |
| `PAYPAL_ENVIRONMENT` | `live` |
| `PAYPAL_CLIENT_ID` | Client ID của ứng dụng live |
| `PAYPAL_CLIENT_SECRET` | Secret của cùng ứng dụng live |
| `PAYPAL_MERCHANT_ID` | Merchant ID của Business thật nhận tiền |
| `PAYPAL_WEBHOOK_ID` | ID webhook vừa tạo trong ứng dụng live |
| `DONATION_ALLOWED_ORIGINS` | Origin HTTPS thực tế của website, ví dụ `https://your-domain.example`; thêm origin khác chỉ khi cần, không có path hoặc dấu `/` cuối |

Đặt các biến backend ở Supabase Secrets; không đặt Secret trong `VITE_*` hoặc commit vào Git.

### 4. Deploy backend và frontend production

Đăng nhập CLI như bước 4 ở trên, liên kết đúng project production rồi deploy cả hai function:

```powershell
cd D:\Vue\fishing
npx.cmd --yes supabase@latest link --project-ref YOUR_PRODUCTION_PROJECT_REF
npx.cmd --yes supabase@latest functions deploy paypal-donation --use-api
npx.cmd --yes supabase@latest functions deploy paypal-webhook --use-api
```

Trong cấu hình build/deploy frontend, đặt:

```dotenv
VITE_PAYPAL_CLIENT_ID=YOUR_LIVE_CLIENT_ID
VITE_PAYPAL_ENVIRONMENT=live
```

`VITE_PAYPAL_CLIENT_ID` phải trùng `PAYPAL_CLIENT_ID` backend. Nếu đổi Supabase project, cập nhật thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`. Các biến `VITE_*` được đưa vào frontend lúc build, nên thay biến xong phải build và deploy lại:

```powershell
npm run build
```

Đưa bản build mới lên hosting đang dùng và tải lại trang. Backend tự chọn API live và frontend tự chọn SDK live từ các biến môi trường; không cần sửa URL PayPal trong source. Sắp xếp cập nhật trong một khoảng bảo trì ngắn để người dùng không mở checkout khi backend và frontend đang khác môi trường.

### 5. Xác nhận bằng giao dịch thật

- Thanh toán một khoản nhỏ trong giới hạn hiện tại (tối thiểu **1 USD**) bằng tài khoản người trả tiền thật, khác và không liên kết với tài khoản nhận tiền. Không dùng tài khoản sandbox hoặc tài khoản merchant để tự thanh toán.
- Kiểm tra khoản tiền xuất hiện trong tài khoản PayPal Business thật; kiểm tra `paypal_order_id`, `paypal_capture_id`, số tiền, USD và trạng thái `COMPLETED` trong bảng `donations`.
- Kiểm tra popup cảm ơn xuất hiện một lần, webhook live được giao thành công và Edge Function Logs không có lỗi. `APPROVED` hoặc `PENDING` chưa phải xác nhận nhận tiền thành công.
- Nếu cần hoàn lại khoản thử, thực hiện trong PayPal và kiểm tra trạng thái hoàn tiền được webhook cập nhật. Phí thanh toán/chuyển đổi và việc hoàn phí phụ thuộc điều khoản tài khoản PayPal.

Nếu phát sinh lỗi, tạm ngừng checkout online để đối soát. Không chỉ đổi backend về sandbox khi frontend vẫn live; giữ khả năng xử lý webhook/đối soát các giao dịch live đã phát sinh. Hướng dẫn này chỉ chuẩn bị cho lần chuyển sau; bản thân việc sửa README không thay đổi môi trường đang chạy.

## Troubleshooting checkout requests

Nếu request `paypal-donation` trả HTTP 500 với `PAYMENT_UNAVAILABLE`, mở **Supabase Dashboard → Edge Functions → paypal-donation → Logs** để xem lỗi của lần nhấn thanh toán đó. Bản code mới ghi `requestId`, `stage` và mã lỗi an toàn; không ghi token hay giá trị secret.

| Mã phản hồi | Cách xử lý |
| --- | --- |
| `DATABASE_NOT_READY` | Chạy file SQL ở bước 2 trên đúng project. Trong Logs, `PGRST202`/`42883` chỉ RPC chưa khả dụng; `PGRST205`/`42P01` chỉ bảng chưa khả dụng. |
| `DATABASE_ERROR` | Xem `operation` và `databaseCode` trong Logs để xác định lỗi quyền hoặc ràng buộc dữ liệu. |
| `MISSING_CONFIGURATION` | Thêm secret có tên trong trường `variable` vào **Edge Functions → Secrets**. Biến `VITE_*` ở frontend không thay thế secret backend. |
| `INVALID_CONFIGURATION` | Kiểm tra biến có tên trong `variable`; `PAYPAL_ENVIRONMENT` chỉ nhận `sandbox` hoặc `live`. |
| `INVALID_DATABASE_RESPONSE` | Kiểm tra RPC `prepare_paypal_donation` đang dùng đúng định nghĩa SQL đi kèm repo. |
| `PROVIDER_UNAVAILABLE` | Xem trường `provider` trong phản hồi hoặc Logs để biết lỗi OAuth hay API tạo đơn; đối chiếu hướng dẫn bên dưới. Lỗi PayPal HTTP không thành công trả 502, khác với lỗi nội bộ 500. |

Phản hồi `PROVIDER_UNAVAILABLE` mới chứa các trường chẩn đoán an toàn:

- `providerOperation: oauth`, `providerStatus: 401`, `providerError: invalid_client`: kiểm tra cặp `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` của cùng ứng dụng và đúng môi trường. Không dùng Client ID sandbox với Secret live hoặc ngược lại.
- `providerOperation: api`: PayPal đã cấp access token, nhưng từ chối một API tiếp theo. Xem `providerError` và `providerIssue`, ví dụ `PAYEE_ACCOUNT_INVALID` để kiểm tra tài khoản nhận tiền. Trong sandbox, `PAYPAL_MERCHANT_ID` phải là merchant ID của tài khoản **sandbox Business**, không phải merchant ID tài khoản live, Client ID hay Webhook ID.
- `paypalDebugId`: mã đối chiếu khi cần liên hệ hỗ trợ PayPal.

`PAYPAL_ENVIRONMENT` ở backend và `VITE_PAYPAL_ENVIRONMENT` ở frontend phải cùng là `sandbox` hoặc cùng là `live`; Client ID frontend phải trùng Client ID backend. Các mô tả lỗi tự do, token, giá trị secret và dữ liệu người thanh toán không được ghi log hoặc trả về trình duyệt.

Sau khi sửa code backend, deploy lại **cả hai function** vì chúng dùng chung `_shared/paypal.ts`:

```powershell
npx.cmd --yes supabase@latest functions deploy paypal-donation --use-api
npx.cmd --yes supabase@latest functions deploy paypal-webhook --use-api
```

Nếu vẫn lỗi, gửi `code`, `requestId` và dòng log tương ứng; không gửi token, mật khẩu hoặc giá trị secret.

## Verification before live payments

- Run `npm run build`, `npm run check:i18n`, and `node scripts/validate-paypal.mjs`.
- In sandbox, complete a PayPal transaction and an eligible guest card transaction. Verify the amount, currency, merchant, capture ID and `COMPLETED` status in `public.donations`.
- Test invalid amounts, cancellation, a declined instrument, pending payments, unauthenticated requests, another user's donation ID, a forged webhook, and repeated/concurrent capture requests. Only a verified completed capture produces the success message.
- Disconnect the browser during capture, reopen the modal, and use **Check / complete existing transaction**. The active attempt is retained in session storage; the server uses stable PayPal idempotency keys and reads PayPal state before capture retries. The frontend never handles card numbers or CVV.
- Replay webhook deliveries, and refund a sandbox capture. Verify that repeated/delayed notifications do not roll back completed/refunded states. Monitor Edge Function logs and unsettled donations for provider/network failures. Webhooks reconcile payment state but do not initiate a charge on approval alone.
- Each account can create up to 10 checkout attempts per hour. An uncertain create attempt is not recreated after five hours, before PayPal's default six-hour idempotency window expires. If a tab is closed and session recovery is lost, inspect the donation ledger before asking the supporter to pay again.
- Follow **Chuyển từ sandbox sang live** above to switch backend/frontend configuration, deploy and verify a small real transaction. Fees and currency conversion follow your PayPal account terms.

## Implementation

`DonationPayment.vue` handles presentation and SDK sessions; `useDonationStore` manages state and recovery; `supabaseDonationRepository` invokes the backend. The authenticated function owns create/capture operations, checks the configured merchant and USD amount, and records canonical provider status. Only the service role may insert or update the donation ledger; authenticated users may select their own records. There are no automatic in-game rewards or privileged client writes.

Official references: [PayPal Web SDK v6](https://developer.paypal.com/sdk/js/set-up), [sessions and guest payments](https://developer.paypal.com/sdk/js/reference/), [webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/), [Supabase function authentication](https://supabase.com/docs/guides/functions/auth).
