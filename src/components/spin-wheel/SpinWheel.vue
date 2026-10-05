<script setup lang="ts">
/**
 * SpinningWheel.vue
 * -----------------------------------------------------------------------
 * Vòng quay may mắn (spinning wheel) có thể tùy chỉnh số lượng & nội dung
 * phần thưởng. Khi người dùng bấm "QUAY", component sẽ gọi API (hoặc hàm
 * fetch tùy chỉnh) để lấy về index phần thưởng ngẫu nhiên, sau đó quay
 * bánh xe dừng đúng tại phần thưởng đó và hiện popup kết quả.
 *
 * Cách dùng cơ bản:
 * <SpinningWheel
 *   :rewards="rewards"
 *   api-url="/api/lucky-wheel/spin"
 *   @spin-end="onSpinEnd"
 * />
 * -----------------------------------------------------------------------
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import Cash from '../currency/Cash.vue'
export interface Reward {
  id: string | number
  label: string
  value: string | number
  image?: string
  /** Màu nền của lát cắt tương ứng, nếu không truyền sẽ dùng bảng màu mặc định */
  color?: string
}

interface Props {
  rewards: Reward[]
  spinConfirmation?: {
    currentBalance: number
    totalCost: number
  }
  /** Endpoint trả về JSON dạng { index: number }. Bỏ qua nếu dùng fetchRewardIndex */
  apiUrl?: string
  /** Hàm tự định nghĩa để lấy index ngẫu nhiên, ưu tiên hơn apiUrl nếu có */
  fetchRewardIndex?: () => Promise<number>
  /** Thời gian quay (ms) */
  spinDuration?: number
  /** Kích thước bánh xe (px) */
  size?: number
  /** Số vòng quay thêm cho hiệu ứng trước khi dừng */
  extraSpins?: number
  /** Chặn quay khi chưa đủ điều kiện (vd: chưa đủ số phần thưởng tối thiểu) */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  spinConfirmation: undefined,
  apiUrl: undefined,
  fetchRewardIndex: undefined,
  spinDuration: 4200,
  size: 320,
  extraSpins: 6,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'spin-start'): void
  (e: 'spin-end', reward: Reward): void
  (e: 'error', message: string): void
}>()

const DEFAULT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7',
  '#00B894', '#FD79A8', '#0984E3', '#E17055',
  '#A29BFE', '#55EFC4', '#FAB1A0', '#74B9FF',
]

const spinning = ref(false)
const rotation = ref(0)
const showResult = ref(false)
const resultReward = ref<Reward | null>(null)
const errorMsg = ref('')
const pendingReward = ref<Reward | null>(null)
const showSpinConfirmation = ref(false)

const segmentAngle = computed(() => 360 / Math.max(props.rewards.length, 1))

