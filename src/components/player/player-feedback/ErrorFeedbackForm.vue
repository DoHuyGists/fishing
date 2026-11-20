<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { computed, ref } from "vue";
import { useFeedbackStore } from "../../../stores/player-feedback-store";

const emit = defineEmits<{ submitted: [] }>();
const feedbackStore = useFeedbackStore();
const title = ref("");
const description = ref("");
const files = ref<File[]>([]);
const titleError = ref("");
const submitError = ref("");
const fileError = ref("");
const textareaBase =
  "w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-content placeholder:text-content focus:outline-none focus:ring-2 disabled:opacity-60";
const fileNames = computed(() => files.value.map((file) => file.name).join(", "));

function onFilesChanged(event: Event) {
  fileError.value = "";
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files ?? []);
  const valid = selected.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
  if (valid.length !== selected.length) fileError.value = tr("ErrorFeedbackForm.chi_co_the_dinh_kem_anh_hoac_video");
  files.value = [...files.value, ...valid].slice(0, 5);
  if (selected.length + files.value.length > 5)
    fileError.value = tr("ErrorFeedbackForm.ban_chi_co_the_dinh_kem_toi_da_5_file");
  input.value = "";
}

async function handleSubmit() {
  submitError.value = "";
  titleError.value = title.value.trim() ? "" : tr("ErrorFeedbackForm.vui_long_nhap_tieu_de_loi");
  if (titleError.value) return;
  try {
    await feedbackStore.submitError({ title: title.value, description: description.value, files: files.value });
    title.value = "";
    description.value = "";
    files.value = [];
    emit("submitted");
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : tr("ErrorFeedbackForm.khong_the_gui_bao_loi_luc_nay_vui_long_thu_lai");
  }
}
</script>

<template>
  <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="handleSubmit">
    <div class="slide-fade-in from-bottom player-content-in flex-1 space-y-5 overflow-y-auto px-6 py-5">
      <div>
        <label for="error-title" class="mb-1.5 block text-sm font-medium text-content"
          >{{ tr("ErrorFeedbackForm.tieu_de_loi") }} <span class="text-danger">*</span></label
        >
        <input
          id="error-title"
          v-model="title"
          type="text"
          maxlength="160"
          :disabled="feedbackStore.submitting"
          :placeholder="tr('ErrorFeedbackForm.mo_ta_ngan_gon_su_co')"
          :aria-invalid="!!titleError"
          :class="[
            textareaBase,
            titleError
              ? 'border-danger focus:border-danger focus:ring-danger'
              : 'border-content focus:border-primary focus:ring-primary',
          ]"
          @input="titleError = ''"
        />
        <div v-if="titleError" class="mt-1 text-sm text-danger">{{ titleError }}</div>
      </div>
      <div>
        <label for="error-description" class="mb-1.5 block text-sm font-medium text-content"
          >{{ tr("ErrorFeedbackForm.mo_ta_chi_tiet") }}
          <span class="font-normal text-content">{{ tr("ErrorFeedbackForm.khong_bat_buoc") }}</span></label
        >
        <textarea
          id="error-description"
          v-model="description"
          rows="5"
          :disabled="feedbackStore.submitting"
          :placeholder="tr('ErrorFeedbackForm.cac_buoc_xay_ra_loi_ket_qua_mong_doi_va_ket_qua_thuc_te')"
          :class="[textareaBase, 'border-content focus:border-primary focus:ring-primary']"
        />
      </div>
      <div>
        <label for="error-attachments" class="mb-1.5 block text-sm font-medium text-content"
          >{{ tr("ErrorFeedbackForm.anh_hoac_video") }}
          <span class="font-normal text-content">{{ tr("ErrorFeedbackForm.toi_da_5_file") }}</span></label
        >
        <input
          id="error-attachments"
          type="file"
          accept="image/*,video/*"
          multiple
          :disabled="feedbackStore.submitting"
          class="block w-full text-sm text-content file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-surface"
          @change="onFilesChanged"
        />
        <div v-if="fileNames" class="mt-2 text-sm text-content">{{ fileNames }}</div>
        <div v-if="fileError" class="mt-1 text-sm text-danger">{{ fileError }}</div>
        <button
          v-if="files.length"
          type="button"
          class="mt-2 text-sm text-primary underline"
          :disabled="feedbackStore.submitting"
          @click="files = []"
        >
          {{ tr("ErrorFeedbackForm.xoa_cac_file_da_chon") }}
        </button>
      </div>
      <div v-if="submitError" role="alert" class="rounded-lg bg-surface px-3 py-2 text-sm text-danger">
        {{ submitError }}
      </div>
    </div>
    <div class="flex justify-end border-t border-border px-6 py-4">
      <button
        type="submit"
        class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="feedbackStore.submitting"
      >
        {{ feedbackStore.submitting ? tr("ErrorFeedbackForm.dang_gui") : tr("ErrorFeedbackForm.gui_bao_loi") }}
      </button>
    </div>
  </form>
</template>
