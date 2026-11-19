<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { reactive, ref } from "vue";
import { useFeedbackStore } from "../../../stores/feedback";

const emit = defineEmits<{ submitted: [] }>();
const feedbackStore = useFeedbackStore();
const form = reactive({ like: "", dislike: "", contribute: "" });
const errors = reactive({ like: "", dislike: "" });
const submitError = ref("");
const textareaBase =
  "w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:opacity-60";

function validate() {
  errors.like = form.like.trim() ? "" : tr('OpinionFeedbackForm.vui_long_cho_biet_ban_thich_dieu_gi');
  errors.dislike = form.dislike.trim() ? "" : tr('OpinionFeedbackForm.vui_long_cho_biet_ban_chua_hai_long_dieu_gi');
  return !errors.like && !errors.dislike;
}

async function handleSubmit() {
  submitError.value = "";
  if (!validate()) return;
  try {
    await feedbackStore.submitOpinion(form);
    form.like = "";
    form.dislike = "";
    form.contribute = "";
    emit("submitted");
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : tr('OpinionFeedbackForm.khong_the_gui_y_kien_luc_nay_vui_long_thu_lai');
  }
}
</script>

<template>
  <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="handleSubmit">
    <div class="slide-fade-in from-bottom player-content-in flex-1 space-y-5 overflow-y-auto px-6 py-5">
      <div>
        <label for="fb-like" class="mb-1.5 block text-sm font-medium text-gray-800"
          >{{ tr('OpinionFeedbackForm.ban_thich_dieu_gi') }} <span class="text-red-500">*</span></label
        >
        <textarea
          id="fb-like"
          v-model="form.like"
          rows="3"
          :disabled="feedbackStore.submitting"
          :placeholder="tr('OpinionFeedbackForm.nhung_dieu_lam_ban_hai_long')"
          :aria-invalid="!!errors.like"
          :class="[
            textareaBase,
            errors.like
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200',
          ]"
          @input="errors.like = ''"
        />
        <div v-if="errors.like" class="mt-1 text-sm text-red-600">{{ errors.like }}</div>
      </div>
      <div>
        <label for="fb-dislike" class="mb-1.5 block text-sm font-medium text-gray-800"
          >{{ tr('OpinionFeedbackForm.ban_chua_hai_long_dieu_gi') }} <span class="text-red-500">*</span></label
        >
        <textarea
          id="fb-dislike"
          v-model="form.dislike"
          rows="3"
          :disabled="feedbackStore.submitting"
          :placeholder="tr('OpinionFeedbackForm.nhung_dieu_ban_thay_kho_dung_hoac_chua_tot')"
          :aria-invalid="!!errors.dislike"
          :class="[
            textareaBase,
            errors.dislike
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200',
          ]"
          @input="errors.dislike = ''"
        />
        <div v-if="errors.dislike" class="mt-1 text-sm text-red-600">{{ errors.dislike }}</div>
      </div>
      <div>
        <label for="fb-contribute" class="mb-1.5 block text-sm font-medium text-gray-800"
          >{{ tr('OpinionFeedbackForm.ban_mong_muon_dieu_gi') }} <span class="font-normal text-gray-400">{{ tr('ErrorFeedbackForm.khong_bat_buoc') }}</span></label
        >
        <textarea
          id="fb-contribute"
          v-model="form.contribute"
          rows="3"
          :disabled="feedbackStore.submitting"
          :placeholder="tr('OpinionFeedbackForm.y_tuong_hoac_tinh_nang_ban_mong_muon')"
          :class="[textareaBase, 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200']"
        />
      </div>
      <div v-if="submitError" role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ submitError }}
      </div>
    </div>
    <div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
      <button
        type="submit"
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="feedbackStore.submitting"
      >
        <svg
          v-if="feedbackStore.submitting"
          class="h-4 w-4 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
        </svg>
        {{ feedbackStore.submitting ? tr('ErrorFeedbackForm.dang_gui') : tr('OpinionFeedbackForm.gui_y_kien') }}
      </button>
    </div>
  </form>
</template>
