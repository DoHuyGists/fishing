# Nuôi cá — SQL và tích hợp ứng dụng

Người dùng đã xác nhận setup DB xong theo bộ SQL này. Ứng dụng đã nối 8 RPC người chơi và bổ sung quản lý dữ liệu nguồn. Agent chưa kết nối hoặc thực thi SQL lên Supabase thật.

**DB đã có 01–05: chỉ cần chạy thêm `07_admin_access.sql` để admin có quyền ghi cấu hình loài/thức ăn.** Không chạy lại 01–05. File 07 dùng `user_profile.is_admin`, chỉ mở ghi hai bảng nguồn; dữ liệu ao/lứa/cá của người chơi vẫn thay đổi qua RPC.

## Các quyết định đã áp dụng

1. Dùng lại `user_profile`, `currency`, `caught`, `items`, `user_inventory` và quyền/ràng buộc hiện có. Không viết lại RLS của các bảng này. Bổ sung riêng cột `user_profile.pond_slot` và trigger bảo vệ giới hạn.
2. Ao mới có sức chứa **100 điểm**. Tổng `capacity` của cá còn trong ao phải **nhỏ hơn** sức chứa, không phải nhỏ hơn hoặc bằng. Ví dụ capacity loài = 5 thì tối đa 19 cá trong ao trống, không phải 20. Sức chứa có thể nâng sau này; chưa tạo RPC nâng cấp.
3. `pond_slot` mặc định **1**, tối đa 5. Ao đầu miễn phí được tạo khi gọi `get_aquaculture_farm` hoặc RPC nuôi lần đầu. Ao tiếp theo mua bằng `purchase_pond_slot`, mỗi lần **300 `currency.shells`**; tạo luôn ao mới sức chứa 100 trong cùng giao dịch.
4. Mock cấu hình cho cá chép, cá tra, cá lóc và 3 item thức ăn; file seed riêng, tùy chọn.
5. Có hai chế độ chăm sóc chọn lúc thả: `simple` và `advanced`. Không cá chết, không giảm phẩm chất vì bỏ chăm, không yêu cầu đăng nhập để duy trì tăng trưởng.
6. `transfer_aquaculture_fish(UUID[], UUID)` nhận mảng ID cá, kiểm tra toàn bộ rồi loop chuyển từng con sang `caught`; thất bại bất kỳ con nào thì rollback cả lần chuyển.
7. Phải có bản ghi loài trong **`caught_diary`** của người chơi mới mua giống và thả được. Cá đã bán vẫn mở quyền nuôi. Không lấy cá trong `caught` làm cá giống và không tự ghi thêm phát hiện vào sổ câu.
8. Bỏ cá nổi bật và kho trưng bày riêng. Mỗi cá trong lứa có cơ hội thành **siêu đặc biệt**, được đánh dấu `is_super_special = true`, `is_shiny = true`, 5 sao. Cá này tiếp tục ở trong ao và chiếm sức chứa bình thường. Giao diện có ánh sáng/dấu đặc biệt; chưa làm tính năng riêng tiếp theo.
9. Một ao có nhiều lứa cùng lúc; mỗi lứa một loài. Có thể nuôi 2–3 loài trong cùng ao, miễn tổng mức chiếm dụng hợp lệ.
10. Thời gian nuôi là `grow_seconds` riêng từng loài, do admin cân bằng theo thị trường. Hiện đặt CHECK lớn hơn 60 giây. Không tự đọc thời gian trong RPC câu cá; không có hệ số thức ăn làm rút ngắn thời gian này.

## Hai luồng trải nghiệm

