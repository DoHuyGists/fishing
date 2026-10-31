<script setup lang="ts">
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
    firstText: 'Hủy',
    secondText: 'Xác nhận',
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
    class="fixed top-0 left-0 z-[9999] flex h-screen w-screen items-center justify-center bg-black/60 backdrop-blur-[4px]"
    role="dialog"
    aria-modal="true"
    @click.self="onDismiss?.()"
  >
    <div
      class="w-[90%] max-w-[420px] rounded-xl bg-white p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)]"
    >
      <div>
        <div class="mb-3 text-xl leading-normal font-bold text-[#b91c1c]">
          {{ title }}
        </div>
      </div>

      <div>
        <!-- Slot mặc định cho phép thay nội dung chính bằng HTML tùy ý -->
        <slot>
          <p v-if="message" class="mb-2 text-[0.95rem] leading-normal text-[#374151]">
            {{ message }}
          </p>
        </slot>
        <p v-if="subText" class="mb-2 text-[0.85rem] leading-normal text-[#6b7280]">
          {{ subText }}
        </p>
      </div>

      <div class="mt-5 flex justify-center gap-3">
        <button
          type="button"
          :disabled="firstDisabled"
          class="cursor-pointer rounded-md bg-[#e5e7eb] px-4 py-2 text-[13.3333px] leading-normal font-medium text-[#1f2937] transition-opacity duration-200 hover:opacity-90"
          :class="{ 'cursor-not-allowed opacity-50': firstDisabled }"
          @click="onFirst?.()"
        >
          {{ firstText }}
        </button>
        <button
          type="button"
          :disabled="secondDisabled"
          class="cursor-pointer rounded-md bg-[#dc2626] px-4 py-2 text-[13.3333px] leading-normal font-medium text-white transition-opacity duration-200 hover:opacity-90"
          :class="{ 'cursor-not-allowed opacity-50': secondDisabled }"
          @click="onSecond?.()"
        >
          {{ secondText }}
        </button>
      </div>
    </div>
  </div>
</template>
