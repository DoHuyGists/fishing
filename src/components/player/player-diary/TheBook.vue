<script lang="ts" setup>
import type { BookVariant, BookProps, BookPage, BookPageItem as PageItem } from "../../../types/model/diary";
import { t as tr } from "../../../i18n";
import { computed, onBeforeUpdate, ref, useSlots } from 'vue'
import { useBookMotion } from '../../../composables/useBookMotion'

/** Một trang nội dung bên trong sách */

/** Trang nội bộ: lấy từ prop `pages` hoặc từ named slot `page-N` */

const props = withDefaults(defineProps<BookProps & { pages?: BookPage[] }>(), {
  title: '1984',
  author: 'George Orwell',
  numUp: '84',
  numDown: '1',
  variant: 'default',
  scale: 1,
})

const emit = defineEmits<{
  (e: 'open' | 'close'): void
}>()

const VARIANT_PRESETS: Record<BookVariant, { coverBg: string; spineBg: string; textColor: string }> = {
  default: {
    coverBg: 'linear-gradient(45deg, #DAD5DC 0%, #f2ebf4 100%)',
    spineBg: 'rgba(232, 229, 234, 1)',
    textColor: '#2b2b2b',
  },
  ocean: {
    coverBg: 'linear-gradient(45deg, #102a43 0%, #243b53 50%, #334e68 100%)',
    spineBg: '#091e36',
    textColor: '#f0f4f8',
  },
  gold: {
    coverBg: 'linear-gradient(45deg, #785208 0%, #f7c948 100%)',
    spineBg: '#5c3d02',
    textColor: '#1f1601',
  },
  dark: {
    coverBg: 'linear-gradient(45deg, #18181b 0%, #3f3f46 100%)',
    spineBg: '#09090b',
    textColor: '#f4f4f5',
  },
  emerald: {
    coverBg: 'linear-gradient(45deg, #064e3b 0%, #10b981 100%)',
    spineBg: '#022c22',
    textColor: '#ecfdf5',
  },
}

const styleVars = computed(() => {
  const preset = VARIANT_PRESETS[props.variant] || VARIANT_PRESETS.default
  return {
    '--book-cover-bg': props.coverBg || preset.coverBg,
    '--book-spine-bg': props.spineBg || preset.spineBg,
    '--book-text-color': props.textColor || preset.textColor,
    '--book-scale': props.scale,
  }
})

/* ------------------------------------------------------------------ */
/*  Nội dung trang                                                     */
/* ------------------------------------------------------------------ */

// Đọc các slot dạng `page-1`, `page-2`, ... (chỉ đọc tên slot, không render)
const slots = useSlots()
const readSlotPageNumbers = () =>
  Object.keys(slots)
    .map((k) => /^page-(\d+)$/.exec(k)?.[1])
    .filter((n): n is string => !!n)
    .map(Number)
const slotPageMax = ref(Math.max(0, ...readSlotPageNumbers()))
onBeforeUpdate(() => {
  const max = Math.max(0, ...readSlotPageNumbers())
  if (max !== slotPageMax.value) slotPageMax.value = max
})

const pageList = computed<PageItem[]>(() => {
  // 1. Ưu tiên slot: <template #page-1>, <template #page-2>, ...
  if (slotPageMax.value > 0) {
    return Array.from({ length: slotPageMax.value }, (_, i) => ({ slot: `page-${i + 1}` }))
  }
  // 2. Prop `pages`
  if (props.pages?.length) return props.pages
  // Nội dung mẫu khi chưa truyền prop `pages`
  return [
    { title: props.title, content: tr('TheBook.sample_intro', { author: props.author }) },
    { title: tr('TheBook.sample_page_title'), content: tr('TheBook.sample_page_content') },
    { title: tr('TheBook.sample_turn_title'), content: tr('TheBook.sample_turn_content') },
    { title: tr('TheBook.sample_customize_title'), content: tr('TheBook.sample_customize_content') },
  ]
})