| | Đơn giản (`simple`) | Thử thách (`advanced`) |
| --- | --- | --- |
| Tăng trưởng | Tự lớn, kể cả offline | Tự lớn, kể cả bỏ chăm |
| Thức ăn | Chăm cơ bản đã tính trong phí giống, không cần tiêu item | Có thể cho ăn item phù hợp từng loài |
| Chăm ao | Không bắt buộc | Tùy chọn thay nước/sục khí để tăng chất lượng |
| Thời gian lớn | Đúng cấu hình loài | Đúng cấu hình loài, không bị kéo dài vì quên chăm |
| Thành quả | Cân nặng cơ bản, cơ hội siêu đặc biệt cơ bản | Chăm tốt tăng cân nặng tối đa 20% và tăng cơ hội siêu đặc biệt theo cấu hình |

`quality_score` từ 0 đến 1, chỉ tăng và không giảm. Cho ăn có thời gian chờ theo snapshot loài (mock: 1 giờ); chỉ trừ item khi còn có lợi và đủ cả khẩu phần. Một khẩu phần cần `ceil(tổng capacity đàn còn lại / capacity_units_per_item)` item. Lựa chọn món ăn tùy giá, độ phủ khẩu phần và điểm chất lượng.

Chăm ao tác động các lứa thử thách chưa trưởng thành trong ao: `water` tăng 0,1 chất lượng, chờ 4 giờ; `oxygen` tăng 0,03, chờ 1 giờ. Dùng chung thời gian chờ chăm ao. Đây là thông số thiết kế mẫu để review, không phải nghĩa vụ phải vào game theo giờ. Cả chế độ thử thách không được chăm vẫn nhận kết quả cơ bản.

Khi đến `ready_at`, lần RPC tiếp theo chốt từng cá: cân nặng ngẫu nhiên trong khoảng 90–110% cân nặng cấu hình, nhân thưởng chất lượng; cá siêu đặc biệt nhân thêm `rare_weight_multiplier`. Tỷ lệ cơ bản và thưởng thử thách chụp ở lúc thả. Chỉ quay một lần và lưu kết quả, không quay lại khi mở ao hoặc gửi lại RPC. Không cần cron hoặc ghi database mỗi giây.

## Cấu trúc mới: 6 bảng, 2 view

| Bảng | Vai trò |
| --- | --- |
| `aquaculture_species_rules` | Loài được nuôi, capacity, thời gian, giá giống, cân nặng, giá bán và tỷ lệ đặc biệt. |
| `aquaculture_species_foods` | Nhiều thức ăn từ `items` cho mỗi loài; khẩu phần và điểm chất lượng. |
| `aquaculture_ponds` | Ao đã mở, vị trí 1–5, sức chứa và lịch chăm. |
| `aquaculture_batches` | Một lứa/một loài, chế độ chăm, thời điểm trưởng thành, chất lượng và snapshot cấu hình. |
| `aquaculture_fish` | Mỗi cá có ID, mức chiếm dụng, cân nặng, phẩm chất, cờ đặc biệt và trạng thái. |
| `aquaculture_actions` | Biên nhận đầu vào/kết quả của các thao tác, tiền/thức ăn tiêu thụ và ID cá chuyển. |

View `aquaculture_pond_occupancy` tính tổng điểm và chỗ còn dùng được theo quy tắc nghiêm ngặt (`capacity - 1 - used_capacity`). View `aquaculture_records` ghi kỷ lục cá đã trưởng thành, kể cả cá đã bán/chuyển; chỉ là lịch sử, không có kho giữ cá riêng. Cả hai view áp dụng RLS qua `security_invoker`.

Mỗi cá được tạo dòng riêng ngay khi thả, phục vụ chọn ID và phát hiện cá siêu đặc biệt. Với 100 điểm/ao, mức chiếm dụng nhỏ nhất 1 và tối đa 5 ao, hiện tối đa 495 cá còn trong các ao/người. Cá đã trưởng thành vẫn chiếm chỗ đến khi bán, chuyển hoặc thả đi. Không tự thu hoạch hoặc tự chuyển.

Trạng thái cá: `growing → ready → sold/transferred/released`; có thể thả đi ngay khi còn `growing`, không hoàn phí giống. Lứa chuyển `closed` khi không còn cá trong ao; không đóng lứa sớm khi chỉ chuyển/bán một phần. Không xóa bản ghi cá đã rời ao để giữ lịch sử và nguồn gốc.

