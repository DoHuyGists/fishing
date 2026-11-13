<script setup lang="ts">
import { computed, ref } from 'vue'

type Region = 'head' | 'torso' | 'arms' | 'legs'
type Level = 'good' | 'warn' | 'bad'

interface Metric {
  id: string
  label: string
  value: number | string
  unit: string
  region: Region
  level: Level
  note?: string
}

const props = withDefaults(defineProps<{ metrics?: Metric[] }>(), {
  metrics: () => [
    { id: 'temp', label: 'Nhiệt độ', value: 36.8, unit: '°C', region: 'head', level: 'good', note: 'Bình thường' },
    { id: 'hr', label: 'Nhịp tim', value: 78, unit: 'bpm', region: 'torso', level: 'good', note: 'Bình thường' },
    { id: 'spo2', label: 'SpO₂', value: 94, unit: '%', region: 'torso', level: 'warn', note: 'Hơi thấp' },
    { id: 'rr', label: 'Nhịp thở', value: 16, unit: 'lần/phút', region: 'torso', level: 'good' },
    { id: 'bp', label: 'Huyết áp', value: '142/91', unit: 'mmHg', region: 'arms', level: 'bad', note: 'Cao' },
    { id: 'steps', label: 'Bước chân', value: '6.240', unit: 'bước', region: 'legs', level: 'good' },
  ],
})

const selected = ref<Region | null>(null)
const hovered = ref<Region | null>(null)

const levelRank: Record<Level, number> = { good: 0, warn: 1, bad: 2 }

// Mức xấu nhất của từng vùng cơ thể
const regionLevel = computed<Record<Region, Level>>(() => {
  const result: Record<Region, Level> = { head: 'good', torso: 'good', arms: 'good', legs: 'good' }
  for (const m of props.metrics) {
    if (levelRank[m.level] > levelRank[result[m.region]]) result[m.region] = m.level
  }
  return result
})

const fillByLevel: Record<Level, string> = {
  good: 'fill-emerald-100 stroke-emerald-500',
  warn: 'fill-amber-100 stroke-amber-500',
  bad: 'fill-rose-100 stroke-rose-500',
}
const dotByLevel: Record<Level, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
}

const regionLabel: Record<Region, string> = {
  head: 'Đầu',
  torso: 'Thân',
  arms: 'Tay',
  legs: 'Chân',
}

const regions: Region[] = ['head', 'torso', 'arms', 'legs']

const active = computed(() => hovered.value ?? selected.value)

function partClass(r: Region): string {
  const dim = active.value && active.value !== r ? 'opacity-40' : 'opacity-100'
  const ring = selected.value === r ? 'stroke-[3]' : 'stroke-2'
  return `${fillByLevel[regionLevel.value[r]]} ${ring} ${dim} cursor-pointer transition-opacity duration-150 outline-none focus-visible:stroke-[4]`
}

function toggle(r: Region) {
  selected.value = selected.value === r ? null : r
}

const visibleMetrics = computed(() =>
  props.metrics.map((m) => ({
    ...m,
    dimmed: active.value !== null && m.region !== active.value,
  })),
)
</script>

<template>
  <div class="mx-auto grid w-full max-w-4xl gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:grid-cols-[minmax(0,260px)_1fr]">
    <!-- Mô hình người 2D (trung tính giới tính) -->
    <div class="flex flex-col items-center">
      <svg viewBox="0 0 200 470" class="h-[420px] w-auto" role="group" aria-label="Mô hình nhân vật">
        <!-- Cánh tay -->
        <g
          role="button"
          tabindex="0"
          :aria-label="`Tay: ${regionLabel.arms}`"
          :class="partClass('arms')"
          @mouseenter="hovered = 'arms'"
          @mouseleave="hovered = null"
          @click="toggle('arms')"
          @keydown.enter.prevent="toggle('arms')"
          @keydown.space.prevent="toggle('arms')"
        >
          <rect x="28" y="104" width="26" height="150" rx="13" />
          <rect x="146" y="104" width="26" height="150" rx="13" />
        </g>

        <!-- Chân -->
        <g
          role="button"
          tabindex="0"
          aria-label="Chân"
          :class="partClass('legs')"
          @mouseenter="hovered = 'legs'"
          @mouseleave="hovered = null"
          @click="toggle('legs')"
          @keydown.enter.prevent="toggle('legs')"
          @keydown.space.prevent="toggle('legs')"
        >
          <rect x="67" y="256" width="31" height="204" rx="15" />
          <rect x="102" y="256" width="31" height="204" rx="15" />
        </g>

        <!-- Thân -->
        <g
          role="button"
          tabindex="0"
          aria-label="Thân"
          :class="partClass('torso')"
          @mouseenter="hovered = 'torso'"
          @mouseleave="hovered = null"
          @click="toggle('torso')"
          @keydown.enter.prevent="toggle('torso')"
          @keydown.space.prevent="toggle('torso')"
        >
          <rect x="88" y="84" width="24" height="20" rx="6" />
          <rect x="62" y="98" width="76" height="164" rx="26" />
        </g>

        <!-- Đầu -->
        <g
          role="button"
          tabindex="0"
          aria-label="Đầu"
          :class="partClass('head')"
          @mouseenter="hovered = 'head'"
          @mouseleave="hovered = null"
          @click="toggle('head')"
          @keydown.enter.prevent="toggle('head')"
          @keydown.space.prevent="toggle('head')"
        >
          <ellipse cx="100" cy="48" rx="28" ry="32" />
        </g>
      </svg>

      <p class="mt-2 h-5 text-sm text-slate-500">
        {{ active ? `Vùng: ${regionLabel[active]}` : 'Chọn một vùng để lọc chỉ số' }}
      </p>
    </div>

    <!-- Chỉ số trạng thái -->
    <div class="flex flex-col">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900">Chỉ số trạng thái</h2>
        <button
          v-if="selected"
          type="button"
          class="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
          @click="selected = null"
        >
          Bỏ lọc
        </button>
      </div>

      <ul class="grid gap-3 sm:grid-cols-2">
        <li
          v-for="m in visibleMetrics"
          :key="m.id"
          class="rounded-xl p-4 ring-1 ring-slate-200 transition-opacity duration-150"
          :class="m.dimmed ? 'opacity-40' : 'opacity-100'"
        >
          <div class="flex items-center justify-between text-sm text-slate-500">
            <span>{{ m.label }}</span>
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" :class="dotByLevel[m.level]" />
              {{ regionLabel[m.region] }}
            </span>
          </div>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
            {{ m.value }}
            <span class="text-sm font-normal text-slate-500">{{ m.unit }}</span>
          </p>
          <p v-if="m.note" class="mt-1 text-sm text-slate-600">{{ m.note }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>
