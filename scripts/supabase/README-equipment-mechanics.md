# Cơ chế trang bị và tension challenge — rules v2

Mỗi lượt câu mới chỉ dùng tension challenge. Replay vẫn là protocol v1: không đổi công thức theo tick, chỉ đổi cách sinh `config` và `fish` trên server. Thanh canh và RPC cũ được giữ cho session cũ hoặc tính năng khác.

## Thứ tự áp dụng

1. Chạy `migrations/equipment_mechanics.sql`: thêm cột loài cá và bảng snapshot riêng cho server.
2. Điền dữ liệu loài cá, trang bị trong inventory và nguồn cấp vật phẩm theo các bảng bên dưới. Migration không tự suy diễn chỉ số mới từ `strength` của lưỡi cũ.
3. Chạy toàn bộ `rpc/submit_challenge.sql`, rồi `rpc/submit_tension_challenge.sql`.
4. Triển khai client đã hỗ trợ `start_tension_challenge.resolution`.
5. Chạy `migrations/20261118_fishing_area_depth_tool.sql`, rồi toàn bộ `rpc/fishing/cast_rod.sql` trong SQL Editor. Migration thêm `fishing_areas.allow_depth_tool` mặc định `false` nếu chưa có cột, giữ nguyên cấu hình nếu cột đã tồn tại. File RPC chứa cả ba helper thời tiết riêng tư và định nghĩa `cast_rod(p_area_id UUID, p_cast_depth NUMERIC)` trong cùng giao dịch. Sau đó chạy `rpc/fishing/preview_fish_by_depth.sql` để cập nhật trọng số thời tiết trong xem trước. Nếu RPC cũ có owner khác, áp dụng thêm `migrations/20261115_ranked_fishing_permissions.sql` theo hướng dẫn ranked fishing; bản repair cũng đồng bộ owner của helper thời tiết.

Các script được kiểm chứng bằng PostgreSQL cục bộ qua PGlite; không tự cập nhật Supabase đang chạy. Session cũ không có snapshot tiếp tục được resolver xử lý theo nhánh tương thích.

## Trang bị: `public.user_inventory.data`

Mỗi bộ đang dùng phải chọn đúng một vật phẩm cho cả năm nhóm. `user_equipments` chỉ giữ `inventory_id` và `is_used`; chỉ số trong entry của bộ đồ không được ghi đè inventory.

| Nhóm | Trường | Kiểu / miền dữ liệu | Ví dụ |
| --- | --- | --- | --- |
| Rod | `max_weight` | JSON number > 0, kg | `10` |
| Bait | `fish_type` | Mảng chuỗi mã nhóm cá, không rỗng; khớp chính xác với `species.fish_type` | `["CARP", "CATFISH"]` |
| Bait | `quantity` | JSON number nguyên ≥ 1 trước lượt câu | `50` |
| Reel | `pull_strength` | JSON number ≥ 0 | `20` |
| Line | `durability` | JSON number > 0; sau hiệu ứng giới hạn 10–1000 điểm lực căng | `100` |
| Hook | `catch_rate` | JSON number 0–1; phần cộng tỷ lệ, `0.1` = 10 điểm phần trăm trước hệ số | `0.1` |
| Tất cả | `luck_bonus` | JSON number tùy chọn, mặc định 0; chỉ ảnh hưởng shiny | `0.05` |

Không dùng chuỗi số như `"20"`. `match_number`, `hook.strength` không tham gia công thức mới.

Ví dụ phần `data` của từng vật phẩm (năm inventory row riêng):

```json
{
  "rod": { "max_weight": 10 },
  "bait": { "fish_type": ["CARP", "CATFISH"], "quantity": 50 },
  "reel": { "pull_strength": 20 },
  "line": { "durability": 100 },
  "hook": { "catch_rate": 0.1 }
}
```

## Loài cá: `public.species`

