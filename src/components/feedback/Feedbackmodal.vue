<script setup lang="ts">
import { ref, reactive, watch, nextTick, onBeforeUnmount } from 'vue'
import supabase from "../../database/connection";

const emit = defineEmits(["close"])

const SUCCESS_MESSAGE = 'Xin cảm ơn'

const form = reactive({
  like: '',
  dislike: '',
  contribute: '',
})

const errors = reactive({
  like: '',
  dislike: '',
})

const submitting = ref(false)
const submitError = ref('')

// Toast nằm trong cùng component để vẫn hiển thị sau khi modal đóng
const toastVisible = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast() {
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {toastVisible.value = false; emit('close')}, 6000)
}

function resetForm() {
  form.like = ''
  form.dislike = ''
  form.contribute = ''
  errors.like = ''
  errors.dislike = ''
  submitError.value = ''
}

function close() {
  if (submitting.value) return
  emit('close')
}

function validate(): boolean {
  errors.like = form.like.trim() ? '' : 'Vui lòng cho biết bạn thích điều gì'
  errors.dislike = form.dislike.trim() ? '' : 'Vui lòng cho biết bạn chưa hài lòng điều gì'
  return !errors.like && !errors.dislike
}

async function handleSubmit() {
  submitError.value = ''
  if (!validate()) return

  submitting.value = true
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      submitError.value = 'Bạn cần đăng nhập để gửi ý kiến.'
      return
    }

    const contribute = form.contribute.trim()

    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      like: form.like.trim(),
      dislike: form.dislike.trim(),
      contribute: contribute || null,
    })

    if (error) throw error

    resetForm()
    showToast()
  } catch (err) {
    console.error('Gửi feedback thất bại:', err)
    submitError.value = 'Không thể gửi ý kiến lúc này. Vui lòng thử lại.'
  } finally {
    submitting.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  clearTimeout(toastTimer)
})

const textareaBase =
  'w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:opacity-60'
</script>

<template>
  <Teleport to="body">
    <!-- Modal -->
    <Transition
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          class="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
            <div>
              <div id="feedback-title" class="text-lg font-semibold text-gray-900">
                Góp ý
              </div>
              <p class="mt-0.5 text-sm text-gray-500">
                Ý kiến của bạn chắc chắn sẽ được ghi nhận để cải thiện.
              </p>
            </div>
            <button
              type="button"
              class="-mr-2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Đóng"
              :disabled="submitting"
              @click="close"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
                />
              </svg>
            </button>
          </div>

          <!-- Form -->
          <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="handleSubmit">
            <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label for="fb-like" class="mb-1.5 block text-sm font-medium text-gray-800">
                  Bạn thích điều gì? <span class="text-red-500">*</span>
                </label>
                <textarea
                  id="fb-like"
                  ref="likeRef"
                  v-model="form.like"
                  rows="3"
                  :disabled="submitting"
                  placeholder="Những điều làm bạn hài lòng…"
                  :aria-invalid="!!errors.like"
                  :class="[
                    textareaBase,
                    errors.like
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200',
                  ]"
                  @input="errors.like = ''"
                />
                <p v-if="errors.like" class="mt-1 text-sm text-red-600">{{ errors.like }}</p>
              </div>

              <div>
                <label for="fb-dislike" class="mb-1.5 block text-sm font-medium text-gray-800">
                  Bạn chưa hài lòng điều gì? <span class="text-red-500">*</span>
                </label>
                <textarea
                  id="fb-dislike"
                  v-model="form.dislike"
                  rows="3"
                  :disabled="submitting"
                  placeholder="Những điều bạn thấy khó dùng hoặc chưa tốt…"
                  :aria-invalid="!!errors.dislike"
                  :class="[
                    textareaBase,
                    errors.dislike
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200',
                  ]"
                  @input="errors.dislike = ''"
                />
                <p v-if="errors.dislike" class="mt-1 text-sm text-red-600">{{ errors.dislike }}</p>
              </div>

              <div>
                <label for="fb-contribute" class="mb-1.5 block text-sm font-medium text-gray-800">
                  Bạn muốn mong muốn điều gì?
                  <span class="font-normal text-gray-400">(không bắt buộc)</span>
                </label>
                <textarea
                  id="fb-contribute"
                  v-model="form.contribute"
                  rows="3"
                  :disabled="submitting"
                  placeholder="Ý tưởng hoặc tính năng bạn mong muốn…"
                  :class="[
                    textareaBase,
                    'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200',
                  ]"
                />
              </div>

              <p
                v-if="submitError"
                role="alert"
                class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {{ submitError }}
              </p>
            </div>

            <!-- Footer -->
            <div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                :disabled="submitting"
                @click="close"
              >
                Hủy
              </button>
              <button
                type="submit"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="submitting"
              >
                <svg
                  v-if="submitting"
                  class="h-4 w-4 animate-spin motion-reduce:animate-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
                </svg>
                {{ submitting ? 'Đang gửi…' : 'Gửi ý kiến' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Toast -->
    <Transition
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toastVisible"
        role="status"
        aria-live="polite"
        class="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.64a.75.75 0 0 0-1.22-.87l-3.24 4.53-1.8-1.8a.75.75 0 1 0-1.06 1.06l2.4 2.4a.75.75 0 0 0 1.14-.09l3.78-5.23Z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="flex-1 leading-relaxed">{{ SUCCESS_MESSAGE }}</p>
        <button
          type="button"
          class="-mr-1 rounded p-1 text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Đóng thông báo"
          @click="toastVisible = false"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
            />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>