## RPC công khai

| RPC | Tham số | Kết quả chính |
| --- | --- | --- |
| `get_aquaculture_farm` | Không có | Tạo ao đầu nếu cần, chốt cá đến hạn, trả ao/lứa/cá còn nuôi và loài có thể mở giống. |
| `purchase_pond_slot` | `p_request_id UUID` | Trừ 300 vỏ sò, tăng suất và tạo ao mới 100 điểm. |
| `stock_aquaculture_batch` | `p_pond_id, p_species_id, p_quantity, p_mode, p_request_id` | Trừ tiền `cash` mua giống, tạo lứa và trả mảng ID cá. |
| `feed_aquaculture_batch` | `p_batch_id, p_inventory_id, p_request_id` | Trừ thức ăn, tăng chất lượng lứa thử thách. |
| `care_aquaculture_pond` | `p_pond_id, p_task ('water'/'oxygen'), p_request_id` | Chăm các lứa thử thách và đặt thời gian chờ ao. |
| `sell_aquaculture_fish` | `p_fish_ids UUID[], p_request_id` | Bán các cá trưởng thành được chọn, cộng tiền `cash`. |
| `transfer_aquaculture_fish` | `p_fish_ids UUID[], p_request_id` | Chuyển cá trưởng thành sang kho `caught` trạng thái `normal`, trả cặp ID nguồn/đích. |
| `release_aquaculture_fish` | `p_fish_ids UUID[], p_request_id` | Bỏ các cá được chọn để giải phóng chỗ, không hoàn tiền. |

Các ID đơn có kiểu UUID, `p_quantity` là INTEGER, `p_mode`/`p_task` là TEXT. Mỗi thao tác mới dùng UUID yêu cầu mới. Gửi lại cùng mã và đúng đầu vào nhận lại kết quả cũ; tái dùng mã cho đầu vào/thao tác khác bị từ chối. Mảng cá phải có 1–500 ID khác nhau, không có NULL; thứ tự không ảnh hưởng chống lặp. Kết quả ví trong biên nhận là snapshot lúc thao tác, cần tải lại ví để xem số dư hiện tại.

Ví dụ gọi khi đã có JWT người chơi; không chạy bằng phiên SQL Editor thiếu `auth.uid()`:

```sql
select public.get_aquaculture_farm();
select public.stock_aquaculture_batch(:pond_id, :species_id, 3, 'simple', :new_request_id);
select public.transfer_aquaculture_fish(array[:fish_id_1, :fish_id_2]::uuid[], :new_request_id);
```

## Mock 3 loài

File 06 tìm đúng một loài hiện có theo tên tiếng Việt hoặc ảnh tương ứng. Nếu không tìm thấy hoặc bị trùng thì rollback toàn file; sửa mapping theo ID thực tế trước khi chạy, không sinh loài giả hoặc mở sổ câu cho người chơi.

| Loài | Ảnh dùng tìm loài | Capacity/con | Thời gian | Phí giống/con | Cân nặng cơ bản | Giá bán/kg |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Cá chép | `Carp.png` | 5 | 6 giờ | 100 cash | 1,2 kg | 150 cash |
| Cá tra | `Pangasius.png` | 3 | 8 giờ | 80 cash | 1,8 kg | 90 cash |
| Cá lóc | `Mottled Snakehead.png` | 8 | 12 giờ | 200 cash | 2,5 kg | 140 cash |

Ba item có tên `[MOCK] Cám viên cơ bản`, `[MOCK] Cám thực vật`, `[MOCK] Cám giàu đạm`, giá 20/15/40 cash, ID cố định trong file. Mỗi loài có ít nhất 2 lựa chọn. Không tự tặng vào `user_inventory`. Có thể mua qua luồng mua item hiện có nếu luồng đó chấp nhận category `aquaculture_food`.