| Trường | Yêu cầu | Ví dụ |
| --- | --- | --- |
| `fish_type` **mới** | TEXT không rỗng; mã nhóm khớp với mồi | `CARP` |
| `strength` **mới** | NUMERIC hữu hạn > 0; sức chống kéo ở khối lượng trung tâm | `40` |
| `alertness` **mới** | NUMERIC 0–1; 1 khiến tỷ lệ móc bằng 0 khi không có hiệu ứng bù | `0.2` |
| `burst_multiplier` **mới, tùy chọn** | NUMERIC 1–10; NULL dùng 1.5 | `1.5` |
| `base_catch_rate` hiện có | NUMERIC 0–1, không NULL | `0.5` |
| `weight_min`, `weight_max` hiện có | NUMERIC hữu hạn; `0.01 ≤ weight_min ≤ weight_max`, kg | `1`, `8` |
| `active_time` hiện có | `DAY`, `NIGHT`, `ALL` hoặc NULL; giờ địa phương theo `fishing_areas.timezone`, nếu trống dùng `countries.default_timezone` (nối `country_id` với `countries.code`); DAY từ 06:00 đến trước 19:00. Múi giờ phải có trong `pg_timezone_names`; thiếu hoặc sai sẽ báo lỗi. | `ALL` |
| `rarity` hiện có | COMMON, UNCOMMON, RARE, EPIC, LEGENDARY; mã khác dùng nhịp COMMON | `RARE` |

`experience_point`, tên và ảnh vẫn dùng cho kết quả/XP như trước. Chỉ số bắt buộc thiếu hoặc sai sẽ báo lỗi cấu hình, không ngầm gán thành 0. Không cần thêm `preferred_bait`: bản này dùng duy nhất `fish_type` để phân nhóm.

## Các bước tính toán

### 1. Tổng hợp hiệu ứng

```text
effective_stat = (base_stat + tổng bonus cộng) × tích các hệ số nhân
```

`v_modifiers` chứa các giá trị trung tính `add = 0`, `multiplier = 1`. Thời tiết được đọc ở phần A; các nguồn kỹ năng, sự kiện hoặc buff bổ sung phải được tổng hợp trước vòng tính `v_effective` ở phần B. Ví dụ cần 10 kg, bonus +2 kg và hệ số 1.1 cho tải hiệu lực `(10 + 2) × 1.1 = 13.2 kg`.

Chỉ tổng hợp dữ liệu đáng tin từ server. Sau tổng hợp mới giới hạn miền: tải cần/sức máy ≥ 0, dây 10–1000, bonus lưỡi 0–1, sức cá 0.4–400. `v_balance` lưu tham số cân bằng và các giá trị đã điều chỉnh cho lượt câu, tách khỏi chỉ số trang bị.

Thời tiết lấy từ `fishing_areas.zone_id → zones.weather_active_modifiers`. Chỉ thời tiết có `weather_id` hợp lệ và `weather_expires_at` trong tương lai mới có hiệu lực. Không roll lại giá trị từ `weather_modifiers`; sử dụng đúng mảng đang hoạt động của zone. Các giá trị gốc, hiệu ứng đã nhận/bỏ qua, zone, weather và hạn thời tiết được giữ trong `fishing_session_mechanics.modifiers._weather`, không đưa vào challenge gửi client.

`PERCENT` là thay đổi tương đối: `18.82` nhân `1.1882`, `-20` nhân `0.8`; nhiều hiệu ứng nhân liên tiếp. `POINT` chỉ dành cho `LUCK_BONUS` và `SPAWN_ADD`, được cộng trước các hệ số nhân. `LUCK_BONUS = 1 POINT` cộng 2 điểm phần trăm shiny theo công thức hiện tại. Giảm từ 100% trở lên cho hệ số 0 trước giới hạn miền; giá trị phải là JSON number hữu hạn, có trị tuyệt đối không quá 1,000,000. Mã/đơn vị không hỗ trợ, chuỗi số và dữ liệu sai bị bỏ qua và lưu trong audit riêng tư.

