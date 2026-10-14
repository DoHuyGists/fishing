<script setup lang="ts">
import { computed, nextTick, reactive, watch } from 'vue'

export interface TabItem {
  /** Định danh duy nhất, cũng là tên slot nội dung của tab. */
  key: string
  /** Tiêu đề hiển thị trên tab. */
  label: string
  /** Vô hiệu hóa tab. */
  disabled?: boolean
  /** Số hoặc chữ nhỏ hiển thị cạnh tiêu đề (vd: số thông báo). */
  badge?: string | number
}

interface Props {
  tabs: TabItem[]
  /** Chỉ render nội dung tab khi tab đó được mở lần đầu. */
  lazy?: boolean
  /** Nhãn aria cho cả danh sách tab. */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  lazy: false,
  ariaLabel: undefined,
})

/** v-model: key của tab đang mở. */
const model = defineModel<string>()

const baseId = `tabs-${Math.random().toString(36).slice(2, 9)}`
const tabId = (key: string) => `${baseId}-tab-${key}`
const panelId = (key: string) => `${baseId}-panel-${key}`

// Nếu chưa có giá trị hoặc giá trị không hợp lệ -> dùng tab đầu tiên khả dụng
const activeKey = computed(() => {
  const found = props.tabs.find((t) => t.key === model.value && !t.disabled)
  return found?.key ?? props.tabs.find((t) => !t.disabled)?.key
})

// Ghi nhớ các tab đã mở (phục vụ chế độ lazy)
const visited = reactive(new Set<string>())
watch(
  activeKey,
  (key) => {
    if (key) visited.add(key)
  },
  { immediate: true },
)

const tabEls = new Map<string, HTMLButtonElement>()
function setTabEl(el: unknown, key: string) {
  if (el instanceof HTMLButtonElement) tabEls.set(key, el)
  else tabEls.delete(key)
}

function select(tab: TabItem) {
  if (tab.disabled) return
  model.value = tab.key
}

/** Điều hướng bàn phím: ← → Home End (bỏ qua tab bị vô hiệu hóa). */
async function onKeydown(e: KeyboardEvent, index: number) {
  const enabled = props.tabs.filter((t) => !t.disabled)
  if (!enabled.length) return

  const current = props.tabs[index]
  const pos = enabled.findIndex((t) => t.key === current.key)
  let next: TabItem | undefined

  switch (e.key) {
    case 'ArrowRight':
      next = enabled[(pos + 1) % enabled.length]
      break
    case 'ArrowLeft':
      next = enabled[(pos - 1 + enabled.length) % enabled.length]
      break
    case 'Home':
      next = enabled[0]
      break
    case 'End':
      next = enabled[enabled.length - 1]
      break
    default:
      return
  }

  e.preventDefault()
  select(next)
  await nextTick()
  tabEls.get(next.key)?.focus()
}
</script>

<template>
  <div class="w-full">
    <!-- Danh sách tab -->
    <div
      role="tablist"
      :aria-label="ariaLabel"
      class="flex gap-1 overflow-x-auto border-b border-green-200"
    >
      <button
        v-for="(tab, index) in tabs"
        :id="tabId(tab.key)"
        :key="tab.key"
        :ref="(el) => setTabEl(el, tab.key)"
        type="button"
        role="tab"
        :aria-selected="tab.key === activeKey"
        :aria-controls="panelId(tab.key)"
        :tabindex="tab.key === activeKey ? 0 : -1"
        :disabled="tab.disabled"
        class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-40"
        :class="
          tab.key === activeKey
            ? 'border-green-600 text-green-700'
            : 'border-transparent text-gray-500 hover:border-green-300 hover:text-green-700'
        "
        @click="select(tab)"
        @keydown="onKeydown($event, index)"
      >
        <!-- Slot tùy biến tiêu đề: <template #label="{ tab, active }"> -->
        <slot name="label" :tab="tab" :active="tab.key === activeKey">
          {{ tab.label }}
          <span
            v-if="tab.badge !== undefined"
            class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
            :class="
              tab.key === activeKey
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-700'
            "
          >
            {{ tab.badge }}
          </span>
        </slot>
      </button>
    </div>

    <!-- Nội dung: mỗi tab một slot, tên slot = key của tab -->
    <template v-for="tab in tabs" :key="tab.key">
      <div
        v-if="!lazy || visited.has(tab.key)"
        v-show="tab.key === activeKey"
        :id="panelId(tab.key)"
        role="tabpanel"
        :aria-labelledby="tabId(tab.key)"
        tabindex="0"
        class="py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        <slot :name="tab.key" :active="tab.key === activeKey" />
      </div>
    </template>
  </div>
</template>