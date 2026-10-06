<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useZoneStore } from "../../stores/zone";
import { utcToLocalMs } from "../../utils/time";

const props = defineProps<{ areaId: string | null | undefined }>();

const zoneStore = useZoneStore();
const open = ref(false);
const nowMs = ref(Date.now());
let timer: number | undefined;
let lastRefetch = 0;

const RARITY_LABEL: Record<string, string> = {
  COMMON: "Thường",
  UNCOMMON: "Không phổ biến",
  RARE: "Hiếm",
  EPIC: "Sử thi",
  LEGENDARY: "Huyền thoại",
};

// Video nền theo mã thời tiết (điền đường dẫn khi có asset), ví dụ: RAIN: "/videos/weather/rain.mp4"
const WEATHER_VIDEO: Record<string, string> = {};

const WEATHER_ICON: Record<string, string> = {
  CLEAR: "☀️",
  SUNNY: "☀️",
  CLOUDY: "☁️",
  RAIN: "🌧️",
  STORM: "⛈️",
  THUNDER: "⛈️",
  FOG: "🌫️",
  SNOW: "❄️",
  WIND: "🌬️",
  RAINBOW: "🌈",
  AURORA: "🌌",
  MOON: "🌙",
};

// Nhãn/biểu tượng cho modifier đã biết; key lạ sẽ tự được định dạng
const MODIFIER_META: Record<string, { label: string; icon: string }> = {
  EXP_BONUS: { label: "Kinh nghiệm", icon: "✨" },
  RARE_CATCH_RATE: { label: "Tỷ lệ cá Rare", icon: "✨" },
  FISHING_SPEED_DOWN: { label: "Giảm tốc độ câu cá", icon: "✨" },
  LUCK_DOWN: { label: "Giảm may mắn", icon: "✨" },
  LUCK: { label: "May mắn", icon: "✨" },
  COOLDOWN_UP: { label: "Tăng thời gian hồi", icon: "✨" },
  EPIC_CATCH_RATE: { label: "Tỷ lệ cá Epic", icon: "✨" },
  CATCH_RATE_DOWN: { label: "Giảm tỷ lệ câu cá", icon: "✨" },
  RARE_ITEM_RATE: { label: "Tỷ lệ vật phẩm hiếm", icon: "✨" },
  FISH_WEIGHT: { label: "Trọng lượng cá", icon: "✨" },
  ENERGY_COST: { label: "Tiêu hao năng lượng", icon: "✨" },
  CATCH_RATE: { label: "Tỷ lệ câu cá", icon: "✨" },
  COOLDOWN: { label: "Thời gian hồi", icon: "✨" },
  LEGENDARY_CATCH_RATE: { label: "Tỷ lệ cá Legendary", icon: "✨" },
  DOUBLE_CATCH: { label: "Cơ hội câu đôi", icon: "✨" },
  BIG_FISH_RATE: { label: "Tỷ lệ cá lớn", icon: "✨" },
  ITEM_DROP_RATE: { label: "Tỷ lệ rơi vật phẩm", icon: "✨" },
  FISH_WEIGHT_DOWN: { label: "Giảm trọng lượng cá", icon: "✨" },
  ENERGY_COST_UP: { label: "Tăng tiêu hao năng lượng", icon: "✨" },
  BAIT_EFFICIENCY: { label: "Hiệu quả mồi câu", icon: "✨" },
  FISHING_SPEED: { label: "Tốc độ câu cá", icon: "✨" },
  RARE_RATE_DOWN: { label: "Giảm tỷ lệ cá hiếm", icon: "✨" },
  CASH_BONUS: { label: "Tiền thưởng", icon: "✨" },
};

const weather = computed(() => zoneStore.weather);
const rarityLabel = computed(() => RARITY_LABEL[weather.value?.rarity_tier ?? ""] ?? weather.value?.rarity_tier ?? "");
const weatherIcon = computed(() => (weather.value ? (WEATHER_ICON[weather.value.code] ?? "🌤️") : "🌤️"));