Mock để thử chức năng, **chưa cân bằng kinh tế**. Seed không ghi đè cấu hình/item đã có cùng ID khi chạy lại; thay đổi cấu hình sau seed cần UPDATE rõ ràng. Tỷ lệ đặc biệt mặc định 1%; thử thách tối đa cộng thêm 2 điểm phần trăm khi chất lượng đầy.

## Quyền, giao dịch và hợp đồng dữ liệu hiện có

- Người chơi chỉ đọc các bảng nuôi của chính mình; không ghi trực tiếp. RPC chỉ nhận người gọi từ `auth.uid()`, không nhận user ID do client chỉ định. Hàm nội bộ và trigger function không được cấp EXECUTE qua API.
- Tất cả thao tác farm khóa `user_profile` trước, rồi mới thao tác ao/cá/kho/ví. Mua ao, mua giống, cho ăn, bán và chuyển đều cùng giao dịch với biên nhận. Giới hạn slot và tổng capacity có trigger bảo vệ, ngoài kiểm tra trong RPC.
- Ao đầu có sẵn quyền từ `pond_slot = 1`; bản ghi ao tạo khi truy cập lần đầu, không quét tạo ao cho toàn bộ tài khoản. Các suất do backend cấp thủ công cũng được tạo ao khi truy cập.
- `user_inventory.data` được dùng theo cấu trúc repo: `{"id":"UUID item gốc", "quantity":10, ...}`. RPC khóa đúng dòng inventory của chủ sở hữu, so `data.id` với item được loài chấp nhận, kiểm tra item không bị tắt và quantity nguyên đủ dùng. Các trường JSON khác được giữ nguyên.
- Chuyển cá kiểm tra `species_storage_capacity` so với số dòng `caught` trạng thái `normal`; chưa đủ chỗ thì toàn bộ yêu cầu bị từ chối. Các luồng ghi vào kho khác cũng cần dùng khóa hồ sơ nhất quán để bảo đảm giới hạn khi chạy đồng thời.
- Cá nuôi tạo `caught` với `area_id = NULL`, `area_session_id = NULL`, `status = 'normal'`. Đây là hợp đồng cần được bảng đích hỗ trợ; không gán giả địa điểm câu. Repo chưa chứa toàn bộ DDL live, nên kiểm tra cục bộ dùng cấu trúc này và chưa xác minh tính nullable/trigger live. Đã hỏi thêm DDL để đối chiếu trước triển khai.
- Repository và túi cá đã hỗ trợ `origin = NULL`, hiển thị nguồn nuôi tại ao và không cho điều hướng tới địa điểm câu rỗng. Luồng tải kho hợp nhất thêm các cá `normal` không có `area_id` của chính người chơi, chống trùng theo ID, nên vẫn thấy cá nuôi khi RPC `get_caught_in_home` cũ dùng INNER JOIN bãi câu.
- Trước INSERT `caught`, cá nguồn được đánh dấu `transferred` và lưu ID đích. Có thể phân biệt nguồn nuôi bằng `EXISTS (SELECT 1 FROM aquaculture_fish WHERE caught_id = caught.id)`. Xóa/bán cá đích không khôi phục cá nguồn hoặc xóa nguồn gốc.
- Các trigger nhiệm vụ/thành tích đang có trên `caught` cần bỏ qua nguồn nuôi nếu chúng đếm mỗi lần INSERT là một lần câu. Phần tích hợp đó phụ thuộc trigger live, chưa sửa tùy tiện. Chuyển cá không tự gọi RPC câu hay cập nhật kinh nghiệm câu.
- Cờ siêu đặc biệt nằm trong bản ghi cá nguồn và kết quả chuyển; chưa thêm cột riêng cho cờ này vào `caught` hoặc thay enum biến thể hiện có. Tính năng tương lai có thể truy nguồn qua ID đích.

## Thứ tự chạy sau khi review

