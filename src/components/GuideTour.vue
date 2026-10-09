
<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useId,
  watch,
} from 'vue'

interface GuideStep {
  target: string
  title: string
  description: string
  padding?: number
  radius?: number
}

const props = defineProps<{
  steps: GuideStep[]
}>()

const emit = defineEmits<{
  finish: []
}>()

const maskId = `guide-mask-${useId()}`
const currentIndex = ref(0)

const viewport = ref({
  width: window.innerWidth,
  height: window.innerHeight,
})

const spotlight = ref({
  x: -100,
  y: -100,
  width: 0,
  height: 0,
  radius: 10,
})

const tooltip = ref({
  x: 16,
  y: 16,
  width: 320,
})

const activeStep = computed(
  () => props.steps[currentIndex.value],
)

const progress = computed(
  () => `${currentIndex.value + 1} / ${props.steps.length}`,
)

function updatePosition() {
  const step = activeStep.value
  if (!step) return

  const element = document.querySelector(step.target)
  if (!element) return

  const rect = element.getBoundingClientRect()
  const padding = step.padding ?? 8

  spotlight.value = {
    x: rect.left - padding,
    y: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    radius: step.radius ?? 12,
  }

  const margin = 16
  const tooltipWidth = Math.min(320, window.innerWidth - 32)
  const tooltipHeight = 160

  let x = rect.left + rect.width / 2 - tooltipWidth / 2
  x = Math.max(
    margin,
    Math.min(x, window.innerWidth - tooltipWidth - margin),
  )

  // Ưu tiên đặt tooltip bên dưới phần tử.
  let y = rect.bottom + padding + 20

  // Nếu không đủ chỗ thì đặt lên trên.
  if (y + tooltipHeight > window.innerHeight - margin) {
    y = rect.top - tooltipHeight - 20
  }

  y = Math.max(
    margin,
    Math.min(y, window.innerHeight - tooltipHeight - margin),
  )

  tooltip.value = {
    x,
    y,
    width: tooltipWidth,
  }
}

async function goToStep(index: number) {
  if (index < 0) return

  if (index >= props.steps.length) {
    emit('finish')
    return
  }

  currentIndex.value = index
  await nextTick()

  const element = document.querySelector(
    props.steps[index].target,
  )

  if (!element) return

  // Cuộn đến target của step hiện tại
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  })

  // Cập nhật ngay và tiếp tục cập nhật trong khi cuộn
  updatePosition()

  let previousPosition = ''

  const trackScroll = () => {
    updatePosition()

    const rect = element.getBoundingClientRect()
    const position = `${rect.top}:${rect.left}`

    if (position !== previousPosition) {
      previousPosition = position
      requestAnimationFrame(trackScroll)
    }
  }

  requestAnimationFrame(trackScroll)
}

function next() {
  goToStep(currentIndex.value + 1)
}

function previous() {
  goToStep(currentIndex.value - 1)
}

function updateViewport() {
  viewport.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
  updatePosition()
}

let resizeObserver: ResizeObserver | undefined

watch(
  () => props.steps,
  () => goToStep(0),
)