42 mã được hỗ trợ:

| Nhóm | Mã |
| --- | --- |
| Trang bị và móc | `MAX_WEIGHT`, `PULL_STRENGTH`, `DURABILITY`, `CATCH_RATE`, `LUCK_BONUS`, `FISH_STRENGTH`, `CATCH_PROBABILITY` |
| Xuất hiện | `SPAWN_ADD`, `SPAWN_MULTIPLIER`, `RARE_SPAWN` |
| Mồi | `MATCHED_ATTRACTION`, `UNMATCHED_ATTRACTION`, `MATCHED_CATCH_FACTOR`, `UNMATCHED_CATCH_FACTOR` |
| Cá | `WEIGHT_CAP`, `FISH_WEIGHT_BIAS`, `FISH_WEIGHT`, `ALERTNESS` |
| Nhịp câu | `WAIT_TIME`, `REEL_SPEED`, `FIGHT_SECONDS`, `START_DISTANCE` |
| Giật và thể lực cá | `BURST_CHANCE`, `BURST_MULTIPLIER`, `STAMINA_DRAIN` |
| Lực căng | `SAFE_MIN_RATIO`, `SAFE_MAX_RATIO`, `START_TENSION_RATIO`, `REEL_RATE`, `RELEASE_RATE` |
| Dây chùng | `SLACK_ESCAPE_SECONDS`, `SLACK_DISTANCE_RATE`, `SLACK_THRESHOLD_RATIO` |
| Mô phỏng lực cá | `FISH_PULL_MULTIPLIER`, `PULL_PERIOD_TICKS`, `BURST_MIN_TICKS`, `BURST_MAX_TICKS`, `BASE_PULL`, `PULL_AMPLITUDE`, `MINIMUM_STRENGTH` |
| Điểm | `EXTREME_WEIGHT`, `FATIGUE_SCORE` |

`SPAWN_ADD` và `SPAWN_MULTIPLIER` có thể thêm thuộc tính `rarity` với một mã `COMMON`, `UNCOMMON`, `RARE`, `EPIC` hoặc `LEGENDARY`. Không có scope thì áp dụng cho mọi ứng viên; nhân chung mọi loài không đổi xác suất tương đối. `RARE_SPAWN` áp dụng chung RARE/EPIC/LEGENDARY. Hiệu ứng không kích hoạt loài có `weight_rate <= 0` và không vượt điều kiện giờ/độ sâu của cast.

```json
[
  { "code": "SPAWN_MULTIPLIER", "unit": "PERCENT", "value": 18.82, "rarity": "EPIC" },
  { "code": "REEL_SPEED", "unit": "PERCENT", "value": -18.46 },
  { "code": "LUCK_BONUS", "unit": "POINT", "value": 1 }
]
```

Tương thích mã cũ: `RARE_CATCH_RATE`, `EPIC_CATCH_RATE`, `LEGENDARY_CATCH_RATE` tăng trọng số đúng rarity; `FISHING_SPEED`/`FISHING_SPEED_DOWN` đổi tốc độ thu cá; `LUCK`/`LUCK_DOWN` đổi luck; `FISH_WEIGHT_DOWN` giảm kg; `CATCH_RATE_DOWN` giảm xác suất móc cuối; `RARE_RATE_DOWN` giảm trọng số chung ba nhóm hiếm. Mã giảm dùng `-abs(value)` để không đảo dấu hai lần. Các mã XP, tiền, câu đôi, vật phẩm, năng lượng và hồi lượt chưa có cơ chế trong cast nên không được ánh xạ ngầm.