/** Gom các trang thành từng tờ giấy: mặt trước (trang phải) + mặt sau (trang trái) */
const contentLeaves = computed(() => {
  const list = pageList.value
  const leaves: { sides: { cls: string; page: PageItem | null; no: number }[] }[] = []
  for (let k = 0; k < list.length; k += 2) {
    leaves.push({
      sides: [
        { cls: 'face-front', page: list[k], no: k + 1 },
        { cls: 'face-back', page: list[k + 1] ?? null, no: k + 2 },
      ],
    })
  }
  return leaves
})

/** Tổng số tờ = bìa trước + các tờ nội dung */
const totalLeaves = computed(() => contentLeaves.value.length + 1)

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

const { slotEl, moverEl, anchorEl, bookEl, backdropEl, isOpen, flipped, controlsVisible, slotStyle, moverStyle, bookStyle, leafStyle, open, close, next, prev } = useBookMotion(() => props.scale, totalLeaves, event => emit(event));

const spreadLabel = computed(() => {
  const f = flipped.value
  const leaves = contentLeaves.value.length
  const total = pageList.value.length
  const left = f >= 2 ? 2 * f - 2 : 0
  const right = f <= leaves ? 2 * f - 1 : 0
  const nums = [left, right].filter((n) => n > 0 && n <= total)
  return nums.length ? tr('TheBook.spread', { pages: nums.join('–'), total }) : ''
})


defineExpose({ open, close })
</script>

