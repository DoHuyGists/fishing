<script setup lang="ts">
import { t as tr } from "../../i18n";

withDefaults(
  defineProps<{
    /** Hiện/ẩn modal. Có thể bỏ qua nếu dùng v-if ở nơi gọi */
    show?: boolean
    /** Tiêu đề (màu đỏ) */
    title: string
    /** Nội dung chính */
    message?: string
    /** Dòng phụ nhỏ, màu xám bên dưới nội dung chính */
    subText?: string
    /** Nhãn nút bên trái (kiểu secondary - nền xám) */
    firstText?: string
    /** Nhãn nút bên phải (kiểu danger - nền đỏ) */
    secondText?: string
    /** Vô hiệu hóa nút bên trái */
    firstDisabled?: boolean
    /** Vô hiệu hóa nút bên phải */
    secondDisabled?: boolean
    /** Callback của nút bên trái */
    onFirst?: () => void
    /** Callback của nút bên phải */
    onSecond?: () => void
    /** Callback khi đóng bằng cách bấm ra ngoài hộp thoại */
    onDismiss?: () => void
  }>(),
  {
    show: true,
    message: '',
    subText: '',
    firstText: undefined,
    secondText: undefined,
    firstDisabled: false,
    secondDisabled: false,
    onFirst: undefined,
    onSecond: undefined,
    onDismiss: undefined,
  },
)
</script>

<template>
  <div
    v-if="show"
    class="fixed top-0 left-0 z-[9999] flex h-screen w-screen items-center justify-center bg-content/60 backdrop-blur-[4px]"
    role="dialog"
    aria-modal="true"
    @click.self="onDismiss?.()"
  >
    <div
      class="shared-confirmation player-popup-in w-[90%] max-w-[420px] rounded-xl bg-white p-6 shadow-[0_20px_25px_-5px_color-mix(in_srgb,_var(--color-content)_10%,_transparent)]"
    >
      <div>
        <div class="shared-confirmation__title mb-3 text-xl leading-normal font-bold text-danger">
          {{ title }}
        </div>
      </div>

      <div>
        <!-- Slot mặc định cho phép thay nội dung chính bằng HTML tùy ý -->
        <slot>
          <div v-if="message" class="shared-confirmation__message mb-2 text-[0.95rem] leading-normal text-content">
            {{ message }}
          </div>
        </slot>
        <div v-if="subText" class="shared-confirmation__subtext mb-2 text-[0.85rem] leading-normal text-content">
          {{ subText }}
        </div>
      </div>

      <div class="mt-5 flex justify-center gap-3">
        <button
          type="button"
          :disabled="firstDisabled"
          class="shared-confirmation__secondary cursor-pointer rounded-md bg-surface px-4 py-2 text-[13.3333px] leading-normal font-medium text-content transition-opacity duration-200 hover:opacity-90"
          :class="{ 'cursor-not-allowed opacity-50': firstDisabled }"
          @click="onFirst?.()"
        >
          {{ firstText ?? tr('AccountInfoModal.huy') }}
        </button>
        <button
          type="button"
          :disabled="secondDisabled"
          class="shared-confirmation__danger cursor-pointer rounded-md bg-danger px-4 py-2 text-[13.3333px] leading-normal font-medium text-white transition-opacity duration-200 hover:opacity-90"
          :class="{ 'cursor-not-allowed opacity-50': secondDisabled }"
          @click="onSecond?.()"
        >
          {{ secondText ?? tr('Fishfarm.xac_nhan') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ocean-theme .shared-confirmation {
  color: var(--color-ocean-pearl);
  border: 1px solid color-mix(in srgb, var(--color-gold) 70.196%, transparent);
  background: linear-gradient(145deg, var(--color-ocean-panel), var(--color-ocean-deep));
  box-shadow: 0 24px 64px color-mix(in srgb, var(--color-content) 60%, transparent), inset 0 1px color-mix(in srgb, var(--color-surface) 14.902%, transparent);
}

.ocean-theme .shared-confirmation__title {
  color: var(--color-ocean-gold);
}

.ocean-theme .shared-confirmation__message {
  color: var(--color-ocean-pearl);
}

.ocean-theme .shared-confirmation__subtext {
  color: color-mix(in srgb, var(--color-ocean-pearl) 75%, transparent);
}

.ocean-theme .shared-confirmation__secondary {
  color: var(--color-ocean-pearl);
  border: 1px solid color-mix(in srgb, var(--color-sky) 50.196%, transparent);
  background: var(--color-ocean-deep);
}

.ocean-theme .shared-confirmation__danger {
  color: var(--color-ocean-pearl);
  border: 1px solid color-mix(in srgb, var(--color-gold) 50.196%, transparent);
  background: var(--color-danger);
  box-shadow: inset 0 1px color-mix(in srgb, var(--color-surface) 14.902%, transparent), 0 3px 0 color-mix(in srgb, var(--color-content) 40%, transparent);
}

.ocean-theme .shared-confirmation button:focus-visible {
  outline: 2px solid var(--color-ocean-cyan);
  outline-offset: 3px;
}
</style>