`FISH_WEIGHT_BIAS` điều chỉnh tỷ số `r / (1-r)` của mẫu khối lượng trước khi nhân cap; không đổi gì khi hệ số bằng 1. `WEIGHT_CAP` điều chỉnh cap mệt mỏi hiện tại trong khoảng 0–1, nên hiệu ứng dương có thể bù một phần cap giảm. `FISH_WEIGHT` áp dụng trước lần làm tròn duy nhất và bị giới hạn bởi min loài và cap hiệu lực. Sức cá, sao, kiểm tra cần và điểm cùng dùng khối lượng cuối. `EXTREME_WEIGHT` nhân hệ số điểm của weather; `FATIGUE_SCORE` nhân hệ số hiệu suất điểm đã tính từ mệt mỏi, không đổi lượng mệt mỏi.

Thông số challenge được giới hạn theo protocol v1: chờ 100–120,000 ms, đấu 1–180 giây, tốc độ thu 0.1–1000; vùng an toàn có hai biên hợp lệ, biên độ lực không vượt lực nền, thời lượng giật tối đa không nhỏ hơn tối thiểu. `RELEASE_RATE` tác động lên giá trị âm: tăng phần trăm làm tốc độ giảm lực căng mạnh hơn. Client và replay dùng cùng cấu hình đã làm tròn; không cần đổi công thức mô phỏng.

### 2. Chọn loài theo hồ, giờ, độ sâu và mồi

```text
W_i = max(0, weight_rate_i + spawn_add_i)
      × spawn_multiplier_i × depth_weight_i × bait_attraction_i
P_gặp_i = W_i / tổng W của các loài hợp lệ
```

- `species_in_area.weight_rate` là tỉ trọng tương đối, không phải phần trăm. Không cần tổng bằng 100.
- Chỉ khi `fishing_areas.allow_depth_tool = true` mới dùng `p_cast_depth` và `depth_scope`: không có scope → hệ số 1; ngoài khoảng → 0; tại đỉnh → 1. Hai phía đỉnh dùng đường cong sin lũy thừa `curve_power` như trước; biên khác đỉnh có hệ số 0. Khoảng một điểm chỉ hợp lệ tại chính điểm đó. Scope sai bị loại.
- Khi `allow_depth_tool` là `false` hoặc `NULL`, mọi loài có hệ số độ sâu bằng 1, kể cả scope sai hoặc ngoài khoảng. Việc chọn cá ngẫu nhiên dựa trên `weight_rate`, mồi và hiệu ứng hiện có; vẫn lọc theo giờ hoạt động. `p_cast_depth` vẫn phải là số hữu hạn không âm và được lưu vào session, nhưng không ảnh hưởng xác suất chọn cá.
- Đúng nhóm mồi → thu hút 1.8; sai nhóm → 1. Không dùng mồi để vượt điều kiện giờ hoặc điều kiện độ sâu ở bãi đã bật công cụ.
- Hiệu ứng tăng xuất hiện cho một nhóm loài được thêm tại `spawn_add`/`spawn_multiplier` trong CTE `candidates`. Nhân cùng một hệ số cho mọi loài không thay đổi xác suất tương đối.
- Không có ứng viên → lưu `NO_FISH`. RPC preview dùng chung helper trọng số thời tiết, gồm scope rarity và hệ số nhóm hiếm. Preview vẫn giữ cách xem trước độ sâu hiện có; chưa tính mồi và lọc giờ như cast, nên xác suất xem trước không phải xác suất cuối đã gồm trang bị.

### 3. Khối lượng, sức cá, móc và tải cần

```text
weight = round(weight_min + trung_bình_3_random × (weight_max − weight_min), 2)
r = clamp((weight − weight_min) / (weight_max − weight_min), 0, 1)
    hoặc 0.5 nếu weight_min = weight_max
S = clamp((strength × (0.75 + 0.5 × r) + bonus_sức_cá) × hệ_số_sức_cá, 0.4, 400)

P_móc_gốc = (base_catch_rate + catch_rate_hiệu_lực) × hệ_số_mồi × (1 − alertness)
P_móc = clamp((P_móc_gốc + bonus_xác_suất) × hệ_số_xác_suất, 0, 1)
```