onMounted(async () => {
  await nextTick()

  updateViewport()

  window.addEventListener('resize', updateViewport)
  window.addEventListener('scroll', updatePosition, true)

  resizeObserver = new ResizeObserver(updatePosition)

  document.querySelectorAll(
    props.steps.map(step => step.target).join(','),
  ).forEach(element => resizeObserver?.observe(element))

  // Chủ động cuộn về target đầu tiên
  await goToStep(0)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('scroll', updatePosition, true)
  resizeObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="activeStep"
      class="guide-tour"
      role="dialog"
      aria-modal="false"
      :aria-label="activeStep.title"
    >
      <!-- Lớp phủ SVG có một vùng trong suốt -->
      <svg
        class="guide-tour__overlay"
        :viewBox="`0 0 ${viewport.width} ${viewport.height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask
            :id="maskId"
            maskUnits="userSpaceOnUse"
            :x="0"
            :y="0"
            :width="viewport.width"
            :height="viewport.height"
          >
            <rect
              width="100%"
              height="100%"
              fill="white"
            />

            <rect
              class="guide-tour__hole"
              :x="spotlight.x"
              :y="spotlight.y"
              :width="spotlight.width"
              :height="spotlight.height"
              :rx="spotlight.radius"
              fill="black"
            />
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.78)"
          :mask="`url(#${maskId})`"
        />

        <!-- Viền sáng quanh vùng được chọn -->
        <rect
          class="guide-tour__border"
          :x="spotlight.x"
          :y="spotlight.y"
          :width="spotlight.width"
          :height="spotlight.height"
          :rx="spotlight.radius"
        />
      </svg>

            
      <!-- Chặn tương tác ngay trên vùng spotlight -->
      <div
        class="guide-tour__target-blocker"
        :style="{
          left: `${spotlight.x}px`,
          top: `${spotlight.y}px`,
          width: `${spotlight.width}px`,
          height: `${spotlight.height}px`,
          borderRadius: `${spotlight.radius}px`,
        }"
      />

      <!-- Start Chặn tương tác bên ngoài spotlight -->
      <div
        class="guide-tour__blocker guide-tour__blocker--top"
        :style="{
          height: `${Math.max(0, spotlight.y)}px`,
        }"
      />
      <div
        class="guide-tour__blocker guide-tour__blocker--bottom"
        :style="{
          top: `${spotlight.y + spotlight.height}px`,
        }"
      />

      <div
        class="guide-tour__blocker guide-tour__blocker--left"
        :style="{
          top: `${spotlight.y}px`,
          width: `${Math.max(0, spotlight.x)}px`,
          height: `${spotlight.height}px`,
        }"
      />

      <div
        class="guide-tour__blocker guide-tour__blocker--right"
        :style="{
          top: `${spotlight.y}px`,
          left: `${spotlight.x + spotlight.width}px`,
          height: `${spotlight.height}px`,
        }"
      />

      <!-- End Chặn tương tác bên ngoài spotlight -->

      <!-- Tooltip -->
      <Transition name="guide-tooltip" mode="out-in">
        <section
          :key="currentIndex"
          class="guide-tour__tooltip"
          :style="{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            width: `${tooltip.width}px`,
          }"
        >
          <div class="guide-tour__progress">
            HƯỚNG DẪN · {{ progress }}
          </div>

          <h3>{{ activeStep.title }}</h3>
          <p>{{ activeStep.description }}</p>

          <div class="guide-tour__actions">
            <button
              class="guide-tour__skip"
              @click="emit('finish')"
            >
              Bỏ qua
            </button>

            <div class="guide-tour__navigation">
              <button
                v-if="currentIndex > 0"
                class="guide-tour__back"
                @click="previous"
              >
                Quay lại
              </button>

              <button
                class="guide-tour__next"
                @click="next"
              >
                {{
                  currentIndex === steps.length - 1
                    ? 'Hoàn tất'
                    : 'Tiếp theo'
                }}
              </button>
            </div>
          </div>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.guide-tour {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}

.guide-tour__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.guide-tour__hole,
.guide-tour__border {
  transition:
    x 350ms ease,
    y 350ms ease,
    width 350ms ease,
    height 350ms ease,
    rx 350ms ease;
}

.guide-tour__border {
  fill: none;
  stroke: #fff;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
}

/* Tooltip và các nút điều hướng luôn ở trên cùng */
.guide-tour__tooltip {
  position: fixed;
  box-sizing: border-box;
  z-index: 10;
  padding: 18px;
  color: #f8fafc;
  background: #17191f;
  border: 1px solid #3b3f49;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  user-select: none;
}

.guide-tour__progress {
  margin-bottom: 8px;
  color: #a5b4fc;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.guide-tour__tooltip h3 {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
}

.guide-tour__tooltip p {
  margin: 0;
  color: #c4c8d1;
  font-size: 13px;
  line-height: 1.6;
}
/* Chặn vùng mục tiêu */
.guide-tour__target-blocker {
  position: fixed;
  z-index: 2;
  background: transparent;
  pointer-events: auto;
}
/* Chặn các vùng xung quanh */
.guide-tour__blocker {
  position: fixed;
  z-index: 1;
  pointer-events: auto;
  background: transparent;
}

.guide-tour__blocker--top {
  top: 0;
  left: 0;
  right: 0;
}

.guide-tour__blocker--bottom {
  left: 0;
  right: 0;
  bottom: 0;
}

.guide-tour__blocker--left {
  left: 0;
}

.guide-tour__blocker--right {
  right: 0;
}

.guide-tour__actions,
.guide-tour__navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guide-tour__actions {
  justify-content: space-between;
  margin-top: 20px;
}

.guide-tour__navigation {
  margin-left: auto;
}

.guide-tour__actions button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.guide-tour__skip,
.guide-tour__back {
  color: #c4c8d1;
  background: transparent;
}

.guide-tour__next {
  color: #111827;
  background: #fff;
}

.guide-tooltip-enter-active,
.guide-tooltip-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.guide-tooltip-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.guide-tooltip-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .guide-tour__hole,
  .guide-tour__border,
  .guide-tooltip-enter-active,
  .guide-tooltip-leave-active {
    transition: none;
  }
}
</style>