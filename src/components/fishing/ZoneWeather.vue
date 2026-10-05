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

const RARITY: Record<string, { label: string; color: string }> = {
  COMMON: { label: "Thường", color: "#9ca3af" },
  UNCOMMON: { label: "Không phổ biến", color: "#4ade80" },
  RARE: { label: "Hiếm", color: "#38bdf8" },
  EPIC: { label: "Sử thi", color: "#c084fc" },
  LEGENDARY: { label: "Huyền thoại", color: "#fbbf24" },
};

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
  CASH_BONUS: { label: "Tiền thưởng", icon: "💰" },
  RARE_CHANCE: { label: "Tỉ lệ cá hiếm", icon: "🐟" },
  BITE_SPEED: { label: "Tốc độ cá cắn", icon: "⚡" },
  LUCK: { label: "May mắn", icon: "🍀" },
};

const weather = computed(() => zoneStore.weather);
const rarity = computed(() => RARITY[weather.value?.rarity_tier ?? ""] ?? { label: weather.value?.rarity_tier ?? "", color: "#9ca3af" });
const icon = computed(() => (weather.value ? (WEATHER_ICON[weather.value.code] ?? "🌤️") : "🌤️"));

function prettify(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const modifiers = computed(() =>
  zoneStore.modifiers
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([key, value]) => {
      const meta = MODIFIER_META[key];
      return {
        key,
        label: meta?.label ?? prettify(key.replace(/_BONUS$/, "")),
        icon: meta?.icon ?? "🔹",
        text: `${value >= 0 ? "+" : ""}${Number(value.toFixed(2))}%`,
        positive: value >= 0,
        width: Math.min(100, Math.abs(value)),
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
  <button type="button" class="zw-chip" :style="{ '--accent': rarity.color }" @click.stop="open = true">
    <span class="zw-chip-icon">{{ hasWeather ? icon : "🌤️" }}</span>
    <span class="zw-chip-text">{{ hasWeather ? weather?.name : "Thời tiết" }}</span>
    <small v-if="hasWeather && zoneStore.zone?.weather_expires_at">{{ countdown }}</small>
  </button>

  <Teleport to="body">
    <Transition name="zw-fade">
      <div v-if="open" class="zw-backdrop" @click.self="open = false" @contextmenu.prevent>
        <div class="zw-modal" :style="{ '--accent': rarity.color }" role="dialog" aria-modal="true">
          <button type="button" class="zw-close" aria-label="Đóng" @click="open = false">✕</button>

          <header class="zw-hero">
            <div class="zw-aurora"></div>
            <div class="zw-orb">
              <img v-if="weather?.image" :src="weather.image" :alt="weather.name" />
              <span v-else>{{ icon }}</span>
            </div>
            <p class="zw-zone">{{ zoneStore.zone?.name ?? "—" }}</p>
            <h2>{{ hasWeather ? weather?.name : "Trời quang đãng" }}</h2>
            <span v-if="hasWeather" class="zw-rarity">{{ rarity.label }}</span>
          </header>

          <p v-if="zoneStore.loading && !zoneStore.zone" class="zw-empty">Đang tải...</p>
          <p v-else-if="zoneStore.error" class="zw-empty zw-error">{{ zoneStore.error }}</p>
          <p v-else-if="!zoneStore.zone" class="zw-empty">Khu vực này chưa có dữ liệu môi trường.</p>

          <template v-else>
            <section v-if="hasWeather && zoneStore.zone.weather_expires_at" class="zw-timer">
              <div class="zw-timer-row">
                <span>Thời gian còn lại</span>
                <b>{{ countdown }}</b>
              </div>
              <div class="zw-bar"><i :style="{ width: `${progress}%` }"></i></div>
            </section>

            <section class="zw-mods">
              <h3>Hiệu ứng đang kích hoạt</h3>
              <TransitionGroup v-if="hasWeather && modifiers.length" name="zw-list" tag="ul">
                <li v-for="m in modifiers" :key="m.key" :class="{ negative: !m.positive }">
                  <span class="zw-mod-icon">{{ m.icon }}</span>
                  <div class="zw-mod-body">
                    <div class="zw-mod-row">
                      <span>{{ m.label }}</span>
                      <b>{{ m.text }}</b>
                    </div>
                    <div class="zw-bar small"><i :style="{ width: `${m.width}%` }"></i></div>
                  </div>
                </li>
              </TransitionGroup>
              <p v-else class="zw-empty">Chưa có hiệu ứng nào.</p>
            </section>

            <footer v-if="weather" class="zw-foot">
              Thời tiết kéo dài {{ weather.duration_min }}–{{ weather.duration_max }} phút
            </footer>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.zw-chip {
  --accent: #38bdf8;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  background: rgba(10, 20, 35, 0.55);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 45%, transparent);
  animation: zw-pulse 2.8s ease-in-out infinite;
}
.zw-chip small {
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}
.zw-chip-icon {
  font-size: 16px;
}

.zw-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 8, 20, 0.65);
  backdrop-filter: blur(4px);
}
.zw-modal {
  --accent: #38bdf8;
  position: relative;
  width: min(420px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 22px;
  color: #e8f1ff;
  background: linear-gradient(160deg, #10213a 0%, #0a1426 100%);
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  box-shadow:
    0 0 40px color-mix(in srgb, var(--accent) 35%, transparent),
    0 20px 50px rgba(0, 0, 0, 0.5);
}
.zw-close {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 3;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
}
.zw-hero {
  position: relative;
  overflow: hidden;
  padding: 26px 20px 18px;
  text-align: center;
}
.zw-aurora {
  position: absolute;
  inset: -40%;
  background: conic-gradient(from 0deg, transparent, color-mix(in srgb, var(--accent) 55%, transparent), transparent 40%, #ff7ad9 60%, transparent 80%);
  filter: blur(50px);
  opacity: 0.45;
  animation: zw-spin 14s linear infinite;
}
.zw-orb {
  position: relative;
  width: 92px;
  height: 92px;
  margin: 0 auto 10px;
  display: grid;
  place-items: center;
  font-size: 52px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.05));
  border: 2px solid var(--accent);
  box-shadow: 0 0 28px var(--accent);
  animation: zw-float 3.4s ease-in-out infinite;
}
.zw-orb img {
  width: 70%;
  height: 70%;
  object-fit: contain;
}
.zw-zone {
  position: relative;
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  opacity: 0.7;
}
.zw-hero h2 {
  position: relative;
  margin: 4px 0 8px;
  font-size: 26px;
  text-shadow: 0 0 16px var(--accent);
}
.zw-rarity {
  position: relative;
  display: inline-block;
  padding: 2px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #0a1426;
  background: var(--accent);
}
.zw-timer,
.zw-mods {
  padding: 0 20px 14px;
}
.zw-timer-row,
.zw-mod-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
}
.zw-timer-row b {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
.zw-bar {
  height: 8px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}
.zw-bar.small {
  height: 6px;
}
.zw-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), #fff);
  transition: width 0.8s ease;
}
.zw-mods h3 {
  margin: 4px 0 10px;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}
.zw-mods ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  position: relative;
}
.zw-mods li {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.zw-mod-icon {
  font-size: 24px;
}
.zw-mod-body {
  flex: 1;
}
.zw-mod-row b {
  color: #4ade80;
  font-variant-numeric: tabular-nums;
}
.zw-mods li.negative .zw-mod-row b {
  color: #f87171;
}
.zw-mods li.negative .zw-bar i {
  background: linear-gradient(90deg, #f87171, #fff);
}
.zw-empty {
  margin: 0;
  padding: 12px 20px 20px;
  text-align: center;
  font-size: 14px;
  opacity: 0.75;
}
.zw-error {
  color: #f87171;
}
.zw-foot {
  padding: 4px 20px 18px;
  text-align: center;
  font-size: 12px;
  opacity: 0.55;
}

.zw-fade-enter-active,
.zw-fade-leave-active {
  transition: opacity 0.25s ease;
}
.zw-fade-enter-active .zw-modal,
.zw-fade-leave-active .zw-modal {
  transition: transform 0.3s cubic-bezier(0.2, 1.2, 0.4, 1);
}
.zw-fade-enter-from,
.zw-fade-leave-to {
  opacity: 0;
}
.zw-fade-enter-from .zw-modal,
.zw-fade-leave-to .zw-modal {
  transform: scale(0.85) translateY(20px);
}
.zw-list-enter-active,
.zw-list-leave-active {
  transition: all 0.4s ease;
}
.zw-list-enter-from,
.zw-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.zw-list-leave-active {
  position: absolute;
  width: 100%;
}

@keyframes zw-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes zw-float {
  50% {
    transform: translateY(-6px);
  }
}
@keyframes zw-pulse {
  50% {
    box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 70%, transparent);
  }
}
</style>



