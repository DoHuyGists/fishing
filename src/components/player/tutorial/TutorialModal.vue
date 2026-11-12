<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Modal from "../../shared/Modal.vue";
import { useModalStore } from "../../../stores/modal";
import { useTutorialStore } from "../../../stores/tutorial";

const router = useRouter();
const modalStore = useModalStore();
const store = useTutorialStore();
const opening = ref(false);
const navigationError = ref("");
const modes = [{ value: "list", get label() { return tr('CaughtModal.danh_sach'); } }, { value: "grid", get label() { return tr('CaughtModal.luoi'); } }] as const;

async function enterLesson(slug: string) {
  if (opening.value) return;
  opening.value = true;
  navigationError.value = "";
  try {
    const failure = await router.push({ name: "tutorial", params: { slug } });
    if (!failure) modalStore.close();
  } catch {
    navigationError.value = tr('TutorialModal.khong_the_mo_man_huong_dan_vui_long_thu_lai');
  } finally {
    opening.value = false;
  }
}
onMounted(() => store.load());
</script>

<template>
  <Modal :title="tr('TutorialModal.thuc_hanh_cau_ca')" :sub-title="tr('TutorialModal.hoc_co_che_qua_cac_man_choi_huong_dan')" :show-count-data="false" :on-refresh="store.load">
    <div class="space-y-4 p-2 text-[#24352a] sm:p-4">
      <div class="slide-fade-in from-top player-content-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4">
        <div class="max-w-2xl text-sm leading-6">{{ tr('TutorialModal.tap_luyen_voi_trang_bi_co_san_ca_moi_va_tien_do_trong_man_huong_') }}</div>
        <div class="flex gap-1 rounded-lg border border-[#cbd9c6] bg-white p-1" role="group" :aria-label="tr('CaughtModal.che_do_hien_thi')">
          <button v-for="mode in modes" :key="mode.value" type="button" :aria-pressed="store.viewMode === mode.value"
            class="rounded-md px-3 py-2 text-xs font-bold hover:bg-[#e2ecdc]"
            :class="store.viewMode === mode.value ? 'bg-[#e2ecdc]' : ''" @click="store.setViewMode(mode.value)">{{ mode.label }}</button>
        </div>
      </div>
      <div v-if="navigationError" role="alert" class="text-sm text-red-700">{{ navigationError }}</div>
      <div v-if="store.loading" role="status" class="py-12 text-center">{{ tr('TutorialModal.dang_tai_man_huong_dan') }}</div>
      <div v-else-if="store.error" role="alert" class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-5 text-sm">
        <div>{{ store.error }}</div>
        <button type="button" class="mt-3 font-bold underline" @click="store.load">{{ tr('Maintenance.thu_lai') }}</button>
      </div>
      <div v-else-if="!store.tutorials.length" class="py-12 text-center">{{ tr('TutorialModal.chua_co_man_huong_dan_nao') }}</div>
      <div v-else class="grid gap-4" :class="store.viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'" :aria-label="tr('TutorialModal.cac_man_huong_dan')">
        <button v-for="lesson in store.tutorials" :key="lesson.id" type="button" :disabled="opening" :aria-label="tr('TutorialModal.choi_man_value0', { value0: lesson.title })"
          class="slide-fade-in from-bottom player-content-in overflow-hidden rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] text-left transition hover:border-[#70a77e] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-50"
          :class="store.viewMode === 'list' ? 'flex flex-col sm:flex-row' : ''" @click="enterLesson(lesson.slug)">
          <img :src="lesson.thumbnail" alt="" loading="lazy" class="object-cover" :class="store.viewMode === 'list' ? 'h-40 w-full sm:h-auto sm:w-56' : 'aspect-video w-full'" draggable="false">
          <div class="flex flex-1 flex-col gap-3 p-4">
            <div class="text-xs font-semibold text-[#61745d]">{{ tr('TutorialModal.khoang') }} {{ lesson.duration_minutes }} {{ tr('TutorialModal.phut_tap_luyen_tu_do') }}</div>
            <div class="text-lg font-bold">{{ lesson.title }}</div>
            <div class="text-sm leading-6">{{ lesson.description }}</div>
            <span class="mt-auto pt-2 text-sm font-bold text-emerald-800">{{ tr('TutorialModal.bat_dau_thuc_hanh') }}</span>
          </div>
        </button>
      </div>
    </div>
  </Modal>
</template>