function prettify(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const modifiers = computed(() =>
  zoneStore.modifiers.map((modifier) => {
      return {
        code: modifier.code,
        label: modifier?.name,
        icon: modifier.value >= 0 ? "🟢" : "🔴",
        text: `${modifier.value >= 0 ? "+" : "-"}${Number(modifier.value.toFixed(2))}${modifier.unit == "PERCENT" ? '%': ''}`,
        positive: modifier.value >= 0,
        width: Math.min(100, Math.abs(modifier.value)),
      };
    }),
);


const remainingMs = computed(() => {
  const exp = zoneStore.zone?.weather_expires_at;
  const ms = exp ? utcToLocalMs(exp) - nowMs.value : 0;
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
});
const countdown = computed(() => {
  const total = Math.floor(remainingMs.value / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
});
const progress = computed(() => {
  const z = zoneStore.zone;
  if (!z?.weather_expires_at || !z.weather_updated_at) return 0;
  const start = utcToLocalMs(z.weather_updated_at);
  const end = utcToLocalMs(z.weather_expires_at);
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, ((end - nowMs.value) / (end - start)) * 100));
});
const videoSrc = computed(() => (weather.value ? WEATHER_VIDEO[weather.value.code] : undefined));
const hasWeather = computed(() => !!weather.value);

watch(
  () => props.areaId,
  (id) => {
    if (id) zoneStore.init(id);
    else zoneStore.reset();
  },
  { immediate: true },
);

onMounted(() => {
  timer = window.setInterval(() => {
    nowMs.value = Date.now();
    // Hết hạn mà server chưa đổi thời tiết: thử tải lại mỗi 10 giây
    const exp = zoneStore.zone?.weather_expires_at;
    if (exp && props.areaId && utcToLocalMs(exp) <= nowMs.value && nowMs.value - lastRefetch >= 10000) {
      lastRefetch = nowMs.value;
      zoneStore.refresh();
    }
  }, 1000);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
  zoneStore.reset();
});
</script>

