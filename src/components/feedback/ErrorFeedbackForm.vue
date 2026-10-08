<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFeedbackStore } from '../../stores/feedback'

const emit = defineEmits<{ submitted: [] }>()
const feedbackStore = useFeedbackStore()
const title = ref('')
const description = ref('')
const files = ref<File[]>([])
const titleError = ref('')
const submitError = ref('')
const fileError = ref('')
const textareaBase = 'w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:opacity-60'
const fileNames = computed(() => files.value.map(file => file.name).join(', '))

function onFilesChanged(event: Event) {
  fileError.value = ''
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files ?? [])
  const valid = selected.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'))
  if (valid.length !== selected.length) fileError.value = 'Chỉ có thể đính kèm ảnh hoặc video.'
  files.value = [...files.value, ...valid].slice(0, 5)
  if (selected.length + files.value.length > 5) fileError.value = 'Bạn chỉ có thể đính kèm tối đa 5 file.'
  input.value = ''
}

async function handleSubmit() {
  submitError.value = ''
  titleError.value = title.value.trim() ? '' : 'Vui lòng nhập tiêu đề lỗi.'
  if (titleError.value) return
  try {
    await feedbackStore.submitError({ title: title.value, description: description.value, files: files.value })
    title.value = ''
    description.value = ''
    files.value = []
    emit('submitted')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Không thể gửi báo lỗi lúc này. Vui lòng thử lại.'
  }
}
</script>

<template>
  <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="handleSubmit">
    <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
      <div>
        <label for="error-title" class="mb-1.5 block text-sm font-medium text-gray-800">Tiêu đề lỗi <span class="text-red-500">*</span></label>
        <input id="error-title" v-model="title" type="text" maxlength="160" :disabled="feedbackStore.submitting" placeholder="Mô tả ngắn gọn sự cố" :aria-invalid="!!titleError" :class="[textareaBase, titleError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200']" @input="titleError = ''" />
        <p v-if="titleError" class="mt-1 text-sm text-red-600">{{ titleError }}</p>
      </div>
      <div>
        <label for="error-description" class="mb-1.5 block text-sm font-medium text-gray-800">Mô tả chi tiết <span class="font-normal text-gray-400">(không bắt buộc)</span></label>
        <textarea id="error-description" v-model="description" rows="5" :disabled="feedbackStore.submitting" placeholder="Các bước xảy ra lỗi, kết quả mong đợi và kết quả thực tế…" :class="[textareaBase, 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200']" />
      </div>
      <div>
        <label for="error-attachments" class="mb-1.5 block text-sm font-medium text-gray-800">Ảnh hoặc video <span class="font-normal text-gray-400">(tối đa 5 file)</span></label>
        <input id="error-attachments" type="file" accept="image/*,video/*" multiple :disabled="feedbackStore.submitting" class="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100" @change="onFilesChanged" />
        <p v-if="fileNames" class="mt-2 text-sm text-gray-600">{{ fileNames }}</p>
        <p v-if="fileError" class="mt-1 text-sm text-red-600">{{ fileError }}</p>
        <button v-if="files.length" type="button" class="mt-2 text-sm text-indigo-700 underline" :disabled="feedbackStore.submitting" @click="files = []">Xóa các file đã chọn</button>
      </div>
      <p v-if="submitError" role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ submitError }}</p>
    </div>
    <div class="flex justify-end border-t border-gray-200 px-6 py-4">
      <button type="submit" class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" :disabled="feedbackStore.submitting">
        {{ feedbackStore.submitting ? 'Đang gửi…' : 'Gửi báo lỗi' }}
      </button>
    </div>
  </form>
</template>
