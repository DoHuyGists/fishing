<script setup lang="ts">
const equipmentGuide = [
  {
    name: "Rod (Cần câu)",
    key: "max_weight",
    meaning: "Giới hạn trọng lượng cá có thể câu; cá quá nặng sẽ xổng mất.",
    fish: "weight · Khối lượng thực tế của con cá (kg).",
    calculation: "weight ≤ max_weight: đủ tải. weight > max_weight: cá xổng. Dùng weight_min–weight_max của loài để chọn mức tải cần phù hợp.",
  },
  {
    name: "Bait (Mồi câu)",
    key: "fish_type",
    meaning: "Thu hút những loại cá nhất định; không đúng loại mồi sẽ giảm tỉ lệ câu được.",
    fish: "fish_type · Mã nhóm của loài cá.",
    calculation: "Mồi có danh sách fish_type. Đúng nhóm tăng trọng số xuất hiện ×1,8 và dùng hệ số móc 1; sai nhóm giữ trọng số ×1 nhưng hệ số móc còn 0,5. Độ sâu và giờ vẫn quyết định cá có thể xuất hiện.",
  },
  {
    name: "Reel (Máy câu)",
    key: "pull_strength",
    meaning: "Tăng sức kéo, giúp giảm thời gian kéo cá về bờ.",
    fish: "strength · Sức chống kéo của loài, điều chỉnh theo khối lượng thực tế và hiệu ứng để ra sức cá S.",
    calculation: "Tốc độ thu = 2 × (1 + pull_strength / S), giới hạn 0,1–1000 m/giây. Thời gian thu hiệu quả ≈ khoảng cách / tốc độ, chưa tính thời gian nhả dây.",
  },
  {
    name: "Line (Dây câu)",
    key: "durability",
    meaning: "Khả năng chịu lực; cá quá khỏe sẽ làm đứt dây.",
    fish: "strength · Sức cá và burst_multiplier · Hệ số giật.",
    calculation: "durability hiệu lực đặt ngưỡng maxTension (10–1000). Cá và thao tác thu/nhả thay đổi lực căng theo từng tick; lực căng tích lũy chạm ngưỡng mới đứt. Không so trực tiếp sức cá hoặc kg với dây để quyết định thua ngay.",
  },
  {
    name: "Hook (Lưỡi câu)",
    key: "catch_rate",
    meaning: "Tăng tỷ lệ cá cắn câu thành công; cá cảnh giác cao sẽ tăng khả năng móc trượt.",
    fish: "base_catch_rate · Tỷ lệ bắt cơ bản; alertness · Mức cảnh giác (0–1).",
    calculation: "Xác suất móc = giới hạn 0–1 của [(base_catch_rate + catch_rate) × hệ số mồi × (1 − alertness)], sau đó áp dụng hiệu ứng xác suất nếu có. catch_rate = 0,1 cộng 10 điểm phần trăm trước các hệ số; chỉ roll móc một lần.",
  },
];

const fishStats = [
  { key: "weight_min / weight_max", meaning: "Khoảng khối lượng của loài hiện có trong species; dùng để cân bằng tải cần cho nhóm cá mục tiêu." },
  { key: "weight", meaning: "Khối lượng thực tế của từng con cá (kg); dùng để kiểm tra max_weight, không dùng khối lượng tối đa của loài thay thế." },
  { key: "base_catch_rate", meaning: "Tỷ lệ bắt cơ bản hiện có trong species, từ 0 đến 1; làm mốc tính xác suất với mồi và lưỡi câu." },
  { key: "fish_type", meaning: "Mã nhóm cá; phải khớp chính xác với một mã trong mảng fish_type của mồi." },
  { key: "strength / burst_multiplier", meaning: "Sức chống kéo lớn hơn 0; sức hiệu lực S thay đổi từ 75% đến 125% theo vị trí khối lượng trong loài trước hiệu ứng. Hệ số giật 1–10, mặc định 1,5; đỉnh sức kéo khi đầy thể lực xấp xỉ S × hệ số giật." },
  { key: "alertness", meaning: "Mức cảnh giác từ 0 đến 1: 0 không giảm xác suất móc, 1 làm xác suất gốc bằng 0. Hiệu ứng xác suất riêng có thể được cộng/nhân sau bước này." },
];
</script>