<template>
  <button
    type="button"
    class="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
    @click.stop="open = true"
  >
    <span class="text-sm leading-none">{{ hasWeather ? weatherIcon : "🌤️" }}</span>
    <span>{{ hasWeather ? weather?.name : "Thời tiết" }}</span>
    <span v-if="hasWeather && zoneStore.zone?.weather_expires_at" class="tabular-nums text-emerald-700">{{ countdown }}</span>
  </button>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-1000 grid place-items-center bg-emerald-950/60 p-4"
        @click.self="open = false"
        @contextmenu.prevent
      >
        <div
          class="relative flex max-h-[90vh] w-[min(720px,100%)] flex-col overflow-hidden rounded-xl border border-emerald-900/15 bg-white text-emerald-950"
          role="dialog"
          aria-modal="true"
        >
          <!-- Placeholder video thời tiết làm nền: gán WEATHER_VIDEO[code] để bật -->
          <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <video
              v-if="videoSrc"
              :key="videoSrc"
              :src="videoSrc"
              class="h-full w-full object-cover"
              autoplay
              loop
              muted
              playsinline
            ></video>
            <div v-else class="h-full w-full bg-emerald-50"></div>
            <div class="absolute inset-0 bg-white/75"></div>
          </div>

          <button
            type="button"
            class="absolute right-3 top-3 z-10 h-8 w-8 rounded-full border border-emerald-900/15 bg-white/80 leading-none text-emerald-950 hover:bg-white"
            aria-label="Đóng"
            @click="open = false"
          >
            &times;
          </button>

          <div class="relative flex min-h-0 flex-1 flex-col">
            <div class="flex items-center gap-4 border-b border-emerald-900/10 px-5 py-4 pr-14">
              <div class="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-emerald-700/30 bg-emerald-100 text-3xl">
                <img v-if="weather?.image" :src="weather.image" :alt="weather.name" class="h-3/4 w-3/4 object-contain" />
                <span v-else>{{ weatherIcon }}</span>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-bold uppercase tracking-widest text-emerald-800">{{ zoneStore.zone?.name ?? "—" }}</div>
                <div class="truncate text-xl font-bold leading-tight">{{ hasWeather ? weather?.name : "Trời quang đãng" }}</div>
                <span
                  v-if="hasWeather"
                  class="mt-1 inline-block rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white"
                >{{ rarityLabel }}</span>
              </div>
              <div v-if="hasWeather && zoneStore.zone?.weather_expires_at" class="ml-auto hidden w-fit shrink-0 sm:block">
                <div class="flex items-baseline justify-between text-xs gap-2 text-emerald-800">
                  <span>Thời tiết {{ weather?.name }} kết thúc sau: </span>
                  <b class="text-base tabular-nums text-emerald-900">{{ countdown }}</b>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-900/10">
                  <div class="h-full rounded-full bg-emerald-600 transition-[width] duration-700" :style="{ width: `${progress}%` }"></div>
                </div>
              </div>
            </div>

            <div v-if="zoneStore.loading && !zoneStore.zone" class="px-5 py-8 text-center text-sm text-emerald-800">Đang tải...</div>
            <div v-else-if="zoneStore.error" class="px-5 py-8 text-center text-sm text-red-600">{{ zoneStore.error }}</div>
            <div v-else-if="!zoneStore.zone" class="px-5 py-8 text-center text-sm text-emerald-800">Khu vực này chưa có dữ liệu môi trường.</div>

            <template v-else>
              <div v-if="hasWeather && zoneStore.zone.weather_expires_at" class="px-5 pt-3 sm:hidden">
                <div class="flex items-baseline justify-between text-xs text-emerald-800">
                  <span>Còn lại</span>
                  <b class="tabular-nums text-emerald-900">{{ countdown }}</b>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-900/10">
                  <div class="h-full rounded-full bg-emerald-600 transition-[width] duration-700" :style="{ width: `${progress}%` }"></div>
                </div>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div class="mb-2 flex items-baseline justify-between text-[11px] font-bold uppercase tracking-widest text-emerald-800">
                  <span>Hiệu quả đang kích hoạt</span>
                  <span v-if="hasWeather && modifiers.length" class="tabular-nums">{{ modifiers.length }}</span>
                </div>
                <TransitionGroup
                  v-if="hasWeather && modifiers.length"
                  tag="ul"
                  class="m-0 list-none gap-2 p-0 flex flex-col"
                  enter-active-class="transition-opacity duration-300"
                  enter-from-class="opacity-0"
                >
                  <li
                    v-for="m in modifiers"
                    :key="m.code"
                    class="flex items-center gap-2 rounded-lg border border-emerald-900/10 bg-white/80 px-2.5 py-2"
                  >
                    <span class="text-base leading-none">{{ m.icon }}</span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-baseline justify-between gap-2 text-xs">
                        <span class="truncate">{{ m.label }}</span>
                        <b :class="m.positive ? 'text-emerald-700' : 'text-red-600'" class="tabular-nums">{{ m.text }}</b>
                      </div>
                      <div class="mt-1 h-1 overflow-hidden rounded-full bg-emerald-900/10">
                        <div
                          class="h-full rounded-full transition-[width] duration-700"
                          :class="m.positive ? 'bg-emerald-600' : 'bg-red-500'"
                          :style="{ width: `${m.width}%` }"
                        ></div>
                      </div>
                    </div>
                  </li>
                </TransitionGroup>
                <div v-else class="py-4 text-center text-sm text-emerald-800">Chưa có hiệu ứng nào.</div>
              </div>

              <div v-if="weather" class="border-t border-emerald-900/10 px-5 py-2 text-center text-[11px] text-emerald-800">
                Thời tiết kéo dài {{ weather.duration_min }}–{{ weather.duration_max }} phút
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