Hệ số móc: đúng mồi 1, sai mồi 0.5. Thu hút và móc là hai tác động khác nhau, đều có chủ đích. Roll móc đúng một lần. Móc trượt → `HOOK_MISSED`; đã móc nhưng `weight > max_weight_hiệu_lực` → `ROD_OVERWEIGHT`. Bằng tải cần vẫn hợp lệ. Tỉ trọng xuất hiện không bị lọc theo tải cần.

Shiny giữ công thức cũ, có giới hạn: `clamp(0.04 + luck_bonus_hiệu_lực × 0.02, 0, 1)`. May mắn không tăng xác suất chọn loài hoặc móc cá.

### 4. Sinh tension protocol v1

```text
maxTension = durability_hiệu_lực
safeMin / safeMax / startTension = maxTension × 0.35 / 0.7 / 0.5
reelSpeed = clamp(2 × (1 + pull_strength_hiệu_lực / S), 0.1, 1000)
baseStrength = S / 40
basePull = 32; pullAmplitude = 8
burstMin = 20 × (burst_multiplier − 1)
burstMax = 40 × (burst_multiplier − 1)
```

Các giá trị sinh ra được làm tròn theo độ chính xác 1/10000 của replay. Ở thể lực đầy, đỉnh tốc độ tăng lực căng do cá xấp xỉ `S × burst_multiplier`. Dây đứt khi **lực căng tích lũy** chạm `maxTension`; không so trực tiếp sức cá với dây để quyết định thua ngay lúc cast. Nhả dây cộng `releaseRate = -48`, giữ thu cộng `reelRate = 24`; cách này vẫn cho phép xử lý cú giật.

| Rarity | Khoảng cách đầu | Xác suất giật | Hao thể lực/giây vùng xanh |
| --- | ---: | ---: | ---: |
| COMMON / mã khác | 30 m | 0.35 | 0.08 |
| UNCOMMON | 50 m | 0.45 | 0.06 |
| RARE | 70 m | 0.55 | 0.05 |
| EPIC | 90 m | 0.60 | 0.04 |
| LEGENDARY | 100 m | 0.65 | 0.03 |

Thời hạn chơi 90 giây từ lúc kích hoạt, chờ tín hiệu 2500–5999 ms. Rarity điều chỉnh nhịp; sức cá chỉ tính từ `strength`, khối lượng và hiệu ứng, tránh nhân sức hai lần.

## Snapshot, kết quả và mồi

`fishing_session_mechanics` lưu bộ đồ, chỉ số gốc/hiệu lực, cá, modifiers, balance và lý do thất bại của lượt câu. Bảng bật RLS và thu hồi quyền của client; không đưa bảng này vào Realtime. `challenge_data` chỉ chứa cấu hình mô phỏng và seed, không chứa roll móc hay lý do thua đã xác định.

Khi bắt đầu thu dây, `start_tension_challenge` trả `resolution` ngay cho NO_FISH / HOOK_MISSED / ROD_OVERWEIGHT; không chạy trận đấu đã định sẵn thua. Các lượt còn lại kích hoạt/replay bình thường. Resolver trừ đúng mồi từ snapshot, chỉ một lần; thiếu mồi lúc resolve → BAIT_UNAVAILABLE và không cấp cá/XP. Thời điểm trừ vẫn là lúc resolve như trước, chưa phải cơ chế giữ chỗ mồi ngay khi cast.

Kết quả đấu: CAUGHT, LINE_SNAPPED, FISH_ESCAPED hoặc TIMEOUT; EXPIRED vẫn xử lý thời hạn session. Đổi trang bị hoặc chỉnh chỉ số sau khi cast không thay đổi lượt đã sinh.

## Kiểm tra cục bộ

Chạy `npm.cmd run test:fishing-result` để kiểm tra khôi phục kết quả và biên nhận giao dịch, `node --test scripts/test-depth-preview.mjs` để kiểm tra xem trước độ sâu trên PGlite, sau đó `npm.cmd run build`. Kiểm tra thêm cơ chế trang bị trên môi trường thử nghiệm trước khi triển khai.