<template>
  <article class="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 text-sm leading-relaxed text-[#24352a] sm:px-6 sm:py-7">
    <header class="rounded-2xl bg-[#153221] p-5 text-white sm:p-7">
      <div class="mb-2 mt-0 text-xs font-semibold text-emerald-100">Trang bị · 5 nhóm chỉ số</div>
      <div class="m-0 text-xl font-extrabold sm:text-2xl">Thiết lập trang bị theo sức cá</div>
      <div class="mb-0 mt-2 text-emerald-100">Chọn mồi và lưỡi để tăng cơ hội móc cá; cân bằng cần, máy và dây để đưa cá về bờ.</div>
    </header>

    <section aria-labelledby="equipment-guide-table-title">
      <div id="equipment-guide-table-title" class="mb-3 mt-0 text-lg font-bold">Bảng đối chiếu trang bị và cá</div>
      <div class="overflow-x-auto rounded-xl border border-[#cbd9c6]" role="region" aria-labelledby="equipment-guide-table-title" tabindex="0">
        <table class="w-full min-w-[900px] border-collapse text-left text-sm">
          <caption class="sr-only">Chỉ số trang bị, tác dụng, chỉ số cá tương ứng và cách tính gợi ý</caption>
          <thead class="bg-[#f5f9f0]">
            <tr>
              <th scope="col" class="p-3">Trang bị</th>
              <th scope="col" class="p-3">Chỉ số thiết lập</th>
              <th scope="col" class="p-3">Tác dụng</th>
              <th scope="col" class="p-3">Chỉ số cá tương ứng</th>
              <th scope="col" class="p-3">Cách đối chiếu / tính gợi ý</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="entry in equipmentGuide" :key="entry.key" class="border-t border-[#cbd9c6] align-top">
              <th scope="row" class="p-3 font-semibold">{{ entry.name }}</th>
              <td class="p-3"><code>{{ entry.key }}</code></td>
              <td class="p-3">{{ entry.meaning }}</td>
              <td class="p-3">{{ entry.fish }}</td>
              <td class="p-3">{{ entry.calculation }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-xl border border-[#cbd9c6] bg-white p-4" aria-labelledby="equipment-fish-stats-title">
      <div id="equipment-fish-stats-title" class="mb-3 mt-0 text-lg font-bold">Các chỉ số cá cần dùng khi tính toán</div>
      <dl class="m-0 grid gap-4 sm:grid-cols-2">
        <div v-for="stat in fishStats" :key="stat.key">
          <dt class="font-semibold"><code>{{ stat.key }}</code></dt>
          <dd class="mb-0 ml-0 mt-1 text-slate-600">{{ stat.meaning }}</dd>
        </div>
      </dl>
    </section>

    <section class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4" aria-labelledby="equipment-example-title">
      <div id="equipment-example-title" class="m-0 text-lg font-bold">Ví dụ cân bằng một bộ trang bị</div>
      <div class="mb-0 space-y-2 pl-5">
        <div>Cá nặng 8 kg, cần có <code>max_weight = 10</code>: đủ tải; cần 6 kg thì cá xổng.</div>
        <div>Cá ở khối lượng trung tâm có sức hiệu lực S = 40, hệ số giật 1,5: đỉnh lực kéo xấp xỉ 60 điểm/giây khi đầy thể lực. Dây có <code>durability = 70</code> đứt khi lực căng tích lũy chạm 70; người chơi nhả dây để giảm căng, không tự động thua khi gặp cú giật.</div>
        <div>Máy có <code>pull_strength = 20</code>: tốc độ là 2 × (1 + 20 / 40) = 3 m/giây; thu hiệu quả 30 m mất khoảng 10 giây, chưa tính nhả dây.</div>
        <div>Cá có <code>base_catch_rate = 0,5</code>, cảnh giác 0,2; lưỡi cộng 0,1: đúng mồi đạt (0,5 + 0,1) × 1 × 0,8 = 48%; sai mồi với hệ số 0,5 còn 24%.</div>
      </div>
      <div class="mb-0 mt-3 text-xs text-slate-600">Móc cá thành công là một bước; vẫn cần vượt qua giới hạn tải cần, sức chịu dây và thử thách kéo cá để bắt được cá.</div>
    </section>

    <aside class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4">
      <div class="m-0 font-bold">Áp dụng với tension challenge hiện tại</div>
      <div class="mb-0 mt-2">RPC rules v2 áp dụng tension cho mọi loài. Server tính chỉ số hiệu lực theo (chỉ số gốc + tổng bonus cộng) × tích hệ số nhân, rồi sinh <code>config.reelSpeed</code>, <code>config.maxTension</code> và sức cá. Rarity điều chỉnh khoảng cách, nhịp giật và tốc độ mệt. Cấu hình được lưu cố định theo lượt; đổi đồ sau khi thả câu không thay đổi ván đang chơi. Móc trượt, quá tải cần hoặc không có cá được trả kết quả khi bắt đầu thu dây, không chạy ván đấu đã định sẵn thua.</div>
    </aside>
  </article>
</template>

<style scoped>
code { border-radius: 0.25rem; background: #dfeadd80; padding: 0.0625rem 0.25rem; overflow-wrap: anywhere; font-size: 0.85em; }
</style>
