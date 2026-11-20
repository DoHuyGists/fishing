<script setup lang="ts">
import type { SpeciesBoundaryShape, SpeciesDistributionBoundary } from '../../../types/table/speciesInArea';

defineProps<{ boundary: SpeciesDistributionBoundary; editing: boolean; selectedNode: number | null; disabled: boolean }>();
const emit = defineEmits<{
  preset: [shape: SpeciesBoundaryShape, random?: boolean];
  resize: [axis: 'width' | 'height', value: number];
  toggle: [];
  add: [];
  remove: [];
}>();
const presets: { shape: SpeciesBoundaryShape; label: string }[] = [
  { shape: 'natural', label: 'Tự nhiên' }, { shape: 'ellipse', label: 'Bầu dục' }, { shape: 'circle', label: 'Tròn' },
  { shape: 'rect', label: 'Chữ nhật' }, { shape: 'square', label: 'Vuông' }, { shape: 'round', label: 'Bo góc' }, { shape: 'hex', label: 'Lục giác' },
];
</script>

<template>
  <fieldset :disabled="disabled" class="mb-3 min-w-0 rounded-lg border border-border-default bg-white p-3 disabled:opacity-50">
    <legend class="px-1 text-xs font-bold">Hình dạng vòng biên</legend>
    <div class="flex flex-wrap gap-1.5">
      <button v-for="preset in presets" :key="preset.shape" type="button" :aria-pressed="boundary.shape === preset.shape" class="rounded-md border px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed" :class="boundary.shape === preset.shape ? 'border-accent bg-surface text-content' : 'border-border-default hover:bg-surface'" @click="emit('preset', preset.shape)">{{ preset.label }}</button>
      <button type="button" class="rounded-md border border-dashed border-border-default px-2 py-1.5 text-xs font-semibold hover:bg-surface" @click="emit('preset', 'natural', true)">Ngẫu nhiên</button>
      <button type="button" :aria-pressed="editing" class="ml-auto rounded-md border border-border-default px-2 py-1.5 text-xs font-semibold" :class="editing ? 'bg-content-strong text-white' : 'bg-surface'" @click="emit('toggle')">Chỉnh vòng biên</button>
    </div>
    <div v-if="boundary.shape === 'natural'" class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span>{{ boundary.nodes.length }}/24 node</span>
      <button type="button" :disabled="boundary.nodes.length >= 24" class="rounded border border-border-default px-2 py-1 disabled:opacity-40" @click="emit('add')">Thêm node</button>
      <button type="button" :disabled="selectedNode === null || boundary.nodes.length <= 6" class="rounded border border-danger px-2 py-1 text-danger disabled:opacity-40" @click="emit('remove')">Xóa node</button>
      <span v-if="editing" class="text-content/70">Kéo node bờ hồ để uốn biên; bấm đúp lên bờ để thêm node.</span>
    </div>
    <div v-else class="mt-2 grid gap-2 sm:grid-cols-2">
      <label class="text-xs">{{ boundary.shape === 'circle' || boundary.shape === 'square' ? 'Kích thước' : 'Chiều rộng' }}: {{ Math.round(boundary.width) }}
        <input type="range" aria-label="Chiều rộng vòng biên" min="160" :max="boundary.shape === 'circle' || boundary.shape === 'square' ? 340 : 540" :value="boundary.width" class="mt-1 block w-full accent-accent" @input="emit('resize', 'width', Number(($event.target as HTMLInputElement).value))" />
      </label>
      <label v-if="boundary.shape !== 'circle' && boundary.shape !== 'square'" class="text-xs">Chiều cao: {{ Math.round(boundary.height) }}
        <input type="range" aria-label="Chiều cao vòng biên" min="120" max="340" :value="boundary.height" class="mt-1 block w-full accent-accent" @input="emit('resize', 'height', Number(($event.target as HTMLInputElement).value))" />
      </label>
    </div>
  </fieldset>
</template>