1. `01_tables.sql`: thêm `pond_slot` mặc định 1, tạo 6 bảng và trigger bảo vệ.
2. `02_access.sql`: RLS và quyền đọc.
3. `03_views.sql`: 2 view.
4. `04_internal_helpers.sql`: khóa hồ sơ/ví, biên nhận, chốt trưởng thành và đóng lứa rỗng.
5. `05_player_rpcs.sql`: 8 RPC công khai.
6. `06_mock_data.sql`: tùy chọn, mock 3 loài và 3 item.
7. `07_admin_access.sql`: quyền ghi dữ liệu nguồn cho admin, có thể chạy lại.

Chạy bằng migration owner tin cậy, PostgreSQL 15+. Yêu cầu các khóa ID là UUID và các cột hiện có như repository mô tả. Nếu schema đã được cài đặt thì không chạy đè 01–05 và không tự xóa dữ liệu. Chưa tạo RPC nâng cấp sức chứa, cron hay Realtime.

## Ứng dụng

- `src/stores/aquaculture.ts`: store người chơi riêng, lấy trạng thái thật từ server; đồng bộ xu/vỏ sò, thức ăn và sức chứa kho sau thao tác. Không còn mô phỏng tăng trưởng, tiền thử hay nút tăng tốc.
- `src/data/supabaseAquacultureRepository.ts`: gọi RPC/đọc cấu hình, kỷ lục và số cá trong kho. `supabaseAquacultureAdminRepository.ts` chỉ ghi các bảng nguồn.
- Mỗi lần xem một ao; chuyển ao qua thanh chọn, giữ tối đa 4 cá minh họa chuyển động chậm. Nhiều lứa có danh sách riêng; từng cá có chọn/bỏ chọn, phân trang và bán/chuyển/thả theo mảng ID. Chọn nhanh cá thường không tự chọn cá siêu đặc biệt.
- Hai chế độ `simple`/`advanced` được đặt tên Thong thả/Chăm chút. Tính phần ăn từ tổng điểm cá của lứa, chọn đúng bản ghi túi đồ, hiện thời gian chờ và đường dẫn cửa hàng.
- Chỉ cập nhật đồng hồ khi đang mở; đồng bộ trạng thái mỗi phút hoặc khi đến hạn/vừa quay lại tab. Tăng trưởng offline do server quyết định, không cập nhật DB theo từng khung hình.
- Mất phản hồi mạng: giữ nguyên request ID và đầu vào trong store/sessionStorage theo tài khoản. Thử lại dùng cùng mã. Nếu RPC đã thành công nhưng tải lại bị lỗi thì chỉ yêu cầu tải lại, không gửi lại thao tác đã xác nhận.
- Hai folder admin: `aquaculture-species-management` và `aquaculture-food-management`, đã có mục trong `AdminView`. Dùng lại `AdminCrudScreen`, danh sách loài/items có sẵn, khóa các khóa chính khi sửa. Cấu hình loài có kiểm tra phiên bản để tránh ghi đè từ phiên admin khác.
- Chạy kiểm tra logic không mạng: `node scripts/validate-aquaculture.mjs`.

## Kiểm tra cục bộ

Đã chạy 6 file trên PostgreSQL nhúng PGlite với các bảng/role giả lập. Đã kiểm tra: seed chạy lại, ao đầu miễn phí, 4 lần mua thêm với giá 300 vỏ sò, chống trừ lặp, giới hạn 5, nhiều loài chung ao, từ chối tổng điểm bằng 100, khóa giống theo `caught_diary`, trừ thức ăn và thời gian chờ, chốt trưởng thành offline và cá hiếm một lần, chuyển mảng cá/bán/thả đi, đóng lứa rỗng, quyền riêng từng người và chặn gọi helper từ client.

Đã ép lỗi ở lần chèn cá thứ hai trong vòng chuyển để xác nhận cá nguồn và đích đều rollback, rồi gọi lại cùng yêu cầu thành công. `npm run build` thành công; các file giữ UTF-8 không BOM. Kiểm thử chưa thay thế việc đối chiếu trigger/DDL và chạy đồng thời trên Supabase thật trước triển khai.
