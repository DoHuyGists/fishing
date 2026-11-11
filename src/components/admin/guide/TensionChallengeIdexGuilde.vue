<script setup lang="ts">
import Tab from "../../shared/Tab.vue";
import Hint from "../../shared/Hint.vue";
import { useAdminGuideStore } from "../../../stores/adminGuide";
import { formatGuideNumber as number, tensionGuidePresets } from "../../../data/tensionChallengeGuide";

const guide = useAdminGuideStore();
const tabs = [
  { key: "mechanics", label: "1. Hiểu cơ chế" },
  { key: "indices", label: "2. Tra cứu 25 chỉ số" },
  { key: "balance", label: "3. Ví dụ cân bằng" },
];
const filters = [
  { key: "all" as const, label: "Tất cả · 25" },
  { key: "config" as const, label: "config · 14" },
  { key: "fish" as const, label: "fish · 11" },
];
const zones = {
  slack: { label: "Dây chùng", color: "text-sky-700" },
  safe: { label: "Trong vùng xanh", color: "text-emerald-700" },
  danger: { label: "Dây căng nguy hiểm", color: "text-amber-700" },
  broken: { label: "Chạm ngưỡng đứt dây", color: "text-red-700" },
};
</script>

<template>
  <article class="mx-auto w-full max-w-6xl px-4 py-5 text-sm leading-relaxed sm:px-6 sm:py-7">
    <div class="mb-5 rounded-2xl bg-[#153221] p-5 text-white sm:p-7">
      <div class="mb-2 flex flex-wrap gap-2 text-xs font-semibold text-emerald-100">
        <span class="rounded-full bg-white/10 px-3 py-1">🎣 Tension challenge</span>
        <span class="rounded-full bg-white/10 px-3 py-1">25 chỉ số · 2 nhóm</span>
      </div>
      <div class="m-0 text-xl font-extrabold sm:text-2xl">Hiểu sức cá, cân bằng cuộc đấu</div>
      <div class="mb-0 mt-2 max-w-3xl text-emerald-100">
        Người chơi giữ nút để thu dây, thả nút để nhả dây. Bạn điều chỉnh luật trong
        <code>config</code> và sức kéo trong <code>fish</code> để tạo cuộc đấu vừa sức, có nhịp nghỉ và có cơ hội xử lý.
      </div>
    </div>

    <Tab v-model="guide.activeTab" :tabs="tabs" lazy aria-label="Nội dung hướng dẫn tension challenge">
      <template #mechanics>
        <div class="space-y-5">
          <div class="grid gap-3 sm:grid-cols-3">
            <section class="guide-card">
              <span class="text-2xl" aria-hidden="true">✊</span>
              <div class="guide-title">Giữ: kéo cá lại gần</div>
              <div>Cộng <code>reelRate</code> vào lực cá. Khoảng cách giảm theo <code>reelSpeed</code> khi dây đạt <code>safeMin</code>.</div>
            </section>
            <section class="guide-card">
              <span class="text-2xl" aria-hidden="true">🖐️</span>
              <div class="guide-title">Thả: bớt căng dây</div>
              <div>Cộng <code>releaseRate</code> là số âm. Nếu cá giật quá mạnh, tổng lực vẫn dương và dây vẫn căng lên.</div>
            </section>
            <section class="guide-card">
              <span class="text-2xl" aria-hidden="true">🟢</span>
              <div class="guide-title">Vùng xanh: làm cá mệt</div>
              <div>Trong đoạn <code>safeMin</code> đến <code>safeMax</code>, cá hao thể lực và yếu dần, kể cả khi đang nhả dây.</div>
            </section>
          </div>

          <section class="guide-card overflow-hidden" aria-labelledby="tension-preview-title">
            <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div id="tension-preview-title" class="m-0 text-lg font-bold">Thử một khoảnh khắc trong ván đấu</div>
                <div class="mb-0 mt-1 text-xs text-slate-600">Kéo các thanh và đổi thao tác để thấy chỉ số tác động ra sao.</div>
              </div>
              <button type="button" class="guide-button" @click="guide.resetPreview">Đặt lại minh họa</button>
            </div>
            <div class="grid gap-6 lg:grid-cols-2">
              <div class="space-y-4">
                <label class="block font-semibold">
                  Tình huống
                  <select class="guide-input mt-1" :value="guide.selectedPresetId" @change="guide.selectPreset(($event.target as HTMLSelectElement).value)">
                    <option v-for="preset in tensionGuidePresets" :key="preset.id" :value="preset.id">{{ preset.icon }} {{ preset.title }}</option>
                  </select>
                </label>
                <div class="flex justify-between font-bold" aria-live="polite">
                  <span :class="zones[guide.preview.zone].color">{{ zones[guide.preview.zone].label }}</span>
                  <span>{{ number(guide.previewTension) }} / {{ number(guide.selectedPreset.config.maxTension) }}</span>
                </div>
                <div role="img" :aria-label="`Lực căng ${guide.previewTension}; vùng an toàn từ ${guide.selectedPreset.config.safeMin} đến ${guide.selectedPreset.config.safeMax}`">
                  <div class="relative mb-3 flex h-7 rounded-full bg-red-200">
                    <div class="rounded-l-full bg-sky-200" :style="{ width: `${guide.selectedPreset.config.safeMin / guide.selectedPreset.config.maxTension * 100}%` }" />
                    <div class="bg-emerald-400" :style="{ width: `${(guide.selectedPreset.config.safeMax - guide.selectedPreset.config.safeMin) / guide.selectedPreset.config.maxTension * 100}%` }" />
                    <div class="absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full bg-[#24352a] ring-2 ring-white" :style="{ left: `${guide.previewTension / guide.selectedPreset.config.maxTension * 100}%` }" />
                  </div>
                  <div class="flex justify-between gap-2 text-xs text-slate-600">
                    <span>Chùng &lt; {{ number(guide.selectedPreset.config.safeMin) }}</span>
                    <span class="font-semibold text-emerald-700">Xanh {{ number(guide.selectedPreset.config.safeMin) }}–{{ number(guide.selectedPreset.config.safeMax) }}</span>
                    <span>Đứt ≥ {{ number(guide.selectedPreset.config.maxTension) }}</span>
                  </div>
                </div>
                <label class="block font-semibold">
                  Đặt lực căng: {{ number(guide.previewTension) }}
                  <input v-model.number="guide.previewTension" type="range" min="0" :max="guide.selectedPreset.config.maxTension" step="1" class="mt-2 block w-full accent-emerald-700" />
                </label>
                <label class="block font-semibold">
                  Thể lực còn lại: {{ guide.previewStamina }}%
                  <input v-model.number="guide.previewStamina" type="range" min="0" max="100" step="1" class="mt-2 block w-full accent-emerald-700" />
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input v-model="guide.previewBurst" type="checkbox" class="size-4 accent-emerald-700" />
                  Giả sử cá đang giật gần mức <code>burstMax</code>
                </label>
                <fieldset class="m-0 flex flex-wrap gap-2 border-0 p-0">
                  <legend class="mb-1 font-semibold">Thao tác người chơi</legend>
                  <button type="button" class="guide-button" :class="{ 'selected-button': guide.previewReeling }" :aria-pressed="guide.previewReeling" @click="guide.previewReeling = true">✊ Giữ để thu</button>
                  <button type="button" class="guide-button" :class="{ 'selected-button': !guide.previewReeling }" :aria-pressed="!guide.previewReeling" @click="guide.previewReeling = false">🖐️ Thả để nhả</button>
                </fieldset>
              </div>
              <div class="space-y-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4">
                <div class="m-0 text-xs font-bold uppercase tracking-wide text-emerald-800">Lực căng sẽ thay đổi thế nào?</div>
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div><strong class="block text-lg">+{{ number(guide.preview.fishPull) }}</strong><span class="text-xs">Lực cá/giây</span></div>
                  <div><strong class="block text-lg">{{ guide.preview.playerPull > 0 ? '+' : '' }}{{ number(guide.preview.playerPull) }}</strong><span class="text-xs">Thao tác/giây</span></div>
                  <div><strong class="block text-lg" :class="guide.preview.delta > 0 ? 'text-amber-700' : 'text-sky-700'">{{ guide.preview.delta > 0 ? '+' : '' }}{{ number(guide.preview.delta) }}</strong><span class="text-xs">Tổng/giây</span></div>
                </div>
                <div class="rounded-lg bg-white p-3 font-semibold">
                  {{ guide.preview.zone === 'broken' ? 'Đã chạm ngưỡng đứt dây: ván đấu kết thúc ở đây.'
                    : guide.preview.delta > 0 ? 'Dây đang căng lên. Cần giữ khoảng đệm tới ngưỡng đứt.'
                    : guide.preview.delta < 0 ? 'Dây đang chùng xuống. Chú ý ngưỡng cá thoát.' : 'Lực cá và thao tác đang cân bằng.' }}
                </div>
                <div class="m-0 space-y-2 pl-5">
                  <div>{{ guide.preview.getsCloser ? `Cá gần thêm khoảng ${number(guide.selectedPreset.config.reelSpeed)} m/giây.` : 'Lúc này không thu được khoảng cách.' }}</div>
                  <div>{{ guide.preview.zone === 'slack' ? `Cá lùi xa khoảng ${number(guide.selectedPreset.config.slackDistanceRate)} m/giây, tối đa tới khoảng cách ban đầu.` : guide.preview.losesStamina ? 'Cá đang hao thể lực vì ở trong vùng xanh.' : guide.previewStamina === 0 ? 'Cá đã kiệt sức, vẫn giữ lực kéo tối thiểu.' : 'Cá không hao thể lực ở ngoài vùng xanh.' }}</div>
                  <div v-if="guide.preview.zone !== 'broken'">{{ guide.preview.escapes ? `Đang đếm thời gian dây quá chùng; quá ${number(guide.selectedPreset.config.slackEscapeSeconds)} giây liên tục sẽ thoát.` : `Chỉ đếm cá thoát khi lực căng dưới ${number(guide.preview.slackThreshold)}.` }}</div>
                </div>
                <details class="rounded-lg bg-white p-3 text-xs text-slate-600">
                  <summary class="cursor-pointer font-semibold text-[#24352a]">Các con số này được tính ra sao?</summary>
                  <div>Lực cá ≈ (nền + giật) × sức riêng × sức theo thể lực × hệ số vào dây.</div>
                  <div class="break-words font-mono">{{ number(guide.preview.rawPull) }} × {{ number(guide.selectedPreset.fish.baseStrength) }} × {{ number(guide.preview.staminaFactor) }} × {{ number(guide.selectedPreset.config.fishPullMultiplier) }} ≈ {{ number(guide.preview.fishPull) }}</div>
                  <div class="mb-0">Minh họa dùng nền ở mức trung tâm <code>basePull</code> và bỏ qua làm tròn từng tick. Trong ván thật, nền dao động và seed quyết định chuỗi giật.</div>
                </details>
              </div>
            </div>
            <div class="mb-0 mt-4 text-xs text-slate-600">Đây là minh họa để đọc chỉ số. Các lựa chọn tại đây chỉ thay đổi bản xem hướng dẫn.</div>
          </section>

          <div class="grid gap-3 sm:grid-cols-3">
            <section class="guide-card border-emerald-200"><div class="guide-title text-emerald-800">🏁 Thắng khi khoảng cách ≤ 0</div><div>Cần thu dây hiệu quả đủ lâu để đưa cá về gần. Thời gian ván bị giới hạn bởi <code>expiresAt</code>; RPC hiện đặt 90 giây.</div></section>
            <section class="guide-card border-red-200"><div class="guide-title text-red-800">💥 Thua khi dây đứt</div><div>Chạm <code>maxTension</code> là đứt. Vượt <code>safeMax</code> chỉ là cảnh báo, vẫn còn cơ hội nhả dây.</div></section>
            <section class="guide-card border-sky-200"><div class="guide-title text-sky-800">🐟 Thua khi cá thoát</div><div>Dưới <code>safeMin × slackThresholdRatio</code> liên tục quá <code>slackEscapeSeconds</code> thì cá thoát. Dây hồi lên ngưỡng này sẽ xóa bộ đếm.</div></section>
          </div>
          <aside class="rounded-xl border border-[#cbd9c6] bg-emerald-50 p-4">
            <div class="guide-title">Một ván, một bộ luật đã lưu</div>
            <div class="mb-0">Server lưu <code>config</code>, <code>fish</code> và <code>seed</code> trong session. Cùng seed và thao tác theo tick sẽ tạo cùng diễn biến ở client và server. Khi cân bằng lại, áp dụng cho session mới và giữ nguyên session đang chơi.</div>
          </aside>
        </div>
      </template>

      <template #indices>
        <div class="mb-4 space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl border border-[#cbd9c6] bg-white p-4"><strong>⚙️ config · Luật và trang bị</strong><div class="mb-0 mt-1 text-slate-600">Vùng lực căng, cách thu/nhả, tốc độ kéo cá và các điều kiện thoát.</div></div>
            <div class="rounded-xl border border-[#cbd9c6] bg-white p-4"><strong>🐟 fish · Tính cách con cá</strong><div class="mb-0 mt-1 text-slate-600">Lực kéo nền, sức giật, thời lượng nhịp và tốc độ mệt.</div></div>
          </div>
          <label class="block font-semibold">Tìm key hoặc ý nghĩa
            <input v-model="guide.keyword" type="search" placeholder="Ví dụ: releaseRate, dây chùng, thể lực..." class="guide-input mt-1" />
          </label>
          <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc nhóm chỉ số">
            <button v-for="filter in filters" :key="filter.key" type="button" class="guide-button" :class="{ 'selected-button': guide.section === filter.key }" :aria-pressed="guide.section === filter.key" @click="guide.section = filter.key">{{ filter.label }}</button>
            <span class="ml-auto text-xs text-slate-600" role="status">{{ guide.filteredEntries.length }} chỉ số</span>
          </div>
          <div class="text-xs text-slate-600">Giá trị bên dưới minh họa rules v2: cá RARE có sức hiệu lực 40, dây chịu 100, máy có pull_strength = 80, hệ số giật 1,5. Session thật dùng chỉ số cá và bộ đồ lúc thả câu.</div>
        </div>
        <div class="grid items-start gap-3 lg:grid-cols-2">
          <section v-for="entry in guide.filteredEntries" :key="`${entry.section}.${entry.key}`" class="guide-card">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <code class="break-all text-xs font-bold text-emerald-800">{{ entry.section }}.{{ entry.key }}</code>
              <span class="rounded-full bg-[#f5f9f0] px-2 py-1 text-xs font-semibold">{{ number(entry.value) }}</span>
            </div>
            <div class="mb-1 mt-3 font-bold">{{ entry.name }} <span class="font-normal text-slate-500">· {{ entry.unit }}</span></div>
            <div class="mt-1">{{ entry.meaning }}</div>
            <dl class="m-0 space-y-3">
              <div><dt class="text-xs font-bold text-emerald-800">Cách hoạt động</dt><dd class="ml-0 mt-0.5 text-slate-600">{{ entry.mechanism }}</dd></div>
              <div><dt class="text-xs font-bold text-emerald-800">Khi điều chỉnh</dt><dd class="ml-0 mt-0.5 text-slate-600">{{ entry.tuning }}</dd></div>
            </dl>
            <div class="mb-0 mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950"><strong>Ví dụ: </strong>{{ entry.example }}</div>
          </section>
        </div>
        <div v-if="!guide.filteredEntries.length" class="rounded-xl border border-dashed border-[#cbd9c6] p-8 text-center text-slate-600">Không tìm thấy chỉ số. Thử key khác hoặc chọn “Tất cả”.</div>
      </template>

      <template #balance>
        <div class="space-y-5">
          <div>
            <div class="m-0 text-lg font-bold">Bắt đầu từ một tình huống cụ thể</div>
            <div class="mb-0 mt-1 text-slate-600">Chọn một ví dụ để xem các thay đổi so với cấu hình RARE hiện tại. Các gợi ý cần được thử với nhiều seed và thao tác người chơi trước khi áp dụng.</div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Chọn tình huống cân bằng">
            <button v-for="preset in tensionGuidePresets" :key="preset.id" type="button" class="guide-card cursor-pointer text-left transition-colors hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-700" :class="{ 'selected-preset': guide.selectedPresetId === preset.id }" :aria-pressed="guide.selectedPresetId === preset.id" @click="guide.selectPreset(preset.id)">
              <span class="text-2xl" aria-hidden="true">{{ preset.icon }}</span>
              <strong class="mb-1 mt-2 block">{{ preset.title }}</strong><span class="text-xs text-slate-600">{{ preset.audience }}</span>
            </button>
          </div>
          <section class="guide-card">
            <div class="m-0 text-lg font-bold">{{ guide.selectedPreset.icon }} {{ guide.selectedPreset.title }}</div>
            <div>{{ guide.selectedPreset.reason }}</div>
            <div v-if="guide.presetChanges.length" class="overflow-x-auto rounded-lg border border-[#cbd9c6]">
              <table class="w-full border-collapse text-left text-xs sm:text-sm">
                <caption class="sr-only">Các chỉ số thay đổi so với cấu hình RARE gốc</caption>
                <thead class="bg-[#f5f9f0]"><tr><th scope="col" class="p-3">Chỉ số</th><th scope="col" class="p-3">Gốc</th><th scope="col" class="p-3">Gợi ý</th></tr></thead>
                <tbody><tr v-for="change in guide.presetChanges" :key="change.key" class="border-t border-[#cbd9c6]"><th scope="row" class="p-3 font-normal"><code class="break-all text-emerald-800">{{ change.key }}</code><span class="mt-0.5 block text-xs text-slate-500">{{ change.name }} · {{ change.unit }}</span></th><td class="p-3 tabular-nums">{{ number(change.before) }}</td><td class="p-3 font-bold text-emerald-800 tabular-nums">{{ number(change.after) }}</td></tr></tbody>
              </table>
            </div>
            <div v-else class="rounded-lg bg-[#f5f9f0] p-3">Giữ nguyên cả 25 key để làm mốc so sánh.</div>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div class="rounded-lg bg-[#f5f9f0] p-3"><span class="block text-xs text-slate-600">Thu hiệu quả đủ {{ number(guide.selectedPreset.config.startDistance) }} m</span><strong class="text-xl">≈ {{ number(guide.preview.minimumReelSeconds) }} giây</strong><div class="mb-0 mt-1 text-xs text-slate-600">Ước tính khi luôn giữ nút và dây đủ căng. Ván thật còn thời gian nhả và cá lùi.</div></div>
              <div class="rounded-lg bg-[#f5f9f0] p-3"><span class="block text-xs text-slate-600">Một nhịp vùng vẫy</span><strong class="text-xl">{{ number(guide.selectedPreset.fish.burstMinTicks / guide.selectedPreset.config.tickRate) }}–{{ number(guide.selectedPreset.fish.burstMaxTicks / guide.selectedPreset.config.tickRate) }} giây</strong><div class="mb-0 mt-1 text-xs text-slate-600">Cả nhịp có giật và nhịp nghỉ đều dùng khoảng thời lượng này.</div></div>
              <div class="rounded-lg bg-[#f5f9f0] p-3"><span class="block text-xs text-slate-600">Ngưỡng dây quá chùng</span><strong class="text-xl">&lt; {{ number(guide.preview.slackThreshold) }}</strong><div class="mb-0 mt-1 text-xs text-slate-600">Liên tục quá {{ number(guide.selectedPreset.config.slackEscapeSeconds) }} giây thì cá thoát.</div></div>
            </div>
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"><strong>Điểm cần theo dõi: </strong>{{ guide.selectedPreset.advice }}</div>
            <button type="button" class="guide-button" @click="guide.activeTab = 'mechanics'">Xem tình huống này trên thanh lực căng →</button>
          </section>

          <section class="guide-card">
            <div class="guide-title">Sửa gì khi người chơi gặp vấn đề?</div>
            <div class="mt-3 grid gap-4 md:grid-cols-2">
              <div><strong>💥 Hay đứt dù đã nhả</strong><div class="mb-0 mt-1 text-slate-600">Kiểm tra <code>baseStrength</code>, <code>burstMax</code> và <code>burstMaxTicks</code>. Giảm đỉnh hoặc độ dài cú giật; thử nhả mạnh hơn bằng <code>releaseRate</code> âm hơn.</div></div>
              <div><strong>🐟 Hay thoát ngay đầu ván</strong><div class="mb-0 mt-1 text-slate-600">Đưa <code>startTension</code> vào vùng xanh hoặc tăng <code>slackEscapeSeconds</code>. Kiểm tra ngưỡng <code>safeMin × slackThresholdRatio</code>.</div></div>
              <div><strong>⏳ Ván quá dài, hay hết giờ</strong><div class="mb-0 mt-1 text-slate-600">Tăng <code>reelSpeed</code>, giảm <code>startDistance</code> hoặc giảm tiến độ mất do <code>slackDistanceRate</code>. Đối chiếu thời hạn 90 giây trong RPC.</div></div>
              <div><strong>🔋 Cá không yếu đi rõ rệt</strong><div class="mb-0 mt-1 text-slate-600">Kiểm tra thời gian ở vùng xanh, tăng <code>staminaDrain</code> hoặc giảm <code>minimumStrength</code>. Cá không hao thể lực ngoài vùng xanh.</div></div>
            </div>
          </section>

          <section class="guide-card">
            <div class="guide-title">Các giới hạn cần nhớ <Hint text="Đây là các điều kiện chính của bộ kiểm tra hiện tại. Đổi giá trị không cần đổi công thức; thêm cơ chế hoặc đổi công thức cần cập nhật client, SQL và version cùng nhau." /></div>
            <div class="mb-0 space-y-2 pl-5 text-slate-600">
              <div><code>0 &lt; safeMin &lt; safeMax &lt; maxTension ≤ 1000</code>; lực ban đầu từ 0 đến dưới ngưỡng đứt.</div>
              <div><code>tickRate</code> là số nguyên 1–120; thời hạn tối đa 180 giây ở client và 21.600 tick khi phát lại trên server. RPC hiện dùng 60 tick/giây, 90 giây.</div>
              <div><code>reelRate</code>, <code>reelSpeed</code> dương; <code>releaseRate</code> âm. Tốc độ có độ lớn tối đa 1000; khoảng cách ban đầu phải dương và ≤ 1000.</div>
              <div><code>burstChance</code>, <code>staminaDrain</code>, <code>minimumStrength</code> trong 0–1; <code>slackThresholdRatio</code> lớn hơn 0 và ≤ 1.</div>
              <div><code>0 &lt; baseStrength ≤ 10</code>, <code>0 ≤ fishPullMultiplier ≤ 10</code>; <code>0 ≤ burstMin ≤ burstMax ≤ 1000</code> và <code>0 ≤ pullAmplitude ≤ basePull ≤ 1000</code>.</div>
              <div><code>pullPeriodTicks</code> là số nguyên ≥ 4; hai mốc độ dài cú giật là số nguyên với <code>1 ≤ burstMinTicks ≤ burstMaxTicks</code>.</div>
              <div>Phép tính dùng thang số nguyên 10.000 và cắt phần lẻ mỗi tick. Ví dụ ở 60 tick/giây, <code>staminaDrain = 0,001</code> cho <code>trunc(10 / 60) = 0</code>, nên cá sẽ không hao thể lực.</div>
              <div>Đổi từng nhóm chỉ số, thử nhiều seed và giữ dữ liệu session đang chơi nguyên vẹn. Cấu hình mẫu ở đây dùng để định hướng cân bằng.</div>
            </div>
          </section>
        </div>
      </template>
    </Tab>
  </article>
</template>

<style scoped>
.guide-card {
  border: 1px solid #cbd9c6;
  border-radius: 0.875rem;
  background: white;
  padding: 1rem;
}
.guide-title { margin: 0; font-size: 0.9375rem; font-weight: 700; }
.guide-button {
  border: 1px solid #cbd9c6;
  border-radius: 0.5rem;
  background: white;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}
.guide-button:hover { border-color: #047857; background: #f5f9f0; }
.guide-button:focus-visible, .guide-input:focus-visible { outline: 2px solid #047857; outline-offset: 2px; }
.guide-button.selected-button { border-color: #047857; background: #047857; color: white; }
.selected-preset { border-color: #047857; background: #ecfdf5; box-shadow: inset 0 0 0 1px #047857; }
.guide-input { width: 100%; border: 1px solid #cbd9c6; border-radius: 0.5rem; background: white; padding: 0.625rem 0.75rem; font-size: 0.875rem; font-weight: 400; }
code { border-radius: 0.25rem; background: #dfeadd80; padding: 0.0625rem 0.25rem; overflow-wrap: anywhere; font-size: 0.85em; }
</style>
