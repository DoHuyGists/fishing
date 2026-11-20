<script setup lang="ts">
import { t as tr } from "../../i18n";

import { computed } from 'vue'

interface Props {
  /** Nội dung gợi ý. Có thể bỏ qua nếu dùng slot mặc định. */
  text?: string
  /** Độ rộng tối đa của hộp gợi ý (Tailwind class). */
  maxWidthClass?: string
  /** Nhãn đọc cho trình đọc màn hình. */
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  maxWidthClass: 'max-w-[16rem]',
  label: undefined,
})

// id duy nhất để liên kết nút với tooltip (aria-describedby)
let uid = 0
const tooltipId = `hint-${Math.random().toString(36).slice(2, 9)}-${uid++}`

const tooltipClasses = computed(() => ['w-max', props.maxWidthClass])
</script>

<template>
  <span class="shared-hint group relative inline-flex align-middle">
    <button
      type="button"
      :aria-label="label ?? tr('Hint.xem_goi_y')"
      :aria-describedby="tooltipId"
      class="inline-flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full bg-surface border border-accent text-[11px] font-bold leading-none text-content transition-colors duration-150 hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
    >
      ?
    </button>

    <span
      :id="tooltipId"
      role="tooltip"
      :class="tooltipClasses"
      class="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-normal rounded-lg bg-accent px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none"
    >
      <slot>{{ text }}</slot>

      <!-- Mũi tên trỏ xuống -->
      <span
        aria-hidden="true"
        class="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-accent"
      />
    </span>
  </span>
</template>

<style scoped>
.ocean-theme .shared-hint > button {
  color: var(--color-ocean-cyan);
  border-color: var(--color-ocean-cyan);
  background: var(--color-ocean-deep);
}

.ocean-theme .shared-hint > button:hover,
.ocean-theme .shared-hint > button:focus-visible {
  color: var(--color-white);
  background: var(--color-ocean-cyan);
  --tw-ring-color: var(--color-ocean-cyan);
  --tw-ring-offset-color: var(--color-content);
}

.ocean-theme .shared-hint > [role="tooltip"] {
  color: var(--color-ocean-pearl);
  border: 1px solid color-mix(in srgb, var(--color-gold) 50.196%, transparent);
  background: var(--color-ocean-panel);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-content) 40%, transparent);
}

.ocean-theme .shared-hint > [role="tooltip"] > [aria-hidden="true"] {
  background: var(--color-ocean-panel);
}
</style>