<template>
  <div ref="slotEl" class="book-slot" :style="slotStyle">
    <Teleport to="body" :disabled="!isOpen">
      <div
        class="book-stage"
        :class="{ 'is-open': isOpen, 'is-spread': flipped > 0 }"
        :style="styleVars"
      >
        <div v-if="isOpen" ref="backdropEl" class="book-backdrop" @click="close" />

        <div ref="moverEl" class="book-container" :style="moverStyle">
          <div ref="anchorEl" class="book-anchor">
            <div
              ref="bookEl"
              class="book"
              :style="bookStyle"
              :role="isOpen ? undefined : 'button'"
              :tabindex="isOpen ? -1 : 0"
              :aria-label="isOpen ? undefined : tr('TheBook.open', { title })"
              @click="open"
              @keydown.enter.prevent="open"
            >
              <div class="left-side">
                <div class="spine-title">
                  <span>{{ author }}</span>
                  <span>{{ title }}</span>
                </div>
              </div>

              <div class="leaves">
                <!-- Tờ 0: bìa trước (mặt ngoài) + bìa trong (mặt sau) -->
                <div class="leaf" :style="leafStyle(0)">
                  <div class="face face-front cover">
                    <div class="num-up">{{ numUp }}</div>
                    <slot name="cover-icon">
                      <svg
                        id="eye-left"
                        xmlns="http://www.w3.org/2000/svg"
                        width="75"
                        height="100"
                        version="1.0"
                      >
                        <path
                          d="m 72.520861,60.915859 v 0 C 69.385207,53.011396 61.908243,46.570093 55.74346,42.387465 49.578631,38.204905 40.408101,36.818968 33.679899,37.051071 c -1.597953,0.05517 -2.931531,0.451253 -4.000736,1.188245 -0.738155,0.570053 -1.097854,1.127016 -1.079089,1.670881 0.02949,0.854739 0.93486,2.69053 2.716108,5.507379 0.805175,1.372521 1.234574,2.83577 1.288193,4.389751 0.131362,3.807345 -0.983571,6.879734 -3.344801,9.217182 -2.361227,2.337476 -5.686459,3.580206 -9.975699,3.728183 C 15.162859,62.894893 11.580282,61.559887 8.5361375,58.747669 5.4920363,55.935482 3.8975877,52.431474 3.7527937,48.235627 c -0.1769131,-5.1282 2.0835359,-9.776522 6.7813483,-13.944986 4.697855,-4.168379 11.041643,-6.390426 19.031387,-6.666142 8.662566,-0.298838 16.811229,2.201105 24.446015,7.499833 7.634738,5.298806 13.804506,13.895976 18.509317,25.791527 z"
                          fill="currentColor"
                          fill-opacity="1"
                          stroke="none"
                          stroke-width=".72233355px"
                          stroke-linecap="butt"
                          stroke-linejoin="miter"
                          stroke-opacity="1"
                        />
                      </svg>
                      <svg
                        id="eye-right"
                        xmlns="http://www.w3.org/2000/svg"
                        width="75"
                        height="100"
                        version="1.0"
                      >
                        <path
                          d="m 72.520861,60.915859 v 0 C 69.385207,53.011396 61.908243,46.570093 55.74346,42.387465 49.578631,38.204905 40.408101,36.818968 33.679899,37.051071 c -1.597953,0.05517 -2.931531,0.451253 -4.000736,1.188245 -0.738155,0.570053 -1.097854,1.127016 -1.079089,1.670881 0.02949,0.854739 0.93486,2.69053 2.716108,5.507379 0.805175,1.372521 1.234574,2.83577 1.288193,4.389751 0.131362,3.807345 -0.983571,6.879734 -3.344801,9.217182 -2.361227,2.337476 -5.686459,3.580206 -9.975699,3.728183 C 15.162859,62.894893 11.580282,61.559887 8.5361375,58.747669 5.4920363,55.935482 3.8975877,52.431474 3.7527937,48.235627 c -0.1769131,-5.1282 2.0835359,-9.776522 6.7813483,-13.944986 4.697855,-4.168379 11.041643,-6.390426 19.031387,-6.666142 8.662566,-0.298838 16.811229,2.201105 24.446015,7.499833 7.634738,5.298806 13.804506,13.895976 18.509317,25.791527 z"
                          fill="currentColor"
                          fill-opacity="1"
                          stroke="none"
                          stroke-width=".72233355px"
                          stroke-linecap="butt"
                          stroke-linejoin="miter"
                          stroke-opacity="1"
                        />
                      </svg>
                    </slot>
                    <div class="num-down">{{ numDown }}</div>
                    <div class="author">{{ author }}</div>
                    <div class="title">{{ title }}</div>
                  </div>

                  <div class="face face-back endpaper">
                    <slot name="inner-cover">
                      <div class="endpaper-mark">
                        <span>{{ title }}</span>
                        <span>{{ author }}</span>
                      </div>
                    </slot>
                  </div>
                </div>

                <!-- Các tờ nội dung -->
                <div
                  v-for="(leaf, j) in contentLeaves"
                  :key="j"
                  class="leaf page-leaf"
                  :style="leafStyle(j + 1)"
                >
                  <div
                    v-for="side in leaf.sides"
                    :key="side.no"
                    class="face paper"
                    :class="side.cls"
                  >
                    <div v-if="side.page" class="page-body">
                      <slot v-if="side.page.slot" :name="side.page.slot" :number="side.no" />
                      <slot v-else name="page" :page="side.page" :number="side.no">
                        <div v-if="side.page.title" class="page-title">{{ side.page.title }}</div>
                        <div v-if="side.page.content" class="page-text">{{ side.page.content }}</div>
                      </slot>
                    </div>
                    <span v-if="side.page" class="page-number">{{ side.no }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Transition name="book-fade">
          <div v-if="isOpen && controlsVisible" class="book-controls">
            <button type="button" class="ctl ctl-close" :aria-label="tr('TheBook.close')" @click.stop="close">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>

            <div class="ctl-pager">
              <button
                type="button"
                class="ctl"
                :aria-label="tr('TheBook.previous')"
                :disabled="flipped <= 1"
                @click.stop="prev"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <span class="ctl-label">{{ spreadLabel }}</span>
              <button
                type="button"
                class="ctl"
                :aria-label="tr('TheBook.next')"
                :disabled="flipped >= totalLeaves"
                @click.stop="next"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="./the-book.css"></style>
