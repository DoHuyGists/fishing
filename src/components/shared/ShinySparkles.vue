<template>
  <span class="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
    <svg v-for="index in 5" :key="index" class="shiny-sparkle absolute size-4 text-amber-300" :style="{ '--sparkle-index': index }" viewBox="0 0 24 24" fill="currentColor">
      <path d="m12 0 3.2 8.8L24 12l-8.8 3.2L12 24l-3.2-8.8L0 12l8.8-3.2Z" />
    </svg>
  </span>
</template>
