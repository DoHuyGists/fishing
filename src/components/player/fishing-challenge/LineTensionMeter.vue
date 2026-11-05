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
  compact: { type: Boolean, default: false },
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
    class="w-full min-w-0 select-none rounded-md bg-[#0E2A33] text-[#E8F1EE]"
    :class="compact ? 'px-2 py-1.5' : 'px-4 py-3'"
    role="meter"
    aria-label="Lực căng dây câu"
    :aria-valuenow="Math.round(tension)"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuetext="zoneInfo.label"
  >
    <div class="flex items-center justify-between gap-3" :class="compact ? 'mb-1 leading-none' : 'mb-1'">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 text-[11px] font-semibold" :class="[zoneInfo.text, compact ? 'py-0' : 'py-1']">
        <span aria-hidden="true" class="size-1.5 rounded-full" :class="zoneInfo.knob" />
        {{ zoneInfo.label }}
      </span>
      <span class="font-bold leading-none tabular-nums" :class="[zoneInfo.text, compact ? 'text-sm' : 'text-xl']" aria-hidden="true">
        {{ Math.round(position) }}<span class="ml-0.5 text-xs font-normal text-[#E8F1EE]/50">%</span>
      </span>
    </div>

    <!-- Dây câu -->
    <svg v-if="!compact" viewBox="0 0 300 16" class="mb-1 h-4 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
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
    <div class="relative" :class="compact ? 'h-5' : 'h-6'">
      <div class="absolute inset-0 flex overflow-hidden rounded-lg">
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
        class="absolute -translate-x-1/2 rounded-full shadow-[0_0_0_2px_#0E2A33] transition-[left] duration-75 ease-linear"
        :class="[zoneInfo.knob, zone === 'danger' ? 'knob-shake' : '', compact ? '-inset-y-1 w-1' : '-inset-y-1.5 w-1.5']"
        :style="{ left: position + '%' }"
      />
    </div>

    <div v-if="!compact" class="relative mt-2 h-4 text-[#E8F1EE]/40" aria-hidden="true">
      <span class="absolute left-0" title="Dây chùng">
        <svg viewBox="0 0 24 16" class="h-4 w-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 3c1 12 19 12 20 0" /></svg>
      </span>
      <span class="absolute -translate-x-1/2 text-emerald-300/80" :style="{ left: (safeStart + safeEnd) / 2 + '%' }" title="Giữ vạch trong vùng xanh">
        <svg viewBox="0 0 20 20" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7" /><path d="m6.5 10 2.3 2.3 4.7-4.6" /></svg>
      </span>
      <span class="absolute right-0" title="Nguy cơ đứt dây">
        <svg viewBox="0 0 20 20" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 2-7 9h5l-1 7 8-10h-5l1-6Z" /></svg>
      </span>
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