const gradientBackground = computed(() => {
  const n = props.rewards.length
  if (n === 0) return '#e5e7eb'
  const stops = props.rewards.map((reward, i) => {
    const color = reward.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    const start = i * segmentAngle.value
    const end = (i + 1) * segmentAngle.value
    return `${color} ${start}deg ${end}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
})

const wheelStyle = computed(() => ({
  background: gradientBackground.value,
  transform: `rotate(${rotation.value}deg)`,
  transition: spinning.value
    ? `transform ${props.spinDuration}ms cubic-bezier(0.17, 0.67, 0.2, 1.01)`
    : 'none',
}))

function segmentContentStyle(i: number) {
  const centerAngle = i * segmentAngle.value + segmentAngle.value / 2
  return { transform: `rotate(${centerAngle}deg)` }
}

function normalizeDeg(deg: number) {
  return ((deg % 360) + 360) % 360
}

function rotateToIndex(index: number) {
  const centerAngle = index * segmentAngle.value + segmentAngle.value / 2
  // Con trỏ cố định ở vị trí 12h (0deg). Cần quay bánh xe sao cho tâm của
  // lát cắt "index" trùng với vị trí con trỏ.
  const targetMod = normalizeDeg(360 - centerAngle)
  const currentMod = normalizeDeg(rotation.value)
  let delta = targetMod - currentMod
  if (delta <= 0) delta += 360
  rotation.value += props.extraSpins * 360 + delta
}

async function getRandomIndex(): Promise<number> {
  if (props.fetchRewardIndex) {
    return props.fetchRewardIndex()
  }
  if (props.apiUrl) {
    const res = await fetch(props.apiUrl, { method: 'POST' })
    if (!res.ok) throw new Error(`Request thất bại (status ${res.status})`)
    const data = await res.json()
    if (typeof data?.index !== 'number') {
      throw new Error('Response không hợp lệ, thiếu trường "index"')
    }
    return data.index
  }
  // Không có apiUrl lẫn fetchRewardIndex: dùng giả lập tạm thời để demo.
  // Trong thực tế hãy truyền apiUrl hoặc fetchRewardIndex.
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(Math.floor(Math.random() * props.rewards.length))
    }, 500)
  })
}

async function spin() {
  if (spinning.value || props.disabled || props.rewards.length === 0) return
  errorMsg.value = ''
  spinning.value = true
  emit('spin-start')

  try {
    const rawIndex = await getRandomIndex()
    const n = props.rewards.length
    const safeIndex = ((Math.trunc(rawIndex) % n) + n) % n
    pendingReward.value = props.rewards[safeIndex]
    rotateToIndex(safeIndex)
  } catch (err) {
    spinning.value = false
    errorMsg.value = err instanceof Error ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại.'
    emit('error', errorMsg.value)
  }
}

function requestSpin() {
  if (spinning.value || props.disabled || props.rewards.length === 0) return
  if (props.spinConfirmation) {
    showSpinConfirmation.value = true
    return
  }
  void spin()
}

function cancelSpin() {
  showSpinConfirmation.value = false
}

function confirmSpin() {
  showSpinConfirmation.value = false
  void spin()
}

function onTransitionEnd(e: TransitionEvent) {
  if (e.propertyName !== 'transform' || !spinning.value) return
  spinning.value = false
  resultReward.value = pendingReward.value
  pendingReward.value = null
  if (resultReward.value) {
    showResult.value = true
    emit('spin-end', resultReward.value)
  }
}

function closeResult() {
  showResult.value = false
}

// Fallback an toàn: nếu vì lý do gì đó transitionend không bắn (ví dụ tab
// bị ẩn), vẫn đảm bảo mở khóa nút quay sau spinDuration + buffer.
let fallbackTimer: number | undefined
function armFallback() {
  if (fallbackTimer) window.clearTimeout(fallbackTimer)
  fallbackTimer = window.setTimeout(() => {
    if (spinning.value) onTransitionEnd(new TransitionEvent('transitionend', { propertyName: 'transform' }))
  }, props.spinDuration + 400)
}
onBeforeUnmount(() => {
  if (fallbackTimer) window.clearTimeout(fallbackTimer)
})
</script>

<template>
  <div class="flex flex-col items-center gap-6 overflow-hidden p-3">
    <div class="relative" :style="{ width: `${size}px`, height: `${size}px` }">
      <!-- Con trỏ chỉ phần thưởng, cố định phía trên -->
      <div
        class="absolute left-1/2 -top-2 z-20 -translate-x-1/2"
        style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.35))"
      >
        <div class="h-0 w-0 border-x-14 border-t-24 border-x-transparent border-t-amber-400" />
      </div>

      <!-- Bánh xe -->
      <div
        class="absolute inset-0 overflow-hidden rounded-full border-[6px] border-white shadow-[0_1px_10px_rgba(0,0,0,0.25)]"
        :style="wheelStyle"
        @transitionend="onTransitionEnd"
        @transitionrun="armFallback"
      >
        <div
          v-for="(reward, i) in rewards"
          :key="reward.id"
          class="absolute inset-0"
          :style="segmentContentStyle(i)"
        >
          <div class="flex flex-col items-center gap-1 pt-5">
            <img
              v-if="reward.image"
              :src="reward.image"
              :alt="reward.label"
              class="h-10 w-10 object-contain drop-shadow-md"
            />
            <span class="max-w-[64px] truncate text-center text-[11px] font-semibold text-white drop-shadow">
              {{ reward.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- Nút quay ở tâm -->
      <button
        type="button"
        class="absolute cursor-pointer inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-xs font-bold tracking-wide text-white shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="spinning || disabled || rewards.length === 0"
        @click="requestSpin"
      >
        {{ spinning ? '...' : 'QUAY' }}
      </button>
    </div>

    <p v-if="errorMsg" class="text-sm font-medium text-red-500">{{ errorMsg }}</p>

    <Teleport to="body">
      <div
        v-if="showSpinConfirmation && spinConfirmation"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4"
        role="presentation"
        @click.self="cancelSpin"
      >
        <section
          class="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spin-confirmation-title"
        >
          <h2 id="spin-confirmation-title" class="m-0 text-center text-lg font-bold">
            Xác nhận quay?
          </h2>
          <div class="mt-5 space-y-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <span>Số dư hiện tại:</span>
              <Cash :amount="spinConfirmation.currentBalance" />
            </div>
            <hr>
            <div class="flex items-center justify-between gap-3 font-semibold">
              <span>Tổng chi phí lượt quay:</span>
              <Cash :amount="spinConfirmation.totalCost" />
            </div>
          </div>
          <div class="mt-6 flex justify-center gap-3">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              @click="cancelSpin"
            >
              Hủy
            </button>
            <button
              type="button"
              class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3e29]"
              @click="confirmSpin"
            >
              Xác nhận quay
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- Popup thông báo kết quả -->
    <Teleport to="body">
      <Transition name="reward-fade">
        <div
          v-if="showResult"
          class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4"
          @click.self="closeResult"
        >
          <div class="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <img
              v-if="resultReward?.image"
              :src="resultReward.image"
              :alt="resultReward.label"
              class="mx-auto mb-4 h-24 w-24 object-contain"
            />
            <p class="mb-1 text-sm text-slate-500">Chúc mừng bạn đã nhận được</p>
            <p class="mb-6 text-2xl font-bold text-slate-900">{{ resultReward?.label }}</p>
            <button
              type="button"
              class="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              @click="closeResult"
            >
              Nhận thưởng
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.reward-fade-enter-active,
.reward-fade-leave-active {
  transition: opacity 0.2s ease;
}
.reward-fade-enter-from,
.reward-fade-leave-to {
  opacity: 0;
}
</style>