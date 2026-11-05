<script lang="ts" setup>
import { computed, watch } from 'vue'

/**
 * LineTensionMeter
 * Thanh lực căng dây câu. Component thuần hiển thị (controlled):
 * game loop của bạn cập nhật `tension`, component tự vẽ vùng và trạng thái.
 *
 * Vùng: [0 → safeMin) chùng · [safeMin → safeMax] an toàn · (safeMax → max) nguy hiểm · >= max đứt
 */
const props = defineProps({
  tension: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  safeMin: { type: Number, default: 35 },
  safeMax: { type: Number, default: 70 },
})
const emit = defineEmits(['zone-change'])

const pct = (v: number) => Math.min(100, Math.max(0, (v / props.max) * 100))

const position = computed(() => pct(props.tension))
const safeStart = computed(() => pct(props.safeMin))
const safeEnd = computed(() => pct(props.safeMax))

const zone = computed(() => {
  if (props.tension >= props.max) return 'broken'
  if (props.tension > props.safeMax) return 'danger'
  if (props.tension >= props.safeMin) return 'safe'
  return 'slack'
})

watch(zone, (z, old) => emit('zone-change', z, old))

const zoneInfo = computed(
  () =>
    ({
      slack: { label: 'Dây chùng', text: 'text-sky-300', knob: 'bg-sky-300' },
      safe: { label: 'An toàn', text: 'text-emerald-300', knob: 'bg-emerald-300' },
      danger: { label: 'Sắp đứt!', text: 'text-red-400', knob: 'bg-red-400' },
      broken: { label: 'Dây đã đứt', text: 'text-red-500', knob: 'bg-red-500' },
    })[zone.value],
)

// Đường dây phía trên thanh: chùng thì võng xuống, căng thì thẳng, nguy hiểm thì rung.
const linePath = computed(() => {
  const slackRatio = Math.max(0, 1 - props.tension / props.safeMin) // 1 = chùng hoàn toàn
  const sag = slackRatio * 16
  return `M 0 8 Q 150 ${8 + sag * 2} 300 8`
})
const vibration = computed(() => {
  if (zone.value === 'danger') {
    const t = (props.tension - props.safeMax) / (props.max - props.safeMax)
    return 0.6 + t * 2.4 // px
  }
  return 0
})
</script>

<template>
  <div
    class="w-full max-w-xl select-none rounded-xl bg-[#0E2A33] p-4 text-[#E8F1EE] shadow-lg ring-1 ring-white/10"
    role="meter"
    aria-label="Lực căng dây câu"
    :aria-valuenow="Math.round(tension)"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuetext="zoneInfo.label"
  >
    <div class="mb-2 flex items-baseline justify-between">
      <span class="text-sm font-medium text-[#E8F1EE]/70">Lực căng dây</span>
      <span class="text-sm font-semibold tabular-nums" :class="zoneInfo.text">
        {{ zoneInfo.label }}
        <span class="ml-1 text-[#E8F1EE]/60">{{ Math.round(position) }}%</span>
      </span>
    </div>

    <!-- Dây câu -->
    <svg viewBox="0 0 300 16" class="mb-1 h-4 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <path
        :d="linePath"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        :class="[zoneInfo.text, vibration ? 'line-vibrate' : '']"
        :style="{ '--amp': vibration + 'px' }"
      />
    </svg>

    <!-- Thanh chỉ số -->
    <div class="relative h-7">
      <div class="absolute inset-0 flex overflow-hidden rounded-md">
        <div class="bg-sky-900/70" :style="{ width: safeStart + '%' }" />
        <div class="bg-emerald-500/80" :style="{ width: safeEnd - safeStart + '%' }" />
        <div
          class="flex-1 bg-gradient-to-r from-amber-500/80 to-red-600/90"
        />
      </div>

      <!-- Vạch ranh giới vùng an toàn -->
      <div class="absolute inset-y-0 w-px bg-white/50" :style="{ left: safeStart + '%' }" />
      <div class="absolute inset-y-0 w-px bg-white/50" :style="{ left: safeEnd + '%' }" />

      <!-- Con trỏ -->
      <div
        class="absolute -inset-y-1.5 w-1.5 -translate-x-1/2 rounded-full shadow-[0_0_0_2px_#0E2A33] transition-[left] duration-75 ease-linear"
        :class="[zoneInfo.knob, zone === 'danger' ? 'knob-shake' : '']"
        :style="{ left: position + '%' }"
      />
    </div>

    <div class="mt-2 flex justify-between text-xs text-[#E8F1EE]/50">
      <span>Chùng</span>
      <span class="text-emerald-300/80">Vùng an toàn</span>
      <span>Đứt</span>
    </div>
  </div>
</template>

<style scoped>
@keyframes line-vibrate {
  0%, 100% { transform: translateY(calc(var(--amp) * -1)); }
  50% { transform: translateY(var(--amp)); }
}
@keyframes knob-shake {
  0%, 100% { margin-left: -1px; }
  50% { margin-left: 1px; }
}
.line-vibrate { animation: line-vibrate 0.06s linear infinite; }
.knob-shake { animation: knob-shake 0.08s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  .line-vibrate, .knob-shake { animation: none; }
}
</style>